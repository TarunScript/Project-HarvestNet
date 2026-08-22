/**
 * Advisory API routes — Section 4.1 data flow implementation.
 *
 * POST /api/v1/advisory/regenerative
 *   → data-aggregator (L3) → rules-engine (L2a) → Gemini (L2b) → AgriDPIPayload
 *
 * @see Section 4.1  — Data flow (steps 1–5)
 * @see Section 8    — /api/v1/advisory/regenerative endpoint contract
 * @see Section 10.1 — Narrate-only prompt (Dev 1 owns prompt content)
 */

import { Router, Request, Response } from 'express';
import type { AgriDPIPayload, RecommendationCandidate } from '@harvestnet/schemas';

interface AdvisoryConfig {
  dataAggregatorUrl: string;
  rulesEngineUrl: string;
  geminiApiKey: string;
  identityApiUrl: string;
}

export function createAdvisoryRoutes(config: AdvisoryConfig): Router {
  const router = Router();

  /**
   * POST /api/v1/advisory/regenerative
   *
   * Fetch localized regenerative crop advisory.
   * Implements the Section 4.1 data flow:
   *   1. Client sends lat/lng/crop_history/language
   *   2. Fetch spatial data from data-aggregator (L3)
   *   3. Compute recommendation via rules-engine (L2a)
   *   4. Narrate via Gemini (L2b) — narrate-only, Section 10.1
   *   5. Return AgriDPIPayload
   */
  router.post(
    '/api/v1/advisory/regenerative',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { latitude, longitude, current_crop_history, language, farmer_id } = req.body;

        // Validate required fields (Section 8 requestBody)
        if (latitude == null || longitude == null || !current_crop_history || !language) {
          res.status(400).json({
            error: 'Missing required fields: latitude, longitude, current_crop_history, language',
          });
          return;
        }

        // ── Step 2: Fetch spatial data from data-aggregator (L3) ──────────
        // Section 4.1: "calls L3 for current NDVI, soil, and weather
        // (served from warmed cache if a live call exceeds 1500ms)"
        let spatialData: any;
        try {
          const dataUrl = `${config.dataAggregatorUrl}/data/${latitude}/${longitude}`;
          const dataResponse = await fetch(dataUrl);
          if (!dataResponse.ok) {
            throw new Error(`data-aggregator returned ${dataResponse.status}`);
          }
          spatialData = await dataResponse.json();
        } catch (err) {
          console.error('[advisory-api] Failed to fetch spatial data:', err);
          res.status(502).json({ error: 'Failed to fetch spatial data from L3' });
          return;
        }

        // ── Step 3: Compute recommendation via rules-engine (L2a) ─────────
        // Section 4.1: "L2a rules engine computes a RecommendationCandidate
        // deterministically from that data — no LLM call yet"
        let recommendation: RecommendationCandidate;
        try {
          const rulesResponse = await fetch(`${config.rulesEngineUrl}/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              soil_metrics: spatialData.soil_metrics,
              remote_sensing: spatialData.remote_sensing,
              weather: spatialData.weather,
              crop_history: current_crop_history,
            }),
          });
          if (!rulesResponse.ok) {
            throw new Error(`rules-engine returned ${rulesResponse.status}`);
          }
          recommendation = await rulesResponse.json() as RecommendationCandidate;
        } catch (err) {
          console.error('[advisory-api] Failed to call rules-engine:', err);
          res.status(502).json({ error: 'Failed to compute recommendation from L2a' });
          return;
        }

        // ── Step 4: Narrate via Gemini (L2b) ──────────────────────────────
        // Section 4.1: "L2b sends the RecommendationCandidate plus the
        // farmer's language to Gemini with a narrate-only prompt"
        // Section 10.1: Dev 1 owns the prompt; we wire the API call.
        let explanation_text = '';
        try {
          explanation_text = await callGeminiNarration(
            config.geminiApiKey,
            recommendation,
            language
          );
        } catch (err) {
          console.warn('[advisory-api] Gemini narration failed, using fallback:', err);
          // Fallback: return a basic text summary instead of failing the whole request
          explanation_text = `Based on soil analysis (pH: ${spatialData.soil_metrics.ph_level}, ` +
            `organic carbon: ${spatialData.soil_metrics.organic_carbon_percentage}%), ` +
            `we recommend ${recommendation.recommended_primary_crop} as your primary crop` +
            (recommendation.soil_amendments.length > 0
              ? ` with ${recommendation.soil_amendments.join(', ')} amendments`
              : '') +
            '.';
        }

        // ── Step 5: Assemble and return AgriDPIPayload ────────────────────
        const payload: AgriDPIPayload = {
          timestamp: new Date().toISOString(),
          location: { latitude, longitude },
          soil_metrics: spatialData.soil_metrics,
          remote_sensing: spatialData.remote_sensing,
          regenerative_plan: recommendation,
          explanation_text,
        };

        // Addendum Section 18.5: if farmer_id is present, forward to
        // identity-api's history endpoint (optional, non-blocking)
        if (farmer_id && config.identityApiUrl) {
          // Fire-and-forget — don't block the response
          fetch(`${config.identityApiUrl}/api/v1/farmers/${farmer_id}/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'advisory', payload }),
          }).catch((err) => {
            console.warn('[advisory-api] Failed to forward to identity-api:', err);
          });
        }

        res.json(payload);
      } catch (error) {
        console.error('[advisory-api] Unexpected error:', error);
        res.status(500).json({ error: 'Internal advisory error' });
      }
    }
  );

  /**
   * GET /health
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'advisory-api', layer: 'L2b' });
  });

  return router;
}

/**
 * Call Gemini API with the narrate-only prompt (Section 10.1).
 *
 * The prompt is from Section 10.1 — Dev 1 owns the prompt content:
 *   SYSTEM: "You are a translation and communication layer only..."
 *   USER: language + recommendation_candidate JSON
 *
 * Gemini responds with { explanation_text: string } via response_schema
 * enforcement (Section 11 — "native response_schema enforcement").
 */
async function callGeminiNarration(
  apiKey: string,
  recommendation: RecommendationCandidate,
  language: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  /**
   * Section 10.1 prompt — narrate-only:
   *
   * SYSTEM:
   * "You are a translation and communication layer only. You are given a
   *  RecommendationCandidate object that was already computed by a deterministic
   *  rules engine. You must NOT invent, alter, or add any agronomic fact, number,
   *  or recommendation not present in the object. Your only job is to narrate it
   *  clearly and warmly in the requested language, at a reading level suitable for
   *  a farmer with no technical background. Respond only in the required JSON
   *  schema: { explanation_text: string }."
   */
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [
          {
            text: `You are a translation and communication layer only. You are given a RecommendationCandidate object that was already computed by a deterministic rules engine. You must NOT invent, alter, or add any agronomic fact, number, or recommendation not present in the object. Your only job is to narrate it clearly and warmly in the requested language, at a reading level suitable for a farmer with no technical background. Respond only in the required JSON schema: { explanation_text: string }.`,
          },
        ],
      },
      contents: [
        {
          parts: [
            {
              text: `language: ${language}\nrecommendation_candidate: ${JSON.stringify(recommendation)}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            explanation_text: { type: 'STRING' },
          },
          required: ['explanation_text'],
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned ${response.status}`);
  }

  const data: any = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  const parsed = JSON.parse(text);
  return parsed.explanation_text;
}

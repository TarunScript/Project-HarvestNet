/**
 * dpi-gateway route definitions.
 * Section 8 (v2) + Addendum Section 23 (v3).
 *
 * All routes proxy to the owning backend service.
 * The gateway itself has no business logic — it is a thin
 * routing + feature-flag + auth layer (L4).
 */

import { Router, Request, Response } from 'express';
import { getAllFlags, updateFlag } from '../middleware/feature-flags.js';

interface ServiceUrls {
  advisoryApi: string;
  visionApi: string;
  identityApi: string;
  landPlotApi: string;
  soilTestApi: string;
  outbreakAggregator: string;
}

/**
 * Generic proxy helper: forwards the request to a backend service.
 */
async function proxyRequest(
  serviceUrl: string,
  path: string,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const url = `${serviceUrl}${path}`;
    const options: RequestInit = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, options);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`[dpi-gateway] Proxy error for ${path}:`, error);
    res.status(502).json({ error: `Backend service unavailable: ${path}` });
  }
}

export function createGatewayRoutes(urls: ServiceUrls): Router {
  const router = Router();

  // ══════════════════════════════════════════════════════════════
  // v2 Endpoints (Section 8)
  // ══════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/advisory/regenerative
   * Fetch localized regenerative crop advisory.
   * Section 8 — proxied to advisory-api (M4).
   */
  router.post('/api/v1/advisory/regenerative', (req, res) => {
    proxyRequest(urls.advisoryApi, '/api/v1/advisory/regenerative', req, res);
  });

  /**
   * POST /api/v1/diagnosis
   * Submit a crop photo for disease diagnosis.
   * Section 8 — proxied to vision-api (M5, Dev 1).
   *
   * After the diagnosis, forward the DiagnosisEvent to
   * outbreak-aggregator for N2 aggregation (Section 4.3).
   */
  router.post('/api/v1/diagnosis', async (req, res) => {
    try {
      // Forward to vision-api
      const visionUrl = `${urls.visionApi}/api/v1/diagnosis`;
      const visionResponse = await fetch(visionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });

      const diagnosisResult: any = await visionResponse.json();

      // Forward the DiagnosisEvent to outbreak-aggregator (fire-and-forget)
      // Section 4.3: "diagnosis events also publish to L4 and feed the outbreak-aggregator"
      if (diagnosisResult.event_id) {
        fetch(`${urls.outbreakAggregator}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(diagnosisResult),
        }).catch((err) => {
          console.warn('[dpi-gateway] Failed to forward to outbreak-aggregator:', err);
        });
      }

      res.status(visionResponse.status).json(diagnosisResult);
    } catch (error) {
      console.error('[dpi-gateway] Diagnosis proxy error:', error);
      res.status(502).json({ error: 'Vision service unavailable' });
    }
  });

  /**
   * GET /api/v1/alerts/regional
   * List active regional outbreak alerts (N2).
   * Section 8 — proxied to outbreak-aggregator (M7).
   *
   * Optional query: ?geohash5km=... to filter by region.
   */
  router.get('/api/v1/alerts/regional', (req, res) => {
    const qs = req.query.geohash5km ? `?geohash5km=${req.query.geohash5km}` : '';
    proxyRequest(urls.outbreakAggregator, `/api/v1/alerts/regional${qs}`, req, res);
  });

  // ══════════════════════════════════════════════════════════════
  // v3 Addendum Endpoints (Section 23)
  // ══════════════════════════════════════════════════════════════

  // ── Farmer Identity (M12, Addendum Section 18.4) ──────────────

  /**
   * POST /api/v1/farmers/register
   * Register a farmer and issue a farmer_id.
   */
  router.post('/api/v1/farmers/register', (req, res) => {
    proxyRequest(urls.identityApi, '/api/v1/farmers/register', req, res);
  });

  /**
   * GET /api/v1/farmers/:farmer_id
   * Fetch a farmer profile.
   */
  router.get('/api/v1/farmers/:farmer_id', (req, res) => {
    proxyRequest(urls.identityApi, `/api/v1/farmers/${req.params.farmer_id}`, req, res);
  });

  /**
   * PATCH /api/v1/farmers/:farmer_id
   * Update profile or consent.
   */
  router.patch('/api/v1/farmers/:farmer_id', (req, res) => {
    proxyRequest(urls.identityApi, `/api/v1/farmers/${req.params.farmer_id}`, req, res);
  });

  // ── Land Plot Mapping (M13, Addendum Section 19.3) ────────────

  /**
   * POST /api/v1/farmers/:farmer_id/plots
   * Save a drawn land-plot boundary.
   */
  router.post('/api/v1/farmers/:farmer_id/plots', (req, res) => {
    proxyRequest(
      urls.landPlotApi,
      `/api/v1/farmers/${req.params.farmer_id}/plots`,
      req,
      res
    );
  });

  /**
   * GET /api/v1/farmers/:farmer_id/plots
   * List a farmer's plots.
   */
  router.get('/api/v1/farmers/:farmer_id/plots', (req, res) => {
    proxyRequest(
      urls.landPlotApi,
      `/api/v1/farmers/${req.params.farmer_id}/plots`,
      req,
      res
    );
  });

  /**
   * GET /api/v1/plots/:plot_id
   * Fetch a plot plus latest NDVI/soil snapshot.
   */
  router.get('/api/v1/plots/:plot_id', (req, res) => {
    proxyRequest(urls.landPlotApi, `/api/v1/plots/${req.params.plot_id}`, req, res);
  });

  // ── DIY Soil Testing (M16 wiring, Addendum Section 20.5/23) ───

  /**
   * POST /api/v1/soil-tests
   * Submit a DIY test (Mode A or B); returns a SoilTestResult.
   * Addendum Section 20.5 / Section 23.
   */
  router.post('/api/v1/soil-tests', (req, res) => {
    proxyRequest(urls.soilTestApi, '/api/v1/soil-tests', req, res);
  });

  /**
   * GET /api/v1/soil-tests/:result_id
   * Fetch a past soil-test result.
   */
  router.get('/api/v1/soil-tests/:result_id', (req, res) => {
    proxyRequest(
      urls.soilTestApi,
      `/api/v1/soil-tests/${req.params.result_id}`,
      req,
      res
    );
  });

  /**
   * GET /api/v1/farmers/:farmer_id/soil-tests
   * A farmer's soil-test history.
   */
  router.get('/api/v1/farmers/:farmer_id/soil-tests', (req, res) => {
    proxyRequest(
      urls.soilTestApi,
      `/api/v1/farmers/${req.params.farmer_id}/soil-tests`,
      req,
      res
    );
  });

  // ══════════════════════════════════════════════════════════════
  // Admin / Internal Endpoints
  // ══════════════════════════════════════════════════════════════

  /**
   * GET /admin/flags
   * List all feature flags (for debugging / admin UI).
   */
  router.get('/admin/flags', (_req, res) => {
    res.json(getAllFlags());
  });

  /**
   * PATCH /admin/flags/:flag_key
   * Update a feature flag.
   */
  router.patch('/admin/flags/:flag_key', (req, res) => {
    const updated = updateFlag(req.params.flag_key!, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Flag not found' });
      return;
    }
    res.json(updated);
  });

  /**
   * GET /health
   */
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'dpi-gateway',
      layer: 'L4',
      endpoints: {
        v2: [
          'POST /api/v1/advisory/regenerative',
          'POST /api/v1/diagnosis',
          'GET  /api/v1/alerts/regional',
        ],
        v3: [
          'POST  /api/v1/farmers/register',
          'GET   /api/v1/farmers/:farmer_id',
          'PATCH /api/v1/farmers/:farmer_id',
          'POST  /api/v1/farmers/:farmer_id/plots',
          'GET   /api/v1/farmers/:farmer_id/plots',
          'GET   /api/v1/plots/:plot_id',
          'POST  /api/v1/soil-tests',
          'GET   /api/v1/soil-tests/:result_id',
          'GET   /api/v1/farmers/:farmer_id/soil-tests',
        ],
      },
    });
  });

  return router;
}

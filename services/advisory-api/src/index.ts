/**
 * advisory-api — L2b Explain Layer orchestration service.
 * Section 4.1 data flow.
 *
 * Orchestrates the request flow:
 *   1. Receives request with latitude, longitude, crop_history, language
 *   2. Calls data-aggregator (M2/L3) for soil/NDVI/weather
 *   3. Calls rules-engine (M3/L2a) for RecommendationCandidate
 *   4. Calls Gemini with narrate-only prompt (Section 10.1) for explanation_text
 *   5. Returns AgriDPIPayload
 *
 * Dev 1 owns the Gemini prompt and rules-engine internals.
 * Dev 2 (this file) owns getting data in and the response out correctly.
 *
 * @see Section 4.1  — Data flow
 * @see Section 10.1 — Advisory explain-layer prompt
 * @see Addendum 18.5 — Optional farmer_id forwarding
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createAdvisoryRoutes } from './routes/advisory-routes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.ADVISORY_API_PORT || 3002;

const config = {
  dataAggregatorUrl: process.env.DATA_AGGREGATOR_URL || 'http://localhost:3001',
  rulesEngineUrl: process.env.RULES_ENGINE_URL || 'http://localhost:3006',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  identityApiUrl: process.env.IDENTITY_API_URL || 'http://localhost:3004',
};

app.use('/', createAdvisoryRoutes(config));

app.listen(PORT, () => {
  console.log(`[advisory-api] L2b service listening on port ${PORT}`);
});

export default app;

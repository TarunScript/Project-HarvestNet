/**
 * data-aggregator — L3 Spatial Data & Cache service.
 * Section 4.1, Section 11.
 *
 * Pulls and normalizes satellite (Earth Engine/Sentinel-2), soil (ISRIC SoilGrids),
 * and weather (OpenWeather) data. Implements the 1500ms cache-fallback rule:
 * if a live API call exceeds CACHE_FALLBACK_TIMEOUT_MS, serve from warmed cache.
 *
 * @see Section 4.1  — Data flow
 * @see Section 7.1  — Environment variables
 * @see Section 11   — Tech Stack
 * @see Section 14   — Risk: external API latency mitigation
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createEarthEngineClient } from './clients/earth-engine.js';
import { createSoilGridsClient } from './clients/soil-grids.js';
import { createWeatherClient } from './clients/weather.js';
import { createCacheLayer } from './cache/cache-layer.js';
import { createAggregatorRoutes } from './routes/aggregator-routes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.DATA_AGGREGATOR_PORT || 3001;
const CACHE_FALLBACK_TIMEOUT_MS = parseInt(
  process.env.CACHE_FALLBACK_TIMEOUT_MS || '1500',
  10
);

// Initialize clients
const earthEngine = createEarthEngineClient();
const soilGrids = createSoilGridsClient();
const weather = createWeatherClient();
const cache = createCacheLayer();

// Register routes
app.use(
  '/',
  createAggregatorRoutes({
    earthEngine,
    soilGrids,
    weather,
    cache,
    timeoutMs: CACHE_FALLBACK_TIMEOUT_MS,
  })
);

app.listen(PORT, () => {
  console.log(`[data-aggregator] L3 service listening on port ${PORT}`);
});

export default app;

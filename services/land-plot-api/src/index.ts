/**
 * land-plot-api — Farmer Land Plot Mapping service.
 * Addendum Section 19.
 *
 * Lets a registered farmer draw their land's boundary on a satellite basemap.
 * Stores plot geometry, derives area_hectares and centroid, and proxies
 * data-aggregator for NDVI/soil values scoped to the polygon's centroid.
 *
 * Does NOT duplicate data-aggregator's API clients — calls the existing service.
 *
 * @see Addendum Section 19   — Land Plot Mapping Module
 * @see Addendum Section 19.1 — Service boundary
 * @see Addendum Section 17   — Module boundary rule
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createPlotRoutes } from './routes/plot-routes.js';
import { createPlotStore } from './store/plot-store.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.LAND_PLOT_API_PORT || 3005;
const DATA_AGGREGATOR_URL = process.env.DATA_AGGREGATOR_URL || 'http://localhost:3001';

// Initialize the plot store
const store = createPlotStore();

// Register routes
app.use('/', createPlotRoutes(store, DATA_AGGREGATOR_URL));

app.listen(PORT, () => {
  console.log(`[land-plot-api] service listening on port ${PORT}`);
});

export default app;

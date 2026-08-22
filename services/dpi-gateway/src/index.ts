/**
 * dpi-gateway — L4 Agri Data Exchange (DPI) gateway.
 * Section 8, Addendum Section 23.
 *
 * Public API gateway that routes requests to backend services.
 * Serves the OpenAPI/Swagger UI docs.
 * Checks FeatureFlags at request time (Addendum 21.1).
 *
 * @see Section 8     — Layer 4 API Contract
 * @see Addendum 23   — Updated L4 API Contract
 * @see Addendum 21.1 — FeatureFlag schema
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createGatewayRoutes } from './routes/gateway-routes.js';
import { createFeatureFlagMiddleware, initializeFlags } from './middleware/feature-flags.js';
import { setupSwagger } from './swagger.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.DPI_GATEWAY_PORT || 3000;

// Service URLs
const serviceUrls = {
  advisoryApi: process.env.ADVISORY_API_URL || 'http://localhost:3002',
  visionApi: process.env.VISION_API_URL || 'http://localhost:3003',
  identityApi: process.env.IDENTITY_API_URL || 'http://localhost:3004',
  landPlotApi: process.env.LAND_PLOT_API_URL || 'http://localhost:3005',
  soilTestApi: process.env.SOIL_TEST_API_URL || 'http://localhost:3008',
  outbreakAggregator: process.env.OUTBREAK_AGGREGATOR_URL || 'http://localhost:3007',
};

// Initialize feature flags
initializeFlags();

// Feature flag middleware (Addendum 21.1)
app.use(createFeatureFlagMiddleware());

// Setup Swagger UI — resolve docs/openapi.yaml relative to project root
const openapiPath = path.resolve(process.cwd(), 'docs', 'openapi.yaml');
setupSwagger(app, openapiPath);

// Register all gateway routes
app.use('/', createGatewayRoutes(serviceUrls));

app.listen(PORT, () => {
  console.log(`[dpi-gateway] L4 DPI gateway listening on port ${PORT}`);
  console.log(`  Swagger UI available at http://localhost:${PORT}/docs`);
});

export default app;

/**
 * identity-api — L0 Farmer Identity & Registration service.
 * Addendum Section 18.
 *
 * The ONLY service permitted to write to the farmer identity store.
 * Every other service reads farmer_id as an opaque foreign key;
 * none of them store name, phone number, or raw location history.
 *
 * @see Addendum Section 18   — Farmer Identity & Registration Module
 * @see Addendum Section 18.2 — Service boundary
 * @see Addendum Section 17   — Module boundary rule
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createFarmerRoutes } from './routes/farmer-routes.js';
import { createFarmerStore } from './store/farmer-store.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.IDENTITY_API_PORT || 3004;

// Initialize the farmer identity store
const store = createFarmerStore();

// Register routes
app.use('/', createFarmerRoutes(store));

app.listen(PORT, () => {
  console.log(`[identity-api] L0 service listening on port ${PORT}`);
});

export default app;

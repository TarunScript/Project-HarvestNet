/**
 * Farmer identity routes — Addendum Section 18.4.
 *
 * Endpoints:
 *   POST   /api/v1/farmers/register         — Create a FarmerProfile; returns farmer_id
 *   GET    /api/v1/farmers/:farmer_id        — Fetch profile (self or authorized partner)
 *   PATCH  /api/v1/farmers/:farmer_id        — Update profile fields or consent flags
 *   GET    /api/v1/farmers/:farmer_id/history — Aggregated links to advisories, diagnoses, etc.
 *
 * @see Addendum Section 18.4 — API contract
 * @see Addendum Section 18.5 — Backward compatibility
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import type { FarmerProfile, FarmerConsent } from '@harvestnet/schemas';
import type { FarmerStore } from '../store/farmer-store.js';

export function createFarmerRoutes(store: FarmerStore): Router {
  const router = Router();

  /**
   * POST /api/v1/farmers/register
   * Create a FarmerProfile; returns farmer_id.
   * Addendum Section 18.4.
   */
  router.post('/api/v1/farmers/register', async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        display_name,
        phone_number,
        preferred_language,
        home_region_geohash5km,
        consent,
      } = req.body;

      // Validate required fields
      if (!display_name || !phone_number || !preferred_language) {
        res.status(400).json({
          error: 'Missing required fields: display_name, phone_number, preferred_language',
        });
        return;
      }

      // Validate consent is provided and well-formed
      if (!consent || typeof consent.data_sharing_with_partners !== 'boolean') {
        res.status(400).json({
          error: 'Consent object is required with explicit data_sharing_with_partners and climate_trend_aggregation flags',
        });
        return;
      }

      // Hash phone number — never stored raw outside identity-api (Section 18.3)
      const phone_number_hash = crypto
        .createHash('sha256')
        .update(phone_number)
        .digest('hex');

      const farmerConsent: FarmerConsent = {
        consent_version: consent.consent_version || '1.0',
        data_sharing_with_partners: consent.data_sharing_with_partners,
        climate_trend_aggregation: consent.climate_trend_aggregation ?? false,
        recorded_at: new Date().toISOString(),
      };

      const profile: FarmerProfile = {
        farmer_id: uuidv4(),
        registered_at: new Date().toISOString(),
        display_name,
        phone_number_hash,
        preferred_language,
        home_region_geohash5km: home_region_geohash5km || '',
        consent: farmerConsent,
        plot_ids: [],
      };

      const created = await store.create(profile);

      res.status(201).json({
        farmer_id: created.farmer_id,
        registered_at: created.registered_at,
        message: 'Farmer registered successfully',
      });
    } catch (error) {
      console.error('[identity-api] Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  /**
   * GET /api/v1/farmers/:farmer_id
   * Fetch a farmer profile.
   * Addendum Section 18.4.
   */
  router.get('/api/v1/farmers/:farmer_id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { farmer_id } = req.params as { farmer_id: string };
      const profile = await store.getById(farmer_id!);

      if (!profile) {
        res.status(404).json({ error: 'Farmer not found' });
        return;
      }

      res.json(profile);
    } catch (error) {
      console.error('[identity-api] Fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * PATCH /api/v1/farmers/:farmer_id
   * Update profile fields or consent flags.
   * Addendum Section 18.4.
   */
  router.patch('/api/v1/farmers/:farmer_id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { farmer_id } = req.params as { farmer_id: string };
      const updates = req.body;

      // Don't allow changing farmer_id or registered_at
      delete updates.farmer_id;
      delete updates.registered_at;

      // If updating phone number, hash it
      if (updates.phone_number) {
        updates.phone_number_hash = crypto
          .createHash('sha256')
          .update(updates.phone_number)
          .digest('hex');
        delete updates.phone_number;
      }

      // If updating consent, record the timestamp
      if (updates.consent) {
        updates.consent.recorded_at = new Date().toISOString();
      }

      const updated = await store.update(farmer_id!, updates);

      if (!updated) {
        res.status(404).json({ error: 'Farmer not found' });
        return;
      }

      res.json(updated);
    } catch (error) {
      console.error('[identity-api] Update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  /**
   * GET /api/v1/farmers/:farmer_id/history
   * Aggregated links to that farmer's advisories, diagnoses, soil tests, plots.
   *
   * identity-api fetches these by calling the owning services' public APIs,
   * not their databases (Addendum Section 18.4).
   */
  router.get(
    '/api/v1/farmers/:farmer_id/history',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { farmer_id } = req.params as { farmer_id: string };
        const profile = await store.getById(farmer_id!);

        if (!profile) {
          res.status(404).json({ error: 'Farmer not found' });
          return;
        }

        // In a full implementation, this would call:
        //   - advisory-api for advisory history
        //   - vision-api for diagnosis history
        //   - soil-test-api for soil test history
        //   - land-plot-api for plot details
        // All via their public APIs, not their databases.
        const history = {
          farmer_id: profile.farmer_id,
          plots: profile.plot_ids,
          advisories: [],  // Would be populated from advisory-api
          diagnoses: [],   // Would be populated from vision-api
          soil_tests: [],  // Would be populated from soil-test-api
          message: 'History aggregation calls to owning services would be wired here',
        };

        res.json(history);
      } catch (error) {
        console.error('[identity-api] History error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
      }
    }
  );

  /**
   * GET /health
   * Health check endpoint.
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'identity-api', layer: 'L0' });
  });

  return router;
}

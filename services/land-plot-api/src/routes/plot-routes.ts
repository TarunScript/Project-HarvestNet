/**
 * Land plot routes — Addendum Section 19.3.
 *
 * Endpoints:
 *   POST  /api/v1/farmers/:farmer_id/plots   — Save a drawn polygon
 *   GET   /api/v1/farmers/:farmer_id/plots   — List a farmer's plots
 *   GET   /api/v1/plots/:plot_id              — Fetch plot + latest NDVI/soil
 *   GET   /api/v1/plots/:plot_id/history      — Time series of advisories/soil tests
 *
 * @see Addendum Section 19.3 — API contract
 * @see Addendum Section 19.1 — calls data-aggregator, does NOT duplicate L3 clients
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { LandPlot, GeoJSONPolygon } from '@harvestnet/schemas';
import type { PlotStore } from '../store/plot-store.js';
import { computeAreaHectares, computeCentroid } from '../utils/geometry.js';

/**
 * Creates plot routes.
 *
 * @param store Plot store instance
 * @param dataAggregatorUrl URL of the data-aggregator service (L3).
 *        land-plot-api proxies L3 for NDVI/soil data scoped to the plot's
 *        centroid — it does NOT duplicate L3's clients (Addendum 19.1).
 */
export function createPlotRoutes(store: PlotStore, dataAggregatorUrl: string): Router {
  const router = Router();

  /**
   * POST /api/v1/farmers/:farmer_id/plots
   * Save a drawn polygon; returns plot_id, area_hectares, centroid.
   * Addendum Section 19.3.
   */
  router.post(
    '/api/v1/farmers/:farmer_id/plots',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { farmer_id } = req.params as { farmer_id: string };
        const { boundary, label } = req.body;

        // Validate boundary is a GeoJSON Polygon
        if (
          !boundary ||
          boundary.type !== 'Polygon' ||
          !Array.isArray(boundary.coordinates) ||
          !boundary.coordinates[0] ||
          boundary.coordinates[0].length < 4
        ) {
          res.status(400).json({
            error: 'Invalid boundary: must be a GeoJSON Polygon with at least 4 coordinate pairs (closed ring)',
          });
          return;
        }

        const polygon: GeoJSONPolygon = {
          type: 'Polygon',
          coordinates: boundary.coordinates,
        };

        /**
         * Derive area_hectares and centroid from the polygon.
         *
         * Both are DERIVED fields with explicit formulas (Section 6):
         *   area_hectares: Shoelace formula with cos(lat) projection
         *   centroid: arithmetic mean of vertices
         *
         * @see services/land-plot-api/src/utils/geometry.ts for full formulas
         */
        const area_hectares = computeAreaHectares(polygon);
        const centroid = computeCentroid(polygon);

        const plot: LandPlot = {
          plot_id: uuidv4(),
          farmer_id: farmer_id,
          boundary: polygon,
          area_hectares,
          centroid,
          label: label || null,
          created_at: new Date().toISOString(),
          soil_test_ids: [],
        };

        const created = await store.create(plot);

        res.status(201).json({
          plot_id: created.plot_id,
          area_hectares: created.area_hectares,
          centroid: created.centroid,
          label: created.label,
          created_at: created.created_at,
        });
      } catch (error) {
        console.error('[land-plot-api] Create plot error:', error);
        res.status(500).json({ error: 'Failed to create plot' });
      }
    }
  );

  /**
   * GET /api/v1/farmers/:farmer_id/plots
   * List a farmer's plots.
   * Addendum Section 19.3.
   */
  router.get(
    '/api/v1/farmers/:farmer_id/plots',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { farmer_id } = req.params as { farmer_id: string };
        const plots = await store.getByFarmerId(farmer_id);
        res.json({ farmer_id, plots });
      } catch (error) {
        console.error('[land-plot-api] List plots error:', error);
        res.status(500).json({ error: 'Failed to list plots' });
      }
    }
  );

  /**
   * GET /api/v1/plots/:plot_id
   * Fetch one plot plus its latest NDVI/soil snapshot.
   *
   * The NDVI/soil data is proxied from data-aggregator (L3) using
   * the plot's centroid — land-plot-api does NOT duplicate L3's
   * API clients (Addendum Section 19.1).
   */
  router.get(
    '/api/v1/plots/:plot_id',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { plot_id } = req.params as { plot_id: string };
        const plot = await store.getById(plot_id);

        if (!plot) {
          res.status(404).json({ error: 'Plot not found' });
          return;
        }

        // Proxy spatial data from data-aggregator using the plot's centroid
        let spatialSnapshot = null;
        try {
          const url = `${dataAggregatorUrl}/data/${plot.centroid.latitude}/${plot.centroid.longitude}`;
          const response = await fetch(url);
          if (response.ok) {
            spatialSnapshot = await response.json();
          }
        } catch (err) {
          console.warn('[land-plot-api] Could not fetch spatial data from data-aggregator:', err);
        }

        res.json({
          ...plot,
          spatial_snapshot: spatialSnapshot,
        });
      } catch (error) {
        console.error('[land-plot-api] Fetch plot error:', error);
        res.status(500).json({ error: 'Failed to fetch plot' });
      }
    }
  );

  /**
   * GET /api/v1/plots/:plot_id/history
   * Time series of advisories and soil tests linked to this plot.
   * This is the basis for Section 25 climate-change trend tracking.
   * Addendum Section 19.3.
   */
  router.get(
    '/api/v1/plots/:plot_id/history',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { plot_id } = req.params as { plot_id: string };
        const plot = await store.getById(plot_id);

        if (!plot) {
          res.status(404).json({ error: 'Plot not found' });
          return;
        }

        // In a full implementation, this would call:
        //   - advisory-api for advisories linked to this plot
        //   - soil-test-api for soil tests linked to this plot
        // All via their public APIs (Module boundary rule, Section 17).
        const history = {
          plot_id: plot.plot_id,
          farmer_id: plot.farmer_id,
          soil_test_ids: plot.soil_test_ids,
          advisories: [],  // Would be populated from advisory-api
          soil_tests: [],  // Would be populated from soil-test-api
        };

        res.json(history);
      } catch (error) {
        console.error('[land-plot-api] History error:', error);
        res.status(500).json({ error: 'Failed to fetch plot history' });
      }
    }
  );

  /**
   * GET /health
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'land-plot-api' });
  });

  return router;
}

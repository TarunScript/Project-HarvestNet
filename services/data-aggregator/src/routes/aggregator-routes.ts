/**
 * data-aggregator internal API routes.
 *
 * Exposes location-based data endpoints that other services
 * (advisory-api, land-plot-api) call to get soil, NDVI, and weather data.
 *
 * All external API calls go through the cache layer's raceWithCache()
 * method, enforcing the CACHE_FALLBACK_TIMEOUT_MS rule (Section 4.1).
 *
 * @see Section 4.1 — Data flow
 */

import { Router, Request, Response } from 'express';
import type { EarthEngineClient } from '../clients/earth-engine.js';
import type { SoilGridsClient } from '../clients/soil-grids.js';
import type { WeatherClient } from '../clients/weather.js';
import type { CacheLayer } from '../cache/cache-layer.js';

interface AggregatorDeps {
  earthEngine: EarthEngineClient;
  soilGrids: SoilGridsClient;
  weather: WeatherClient;
  cache: CacheLayer;
  timeoutMs: number;
}

/**
 * Combined spatial data response — all data needed by advisory-api
 * to pass into the rules engine.
 */
export interface SpatialData {
  soil_metrics: {
    ph_level: number;
    organic_carbon_percentage: number;
    texture_classification: string;
  };
  remote_sensing: {
    sentinel2_ndvi_mean: number;
  };
  weather: {
    avg_rainfall_mm_7d: number;
    humidity: number;
    temperature_celsius: number;
  };
  location: {
    latitude: number;
    longitude: number;
  };
  sources: {
    soil: 'live' | 'cache';
    ndvi: 'live' | 'cache';
    weather: 'live' | 'cache';
  };
}

export function createAggregatorRoutes(deps: AggregatorDeps): Router {
  const router = Router();
  const { earthEngine, soilGrids, weather, cache, timeoutMs } = deps;

  /**
   * GET /data/:lat/:lng
   *
   * Fetch all spatial data for a location.
   * Returns soil metrics, NDVI, and weather in a single response.
   * Each external call is raced against the cache fallback timeout.
   */
  router.get('/data/:lat/:lng', async (req: Request, res: Response): Promise<void> => {
    try {
      const latitude = parseFloat(req.params.lat as string);
      const longitude = parseFloat(req.params.lng as string);

      if (isNaN(latitude) || isNaN(longitude)) {
        res.status(400).json({ error: 'Invalid latitude or longitude' });
        return;
      }

      // Build cache keys scoped to location (rounded to ~1km grid)
      const locKey = `${latitude.toFixed(2)}_${longitude.toFixed(2)}`;

      // Race all three data sources against the cache timeout in parallel
      const [soilResult, ndviResult, weatherResult] = await Promise.all([
        cache.raceWithCache(
          `soil_${locKey}`,
          () => soilGrids.getSoilData(latitude, longitude),
          timeoutMs
        ),
        cache.raceWithCache(
          `ndvi_${locKey}`,
          () => earthEngine.getNDVI(latitude, longitude),
          timeoutMs
        ),
        cache.raceWithCache(
          `weather_${locKey}`,
          () => weather.getWeather(latitude, longitude),
          timeoutMs
        ),
      ]);

      const response: SpatialData = {
        soil_metrics: soilResult.data,
        remote_sensing: {
          sentinel2_ndvi_mean: ndviResult.data.sentinel2_ndvi_mean,
        },
        weather: {
          avg_rainfall_mm_7d: weatherResult.data.avg_rainfall_mm_7d,
          humidity: weatherResult.data.humidity,
          temperature_celsius: weatherResult.data.temperature_celsius,
        },
        location: { latitude, longitude },
        sources: {
          soil: soilResult.source,
          ndvi: ndviResult.source,
          weather: weatherResult.source,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('[data-aggregator] Error fetching spatial data:', error);
      res.status(500).json({ error: 'Failed to fetch spatial data' });
    }
  });

  /**
   * GET /health
   * Health check endpoint.
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'data-aggregator', layer: 'L3' });
  });

  return router;
}

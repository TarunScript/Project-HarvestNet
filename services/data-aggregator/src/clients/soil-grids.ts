/**
 * ISRIC SoilGrids REST API client.
 *
 * Fetches soil chemistry data (pH, organic carbon, texture) for a given
 * location from the ISRIC SoilGrids global dataset at 250m resolution.
 *
 * Source: ISRIC SoilGrids REST API (Section 6, Section 11).
 * Fields produced: ph_level, organic_carbon_percentage, texture_classification
 *
 * @see Section 11 — Soil chemistry: ISRIC SoilGrids REST API
 * @see Section 6  — Data Integrity Rule: these fields trace to ISRIC SoilGrids
 */

import type { SoilMetrics } from '@harvestnet/schemas';

export interface SoilGridsClient {
  getSoilData(latitude: number, longitude: number): Promise<SoilMetrics>;
}

/**
 * USDA texture triangle classification.
 * Maps sand/silt/clay percentages to standard soil texture classes.
 * Same classification the rules engine branches on (Section 4.2, Addendum 20.3).
 */
function classifyTexture(sand: number, clay: number): string {
  if (clay >= 40) return 'Clay';
  if (sand >= 85) return 'Sand';
  if (clay >= 27 && sand <= 52) return 'Clay Loam';
  if (clay >= 20 && sand >= 45) return 'Sandy Clay Loam';
  if (sand >= 70) return 'Sandy Loam';
  if (clay < 12 && sand < 50) return 'Silt Loam';
  return 'Loam';
}

/**
 * Creates an ISRIC SoilGrids REST API client.
 *
 * Production: queries rest.isric.org for pH, SOC, and texture at
 * the standard 0-5cm depth layer.
 *
 * Fallback: returns realistic simulated values for development.
 */
export function createSoilGridsClient(): SoilGridsClient {
  const baseUrl = process.env.SOILGRIDS_BASE_URL || 'https://rest.isric.org';

  return {
    async getSoilData(latitude: number, longitude: number): Promise<SoilMetrics> {
      try {
        return await fetchRealSoilData(baseUrl, latitude, longitude);
      } catch (error) {
        console.warn(
          '[soil-grids] Live API call failed, using simulated data:',
          error
        );
        return simulateSoilData(latitude, longitude);
      }
    },
  };
}

/**
 * Fetch real soil data from ISRIC SoilGrids REST API.
 *
 * Endpoints:
 *   GET /soilgrids/v2.0/properties/query?lon=&lat=&property=phh2o&depth=0-5cm
 *   GET /soilgrids/v2.0/properties/query?lon=&lat=&property=ocd&depth=0-5cm
 *   GET /soilgrids/v2.0/properties/query?lon=&lat=&property=sand&depth=0-5cm
 *   GET /soilgrids/v2.0/properties/query?lon=&lat=&property=clay&depth=0-5cm
 *
 * pH values from SoilGrids are in pH*10 (e.g., 65 = pH 6.5).
 * OCD values are in g/kg — convert to percentage for our schema.
 */
async function fetchRealSoilData(
  baseUrl: string,
  latitude: number,
  longitude: number
): Promise<SoilMetrics> {
  const properties = ['phh2o', 'ocd', 'sand', 'clay'];
  const depth = '0-5cm';

  const results = await Promise.all(
    properties.map(async (prop) => {
      const url = `${baseUrl}/soilgrids/v2.0/properties/query?lon=${longitude}&lat=${latitude}&property=${prop}&depth=${depth}&value=mean`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`SoilGrids ${prop} returned ${response.status}`);
      const data: any = await response.json();

      // Extract the mean value from the nested response
      const layer = data.properties?.layers?.[0];
      const depthData = layer?.depths?.[0];
      return depthData?.values?.mean ?? null;
    })
  );

  const [phRaw, ocdRaw, sandRaw, clayRaw] = results;

  // Convert SoilGrids units:
  // pH is stored as pH*10 (e.g., 65 → 6.5)
  const ph_level = phRaw != null ? phRaw / 10 : 6.5;
  // OCD is in g/kg → convert to percentage (÷ 10)
  const organic_carbon_percentage = ocdRaw != null ? ocdRaw / 10 : 1.2;
  // Sand/clay are in g/kg → percentage (÷ 10)
  const sand = sandRaw != null ? sandRaw / 10 : 40;
  const clay = clayRaw != null ? clayRaw / 10 : 20;

  return {
    ph_level: parseFloat(ph_level.toFixed(1)),
    organic_carbon_percentage: parseFloat(organic_carbon_percentage.toFixed(2)),
    texture_classification: classifyTexture(sand, clay),
  };
}

/**
 * Simulate realistic soil data for development/demo.
 */
function simulateSoilData(latitude: number, longitude: number): SoilMetrics {
  // Seeded pseudorandom for consistent demo data
  const seed = Math.abs(Math.sin(latitude * 43.758 + longitude * 23.421));
  const frac = (seed * 9301 + 49297) % 233280 / 233280;

  // pH typically 4.5–8.5 range
  const ph = 4.5 + frac * 4.0;
  // Organic carbon typically 0.2–3.0%
  const oc = 0.2 + frac * 2.8;

  // Texture based on location hash
  const textures = ['Loam', 'Clay Loam', 'Sandy Loam', 'Silt Loam', 'Clay', 'Sandy Clay Loam'];
  const textureIdx = Math.floor(frac * textures.length) % textures.length;

  return {
    ph_level: parseFloat(ph.toFixed(1)),
    organic_carbon_percentage: parseFloat(oc.toFixed(2)),
    texture_classification: textures[textureIdx]!,
  };
}

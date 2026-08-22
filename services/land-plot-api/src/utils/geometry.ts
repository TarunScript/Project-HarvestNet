/**
 * Geometry utilities for land plot calculations.
 *
 * All derived fields have explicit formulas per Section 6
 * Data Integrity Rule — not invented values.
 *
 * @see Addendum Section 19.2 — area_hectares and centroid are derived fields
 * @see Section 6 — Data Integrity Rule
 */

import type { GeoJSONPolygon } from '@harvestnet/schemas';

/**
 * Compute the area of a GeoJSON polygon in hectares.
 *
 * DERIVED FIELD — Formula documented per Section 6:
 *
 * Uses the Shoelace formula (Gauss's area formula) on projected coordinates.
 * For WGS84 coordinates, we apply a cos(latitude) correction to convert
 * degree-based areas to metric areas.
 *
 * Formula:
 *   1. Shoelace: A = |Σ(x_i * y_{i+1} - x_{i+1} * y_i)| / 2
 *      where (x, y) are (longitude, latitude) in degrees
 *   2. Convert degrees² to m²:
 *      - 1° latitude  ≈ 111,320 m
 *      - 1° longitude ≈ 111,320 * cos(mean_lat) m
 *   3. Convert m² to hectares: ÷ 10,000
 *
 * @param polygon GeoJSON Polygon with coordinates in WGS84 [lng, lat]
 * @returns Area in hectares
 */
export function computeAreaHectares(polygon: GeoJSONPolygon): number {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return 0; // A valid polygon needs at least 4 points (closed ring)

  // Step 1: Shoelace formula in degree-space
  let shoelaceSum = 0;
  let latSum = 0;

  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!;  // [lng, lat]
    const [x2, y2] = ring[i + 1]!;
    shoelaceSum += x1! * y2! - x2! * y1!;
    latSum += y1!;
  }

  const areaDegrees = Math.abs(shoelaceSum) / 2;

  // Step 2: Convert from degrees² to m²
  // Mean latitude for cos() correction
  const meanLat = latSum / (ring.length - 1);
  const metersPerDegreeLat = 111320; // meters per degree of latitude
  const metersPerDegreeLng = 111320 * Math.cos((meanLat * Math.PI) / 180);

  const areaSquareMeters = areaDegrees * metersPerDegreeLat * metersPerDegreeLng;

  // Step 3: Convert m² to hectares (1 hectare = 10,000 m²)
  const hectares = areaSquareMeters / 10000;

  return parseFloat(hectares.toFixed(4));
}

/**
 * Compute the centroid of a GeoJSON polygon.
 *
 * DERIVED FIELD — Formula documented per Section 6:
 *
 * Arithmetic mean of polygon vertices (excluding the closing point
 * which duplicates the first vertex in GeoJSON):
 *   centroid_lat = Σ(lat_i) / n
 *   centroid_lng = Σ(lng_i) / n
 *
 * This centroid is used as the point L3 (data-aggregator) queries
 * for NDVI and soil data scoped to this plot (Addendum Section 19.2).
 *
 * @param polygon GeoJSON Polygon with coordinates in WGS84 [lng, lat]
 * @returns { latitude, longitude } centroid
 */
export function computeCentroid(polygon: GeoJSONPolygon): {
  latitude: number;
  longitude: number;
} {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) {
    return { latitude: 0, longitude: 0 };
  }

  // Exclude the last point (closing point duplicates the first in GeoJSON)
  const n = ring.length - 1;
  let latSum = 0;
  let lngSum = 0;

  for (let i = 0; i < n; i++) {
    lngSum += ring[i]![0]!;
    latSum += ring[i]![1]!;
  }

  return {
    latitude: parseFloat((latSum / n).toFixed(6)),
    longitude: parseFloat((lngSum / n).toFixed(6)),
  };
}

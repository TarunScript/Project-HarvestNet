/**
 * Tests for land-plot-api geometry utilities.
 * Validates the derived field formulas per Section 6 Data Integrity Rule.
 */

import { describe, it, expect } from 'vitest';
import { computeAreaHectares, computeCentroid } from '../utils/geometry.js';
import type { GeoJSONPolygon } from '@harvestnet/schemas';

describe('geometry utilities', () => {
  // A roughly 1km x 1km square near Bangalore (12.97°N, 77.59°E)
  const squarePlot: GeoJSONPolygon = {
    type: 'Polygon',
    coordinates: [
      [
        [77.59, 12.97],
        [77.60, 12.97],
        [77.60, 12.98],
        [77.59, 12.98],
        [77.59, 12.97],
      ],
    ],
  };

  describe('computeAreaHectares', () => {
    it('should compute area for a roughly 1km x 1km square', () => {
      const area = computeAreaHectares(squarePlot);
      expect(area).toBeGreaterThan(80);
      expect(area).toBeLessThan(160);
    });

    it('should return 0 for invalid polygons', () => {
      const invalid: GeoJSONPolygon = { type: 'Polygon', coordinates: [[]] };
      expect(computeAreaHectares(invalid)).toBe(0);
    });

    it('should return 0 for polygons with too few points', () => {
      const twoPoints: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 1], [0, 0]]],
      };
      expect(computeAreaHectares(twoPoints)).toBe(0);
    });
  });

  describe('computeCentroid', () => {
    it('should compute centroid as arithmetic mean of vertices', () => {
      const centroid = computeCentroid(squarePlot);
      expect(centroid.latitude).toBeCloseTo(12.975, 2);
      expect(centroid.longitude).toBeCloseTo(77.595, 2);
    });

    it('should return (0,0) for invalid polygons', () => {
      const invalid: GeoJSONPolygon = { type: 'Polygon', coordinates: [[]] };
      const centroid = computeCentroid(invalid);
      expect(centroid.latitude).toBe(0);
      expect(centroid.longitude).toBe(0);
    });
  });
});

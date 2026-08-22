/**
 * LandPlot — services/land-plot-api.
 * Addendum Section 19.2.
 *
 * Lets a registered farmer draw their land's boundary on a satellite
 * basemap. Reuses the imagery the platform already pulls in L3
 * (Google Earth Engine / Sentinel-2) — no new imagery source is introduced.
 *
 * @see Addendum Section 19     — Land Plot Mapping Module
 * @see Addendum Section 19.5   — Why plot_id matters beyond mapping
 * @see Section 6               — Data Integrity Rule
 */

/**
 * GeoJSON Polygon geometry (WGS84).
 * Standard GeoJSON spec — coordinates are [longitude, latitude] pairs.
 */
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface LandPlot {
  /**
   * UUID for this land plot.
   */
  plot_id: string;

  /**
   * FK → FarmerProfile (Addendum Section 18.3).
   */
  farmer_id: string;

  /**
   * Farmer-drawn polygon boundary in WGS84.
   * Source: Farmer input via map-draw-widget (Addendum Section 19.4).
   */
  boundary: GeoJSONPolygon;

  /**
   * Plot area in hectares.
   *
   * Source: DERIVED — computed from boundary geometry using planar
   * polygon area formula (Shoelace formula on projected coordinates).
   * Satisfies Section 6 the same way canopy_stress does (Section 4.2).
   *
   * Formula: Σ(x_i * y_{i+1} - x_{i+1} * y_i) / 2, converted to hectares
   * using the appropriate projection scaling factor for the plot's latitude.
   */
  area_hectares: number;

  /**
   * Polygon centroid, used as the point L3 (data-aggregator) queries.
   *
   * Source: DERIVED — arithmetic mean of polygon vertices.
   * Formula: centroid_lat = Σ(lat_i) / n, centroid_lng = Σ(lng_i) / n
   */
  centroid: {
    latitude: number;
    longitude: number;
  };

  /**
   * Optional farmer-given name for the plot, e.g. "north field".
   */
  label: string | null;

  /**
   * ISO 8601 timestamp of when the plot was created.
   */
  created_at: string;

  /**
   * FK → SoilTestResult (Addendum Section 20.4), most recent first.
   */
  soil_test_ids: string[];
}

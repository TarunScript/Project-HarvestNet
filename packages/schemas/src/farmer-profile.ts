/**
 * FarmerProfile & FarmerConsent — services/identity-api.
 * Addendum Section 18.3.
 *
 * FarmerProfile is the L0 foundational identity layer. Every advisory,
 * diagnosis, soil test, and land plot links to the farmer_id issued here.
 * identity-api is the ONLY service permitted to write to the farmer identity
 * store — all other services treat farmer_id as an opaque foreign key.
 *
 * @see Addendum Section 18   — Farmer Identity & Registration Module
 * @see Addendum Section 18.1 — Purpose
 * @see Section 6              — Data Integrity Rule (unchanged)
 */

/**
 * Explicit, auditable consent record. Required before any farmer data
 * leaves the identity layer.
 *
 * @see Addendum Section 18.3
 */
export interface FarmerConsent {
  /**
   * Version string of the consent terms the farmer agreed to.
   */
  consent_version: string;

  /**
   * Whether the farmer consents to sharing data with partners
   * (e.g. district agri-office, BRICS AgriN partner dashboard).
   */
  data_sharing_with_partners: boolean;

  /**
   * Whether the farmer opts in to Section 25 longitudinal
   * climate-trend aggregation tracking.
   */
  climate_trend_aggregation: boolean;

  /**
   * ISO 8601 timestamp of when consent was recorded.
   */
  recorded_at: string;
}

export interface FarmerProfile {
  /**
   * UUID, generated at registration — the durable "fingerprint" for this farmer.
   * Every future advisory, diagnosis, soil test, and land plot is linked to this ID.
   */
  farmer_id: string;

  /**
   * ISO 8601 timestamp of when the farmer registered.
   */
  registered_at: string;

  /**
   * Farmer's display name.
   */
  display_name: string;

  /**
   * Phone number, hashed — never stored raw outside identity-api.
   * This is a privacy-by-design decision: only identity-api holds the mapping.
   */
  phone_number_hash: string;

  /**
   * BCP 47 language code, e.g. "kn-IN".
   * Reused by L2b narration (Section 10) to generate
   * explanation_text in the farmer's preferred language.
   */
  preferred_language: string;

  /**
   * Coarse geohash (~5km) of the farmer's home region.
   * Same privacy pattern as DiagnosisEvent (Section 4.3) —
   * no exact coordinates stored.
   */
  home_region_geohash5km: string;

  /**
   * Explicit, auditable consent record.
   */
  consent: FarmerConsent;

  /**
   * Foreign keys into LandPlot (Addendum Section 19).
   * identity-api stores only IDs — plot data lives in land-plot-api.
   */
  plot_ids: string[];
}

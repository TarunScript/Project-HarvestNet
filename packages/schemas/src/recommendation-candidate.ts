/**
 * RecommendationCandidate — output of the L2a rules engine.
 * Section 5, Engineering Handbook v2.
 *
 * Every field is derived from the L2a rules engine (Section 4.2).
 * This schema is the deterministic output of the scoring engine —
 * no LLM is involved in computing any of these fields.
 *
 * @see Section 4.2 — N1 spec, Rules Engine (L2a)
 * @see Section 6  — Data Integrity Rule
 */

/**
 * Canopy stress level, derived from NDVI banding formula (Section 4.2):
 *   NDVI < 0.3  → "High"
 *   0.3 – 0.6   → "Moderate"
 *   > 0.6       → "Low"
 *
 * Source: Derived field — NDVI banding formula, Section 4.2.
 * NOT a free-standing invented field.
 */
export type CanopyStress = 'Low' | 'Moderate' | 'High';

export interface RecommendationCandidate {
  /**
   * List of rule IDs that fired during scoring.
   * e.g. ["ph_low_lime", "ndvi_moderate_stress"]
   *
   * Source: Derived — L2a rules engine output, Section 4.2.
   * Powers the Section 2.2 "why" explainability trace.
   */
  fired_rules: string[];

  /**
   * Canopy stress classification derived from sentinel2_ndvi_mean.
   *
   * Source: Derived — NDVI banding formula, Section 4.2:
   *   NDVI < 0.3  → "High"
   *   0.3 – 0.6   → "Moderate"
   *   > 0.6       → "Low"
   */
  canopy_stress: CanopyStress;

  /**
   * Primary crop recommendation computed by the rules engine.
   *
   * Source: Derived — L2a rules engine output, Section 4.2.
   */
  recommended_primary_crop: string;

  /**
   * Optional companion intercrop, null if not applicable.
   *
   * Source: Derived — L2a rules engine output, Section 4.2.
   */
  companion_intercrop: string | null;

  /**
   * Recommended tillage practice.
   *
   * Source: Derived — L2a rules engine output, Section 4.2.
   */
  tillage_practice: string;

  /**
   * List of soil amendments recommended (e.g. lime, gypsum, compost).
   *
   * Source: Derived — L2a rules engine output, Section 4.2.
   * Triggered by pH/organic-carbon rules.
   */
  soil_amendments: string[];
}

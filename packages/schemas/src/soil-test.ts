/**
 * SoilTestSubmission & SoilTestResult — services/soil-test-api.
 * Addendum Section 20.4.
 *
 * A farmer without access to a lab test still gets a real, rule-based
 * soil assessment computed the same way N1 already works (Section 4.2).
 * This module adds a second, farmer-supplied input path into the same
 * rules engine — it does NOT replace the ISRIC SoilGrids path.
 *
 * @see Addendum Section 20   — DIY Soil Testing Module
 * @see Addendum Section 20.3 — Rule bands
 * @see Addendum Section 20.6 — Data-integrity note
 * @see Section 6             — Data Integrity Rule
 */

/**
 * Input mode for the soil test.
 *
 * - "diy_manual": Farmer performs home tests and enters observed results.
 * - "diy_photo":  Farmer photographs soil + colour chart / pH strip;
 *                 vision-api estimates the band (N3 pattern, Addendum 20.2 Mode B).
 * - "lab_upload": Lab-grade results uploaded directly.
 */
export type SoilTestMethod = 'diy_manual' | 'diy_photo' | 'lab_upload';

/**
 * Confidence level of the soil test result.
 * These MUST never be conflated with ISRIC SoilGrids data downstream
 * (Addendum Section 20.6).
 */
export type SoilTestConfidence = 'diy-estimate' | 'diy-photo-estimate' | 'lab-grade';

/**
 * Raw observations from a DIY soil test.
 * Each field corresponds to a specific home test method (Addendum 20.2 Mode A).
 */
export interface ObservedInputs {
  /**
   * Jar/settling test results → maps to texture_classification
   * via USDA texture triangle classes (Addendum Section 20.3).
   *
   * Source: Farmer observation — jar test.
   */
  jar_test_ratio: {
    sand_pct: number;
    silt_pct: number;
    clay_pct: number;
  } | null;

  /**
   * pH strip colour band → maps to ph_level range.
   * e.g. "orange" → pH 6.0–6.5 (Addendum Section 20.3).
   *
   * Source: Farmer observation — pH strip colour match.
   */
  ph_strip_color_band: string | null;

  /**
   * Soil colour / organic-matter chart band → maps to organic_carbon_percentage.
   * Darker bands → higher organic-carbon estimate (Addendum Section 20.3).
   *
   * Source: Farmer observation — soil colour / OM chart.
   */
  soil_color_om_band: string | null;

  /**
   * Water absorption time in minutes → maps to drainage_class.
   * Used only to adjust crop suitability ranking, never to
   * override amendment rules (Addendum Section 20.3).
   *
   * Source: Farmer observation — drainage test.
   */
  drainage_test_minutes: number | null;
}

export interface SoilTestSubmission {
  /**
   * Unique identifier for this submission.
   */
  submission_id: string;

  /**
   * FK → FarmerProfile (Addendum Section 18.3).
   */
  farmer_id: string;

  /**
   * FK → LandPlot (Addendum Section 19.2), when available.
   */
  plot_id: string | null;

  /**
   * The testing method used.
   */
  method: SoilTestMethod;

  /**
   * Raw observations from the DIY test.
   */
  observed_inputs: ObservedInputs;

  /**
   * Photo URL, only for diy_photo method.
   */
  photo_url: string | null;

  /**
   * ISO 8601 timestamp of submission.
   */
  submitted_at: string;
}

export interface SoilTestResult {
  /**
   * Unique identifier for this result.
   */
  result_id: string;

  /**
   * FK → SoilTestSubmission.
   */
  submission_id: string;

  /**
   * Derived soil metrics, computed from observed_inputs via
   * the rule bands in Addendum Section 20.3.
   *
   * Source: Derived per Addendum Section 20.3 rule bands:
   *   - ph_level: from pH strip colour band midpoint
   *   - organic_carbon_percentage: from soil colour / OM band
   *   - texture_classification: from jar test ratios via USDA texture triangle
   */
  soil_metrics: {
    ph_level: number;
    organic_carbon_percentage: number;
    texture_classification: string;
  };

  /**
   * Confidence classification of this result.
   * NEVER conflated with ISRIC SoilGrids lab-grade data (Addendum 20.6).
   *
   * Source: Determined by the submission method:
   *   - diy_manual → "diy-estimate"
   *   - diy_photo  → "diy-photo-estimate"
   *   - lab_upload  → "lab-grade"
   */
  confidence: SoilTestConfidence;

  /**
   * True if diy_photo confidence_score < DIAGNOSIS_ESCALATION_CONFIDENCE.
   * Follows the N3 pattern (Section 2.1).
   */
  escalate_to_extension_officer: boolean;

  /**
   * List of rule IDs that fired during assessment.
   * Reuses the N1 "why" trace mechanism (Section 4.2).
   *
   * Source: Derived — rules engine output.
   */
  fired_rules: string[];

  /**
   * Recommended soil amendments based on fired rules.
   *
   * Source: Derived — rules engine output.
   */
  soil_amendments: string[];

  /**
   * Suitable crops based on soil assessment.
   *
   * Source: Derived — rules engine output.
   */
  suitable_crops: string[];

  /**
   * Human-readable explanation in the farmer's language.
   * Gemini narration of the above — narrate-only, same Section 10.1 prompt pattern.
   *
   * Source: Gemini narration — never a source of new facts (Section 6).
   */
  explanation_text: string;
}

/**
 * DiagnosisEvent — internal diagnosis record + feeds outbreak-aggregator.
 * Section 5, Engineering Handbook v2.
 *
 * Emitted by the vision-api (services/vision-api) when a farmer submits
 * a crop photo for disease diagnosis. Location is generalized to a ~5km
 * geohash cell for privacy — no farmer PII is stored in this stream.
 *
 * @see Section 4.3 — N2 spec, Regional Outbreak Signal
 * @see Section 5   — Canonical Data Models
 * @see Section 6   — Data Integrity Rule
 */

export interface DiagnosisEvent {
  /**
   * Unique identifier for this diagnosis event.
   */
  event_id: string;

  /**
   * ISO 8601 timestamp of the diagnosis.
   */
  timestamp: string;

  /**
   * Generalized location as a ~5km geohash cell.
   * NOT exact coordinates — privacy by design (Section 4.3).
   */
  geohash5km: string;

  /**
   * The crop being diagnosed.
   */
  crop: string;

  /**
   * The disease/pest condition identified by the vision model.
   *
   * Source: Gemini Vision, referenced against PlantVillage classes (Section 6).
   */
  identified_condition: string;

  /**
   * Model confidence in the diagnosis (0–1).
   *
   * Source: Gemini Vision confidence output (Section 6).
   */
  confidence_score: number;

  /**
   * True if confidence_score < DIAGNOSIS_ESCALATION_CONFIDENCE (0.6).
   * Triggers N3 — confidence-gated human escalation (Section 2.1).
   *
   * Source: Derived — threshold comparison against confidence_score.
   */
  escalate_to_extension_officer: boolean;
}

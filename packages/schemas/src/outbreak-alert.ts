/**
 * OutbreakAlert — public L4 endpoint, consumed by partner dashboard.
 * Section 5, Engineering Handbook v2.
 *
 * Emitted by the outbreak-aggregator (Section 4.3, N2) when the count
 * of DiagnosisEvents for a given geohash + condition crosses the
 * OUTBREAK_ALERT_THRESHOLD_COUNT within the rolling window.
 *
 * @see Section 4.3 — N2 spec, Regional Outbreak Signal
 * @see Section 5   — Canonical Data Models
 */

/**
 * Outbreak severity classification.
 *
 * Derived: based on farmer_report_count thresholds:
 *   5–9   → "Watch"
 *   10–19 → "Elevated"
 *   20+   → "High"
 */
export type OutbreakSeverity = 'Watch' | 'Elevated' | 'High';

export interface OutbreakAlert {
  /**
   * Unique identifier for this alert.
   */
  alert_id: string;

  /**
   * Geohash cell (~5km) where the outbreak was detected.
   */
  geohash5km: string;

  /**
   * The disease/pest condition that triggered the alert.
   */
  condition: string;

  /**
   * Number of distinct farmer reports in the rolling window.
   *
   * Source: Derived — count of DiagnosisEvents grouped by
   *         geohash5km + condition within OUTBREAK_ALERT_WINDOW_DAYS.
   */
  farmer_report_count: number;

  /**
   * Start of the rolling aggregation window (ISO 8601).
   */
  window_start: string;

  /**
   * End of the rolling aggregation window (ISO 8601).
   */
  window_end: string;

  /**
   * Alert severity level.
   *
   * Derived: based on farmer_report_count:
   *   5–9   → "Watch"
   *   10–19 → "Elevated"
   *   20+   → "High"
   */
  severity: OutbreakSeverity;
}

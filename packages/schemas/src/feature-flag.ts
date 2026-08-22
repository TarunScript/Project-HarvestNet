/**
 * FeatureFlag — packages/schemas, read by dpi-gateway at request time.
 * Addendum Section 21.1.
 *
 * Every new module registers itself in this table so it can be
 * dark-launched, A/B'd, or pulled without a deploy of any other service
 * (Addendum Section 17, Extensibility Design Principle).
 *
 * @see Addendum Section 21.1 — FeatureFlag schema
 * @see Addendum Section 17   — Extensibility Design Principles
 */

export interface FeatureFlag {
  /**
   * Unique feature flag key, e.g. "diy_soil_testing_photo_mode".
   */
  flag_key: string;

  /**
   * Whether the feature is currently enabled.
   */
  enabled: boolean;

  /**
   * Percentage for gradual rollout (0–100).
   * 0 = disabled for everyone, 100 = enabled for everyone.
   */
  rollout_pct: number;

  /**
   * ISO 8601 timestamp of the last update.
   */
  updated_at: string;
}

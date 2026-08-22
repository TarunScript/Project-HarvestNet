/**
 * @harvestnet/schemas — barrel export.
 *
 * Single source of truth for every payload shape in the system.
 * Every service imports from this package — no service invents
 * its own field names (Section 5).
 *
 * v2 schemas:    Section 5 (Engineering Handbook)
 * v3 schemas:    Addendum Sections 18.3, 19.2, 20.4, 21.1
 */

// ── v2 Core Schemas (Section 5) ──────────────────────────────
export {
  type CanopyStress,
  type RecommendationCandidate,
} from './recommendation-candidate.js';

export {
  type SoilMetrics,
  type RemoteSensing,
  type AgriDPIPayload,
} from './agri-dpi-payload.js';

export {
  type DiagnosisEvent,
} from './diagnosis-event.js';

export {
  type OutbreakSeverity,
  type OutbreakAlert,
} from './outbreak-alert.js';

// ── v3 Addendum Schemas ──────────────────────────────────────
export {
  type FarmerConsent,
  type FarmerProfile,
} from './farmer-profile.js';

export {
  type GeoJSONPolygon,
  type LandPlot,
} from './land-plot.js';

export {
  type SoilTestMethod,
  type SoilTestConfidence,
  type ObservedInputs,
  type SoilTestSubmission,
  type SoilTestResult,
} from './soil-test.js';

export {
  type FeatureFlag,
} from './feature-flag.js';

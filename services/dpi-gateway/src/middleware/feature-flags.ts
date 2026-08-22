/**
 * Feature flag middleware — Addendum Section 21.1.
 *
 * Every new module registers itself in the FeatureFlag table so it can
 * be dark-launched, A/B'd, or pulled without a deploy of any other service.
 *
 * dpi-gateway reads flags at request time to gate feature access.
 *
 * @see Addendum Section 21.1 — FeatureFlag schema
 * @see Addendum Section 17   — Extensibility Design Principles
 */

import { Request, Response, NextFunction } from 'express';
import type { FeatureFlag } from '@harvestnet/schemas';

/** In-memory feature flag store. Production: Firestore collection. */
const flags = new Map<string, FeatureFlag>();

/**
 * Initialize default feature flags.
 * Each new module registers a flag per Addendum Section 17, step 5.
 */
export function initializeFlags(): void {
  const defaults: FeatureFlag[] = [
    {
      flag_key: 'farmer_identity',
      enabled: true,
      rollout_pct: 100,
      updated_at: new Date().toISOString(),
    },
    {
      flag_key: 'land_plot_mapping',
      enabled: true,
      rollout_pct: 100,
      updated_at: new Date().toISOString(),
    },
    {
      flag_key: 'diy_soil_testing_manual',
      enabled: true,
      rollout_pct: 100,
      updated_at: new Date().toISOString(),
    },
    {
      flag_key: 'diy_soil_testing_photo_mode',
      enabled: false, // Mode B is secondary, off by default (Addendum 20.2)
      rollout_pct: 0,
      updated_at: new Date().toISOString(),
    },
    {
      flag_key: 'outbreak_alerts',
      enabled: true,
      rollout_pct: 100,
      updated_at: new Date().toISOString(),
    },
  ];

  for (const flag of defaults) {
    flags.set(flag.flag_key, flag);
  }
}

/**
 * Check if a feature is enabled.
 */
export function isFeatureEnabled(flagKey: string): boolean {
  const flag = flags.get(flagKey);
  if (!flag) return true; // Unknown flags default to enabled (core features)
  if (!flag.enabled) return false;
  if (flag.rollout_pct < 100) {
    // Simple rollout: random check against percentage
    return Math.random() * 100 < flag.rollout_pct;
  }
  return true;
}

/**
 * Get all flags (for admin/debug endpoint).
 */
export function getAllFlags(): FeatureFlag[] {
  return Array.from(flags.values());
}

/**
 * Update a flag.
 */
export function updateFlag(
  flagKey: string,
  updates: Partial<FeatureFlag>
): FeatureFlag | null {
  const existing = flags.get(flagKey);
  if (!existing) return null;

  const updated: FeatureFlag = {
    ...existing,
    ...updates,
    flag_key: existing.flag_key, // Never allow changing the key
    updated_at: new Date().toISOString(),
  };
  flags.set(flagKey, updated);
  return updated;
}

/**
 * Feature flag middleware.
 * Maps URL paths to feature flags and returns 404 if the feature is disabled.
 */
export function createFeatureFlagMiddleware() {
  // Map route prefixes to feature flag keys
  const routeFlagMap: Record<string, string> = {
    '/api/v1/farmers': 'farmer_identity',
    '/api/v1/plots': 'land_plot_mapping',
    '/api/v1/soil-tests': 'diy_soil_testing_manual',
    '/api/v1/alerts': 'outbreak_alerts',
  };

  return (req: Request, _res: Response, next: NextFunction): void => {
    // Check if the request path matches a feature-flagged route
    for (const [prefix, flagKey] of Object.entries(routeFlagMap)) {
      if (req.path.startsWith(prefix)) {
        if (!isFeatureEnabled(flagKey)) {
          _res.status(404).json({
            error: 'Feature not available',
            feature: flagKey,
          });
          return;
        }
        break;
      }
    }
    next();
  };
}

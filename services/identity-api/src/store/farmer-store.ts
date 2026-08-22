/**
 * Farmer identity store.
 * Addendum Section 18.2 — identity-api is the only service
 * permitted to write to this store.
 *
 * Production: backed by Cloud Firestore.
 * Development: in-memory Map for local iteration.
 */

import type { FarmerProfile } from '@harvestnet/schemas';

export interface FarmerStore {
  create(profile: FarmerProfile): Promise<FarmerProfile>;
  getById(farmerId: string): Promise<FarmerProfile | null>;
  update(farmerId: string, updates: Partial<FarmerProfile>): Promise<FarmerProfile | null>;
  addPlotId(farmerId: string, plotId: string): Promise<void>;
  list(): Promise<FarmerProfile[]>;
}

/**
 * Creates the farmer identity store.
 * Uses an in-memory Map for local development.
 * In production, this would use Cloud Firestore.
 */
export function createFarmerStore(): FarmerStore {
  const farmers = new Map<string, FarmerProfile>();

  return {
    async create(profile: FarmerProfile): Promise<FarmerProfile> {
      farmers.set(profile.farmer_id, { ...profile });
      return profile;
    },

    async getById(farmerId: string): Promise<FarmerProfile | null> {
      return farmers.get(farmerId) ?? null;
    },

    async update(
      farmerId: string,
      updates: Partial<FarmerProfile>
    ): Promise<FarmerProfile | null> {
      const existing = farmers.get(farmerId);
      if (!existing) return null;

      const updated: FarmerProfile = {
        ...existing,
        ...updates,
        // Never allow changing farmer_id or registered_at
        farmer_id: existing.farmer_id,
        registered_at: existing.registered_at,
        // Deep merge consent if provided
        consent: updates.consent
          ? { ...existing.consent, ...updates.consent }
          : existing.consent,
      };

      farmers.set(farmerId, updated);
      return updated;
    },

    async addPlotId(farmerId: string, plotId: string): Promise<void> {
      const existing = farmers.get(farmerId);
      if (existing && !existing.plot_ids.includes(plotId)) {
        existing.plot_ids.push(plotId);
      }
    },

    async list(): Promise<FarmerProfile[]> {
      return Array.from(farmers.values());
    },
  };
}

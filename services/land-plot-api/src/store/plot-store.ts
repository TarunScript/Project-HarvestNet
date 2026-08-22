/**
 * Land plot store.
 * Addendum Section 19 — land-plot-api owns plot geometry
 * and derived plot-level metrics only.
 *
 * Production: backed by Cloud Firestore.
 * Development: in-memory Map for local iteration.
 */

import type { LandPlot } from '@harvestnet/schemas';

export interface PlotStore {
  create(plot: LandPlot): Promise<LandPlot>;
  getById(plotId: string): Promise<LandPlot | null>;
  getByFarmerId(farmerId: string): Promise<LandPlot[]>;
  addSoilTestId(plotId: string, soilTestId: string): Promise<void>;
}

/**
 * Creates the land plot store.
 * Uses an in-memory Map for local development.
 */
export function createPlotStore(): PlotStore {
  const plots = new Map<string, LandPlot>();

  return {
    async create(plot: LandPlot): Promise<LandPlot> {
      plots.set(plot.plot_id, { ...plot });
      return plot;
    },

    async getById(plotId: string): Promise<LandPlot | null> {
      return plots.get(plotId) ?? null;
    },

    async getByFarmerId(farmerId: string): Promise<LandPlot[]> {
      return Array.from(plots.values()).filter(
        (p) => p.farmer_id === farmerId
      );
    },

    async addSoilTestId(plotId: string, soilTestId: string): Promise<void> {
      const plot = plots.get(plotId);
      if (plot) {
        // Most recent first (Addendum Section 19.2)
        plot.soil_test_ids.unshift(soilTestId);
      }
    },
  };
}

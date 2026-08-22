# Project-HarvestNet — Architecture

> Full architecture documentation. See `../README.md` for quick-start.

## System Layers

| Layer | Responsibility | Key Components |
|-------|---------------|----------------|
| **L0 — Identity** | Farmer registration, consent, durable `farmer_id` | `services/identity-api` |
| **L1 — Client** | Voice/text/photo input; displays advisory + "why" trace | `apps/web` (React/Next.js PWA) |
| **L2a — Rules Engine** | Deterministic agronomic scoring (N1) | `services/rules-engine` |
| **L2b — Explain Layer** | Gemini narrates L2a output in farmer's language | `services/advisory-api` |
| **L3 — Spatial Data & Cache** | Satellite, soil, weather data with fallback cache | `services/data-aggregator` |
| **L4 — Agri Data Exchange** | Public DPI API + outbreak alerts | `services/dpi-gateway` |

## Data Flow (Section 4.1)

1. Farmer opens app → allows location → voice/text/photo input
2. Client calls `advisory-api` → calls `data-aggregator` (L3) for NDVI, soil, weather
3. L2a `rules-engine` computes `RecommendationCandidate` deterministically
4. L2b sends result + language to Gemini with narrate-only prompt → returns text + voice
5. Structured advisory publishes to L4; diagnosis events feed `outbreak-aggregator` (N2)

## Novelty Differentiators

- **N1**: Deterministic rules engine — LLM explains, never decides
- **N2**: Regional outbreak early-warning signal from aggregated diagnosis events
- **N3**: Confidence-gated human escalation when vision model is unsure

## Module Boundary Rule (Addendum Section 17)

Every feature is its own service, owns its own schema slice, and is reachable
only through L4. No service imports another's internals or writes to another's
data store directly. A feature can be deleted by removing one service folder,
one schema file, and one feature flag row.

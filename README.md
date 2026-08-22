# Project-HarvestNet

> **AI agro-advisory platform and BRICS AgriN Digital Public Infrastructure reference implementation.**

Project-HarvestNet turns satellite, soil, and weather data into a farmer's own language through a rules engine the AI only explains — and packages that intelligence, plus a live regional outbreak signal, as an open API any government or partner nation can plug into.

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd project-harvestnet
npm install

# 2. Configure environment
cp .env.example .env
# Fill in your API keys (see .env.example for all required variables)

# 3. Build schemas (required before services)
npm run build --workspace=packages/schemas

# 4. Run a service in dev mode
npm run dev --workspace=services/dpi-gateway
```

## Architecture

| Layer | Service | Purpose |
|-------|---------|---------|
| L0 | `services/identity-api` | Farmer registration & consent |
| L1 | `apps/web` | React/Next.js PWA — voice/text/photo UI |
| L2a | `services/rules-engine` | Deterministic agronomic scoring (N1) |
| L2b | `services/advisory-api` | Orchestrates L2a + Gemini narration |
| L3 | `services/data-aggregator` | Earth Engine, SoilGrids, Weather + cache |
| L4 | `services/dpi-gateway` | Public API gateway + Swagger UI |
| — | `services/vision-api` | Disease diagnosis via Gemini Vision (N3) |
| — | `services/outbreak-aggregator` | Regional outbreak alerts (N2) |
| — | `services/land-plot-api` | Farmer land plot mapping |
| — | `services/soil-test-api` | DIY soil testing |

## Novelty & Innovation

- **N1 — Deterministic Rules Engine**: The LLM never decides agronomy — it only communicates a result computed by rules we can show you.
- **N2 — Regional Outbreak Signal**: Aggregated, geotagged diagnosis events trigger outbreak alerts for district agri-offices.
- **N3 — Confidence-Gated Escalation**: Low-confidence diagnoses explicitly flag `escalate_to_extension_officer: true`.

## API Documentation

Live Swagger UI available at `http://localhost:3000/docs` when running `dpi-gateway`.

Full OpenAPI 3.0 spec: [`docs/openapi.yaml`](docs/openapi.yaml)

## Repository Structure

```
project-harvestnet/
  apps/
    web/                        # React/Next.js farmer PWA (L1)
  services/
    rules-engine/               # L2a — deterministic agronomic scoring
    advisory-api/               # L2b — orchestrates rules-engine + Gemini
    vision-api/                 # disease diagnosis via Gemini Vision (N3)
    data-aggregator/            # L3 — Earth Engine, SoilGrids, Weather + cache
    dpi-gateway/                # L4 — public OpenAPI gateway
    outbreak-aggregator/        # scheduled job: DiagnosisEvents → OutbreakAlerts (N2)
    identity-api/               # L0 — farmer registration & consent
    land-plot-api/              # farmer-drawn land boundaries
    soil-test-api/              # DIY soil testing
  packages/
    schemas/                    # shared types — single source of truth
  infra/
    cloud-run/                  # per-service deploy configs
    firestore-rules/
  docs/
    openapi.yaml                # OpenAPI 3.0 spec
    architecture.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Next.js PWA) + Tailwind CSS |
| Rules Engine | Plain TypeScript/Node functions, unit-tested |
| Core AI | Gemini 2.x Flash API |
| Voice | Google Cloud Speech-to-Text & Text-to-Speech |
| Earth Observation | Google Earth Engine / Sentinel-2 |
| Soil Chemistry | ISRIC SoilGrids REST API |
| Weather | OpenWeather / IMD Hyperlocal API |
| Backend | Google Cloud Run + Cloud Functions |
| Data & Cache | Cloud Firestore + Redis |

## Environment Variables

See [`.env.example`](.env.example) for all required configuration.

## License

MIT

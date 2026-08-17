# HarvestNet 

**AI-powered, interoperable agro-advisory network for climate-resilient farming.**

Built for the *Build with AI: Code for Communities* hackathon — Problem Statement: **AI-Driven Farmer Advisory** (inspired by BRICS AgriN).

## What it does

HarvestNet delivers real-time, localised agro-advisories using AI, combining satellite data, soil health, and weather forecasting to help small and marginal farmers make better decisions — and exposes that intelligence through an open API so it can be adopted as shared digital public infrastructure.

-  **Regenerative crop recommendations** — based on satellite NDVI, soil health, and weather forecasts
-  **Crop disease diagnosis** — upload a photo, get an instant AI diagnosis + treatment plan
-  **Localised voice & text advisory** — ask questions in your own language, get clear answers
-  **Open Agri Data Exchange API** — a documented, standardised API so any government, NGO, or partner nation can integrate and share agricultural data models

## Tech Stack

- **AI:** Gemini API (multimodal — text, vision, multilingual)
- **Data sources:** Google Earth Engine (satellite), SoilGrids/ISRIC (soil), OpenWeather/IMD (weather)
- **Voice:** Google Cloud Speech-to-Text & Text-to-Speech
- **Backend:** Firebase Cloud Functions / Cloud Run, Firestore
- **Frontend:** React (mobile-first)

## Architecture

```
Farmer (voice/text/photo)
        ↓
   Client App
        ↓
 AI Advisory Engine (Gemini) ←→ Data Aggregation Service
        ↓                        (satellite + soil + weather)
   Advisory / Diagnosis
        ↓
 Agri Data Exchange API (open, documented)
        ↓
 External partners (govt, NGOs, other nations)
```

## Team

HarvestNet — built by [team name].

## Status

 In development for hackathon submission — deadline **Aug 24, 2026**.

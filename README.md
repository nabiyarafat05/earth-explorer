# 🌍 Earth Explorer

Explore Earth from space — live NASA satellite imagery combined with real-time earthquake data, all in one interactive map.

**Live site:** [earth-explorer-red.vercel.app](https://earth-explorer-red.vercel.app)

## What it does

- **Live satellite imagery** — View NASA's True Color and Land Surface Temperature imagery for any date, powered by NASA GIBS.
- **Date-specific earthquakes** — See real earthquakes that occurred on your selected date, sourced from the USGS Earthquake API, color-coded by magnitude.
- **AI-powered insights** — Click any earthquake marker to get a simple, AI-generated explanation and safety tips.
- **Time-lapse mode** — Pick a date range and watch satellite imagery play through day by day.
- **Location search** — Jump to any city or place on the map instantly.
- **Light/dark mode** — Toggle between themes.

> **Note:** Black diagonal streaks in the satellite imagery are a natural feature of single-satellite daily passes (MODIS Terra), not a bug — they represent gaps between orbital swaths that weren't imaged that day.

## Tech stack

- **React + Vite** — frontend framework and build tool
- **Leaflet / react-leaflet** — interactive 2D map rendering
- **NASA GIBS** — satellite imagery tiles
- **USGS Earthquake API** — real-time and historical earthquake data
- **Nominatim (OpenStreetMap)** — location search/geocoding
- **Gemini API** — AI-generated earthquake explanations

## Running locally

```bash
git clone https://github.com/nabiyarafat05/earth-explorer.git
cd earth-explorer
npm install
npm run dev
```

You'll need a Gemini API key set as an environment variable to use the AI explanation feature.

## Built for

Built for BSERC, using real NASA and USGS open data sources.

## Space missions referenced

- **Chandrayaan-3** (ISRO) — India's third lunar mission, landed near the Moon's south pole in 2023.
- **Aditya-L1** (ISRO) — India's first dedicated solar observatory.
- **Terra & Aqua (MODIS)** (NASA) — satellites providing the true-color and temperature imagery shown on this map.
- **Landsat Program** (NASA) — the longest-running Earth observation program, providing continuous imagery since 1972.
-

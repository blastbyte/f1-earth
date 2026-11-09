# F1 Earth 2026

An interactive 3D globe of every circuit on the 2026 Formula 1 calendar. It works on desktop and mobile.

**Live site:** https://blastbyte.github.io/f1-earth/

## Features

- **3D globe** with satellite imagery of land and oceans. Drag to rotate, scroll or pinch to zoom, right-drag or two-finger drag to tilt.
- **All 24 venues on the original 2026 calendar**, each shown as a hotspot with its photo (from Wikipedia) and name. Bahrain and Saudi Arabia were cancelled in March 2026; they are still shown, marked as cancelled. The next race pulses gold.
- **Seamless zoom** from orbit down to the track. The circuit outline is drawn on the ground from about zoom 5.
- **Close-up 3D view**: terrain elevation, 3D OpenStreetMap buildings, named landmarks (gold labels), and a textured 3D model of the track: smooth curves through the corners, a road surface that follows the terrain's elevation, asphalt with white edge lines, red and white kerbs in the corners and a chequered start/finish line. The model can be tinted by elevation from the Layers menu.
- **Circuit info panel**: round, date, status, circuit length, laps, race distance, corners, lap record, first Grand Prix, and an elevation profile sampled along the lap. Hover or touch the profile to find that point on the track.
- **Fly a lap**: a first-person lap from the cockpit. The car launches from the grid, brakes for corners, turns in and accelerates out, at roughly lap-record pace. The lap is driven at true terrain scale, on a road smoothed to realistic gradients. Press Esc, the Exit button or the map to stop.
- **Orbit** around the circuit, a **calendar** with search, layer toggles, and adjustable terrain exaggeration.
- Deep links: `#circuit=<id>`, e.g. `#circuit=mc-1929` for Monaco.

## Running locally

It's a static site with no build step:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Data sources

| Data | Source |
| --- | --- |
| Rendering engine | [MapLibre GL JS](https://maplibre.org/) 5.24 (vendored in `vendor/`) |
| Satellite imagery | Esri World Imagery |
| Terrain elevation | [Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/) (Mapzen Terrarium) |
| Buildings, landmarks, labels | [OpenFreeMap](https://openfreemap.org/) / OpenMapTiles / © OpenStreetMap contributors |
| Circuit outlines | [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT) |
| Photos | Wikipedia / Wikimedia Commons, fetched at runtime |

Circuit statistics are in `js/data.js`. Lap records are the official race lap records as they stood going into the 2026 season.

## Deployment

`.github/workflows/pages.yml` publishes the site to the `gh-pages` branch on every push. If the site doesn't appear after the first run, go to **Settings → Pages** and set **Source** to *Deploy from a branch*, `gh-pages`, `/ (root)`.

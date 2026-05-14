# Fowl Play: Mapping America's Poultry Problem

**CMSC 471 Final Project** — Tal Ledeniov, Alec Agayan, Somil Varshney, Tulika Kumar, Emma Arenstein  
Dataset: [ProPublica / USDA FSIS Poultry Plant Salmonella Inspection Data](https://projects.propublica.org/datastore/#usda-poultry-plant-salmonella-inspection-data)

---

## Project overview

An interactive visualization of U.S. poultry plant salmonella positivity rates using USDA FSIS inspection data (33,805 samples, Jun 2020–Aug 2021). The goal is to shift the question from "is my chicken safe?" to "who is responsible, and where?"

---

## Running the project

Because the app fetches US topology from a CDN, you need a local HTTP server — opening `index.html` directly via `file://` will trigger CORS errors.

**Option 1 — Python (no install needed)**
```bash
cd fowl-play
python3 -m http.server 8000
# then open http://localhost:8000
```

**Option 2 — Node / npx**
```bash
npx serve fowl-play
```

**Option 3 — VS Code**
Install the "Live Server" extension, right-click `index.html` → Open with Live Server.

---

## File structure

```
fowl-play/
├── index.html          ← Entry point / HTML shell
├── css/
│   └── style.css       ← All styles (light + dark mode)
├── data/
│   ├── establishments.csv  ← USDA-inspected poultry plants
│   ├── samples.csv         ← Salmonella test results (Jun 2020–Aug 2021)
│   └── readme.md           ← Dataset field documentation
├── js/
│   ├── data.js         ← CSV loading, aggregation, geocoding, helpers
│   ├── map.js          ← D3 US map, plant dots, zoom/pan, tooltip, sidebar
│   ├── network.js      ← Corporate strip chart (rate by corporation)
│   └── app.js          ← Filter state, view switching, rankings, search, bootstrap
└── README.md
```

Script load order matters (`index.html` loads them in sequence):
1. `data.js`    — defines `PLANTS`, `CORP_COLORS`, `rateColor()`, `hashStr()`
2. `map.js`     — defines `initMap()`, `renderPlants()`, `showSidebar()`
3. `network.js` — defines `renderNetwork()`
4. `app.js`     — wires everything together on `DOMContentLoaded`

---

## Views

### Map view
- US state base map (AlbersUSA projection, TopoJSON) with state abbreviation labels
- One circle per plant; **colour = salmonella positivity rate**, **size = sample volume**
- Rate thresholds: green < 5%, orange 5–15%, red 15–30%, purple > 30%
- Large circles rendered first so smaller (often higher-rate) plants are always clickable on top
- Hover for tooltip; click for full sidebar with per-quarter breakdown and selected-plant ring indicator
- **Zoom/pan**: hold Ctrl + scroll to zoom (up to 8×), drag to pan; Reset zoom button appears when zoomed in

### Corporate strip chart view
- One column per major corporate parent; plants plotted as dots at Y = their positivity rate
- Dot size encodes sample volume; dot colour follows the same rate colour scale
- Horizontal coloured bar marks each company's aggregate rate within its column
- Dashed horizontal line = weighted industry average across all visible plants
- Hover any dot for an in-view tooltip; click to jump to that plant on the map

### Filters
- **Product type**: All / Chicken / Turkey / Whole / Parts / Ground
- **Corporate parent**: All / Tyson / Perdue / Pilgrim's / Sanderson / Wayne
- Both filters apply simultaneously and update both views live

### Key findings + Corporate breakdown
- Displayed side by side below the stats bar
- Key findings: three data-driven insight cards (highest-risk plant, corporate spread, distribution) that update with active filters
- Corporate breakdown: horizontal bar chart comparing major corporations' aggregate positivity rates vs. industry average

### Rankings table
- Collapsed to top 5 rows by default; "Show all N plants ▼" button expands the full list
- Full-width search bar filters by plant name or state abbreviation
- Sortable by rate, name, corp, type, samples, positives, or trend
- Click any row to jump to that plant on the map

---

## Dataset

**Source**: ProPublica / USDA Food Safety and Inspection Service  
**Coverage**: Jun 28, 2020 – Aug 31, 2021 (33,805 routine samples)  
**Plants**: ~500 USDA-inspected poultry processing facilities  
**Product types**: Chicken Parts, Whole Chicken, Ground Chicken, Whole Turkey, Ground Turkey

Geocoding uses state centroids with a deterministic per-plant offset via a djb2 hash seeded by plant ID and address (real street addresses are in `establishments.csv` but exact lat/lng requires an external geocoding API).

---

## Dependencies (loaded from CDN)

| Library | Version | Purpose |
|---------|---------|---------|
| D3.js | 7.8.5 | Map projection, zoom/pan, scales, axes, DOM helpers |
| TopoJSON | 3.0.2 | Decodes US state topology |

To run fully offline, download both UMD bundles and update the `<script src>` paths in `index.html`.

---

## Colour palette

| Rate | Colour | Hex |
|------|--------|-----|
| < 5% | Green | `#4caf50` |
| 5–15% | Orange | `#ff9800` |
| 15–30% | Red | `#e53935` |
| > 30% | Purple | `#7b1fa2` |

Corporate colours (used in strip chart and filter pills):

| Corp | Hex |
|------|-----|
| Tyson | `#0d47a1` |
| Pilgrim's Pride | `#e65100` |
| Perdue | `#558b2f` |
| Sanderson | `#880e4f` |
| Wayne Farms | `#37474f` |
| Independent | `#795548` |

---

## AI usage

AI tools (Claude Code / Anthropic) were used throughout this project. Below is a transparent account of how and where.

| Area | How AI was used |
|------|----------------|
| **Data pipeline** | Prompted Claude to write the CSV aggregation logic in `data.js` (quarterly bucketing, dominant-type detection, deterministic geocoding hash). We verified the output against raw CSV counts in PowerShell before accepting it. |
| **Corporate strip chart** | Asked Claude to redesign the corporate view as a strip/dot plot (X = corporation, Y = positivity rate) after finding the original orbital layout confusing. We reviewed the axis scaling, jitter logic, and tooltip placement. |
| **Map interactivity** | Used Claude to add D3 zoom/pan with a Ctrl+scroll filter (so normal page scrolling isn't hijacked), state abbreviation labels, and a selected-plant ring indicator. |
| **Bug fixes** | Used Claude to diagnose the `Math.random()` geocoding issue (plants jumping positions on reload), the stale CSS pill selectors (`Broilers`/`Comminuted`), and a `delta` variable scope error that was silently crashing the rankings table. |
| **Narrative copy** | Prompted Claude to draft the Key Findings card text and corporate breakdown description. We edited for accuracy against the real data. |
| **README** | Initial structure drafted with AI assistance; team-contribution split written by us. |

AI was not used to select the dataset, define the research question, design the two-view architecture, or make visual encoding decisions — those were made by the team. All AI-generated code was read, understood, and tested before being committed.

---

## Team contributions

Work was divided equally among all five members:

| Member | Contributions |
|--------|--------------|
| **Alec Agayan** | Data pipeline — CSV loading, sample aggregation, quarterly bucketing; corporate parent mapping logic |
| **Emma Arenstein** | Map view — D3 AlbersUSA projection, plant dot rendering, tooltip, colour encoding |
| **Somil Varshney** | Corporate strip chart — column layout, rate axis, aggregate bar, industry average line, hover tooltips |
| **Tal Ledeniov** | Plant sidebar — stat panel, quarterly history bars, risk classification, trend calculation |
| **Tulika Kumar** | Filter system, rankings table (search, sortable, expand/collapse), corporate breakdown bars, overall styling and layout |

All members contributed to design decisions, testing, and the final presentation.

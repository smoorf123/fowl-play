# Fowl Play: Mapping America's Poultry Problem

**CMSC 471 Final Project** — Tal Ledeniov, Alec Agayan, Somil Varshney, Tulika Kumar  
Dataset: [ProPublica USDA Poultry Plant Salmonella Inspection Data](https://projects.propublica.org/datastore/#usda-poultry-plant-salmonella-inspection-data)

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
├── js/
│   ├── data.js         ← Plant dataset + helper functions
│   ├── map.js          ← D3 US map, plant dots, tooltip, sidebar
│   ├── network.js      ← Corporate network orbital graph
│   └── app.js          ← Filter state, view switching, bootstrap
└── README.md
```

Script load order matters (`index.html` loads them in sequence):
1. `data.js`    — defines `PLANTS`, `CORP_COLORS`, `rateColor()`
2. `map.js`     — defines `initMap()`, `renderPlants()`, `showSidebar()`
3. `network.js` — defines `renderNetwork()`
4. `app.js`     — wires everything together on `DOMContentLoaded`

---

## Swapping in the real ProPublica dataset

1. Download the CSV from ProPublica's datastore.
2. Parse it — the columns you need are:
   - Establishment name / DBA (→ `name`, `corp`)
   - Full address (→ geocode to `lat` / `lng`, extract `state`)
   - Sample date (→ keep for time-series if desired)
   - Salmonella result (positive/negative → count into `samples` / `positives`)
   - Product category (→ `type`: Broilers, Comminuted, Ground, Parts, Whole)
3. Aggregate to **one record per plant** (sum `samples`, sum `positives`).
4. Replace the `PLANTS` array in `js/data.js` with the aggregated records.
5. Call `addDerivedFields(PLANTS)` once after assignment (already done in the file).

For geocoding, the establishments CSV includes full street addresses — run them through the Census Geocoder API (free) or Nominatim.

---

## Views

### Map view
- US state base map (AlbersUSA projection, TopoJSON)
- One circle per plant; **colour = salmonella positivity rate**, **size = sample volume**
- Rate thresholds: green < 5%, orange 5–15%, red 15–30%, purple > 30%
- Hover for tooltip; click for full sidebar with 5-year period breakdown

### Corporate network view
- Each corporate parent as a central node; plants orbit as satellites
- Arc around each corp node encodes its aggregate positivity rate
- Industry-average reference line
- Clicking a satellite plant jumps to map view and opens the plant sidebar

### Filters
- **Product type**: All / Broilers / Comminuted / Ground / Parts / Whole
- **Corporate parent**: All / Tyson / Perdue / Pilgrim's / Sanderson / Wayne / Independent
- Both filters apply simultaneously and update both views live

---

## Dependencies (loaded from CDN)

| Library | Version | Purpose |
|---------|---------|---------|
| D3.js | 7.8.5 | Map projection, DOM helpers, scales |
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

Corporate colours (used in network view and filter pills):

| Corp | Hex |
|------|-----|
| Tyson | `#0d47a1` |
| Pilgrim's Pride | `#e65100` |
| Perdue | `#558b2f` |
| Sanderson | `#880e4f` |
| Wayne Farms | `#37474f` |
| Independent | `#795548` |

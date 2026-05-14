/* ============================================================
   data.js  –  Plant dataset + utility helpers
   ============================================================ */

'use strict';

/* ── Corporate colour palette ──────────────────────────────── */
const CORP_COLORS = {
  'Tyson'            : '#0d47a1',
  "Pilgrim's Pride"  : '#e65100',
  'Perdue'           : '#558b2f',
  'Sanderson'        : '#880e4f',
  'Wayne Farms'      : '#37474f',
  'Independent'      : '#795548',
};

/* ── Rate → colour helper ───────────────────────────────────── */
function rateColor(r) {
  if (r < 0.05) return '#4caf50';
  if (r < 0.15) return '#ff9800';
  if (r < 0.30) return '#e53935';
  return '#7b1fa2';
}

/* ── Corporate parent mapping ───────────────────────────────── */
function mapCorporateParent(name, dba) {
  const fullStr = (name + ' ' + (dba || '')).toLowerCase();
  if (fullStr.includes('tyson'))    return 'Tyson';
  if (fullStr.includes('pilgrim'))  return "Pilgrim's Pride";
  if (fullStr.includes('perdue'))   return 'Perdue';
  if (fullStr.includes('sanderson'))return 'Sanderson';
  if (fullStr.includes('wayne'))    return 'Wayne Farms';
  return 'Independent';
}

/* ── Poultry type normalization ─────────────────────────────── */
function normalizePoultryType(typeStr) {
  if (!typeStr) return 'Mixed';
  const t = typeStr.toLowerCase();
  const base = t.includes('turkey') ? 'Turkey' : 'Chicken';
  let prep = 'Mixed';
  if (t.includes('whole'))       prep = 'Whole';
  else if (t.includes('part'))   prep = 'Parts';
  else if (t.includes('ground')) prep = 'Ground';
  return `${base} ${prep}`;
}

/* ── State centroids ────────────────────────────────────────── */
const STATE_COORDS = {
  'AL': [32.87, -86.88], 'AK': [64.07, -152.28], 'AZ': [33.73, -111.43],
  'AR': [34.97, -92.37], 'CA': [36.12, -119.68], 'CO': [39.06, -105.31],
  'CT': [41.60, -72.75], 'DE': [39.00, -75.47],  'FL': [27.99, -81.76],
  'GA': [33.04, -83.64], 'HI': [21.31, -157.86], 'ID': [44.24, -114.48],
  'IL': [40.35, -88.99], 'IN': [39.85, -86.26],  'IA': [42.01, -93.21],
  'KS': [38.53, -96.73], 'KY': [37.67, -84.67],  'LA': [31.17, -91.87],
  'ME': [44.69, -69.38], 'MD': [39.06, -76.80],  'MA': [42.23, -71.53],
  'MI': [43.33, -84.54], 'MN': [45.69, -93.90],  'MS': [32.74, -89.68],
  'MO': [38.46, -92.29], 'MT': [46.92, -109.63], 'NE': [41.49, -99.90],
  'NV': [38.80, -117.06],'NH': [43.45, -71.56],  'NJ': [40.23, -74.46],
  'NM': [34.84, -106.25],'NY': [42.17, -74.95],  'NC': [35.63, -79.81],
  'ND': [47.53, -99.79], 'OH': [40.39, -82.76],  'OK': [35.57, -97.49],
  'OR': [44.57, -122.07],'PA': [40.59, -77.21],  'RI': [41.68, -71.51],
  'SC': [34.00, -81.16], 'SD': [44.30, -99.44],  'TN': [35.75, -86.69],
  'TX': [31.97, -99.90], 'UT': [39.32, -111.09], 'VT': [44.05, -72.71],
  'VA': [37.77, -78.17], 'WA': [47.75, -120.74], 'WV': [38.49, -80.95],
  'WI': [44.27, -89.62], 'WY': [42.76, -107.30],
};

/* ── Deterministic string hash (djb2) ──────────────────────── */
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h & 0xffffffff;
  }
  return Math.abs(h);
}

/* ── Geocode: state centroid + deterministic jitter ─────────── */
function geocodeAddress(city, state, zip, seed) {
  if (!state || state.length !== 2) return null;
  const coords = STATE_COORDS[state.toUpperCase()];
  if (!coords) return null;
  const h      = hashStr((seed || '') + city + state + zip);
  const jitter = 1.5;
  const latOff = ((h & 0xffff) / 65535 - 0.5) * jitter;
  const lngOff = (((h >>> 16) & 0xffff) / 65535 - 0.5) * jitter;
  return [coords[0] + latOff, coords[1] + lngOff];
}

/* ── Add rate field ─────────────────────────────────────────── */
function addDerivedFields(arr) {
  arr.forEach(p => { p.rate = p.positives / p.samples; });
  return arr;
}

/* ── Load and aggregate real CSV data ──────────────────────── */
let PLANTS = [];

async function loadPlantData() {
  const establishments = await d3.csv('data/establishments.csv');
  const samples        = await d3.csv('data/samples.csv');
  {

    /* Aggregate per plant: totals, dominant type, quarterly buckets */
    const samplesByPlant  = {};
    const quarterlyByPlant = {};

    samples.forEach(row => {
      const estId    = row.poultry_establishment_id;
      const isPos    = row.result === 'true' || row.result === true;
      const normType = row.poultry_type ? normalizePoultryType(row.poultry_type) : null;

      if (!samplesByPlant[estId]) {
        samplesByPlant[estId] = { total: 0, positive: 0, typeCounts: {} };
      }
      samplesByPlant[estId].total += 1;
      if (isPos) samplesByPlant[estId].positive += 1;
      if (normType) {
        samplesByPlant[estId].typeCounts[normType] =
          (samplesByPlant[estId].typeCounts[normType] || 0) + 1;
      }

      /* Quarterly bucketing */
      if (row.collection_date) {
        const d      = new Date(row.collection_date);
        const period = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
        if (!quarterlyByPlant[estId]) quarterlyByPlant[estId] = {};
        if (!quarterlyByPlant[estId][period])
          quarterlyByPlant[estId][period] = { samples: 0, positives: 0 };
        quarterlyByPlant[estId][period].samples  += 1;
        if (isPos) quarterlyByPlant[estId][period].positives += 1;
      }
    });

    let plantId = 0;
    const plants = establishments
      .filter(est => samplesByPlant[est.poultry_establishment_id])
      .map(est => {
        const estId  = est.poultry_establishment_id;
        const stats  = samplesByPlant[estId];
        const coords = geocodeAddress(est.city, est.state, est.zip, estId);

        /* Dominant product type */
        const typeCounts = stats.typeCounts;
        const typeNames  = Object.keys(typeCounts);
        let type = 'Mixed';
        if (typeNames.length === 1) {
          type = typeNames[0];
        } else if (typeNames.length > 1) {
          type = typeNames.reduce((a, b) => typeCounts[a] >= typeCounts[b] ? a : b);
        }

        /* Real quarterly history */
        const qData   = quarterlyByPlant[estId] || {};
        const periods = Object.keys(qData).sort();
        const history = periods.map(p => ({
          period    : p,
          samples   : qData[p].samples,
          positives : qData[p].positives,
        }));

        const dateRange = periods.length >= 2
          ? `${periods[0]} – ${periods[periods.length - 1]}`
          : periods.length === 1 ? periods[0] : 'Jun 2020–Aug 2021';

        return {
          id        : plantId++,
          name      : est.name || 'Unknown Plant',
          state     : est.state,
          lat       : coords ? coords[0] : 40,
          lng       : coords ? coords[1] : -95,
          corp      : mapCorporateParent(est.name, est.dba),
          type,
          samples   : stats.total,
          positives : stats.positive,
          history,
          dateRange,
          city      : est.city,
          zip       : est.zip,
          address   : est.address,
          dba       : est.dba,
        };
      });

    addDerivedFields(plants);
    PLANTS = plants;
    console.log(`Loaded ${PLANTS.length} plants with ${samples.length} samples`);
    return PLANTS;
  }
}

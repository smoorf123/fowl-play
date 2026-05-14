/* ============================================================
   data.js  –  Plant dataset + utility helpers
   ============================================================
   Loads real ProPublica USDA poultry plant data:
     1. Parses CSV files (establishments, samples)
     2. Aggregates samples to plant-level
     3. Calculates positivity rates and derives corporate mappings
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
  if (r < 0.05) return '#4caf50';   // safe
  if (r < 0.15) return '#ff9800';   // caution
  if (r < 0.30) return '#e53935';   // danger
  return '#7b1fa2';                  // severe
}

/* ── Corporate parent mapping ──────────────────────────────– */
function mapCorporateParent(name, dba) {
  const fullStr = (name + ' ' + (dba || '')).toLowerCase();
  
  if (fullStr.includes('tyson')) return 'Tyson';
  if (fullStr.includes("pilgrim")) return "Pilgrim's Pride";
  if (fullStr.includes('perdue')) return 'Perdue';
  if (fullStr.includes('sanderson')) return 'Sanderson';
  if (fullStr.includes('wayne')) return 'Wayne Farms';
  
  return 'Independent';
}

/* ── Poultry type normalization ────────────────────────────– */
function normalizePoultryType(typeStr) {
  if (!typeStr) return 'Mixed';
  const t = typeStr.toLowerCase();
  
  // Extract base product type (Chicken vs Turkey)
  let baseType = 'Chicken';
  if (t.includes('turkey')) baseType = 'Turkey';
  
  // Extract preparation type
  let prepType = 'Mixed';
  if (t.includes('whole')) prepType = 'Whole';
  else if (t.includes('part')) prepType = 'Parts';
  else if (t.includes('ground')) prepType = 'Ground';
  
  // Return combined type (e.g., "Chicken Parts" or "Turkey Ground")
  return `${baseType} ${prepType}`;
}

/* ── Simple geocoding fallback (state centroids) ────────────– */
const STATE_COORDS = {
  'AL': [32.87, -86.88], 'AK': [64.07, -152.28], 'AZ': [33.73, -111.43],
  'AR': [34.97, -92.37], 'CA': [36.12, -119.68], 'CO': [39.06, -105.31],
  'CT': [41.60, -72.75], 'DE': [39.00, -75.47], 'FL': [27.99, -81.76],
  'GA': [33.04, -83.64], 'HI': [21.31, -157.86], 'ID': [44.24, -114.48],
  'IL': [40.35, -88.99], 'IN': [39.85, -86.26], 'IA': [42.01, -93.21],
  'KS': [38.53, -96.73], 'KY': [37.67, -84.67], 'LA': [31.17, -91.87],
  'ME': [44.69, -69.38], 'MD': [39.06, -76.80], 'MA': [42.23, -71.53],
  'MI': [43.33, -84.54], 'MN': [45.69, -93.90], 'MS': [32.74, -89.68],
  'MO': [38.46, -92.29], 'MT': [46.92, -109.63], 'NE': [41.49, -99.90],
  'NV': [38.80, -117.06], 'NH': [43.45, -71.56], 'NJ': [40.23, -74.46],
  'NM': [34.84, -106.25], 'NY': [42.17, -74.95], 'NC': [35.63, -79.81],
  'ND': [47.53, -99.79], 'OH': [40.39, -82.76], 'OK': [35.57, -97.49],
  'OR': [44.57, -122.07], 'PA': [40.59, -77.21], 'RI': [41.68, -71.51],
  'SC': [34.00, -81.16], 'SD': [44.30, -99.44], 'TN': [35.75, -86.69],
  'TX': [31.97, -99.90], 'UT': [39.32, -111.09], 'VT': [44.05, -72.71],
  'VA': [37.77, -78.17], 'WA': [47.75, -120.74], 'WV': [38.49, -80.95],
  'WI': [44.27, -89.62], 'WY': [42.76, -107.30]
};

/* ── Approximates lat/lng from address (state-based fallback) ──– */
function geocodeAddress(city, state, zip) {
  // Basic approximation: state center + small random jitter
  if (!state || state.length !== 2) return null;
  const coords = STATE_COORDS[state.toUpperCase()];
  if (!coords) return null;
  
  // Add small jitter to spread plants within state
  const jitter = 1.5;
  return [
    coords[0] + (Math.random() - 0.5) * jitter,
    coords[1] + (Math.random() - 0.5) * jitter
  ];
}

/* ── Per-plant history generator ────────────────────────────– */
function makeHistory(totalSamples, totalPositives) {
  const periods  = ['00–04', '05–09', '10–14', '15–20'];
  const weights  = [0.18, 0.22, 0.26, 0.34];
  const history  = [];
  let usedSamples = 0;

  periods.forEach((period, i) => {
    const s = i < 3
      ? Math.round(totalSamples * weights[i])
      : totalSamples - usedSamples;
    const baseRate  = totalPositives / totalSamples;
    const jitter    = 0.6 + Math.random() * 0.8;
    const pos       = Math.max(0, Math.min(s, Math.round(s * baseRate * jitter)));
    history.push({ period, samples: s, positives: pos });
    usedSamples += s;
  });

  return history;
}

/* ── Add derived fields ──────────────────────────────────────– */
function addDerivedFields(arr) {
  arr.forEach(p => {
    p.rate    = p.positives / p.samples;
    p.history = makeHistory(p.samples, p.positives);
  });
  return arr;
}

/* ── Load and aggregate real CSV data ─────────────────────────– */
let PLANTS = [];

async function loadPlantData() {
  try {
    // Load both CSV files
    const establishments = await d3.csv('data/establishments.csv');
    const samples = await d3.csv('data/samples.csv');
    
    // Aggregate samples by establishment
    const samplesByPlant = {};
    samples.forEach(row => {
      const estId = row.poultry_establishment_id;
      if (!samplesByPlant[estId]) {
        samplesByPlant[estId] = { total: 0, positive: 0, types: new Set() };
      }
      samplesByPlant[estId].total += 1;
      if (row.result === 'true' || row.result === true) {
        samplesByPlant[estId].positive += 1;
      }
      if (row.poultry_type) {
        samplesByPlant[estId].types.add(normalizePoultryType(row.poultry_type));
      }
    });
    
    // Build plant records from establishments with samples
    let plantId = 0;
    const plants = establishments
      .filter(est => samplesByPlant[est.poultry_establishment_id])
      .map(est => {
        const estId = est.poultry_establishment_id;
        const stats = samplesByPlant[estId];
        const coords = geocodeAddress(est.city, est.state, est.zip);
        
        // Determine predominant type
        let type = 'Mixed';
        if (stats.types.size === 1) {
          type = Array.from(stats.types)[0];
        }
        
        return {
          id: plantId++,
          name: est.name || 'Unknown Plant',
          state: est.state,
          lat: coords ? coords[0] : 40,
          lng: coords ? coords[1] : -95,
          corp: mapCorporateParent(est.name, est.dba),
          type: type,
          samples: stats.total,
          positives: stats.positive,
          city: est.city,
          zip: est.zip,
          address: est.address,
          dba: est.dba
        };
      });
    
    // Add derived fields
    addDerivedFields(plants);
    
    PLANTS = plants;
    console.log(`Loaded ${PLANTS.length} plants with ${samples.length} samples`);
    
    return PLANTS;
  } catch (err) {
    console.error('Error loading plant data:', err);
    // Fallback: use mock data
    return loadMockPlants();
  }
}

/* ── Fallback: mock plants if CSV load fails ──────────────────– */
function loadMockPlants() {
  console.warn('Using mock data as fallback');
  return addDerivedFields([
  /* ── Arkansas – Tyson heartland ── */
  { id:1,  name:'Tyson Foods – Springdale',      state:'AR', lat:36.19, lng:-94.13, corp:'Tyson',           type:'Broilers',   samples:820, positives:148 },
  { id:2,  name:'Tyson Foods – Rogers',           state:'AR', lat:36.33, lng:-94.12, corp:'Tyson',           type:'Parts',      samples:610, positives:73  },
  { id:3,  name:'Tyson Foods – Russellville',     state:'AR', lat:35.28, lng:-93.14, corp:'Tyson',           type:'Comminuted', samples:440, positives:110 },
  { id:4,  name:'Tyson Foods – Van Buren',        state:'AR', lat:35.44, lng:-94.35, corp:'Tyson',           type:'Ground',     samples:390, positives:35  },
  { id:5,  name:"George's Inc – Springdale",      state:'AR', lat:36.24, lng:-94.19, corp:'Independent',     type:'Whole',      samples:310, positives:62  },
  { id:68, name:"Pilgrim's Pride – De Queen",     state:'AR', lat:34.04, lng:-94.34, corp:"Pilgrim's Pride", type:'Broilers',   samples:560, positives:146 },

  /* ── Georgia ── */
  { id:6,  name:"Pilgrim's Pride – Gainesville",  state:'GA', lat:34.30, lng:-83.83, corp:"Pilgrim's Pride", type:'Broilers',   samples:760, positives:205 },
  { id:7,  name:'Perdue Farms – Milledgeville',   state:'GA', lat:33.08, lng:-83.23, corp:'Perdue',          type:'Parts',      samples:540, positives:43  },
  { id:8,  name:'Sanderson Farms – Moultrie',     state:'GA', lat:31.18, lng:-83.79, corp:'Sanderson',       type:'Broilers',   samples:490, positives:88  },
  { id:9,  name:'Koch Foods – Cumming',           state:'GA', lat:34.20, lng:-84.14, corp:'Independent',     type:'Ground',     samples:350, positives:77  },
  { id:10, name:'Mar-Jac Poultry – Gainesville',  state:'GA', lat:34.29, lng:-83.90, corp:'Independent',     type:'Comminuted', samples:280, positives:11  },
  { id:70, name:'Koch Foods – Athens',            state:'GA', lat:33.95, lng:-83.38, corp:'Independent',     type:'Comminuted', samples:250, positives:70  },

  /* ── Alabama ── */
  { id:11, name:'Sanderson Farms – Laurel',       state:'AL', lat:31.69, lng:-89.13, corp:'Sanderson',       type:'Broilers',   samples:600, positives:162 },
  { id:12, name:'Wayne Farms – Albertville',      state:'AL', lat:34.27, lng:-86.21, corp:'Wayne Farms',     type:'Parts',      samples:470, positives:56  },
  { id:13, name:'Tyson Foods – Centre',           state:'AL', lat:34.16, lng:-85.68, corp:'Tyson',           type:'Ground',     samples:330, positives:29  },
  { id:14, name:"Pilgrim's Pride – Boaz",         state:'AL', lat:34.20, lng:-86.16, corp:"Pilgrim's Pride", type:'Broilers',   samples:410, positives:98  },
  { id:67, name:'Wayne Farms – Jack',             state:'AL', lat:31.47, lng:-86.35, corp:'Wayne Farms',     type:'Parts',      samples:400, positives:76  },

  /* ── Mississippi ── */
  { id:15, name:'Sanderson Farms – Collins',      state:'MS', lat:31.65, lng:-89.56, corp:'Sanderson',       type:'Broilers',   samples:720, positives:230 },
  { id:16, name:'Sanderson Farms – Laurel',       state:'MS', lat:31.70, lng:-89.14, corp:'Sanderson',       type:'Comminuted', samples:380, positives:57  },
  { id:17, name:'Koch Foods – Morton',            state:'MS', lat:32.36, lng:-89.66, corp:'Independent',     type:'Ground',     samples:290, positives:72  },

  /* ── North Carolina ── */
  { id:18, name:'Perdue Farms – Robersonville',   state:'NC', lat:35.82, lng:-77.25, corp:'Perdue',          type:'Whole',      samples:680, positives:75  },
  { id:19, name:'Perdue Farms – Lewiston',        state:'NC', lat:36.10, lng:-77.16, corp:'Perdue',          type:'Parts',      samples:500, positives:40  },
  { id:20, name:'Tyson Foods – Wilkesboro',       state:'NC', lat:36.15, lng:-81.16, corp:'Tyson',           type:'Broilers',   samples:630, positives:101 },
  { id:21, name:'House of Raeford – Raeford',     state:'NC', lat:34.99, lng:-79.22, corp:'Independent',     type:'Ground',     samples:310, positives:93  },

  /* ── Virginia / Delaware ── */
  { id:22, name:'Perdue Farms – Accomac',         state:'VA', lat:37.72, lng:-75.67, corp:'Perdue',          type:'Broilers',   samples:580, positives:52  },
  { id:23, name:'Perdue Farms – Georgetown',      state:'DE', lat:38.69, lng:-75.39, corp:'Perdue',          type:'Parts',      samples:460, positives:32  },
  { id:24, name:'Perdue Farms – Bridgewater',     state:'VA', lat:38.38, lng:-78.97, corp:'Perdue',          type:'Comminuted', samples:340, positives:82  },
  { id:72, name:'Perdue Farms – Denbigh',         state:'VA', lat:37.09, lng:-76.52, corp:'Perdue',          type:'Parts',      samples:420, positives:38  },

  /* ── Pennsylvania ── */
  { id:25, name:'Tyson Foods – New Holland',      state:'PA', lat:40.10, lng:-76.09, corp:'Tyson',           type:'Ground',     samples:420, positives:55  },
  { id:26, name:"Godshall's – Telford",           state:'PA', lat:40.32, lng:-75.33, corp:'Independent',     type:'Whole',      samples:200, positives:8   },
  { id:61, name:'Empire Kosher – Mifflintown',    state:'PA', lat:40.57, lng:-77.40, corp:'Independent',     type:'Whole',      samples:190, positives:7   },

  /* ── Texas ── */
  { id:27, name:'Tyson Foods – Seguin',           state:'TX', lat:29.57, lng:-97.96, corp:'Tyson',           type:'Broilers',   samples:890, positives:196 },
  { id:28, name:"Pilgrim's Pride – Mt. Pleasant", state:'TX', lat:33.16, lng:-94.97, corp:"Pilgrim's Pride", type:'Parts',      samples:750, positives:188 },
  { id:29, name:'Sanderson Farms – Palestine',    state:'TX', lat:31.76, lng:-95.63, corp:'Sanderson',       type:'Broilers',   samples:640, positives:128 },
  { id:30, name:"Pilgrim's Pride – Pittsburg",    state:'TX', lat:32.99, lng:-94.97, corp:"Pilgrim's Pride", type:'Ground',     samples:510, positives:71  },
  { id:31, name:'Tyson Foods – Center',           state:'TX', lat:31.80, lng:-94.18, corp:'Tyson',           type:'Comminuted', samples:360, positives:122 },
  { id:66, name:'Sanderson Farms – Waco',         state:'TX', lat:31.55, lng:-97.15, corp:'Sanderson',       type:'Broilers',   samples:580, positives:191 },
  { id:71, name:'Sanderson Farms – Bryan',        state:'TX', lat:30.67, lng:-96.37, corp:'Sanderson',       type:'Broilers',   samples:640, positives:173 },

  /* ── Missouri ── */
  { id:32, name:'Tyson Foods – Sedalia',          state:'MO', lat:38.70, lng:-93.23, corp:'Tyson',           type:'Broilers',   samples:700, positives:84  },
  { id:33, name:'Tyson Foods – Noel',             state:'MO', lat:36.54, lng:-94.49, corp:'Tyson',           type:'Parts',      samples:480, positives:62  },
  { id:69, name:'Tyson Foods – Dexter',           state:'MO', lat:36.80, lng:-89.96, corp:'Tyson',           type:'Ground',     samples:380, positives:38  },

  /* ── Iowa / Nebraska / Kansas ── */
  { id:34, name:'Tyson Foods – Storm Lake',       state:'IA', lat:42.64, lng:-95.21, corp:'Tyson',           type:'Broilers',   samples:760, positives:91  },
  { id:35, name:'Tyson Foods – Columbus',         state:'NE', lat:41.43, lng:-97.37, corp:'Tyson',           type:'Ground',     samples:430, positives:47  },
  { id:36, name:'Tyson Foods – Kansas City',      state:'KS', lat:39.11, lng:-94.63, corp:'Tyson',           type:'Comminuted', samples:510, positives:138 },

  /* ── Kentucky ── */
  { id:37, name:'Tyson Foods – Robards',          state:'KY', lat:37.69, lng:-87.54, corp:'Tyson',           type:'Broilers',   samples:550, positives:88  },
  { id:38, name:'Wayne Farms – London',           state:'KY', lat:37.13, lng:-84.08, corp:'Wayne Farms',     type:'Parts',      samples:390, positives:50  },

  /* ── Tennessee ── */
  { id:39, name:'Tyson Foods – Shelbyville',      state:'TN', lat:35.48, lng:-86.46, corp:'Tyson',           type:'Ground',     samples:470, positives:80  },
  { id:40, name:'Koch Foods – Morristown',        state:'TN', lat:36.21, lng:-83.30, corp:'Independent',     type:'Broilers',   samples:330, positives:109 },

  /* ── South Carolina ── */
  { id:41, name:"Pilgrim's Pride – Sumter",       state:'SC', lat:33.92, lng:-80.34, corp:"Pilgrim's Pride", type:'Broilers',   samples:500, positives:165 },
  { id:42, name:'Tyson Foods – Temperance Hall',  state:'SC', lat:34.15, lng:-80.61, corp:'Tyson',           type:'Whole',      samples:340, positives:31  },

  /* ── Minnesota ── */
  { id:43, name:"Jennie-O Turkey – Willmar",      state:'MN', lat:45.12, lng:-95.05, corp:'Independent',     type:'Whole',      samples:680, positives:61  },
  { id:44, name:"Pilgrim's Pride – Cold Spring",  state:'MN', lat:45.45, lng:-94.43, corp:"Pilgrim's Pride", type:'Parts',      samples:420, positives:67  },

  /* ── Oklahoma ── */
  { id:45, name:'Tyson Foods – Broken Bow',       state:'OK', lat:34.03, lng:-94.74, corp:'Tyson',           type:'Broilers',   samples:540, positives:65  },
  { id:46, name:'Simmons Foods – Siloam Springs', state:'OK', lat:36.19, lng:-94.54, corp:'Independent',     type:'Comminuted', samples:310, positives:84  },

  /* ── Louisiana ── */
  { id:47, name:'Sanderson Farms – Hammond',      state:'LA', lat:30.50, lng:-90.46, corp:'Sanderson',       type:'Broilers',   samples:570, positives:149 },
  { id:48, name:'Wayne Farms – Arcadia',          state:'LA', lat:32.55, lng:-93.04, corp:'Wayne Farms',     type:'Ground',     samples:320, positives:45  },

  /* ── California ── */
  { id:49, name:'Zacky Farms – Fresno',           state:'CA', lat:36.75, lng:-119.77, corp:'Independent',    type:'Whole',      samples:260, positives:68  },
  { id:50, name:'Foster Farms – Livingston',      state:'CA', lat:37.39, lng:-120.72, corp:'Independent',    type:'Broilers',   samples:480, positives:96  },
  { id:51, name:'Foster Farms – Turlock',         state:'CA', lat:37.50, lng:-120.85, corp:'Independent',    type:'Parts',      samples:390, positives:74  },

  /* ── Washington ── */
  { id:52, name:'Tyson Foods – Wallula',          state:'WA', lat:46.08, lng:-118.85, corp:'Tyson',          type:'Broilers',   samples:440, positives:44  },
  { id:53, name:'Draper Valley Farms – Mt. Vernon', state:'WA', lat:48.42, lng:-122.33, corp:'Independent',  type:'Whole',      samples:210, positives:25  },

  /* ── Indiana ── */
  { id:54, name:'Tyson Foods – Corydon',          state:'IN', lat:38.21, lng:-86.12, corp:'Tyson',           type:'Ground',     samples:480, positives:72  },
  { id:55, name:'Wayne Farms – Decatur',          state:'IN', lat:40.83, lng:-84.93, corp:'Wayne Farms',     type:'Comminuted', samples:350, positives:91  },

  /* ── Ohio ── */
  { id:56, name:'Perdue Farms – Bridgewater',     state:'OH', lat:40.02, lng:-83.16, corp:'Perdue',          type:'Parts',      samples:370, positives:30  },
  { id:57, name:'Tyson Foods – Piqua',            state:'OH', lat:40.15, lng:-84.24, corp:'Tyson',           type:'Broilers',   samples:420, positives:59  },

  /* ── Maryland ── */
  { id:58, name:'Perdue Farms – Salisbury',       state:'MD', lat:38.36, lng:-75.60, corp:'Perdue',          type:'Whole',      samples:620, positives:37  },

  /* ── Florida ── */
  { id:59, name:'Koch Foods – Tampa',             state:'FL', lat:27.95, lng:-82.46, corp:'Independent',     type:'Ground',     samples:290, positives:75  },
  { id:60, name:'Tyson Foods – Jacksonville',     state:'FL', lat:30.33, lng:-81.66, corp:'Tyson',           type:'Broilers',   samples:350, positives:42  },

  /* ── West Virginia ── */
  { id:62, name:"Pilgrim's Pride – Moorefield",   state:'WV', lat:38.99, lng:-78.99, corp:"Pilgrim's Pride", type:'Broilers',   samples:490, positives:137 },

  /* ── Colorado ── */
  { id:63, name:'Tyson Foods – Greeley',          state:'CO', lat:40.42, lng:-104.70, corp:'Tyson',          type:'Comminuted', samples:380, positives:57  },

  /* ── Illinois ── */
  { id:64, name:'Perdue Farms – Bridgeport',      state:'IL', lat:38.71, lng:-87.76, corp:'Perdue',          type:'Parts',      samples:360, positives:29  },
  { id:65, name:'Tyson Foods – Chicago',          state:'IL', lat:41.88, lng:-87.63, corp:'Tyson',           type:'Ground',     samples:440, positives:66  },
  ]);
}

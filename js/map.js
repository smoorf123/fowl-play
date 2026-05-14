/* ============================================================
   map.js  –  US choropleth base + plant dot overlay
   ============================================================ */

'use strict';

/* ── Module-level state ────────────────────────────────────── */
let projection, pathGen;
const mapSvg      = () => d3.select('#fp-map-svg');
const tooltip     = document.getElementById('fp-tooltip');
const mapContEl   = document.getElementById('fp-map-container');

/* ── Init: fetch topology then draw ────────────────────────── */
function initMap() {
  d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
    .then(buildMap)
    .catch(() => {
      mapSvg().append('text')
        .attr('x', 450).attr('y', 270)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'monospace')
        .attr('font-size', 14)
        .attr('fill', '#999')
        .text('Map topology failed to load – check your connection');
    });
}

function buildMap(us) {
  const W = 900, H = 540;

  projection = d3.geoAlbersUsa()
    .scale(1100)
    .translate([W / 2 - 20, H / 2 + 20]);
  pathGen = d3.geoPath(projection);

  /* State fills */
  mapSvg().append('g').attr('id', 'states')
    .selectAll('path')
    .data(topojson.feature(us, us.objects.states).features)
    .join('path')
    .attr('class', 'state-path')
    .attr('d', pathGen);

  /* Plant dot layer */
  mapSvg().append('g').attr('id', 'plants');

  renderPlants();
}

/* ── Plant dot rendering ────────────────────────────────────── */
function renderPlants() {
  const plants     = filteredPlants();
  const maxSamples = d3.max(plants, p => p.samples) || 1;
  const rScale     = d3.scaleSqrt().domain([0, maxSamples]).range([3, 14]);

  const grp = mapSvg().select('#plants');
  grp.selectAll('circle').remove();

  plants.forEach(p => {
    const proj = projection([p.lng, p.lat]);
    if (!proj) return;
    const [x, y] = proj;
    const col    = rateColor(p.rate);
    const r      = rScale(p.samples);

    grp.append('circle')
      .attr('class', 'plant-dot')
      .attr('cx', x).attr('cy', y)
      .attr('r', r)
      .attr('fill', col)
      .attr('fill-opacity', 0.82)
      .attr('stroke', col)
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.5)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', `${p.name}: ${(p.rate * 100).toFixed(1)}% positivity rate`)
      .on('mousemove', (event) => showTooltip(event, p))
      .on('mouseleave', hideTooltip)
      .on('click', () => showSidebar(p))
      .on('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') showSidebar(p); });
  });

  updateStats(plants);
}

/* ── Tooltip ─────────────────────────────────────────────────── */
function showTooltip(event, p) {
  const rect = mapContEl.getBoundingClientRect();
  const ex   = event.clientX - rect.left;
  const ey   = event.clientY - rect.top;

  document.getElementById('tt-name').textContent    = p.name;
  document.getElementById('tt-rate').textContent    = (p.rate * 100).toFixed(1) + '%';
  document.getElementById('tt-samples').textContent = p.samples.toLocaleString();
  document.getElementById('tt-corp').textContent    = p.corp;
  document.getElementById('tt-type').textContent    = p.type;

  /* Keep tooltip inside container */
  const tw = 214;
  tooltip.style.left = (ex + 14 + tw > rect.width ? ex - tw - 8 : ex + 14) + 'px';
  tooltip.style.top  = Math.max(8, ey - 80) + 'px';
  tooltip.classList.add('visible');
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

/* ── Sidebar ─────────────────────────────────────────────────── */
function showSidebar(p) {
  const sidebar = document.getElementById('fp-sidebar');
  sidebar.classList.remove('hidden');

  document.getElementById('sidebar-plant-name').textContent = p.name;
  document.getElementById('sb-corp').textContent            = p.corp;
  document.getElementById('sb-samples').textContent         = p.samples.toLocaleString();
  document.getElementById('sb-pos').textContent             = p.positives.toLocaleString();
  document.getElementById('sb-type').textContent            = p.type;
  document.getElementById('sb-state').textContent           = p.state;
  document.getElementById('sb-years').textContent           = p.dateRange || 'Jun 2020–Aug 2021';

  const rPct = (p.rate * 100).toFixed(1) + '%';
  const rEl  = document.getElementById('sb-rate');
  rEl.textContent = rPct;
  rEl.className   = 'stat-val ' + (p.rate > 0.30 ? 'danger' : p.rate > 0.15 ? 'caution' : 'safe');

  /* Risk level badge */
  const riskEl = document.getElementById('sb-risk');
  if      (p.rate >= 0.30) { riskEl.textContent = 'SEVERE';    riskEl.className = 'stat-val danger'; }
  else if (p.rate >= 0.15) { riskEl.textContent = 'HIGH RISK'; riskEl.className = 'stat-val danger'; }
  else if (p.rate >= 0.05) { riskEl.textContent = 'CAUTION';   riskEl.className = 'stat-val caution'; }
  else                     { riskEl.textContent = 'SAFE';       riskEl.className = 'stat-val safe'; }

  /* Industry average + delta */
  const allS = d3.sum(PLANTS, pl => pl.samples);
  const allP = d3.sum(PLANTS, pl => pl.positives);
  const industryAvg = allP / allS;
  const diff = p.rate - industryAvg;

  document.getElementById('sb-industry-avg').textContent = (industryAvg * 100).toFixed(1) + '%';
  const vsEl = document.getElementById('sb-vs-avg');
  vsEl.textContent = (diff >= 0 ? '+' : '') + (diff * 100).toFixed(1) + '%';
  vsEl.className   = 'stat-val ' + (diff > 0.05 ? 'danger' : diff < -0.03 ? 'safe' : 'caution');

  /* Trend: compare first vs last quarter */
  const trendEl = document.getElementById('sb-trend');
  if (p.history.length >= 2) {
    const firstRate = p.history[0].positives / p.history[0].samples;
    const lastRate  = p.history[p.history.length - 1].positives / p.history[p.history.length - 1].samples;
    const delta     = lastRate - firstRate;
    if      (delta >  0.03) { trendEl.textContent = '▲ Worsening'; trendEl.className = 'stat-val danger'; }
    else if (delta < -0.03) { trendEl.textContent = '▼ Improving'; trendEl.className = 'stat-val safe'; }
    else                    { trendEl.textContent = '● Stable';     trendEl.className = 'stat-val'; }
  } else {
    trendEl.textContent = '— N/A'; trendEl.className = 'stat-val';
  }

  /* History mini-bars */
  const bars    = document.getElementById('sb-history-bars');
  bars.innerHTML = '';
  const maxRate = Math.max(...p.history.map(h => h.positives / h.samples), 0.001);

  p.history.forEach(h => {
    const r   = h.positives / h.samples;
    const col = rateColor(r);
    const pct = (r / maxRate * 100).toFixed(1);

    const row = document.createElement('div');
    row.className = 'history-bar-row';
    row.innerHTML = `
      <span class="history-bar-year">${h.period}</span>
      <div class="history-bar-track">
        <div class="history-bar-fill" style="width:${pct}%;background:${col}"></div>
      </div>
      <span class="history-bar-val">${(r * 100).toFixed(0)}%</span>`;
    bars.appendChild(row);
  });
}

function closeSidebar() {
  document.getElementById('fp-sidebar').classList.add('hidden');
}

/* ── Summary stats bar ───────────────────────────────────────── */
function updateStats(plants) {
  const totalSamples = d3.sum(plants, p => p.samples);
  const totalPos     = d3.sum(plants, p => p.positives);
  const avgRate      = totalSamples > 0 ? totalPos / totalSamples : 0;
  const worst        = plants.length
    ? plants.reduce((a, b) => b.rate > a.rate ? b : a, plants[0])
    : null;
  const corpCount    = new Set(plants.map(p => p.corp)).size;

  document.getElementById('stat-plants').textContent  = plants.length;
  document.getElementById('stat-samples').textContent = totalSamples.toLocaleString();
  document.getElementById('stat-rate').textContent    = (avgRate * 100).toFixed(1) + '%';
  document.getElementById('stat-worst').textContent   = worst
    ? `${worst.corp} ${(worst.rate * 100).toFixed(0)}%` : '—';
  document.getElementById('stat-corps').textContent   = corpCount;
}

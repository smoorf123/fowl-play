/* ============================================================
   app.js  –  Global state, filter logic, view switching, init
   ============================================================ */

'use strict';

/* ── Filter state ───────────────────────────────────────────── */
let typeFilter = 'all';
let corpFilter = 'all';

/* ── Sort state (rankings table) ────────────────────────────── */
let sortKey = 'rate';
let sortAsc  = false;

/* Exported to map.js / network.js via global scope */
function filteredPlants() {
  return PLANTS.filter(p => {
    // Type filter: check if filter matches plant type
    let typeMatch = true;
    if (typeFilter !== 'all') {
      // Match filters: "Chicken", "Turkey", "Whole", "Parts", "Ground"
      typeMatch = p.type.toLowerCase().includes(typeFilter.toLowerCase());
    }
    
    // Corp filter
    const corpMatch = corpFilter === 'all' || p.corp === corpFilter;
    
    return typeMatch && corpMatch;
  });
}

/* ── Filter setters ─────────────────────────────────────────── */
function setTypeFilter(v) {
  typeFilter = v;
  document.querySelectorAll('#pills-type .pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.v === v);
  });
  renderPlants();
  renderRankings();
  renderInsights();
  renderCorpBreakdown();
  if (document.getElementById('fp-net-view').classList.contains('active')) {
    renderNetwork();
  }
}

function setCorpFilter(v) {
  corpFilter = v;
  document.querySelectorAll('#pills-corp .pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.c === v);
  });
  renderPlants();
  renderRankings();
  renderInsights();
  renderCorpBreakdown();
  if (document.getElementById('fp-net-view').classList.contains('active')) {
    renderNetwork();
  }
}

/* ── View switching ─────────────────────────────────────────── */
function switchView(v) {
  const isMap = v === 'map';

  document.getElementById('btn-map').classList.toggle('active', isMap);
  document.getElementById('btn-net').classList.toggle('active', !isMap);

  document.getElementById('fp-map-view').style.display = isMap ? 'flex' : 'none';

  const netView = document.getElementById('fp-net-view');
  netView.style.display = isMap ? 'none' : 'flex';
  netView.classList.toggle('active', !isMap);

  if (!isMap) renderNetwork();
}

/* ── Sort: column header clicks ─────────────────────────────── */
function setSort(key) {
  if (sortKey === key) {
    sortAsc = !sortAsc;
  } else {
    sortKey = key;
    sortAsc = (key === 'name' || key === 'corp' || key === 'type');
  }
  document.querySelectorAll('.sort-th').forEach(th => {
    const active = th.dataset.sort === key;
    th.classList.toggle('sort-active', active);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = active ? (sortAsc ? '↑' : '↓') : '';
  });
  renderRankings();
}

/* ── Rankings table ─────────────────────────────────────────── */
function renderRankings() {
  const plants    = filteredPlants().slice();
  const allS      = d3.sum(PLANTS, p => p.samples);
  const allP      = d3.sum(PLANTS, p => p.positives);
  const indAvg    = allP / allS;
  const maxRate   = d3.max(plants, p => p.rate) || 1;

  plants.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortAsc ? -1 :  1;
    if (av > bv) return sortAsc ?  1 : -1;
    return 0;
  });

  document.getElementById('rankings-count').textContent =
    `${plants.length} plant${plants.length !== 1 ? 's' : ''} · click any row to open on map`;

  const tbody = document.getElementById('fp-rankings-tbody');
  tbody.innerHTML = '';

  plants.forEach((p, i) => {
    let trendSymbol = '●', trendCls = 'trend-stable';
    if (p.history.length >= 2) {
      const firstRate = p.history[0].positives / p.history[0].samples;
      const lastRate  = p.history[p.history.length - 1].positives / p.history[p.history.length - 1].samples;
      const delta     = lastRate - firstRate;
      if      (delta >  0.03) { trendSymbol = '▲'; trendCls = 'trend-worse'; }
      else if (delta < -0.03) { trendSymbol = '▼'; trendCls = 'trend-better'; }
    }

    const ratePct  = (p.rate * 100).toFixed(1);
    const barW     = (p.rate / maxRate * 100).toFixed(1);
    const col      = rateColor(p.rate);
    const corpCol  = CORP_COLORS[p.corp] || '#888';

    const tr = document.createElement('tr');
    tr.className = 'ranking-row';
    tr.innerHTML = `
      <td class="rank-num">${i + 1}</td>
      <td>
        <div class="rate-cell">
          <span class="rate-pct" style="color:${col}">${ratePct}%</span>
          <div class="rate-bar-track">
            <div class="rate-bar-fill" style="width:${barW}%;background:${col}"></div>
          </div>
        </div>
      </td>
      <td>
        <div class="rank-name-cell">
          <span class="rank-plant-name">${p.name}</span>
          <span class="rank-state-tag">${p.state}</span>
        </div>
      </td>
      <td>
        <div class="rank-corp-cell">
          <span class="corp-color-dot" style="background:${corpCol}"></span>
          ${p.corp}
        </div>
      </td>
      <td><span class="rank-type-badge">${p.type}</span></td>
      <td class="rank-samples">${p.samples.toLocaleString()}</td>
      <td class="rank-pos">${p.positives.toLocaleString()}</td>
      <td class="trend-cell"><span class="${trendCls}" title="${delta > 0.03 ? 'Rate worsening 2000→2020' : delta < -0.03 ? 'Rate improving 2000→2020' : 'Stable 2000→2020'}">${trendSymbol}</span></td>
    `;
    tr.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      switchView('map');
      setTimeout(() => showSidebar(p), 120);
    });
    tbody.appendChild(tr);
  });
}

/* ── Corporate breakdown ────────────────────────────────────── */
function renderCorpBreakdown() {
  const plants    = filteredPlants();
  const allS      = d3.sum(PLANTS, p => p.samples);
  const allP      = d3.sum(PLANTS, p => p.positives);
  const indAvg    = allP / allS;

  const corpGroups = d3.group(plants, p => p.corp);
  const corps = Array.from(corpGroups, ([corp, ps]) => {
    const totalS = d3.sum(ps, p => p.samples);
    const totalP = d3.sum(ps, p => p.positives);
    return { corp, rate: totalP / totalS, samples: totalS, count: ps.length };
  })
    .filter(c => c.corp !== 'Independent')  // Exclude Independent
    .sort((a, b) => b.rate - a.rate);

  const maxRate = d3.max(corps, c => c.rate) || 1;
  const container = document.getElementById('fp-corp-bars');
  container.innerHTML = '';

  if (corps.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#999;padding:20px">No data for selected filters</p>';
    return;
  }

  corps.forEach(c => {
    const corpCol  = CORP_COLORS[c.corp] || '#888';
    const rateCol  = rateColor(c.rate);
    const barW     = (c.rate / maxRate * 100).toFixed(1);
    const diff     = c.rate - indAvg;
    const aboveAvg = diff > 0.005;
    const badgeCls = aboveAvg ? 'corp-avg-above' : 'corp-avg-below';
    const badgeTxt = (aboveAvg ? '+' : '') + (diff * 100).toFixed(1) + '% vs avg';

    const div = document.createElement('div');
    div.className = 'corp-bar-row';
    div.innerHTML = `
      <div class="corp-bar-header">
        <span class="corp-bar-name" style="color:${corpCol}">${c.corp}</span>
        <span class="corp-bar-meta">${c.count} plant${c.count !== 1 ? 's' : ''} · ${c.samples.toLocaleString()} samples</span>
      </div>
      <div class="corp-bar-bottom">
        <div class="corp-bar-track">
          <div class="corp-bar-fill" style="width:${barW}%;background:${rateCol}"></div>
        </div>
        <span class="corp-bar-pct" style="color:${rateCol}">${(c.rate * 100).toFixed(1)}%</span>
        <span class="corp-avg-badge ${badgeCls}">${badgeTxt}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ── Key findings ───────────────────────────────────────────── */
function renderInsights() {
  const el = document.getElementById('fp-insights-body');
  if (!el) return;

  const plants = filteredPlants();
  if (!plants.length) {
    el.innerHTML = '<p class="insights-empty">No plants match the current filters.</p>';
    return;
  }

  const allS   = d3.sum(PLANTS, p => p.samples);
  const allP   = d3.sum(PLANTS, p => p.positives);
  const indAvg = allP / allS;

  const worstPlant = plants.reduce((a, b) => b.rate > a.rate ? b : a);

  const corpGroups = d3.group(plants.filter(p => p.corp !== 'Independent'), p => p.corp);
  const corps = Array.from(corpGroups, ([corp, ps]) => ({
    corp,
    rate: d3.sum(ps, p => p.positives) / d3.sum(ps, p => p.samples),
  })).sort((a, b) => b.rate - a.rate);
  const worstCorp = corps[0];
  const bestCorp  = corps[corps.length - 1];

  const aboveAvg = plants.filter(p => p.rate > indAvg).length;
  const abovePct = (aboveAvg / plants.length * 100).toFixed(0);
  const highRisk = plants.filter(p => p.rate >= 0.15).length;

  const corpCard = (worstCorp && bestCorp && worstCorp.corp !== bestCorp.corp) ? `
    <div class="insight-card">
      <div class="insight-card-label">Corporate spread</div>
      <div class="insight-card-body">
        <span class="insight-hi danger">${worstCorp.corp}</span> averages
        <span class="insight-hi danger">${(worstCorp.rate * 100).toFixed(1)}%</span> positivity —
        ${(worstCorp.rate / bestCorp.rate).toFixed(1)}× higher than
        <span class="insight-hi safe">${bestCorp.corp}</span> at
        <span class="insight-hi safe">${(bestCorp.rate * 100).toFixed(1)}%</span>.
        Switch to the Corporate Network view to compare all companies at once.
      </div>
    </div>` : '';

  el.innerHTML = `
    <div class="insight-card">
      <div class="insight-card-label">Highest-risk plant</div>
      <div class="insight-card-body">
        <span class="insight-hi danger">${worstPlant.name}</span> (${worstPlant.state}) tested positive
        in <span class="insight-hi danger">${(worstPlant.rate * 100).toFixed(1)}%</span> of samples —
        ${(worstPlant.rate / indAvg).toFixed(1)}× the industry average of
        ${(indAvg * 100).toFixed(1)}%. Click its dot on the map to see the full quarterly breakdown.
      </div>
    </div>
    ${corpCard}
    <div class="insight-card">
      <div class="insight-card-label">Distribution</div>
      <div class="insight-card-body">
        <span class="insight-hi">${abovePct}%</span> of the ${plants.length} plants shown exceed
        the <span class="insight-hi">${(indAvg * 100).toFixed(1)}%</span> industry average, and
        <span class="insight-hi danger">${highRisk}</span> are flagged high-risk (≥ 15% positivity).
        Use the filters above to narrow by product type or corporate parent.
      </div>
    </div>
  `;
}

/* ── Bootstrap ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('fp-map-view').style.display = 'flex';
  document.getElementById('fp-net-view').style.display  = 'none';

  try {
    await loadPlantData();
  } catch (err) {
    document.getElementById('fp-content').innerHTML = `
      <div style="
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        flex:1; gap:12px; padding:40px; font-family:var(--ff-mono); color:var(--danger);
        text-align:center;
      ">
        <div style="font-size:28px">⚠</div>
        <div style="font-size:14px; font-weight:600;">Failed to load data</div>
        <div style="font-size:12px; color:var(--muted); max-width:420px;">
          Could not read <code>data/establishments.csv</code> or <code>data/samples.csv</code>.
          Make sure you are serving the project from a local HTTP server — opening
          <code>index.html</code> directly via <code>file://</code> will block CSV requests.
        </div>
        <div style="font-size:11px; color:var(--muted);">${err.message || err}</div>
      </div>`;
    return;
  }

  initMap();
  renderRankings();
  renderInsights();
  renderCorpBreakdown();
});

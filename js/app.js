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
  return PLANTS.filter(p =>
    (typeFilter === 'all' || p.type === typeFilter) &&
    (corpFilter === 'all' || p.corp === corpFilter)
  );
}

/* ── Filter setters ─────────────────────────────────────────── */
function setTypeFilter(v) {
  typeFilter = v;
  document.querySelectorAll('#pills-type .pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.v === v);
  });
  renderPlants();
  renderRankings();
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
    const firstRate = p.history[0].positives / p.history[0].samples;
    const lastRate  = p.history[p.history.length - 1].positives / p.history[p.history.length - 1].samples;
    const delta     = lastRate - firstRate;
    let trendSymbol, trendCls;
    if      (delta >  0.03) { trendSymbol = '▲'; trendCls = 'trend-worse'; }
    else if (delta < -0.03) { trendSymbol = '▼'; trendCls = 'trend-better'; }
    else                    { trendSymbol = '●'; trendCls = 'trend-stable'; }

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
  }).sort((a, b) => b.rate - a.rate);

  const maxRate = d3.max(corps, c => c.rate) || 1;
  const container = document.getElementById('fp-corp-bars');
  container.innerHTML = '';

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

/* ── Bootstrap ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  /* Map starts visible */
  document.getElementById('fp-map-view').style.display = 'flex';
  document.getElementById('fp-net-view').style.display  = 'none';
  initMap();
  renderRankings();
  renderCorpBreakdown();
});

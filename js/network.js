/* ============================================================
   network.js  –  Corporate positivity rate strip chart
   ============================================================ */

'use strict';

/* ── Network tooltip helpers ──────────────────────────────── */
function showNetTooltip(event, plant) {
  const tt    = document.getElementById('fp-net-tooltip');
  const netEl = document.getElementById('fp-net-view');
  if (!tt) return;

  const rect = netEl.getBoundingClientRect();
  const ex   = event.clientX - rect.left;
  const ey   = event.clientY - rect.top;

  const rateEl = document.getElementById('ntt-rate');
  document.getElementById('ntt-name').textContent    = plant.name;
  rateEl.textContent                                 = (plant.rate * 100).toFixed(1) + '%';
  rateEl.style.color                                 = rateColor(plant.rate);
  document.getElementById('ntt-samples').textContent = plant.samples.toLocaleString();
  document.getElementById('ntt-corp').textContent    = plant.corp;
  document.getElementById('ntt-state').textContent   = plant.state;

  const tw = 210;
  tt.style.left = (ex + 14 + tw > rect.width ? ex - tw - 8 : ex + 14) + 'px';
  tt.style.top  = Math.max(8, ey - 64) + 'px';
  tt.classList.add('visible');
}

function hideNetTooltip() {
  const tt = document.getElementById('fp-net-tooltip');
  if (tt) tt.classList.remove('visible');
}

/* ── Main render ──────────────────────────────────────────── */
function renderNetwork() {
  const plants = filteredPlants();
  const netSvg = d3.select('#fp-net-svg');
  netSvg.selectAll('*').remove();

  const W = 900, H = 520;
  netSvg.attr('viewBox', `0 0 ${W} ${H}`);

  if (!plants.length) {
    netSvg.append('text')
      .attr('x', W / 2).attr('y', H / 2)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'monospace').attr('font-size', 14).attr('fill', '#999')
      .text('No plants match the current filters');
    return;
  }

  /* ── Aggregate by corp (exclude Independent) ── */
  const corpGroups = d3.group(plants, p => p.corp);
  const corpData   = Array.from(corpGroups, ([corp, ps]) => {
    const totalS = d3.sum(ps, p => p.samples);
    const totalP = d3.sum(ps, p => p.positives);
    return { corp, plants: ps, rate: totalP / totalS, samples: totalS, count: ps.length };
  })
    .filter(c => c.corp !== 'Independent')
    .sort((a, b) => b.rate - a.rate);

  if (corpData.length === 0) {
    netSvg.append('text')
      .attr('x', W / 2).attr('y', H / 2)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'monospace').attr('font-size', 14).attr('fill', '#999')
      .text('No major corporations match the current filters');
    return;
  }

  /* ── Industry average (weighted across all visible plants) ── */
  const allS        = d3.sum(plants, p => p.samples);
  const allP        = d3.sum(plants, p => p.positives);
  const industryAvg = allS > 0 ? allP / allS : 0;

  /* ── Layout ── */
  const PAD_L = 64, PAD_R = 20, PAD_T = 48, PAD_B = 64;
  const plotW  = W - PAD_L - PAD_R;
  const plotH  = H - PAD_T - PAD_B;
  const n      = corpData.length;
  const colW   = plotW / n;

  /* Y-scale: positivity rate */
  const maxRate = d3.max(plants, p => p.rate) || 0.3;
  const yScale  = d3.scaleLinear()
    .domain([0, Math.min(maxRate * 1.15, 1)])
    .range([H - PAD_B, PAD_T])
    .nice();

  /* Plant dot radius */
  const maxSamp = d3.max(plants, p => p.samples) || 1;
  const rScale  = d3.scaleSqrt().domain([0, maxSamp]).range([3, 10]);

  /* ── Y-axis ── */
  const yAxis = d3.axisLeft(yScale)
    .tickFormat(d => `${(d * 100).toFixed(0)}%`)
    .ticks(6)
    .tickSize(-plotW);

  const axisG = netSvg.append('g')
    .attr('transform', `translate(${PAD_L},0)`)
    .call(yAxis);

  axisG.select('.domain').remove();
  axisG.selectAll('.tick line')
    .attr('stroke-opacity', 0.18).attr('stroke-dasharray', '4 3');
  axisG.selectAll('.tick text')
    .attr('font-family', 'monospace').attr('font-size', 10).attr('fill', '#888');

  /* ── Industry average dashed line ── */
  const avgY = yScale(industryAvg);
  netSvg.append('line')
    .attr('x1', PAD_L).attr('y1', avgY)
    .attr('x2', W - PAD_R).attr('y2', avgY)
    .attr('stroke', '#888').attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '7 4').attr('opacity', 0.65);

  netSvg.append('text')
    .attr('x', W - PAD_R - 4).attr('y', avgY - 5)
    .attr('text-anchor', 'end')
    .attr('class', 'net-label').attr('fill', '#888')
    .text(`Industry avg: ${(industryAvg * 100).toFixed(1)}%`);

  /* ── Draw each corp column ── */
  corpData.forEach((cd, ci) => {
    const col      = CORP_COLORS[cd.corp] || '#888';
    const cx       = PAD_L + (ci + 0.5) * colW;
    const x0       = PAD_L + ci * colW;
    const jitterW  = colW * 0.28;

    /* Subtle column background */
    netSvg.append('rect')
      .attr('x', x0 + 4).attr('y', PAD_T)
      .attr('width', colW - 8).attr('height', plotH)
      .attr('fill', col).attr('fill-opacity', 0.045)
      .attr('rx', 4);

    /* Corp aggregate rate bar */
    const corpAvgY = yScale(cd.rate);
    netSvg.append('line')
      .attr('x1', cx - colW * 0.32).attr('y1', corpAvgY)
      .attr('x2', cx + colW * 0.32).attr('y2', corpAvgY)
      .attr('stroke', col).attr('stroke-width', 3).attr('stroke-opacity', 0.85)
      .attr('stroke-linecap', 'round');

    /* Corp avg label above the bar */
    netSvg.append('text')
      .attr('x', cx).attr('y', corpAvgY - 7)
      .attr('text-anchor', 'middle')
      .attr('class', 'net-label-rate')
      .attr('fill', rateColor(cd.rate))
      .text(`${(cd.rate * 100).toFixed(1)}%`);

    /* Corp name + plant count at bottom */
    const shortName = cd.corp === "Pilgrim's Pride" ? "Pilgrim's" : cd.corp;
    netSvg.append('text')
      .attr('x', cx).attr('y', H - PAD_B + 18)
      .attr('text-anchor', 'middle').attr('class', 'net-label-corp').attr('fill', col)
      .text(shortName);

    netSvg.append('text')
      .attr('x', cx).attr('y', H - PAD_B + 32)
      .attr('text-anchor', 'middle').attr('class', 'net-label-count')
      .text(`${cd.count} plant${cd.count !== 1 ? 's' : ''}`);

    /* Plant dots with deterministic horizontal jitter */
    cd.plants.forEach((plant) => {
      const h    = hashStr(plant.name + plant.state + String(ci));
      const jit  = ((h & 0xffff) / 65535 - 0.5) * 2 * jitterW;
      const pr   = rScale(plant.samples);
      const px   = Math.max(x0 + 6 + pr, Math.min(x0 + colW - 6 - pr, cx + jit));
      const py   = yScale(plant.rate);
      const pcol = rateColor(plant.rate);

      const pg = netSvg.append('g').attr('cursor', 'pointer').style('outline', 'none');

      pg.append('circle')
        .attr('cx', px).attr('cy', py).attr('r', pr)
        .attr('fill', pcol).attr('fill-opacity', 0.88)
        .attr('stroke', '#fff').attr('stroke-width', 0.5).attr('stroke-opacity', 0.4);

      pg.on('mousemove',  (event) => showNetTooltip(event, plant))
        .on('mouseleave', hideNetTooltip)
        .on('click',      () => { hideNetTooltip(); switchView('map'); setTimeout(() => showSidebar(plant), 80); });
    });
  });

  /* ── Footer caption ── */
  netSvg.append('text')
    .attr('x', PAD_L + plotW / 2).attr('y', H - 4)
    .attr('text-anchor', 'middle').attr('class', 'net-label').attr('fill', '#888')
    .text('Dot = plant (size ∝ sample volume)  ·  Colored bar = corp aggregate  ·  Dashed line = industry avg  ·  Click any dot to open on map');
}

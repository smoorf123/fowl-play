/* ============================================================
   network.js  –  Corporate parent network / orbital layout
   ============================================================ */

'use strict';

function renderNetwork() {
  const plants = filteredPlants();
  const netSvg = d3.select('#fp-net-svg');
  netSvg.selectAll('*').remove();

  if (!plants.length) {
    netSvg.append('text')
      .attr('x', 450).attr('y', 260)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'monospace')
      .attr('font-size', 14)
      .attr('fill', '#999')
      .text('No plants match the current filters');
    return;
  }

  /* Use actual rendered dimensions so nothing overflows */
  const svgEl = document.getElementById('fp-net-svg');
  const W = svgEl.clientWidth  || 900;
  const H = svgEl.clientHeight || 520;
  netSvg.attr('viewBox', `0 0 ${W} ${H}`);

  /* ── Aggregate by corp ── */
  const corpGroups = d3.group(plants, p => p.corp);
  const corpData   = Array.from(corpGroups, ([corp, ps]) => {
    const totalS = d3.sum(ps, p => p.samples);
    const totalP = d3.sum(ps, p => p.positives);
    return { corp, plants: ps, rate: totalP / totalS, samples: totalS, count: ps.length };
  }).sort((a, b) => b.samples - a.samples);

  const n = corpData.length;

  /* ── Scales ── */
  const maxSamples   = d3.max(corpData, c => c.samples) || 1;
  const maxPlantSamp = d3.max(plants,   p => p.samples) || 1;
  const corpRadius   = d3.scaleSqrt().domain([0, maxSamples]).range([20, 50]);
  const plantRadius  = d3.scaleSqrt().domain([0, maxPlantSamp]).range([4, 10]);

  /* ── Industry average ── */
  const allSamples  = d3.sum(plants, p => p.samples);
  const allPos      = d3.sum(plants, p => p.positives);
  const industryAvg = allSamples > 0 ? allPos / allSamples : 0;

  /* ── Layout geometry ── */
  const PAD    = Math.max(72, W * 0.07);
  const corpY  = H * 0.50;
  const slotW  = n === 1 ? W - PAD * 2 : (W - PAD * 2) / (n - 1);

  const corpX  = (ci) => n === 1 ? W / 2 : PAD + ci * slotW;

  /* Pre-compute per-corp radius & orbit radius */
  corpData.forEach((cd, i) => {
    cd.cx = corpX(i);
    cd.cr = corpRadius(cd.samples);

    /* Cap orbit so satellites stay within horizontal slot and vertical bounds */
    const maxBySlot = slotW * 0.44;
    const maxByVert = Math.min(corpY - cd.cr - 16, H - corpY - cd.cr - 28);
    cd.orbitR = Math.min(
      cd.cr + 16 + Math.sqrt(cd.count) * 5,
      maxBySlot,
      maxByVert
    );
  });

  /* ── Industry avg reference line ── */
  const refY = 20;
  netSvg.append('line')
    .attr('x1', PAD).attr('y1', refY)
    .attr('x2', W - PAD).attr('y2', refY)
    .attr('stroke', '#888').attr('stroke-width', 0.8)
    .attr('stroke-dasharray', '5 4').attr('opacity', 0.5);

  netSvg.append('text')
    .attr('x', W / 2).attr('y', refY - 5)
    .attr('text-anchor', 'middle')
    .attr('class', 'net-label')
    .text(`Industry avg: ${(industryAvg * 100).toFixed(1)}%`);

  /* ── Draw each corp cluster ── */
  corpData.forEach((cd, ci) => {
    const { cx, cr, orbitR } = cd;
    const col       = CORP_COLORS[cd.corp] || '#888';
    const angleStep = (2 * Math.PI) / Math.max(cd.plants.length, 1);

    /* ── Satellite plant nodes ── */
    cd.plants.forEach((plant, pi) => {
      const angle = -Math.PI / 2 + pi * angleStep;
      const pr    = plantRadius(plant.samples);
      const pcol  = rateColor(plant.rate);

      /* Clamp to SVG bounds */
      const px = Math.max(pr + 3, Math.min(W - pr - 3, cx + orbitR * Math.cos(angle)));
      const py = Math.max(pr + 3, Math.min(H - pr - 20, corpY + orbitR * Math.sin(angle)));

      netSvg.append('line')
        .attr('x1', cx).attr('y1', corpY)
        .attr('x2', px).attr('y2', py)
        .attr('stroke', col).attr('stroke-width', 0.6).attr('stroke-opacity', 0.22);

      const pg = netSvg.append('g')
        .attr('cursor', 'pointer')
        .attr('tabindex', 0).attr('role', 'button')
        .attr('aria-label', `${plant.name} – ${(plant.rate * 100).toFixed(1)}% positivity`)
        .on('click', () => { switchView('map'); setTimeout(() => showSidebar(plant), 80); })
        .on('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            switchView('map'); setTimeout(() => showSidebar(plant), 80);
          }
        });

      pg.append('circle')
        .attr('cx', px).attr('cy', py).attr('r', pr)
        .attr('fill', pcol).attr('fill-opacity', 0.85)
        .attr('stroke', pcol).attr('stroke-width', 1).attr('stroke-opacity', 0.6);

      pg.append('title').text(
        `${plant.name}\n${(plant.rate * 100).toFixed(1)}% positive (${plant.samples.toLocaleString()} samples)`
      );
    });

    /* ── Corp outer ring ── */
    netSvg.append('circle')
      .attr('cx', cx).attr('cy', corpY).attr('r', cr)
      .attr('fill', col).attr('fill-opacity', 0.10)
      .attr('stroke', col).attr('stroke-width', 1.5);

    /* ── Rate arc ── */
    const arcGen = d3.arc()
      .innerRadius(cr - 5).outerRadius(cr)
      .startAngle(-Math.PI / 2)
      .endAngle(-Math.PI / 2 + cd.rate * Math.PI * 2);

    netSvg.append('path')
      .attr('d', arcGen())
      .attr('transform', `translate(${cx},${corpY})`)
      .attr('fill', rateColor(cd.rate));

    /* ── Corp label (3 lines) ── */
    const shortName = cd.corp === "Pilgrim's Pride" ? "Pilgrim's" : cd.corp;

    netSvg.append('text')
      .attr('x', cx).attr('y', corpY - 8)
      .attr('text-anchor', 'middle').attr('class', 'net-label-corp').attr('fill', col)
      .text(shortName);

    netSvg.append('text')
      .attr('x', cx).attr('y', corpY + 7)
      .attr('text-anchor', 'middle').attr('class', 'net-label-rate').attr('fill', rateColor(cd.rate))
      .text(`${(cd.rate * 100).toFixed(1)}%`);

    netSvg.append('text')
      .attr('x', cx).attr('y', corpY + 20)
      .attr('text-anchor', 'middle').attr('class', 'net-label-count')
      .text(`${cd.count} plant${cd.count !== 1 ? 's' : ''}`);
  });

  /* ── Footer caption ── */
  netSvg.append('text')
    .attr('x', W / 2).attr('y', H - 8)
    .attr('text-anchor', 'middle').attr('class', 'net-label').attr('fill', '#888')
    .text('Arc = positivity rate  ·  Dot colour = rate (green→orange→red→purple)  ·  Dot size = sample volume  ·  Click any plant to open map detail');
}

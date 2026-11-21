// AI helpers that run locally: AP auto-placement, channel planning, weak-area detection.

const tick = () => new Promise(r => setTimeout(r, 0));

/**
 * Greedy set-cover placement + one local refinement pass.
 * opts: { band, req (dBm), target (0..1), maxAps, keep (bool), modelId }
 * Returns { aps: [{x, y}], coverage, evaluated }.
 */
async function autoPlace(project, opts, onProgress = () => {}) {
  const rf = rfContext(project, opts.band);
  const box = buildingBox(project);
  const spec = AP_BY_ID[opts.modelId] || AP_BY_ID["generic-ax"];
  const probe = { ...spec, ch5: 36 };
  const eirp = apEirp(probe, opts.band, rf.cap);
  const mpp = project.mPerPx;
  const bw = box.x1 - box.x0, bh = box.y1 - box.y0;

  // evaluation cells (~2000) and candidate positions (~300), never finer than 0.5 m / 1 m
  const cell = Math.max(Math.sqrt((bw * bh) / 2000), 0.5 / mpp);
  const cells = [];
  for (let y = box.y0 + cell / 2; y < box.y1; y += cell) for (let x = box.x0 + cell / 2; x < box.x1; x += cell) if (inAreas(project, x, y)) cells.push(x, y);
  const nc = cells.length / 2;
  const step = Math.max(Math.sqrt((bw * bh) / 300), 1 / mpp);
  const cands = [];
  for (let y = box.y0 + step / 2; y < box.y1; y += step) for (let x = box.x0 + step / 2; x < box.x1; x += step) if (inAreas(project, x, y)) cands.push({ x, y });
  if (!nc || !cands.length) return { aps: [], coverage: 0, evaluated: 0 };

  // current best signal per cell (existing APs if kept)
  const cover = new Float32Array(nc).fill(-Infinity);
  if (opts.keep) {
    for (const ap of project.aps) {
      const e = apEirp(ap, opts.band, rf.cap);
      for (let i = 0; i < nc; i++) cover[i] = Math.max(cover[i], rssiAt(rf, e, ap.x, ap.y, cells[2 * i], cells[2 * i + 1]));
    }
  }

  // signal map of every candidate (computed in chunks to keep the page responsive)
  const floor = opts.req - 25;
  for (let k = 0; k < cands.length; k++) {
    const v = new Float32Array(nc);
    for (let i = 0; i < nc; i++) v[i] = rssiAt(rf, eirp, cands[k].x, cands[k].y, cells[2 * i], cells[2 * i + 1], floor);
    cands[k].v = v;
    if (k % 12 === 0) { onProgress(0.85 * k / cands.length); await tick(); }
  }

  const meets = c => { let m = 0; for (let i = 0; i < nc; i++) if (c[i] >= opts.req) m++; return m / nc; };
  const placed = [];
  let coverage = meets(cover);

  while (coverage < opts.target && placed.length < opts.maxAps) {
    let best = null, bestScore = 0;
    for (const cd of cands) {
      let gain = 0, soft = 0;
      for (let i = 0; i < nc; i++) {
        const v = cd.v[i];
        if (cover[i] < opts.req && v >= opts.req) gain++;
        if (v > cover[i]) soft += Math.min(v - cover[i], 10);
      }
      const score = gain + soft * 1e-4;
      if (score > bestScore) { bestScore = score; best = cd; }
    }
    if (!best || bestScore < 1) break;                 // nothing meaningful left to gain
    placed.push(best);
    for (let i = 0; i < nc; i++) if (best.v[i] > cover[i]) cover[i] = best.v[i];
    coverage = meets(cover);
  }
  onProgress(0.92); await tick();

  // refinement: nudge each new AP to a nearby candidate if total coverage improves
  if (placed.length > 1) {
    const base = new Float32Array(nc);
    for (let p = 0; p < placed.length; p++) {
      base.fill(-Infinity);
      if (opts.keep) for (const ap of project.aps) {
        const e = apEirp(ap, opts.band, rf.cap);
        for (let i = 0; i < nc; i++) base[i] = Math.max(base[i], rssiAt(rf, e, ap.x, ap.y, cells[2 * i], cells[2 * i + 1]));
      }
      placed.forEach((q, j) => { if (j !== p) for (let i = 0; i < nc; i++) if (q.v[i] > base[i]) base[i] = q.v[i]; });
      const score = cd => { let m = 0; for (let i = 0; i < nc; i++) if (Math.max(base[i], cd.v[i]) >= opts.req) m++; return m; };
      let cur = score(placed[p]);
      for (const cd of cands) {
        if (Math.hypot(cd.x - placed[p].x, cd.y - placed[p].y) > 3.2 * step || placed.includes(cd)) continue;
        const s = score(cd);
        if (s > cur) { cur = s; placed[p] = cd; }
      }
    }
    cover.fill(-Infinity);
    if (opts.keep) for (const ap of project.aps) {
      const e = apEirp(ap, opts.band, rf.cap);
      for (let i = 0; i < nc; i++) cover[i] = Math.max(cover[i], rssiAt(rf, e, ap.x, ap.y, cells[2 * i], cells[2 * i + 1]));
    }
    for (const q of placed) for (let i = 0; i < nc; i++) if (q.v[i] > cover[i]) cover[i] = q.v[i];
    coverage = meets(cover);
  }
  onProgress(1);
  return { aps: placed.map(q => ({ x: q.x, y: q.y })), coverage, evaluated: cands.length };
}

/**
 * Assign non-overlapping channels so APs that hear each other strongly differ.
 * Greedy colouring, strongest-interference APs first. Mutates ap.ch24 / ap.ch5.
 */
function assignChannels(project) {
  const aps = project.aps;
  for (const band of ["2.4", "5"]) {
    const rf = rfContext(project, band);
    const chans = CHANNELS[band];
    const key = band === "2.4" ? "ch24" : "ch5";
    // interference matrix in mW (linear) so strong neighbours dominate
    const I = aps.map(a => aps.map(b => a === b ? 0 : Math.pow(10, rssiAt(rf, apEirp(b, band, rf.cap), b.x, b.y, a.x, a.y) / 10)));
    const order = aps.map((_, i) => i).sort((i, j) => I[j].reduce((s, v) => s + v, 0) - I[i].reduce((s, v) => s + v, 0));
    const done = new Set();
    for (const i of order) {
      let bestCh = chans[0], bestCost = Infinity;
      for (const ch of chans) {
        let cost = 0;
        for (const j of done) if (aps[j][key] === ch) cost += I[i][j] + I[j][i];
        if (cost < bestCost - 1e-15) { bestCost = cost; bestCh = ch; }
      }
      aps[i][key] = bestCh;
      done.add(i);
    }
  }
}

/** Connected areas below the requirement inside the building (for the AI report). */
function weakRegions(project, heat, reqDbm, limit = 6) {
  const box = buildingBox(project);
  const { cols, rows, cell, data } = heat;
  const c0 = Math.max(0, Math.floor(box.x0 / cell)), c1 = Math.min(cols, Math.ceil(box.x1 / cell));
  const r0 = Math.max(0, Math.floor(box.y0 / cell)), r1 = Math.min(rows, Math.ceil(box.y1 / cell));
  const mask = areaMask(project, heat);
  const seen = new Uint8Array(cols * rows);
  const mpp = project.mPerPx, cellM2 = (cell * mpp) ** 2;
  const out = [];
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    const s = r * cols + c;
    if (seen[s] || data[s] >= reqDbm || (mask && !mask[s])) continue;
    let n = 0, sx = 0, sy = 0, worst = Infinity;
    const stack = [s]; seen[s] = 1;
    while (stack.length) {
      const k = stack.pop(), kr = (k / cols) | 0, kc = k % cols;
      n++; sx += kc; sy += kr; worst = Math.min(worst, data[k]);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = kr + dr, ncc = kc + dc;
        if (nr < r0 || nr >= r1 || ncc < c0 || ncc >= c1) continue;
        const q = nr * cols + ncc;
        if (!seen[q] && data[q] < reqDbm && (!mask || mask[q])) { seen[q] = 1; stack.push(q); }
      }
    }
    const area = n * cellM2;
    if (area >= 1) out.push({
      x_m: +(((sx / n) + 0.5) * cell * mpp).toFixed(1),
      y_m: +(((sy / n) + 0.5) * cell * mpp).toFixed(1),
      area_m2: +area.toFixed(1),
      worst_dbm: isFinite(worst) ? Math.round(worst) : null,
    });
  }
  return out.sort((a, b) => b.area_m2 - a.area_m2).slice(0, limit);
}

// AI helpers that run locally: AP auto-placement, channel planning, weak-area detection.

const tick = () => new Promise(r => setTimeout(r, 0));

/**
 * Greedy set-cover placement + one local refinement pass.
 * opts: { band, req (dBm), target (0..1), maxAps, keep (bool), modelId }
 * Returns { aps: [{x, y}], coverage, evaluated }.
 */
async function autoPlace(project, opts, onProgress = () => {}) {
  const { rf, sources: existing } = modelFor(project, opts.band);
  const box = buildingBox(project);
  const spec = AP_BY_ID[opts.modelId] || AP_BY_ID["generic-ax"];
  const probe = { ...spec, ch5: 36, ch6: 1 };
  const mnt = mountForModel(spec);
  const srcAt = (x, y) => buildSource(rf, { ...probe, ...mnt, x, y });
  // best signal per cell from a set of prepared sources
  const fill = (arr, srcs) => { for (const s of srcs) for (let i = 0; i < nc; i++) arr[i] = Math.max(arr[i], sourceRssi(rf, s, cells[2 * i], cells[2 * i + 1], arr[i])); };
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

  const hintPx = Math.max(1.5 / mpp, cell * 2);     // coarse corner-path hints: fast, close enough to rank candidates
  for (const s of existing) ensureHint(rf, s, project.plan, hintPx);

  // current best signal per cell (existing APs if kept)
  const cover = new Float32Array(nc).fill(-Infinity);
  if (opts.keep) fill(cover, existing);

  // signal map of every candidate (computed in chunks to keep the page responsive)
  const floor = opts.req - 25;
  for (let k = 0; k < cands.length; k++) {
    const v = new Float32Array(nc);
    const src = srcAt(cands[k].x, cands[k].y);
    ensureHint(rf, src, project.plan, hintPx);
    for (let i = 0; i < nc; i++) v[i] = sourceRssi(rf, src, cells[2 * i], cells[2 * i + 1], floor);
    cands[k].v = v;
    if (k % 4 === 0) { onProgress(0.85 * k / cands.length); await tick(); }
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
      if (opts.keep) fill(base, existing);
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
    if (opts.keep) fill(cover, existing);
    for (const q of placed) for (let i = 0; i < nc; i++) if (q.v[i] > cover[i]) cover[i] = q.v[i];
    coverage = meets(cover);
  }
  onProgress(1);
  return { aps: placed.map(q => ({ x: q.x, y: q.y })), coverage, evaluated: cands.length };
}

/**
 * Assign channels so APs that hear each other strongly do not share spectrum.
 * Greedy colouring, strongest-interference APs first, on every band, using each radio's
 * channel width (channelPlan in radio.js; DFS channels only when settings.dfs is on).
 * Mutates ap.ch24 / ap.ch5 / ap.ch6. `all` (optional) = [{ap, floor}] across floors, with
 * `signalAt(band, i, j)` giving AP j's signal (dBm) at AP i.
 */
function assignChannels(project, all = null, signalAt = null) {
  const list = all || project.aps.map(ap => ({ ap }));
  const aps = list.map(e => e.ap);
  const dfs = !!project.settings?.dfs;
  for (const band of BAND_LIST) {
    const key = "ch" + BK[band];
    const live = aps.map((a, i) => i).filter(i => apTx(aps[i], band) > 0);
    for (const i of aps.keys()) if (!live.includes(i)) aps[i][key] = null;
    if (!live.length) continue;
    let sig = signalAt;
    if (!sig) {
      const { rf, sources } = modelFor(project, band);
      sig = (b, i, j) => sourceRssi(rf, sources[j], aps[i].x, aps[i].y);
    }
    // interference matrix in mW (linear) so strong neighbours dominate
    const I = aps.map((a, i) => aps.map((b, j) => i === j || !live.includes(i) || !live.includes(j) ? 0 : Math.pow(10, sig(band, i, j) / 10)));
    const order = live.slice().sort((i, j) => I[j].reduce((s, v) => s + v, 0) - I[i].reduce((s, v) => s + v, 0));
    const done = [];
    for (const i of order) {
      const w = apWidth(aps[i], band);
      const plan = channelPlan(band, w, dfs);
      let bestCh = plan[0], bestCost = Infinity;
      plan.forEach((ch, k) => {
        const span = chSpan(band, ch, w);
        let cost = 0;
        for (const j of done) {
          const o = overlapFrac(span, chSpan(band, aps[j][key], apWidth(aps[j], band)));
          if (o) cost += (I[i][j] + I[j][i]) * o;
        }
        cost *= 1 + k * 1e-6;                      // ties: earlier channels in the plan
        if (cost < bestCost - 1e-18) { bestCost = cost; bestCh = ch; }
      });
      aps[i][key] = bestCh;
      done.push(i);
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

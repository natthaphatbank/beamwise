// Heatmap views beyond signal strength: secondary signal, SNR, SINR (co-channel /
// adjacent-channel interference), channel interference count, data rate, serving AP and
// number of APs. All views come from one grid of every AP's signal per cell.
//
// Interference model: every other radio whose channel overlaps the serving radio's channel
// counts with the share of its power that falls inside that channel (overlapFrac), as if it
// were transmitting (worst case, as planning tools assume). Noise floor depends on the width.

const CCA_DBM = -82;                    // a radio this strong blocks the channel (preamble detect)

// Colour scales per view. Values at or above stop[0] use its colour; between stops the colour
// is interpolated (continuous views) or stepped (discrete views).
const VIEW_DEFS = {
  signal:    { unit: "dBm", stops: null },
  secondary: { unit: "dBm", stops: null },
  snr: { unit: "dB", good: 25, stops: [
    { v: 35, rgb: [0, 190, 110], label: "≥ 35" }, { v: 25, rgb: [70, 210, 80], label: "25" },
    { v: 20, rgb: [190, 220, 50], label: "20" }, { v: 15, rgb: [250, 170, 40], label: "15" },
    { v: 8, rgb: [230, 60, 60], label: "8" }, { v: 0, rgb: [150, 30, 60], label: "< 5" }] },
  sinr: { unit: "dB", good: 20, stops: null },
  rate: { unit: "Mbps", good: 100, stops: [
    { v: 800, rgb: [0, 170, 140], label: "≥ 800" }, { v: 400, rgb: [0, 200, 110], label: "400" },
    { v: 200, rgb: [110, 210, 70], label: "200" }, { v: 100, rgb: [200, 220, 50], label: "100" },
    { v: 40, rgb: [250, 170, 40], label: "40" }, { v: 10, rgb: [230, 60, 60], label: "10" },
    { v: 0, rgb: [150, 30, 60], label: "0" }] },
  cci: { unit: "", discrete: true, goodMax: 0, stops: [
    { v: 0, rgb: [0, 190, 110], label: "0" }, { v: 1, rgb: [200, 220, 50], label: "1" },
    { v: 2, rgb: [250, 150, 40], label: "2" }, { v: 3, rgb: [230, 60, 60], label: "3+" }] },
  apcount: { unit: "", discrete: true, good: 2, stops: [
    { v: 0, rgb: [230, 60, 60], label: "0" }, { v: 1, rgb: [250, 170, 40], label: "1" },
    { v: 2, rgb: [110, 210, 70], label: "2" }, { v: 3, rgb: [0, 180, 120], label: "3+" }] },
  serving: { unit: "", stops: null },
  capacity: { unit: "%", goodMax: 80, stops: [
    { v: 120, rgb: [150, 30, 60], label: "> 100" }, { v: 100, rgb: [230, 60, 60], label: "100" },
    { v: 80, rgb: [250, 170, 40], label: "80" }, { v: 50, rgb: [200, 220, 50], label: "50" },
    { v: 0, rgb: [0, 190, 110], label: "0" }], ascending: true },
};
VIEW_DEFS.sinr.stops = VIEW_DEFS.snr.stops;
const VIEW_KEYS = Object.keys(VIEW_DEFS);

// Distinct colours for "serving AP" zones.
const AP_PALETTE = [[66, 133, 244], [234, 67, 53], [251, 188, 5], [52, 168, 83], [171, 71, 188], [0, 172, 193],
  [255, 112, 67], [158, 157, 36], [92, 107, 192], [240, 98, 146], [0, 137, 123], [141, 110, 99]];
const apColor = i => AP_PALETTE[((i % AP_PALETTE.length) + AP_PALETTE.length) % AP_PALETTE.length];

function viewColor(view, v) {
  if (view === "signal" || view === "secondary") return signalColor(v);
  if (view === "serving") return apColor(v);
  const s = VIEW_DEFS[view].stops;
  if (VIEW_DEFS[view].discrete) {
    for (const st of s.slice().reverse()) if (v >= st.v) return st.rgb;
    return s[0].rgb;
  }
  if (v >= s[0].v) return s[0].rgb;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1];
    if (v >= b.v) {
      const k = (a.v - v) / (a.v - b.v);
      return [0, 1, 2].map(j => Math.round(a.rgb[j] + (b.rgb[j] - a.rgb[j]) * k));
    }
  }
  return s[s.length - 1].rgb;
}

// ---------- area requirements and capacity ----------
// A boundary area can carry its own requirement and a demand:
//   area.req: "auto" (use the project requirement) or a minimum RSSI (dBm)
//   area.devices: devices in the area at the busy hour, area.app / area.mbps: demand per device
const APP_PROFILES = { web: 2, video: 5, call: 4, video4k: 25, voice: 0.3, iot: 0.1, custom: null };
const AIRTIME_EFF = 0.6;                // MAC efficiency: share of the PHY rate that carries data
const DEVICES_PER_RADIO = 50;           // planning limit of active devices per radio
const areaMbps = a => APP_PROFILES[a.app] != null ? APP_PROFILES[a.app] : Math.max(0, +a.mbps || 0);
const hasDemand = project => projectAreas(project).some(a => +a.devices > 0);

// Index of the area each grid cell belongs to (-1: none). Later areas sit on top.
function areaIndexGrid(project, grid) {
  const A = projectAreas(project), n = grid.cols * grid.rows;
  const idx = new Int16Array(n).fill(-1);
  if (!A.length) return idx;
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    const x = (c + 0.5) * grid.cell, y = (r + 0.5) * grid.cell;
    for (let i = A.length - 1; i >= 0; i--) if (pointInPoly(x, y, A[i].pts)) { idx[r * grid.cols + c] = i; break; }
  }
  return idx;
}
// Requirement (dBm, margin included) per cell: the area's own value, else the project's.
function reqGrid(project, grid, globalReq, margin, aIdx = areaIndexGrid(project, grid)) {
  const A = projectAreas(project);
  const out = new Float32Array(grid.cols * grid.rows).fill(globalReq);
  for (let k = 0; k < out.length; k++) {
    const a = A[aIdx[k]];
    if (a && a.req !== "auto" && Number.isFinite(+a.req)) out[k] = +a.req + margin;
  }
  return out;
}

/**
 * Airtime each AP needs on a band to serve the devices in its zone:
 * Σ (devices in its cells × Mbps per device) / (PHY rate there × MAC efficiency).
 * Returns per source { devices, demand (Mbps), airtime (0..1+), unserved (devices without a usable link) }.
 */
function capacityLoads(project, grid, serving, rate, aIdx, nSrc) {
  const A = projectAreas(project);
  const cellsPer = new Array(A.length).fill(0);
  for (let k = 0; k < aIdx.length; k++) if (aIdx[k] >= 0) cellsPer[aIdx[k]]++;
  const loads = Array.from({ length: nSrc }, () => ({ devices: 0, demand: 0, airtime: 0, unserved: 0 }));
  for (let k = 0; k < aIdx.length; k++) {
    const ai = aIdx[k], s = serving[k];
    if (ai < 0 || s < 0 || !cellsPer[ai]) continue;
    const a = A[ai], dev = (+a.devices || 0) / cellsPer[ai];
    if (!dev) continue;
    const mb = dev * areaMbps(a), L = loads[s];
    if (!(rate[k] > 0)) { L.unserved += dev; continue; }      // no usable link there: those devices cannot connect
    L.devices += dev; L.demand += mb;
    L.airtime += mb / (rate[k] * AIRTIME_EFF);
  }
  return loads;
}

// Per-source radio facts for a band: channel span, noise floor, standard.
function radioInfo(aps, band) {
  return aps.map(ap => {
    const w = apWidth(ap, band), ch = apCh(ap, band);
    return { w, span: chSpan(band, ch ?? channelPlan(band, w, true)[0], w), hasCh: ch != null, noise: noiseFloor(w), std: apStd(ap) };
  });
}

/**
 * Every AP's signal at every cell of a grid: { cols, rows, cell, per: [Float32Array], aps }.
 * `aps` lists the AP object behind each source (same order as modelFor's sources).
 */
function computeApGrids(project, band, cellPx) {
  const { width: W, height: H } = project.plan;
  const cols = Math.ceil(W / cellPx), rows = Math.ceil(H / cellPx);
  const { rf, sources, aps } = modelFor(project, band);
  const hpx = hintCellPx(project, cellPx);
  const per = sources.map(src => {
    const g = new Float32Array(cols * rows).fill(-Infinity);
    if (src.dead) return g;
    ensureHint(rf, src, project.plan, hpx);
    for (let r = 0; r < rows; r++) {
      const cy = (r + 0.5) * cellPx;
      for (let c = 0; c < cols; c++) g[r * cols + c] = sourceRssi(rf, src, (c + 0.5) * cellPx, cy, RELEVANT_DBM);
    }
    return g;
  });
  return { cols, rows, cell: cellPx, per, aps: aps || project.aps };
}

// Metrics at one cell (or point) from the per-AP signals `sig` (dBm array, one per source).
// ctx: { band, info, reqDbm, clientStd, ss }
function cellMetrics(sig, ctx) {
  let s1 = -Infinity, s2 = -Infinity, i1 = -1, heard = 0;
  for (let j = 0; j < sig.length; j++) {
    const v = sig[j];
    if (v > s1) { s2 = s1; s1 = v; i1 = j; } else if (v > s2) s2 = v;
    if (v >= ctx.reqDbm) heard++;
  }
  if (i1 < 0 || !Number.isFinite(s1)) return { best: -Infinity, second: -Infinity, serving: -1, snr: -Infinity, sinr: -Infinity, cci: 0, rate: 0, heard: 0 };
  const me = ctx.info[i1];
  let iMw = 0, cci = 0;
  for (let j = 0; j < sig.length; j++) {
    if (j === i1 || !Number.isFinite(sig[j])) continue;
    const o = overlapFrac(me.span, ctx.info[j].span);
    if (!o) continue;
    iMw += Math.pow(10, sig[j] / 10) * o;
    if (sig[j] >= CCA_DBM) cci++;
  }
  const nMw = Math.pow(10, me.noise / 10);
  const snr = s1 - me.noise;
  const sinr = s1 - 10 * Math.log10(nMw + iMw);
  const rate = phyRate(sinr, ctx.band, me.w, me.std, ctx.clientStd, ctx.ss).mbps;
  return { best: s1, second: s2, serving: i1, snr, sinr, cci, rate, heard };
}

function viewCtx(project, band, aps) {
  const st = project.settings || {};
  return {
    band, info: radioInfo(aps, band), reqDbm: typeof reqDbm === "function" ? reqDbm() : -67,
    clientStd: st.clientStd || "Wi-Fi 6", ss: clientStreams(st),
  };
}
const clientStreams = st => Math.max(1, Math.min(4, +st.clientSS || (st.client === "iot" ? 1 : 2)));

/**
 * Grids for a view: { best (signal heat like computeHeatmap), view: {cols, rows, cell, data}, per }.
 * view "signal" only needs the best signal, so it uses the fast path.
 */
function computeViewGrids(project, band, cellPx, view) {
  if (view === "signal") {
    const best = computeHeatmap(project, band, cellPx);
    return { best, view: best, per: null };
  }
  const g = computeApGrids(project, band, cellPx);
  const n = g.cols * g.rows, data = new Float32Array(n), bestData = new Float32Array(n);
  const serving = new Int16Array(n), rate = new Float32Array(n);
  const ctx = viewCtx(project, band, g.aps);
  const sig = new Float32Array(g.per.length);
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < g.per.length; j++) sig[j] = g.per[j][k];
    const m = cellMetrics(sig, ctx);
    bestData[k] = m.best; serving[k] = m.serving; rate[k] = m.rate;
    data[k] = view === "secondary" ? m.second : view === "apcount" ? m.heard : view === "capacity" ? 0 : m[view];
  }
  const shape = { cols: g.cols, rows: g.rows, cell: g.cell };
  let loads = null;
  if (hasDemand(project)) {
    const aIdx = areaIndexGrid(project, shape);
    loads = capacityLoads(project, shape, serving, rate, aIdx, g.per.length);
    if (view === "capacity") for (let k = 0; k < n; k++) data[k] = serving[k] >= 0 ? loads[serving[k]].airtime * 100 : NaN;
  } else if (view === "capacity") data.fill(0);
  return { best: { ...shape, data: bestData }, view: { ...shape, data }, per: g, serving, rate, loads };
}

// Canvas image of a view. Cells below the display floor (no usable signal) stay transparent.
function viewToCanvas(grids, view, minDbm) {
  const { best, view: vg } = grids;
  const cv = document.createElement("canvas");
  cv.width = vg.cols; cv.height = vg.rows;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(vg.cols, vg.rows);
  const sec = view === "secondary";
  for (let i = 0; i < vg.data.length; i++) {
    const s = sec ? vg.data[i] : best.data[i];
    if (!(s >= minDbm)) continue;
    const [r, g, b] = viewColor(view, vg.data[i]);
    const a = Math.min(1, (s - minDbm) / 5);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = Math.round(255 * a);
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Share of the design area that is "good" in a view and the area average.
function viewStats(grids, view, box, mask, minDbm) {
  const def = VIEW_DEFS[view], vg = grids.view;
  const c0 = Math.max(0, Math.floor(box.x0 / vg.cell)), c1 = Math.min(vg.cols, Math.ceil(box.x1 / vg.cell));
  const r0 = Math.max(0, Math.floor(box.y0 / vg.cell)), r1 = Math.min(vg.rows, Math.ceil(box.y1 / vg.cell));
  let total = 0, good = 0, sum = 0, nSum = 0;
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    const k = r * vg.cols + c;
    if (mask && !mask[k]) continue;
    total++;
    const v = vg.data[k], covered = grids.best.data[k] >= minDbm;
    if (def.goodMax != null ? covered && v <= def.goodMax : v >= def.good) good++;
    if (Number.isFinite(v) && covered) { sum += v; nSum++; }
  }
  return { good: good / (total || 1), avg: nSum ? sum / nSum : NaN };
}

// All metrics at a world point for the signal check panel.
function pointMetrics(project, band, x, y) {
  if (!project.aps.length) return null;
  const { rf, sources, aps } = modelFor(project, band);
  const sig = sources.map(src => sourceRssi(rf, src, x, y));
  const list = aps || project.aps;
  const m = cellMetrics(sig, viewCtx(project, band, list));
  m.servingAp = list[m.serving] || null;
  return m;
}

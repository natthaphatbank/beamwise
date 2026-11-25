// RF model: wall materials, propagation, heatmap and coverage colours.
//
// Prediction = the strongest of the direct path and "dominant paths" that bend around wall
// ends, door edges and corners (a corridor carries signal to rooms down the hall):
//
//   RSSI = EIRP + antenna pattern + client offset − FSPL(1 m) − 10·n·log10(d3D)
//          − Σ wall loss × incidence factor − Σ diffraction loss per turn
//
// d3D includes the AP's mounting height above the client device, so the area under a
// ceiling AP is no longer predicted at an impossible −20 dBm.

// Attenuation per wall crossing at normal incidence, in dB, at 2.4 GHz and 5 GHz.
// Typical published values; calibrate with a site survey for real projects.
// Checked against ITU-R P.2040-3 material parameters (multi-layer slab transmission, typical Thai
// build-ups): drywall, glass, concrete and heavy concrete agree. Plastered brick was lowered from
// 8/12: a 7 cm brick wall with 1.5 cm plaster both sides gives 6.0/7.1 dB, a double brick wall
// 7.4/8.7 dB (an office study, arXiv 1812.00667, measured 5.25 dB per 17 cm plaster wall at 5 GHz).
// AAC is not in P.2040 and wood doors are uncertain, so those stay at the typical values.
// Display names live in i18n.js (mat_<key>).
// db6 (6 GHz) follows the same P.2040 trend a little above 5 GHz.
const MATERIALS = {
  drywall:  { db24: 3,  db5: 4,  db6: 4.5, color: "#9fb4d9" },
  glass:    { db24: 3,  db5: 5,  db6: 5.5, color: "#5fd0e8" },
  lowe:     { db24: 25, db5: 32, db6: 34,  color: "#2fa3b8" },   // low-E / metal-coated glazing
  wood:     { db24: 4,  db5: 6,  db6: 7,   color: "#c79a5b" },
  aac:      { db24: 6,  db5: 9,  db6: 10,  color: "#d9c27a" },
  brick:    { db24: 7,  db5: 9,  db6: 10,  color: "#e0835a" },
  concrete: { db24: 12, db5: 18, db6: 20,  color: "#b0b0b0" },
  concreteHeavy: { db24: 20, db5: 28, db6: 31, color: "#8a8a8a" }, // ≥ 25 cm reinforced / shear wall
  metal:    { db24: 20, db5: 26, db6: 28,  color: "#ff5c8a" },
};
const matLoss = (m, band) => m["db" + BK[band]] ?? m.db5;

// Path-loss exponent beyond the first metre (walls are modelled separately).
const ENVIRONMENTS = [
  { key: "envOpen",   n: 2.0 },
  { key: "envOffice", n: 2.3 },
  { key: "envHome",   n: 2.6 },
  { key: "envDense",  n: 3.0 },
];

const BANDS = {
  "2.4": { mhz: 2437 },
  "5":   { mhz: 5250 },
  "6":   { mhz: 6175 },               // middle of 5925–6425 MHz
};

// How the AP is mounted. Sets the default height (m) and the antenna pattern.
//  ceiling: down-tilted internal antennas, ~3 dB weaker towards the horizon
//  omni: router / wall-plate / desk unit with vertical antennas, null straight below
//  directional: patch / sector antenna aimed along `az` with half-power beamwidth `bw`
const MOUNTS = {
  ceiling:     { h: 2.7 },
  omni:        { h: 1.2 },
  directional: { h: 2.5 },
};
const DEFAULT_BW = 90;

// Receiving device relative to a laptop reference (dB). Phones have small antennas.
const CLIENTS = { laptop: 0, tablet: -3, phone: -5, iot: -8 };
const DEFAULT_CLIENT_H = 1.0;          // m, a phone in hand / laptop on a desk

// Diffraction loss per turn of a dominant path, by turn angle (dB per degree, capped).
const DIFF_DB_PER_DEG = { "2.4": 0.12, "5": 0.15, "6": 0.16 };
const DIFF_MAX_DB = 25;
const NODE_FLOOR_DBM = -100;           // corner nodes weaker than this are not used
const RELEVANT_DBM = -95;              // below every display floor: the heatmap does not refine it

// Default mount for a catalogue model (routers and mesh nodes sit on a shelf).
function mountForModel(spec) {
  const s = `${spec?.id || ""} ${spec?.brand || ""} ${spec?.model || ""}`.toLowerCase();
  if (/outdoor/.test(s)) return { mount: "omni", h: 3 };
  if (/router|onu|mesh|deco|velop|eero|nest|zenwifi|wall-plate|wall plate|in-wall|\biw\b/.test(s)) return { mount: "omni", h: /wall/.test(s) ? 1.2 : 1.0 };
  return { mount: "ceiling", h: MOUNTS.ceiling.h };
}

// Free-space path loss at 1 m: 20log10(f MHz) - 27.55
function fspl1m(mhz) { return 20 * Math.log10(mhz) - 27.55; }

// Effective radiated power of an AP on a band, optionally capped to Thai NBTC limits.
function apEirp(ap, band, capNbtc) {
  const tx = apTx(ap, band);
  if (!(tx > 0)) return -Infinity;                    // Tx 0 = the AP has no radio on this band
  const raw = tx + apGain(ap, band);
  if (!capNbtc) return raw;
  const cap = band === "5" ? (ap.ch5 >= 100 ? NBTC_CAP["5high"] : NBTC_CAP["5"]) : NBTC_CAP[band];
  return Math.min(raw, cap);
}

// Antenna pattern relative to the datasheet (peak) gain, in dB (≤ 0).
// dx, dy: horizontal direction in plan pixels (y down); elevDeg: angle below/above horizontal.
function patternAdj(mount, az, bw, dx, dy, elevDeg) {
  const e = Math.abs(elevDeg);
  if (mount === "omni") return e <= 30 ? 0 : -12 * ((e - 30) / 60) ** 2;
  if (mount === "directional") {
    let a = 0;
    if (dx || dy) {
      let phi = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI - az) % 360;
      if (phi > 180) phi = 360 - phi;
      a = -Math.min(12 * (phi / (bw || DEFAULT_BW)) ** 2, 20);
    }
    return a + (e > 45 ? -10 * (e - 45) / 45 : 0);
  }
  // ceiling
  if (e < 30) return -3 * (1 - e / 30);
  if (e <= 60) return 0;
  return -2 * (e - 60) / 30;
}

// A wall crossed at an angle is thicker along the path: loss × 1/√cos(incidence), at most ×2.
function incidenceFactor(cosInc) { return Math.min(2, 1 / Math.sqrt(Math.max(cosInc, 0.25))); }
// Where does segment p1-p2 cross wall p3-p4? Returns 0 (no crossing), 1 (crosses the wall's
// interior) or 2 (passes exactly through one of the wall's end points). Sets segCross.u to the
// position along p1-p2 so callers can tell when two walls are hit at the same shared corner.
function segCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (d === 0) return 0;
  const u = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const v = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  if (!(u > 0 && u < 1 && v >= 0 && v <= 1)) return 0;
  segCross.u = u;
  return v < 1e-9 || v > 1 - 1e-9 ? 2 : 1;
}
segCross.u = 0;

// ---------- wall geometry (shared by both bands and every AP) ----------

// Uniform grid of wall indices so a ray only tests the walls in the cells it passes.
function wallGrid(W, mpp) {
  if (W.n < 24) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < W.n; i++) { x0 = Math.min(x0, W.minX[i]); y0 = Math.min(y0, W.minY[i]); x1 = Math.max(x1, W.maxX[i]); y1 = Math.max(y1, W.maxY[i]); }
  const cell = Math.max(1.5 / mpp, Math.max(x1 - x0, y1 - y0) / 96, 1);
  x0 -= 1; y0 -= 1;
  const cols = Math.max(1, Math.ceil((x1 - x0 + 1) / cell)), rows = Math.max(1, Math.ceil((y1 - y0 + 1) / cell));
  const lists = Array.from({ length: cols * rows }, () => []);
  for (let i = 0; i < W.n; i++) {
    // cells along the wall (DDA), so long diagonal walls do not fill their whole bounding box
    forCells(x0, y0, cell, cols, rows, W.x1[i], W.y1[i], W.x2[i], W.y2[i], k => { lists[k].push(i); });
  }
  const start = new Int32Array(cols * rows + 1);
  for (let k = 0; k < lists.length; k++) start[k + 1] = start[k] + lists[k].length;
  const idx = new Int32Array(start[cols * rows]);
  for (let k = 0; k < lists.length; k++) idx.set(lists[k], start[k]);
  return { x0, y0, cell, cols, rows, start, idx, stamp: new Uint32Array(W.n), tick: 0 };
}

// Calls fn(cellIndex) for every grid cell segment a-b passes through (clipped to the grid).
// Stops early when fn returns true.
function forCells(gx0, gy0, cell, cols, rows, ax, ay, bx, by, fn) {
  // clip to the grid rectangle (Liang–Barsky)
  const X1 = gx0 + cols * cell, Y1 = gy0 + rows * cell;
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - gx0], [dx, X1 - ax], [-dy, ay - gy0], [dy, Y1 - ay]]) {
    if (p === 0) { if (q < 0) return; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return; if (r > t0) t0 = r; } else { if (r < t0) return; if (r < t1) t1 = r; }
  }
  const sx = ax + dx * t0, sy = ay + dy * t0, ex = ax + dx * t1, ey = ay + dy * t1;
  let c = Math.min(cols - 1, Math.max(0, Math.floor((sx - gx0) / cell)));
  let r = Math.min(rows - 1, Math.max(0, Math.floor((sy - gy0) / cell)));
  const ce = Math.min(cols - 1, Math.max(0, Math.floor((ex - gx0) / cell)));
  const re = Math.min(rows - 1, Math.max(0, Math.floor((ey - gy0) / cell)));
  const stepC = dx > 0 ? 1 : -1, stepR = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(cell / dx) : Infinity, tdy = dy !== 0 ? Math.abs(cell / dy) : Infinity;
  let tmx = dx !== 0 ? ((gx0 + (c + (dx > 0 ? 1 : 0)) * cell) - ax) / dx : Infinity;
  let tmy = dy !== 0 ? ((gy0 + (r + (dy > 0 ? 1 : 0)) * cell) - ay) / dy : Infinity;
  for (let guard = cols + rows + 2; guard > 0; guard--) {
    if (fn(r * cols + c)) return;
    if (c === ce && r === re) return;
    if (tmx < tmy) { c += stepC; tmx += tdx; if (c < 0 || c >= cols) return; }
    else { r += stepR; tmy += tdy; if (r < 0 || r >= rows) return; }
  }
}

// Candidate diffraction points just off wall end points: free wall ends, door jambs (where
// one material meets another in a straight line) and the outside of corners. Inside corners
// of rooms (T, L inner side) are skipped: a path never needs to bend there.
function cornerNodes(project, W) {
  const mpp = project.mPerPx, off = 0.15 / mpp, minGap = off * 0.6;
  const { width: PW, height: PH } = project.plan;
  const ends = new Map();                      // end point -> directions of the walls leaving it
  const key = (x, y) => Math.round(x * 2) + "," + Math.round(y * 2);
  for (let i = 0; i < W.n; i++) {
    const a = Math.atan2(W.y2[i] - W.y1[i], W.x2[i] - W.x1[i]);
    for (const [x, y, ang] of [[W.x1[i], W.y1[i], a], [W.x2[i], W.y2[i], a + Math.PI]]) {
      const k = key(x, y);
      let e = ends.get(k);
      if (!e) ends.set(k, e = { x, y, dirs: [] });
      e.dirs.push(((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    }
  }
  const xs = [], ys = [];
  const bucket = new Map(), bk = (x, y) => Math.floor(x / (minGap * 2)) + "," + Math.floor(y / (minGap * 2));
  const tooClose = (x, y) => {
    const bx = Math.floor(x / (minGap * 2)), by = Math.floor(y / (minGap * 2));
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const l = bucket.get((bx + i) + "," + (by + j));
      if (l) for (const q of l) if (Math.abs(xs[q] - x) < minGap && Math.abs(ys[q] - y) < minGap) return true;
    }
    return false;
  };
  const nearWall = (x, y) => {
    let hit = false;
    const test = i => {
      if (x < W.minX[i] - minGap || x > W.maxX[i] + minGap || y < W.minY[i] - minGap || y > W.maxY[i] + minGap) return false;
      const vx = W.x2[i] - W.x1[i], vy = W.y2[i] - W.y1[i], L2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((x - W.x1[i]) * vx + (y - W.y1[i]) * vy) / L2));
      return (hit = Math.hypot(x - W.x1[i] - t * vx, y - W.y1[i] - t * vy) < minGap);
    };
    const G = W.grid;
    if (!G) { for (let i = 0; i < W.n && !hit; i++) test(i); return hit; }
    const c = Math.floor((x - G.x0) / G.cell), r = Math.floor((y - G.y0) / G.cell);
    for (let rr = r - 1; rr <= r + 1 && !hit; rr++) for (let cc = c - 1; cc <= c + 1 && !hit; cc++) {
      if (rr < 0 || cc < 0 || rr >= G.rows || cc >= G.cols) continue;
      const k = rr * G.cols + cc;
      for (let q = G.start[k]; q < G.start[k + 1] && !hit; q++) test(G.idx[q]);
    }
    return hit;
  };
  for (const e of ends.values()) {
    const dirs = e.dirs.sort((a, b) => a - b);
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      // the free angle (between neighbouring walls) this diagonal points into
      const a = (Math.atan2(sy, sx) + 2 * Math.PI) % (2 * Math.PI);
      let gap = 2 * Math.PI;
      if (dirs.length > 1) {
        let lo = dirs[dirs.length - 1] - 2 * Math.PI, hi = dirs[0];
        for (let i = 0; i < dirs.length; i++) {
          if (a >= dirs[i]) { lo = dirs[i]; hi = i + 1 < dirs.length ? dirs[i + 1] : dirs[0] + 2 * Math.PI; }
        }
        gap = hi - lo;
      }
      if (gap < Math.PI - 0.02) continue;      // inside corner
      const nx = e.x + sx * off, ny = e.y + sy * off;
      if (nx < 0 || ny < 0 || nx > PW || ny > PH || nearWall(nx, ny) || tooClose(nx, ny)) continue;
      const k = bk(nx, ny);
      (bucket.get(k) || bucket.set(k, []).get(k)).push(xs.length);
      xs.push(nx); ys.push(ny);
    }
  }
  return indexNodes({ n: xs.length, x: Float64Array.from(xs), y: Float64Array.from(ys), links: {} },
                    PW * PH * mpp * mpp, mpp);
}

// Link radius R (about 140 neighbours per node, 6–25 m) and a bucket grid of size R, so
// "nodes within R of a point" is a 3 x 3 bucket lookup.
function indexNodes(nd, areaM2, mpp) {
  nd.R = Math.min(25, Math.max(6, Math.sqrt(140 * areaM2 / (Math.PI * Math.max(nd.n, 1))))) / mpp;
  let x1 = 1, y1 = 1;
  for (let k = 0; k < nd.n; k++) { x1 = Math.max(x1, nd.x[k]); y1 = Math.max(y1, nd.y[k]); }
  const cols = Math.ceil((x1 + 1) / nd.R), rows = Math.ceil((y1 + 1) / nd.R);
  const lists = Array.from({ length: cols * rows }, () => []);
  for (let k = 0; k < nd.n; k++) lists[Math.floor(nd.y[k] / nd.R) * cols + Math.floor(nd.x[k] / nd.R)].push(k);
  const start = new Int32Array(cols * rows + 1);
  for (let b = 0; b < lists.length; b++) start[b + 1] = start[b] + lists[b].length;
  const idx = new Int32Array(nd.n);
  for (let b = 0; b < lists.length; b++) idx.set(lists[b], start[b]);
  nd.bk = { cols, rows, start, idx };
  return nd;
}

// Walls, their grid and the corner nodes depend only on the drawing, so every model of the
// same drawing (both bands, calibration fits) shares them.
const _geomCache = new Map();
function wallGeometry(project) {
  // attenuation zones are part of the key: node-to-node links include their loss
  const key = JSON.stringify([project.mPerPx, project.plan.width, project.plan.height, project.walls, project.attens || []]);
  let g = _geomCache.get(key);
  if (g) return g;
  const nw = project.walls.length;
  const W = {
    n: nw,
    x1: new Float64Array(nw), y1: new Float64Array(nw), x2: new Float64Array(nw), y2: new Float64Array(nw),
    minX: new Float64Array(nw), maxX: new Float64Array(nw), minY: new Float64Array(nw), maxY: new Float64Array(nw),
    ux: new Float64Array(nw), uy: new Float64Array(nw), mat: project.walls.map(w => MATERIALS[w.mat] ? w.mat : "brick"),
  };
  project.walls.forEach((w, i) => {
    W.x1[i] = w.x1; W.y1[i] = w.y1; W.x2[i] = w.x2; W.y2[i] = w.y2;
    W.minX[i] = Math.min(w.x1, w.x2); W.maxX[i] = Math.max(w.x1, w.x2);
    W.minY[i] = Math.min(w.y1, w.y2); W.maxY[i] = Math.max(w.y1, w.y2);
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
    W.ux[i] = (w.x2 - w.x1) / L; W.uy[i] = (w.y2 - w.y1) / L;
  });
  W.grid = wallGrid(W, project.mPerPx);
  g = { W, nodes: null, loss: {} };
  g.nodes = nw ? cornerNodes(project, W) : NO_NODES;
  _geomCache.set(key, g);
  while (_geomCache.size > 4) _geomCache.delete(_geomCache.keys().next().value);
  return g;
}

// ---------- attenuation zones ----------
// project.attens = [{id, pts, preset, db24, db5, db6}]: areas that weaken signal per metre
// travelled through them (shelving, racks, crowds, furniture, foliage). Values in dB/m.
const ATTEN_PRESETS = {
  furniture: { db24: 0.3, db5: 0.4, db6: 0.45, color: "#b08968" },
  shelving:  { db24: 0.8, db5: 1.2, db6: 1.4,  color: "#e09f3e" },
  racks:     { db24: 1.5, db5: 2.5, db6: 2.8,  color: "#c75146" },
  crowd:     { db24: 0.5, db5: 0.8, db6: 0.9,  color: "#9d4edd" },
  foliage:   { db24: 0.3, db5: 0.5, db6: 0.55, color: "#52b788" },
  custom:    { db24: 1,   db5: 1.5, db6: 1.7,  color: "#6c757d" },
};
const ATTEN_MAX_DB = 40;              // per zone crossing: beyond this the zone is effectively opaque

// Zones ready for ray tests on one band: bounding box, edges and loss per plan pixel.
function zoneList(project, band) {
  return (project.attens || []).filter(z => z.pts && z.pts.length >= 3).map(z => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of z.pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    const dbm = +z["db" + BK[band]];
    return { pts: z.pts, x0, y0, x1, y1, kPx: (Number.isFinite(dbm) ? Math.max(0, dbm) : 0) * project.mPerPx };
  }).filter(z => z.kPx > 0);
}

// Loss (dB) along segment a-c through the zones: the length inside each polygon × its dB/m.
function zoneLoss(zones, ax, ay, cx, cy) {
  let sum = 0;
  const minX = Math.min(ax, cx), maxX = Math.max(ax, cx), minY = Math.min(ay, cy), maxY = Math.max(ay, cy);
  const len = Math.hypot(cx - ax, cy - ay);
  if (!len) return 0;
  for (const z of zones) {
    if (z.x1 < minX || z.x0 > maxX || z.y1 < minY || z.y0 > maxY) continue;
    const ts = [0, 1], P = z.pts;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const d = (cx - ax) * (P[i].y - P[j].y) - (cy - ay) * (P[i].x - P[j].x);
      if (!d) continue;
      const u = ((P[j].x - ax) * (P[i].y - P[j].y) - (P[j].y - ay) * (P[i].x - P[j].x)) / d;
      const v = ((P[j].x - ax) * (cy - ay) - (P[j].y - ay) * (cx - ax)) / d;
      if (u > 0 && u < 1 && v >= 0 && v <= 1) ts.push(u);
    }
    ts.sort((a, b) => a - b);
    let inside = 0;
    for (let k = 0; k + 1 < ts.length; k++) {
      const tm = (ts[k] + ts[k + 1]) / 2;
      if (ts[k + 1] - ts[k] > 1e-9 && pointInPoly(ax + (cx - ax) * tm, ay + (cy - ay) * tm, P)) inside += ts[k + 1] - ts[k];
    }
    if (inside) sum += Math.min(ATTEN_MAX_DB, inside * len * z.kPx);
  }
  return sum;
}

const NO_NODES = { n: 0, x: new Float64Array(0), y: new Float64Array(0), links: {}, R: 1, bk: null };

// Everything the per-point model needs, prepared once per computation.
function rfContext(project, band, override = null) {
  const st = project.settings || {};
  const env = ENVIRONMENTS[st.env] || ENVIRONMENTS[1];
  const geo = wallGeometry(project);
  const loss = geo.loss[band] || (geo.loss[band] = Float64Array.from(geo.W.mat, m => matLoss(MATERIALS[m], band)));
  // site-survey calibration (survey.js) overrides n and adds a per-band offset
  const cal = project.calib;
  let n = cal && Number.isFinite(cal.n) ? cal.n : env.n;
  let offset = cal ? cal["off" + BK[band]] ?? (band === "6" ? cal.off5 : 0) ?? 0 : 0;
  if (override) { n = override.n; offset = override.offset; }
  const clientH = Number.isFinite(+st.clientH) ? +st.clientH : DEFAULT_CLIENT_H;
  const paths = st.paths !== false;
  return {
    band, n, offset, pl1: fspl1m(BANDS[band].mhz), mpp: project.mPerPx, W: geo.W, loss, cap: !!st.capNbtc,
    clientOff: CLIENTS[st.client] ?? 0, clientH, diffK: DIFF_DB_PER_DEG[band],
    nodes: paths ? geo.nodes : NO_NODES,
    area: project.plan.width * project.plan.height * project.mPerPx ** 2,
    zones: zoneList(project, band),
    srcCache: new Map(),
  };
}

// Wall loss along a straight leg (plan px), incidence-adjusted, plus attenuation zones.
// Stops once it exceeds `budget`.
function wallLoss(rf, ax, ay, cx, cy, budget = Infinity) {
  if (!rf.zones.length) return wallOnlyLoss(rf, ax, ay, cx, cy, budget);
  const z = zoneLoss(rf.zones, ax, ay, cx, cy);
  return z > budget ? z : z + wallOnlyLoss(rf, ax, ay, cx, cy, budget - z);
}
function wallOnlyLoss(rf, ax, ay, cx, cy, budget = Infinity) {
  const W = rf.W, LOSS = rf.loss;
  const len = Math.hypot(cx - ax, cy - ay) || 1, dx = (cx - ax) / len, dy = (cy - ay) / len;
  let sum = 0, corners = null;           // wall end points already crossed (rare)
  const minX = Math.min(ax, cx), maxX = Math.max(ax, cx), minY = Math.min(ay, cy), maxY = Math.max(ay, cy);
  const test = i => {
    if (W.maxX[i] < minX || W.minX[i] > maxX || W.maxY[i] < minY || W.minY[i] > maxY) return false;
    const hit = segCross(ax, ay, cx, cy, W.x1[i], W.y1[i], W.x2[i], W.y2[i]);
    if (!hit) return false;
    let loss = LOSS[i] * incidenceFactor(Math.abs(dx * W.uy[i] - dy * W.ux[i]));
    if (hit === 2) {
      // Through a corner shared by several walls: one wall is crossed, not each of them.
      // Count the corner once, with the strongest material meeting there.
      corners = corners || [];
      const c = corners.find(k => Math.abs(k.u - segCross.u) < 1e-7);
      if (c) { const extra = Math.max(0, loss - c.loss); c.loss += extra; loss = extra; }
      else corners.push({ u: segCross.u, loss });
    }
    sum += loss;
    return sum > budget;
  };
  const G = W.grid;
  if (!G) { for (let i = 0; i < W.n; i++) if (test(i)) break; return sum; }
  if (++G.tick > 4e9) { G.stamp.fill(0); G.tick = 1; }
  const tick = G.tick, stamp = G.stamp, start = G.start, idx = G.idx;
  forCells(G.x0, G.y0, G.cell, G.cols, G.rows, ax, ay, cx, cy, k => {
    for (let q = start[k]; q < start[k + 1]; q++) {
      const i = idx[q];
      if (stamp[i] === tick) continue;
      stamp[i] = tick;
      if (test(i)) return true;
    }
    return false;
  });
  return sum;
}

// Node-to-node links (distance and wall loss), computed once per drawing and band.
// Only nearby pairs that are not behind heavy walls are linked: other paths are never dominant.
const LINK_MAX_LOSS = 30;
function nodeLinks(rf) {
  const nd = rf.nodes;
  if (nd.links[rf.band]) return nd.links[rf.band];
  const N = nd.n, mpp = rf.mpp, R = nd.R, B = nd.bk;
  const lists = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) {
    const bx = Math.floor(nd.x[i] / R), by = Math.floor(nd.y[i] / R);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const c = bx + a, r = by + b;
      if (c < 0 || r < 0 || c >= B.cols || r >= B.rows) continue;
      for (let q = B.start[r * B.cols + c]; q < B.start[r * B.cols + c + 1]; q++) {
        const j = B.idx[q];
        if (j <= i) continue;
        const d = Math.hypot(nd.x[j] - nd.x[i], nd.y[j] - nd.y[i]);
        if (d > R || d < 1e-6) continue;
        const wl = wallLoss(rf, nd.x[i], nd.y[i], nd.x[j], nd.y[j], LINK_MAX_LOSS);
        if (wl > LINK_MAX_LOSS) continue;
        lists[i].push(j, d * mpp, wl); lists[j].push(i, d * mpp, wl);
      }
    }
  }
  const start = new Int32Array(N + 1);
  for (let k = 0; k < N; k++) start[k + 1] = start[k] + lists[k].length / 3;
  const to = new Int32Array(start[N]), dist = new Float32Array(start[N]), loss = new Float32Array(start[N]);
  for (let k = 0; k < N; k++) {
    const l = lists[k];
    for (let q = 0; q < l.length; q += 3) { const p = start[k] + q / 3; to[p] = l[q]; dist[p] = l[q + 1]; loss[p] = l[q + 2]; }
  }
  return (nd.links[rf.band] = { start, to, dist, loss });
}

/**
 * A transmitter ready for fast queries: AP data plus the best path to every corner node
 * (Dijkstra over node-to-node links, so paths can turn several times).
 * `ap` needs x, y, tx/gain fields and optionally mount, h, az, bw.
 */
function buildSource(rf, ap) {
  const e = apEirp(ap, rf.band, rf.cap);
  const mount = MOUNTS[ap.mount] ? ap.mount : "ceiling";
  const h = ap.h !== null && ap.h !== "" && Number.isFinite(+ap.h) ? +ap.h : MOUNTS[mount].h;
  const src = {
    x: ap.x, y: ap.y, dead: !Number.isFinite(e),
    eff: e + (rf.offset || 0) + rf.clientOff,     // everything that does not depend on the path
    dh: Math.abs(h - rf.clientH), mount, az: +ap.az || 0, bw: +ap.bw || DEFAULT_BW,
    order: [],
  };
  const N = rf.nodes.n;
  if (src.dead || !N) return src;
  const nx = rf.nodes.x, ny = rf.nodes.y, mpp = rf.mpp, n10 = 10 * rf.n, base = src.eff - rf.pl1;
  const L = new Float64Array(N), A = new Float64Array(N), ux = new Float64Array(N), uy = new Float64Array(N);
  const val = new Float64Array(N).fill(-Infinity), done = new Uint8Array(N);
  const pl = Lh => n10 * Math.log10(Math.max(0.5, Math.hypot(Lh, src.dh)));
  for (let k = 0; k < N; k++) {
    const dx = nx[k] - ap.x, dy = ny[k] - ap.y, dp = Math.hypot(dx, dy) || 1e-9, dm = dp * mpp;
    const pat = patternAdj(mount, src.az, src.bw, dx, dy, Math.atan2(src.dh, dm) * 180 / Math.PI);
    const v0 = base - pl(dm) + pat;
    if (v0 <= NODE_FLOOR_DBM) continue;
    const wl = wallLoss(rf, ap.x, ap.y, nx[k], ny[k], v0 - NODE_FLOOR_DBM);
    if (v0 - wl <= NODE_FLOOR_DBM) continue;
    L[k] = dm; A[k] = wl - pat; ux[k] = dx / dp; uy[k] = dy / dp; val[k] = v0 - wl;
  }
  const lk = nodeLinks(rf);
  // binary max-heap of [value, node]
  const hv = [], hn = [];
  const push = (v, k) => {
    let i = hv.length; hv.push(v); hn.push(k);
    while (i > 0) { const p = (i - 1) >> 1; if (hv[p] >= v) break; hv[i] = hv[p]; hn[i] = hn[p]; i = p; }
    hv[i] = v; hn[i] = k;
  };
  const pop = () => {
    const k = hn[0], v = hv.pop(), m = hn.pop(), n = hv.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && hv[c + 1] > hv[c]) c++;
        if (hv[c] <= v) break;
        hv[i] = hv[c]; hn[i] = hn[c]; i = c;
      }
      hv[i] = v; hn[i] = m;
    }
    return k;
  };
  for (let k = 0; k < N; k++) if (val[k] > NODE_FLOOR_DBM) push(val[k], k);
  while (hv.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    for (let q = lk.start[i]; q < lk.start[i + 1]; q++) {
      const j = lk.to[q];
      if (done[j]) continue;
      const dp = lk.dist[q] / mpp, dx = nx[j] - nx[i], dy = ny[j] - ny[i];
      const cos = Math.max(-1, Math.min(1, (ux[i] * dx + uy[i] * dy) / dp));
      const Aj = A[i] + Math.min(DIFF_MAX_DB, rf.diffK * Math.acos(cos) * 180 / Math.PI) + lk.loss[q];
      const Lj = L[i] + lk.dist[q];
      const v = base - pl(Lj) - Aj;
      if (v <= val[j] || v <= NODE_FLOOR_DBM) continue;
      L[j] = Lj; A[j] = Aj; ux[j] = dx / dp; uy[j] = dy / dp; val[j] = v;
      push(v, j);
    }
  }
  const order = [];
  for (let k = 0; k < N; k++) if (val[k] > NODE_FLOOR_DBM) order.push(k);
  order.sort((a, b) => val[b] - val[a]);
  // G: the longest total path at which node k could still beat a given level (pruning)
  const G = new Float64Array(N);
  for (const k of order) G[k] = Math.pow(10, (base - A[k]) / n10);
  Object.assign(src, { order, L, A, ux, uy, G, val });
  return src;
}

// RSSI (dBm) at world point (cx, cy) from a prepared source. Paths that cannot beat `floor`
// are skipped, so pass the best value known so far when taking a maximum over APs.
function sourceRssi(rf, src, cx, cy, floor = -Infinity) {
  if (src.dead) return -Infinity;
  const mpp = rf.mpp, n10 = 10 * rf.n;
  const dx = cx - src.x, dy = cy - src.y, dm = Math.hypot(dx, dy) * mpp;
  const pat = patternAdj(src.mount, src.az, src.bw, dx, dy, Math.atan2(src.dh, dm) * 180 / Math.PI);
  let best = src.eff - rf.pl1 - n10 * Math.log10(Math.max(0.5, Math.hypot(dm, src.dh))) + pat;
  if (best > floor) best -= wallLoss(rf, src.x, src.y, cx, cy, best - floor);
  sourceRssi.win = sourceRssi.win2 = -1;
  if (!src.order.length) return best;
  // Candidate last nodes: the winners around this point (hint grid), else every node within R.
  const order = _cand;
  _cand.length = 0;
  const hint = src.hint;
  const hc = hint ? Math.floor(cx / hint.cell) : -1, hr = hint ? Math.floor(cy / hint.cell) : -1;
  if (hint && hc >= 0 && hr >= 0 && hc < hint.cols && hr < hint.rows) {
    for (let r = Math.max(0, hr - 1); r <= Math.min(hint.rows - 1, hr + 1); r++)
      for (let c = Math.max(0, hc - 1); c <= Math.min(hint.cols - 1, hc + 1); c++)
        for (let q = 0; q < 2; q++) {
          const w = hint.win[(r * hint.cols + c) * 2 + q];
          if (w >= 0 && !_cand.includes(w)) _cand.push(w);
        }
  } else {
    const nd = rf.nodes, B = nd.bk, R = nd.R;
    const bx = Math.floor(cx / R), by = Math.floor(cy / R);
    for (let r = Math.max(0, by - 1); r <= Math.min(B.rows - 1, by + 1); r++)
      for (let c = Math.max(0, bx - 1); c <= Math.min(B.cols - 1, bx + 1); c++)
        for (let q = B.start[r * B.cols + c]; q < B.start[r * B.cols + c + 1]; q++) {
          const k = B.idx[q];
          if (src.val[k] > NODE_FLOOR_DBM && Math.abs(nd.x[k] - cx) <= R && Math.abs(nd.y[k] - cy) <= R) _cand.push(k);
        }
  }
  if (!order.length) return best;
  const nx = rf.nodes.x, ny = rf.nodes.y, L = src.L, A = src.A, G = src.G, VAL = src.val;
  let bound = Math.max(best, floor);
  let K = Math.pow(10, -bound / n10);
  const base = src.eff - rf.pl1;
  for (let o = 0; o < order.length; o++) {
    const k = order[o];
    // a path via node k is never stronger than the signal at node k itself
    if (VAL[k] <= bound) continue;
    const maxL = G[k] * K - L[k];                  // longest last leg (m) that could still win
    if (maxL <= 0) continue;
    const ex = cx - nx[k], ey = cy - ny[k];
    const lim = maxL / mpp;
    if (ex > lim || ex < -lim || ey > lim || ey < -lim) continue;
    const dp = Math.hypot(ex, ey), d2 = dp * mpp;
    if (d2 >= maxL) continue;
    const cos = dp > 1e-9 ? Math.max(-1, Math.min(1, (src.ux[k] * ex + src.uy[k] * ey) / dp)) : 1;
    let v = base - n10 * Math.log10(Math.max(0.5, Math.hypot(L[k] + d2, src.dh))) - A[k]
            - Math.min(DIFF_MAX_DB, rf.diffK * Math.acos(cos) * 180 / Math.PI);
    if (v <= bound) continue;
    v -= wallLoss(rf, nx[k], ny[k], cx, cy, v - bound);
    if (v > bound) { bound = best = v; K = Math.pow(10, -bound / n10); sourceRssi.win2 = sourceRssi.win; sourceRssi.win = k; }
  }
  return best;
}
sourceRssi.win = sourceRssi.win2 = -1;
const _cand = [];

// Coarse grid remembering which corner nodes give each area its best indirect path, so a
// fine-grid query only tries the winners around it instead of every node.
function ensureHint(rf, src, plan, cellPx) {
  if (src.dead || !src.order.length) return;
  if (src.hint && src.hint.cell <= cellPx * 1.001) return;
  const cols = Math.ceil(plan.width / cellPx), rows = Math.ceil(plan.height / cellPx);
  const win = new Int32Array(cols * rows * 2).fill(-1);   // best and runner-up node per cell
  src.hint = null;                                  // full search while building
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    sourceRssi(rf, src, (c + 0.5) * cellPx, (r + 0.5) * cellPx, RELEVANT_DBM);
    win[(r * cols + c) * 2] = sourceRssi.win; win[(r * cols + c) * 2 + 1] = sourceRssi.win2;
  }
  src.hint = { cell: cellPx, cols, rows, win };
}
// Hint grid size: about 0.5 m, coarser for big plans or a coarse heatmap.
function hintCellPx(project, cellPx) {
  return Math.max(0.5 / project.mPerPx, Math.max(project.plan.width, project.plan.height) / 160, cellPx * 3);
}

// Prepared model for a project and band. The model is cached while the drawing and settings
// stay the same, and each AP's source while that AP stays the same (dragging one AP only
// recomputes that one).
const _modelCache = new Map();
function modelFor(project, band, override = null) {
  const st = project.settings || {};
  const key = JSON.stringify([band, override, project.mPerPx, project.calib, project.walls, project.attens,
    st.env, st.capNbtc, st.client, st.clientH, st.paths, project.plan.width, project.plan.height]);
  let rf = _modelCache.get(key);
  if (rf) { _modelCache.delete(key); _modelCache.set(key, rf); }
  else {
    rf = rfContext(project, band, override);
    _modelCache.set(key, rf);
    while (_modelCache.size > 8) _modelCache.delete(_modelCache.keys().next().value);
  }
  const used = new Map();
  const sources = project.aps.map(ap => {
    const k = JSON.stringify([ap.x, ap.y, apTx(ap, band), apGain(ap, band), ap.ch5, ap.mount, ap.h, ap.az, ap.bw]);
    const s = used.get(k) || rf.srcCache.get(k) || buildSource(rf, ap);
    used.set(k, s);
    return s;
  });
  rf.srcCache = used;                               // forget APs that moved away
  return { rf, sources };
}

/**
 * Best-server RSSI grid.
 * Returns { cols, rows, cell, data: Float32Array (dBm, -Infinity = no AP) }.
 */
function computeHeatmap(project, band, cellPx) {
  const { width: W, height: H } = project.plan;
  const cols = Math.ceil(W / cellPx), rows = Math.ceil(H / cellPx);
  const data = new Float32Array(cols * rows).fill(-Infinity);
  if (!project.aps.length) return { cols, rows, cell: cellPx, data };
  const { rf, sources } = modelFor(project, band);
  const hpx = hintCellPx(project, cellPx);
  for (const src of sources) {
    if (src.dead) continue;
    ensureHint(rf, src, project.plan, hpx);
    for (let r = 0; r < rows; r++) {
      const cy = (r + 0.5) * cellPx;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const v = sourceRssi(rf, src, (c + 0.5) * cellPx, cy, Math.max(data[idx], RELEVANT_DBM));
        if (v > data[idx]) data[idx] = v;
      }
    }
  }
  return { cols, rows, cell: cellPx, data };
}


// ---------- coverage boundary (user-drawn polygons) ----------
// project.areas = [{id, pts: [{x, y}, ...]}]. When present, only the inside counts:
// the heatmap is clipped to it and coverage / AI placement ignore everything outside.
const projectAreas = project => (project.areas || []).filter(a => a.pts && a.pts.length >= 3);

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function inAreas(project, x, y) {
  const areas = projectAreas(project);
  return !areas.length || areas.some(a => pointInPoly(x, y, a.pts));
}
function polyArea(pts) {           // signed, in px²
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  return s / 2;
}
// Total boundary area in px² (overlaps measured on a grid), or null without a boundary.
function areasPx2(project) {
  const areas = projectAreas(project);
  if (!areas.length) return null;
  if (areas.length === 1) return Math.abs(polyArea(areas[0].pts));
  const b = buildingBox(project), cell = Math.max(1, Math.sqrt((b.x1 - b.x0) * (b.y1 - b.y0) / 40000));
  let n = 0;
  for (let y = b.y0 + cell / 2; y < b.y1; y += cell) for (let x = b.x0 + cell / 2; x < b.x1; x += cell) if (inAreas(project, x, y)) n++;
  return n * cell * cell;
}
// 1 = heat cell centre inside the boundary. null when there is no boundary.
function areaMask(project, heat) {
  if (!projectAreas(project).length) return null;
  const m = new Uint8Array(heat.cols * heat.rows);
  for (let r = 0; r < heat.rows; r++) for (let c = 0; c < heat.cols; c++)
    m[r * heat.cols + c] = inAreas(project, (c + 0.5) * heat.cell, (r + 0.5) * heat.cell) ? 1 : 0;
  return m;
}

// The area that needs coverage: the drawn boundary, else the bounding box of the walls, else the whole plan.
function buildingBox(project) {
  const areas = projectAreas(project);
  const full = { x0: 0, y0: 0, x1: project.plan.width, y1: project.plan.height };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  if (areas.length) {
    for (const a of areas) for (const p of a.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    return { x0, y0, x1, y1 };
  }
  if (!project.walls.length) return full;
  for (const w of project.walls) {
    x0 = Math.min(x0, w.x1, w.x2); x1 = Math.max(x1, w.x1, w.x2);
    y0 = Math.min(y0, w.y1, w.y2); y1 = Math.max(y1, w.y1, w.y2);
  }
  if (x1 - x0 < 10 || y1 - y0 < 10) return full;
  return { x0, y0, x1, y1 };
}

// Signal colour scale (dBm -> rgb). Below minDbm is transparent.
const SIGNAL_STOPS = [
  { db: -55, rgb: [0, 200, 120],  key: "sGood",  label: "≥ -55" },
  { db: -60, rgb: [70, 210, 80],  key: "sGood2", label: "-60" },
  { db: -67, rgb: [190, 220, 50], key: "sOk",    label: "-67" },
  { db: -75, rgb: [250, 170, 40], key: "sWeak",  label: "-75" },
  { db: -85, rgb: [230, 60, 60],  key: "sBad",   label: "-85" },
];

function signalColor(db) {
  const s = SIGNAL_STOPS;
  if (db >= s[0].db) return s[0].rgb;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1];
    if (db >= b.db) {
      const k = (a.db - db) / (a.db - b.db);
      return [0, 1, 2].map(j => Math.round(a.rgb[j] + (b.rgb[j] - a.rgb[j]) * k));
    }
  }
  return s[s.length - 1].rgb;
}

function heatmapToCanvas(heat, minDbm) {
  const cv = document.createElement("canvas");
  cv.width = heat.cols; cv.height = heat.rows;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(heat.cols, heat.rows);
  for (let i = 0; i < heat.data.length; i++) {
    const db = heat.data[i];
    if (db < minDbm) continue;
    const [r, g, b] = signalColor(db);
    // fade out over the last 5 dB above the threshold for a soft edge
    const a = Math.min(1, (db - minDbm) / 5);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = Math.round(255 * a);
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Share of the building area meeting the requirement / above the display floor.
// `mask` (optional, from areaMask) limits the count to the drawn boundary. `reqDbm` is a number
// or a per-cell array (areas with their own requirement, see reqGrid in views.js).
function coverageStats(heat, minDbm, reqDbm, box, mask = null) {
  const reqArr = typeof reqDbm === "number" ? null : reqDbm;
  const c0 = Math.max(0, Math.floor(box.x0 / heat.cell)), c1 = Math.min(heat.cols, Math.ceil(box.x1 / heat.cell));
  const r0 = Math.max(0, Math.floor(box.y0 / heat.cell)), r1 = Math.min(heat.rows, Math.ceil(box.y1 / heat.cell));
  let total = 0, meet = 0, none = 0;
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const k = r * heat.cols + c;
      if (mask && !mask[k]) continue;
      const db = heat.data[k];
      total++;
      if (db >= (reqArr ? reqArr[k] : reqDbm)) meet++;
      if (db < minDbm) none++;
    }
  }
  total = total || 1;
  return { meet: meet / total, none: none / total };
}

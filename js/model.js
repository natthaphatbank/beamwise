// RF model: wall materials, path loss, heatmap and coverage colours.

// Attenuation per wall crossing, in dB, at 2.4 GHz and 5 GHz.
// Typical published values; calibrate with a site survey for real projects.
// Display names live in i18n.js (mat_<key>).
const MATERIALS = {
  drywall:  { db24: 3,  db5: 4,  color: "#9fb4d9" },
  glass:    { db24: 3,  db5: 5,  color: "#5fd0e8" },
  wood:     { db24: 4,  db5: 6,  color: "#c79a5b" },
  aac:      { db24: 6,  db5: 9,  color: "#d9c27a" },
  brick:    { db24: 8,  db5: 12, color: "#e0835a" },
  concrete: { db24: 12, db5: 18, color: "#b0b0b0" },
  metal:    { db24: 20, db5: 26, color: "#ff5c8a" },
};

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
};

// Free-space path loss at 1 m: 20log10(f MHz) - 27.55
function fspl1m(mhz) { return 20 * Math.log10(mhz) - 27.55; }

// Effective radiated power of an AP on a band, optionally capped to Thai NBTC limits.
function apEirp(ap, band, capNbtc) {
  const tx = band === "2.4" ? ap.tx24 : ap.tx5;
  if (!(tx > 0)) return -Infinity;                    // Tx 0 = the AP has no radio on this band
  const raw = band === "2.4" ? ap.tx24 + ap.gain24 : ap.tx5 + ap.gain5;
  if (!capNbtc) return raw;
  const cap = band === "2.4" ? NBTC_CAP["2.4"] : (ap.ch5 >= 100 ? NBTC_CAP["5high"] : NBTC_CAP["5"]);
  return Math.min(raw, cap);
}

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

// Everything the per-point model needs, prepared once per computation.
function rfContext(project, band) {
  const env = ENVIRONMENTS[project.settings.env] || ENVIRONMENTS[1];
  const lossKey = band === "2.4" ? "db24" : "db5";
  const nw = project.walls.length;
  const W = {
    n: nw,
    x1: new Float64Array(nw), y1: new Float64Array(nw), x2: new Float64Array(nw), y2: new Float64Array(nw),
    minX: new Float64Array(nw), maxX: new Float64Array(nw), minY: new Float64Array(nw), maxY: new Float64Array(nw),
    loss: new Float64Array(nw),
  };
  project.walls.forEach((w, i) => {
    W.x1[i] = w.x1; W.y1[i] = w.y1; W.x2[i] = w.x2; W.y2[i] = w.y2;
    W.minX[i] = Math.min(w.x1, w.x2); W.maxX[i] = Math.max(w.x1, w.x2);
    W.minY[i] = Math.min(w.y1, w.y2); W.maxY[i] = Math.max(w.y1, w.y2);
    W.loss[i] = (MATERIALS[w.mat] || MATERIALS.brick)[lossKey];
  });
  // site-survey calibration (survey.js) overrides n and adds a per-band offset
  const cal = project.calib;
  const n = cal && Number.isFinite(cal.n) ? cal.n : env.n;
  const offset = cal ? (band === "2.4" ? cal.off24 : cal.off5) || 0 : 0;
  return { band, n, offset, pl1: fspl1m(BANDS[band].mhz), mpp: project.mPerPx, W, cap: !!project.settings.capNbtc };
}

// RSSI (dBm) at world point (cx, cy) from a transmitter at (ax, ay) with the given EIRP.
// `floor` lets callers stop counting walls once the result can no longer matter.
function rssiAt(rf, eirp, ax, ay, cx, cy, floor = -Infinity) {
  const dm = Math.max(Math.hypot(cx - ax, cy - ay) * rf.mpp, 0.5);
  let rssi = eirp + (rf.offset || 0) - rf.pl1 - 10 * rf.n * Math.log10(dm);
  if (rssi <= floor) return rssi;
  const W = rf.W;
  let corners = null;              // wall end points already crossed (rare)
  const minX = Math.min(ax, cx), maxX = Math.max(ax, cx), minY = Math.min(ay, cy), maxY = Math.max(ay, cy);
  for (let i = 0; i < W.n; i++) {
    if (W.maxX[i] < minX || W.minX[i] > maxX || W.maxY[i] < minY || W.minY[i] > maxY) continue;
    const hit = segCross(ax, ay, cx, cy, W.x1[i], W.y1[i], W.x2[i], W.y2[i]);
    if (!hit) continue;
    let loss = W.loss[i];
    if (hit === 2) {
      // Through a corner shared by several walls: one wall is crossed, not each of them.
      // Count the corner once, with the strongest material meeting there.
      corners = corners || [];
      const c = corners.find(k => Math.abs(k.u - segCross.u) < 1e-7);
      if (c) { const extra = Math.max(0, loss - c.loss); c.loss += extra; loss = extra; }
      else corners.push({ u: segCross.u, loss });
    }
    rssi -= loss;
    if (rssi <= floor) return rssi;
  }
  return rssi;
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
  const rf = rfContext(project, band);
  for (const ap of project.aps) {
    const eirp = apEirp(ap, band, rf.cap);
    for (let r = 0; r < rows; r++) {
      const cy = (r + 0.5) * cellPx;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const v = rssiAt(rf, eirp, ap.x, ap.y, (c + 0.5) * cellPx, cy, data[idx]);
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
// `mask` (optional, from areaMask) limits the count to the drawn boundary.
function coverageStats(heat, minDbm, reqDbm, box, mask = null) {
  const c0 = Math.max(0, Math.floor(box.x0 / heat.cell)), c1 = Math.min(heat.cols, Math.ceil(box.x1 / heat.cell));
  const r0 = Math.max(0, Math.floor(box.y0 / heat.cell)), r1 = Math.min(heat.rows, Math.ceil(box.y1 / heat.cell));
  let total = 0, meet = 0, none = 0;
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const k = r * heat.cols + c;
      if (mask && !mask[k]) continue;
      const db = heat.data[k];
      total++;
      if (db >= reqDbm) meet++;
      if (db < minDbm) none++;
    }
  }
  total = total || 1;
  return { meet: meet / total, none: none / total };
}

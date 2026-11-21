// WiFi Planner TH — main app: state, canvas rendering, tools, files.

const $ = sel => document.querySelector(sel);
const canvas = $("#canvas");
const ctx = canvas.getContext("2d");

// ---------- state ----------
function newProject() {
  return {
    version: 1,
    plan: { image: null, width: 1200, height: 800 },
    mPerPx: 30 / 1200,            // blank plan = 30 x 20 m
    scaleSet: false,
    walls: [],                     // {id, x1, y1, x2, y2, mat}
    aps: [],                       // {id, name, x, y, model, tx24, tx5, gain24, gain5, ch24, ch5}
    areas: [],                     // coverage boundary polygons {id, pts: [{x, y}]}
    settings: {
      band: "5", env: 1, opacity: 0.55,
      minDbm: "auto",              // display floor: "auto" = requirement - 15 dB
      req: "auto",                 // required RSSI: "auto" = by building type
      capNbtc: true,
      waves: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    },
    newWallMat: "brick",
    newApModel: "generic-ax",
  };
}

// Required RSSI and heatmap display floor (both can be automatic).
function reqDbm() {
  const st = project.settings;
  return st.req === "auto" ? (REQ_AUTO_BY_ENV[st.env] ?? -67) : +st.req;
}
function effMinDbm() {
  const st = project.settings;
  return st.minDbm === "auto" ? reqDbm() - 15 : +st.minDbm;
}

// Older projects stored a single `gain`; give every AP per-band gain and a model id.
function normalizeAp(ap) {
  if (ap.gain24 == null) ap.gain24 = ap.gain ?? 3;
  if (ap.gain5 == null) ap.gain5 = ap.gain ?? 3;
  delete ap.gain;
  if (!ap.model) ap.model = "custom";
  return ap;
}
function makeAp(p, spec) {
  spec = spec || AP_BY_ID[project.newApModel] || AP_BY_ID["generic-ax"];
  return { id: uid(), name: "AP-" + (project.aps.length + 1), x: p.x, y: p.y,
           model: spec.id, tx24: spec.tx24, tx5: spec.tx5, gain24: spec.gain24, gain5: spec.gain5, ch24: null, ch5: null };
}

let project = newProject();
let planImg = null;                // HTMLImageElement of plan.image
let view = { s: 1, ox: 0, oy: 0 };
let tool = "select";
let selection = null;              // {type: 'ap'|'wall', id}
let drag = null;
let wallChain = null;              // {x, y} start of next wall segment
let scaleLine = null;              // {a:{x,y}, b:{x,y}|null}
let areaDraft = null;              // [{x,y}] points of the boundary being drawn
let heatMask = null;               // Uint8Array from areaMask(), null = no boundary
let cursor = null;                 // world coords
let spaceDown = false;
let undoStack = [], redoStack = [];
let heat = null, heatCanvas = null, heatDirty = true, heatCoarse = false;
let needsRender = true;
let nextId = 1;

const uid = () => (nextId++).toString(36) + Date.now().toString(36).slice(-4);

// ---------- history ----------
function snapshot() {
  return JSON.stringify({ walls: project.walls, aps: project.aps, areas: project.areas, mPerPx: project.mPerPx, scaleSet: project.scaleSet });
}
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
}
function restore(snap) {
  Object.assign(project, JSON.parse(snap));
  project.aps.forEach(normalizeAp);
  if (selection && !findSel()) selection = null;
  changed();
}
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); }

function findSel() {
  if (!selection) return null;
  const list = selection.type === "ap" ? project.aps : selection.type === "area" ? project.areas : project.walls;
  return list.find(o => o.id === selection.id) || null;
}

// Call after any change that affects coverage.
function changed({ coarse = false, panel = true } = {}) {
  heatDirty = true; heatCoarse = coarse;
  if (panel) renderPanel();
  renderStats();
  requestRender();
  scheduleAutosave();
}

// ---------- coordinates ----------
function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s };
}
function fit() {
  const r = canvas.getBoundingClientRect();
  const { width: W, height: H } = project.plan;
  view.s = Math.min(r.width / W, r.height / H) * 0.92;
  view.ox = (r.width - W * view.s) / 2;
  view.oy = (r.height - H * view.s) / 2;
  requestRender();
}
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  requestRender();
}

// ---------- heatmap ----------
function updateHeat() {
  const { width: W, height: H } = project.plan;
  const target = heatCoarse ? 110 : 340;
  const cell = Math.max(2, Math.max(W, H) / target);
  heat = computeHeatmap(project, project.settings.band, cell);
  heatCanvas = heatmapToCanvas(heat, effMinDbm());
  heatMask = areaMask(project, heat);
  heatDirty = false;
  renderStats();
}

// ---------- drawing ----------
function requestRender() {
  if (needsRender === "queued") return;
  needsRender = "queued";
  requestAnimationFrame(() => {
    needsRender = false;
    if (heatDirty) updateHeat();
    draw();
    if (wavesActive()) requestRender();
  });
}
const wavesActive = () => project.settings.waves && project.aps.length > 0 && !document.hidden;
document.addEventListener("visibilitychange", () => { if (!document.hidden) requestRender(); });

// Animated broadcast rings. Each ring segment is coloured by the real predicted signal
// at that point (walls included) and fades out where the signal drops below the floor.
const WAVE_SPEED_M = 7, WAVE_RINGS = 3, WAVE_SEGS = 72;
function drawWaves(c, px) {
  const band = project.settings.band;
  const rf = rfContext(project, band);
  const floor = effMinDbm();
  const now = performance.now() / 1000;
  const { width: W, height: H } = project.plan;
  c.save();
  c.beginPath(); c.rect(0, 0, W, H); c.clip();      // keep waves on the plan
  if (clipToAreas(c)) c.clip();                     // ...and inside the coverage boundary
  c.lineWidth = 2.4 * px; c.lineCap = "round";
  project.aps.forEach((ap, idx) => {
    const eirp = apEirp(ap, band, rf.cap);
    const rMax = Math.max(Math.hypot(ap.x, ap.y), Math.hypot(W - ap.x, ap.y), Math.hypot(ap.x, H - ap.y), Math.hypot(W - ap.x, H - ap.y));
    const period = Math.max(1.5, rMax * rf.mpp / WAVE_SPEED_M);
    for (let k = 0; k < WAVE_RINGS; k++) {
      const phase = (now / period + k / WAVE_RINGS + idx * 0.37) % 1;
      const r = phase * rMax;
      if (r < 14 * px) continue;
      const fade = Math.pow(1 - phase, 1.3);
      let px0 = ap.x + r, py0 = ap.y;
      for (let sgm = 1; sgm <= WAVE_SEGS; sgm++) {
        const a = (sgm / WAVE_SEGS) * Math.PI * 2;
        const px1 = ap.x + Math.cos(a) * r, py1 = ap.y + Math.sin(a) * r;
        const db = rssiAt(rf, eirp, ap.x, ap.y, (px0 + px1) / 2, (py0 + py1) / 2, floor - 1);
        const vis = Math.max(0, Math.min(1, (db - floor) / 8));
        if (vis > 0.02) {
          const [R, G, B] = signalColor(db);
          c.strokeStyle = `rgba(${R},${G},${B},${(0.9 * fade * vis).toFixed(3)})`;
          c.beginPath(); c.moveTo(px0, py0); c.lineTo(px1, py1); c.stroke();
        }
        px0 = px1; py0 = py1;
      }
    }
  });
  c.restore();
}

// Draws the scene into any context. px = size of one screen pixel in world units.
function drawScene(c, px, { interactive = true } = {}) {
  const { width: W, height: H } = project.plan;

  // plan
  if (planImg) {
    c.drawImage(planImg, 0, 0, W, H);
  } else {
    c.fillStyle = "#10162a";
    c.fillRect(0, 0, W, H);
    const step = 1 / project.mPerPx;              // 1 m grid
    c.strokeStyle = "rgba(120,140,200,0.10)";
    c.lineWidth = px;
    c.beginPath();
    for (let x = 0; x <= W; x += step) { c.moveTo(x, 0); c.lineTo(x, H); }
    for (let y = 0; y <= H; y += step) { c.moveTo(0, y); c.lineTo(W, y); }
    c.stroke();
    c.strokeStyle = "rgba(120,140,200,0.35)";
    c.strokeRect(0, 0, W, H);
  }

  // heatmap
  if (heatCanvas && heat) {
    c.save();
    if (clipToAreas(c)) c.clip();
    c.globalAlpha = project.settings.opacity;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(heatCanvas, 0, 0, heat.cols * heat.cell, heat.rows * heat.cell);
    c.restore();
  }

  // walls
  c.lineCap = "round";
  for (const w of project.walls) {
    const m = MATERIALS[w.mat] || MATERIALS.brick;
    const isSel = interactive && selection?.type === "wall" && selection.id === w.id;
    if (isSel) {
      c.strokeStyle = "#ffffff"; c.lineWidth = 8 * px;
      c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
    }
    c.strokeStyle = m.color; c.lineWidth = 4 * px;
    c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
    if (isSel) {
      c.fillStyle = "#fff";
      for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) { c.beginPath(); c.arc(x, y, 5 * px, 0, 7); c.fill(); }
    }
  }

  // coverage boundary
  for (const a of projectAreas(project)) {
    const isSel = interactive && selection?.type === "area" && selection.id === a.id;
    c.beginPath();
    a.pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
    c.closePath();
    c.strokeStyle = isSel ? "#ffffff" : AREA_COLOR; c.lineWidth = (isSel ? 3 : 2) * px;
    c.setLineDash([10 * px, 6 * px]); c.stroke(); c.setLineDash([]);
    if (isSel) {
      c.fillStyle = "#fff";
      for (const q of a.pts) { c.beginPath(); c.arc(q.x, q.y, 5 * px, 0, 7); c.fill(); }
    }
  }

  // broadcast waves (screen only)
  if (interactive && project.settings.waves) drawWaves(c, px);

  // access points
  for (const ap of project.aps) {
    const isSel = interactive && selection?.type === "ap" && selection.id === ap.id;
    const r = 11 * px;
    c.fillStyle = isSel ? "#ffffff" : "#5b8cff";
    c.strokeStyle = "#0b0f1a"; c.lineWidth = 2.5 * px;
    c.beginPath(); c.arc(ap.x, ap.y, r, 0, 7); c.fill(); c.stroke();
    // wifi glyph
    c.strokeStyle = isSel ? "#3a63d6" : "#fff"; c.lineWidth = 1.6 * px;
    for (const k of [0.35, 0.6]) { c.beginPath(); c.arc(ap.x, ap.y + r * 0.35, r * k * 1.2, -Math.PI * 0.78, -Math.PI * 0.22); c.stroke(); }
    c.fillStyle = isSel ? "#3a63d6" : "#fff";
    c.beginPath(); c.arc(ap.x, ap.y + r * 0.35, 1.8 * px, 0, 7); c.fill();
    // label
    c.font = `600 ${12 * px}px "Segoe UI", "Leelawadee UI", sans-serif`;
    c.textAlign = "center"; c.textBaseline = "top";
    c.lineWidth = 3 * px; c.strokeStyle = "rgba(11,15,26,0.9)";
    const lbl = ap.ch24 || ap.ch5 ? `${ap.name} · ${ap.ch24 ?? "–"}/${ap.ch5 ?? "–"}` : ap.name;
    c.strokeText(lbl, ap.x, ap.y + r + 3 * px);
    c.fillStyle = "#fff";
    c.fillText(lbl, ap.x, ap.y + r + 3 * px);
  }

  if (!interactive) return;

  // wall preview
  if (tool === "wall" && wallChain && cursor) {
    const p = snapWall(cursor, false);
    c.strokeStyle = (MATERIALS[project.newWallMat] || MATERIALS.brick).color;
    c.globalAlpha = 0.7; c.lineWidth = 4 * px; c.setLineDash([8 * px, 6 * px]);
    c.beginPath(); c.moveTo(wallChain.x, wallChain.y); c.lineTo(p.x, p.y); c.stroke();
    c.setLineDash([]); c.globalAlpha = 1;
    label(c, px, (wallChain.x + p.x) / 2, (wallChain.y + p.y) / 2, fmtLen(Math.hypot(p.x - wallChain.x, p.y - wallChain.y)));
  }

  // boundary being drawn
  if (tool === "area" && areaDraft) {
    const pts = cursor ? [...areaDraft, snapArea(cursor, false)] : areaDraft;
    c.beginPath();
    pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
    if (pts.length >= 3) { c.fillStyle = "rgba(77,224,255,0.10)"; c.fill(); }
    c.strokeStyle = AREA_COLOR; c.lineWidth = 2.5 * px; c.setLineDash([8 * px, 6 * px]); c.stroke(); c.setLineDash([]);
    areaDraft.forEach((q, i) => {
      c.fillStyle = i === 0 && areaDraft.length >= 3 ? "#ffffff" : AREA_COLOR;
      c.beginPath(); c.arc(q.x, q.y, (i === 0 ? 6 : 4) * px, 0, 7); c.fill();
    });
    if (cursor) {
      const last = areaDraft[areaDraft.length - 1], q = snapArea(cursor, false);
      label(c, px, (last.x + q.x) / 2, (last.y + q.y) / 2, fmtLen(Math.hypot(q.x - last.x, q.y - last.y)));
    }
  }

  // scale line
  if (scaleLine) {
    const b = scaleLine.b || cursor;
    if (b) {
      c.strokeStyle = "#ffd84d"; c.lineWidth = 2.5 * px; c.setLineDash([6 * px, 4 * px]);
      c.beginPath(); c.moveTo(scaleLine.a.x, scaleLine.a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]);
      c.fillStyle = "#ffd84d";
      for (const p of [scaleLine.a, b]) { c.beginPath(); c.arc(p.x, p.y, 4 * px, 0, 7); c.fill(); }
    }
  }
}

const AREA_COLOR = "#4de0ff";
// Adds all boundary polygons to the current path, wound the same way so the
// nonzero clip is their union. Returns false when there is no boundary.
function clipToAreas(c) {
  const areas = projectAreas(project);
  if (!areas.length) return false;
  c.beginPath();
  for (const a of areas) {
    const pts = polyArea(a.pts) < 0 ? [...a.pts].reverse() : a.pts;
    pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
    c.closePath();
  }
  return true;
}

function label(c, px, x, y, text) {
  c.font = `${12 * px}px "Segoe UI", sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  const w = c.measureText(text).width + 10 * px;
  c.fillStyle = "rgba(11,15,26,0.85)";
  c.fillRect(x - w / 2, y - 9 * px, w, 18 * px);
  c.fillStyle = "#fff"; c.fillText(text, x, y);
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.ox, dpr * view.oy);
  drawScene(ctx, 1 / view.s);
}

// ---------- hit testing & snapping ----------
function distToSeg(p, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  let k = L ? ((p.x - x1) * dx + (p.y - y1) * dy) / L : 0;
  k = Math.max(0, Math.min(1, k));
  return Math.hypot(p.x - (x1 + k * dx), p.y - (y1 + k * dy));
}
function hitAp(p) {
  const tol = 14 * touchK / view.s;
  for (let i = project.aps.length - 1; i >= 0; i--) {
    const ap = project.aps[i];
    if (Math.hypot(p.x - ap.x, p.y - ap.y) <= tol) return ap;
  }
  return null;
}
function hitWall(p) {
  const tol = 8 * touchK / view.s;
  let best = null, bd = tol;
  for (const w of project.walls) {
    const d = distToSeg(p, w.x1, w.y1, w.x2, w.y2);
    if (d <= bd) { bd = d; best = w; }
  }
  return best;
}
function hitArea(p) {
  const tol = 8 * touchK / view.s;
  let best = null, bd = tol;
  for (const a of project.areas || []) {
    for (let i = 0; i < a.pts.length; i++) {
      const u = a.pts[i], v = a.pts[(i + 1) % a.pts.length];
      const d = distToSeg(p, u.x, u.y, v.x, v.y);
      if (d <= bd) { bd = d; best = a; }
    }
  }
  return best;
}
function hitAreaPt(p, a) {
  const tol = 10 * touchK / view.s;
  return a.pts.findIndex(q => Math.hypot(p.x - q.x, p.y - q.y) <= tol);
}
function hitWallEnd(p, w) {
  const tol = 10 * touchK / view.s;
  if (Math.hypot(p.x - w.x1, p.y - w.y1) <= tol) return 1;
  if (Math.hypot(p.x - w.x2, p.y - w.y2) <= tol) return 2;
  return 0;
}
// Snap to existing wall endpoints; Shift locks angle to 45° steps from `anchor`.
function snapPoint(p, anchor, shift, skip = null) {
  const tol = 10 * touchK / view.s;
  let q = { x: p.x, y: p.y };
  if (shift && anchor) {
    const dx = p.x - anchor.x, dy = p.y - anchor.y;
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.hypot(dx, dy);
    q = { x: anchor.x + Math.cos(ang) * len, y: anchor.y + Math.sin(ang) * len };
  }
  for (const w of project.walls) {
    if (w === skip) continue;
    for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) {
      if (Math.hypot(q.x - x, q.y - y) <= tol) return { x, y };
    }
  }
  return q;
}
const snapWall = (p, shift = window.__shift) => snapPoint(p, wallChain, shift);
const snapArea = (p, shift = window.__shift) => snapPoint(p, areaDraft?.[areaDraft.length - 1], shift);

const fmtLen = px => (px * project.mPerPx).toFixed(2) + " m";
const fmtArea = px2 => (px2 * project.mPerPx ** 2).toFixed(1) + " m²";

// ---------- tools ----------
let hintTimer;
function showHint(text) {
  const h = $("#hint");
  h.textContent = text; h.style.opacity = 1;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { h.style.opacity = 0; }, 6000);
}

function setTool(name) {
  if (name !== "area") finishArea();
  tool = name;
  wallChain = null;
  updateFinishBtn();
  if (name !== "scale") scaleLine = null;
  document.querySelectorAll("#tools [data-tool]").forEach(b => b.classList.toggle("active", b.dataset.tool === name));
  const hints = { select: "hintSelect", pan: "hintPan", scale: "hintScale", wall: "hintWall", ap: "hintAp", area: "hintArea" };
  showHint(t(hints[name]));
  canvas.style.cursor = name === "pan" ? "grab" : name === "select" ? "default" : "crosshair";
  renderPanel();
  requestRender();
}

function addAp(p) {
  pushHistory();
  const ap = makeAp(p);
  project.aps.push(ap);
  selection = { type: "ap", id: ap.id };
  changed();
}

function deleteSelection() {
  const o = findSel();
  if (!o) return;
  pushHistory();
  if (selection.type === "ap") project.aps = project.aps.filter(a => a !== o);
  else if (selection.type === "area") project.areas = project.areas.filter(a => a !== o);
  else project.walls = project.walls.filter(w => w !== o);
  selection = null;
  changed();
}

// ---------- pointer events (mouse, pen, touch + pinch) ----------
// Click-type actions (place AP, add wall point, scale point) fire on release when the
// pointer barely moved, so a drag or a two-finger pinch never drops stray objects.
const pointers = new Map();
let pinch = null;
let pending = null;       // {p, sx, sy, shift} for click-type tools
let touchK = 1;           // hit-tolerance multiplier (2x for fingers)
const TAP_SLOP = 8;

canvas.addEventListener("contextmenu", e => e.preventDefault());

function startPan(e) {
  drag = { type: "pan", sx: e.clientX, sy: e.clientY, ox: view.ox, oy: view.oy };
  canvas.style.cursor = "grabbing";
}

canvas.addEventListener("pointerdown", e => {
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  touchK = e.pointerType === "touch" ? 2 : 1;
  window.__shift = e.shiftKey;

  if (pointers.size === 2) {               // second finger: switch to pinch-zoom
    if (drag && drag.pushed) undo();       // cancel a half-done drag
    drag = null; pending = null;
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, view: { ...view } };
    return;
  }
  if (pointers.size > 2) return;

  const p = toWorld(e);
  if (e.button === 1 || spaceDown || tool === "pan") { startPan(e); return; }
  if (e.button === 2) { if (tool === "wall") finishWall(); if (tool === "area") finishArea(); return; }

  if (tool === "select") {
    const sel = findSel();
    if (sel && selection.type === "wall") {
      const end = hitWallEnd(p, sel);
      if (end) { drag = { type: "wallEnd", wall: sel, end, pushed: false }; return; }
    }
    if (sel && selection.type === "area") {
      const i = hitAreaPt(p, sel);
      if (i >= 0) { drag = { type: "areaPt", area: sel, i, pushed: false }; return; }
    }
    const ap = hitAp(p);
    if (ap) {
      selection = { type: "ap", id: ap.id };
      drag = { type: "ap", ap, dx: p.x - ap.x, dy: p.y - ap.y, pushed: false };
      renderPanel(); requestRender();
      return;
    }
    const w = hitWall(p);
    if (w) {
      selection = { type: "wall", id: w.id };
      drag = { type: "wall", wall: w, last: p, pushed: false };
      renderPanel(); requestRender();
      return;
    }
    const ar = hitArea(p);
    if (ar) {
      selection = { type: "area", id: ar.id };
      drag = { type: "area", area: ar, last: p, pushed: false };
      renderPanel(); requestRender();
      return;
    }
    if (selection) { selection = null; renderPanel(); requestRender(); }
    startPan(e);
    return;
  }

  // ap / wall / scale: decide on release (tap) — a drag pans instead
  pending = { p, sx: e.clientX, sy: e.clientY, shift: e.shiftKey, ox: view.ox, oy: view.oy };
});

canvas.addEventListener("pointermove", e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const r = canvas.getBoundingClientRect();
    const s = Math.min(40, Math.max(0.05, pinch.view.s * d / pinch.d));
    const wx = (pinch.mx - r.left - pinch.view.ox) / pinch.view.s;   // world point under the start midpoint
    const wy = (pinch.my - r.top - pinch.view.oy) / pinch.view.s;
    view.s = s;
    view.ox = mx - r.left - wx * s;
    view.oy = my - r.top - wy * s;
    requestRender();
    return;
  }

  const p = toWorld(e);
  cursor = p;
  window.__shift = e.shiftKey;
  const inside = p.x >= 0 && p.y >= 0 && p.x <= project.plan.width && p.y <= project.plan.height;
  $("#stCursor").textContent = inside ? `x ${(p.x * project.mPerPx).toFixed(1)} m, y ${(p.y * project.mPerPx).toFixed(1)} m` : "—";

  if (pending && Math.hypot(e.clientX - pending.sx, e.clientY - pending.sy) > TAP_SLOP) {
    drag = { type: "pan", sx: pending.sx, sy: pending.sy, ox: pending.ox, oy: pending.oy };
    pending = null;
  }

  if (drag) {
    if (drag.type === "pan") {
      view.ox = drag.ox + (e.clientX - drag.sx);
      view.oy = drag.oy + (e.clientY - drag.sy);
      requestRender();
      return;
    }
    if (!drag.pushed) { pushHistory(); drag.pushed = true; }
    if (drag.type === "ap") { drag.ap.x = p.x - drag.dx; drag.ap.y = p.y - drag.dy; }
    else if (drag.type === "wall") {
      const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
      drag.wall.x1 += dx; drag.wall.y1 += dy; drag.wall.x2 += dx; drag.wall.y2 += dy;
      drag.last = p;
    } else if (drag.type === "area") {
      const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
      for (const q of drag.area.pts) { q.x += dx; q.y += dy; }
      drag.last = p;
    } else if (drag.type === "areaPt") {
      const q = snapPoint(p, null, false);
      drag.area.pts[drag.i] = { x: q.x, y: q.y };
    } else if (drag.type === "wallEnd") {
      const w = drag.wall;
      const anchor = drag.end === 1 ? { x: w.x2, y: w.y2 } : { x: w.x1, y: w.y1 };
      const q = snapPoint(p, anchor, e.shiftKey, w);
      if (drag.end === 1) { w.x1 = q.x; w.y1 = q.y; } else { w.x2 = q.x; w.y2 = q.y; }
    }
    changed({ coarse: true, panel: false });
    return;
  }

  if (tool === "select" && e.pointerType === "mouse") {
    canvas.style.cursor = hitAp(p) || hitWall(p) || hitArea(p) ? "pointer" : "default";
  }
  if ((tool === "wall" && wallChain) || (tool === "area" && areaDraft) || (tool === "scale" && scaleLine && !scaleLine.b)) requestRender();
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (pending && e.type === "pointerup") tapAction(pending);
  pending = null;
  if (drag && drag.type !== "pan" && drag.pushed) changed();   // fine heatmap after drag
  if (drag?.type === "pan") canvas.style.cursor = tool === "pan" ? "grab" : "default";
  drag = null;
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);

function tapAction({ p, shift }) {
  if (tool === "ap") { addAp(p); return; }
  if (tool === "wall") {
    const q = snapWall(p, shift);
    if (wallChain && Math.hypot(q.x - wallChain.x, q.y - wallChain.y) * view.s > 3) {
      pushHistory();
      project.walls.push({ id: uid(), x1: wallChain.x, y1: wallChain.y, x2: q.x, y2: q.y, mat: project.newWallMat });
      changed({ panel: false });
    }
    wallChain = q;
    updateFinishBtn();
    requestRender();
    return;
  }
  if (tool === "area") {
    const q = snapArea(p, shift);
    if (!areaDraft) { areaDraft = [q]; }
    else {
      const first = areaDraft[0], last = areaDraft[areaDraft.length - 1];
      const tol = 10 * touchK / view.s;
      if (areaDraft.length >= 3 && Math.hypot(q.x - first.x, q.y - first.y) <= tol) { finishArea(); return; }
      if (Math.hypot(q.x - last.x, q.y - last.y) * view.s > 3) areaDraft.push(q);   // ignore the double-click's 2nd tap
    }
    updateFinishBtn();
    requestRender();
    return;
  }
  if (tool === "scale") {
    if (!scaleLine || scaleLine.b) scaleLine = { a: p, b: null };
    else { scaleLine.b = p; renderPanel(); setTimeout(() => $("#scaleInput")?.focus(), 0); }
    requestRender();
  }
}

function finishWall() { wallChain = null; updateFinishBtn(); requestRender(); }
// Close the boundary being drawn (needs 3+ points, otherwise it is discarded).
function finishArea() {
  if (!areaDraft) return;
  const pts = areaDraft;
  areaDraft = null;
  if (pts.length >= 3 && Math.abs(polyArea(pts)) * view.s * view.s > 25) {
    pushHistory();
    const a = { id: uid(), pts };
    project.areas = [...(project.areas || []), a];
    selection = { type: "area", id: a.id };
    changed();
    flash(t("areaAdded"));
  }
  updateFinishBtn();
  requestRender();
}
function cancelArea() { areaDraft = null; updateFinishBtn(); requestRender(); }
function updateFinishBtn() {
  const b = $("#btnFinishWall");
  const wall = tool === "wall" && wallChain, area = tool === "area" && areaDraft;
  b.hidden = !(wall || area);
  b.textContent = t(area ? "finishArea" : "finishWall");
  b.disabled = !!area && areaDraft.length < 3;
}
$("#btnFinishWall").addEventListener("click", () => { if (tool === "area") finishArea(); else finishWall(); });

canvas.addEventListener("dblclick", () => { if (tool === "wall") finishWall(); if (tool === "area") finishArea(); });

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const k = Math.exp(-e.deltaY * 0.0015);
  const s = Math.min(40, Math.max(0.05, view.s * k));
  view.ox = mx - (mx - view.ox) * (s / view.s);
  view.oy = my - (my - view.oy) * (s / view.s);
  view.s = s;
  requestRender();
}, { passive: false });

// ---------- keyboard ----------
window.addEventListener("keydown", e => {
  if (!$("#modal").hidden) { if (e.key === "Escape") closeModal(); return; }
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName);
  window.__shift = e.shiftKey;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveProject(); return; }
  if (typing) return;
  if (e.code === "Space") { spaceDown = true; canvas.style.cursor = "grab"; e.preventDefault(); return; }
  const map = { v: "select", h: "pan", s: "scale", w: "wall", a: "ap", b: "area" };
  if (map[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) { setTool(map[e.key.toLowerCase()]); return; }
  if (areaDraft && e.key === "Enter") { finishArea(); return; }
  if (areaDraft && e.key === "Backspace") {                  // remove the last boundary point
    areaDraft.pop(); if (!areaDraft.length) areaDraft = null;
    updateFinishBtn(); requestRender(); return;
  }
  if (e.key === "Delete" || e.key === "Backspace") { deleteSelection(); return; }
  if (e.key === "Escape") {
    if (areaDraft) cancelArea();
    else if (wallChain) finishWall();
    else if (scaleLine) { scaleLine = null; renderPanel(); }
    else if (selection) { selection = null; renderPanel(); }
    else setTool("select");
    requestRender();
  }
  if (e.key === "Shift") requestRender();
});
window.addEventListener("keyup", e => {
  window.__shift = e.shiftKey;
  if (e.code === "Space") { spaceDown = false; canvas.style.cursor = tool === "pan" ? "grab" : "default"; }
  if (e.key === "Shift") requestRender();
});

// ---------- side panel ----------
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function matButtons(active) {
  return `<div class="mat-list">${Object.entries(MATERIALS).map(([k, m]) =>
    `<button data-mat="${k}" class="${k === active ? "active" : ""}" title="${m.db24} / ${m.db5} dB">
       <span class="dot" style="background:${m.color}"></span>${esc(t("mat_" + k))}</button>`).join("")}</div>`;
}

function modelOptions(selected, withCustom) {
  const brands = [...new Set(AP_MODELS.map(m => m.brand))];
  return (withCustom ? `<option value="custom" ${selected === "custom" ? "selected" : ""}>${t("custom")}</option>` : "") +
    brands.map(b => `<optgroup label="${esc(b)}">` + AP_MODELS.filter(m => m.brand === b).map(m =>
      `<option value="${m.id}" ${m.id === selected ? "selected" : ""}>${esc(m.model)} · ${m.std}</option>`).join("") + "</optgroup>").join("");
}
function eirpText(o) {
  const cap = project.settings.capNbtc;
  const part = (b, raw) => { const e = apEirp(o, b, cap); return e < raw ? `${raw}→<b>${e}</b>` : `<b>${raw}</b>`; };
  return `EIRP 2.4G ${part("2.4", o.tx24 + o.gain24)} · 5G ${part("5", o.tx5 + o.gain5)} dBm` + (cap ? " (NBTC)" : "");
}

function renderPanel() {
  const el = $("#props");
  const o = findSel();

  if (tool === "scale") {
    const len = scaleLine?.b ? Math.hypot(scaleLine.b.x - scaleLine.a.x, scaleLine.b.y - scaleLine.a.y) : 0;
    el.innerHTML = `<p class="empty">${t("scaleHelp")}</p>` + (len ? `
      <label class="row"><span>${t("scaleLen")}</span>
        <input type="number" id="scaleInput" min="0.1" step="0.1" value="${(len * project.mPerPx).toFixed(2)}"></label>
      <button class="btn primary" id="scaleApply">${t("applyScale")}</button>` : "");
    $("#scaleApply")?.addEventListener("click", () => {
      const m = parseFloat($("#scaleInput").value);
      if (!(m > 0)) return;
      pushHistory();
      project.mPerPx = m / len;
      project.scaleSet = true;
      scaleLine = null;
      flash(t("scaleSet") + `: 1 m = ${(1 / project.mPerPx).toFixed(1)} px`);
      setTool("select");
      changed();
    });
    $("#scaleInput")?.addEventListener("keydown", e => { if (e.key === "Enter") $("#scaleApply").click(); });
    return;
  }

  if (o && selection.type === "ap") {
    const spec = AP_BY_ID[o.model];
    const chOpts = (list, cur) => `<option value="">–</option>` + list.map(c => `<option value="${c}" ${c === cur ? "selected" : ""}>${c}</option>`).join("");
    el.innerHTML = `
      <label class="row"><span>${t("apName")}</span><input type="text" data-f="name" value="${esc(o.name)}"></label>
      <label class="row"><span>${t("apModel")}</span><select id="apModelSel">${modelOptions(o.model, true)}</select></label>
      <p class="unit model-info">${spec ? `${esc(spec.brand)} · ${spec.std} · ${t("modelNote")}` : ""}</p>
      <label class="row"><span>${t("tx24")}</span><input type="number" data-f="tx24" min="0" max="30" step="1" value="${o.tx24}"></label>
      <label class="row"><span>${t("tx5")}</span><input type="number" data-f="tx5" min="0" max="30" step="1" value="${o.tx5}"></label>
      <label class="row"><span>${t("gain24")}</span><input type="number" data-f="gain24" min="0" max="15" step="0.1" value="${o.gain24}"></label>
      <label class="row"><span>${t("gain5")}</span><input type="number" data-f="gain5" min="0" max="15" step="0.1" value="${o.gain5}"></label>
      <label class="row"><span>${t("ch24")}</span><select data-f="ch24">${chOpts([1,2,3,4,5,6,7,8,9,10,11,12,13], o.ch24)}</select></label>
      <label class="row"><span>${t("ch5")}</span><select data-f="ch5">${chOpts([36,40,44,48,52,56,60,64,100,104,108,112,116,120,124,128,132,136,140,149,153,157,161,165], o.ch5)}</select></label>
      <p class="unit eirp">${eirpText(o)}</p>
      <button class="btn danger" id="delBtn">${t("deleteItem")}</button>`;
    $("#apModelSel").addEventListener("change", e => {
      const m = AP_BY_ID[e.target.value];
      pushHistory();
      o.model = e.target.value;
      if (m) { Object.assign(o, { tx24: m.tx24, tx5: m.tx5, gain24: m.gain24, gain5: m.gain5 }); project.newApModel = m.id; renderAiModel(); }
      changed();
    });
    el.querySelectorAll("[data-f]").forEach(inp => {
      inp.addEventListener("focus", pushHistory);
      const apply = () => {
        const f = inp.dataset.f;
        if (f === "name") o.name = inp.value;
        else if (f === "ch24" || f === "ch5") o[f] = inp.value ? +inp.value : null;
        else { const v = parseFloat(inp.value); if (isFinite(v)) o[f] = v; }
        el.querySelector(".eirp").innerHTML = eirpText(o);
        changed({ panel: false });
      };
      inp.addEventListener("input", apply);
      if (inp.tagName === "SELECT") inp.addEventListener("change", apply);
    });
  } else if (o && selection.type === "wall") {
    el.innerHTML = `
      <div class="row"><span>${t("material")}</span></div>${matButtons(o.mat)}
      <div class="row"><span>${t("length")}</span><b>${fmtLen(Math.hypot(o.x2 - o.x1, o.y2 - o.y1))}</b></div>
      <button class="btn danger" id="delBtn">${t("deleteItem")}</button>`;
    el.querySelectorAll("[data-mat]").forEach(b => b.addEventListener("click", () => {
      pushHistory(); o.mat = b.dataset.mat; project.newWallMat = o.mat; changed();
    }));
  } else if (o && selection.type === "area") {
    el.innerHTML = `
      <div class="row"><span>${t("areaBoundary")}</span><b>${fmtArea(Math.abs(polyArea(o.pts)))}</b></div>
      <div class="row"><span>${t("areaPoints")}</span><b>${o.pts.length}</b></div>
      <p class="unit">${t("areaEditHelp")}</p>
      <button class="btn danger" id="delBtn">${t("deleteItem")}</button>`;
  } else if (tool === "area") {
    const n = projectAreas(project).length;
    el.innerHTML = `<p class="empty">${t("areaHelp")}</p>` + (n ? `
      <div class="row"><span>${t("areaBoundary")}</span><b>${n} · ${fmtArea(areasPx2(project))}</b></div>
      <button class="btn danger" id="areaClear">${t("areaClear")}</button>` : "");
    $("#areaClear")?.addEventListener("click", () => {
      pushHistory(); project.areas = []; if (selection?.type === "area") selection = null; changed();
    });
  } else if (tool === "wall") {
    el.innerHTML = `<div class="row"><span>${t("wallMaterialForNew")}</span></div>${matButtons(project.newWallMat)}`;
    el.querySelectorAll("[data-mat]").forEach(b => b.addEventListener("click", () => {
      project.newWallMat = b.dataset.mat; renderPanel(); scheduleAutosave();
    }));
  } else {
    el.innerHTML = `<p class="empty">${t("nothingSelected")}</p>`;
  }
  $("#delBtn")?.addEventListener("click", deleteSelection);
}

function renderSettings() {
  const st = project.settings;
  document.querySelectorAll("#bandSeg button").forEach(b => b.classList.toggle("active", b.dataset.band === st.band));
  $("#envSel").innerHTML = ENVIRONMENTS.map((e, i) => `<option value="${i}">${t(e.key)} (n=${e.n})</option>`).join("");
  $("#envSel").value = st.env;
  $("#opacity").value = st.opacity;
  const autoReq = REQ_AUTO_BY_ENV[st.env] ?? -67;
  $("#reqSel").innerHTML = `<option value="auto">${t("reqAuto")} (${autoReq} dBm)</option>` +
    REQ_PROFILES.map(p => `<option value="${p.dbm}">${p.dbm} dBm · ${t(p.key)}</option>`).join("");
  $("#reqSel").value = String(st.req);
  $("#minSel").innerHTML = `<option value="auto">${t("autoShort")} (${reqDbm() - 15} dBm)</option>` +
    [-75, -80, -85, -90].map(v => `<option value="${v}">${v} dBm</option>`).join("");
  $("#minSel").value = String(st.minDbm);
  $("#capNbtc").checked = !!st.capNbtc;
  $("#wavesChk").checked = !!st.waves;
  $("#legend").innerHTML = SIGNAL_STOPS.map(s =>
    `<div class="item"><span class="sw" style="background:rgb(${s.rgb})"></span><span class="lbl"><b>${s.label}</b> dBm · ${t(s.key)}</span></div>`).join("") +
    `<div class="req-line">${t("requirement")}: <b>≥ ${reqDbm()} dBm</b>${st.req === "auto" ? ` (${t("autoShort")})` : ""}</div>`;
  renderAiModel();
  const ls = $("#langSel");
  if (!ls.options.length) ls.innerHTML = LANGS.map(l => `<option value="${l.code}">${l.name}</option>`).join("");
  ls.value = LANG;
}

function renderStats() {
  const box = buildingBox(project);
  const area = (areasPx2(project) ?? (box.x1 - box.x0) * (box.y1 - box.y0)) * project.mPerPx ** 2;
  const req = reqDbm();
  const cov = heat && project.aps.length ? coverageStats(heat, effMinDbm(), req, box, heatMask) : null;
  const counts = {};
  for (const ap of project.aps) { const m = AP_BY_ID[ap.model]; const k = m ? `${m.brand} ${m.model}` : t("custom"); counts[k] = (counts[k] || 0) + 1; }
  const pct = v => (v * 100).toFixed(0) + "%";
  const cls = (v, g, w) => v >= g ? "good" : v >= w ? "warn" : "bad";
  $("#stats").innerHTML = `
    <span class="k">${t("apCount")}</span><span class="v">${project.aps.length}</span>
    <span class="k">${t("wallCount")}</span><span class="v">${project.walls.length}</span>
    <span class="k">${t("area")}${projectAreas(project).length ? ` (${t("areaBoundaryShort")})` : ""}</span><span class="v">${project.scaleSet || !project.plan.image ? area.toFixed(0) + " m²" : "—"}</span>
    ${cov ? `
    <span class="k">${t("meetsReq")} (≥ ${req})</span><span class="v ${cls(cov.meet, 0.95, 0.8)}">${pct(cov.meet)}</span>
    <span class="k">${t("covNone")}</span><span class="v ${cov.none < 0.02 ? "good" : cov.none < 0.1 ? "warn" : "bad"}">${pct(cov.none)}</span>` : ""}
    ${project.aps.length ? `<div class="models"><b>${t("apModels")}:</b><br>${Object.entries(counts).map(([k, n]) => `${n} × ${esc(k)}`).join("<br>")}</div>` : ""}`;
  $("#stScale").textContent = project.scaleSet || !project.plan.image
    ? `1 m = ${(1 / project.mPerPx).toFixed(1)} px` : "⚠ " + t("noScale");
}

$("#bandSeg").addEventListener("click", e => {
  const b = e.target.closest("[data-band]"); if (!b) return;
  project.settings.band = b.dataset.band; renderSettings(); changed({ panel: false });
});
$("#envSel").addEventListener("change", e => { project.settings.env = +e.target.value; renderSettings(); changed({ panel: false }); });
$("#reqSel").addEventListener("change", e => { project.settings.req = e.target.value === "auto" ? "auto" : +e.target.value; renderSettings(); changed({ panel: false }); });
$("#minSel").addEventListener("change", e => { project.settings.minDbm = e.target.value === "auto" ? "auto" : +e.target.value; changed({ panel: false }); });
$("#capNbtc").addEventListener("change", e => { project.settings.capNbtc = e.target.checked; changed(); });
$("#wavesChk").addEventListener("change", e => { project.settings.waves = e.target.checked; requestRender(); scheduleAutosave(); });

// ---------- AI assistant ----------
function renderAiModel() {
  const sel = $("#aiModel");
  sel.innerHTML = modelOptions(project.newApModel, false);
  sel.value = project.newApModel;
}
$("#aiModel").addEventListener("change", e => { project.newApModel = e.target.value; scheduleAutosave(); });

let aiBusy = false;
$("#btnAutoPlace").addEventListener("click", async () => {
  if (aiBusy) return;
  if (!project.walls.length) { flash(t("aiNeedWalls")); return; }
  aiBusy = true;
  const btn = $("#btnAutoPlace"), bar = $("#aiProgress");
  btn.disabled = true; bar.hidden = false; bar.firstElementChild.style.width = "0";
  try {
    const keep = $("#aiKeep").checked;
    const res = await autoPlace(project, {
      band: project.settings.band, req: reqDbm(), target: +$("#aiTarget").value,
      maxAps: Math.max(1, Math.min(50, +$("#aiMax").value || 12)), keep, modelId: project.newApModel,
    }, p => { bar.firstElementChild.style.width = (p * 100).toFixed(0) + "%"; });
    if (!res.aps.length) { flash(t("aiNoGain")); return; }
    pushHistory();
    if (!keep) project.aps = [];
    for (const p of res.aps) project.aps.push(makeAp(p));
    assignChannels(project);
    selection = null;
    changed();
    flash(tf("aiPlaced", { n: res.aps.length, p: Math.round(res.coverage * 100), r: reqDbm() }));
  } finally {
    aiBusy = false; btn.disabled = false;
    setTimeout(() => { bar.hidden = true; }, 600);
  }
});

$("#btnChannels").addEventListener("click", () => {
  if (!project.aps.length) { flash(t("aiNeedAps")); return; }
  pushHistory(); assignChannels(project); changed(); flash(t("aiChannelsDone"));
});

$("#btnAiReview").addEventListener("click", () => {
  if (!project.aps.length) { flash(t("aiNeedAps")); return; }
  let saved = "";
  try { saved = localStorage.getItem("wpth-ai-key") || ""; } catch (e) {}
  openModal(`<h2>${t("aiAnalyze")}</h2>
    <p>${t("aiPrivacy")}</p>
    <label class="field"><span>${t("aiKey")}</span>
      <input type="password" id="aiKeyInput" placeholder="sk-ant-..." autocomplete="off" spellcheck="false" value="${esc(saved)}"></label>
    <p class="unit">${t("aiKeyHelp")}</p>
    <label class="check"><input type="checkbox" id="aiRemember" ${saved ? "checked" : ""}> ${t("aiRemember")}</label>
    <div class="ai-out" id="aiOut" hidden></div>
    <div class="btns inline"><button data-act="close">${t("close")}</button><button class="primary" data-act="run">${t("aiRun")}</button></div>`, null, "wide");
  const box = $("#modalBox"), out = $("#aiOut"), run = box.querySelector('[data-act="run"]');
  box.querySelector('[data-act="close"]').onclick = closeModal;
  run.onclick = async () => {
    const key = $("#aiKeyInput").value.trim();
    if (!key) { $("#aiKeyInput").focus(); return; }
    try { if ($("#aiRemember").checked) localStorage.setItem("wpth-ai-key", key); else localStorage.removeItem("wpth-ai-key"); } catch (e) {}
    run.disabled = true;
    out.hidden = false;
    out.innerHTML = `<p class="working">${t("aiWorking")}</p>`;
    let text = "";
    try {
      const msg = await runAiReview(key, d => { text += d; out.innerHTML = renderMarkdown(text); out.scrollTop = out.scrollHeight; });
      if (msg.stop_reason === "refusal") out.innerHTML += `<p class="err">${t("aiRefused")}</p>`;
      else if (!text) out.innerHTML = renderMarkdown(msg.content.filter(b => b.type === "text").map(b => b.text).join("\n"));
    } catch (err) {
      out.innerHTML = (text ? renderMarkdown(text) : "") + `<p class="err">${esc(aiErrorMessage(err))}</p>`;
    } finally {
      run.disabled = false;
    }
  };
  if (!saved) setTimeout(() => $("#aiKeyInput").focus(), 0);
});
$("#opacity").addEventListener("input", e => { project.settings.opacity = +e.target.value; requestRender(); scheduleAutosave(); });

// ---------- files ----------
let flashTimer;
function flash(msg) {
  $("#stMsg").textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { $("#stMsg").textContent = ""; }, 4000);
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

function saveProject() {
  download(new Blob([JSON.stringify(project)], { type: "application/json" }), `wifi-plan-${stamp()}.json`);
  flash(t("saved"));
}

function loadProjectData(data) {
  if (!data || !data.plan || !Array.isArray(data.walls) || !Array.isArray(data.aps)) throw new Error("bad");
  const base = newProject();
  project = { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } };
  project.aps.forEach(normalizeAp);
  selection = null; wallChain = null; scaleLine = null; areaDraft = null;
  undoStack = []; redoStack = [];
  planImg = null;
  return new Promise(res => {
    if (!project.plan.image) { res(); return; }
    const img = new Image();
    img.onload = () => { planImg = img; res(); };
    img.onerror = () => { project.plan.image = null; res(); };
    img.src = project.plan.image;
  }).then(() => { renderSettings(); fit(); changed(); });
}

// Downscale big floor plans so the heatmap stays fast and the project file stays small.
function loadPlanFile(file) {
  const img = new Image();
  img.onload = () => {
    const MAX = 3000;
    const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const c = cv.getContext("2d");
    c.fillStyle = "#fff"; c.fillRect(0, 0, w, h);     // transparent PNG -> white
    c.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(img.src);
    const dataUrl = cv.toDataURL("image/jpeg", 0.88);
    const plan = new Image();
    plan.onload = () => {
      pushHistory();
      // keep the old metres-per-pixel ratio meaningful: assume the long side is ~30 m until the user sets scale
      project.plan = { image: dataUrl, width: w, height: h };
      project.mPerPx = 30 / Math.max(w, h);
      project.scaleSet = false;
      project.walls = []; project.aps = []; project.areas = [];
      undoStack = []; redoStack = [];
      selection = null;
      planImg = plan;
      fit(); changed();
      setTool("scale");
      flash(t("planLoaded"));
    };
    plan.src = dataUrl;
  };
  img.onerror = () => flash(t("badFile"));
  img.src = URL.createObjectURL(file);
}

function exportPng() {
  const { width: W, height: H } = project.plan;
  const k = Math.min(3, 2400 / Math.max(W, H));
  const pad = 0, legendH = 64 * Math.max(1, k * 0.8);
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * k); cv.height = Math.round(H * k + legendH);
  const c = cv.getContext("2d");
  c.fillStyle = "#0b0f1a"; c.fillRect(0, 0, cv.width, cv.height);
  c.save(); c.scale(k, k);
  if (heatDirty) updateHeat();
  drawScene(c, 1 / k * Math.max(1, k * 0.8), { interactive: false });
  c.restore();

  // footer legend
  const u = Math.max(1, k * 0.8), y0 = H * k + pad;
  c.fillStyle = "#121829"; c.fillRect(0, y0, cv.width, legendH);
  c.fillStyle = "#fff"; c.font = `600 ${15 * u}px "Segoe UI", "Leelawadee UI", sans-serif`; c.textBaseline = "middle";
  const env = ENVIRONMENTS[project.settings.env];
  c.fillText(`WiFi Planner TH — ${t("exportTitle")} · ${project.settings.band} GHz · ${project.aps.length} AP · ${t("requirement")} ≥ ${reqDbm()} dBm`, 14 * u, y0 + 20 * u);
  let x = 14 * u;
  c.font = `${12 * u}px "Segoe UI", "Leelawadee UI", sans-serif`;
  for (const s of SIGNAL_STOPS) {
    c.fillStyle = `rgb(${s.rgb})`; c.fillRect(x, y0 + 38 * u, 18 * u, 12 * u);
    c.fillStyle = "#c9d1e6";
    const txt = `${s.label} dBm`;
    c.fillText(txt, x + 24 * u, y0 + 44 * u);
    x += 24 * u + c.measureText(txt).width + 18 * u;
  }
  c.fillStyle = "#8b95b3";
  c.fillText(`${t(env.key)} · ${new Date().toLocaleDateString(langLocale())}`, x + 10 * u, y0 + 44 * u);

  cv.toBlob(b => { download(b, `wifi-coverage-${stamp()}.png`); flash(t("exported")); }, "image/png");
}

// ---------- autosave ----------
let autosaveTimer;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try { localStorage.setItem("wpth-project", JSON.stringify(project)); }
    catch (e) { flash(t("autosaveFull")); }
  }, 800);
}

// ---------- top bar ----------
function startBlank() {
  project = newProject(); planImg = null; selection = null; areaDraft = null; undoStack = []; redoStack = [];
  renderSettings(); setTool("select"); fit(); changed();
  flash(t("blankPlan"));
}
const hasWork = () => project.walls.length > 0 || project.aps.length > 0 || (project.areas || []).length > 0;
$("#btnNew").addEventListener("click", () => {
  if (!hasWork()) { startBlank(); return; }
  confirmModal(t("newTitle"), t("newBody"), startBlank);
});
function pickPlan() {
  if (!hasWork()) { $("#filePlan").click(); return; }
  // file pickers must open from a user gesture, so the confirm button opens it directly
  confirmModal(t("planTitle"), t("planBody"), () => $("#filePlan").click());
}
$("#btnPlan").addEventListener("click", pickPlan);
$("#btnHelp").addEventListener("click", showWelcome);
$("#filePlan").addEventListener("change", e => { const f = e.target.files[0]; if (f) loadPlanFile(f); e.target.value = ""; });
$("#btnOpen").addEventListener("click", () => $("#fileOpen").click());
$("#fileOpen").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  f.text().then(txt => loadProjectData(JSON.parse(txt))).then(() => flash(t("loaded"))).catch(() => flash(t("badFile")));
});
$("#btnSave").addEventListener("click", saveProject);
$("#btnExport").addEventListener("click", exportPng);
$("#langSel").addEventListener("change", e => {
  setLang(e.target.value);
  renderSettings(); renderPanel(); renderStats(); setTool(tool);
  if (!$("#modal").hidden && $("#modalBox [data-act=demo]")) showWelcome();   // re-render welcome in new language
});
$("#btnUndo").addEventListener("click", undo);
$("#btnRedo").addEventListener("click", redo);
$("#btnFit").addEventListener("click", fit);
document.querySelectorAll("#tools [data-tool]").forEach(b => b.addEventListener("click", () => setTool(b.dataset.tool)));

// Drag & drop a floor plan image or project file onto the canvas.
$("#stage").addEventListener("dragover", e => e.preventDefault());
$("#stage").addEventListener("drop", e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (f.type.startsWith("image/")) { if (hasWork()) confirmModal(t("planTitle"), t("planBody"), () => loadPlanFile(f)); else loadPlanFile(f); }
  else f.text().then(txt => loadProjectData(JSON.parse(txt))).then(() => flash(t("loaded"))).catch(() => flash(t("badFile")));
});

// ---------- modals ----------
let modalOnClose = null;
function openModal(html, onClose, cls = "") {
  $("#modalBox").className = "modal " + cls;
  $("#modalBox").innerHTML = html;
  $("#modal").hidden = false;
  modalOnClose = onClose || null;
  setTimeout(() => $("#modalBox button.primary, #modalBox button")?.focus(), 0);
}
function closeModal() {
  $("#modal").hidden = true;
  const f = modalOnClose; modalOnClose = null;
  if (f) f();
}
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });

function confirmModal(title, body, onOk) {
  openModal(`<h2>${title}</h2><p>${body}</p>
    <div class="btns inline"><button data-act="cancel">${t("cancel")}</button><button data-act="ok" class="danger">${t("confirm")}</button></div>`);
  $("#modalBox").querySelector('[data-act="cancel"]').onclick = closeModal;
  $("#modalBox").querySelector('[data-act="ok"]').onclick = () => { closeModal(); onOk(); };
}

function loadSample() {
  loadProjectData(buildSampleProject()).then(() => flash(t("sampleLoaded")));
}

function showWelcome() {
  openModal(`<h2><img src="icons/favicon.svg" width="28" height="28" alt="">${t("welcomeTitle")}</h2>
    <p>${t("welcomeIntro")}</p>
    <ol>${t("welcomeSteps")}</ol>
    <div class="btns">
      <button class="primary" data-act="demo">${t("tryDemo")}</button>
      <button data-act="plan">${t("startOwn")}</button>
      <button data-act="blank">${t("startBlank")}</button>
    </div>
    <p style="margin:14px 0 0;font-size:11px">${t("disclaimer")}</p>`);
  const box = $("#modalBox");
  box.querySelector('[data-act="demo"]').onclick = () => {
    closeModal();
    if (hasWork()) confirmModal(t("newTitle"), t("newBody"), loadSample); else loadSample();
  };
  box.querySelector('[data-act="plan"]').onclick = () => { closeModal(); pickPlan(); };
  box.querySelector('[data-act="blank"]').onclick = () => { closeModal(); if (hasWork()) confirmModal(t("newTitle"), t("newBody"), startBlank); };
  try { localStorage.setItem("wpth-welcomed", "1"); } catch (e) {}
}

// ---------- offline / installable (PWA) ----------
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// ---------- start ----------
window.addEventListener("resize", () => { resize(); });
applyI18n();
resize();
(async () => {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("wpth-project")); } catch (e) {}
  if (saved) { try { await loadProjectData(saved); } catch (e) { saved = null; } }
  if (!saved) { renderSettings(); fit(); changed(); flash(t("blankPlan")); }
  setTool("select");
  let welcomed = false;
  try { welcomed = !!localStorage.getItem("wpth-welcomed"); } catch (e) {}
  if (!welcomed) showWelcome();
})();

// Beamwise — main app: state, canvas rendering, tools, files.

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
    survey: [],                    // measured points {id, x, y, dbm, band} (survey.js)
    calib: null,                   // fitted model correction {n, off24, off5, ...} or null
    settings: {
      band: "5", env: 1, opacity: 0.55,
      minDbm: "auto",              // display floor: "auto" = requirement - 15 dB
      req: "auto",                 // required RSSI: "auto" = by building type
      capNbtc: true,
      waves: !matchMedia("(prefers-reduced-motion: reduce)").matches,
      rulers: true,
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

// UI theme: "dark" (default) or "light"; the <head> script applies it before first paint.
let uiTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
function setTheme(th) {
  uiTheme = th === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = uiTheme;
  try { localStorage.setItem("wpth-theme", uiTheme); } catch (e) {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", uiTheme === "dark" ? "#161c26" : "#ffffff");
  const b = document.querySelector("#btnTheme");
  if (b) b.title = t(uiTheme === "dark" ? "themeLight" : "themeDark");
  requestRender();
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
  return JSON.stringify({ walls: project.walls, aps: project.aps, areas: project.areas, survey: project.survey, calib: project.calib, mPerPx: project.mPerPx, scaleSet: project.scaleSet });
}
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
}
function restore(snap) {
  Object.assign(project, JSON.parse(snap));
  project.aps.forEach(normalizeAp);
  if (selection?.type === "aps") selectAps(selection.ids);
  if (selection && !findSel()) selection = null;
  changed();
}
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); }

// Several APs can be selected at once: selection = {type: "aps", ids: [...]}.
function selectedAps() {
  if (selection?.type === "ap") return project.aps.filter(a => a.id === selection.id);
  if (selection?.type === "aps") return project.aps.filter(a => selection.ids.includes(a.id));
  return [];
}
const isApSelected = ap => (selection?.type === "ap" && selection.id === ap.id) || (selection?.type === "aps" && selection.ids.includes(ap.id));
function selectAps(ids) {
  ids = [...new Set(ids)].filter(id => project.aps.some(a => a.id === id));
  selection = !ids.length ? null : ids.length === 1 ? { type: "ap", id: ids[0] } : { type: "aps", ids };
}
function selectAllAps() {
  if (!project.aps.length) return;
  if (tool !== "select") setTool("select");
  selectAps(project.aps.map(a => a.id)); renderPanel(); requestRender();
}

function findSel() {
  if (!selection) return null;
  if (selection.type === "aps") { const l = selectedAps(); return l.length ? l : null; }
  const list = selection.type === "ap" ? project.aps : selection.type === "area" ? project.areas
    : selection.type === "survey" ? (project.survey || []) : project.walls;
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
let fitPending = false;
function fit() {
  const r = canvas.getBoundingClientRect();
  const { width: W, height: H } = project.plan;
  const R = rulersOn() ? RULER : 0;
  // not laid out yet (zero-size canvas): a negative scale would break drawing, so fit on the next resize
  if (r.width <= R + 1 || r.height <= R + 1) { fitPending = true; return; }
  fitPending = false;
  view.s = Math.min((r.width - R) / W, (r.height - R) / H) * 0.92;
  view.ox = R + (r.width - R - W * view.s) / 2;
  view.oy = R + (r.height - R - H * view.s) / 2;
  requestRender();
}
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  if (fitPending) fit();
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
function drawScene(c, px, { interactive = true, theme = uiTheme } = {}) {
  P = CANVAS_THEMES[theme] || CANVAS_THEMES.light;
  const { width: W, height: H } = project.plan;

  // plan
  if (planImg) {
    c.drawImage(planImg, 0, 0, W, H);
  } else {
    c.fillStyle = P.plan;
    c.fillRect(0, 0, W, H);
    const step = 1 / project.mPerPx;              // 1 m grid
    c.strokeStyle = P.grid;
    c.lineWidth = px;
    c.beginPath();
    for (let x = 0; x <= W; x += step) { c.moveTo(x, 0); c.lineTo(x, H); }
    for (let y = 0; y <= H; y += step) { c.moveTo(0, y); c.lineTo(W, y); }
    c.stroke();
    c.strokeStyle = P.frame;
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
      c.strokeStyle = P.wallSel; c.lineWidth = 10 * px;
      c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
    }
    c.strokeStyle = m.color; c.lineWidth = 4 * px;
    c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
    if (isSel) for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) handle(c, px, x, y);
  }

  // coverage boundary
  for (const a of projectAreas(project)) {
    const isSel = interactive && selection?.type === "area" && selection.id === a.id;
    c.beginPath();
    a.pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
    c.closePath();
    c.strokeStyle = isSel ? P.sel : P.area; c.lineWidth = (isSel ? 3 : 2) * px;
    c.setLineDash([10 * px, 6 * px]); c.stroke(); c.setLineDash([]);
    if (isSel) for (const q of a.pts) handle(c, px, q.x, q.y);
  }

  // broadcast waves (screen only)
  if (interactive && project.settings.waves) drawWaves(c, px);

  // site-survey points
  (project.survey || []).forEach((pt, i) => drawSurveyPoint(c, px, pt, i + 1, interactive && selection?.type === "survey" && selection.id === pt.id));

  // access points
  for (const ap of project.aps) drawAp(c, px, ap, interactive && isApSelected(ap));

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

  // box selection
  if (drag?.type === "marquee") {
    const x = Math.min(drag.a.x, drag.b.x), y = Math.min(drag.a.y, drag.b.y);
    const w = Math.abs(drag.b.x - drag.a.x), h = Math.abs(drag.b.y - drag.a.y);
    c.fillStyle = P.selFill; c.fillRect(x, y, w, h);
    c.strokeStyle = P.sel; c.lineWidth = 1.5 * px; c.setLineDash([6 * px, 4 * px]); c.strokeRect(x, y, w, h); c.setLineDash([]);
  }

  // boundary being drawn
  if (tool === "area" && areaDraft) {
    const pts = cursor ? [...areaDraft, snapArea(cursor, false)] : areaDraft;
    c.beginPath();
    pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
    if (pts.length >= 3) { c.fillStyle = P.areaFill; c.fill(); }
    c.strokeStyle = P.area; c.lineWidth = 2.5 * px; c.setLineDash([8 * px, 6 * px]); c.stroke(); c.setLineDash([]);
    areaDraft.forEach((q, i) => {
      if (i === 0 && areaDraft.length >= 3) { handle(c, px, q.x, q.y, 6, P.area); return; }
      c.fillStyle = P.area; c.beginPath(); c.arc(q.x, q.y, 4 * px, 0, 7); c.fill();
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
      c.strokeStyle = P.scale; c.lineWidth = 2.5 * px; c.setLineDash([6 * px, 4 * px]);
      c.beginPath(); c.moveTo(scaleLine.a.x, scaleLine.a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]);
      c.fillStyle = P.scale;
      for (const p of [scaleLine.a, b]) { c.beginPath(); c.arc(p.x, p.y, 4 * px, 0, 7); c.fill(); }
    }
  }
}

// Canvas colours per UI theme. Exports and the AI snapshot always use "light".
const CANVAS_THEMES = {
  light: { stage: "#e5e8ee", plan: "#ffffff", grid: "rgba(30,50,90,0.07)", frame: "rgba(30,50,90,0.35)",
           sel: "#1f5fbf", area: "#0b7fb0", areaFill: "rgba(11,127,176,0.10)", scale: "#c26a00",
           text: "#1b2333", halo: "rgba(255,255,255,0.95)", wallSel: "rgba(31,95,191,0.35)",
           selFill: "rgba(31,95,191,0.16)", apTop: "#3d7ae0", apBottom: "#1b4fa8",
           tagBg: "rgba(255,255,255,0.94)", tagLine: "#c3cad6", tagMuted: "#5b6880",
           rulerBg: "#f7f8fa", rulerPlan: "#ffffff", rulerTick: "#9aa5b6", rulerText: "#5b6880", rulerLine: "#c3cad6" },
  dark:  { stage: "#0b0f15", plan: "#141a24", grid: "rgba(160,180,210,0.08)", frame: "rgba(160,180,210,0.35)",
           sel: "#4f8ff7", area: "#3cc8f0", areaFill: "rgba(60,200,240,0.10)", scale: "#e0a23a",
           text: "#ffffff", halo: "rgba(11,15,21,0.9)", wallSel: "rgba(79,143,247,0.45)",
           selFill: "rgba(79,143,247,0.22)", apTop: "#4f8ff7", apBottom: "#2559b8",
           tagBg: "rgba(18,24,34,0.92)", tagLine: "#3a4556", tagMuted: "#95a2b5",
           rulerBg: "#161c26", rulerPlan: "#1d2532", rulerTick: "#5d6a7e", rulerText: "#95a2b5", rulerLine: "#2a3442" },
};
let P = CANVAS_THEMES.light;
// Round drag handle: white fill with a coloured ring.
function handle(c, px, x, y, r = 5, color = P.sel) {
  c.fillStyle = "#ffffff"; c.strokeStyle = color; c.lineWidth = 2 * px;
  c.beginPath(); c.arc(x, y, r * px, 0, 7); c.fill(); c.stroke();
}
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

// Access point: a ceiling-unit puck with a Wi-Fi mark, plus a name / channel tag below.
function drawAp(c, px, ap, isSel) {
  const r = 15 * px, x = ap.x, y = ap.y;
  // selection halo
  if (isSel) {
    c.fillStyle = P.selFill; c.strokeStyle = P.sel; c.lineWidth = 2 * px;
    c.beginPath(); c.arc(x, y, r + 6 * px, 0, 7); c.fill(); c.stroke();
  }
  // soft drop shadow
  c.fillStyle = "rgba(0,0,0,0.28)";
  c.beginPath(); c.arc(x, y + 1.5 * px, r + 1.5 * px, 0, 7); c.fill();
  // body: white rim + coloured face with a subtle top highlight
  c.fillStyle = "#ffffff";
  c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  const g = c.createLinearGradient(x, y - r, x, y + r);
  g.addColorStop(0, P.apTop); g.addColorStop(1, P.apBottom);
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r - 2.2 * px, 0, 7); c.fill();
  // Wi-Fi mark: dot + two arcs, centred in the puck
  const cy = y + r * 0.36;
  c.strokeStyle = "#ffffff"; c.fillStyle = "#ffffff"; c.lineCap = "round"; c.lineWidth = 1.9 * px;
  for (const k of [0.42, 0.74]) { c.beginPath(); c.arc(x, cy, r * k, -Math.PI * 0.76, -Math.PI * 0.24); c.stroke(); }
  c.beginPath(); c.arc(x, cy, 1.9 * px, 0, 7); c.fill();
  // tag: name (bold) and channels 2.4/5 GHz
  const name = ap.name || "AP";
  const ch = ap.ch24 || ap.ch5 ? `${ap.ch24 ?? "–"} / ${ap.ch5 ?? "–"}` : "";
  const fontB = `600 ${12 * px}px "Segoe UI", "Leelawadee UI", sans-serif`;
  const fontN = `${11 * px}px "Segoe UI", "Leelawadee UI", sans-serif`;
  c.font = fontB; const wName = c.measureText(name).width;
  c.font = fontN; const wCh = ch ? c.measureText(ch).width + 7 * px : 0;
  const padX = 7 * px, h = 19 * px, w = wName + wCh + padX * 2;
  const tx = x - w / 2, ty = y + r + (isSel ? 9 : 5) * px;
  c.fillStyle = P.tagBg; c.strokeStyle = isSel ? P.sel : P.tagLine; c.lineWidth = 1 * px;
  roundRect(c, tx, ty, w, h, 4 * px); c.fill(); c.stroke();
  c.textAlign = "left"; c.textBaseline = "middle";
  c.font = fontB; c.fillStyle = P.text; c.fillText(name, tx + padX, ty + h / 2 + 0.5 * px);
  if (ch) {
    const sx = tx + padX + wName + 3.5 * px;
    c.fillStyle = P.tagLine; c.fillRect(sx - 0.5 * px, ty + 4 * px, 1 * px, h - 8 * px);
    c.font = fontN; c.fillStyle = P.tagMuted; c.fillText(ch, sx + 3.5 * px, ty + h / 2 + 0.5 * px);
  }
}
// Measured point: a diamond filled with the measured signal colour, plus "value (Δ error)".
function drawSurveyPoint(c, px, pt, num, isSel) {
  const other = pt.band !== project.settings.band;
  const has = Number.isFinite(pt.dbm);
  const s = 8 * px, x = pt.x, y = pt.y;
  c.save();
  if (other) c.globalAlpha = 0.4;
  if (isSel) { c.fillStyle = P.selFill; c.strokeStyle = P.sel; c.lineWidth = 2 * px; c.beginPath(); c.arc(x, y, s + 7 * px, 0, 7); c.fill(); c.stroke(); }
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y); c.lineTo(x, y + s); c.lineTo(x - s, y); c.closePath();
  c.fillStyle = has ? `rgb(${signalColor(pt.dbm)})` : P.plan; c.fill();
  c.strokeStyle = isSel ? P.sel : P.text; c.lineWidth = 1.6 * px; c.stroke();
  // tag
  let txt = has ? `${pt.dbm}` : "?";
  if (has && project.aps.length) {
    const pred = predictBest(project, pt.band, x, y);
    if (Number.isFinite(pred)) { const d = pred - pt.dbm; txt += `  Δ${d >= 0 ? "+" : ""}${d.toFixed(1)}`; }
  }
  if (other) txt += `  (${pt.band}G)`;
  const label = `#${num}  ${txt}`;
  c.font = `600 ${10.5 * px}px "Segoe UI", sans-serif`;
  const w = c.measureText(label).width + 10 * px, h = 16 * px, tx = x + s + 4 * px, ty = y - h / 2;
  c.fillStyle = P.tagBg; c.strokeStyle = isSel ? P.sel : P.tagLine; c.lineWidth = 1 * px;
  roundRect(c, tx, ty, w, h, 3 * px); c.fill(); c.stroke();
  c.fillStyle = P.text; c.textAlign = "left"; c.textBaseline = "middle";
  c.fillText(label, tx + 5 * px, y + 0.5 * px);
  c.restore();
}
function hitSurvey(p) {
  const tol = 11 * touchK / view.s;
  const list = project.survey || [];
  for (let i = list.length - 1; i >= 0; i--) if (Math.hypot(p.x - list[i].x, p.y - list[i].y) <= tol) return list[i];
  return null;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// ---------- rulers (screen space, metres from the plan origin) ----------
const RULER = 22;   // CSS px
const rulersOn = () => project.settings.rulers !== false;
function niceStep(minM) {
  for (const s of [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]) if (s >= minM) return s;
  return 1000;
}
function drawRulers(c) {
  const R = RULER, cw = canvas.clientWidth, chh = canvas.clientHeight;
  const pxPerM = view.s / project.mPerPx;           // screen px per metre
  const major = niceStep(70 / pxPerM);              // labelled ticks at least ~70 px apart
  const minor = major / (String(major)[0] === "2" ? 4 : 5);
  const fmt = v => (major < 1 ? v.toFixed(1) : String(Math.round(v)));
  c.save();
  c.font = `10px "Segoe UI", sans-serif`;
  c.fillStyle = P.rulerBg;
  c.fillRect(0, 0, cw, R); c.fillRect(0, 0, R, chh);
  // plan extent shading
  const x0 = view.ox, x1 = view.ox + project.plan.width * view.s, y0 = view.oy, y1 = view.oy + project.plan.height * view.s;
  c.fillStyle = P.rulerPlan;
  c.fillRect(Math.max(R, x0), 0, Math.max(0, Math.min(cw, x1) - Math.max(R, x0)), R);
  c.fillRect(0, Math.max(R, y0), R, Math.max(0, Math.min(chh, y1) - Math.max(R, y0)));
  c.strokeStyle = P.rulerTick; c.fillStyle = P.rulerText; c.lineWidth = 1;
  c.beginPath();
  // horizontal ruler
  const mx0 = (R - view.ox) / pxPerM, mx1 = (cw - view.ox) / pxPerM;
  for (let i = Math.ceil(mx0 / minor); i * minor <= mx1; i++) {
    const m = i * minor, sx = Math.round(view.ox + m * pxPerM) + 0.5;
    const isMajor = Math.abs(m / major - Math.round(m / major)) < 1e-6;
    c.moveTo(sx, R); c.lineTo(sx, isMajor ? R - 10 : R - 5);
  }
  // vertical ruler
  const my0 = (R - view.oy) / pxPerM, my1 = (chh - view.oy) / pxPerM;
  for (let i = Math.ceil(my0 / minor); i * minor <= my1; i++) {
    const m = i * minor, sy = Math.round(view.oy + m * pxPerM) + 0.5;
    const isMajor = Math.abs(m / major - Math.round(m / major)) < 1e-6;
    c.moveTo(R, sy); c.lineTo(isMajor ? R - 10 : R - 5, sy);
  }
  c.stroke();
  // labels
  c.textBaseline = "top"; c.textAlign = "left";
  for (let i = Math.ceil(mx0 / major); i * major <= mx1; i++) {
    const sx = view.ox + i * major * pxPerM;
    c.fillText(fmt(i * major), sx + 3, 3);
  }
  for (let i = Math.ceil(my0 / major); i * major <= my1; i++) {
    const sy = view.oy + i * major * pxPerM;
    c.save(); c.translate(3, sy - 3); c.rotate(-Math.PI / 2); c.fillText(fmt(i * major), 0, 0); c.restore();
  }
  // cursor markers
  if (cursor) {
    const sx = view.ox + cursor.x * view.s, sy = view.oy + cursor.y * view.s;
    c.strokeStyle = P.sel; c.lineWidth = 1.5; c.beginPath();
    if (sx > R) { c.moveTo(sx, 0); c.lineTo(sx, R); }
    if (sy > R) { c.moveTo(0, sy); c.lineTo(R, sy); }
    c.stroke();
  }
  // borders + corner with unit
  c.strokeStyle = P.rulerLine; c.lineWidth = 1; c.beginPath();
  c.moveTo(0, R - 0.5); c.lineTo(cw, R - 0.5); c.moveTo(R - 0.5, 0); c.lineTo(R - 0.5, chh); c.stroke();
  c.fillStyle = P.rulerBg; c.fillRect(0, 0, R - 1, R - 1);
  c.fillStyle = P.rulerText; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("m", R / 2, R / 2);
  c.restore();
}

function label(c, px, x, y, text) {
  c.font = `${12 * px}px "Segoe UI", sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  const w = c.measureText(text).width + 10 * px;
  c.fillStyle = "rgba(27,35,51,0.88)";
  c.fillRect(x - w / 2, y - 9 * px, w, 18 * px);
  c.fillStyle = "#fff"; c.fillText(text, x, y);
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = (CANVAS_THEMES[uiTheme] || CANVAS_THEMES.light).stage;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.ox, dpr * view.oy);
  drawScene(ctx, 1 / view.s);
  if (rulersOn()) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawRulers(ctx); }
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
  const hints = { select: "hintSelect", pan: "hintPan", scale: "hintScale", wall: "hintWall", ap: "hintAp", area: "hintArea", survey: "hintSurvey" };
  showHint(t(hints[name]));
  if (typeof renderCalib === "function" && $("#calibCard")) renderCalib();
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
  else if (selection.type === "aps") project.aps = project.aps.filter(a => !o.includes(a));
  else if (selection.type === "area") project.areas = project.areas.filter(a => a !== o);
  else if (selection.type === "survey") project.survey = project.survey.filter(q => q !== o);
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
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    if (ap && multi) {                                   // Shift/Ctrl+click: add or remove from the selection
      const ids = selectedAps().map(a => a.id);
      selectAps(ids.includes(ap.id) ? ids.filter(id => id !== ap.id) : [...ids, ap.id]);
      renderPanel(); requestRender();
      return;
    }
    if (ap) {
      if (!isApSelected(ap)) selection = { type: "ap", id: ap.id };   // dragging a selected AP moves the whole group
      drag = { type: "aps", aps: selectedAps(), last: p, pushed: false };
      renderPanel(); requestRender();
      return;
    }
    if (multi) {                                         // Shift+drag on empty space: box-select APs
      drag = { type: "marquee", a: p, b: p, base: selectedAps().map(a => a.id) };
      return;
    }
    const sp = hitSurvey(p);
    if (sp) {
      selection = { type: "survey", id: sp.id };
      drag = { type: "survey", pt: sp, last: p, pushed: false };
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
    if (drag.type === "marquee") { drag.b = p; requestRender(); return; }
    if (!drag.pushed) { pushHistory(); drag.pushed = true; }
    if (drag.type === "aps") {
      const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
      for (const a of drag.aps) { a.x += dx; a.y += dy; }
      drag.last = p;
    }
    else if (drag.type === "wall") {
      const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
      drag.wall.x1 += dx; drag.wall.y1 += dy; drag.wall.x2 += dx; drag.wall.y2 += dy;
      drag.last = p;
    } else if (drag.type === "survey") {
      drag.pt.x += p.x - drag.last.x; drag.pt.y += p.y - drag.last.y; drag.last = p;
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
    canvas.style.cursor = hitAp(p) || hitSurvey(p) || hitWall(p) || hitArea(p) ? "pointer" : "default";
  }
  if (rulersOn()) requestRender();
  if ((tool === "wall" && wallChain) || (tool === "area" && areaDraft) || (tool === "scale" && scaleLine && !scaleLine.b)) requestRender();
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (pending && e.type === "pointerup") tapAction(pending);
  if (drag?.type === "marquee") {
    const x0 = Math.min(drag.a.x, drag.b.x), x1 = Math.max(drag.a.x, drag.b.x);
    const y0 = Math.min(drag.a.y, drag.b.y), y1 = Math.max(drag.a.y, drag.b.y);
    const inBox = project.aps.filter(a => a.x >= x0 && a.x <= x1 && a.y >= y0 && a.y <= y1).map(a => a.id);
    selectAps([...drag.base, ...inBox]);
    drag = null; renderPanel(); requestRender();
    return;
  }
  pending = null;
  if (drag && drag.type !== "pan" && drag.pushed) changed();   // fine heatmap after drag
  if (drag?.type === "pan") canvas.style.cursor = tool === "pan" ? "grab" : "default";
  drag = null;
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointerleave", () => { if (!drag) { cursor = null; $("#stCursor").textContent = "—"; requestRender(); } });
canvas.addEventListener("pointercancel", endPointer);

function tapAction({ p, shift }) {
  if (tool === "ap") { addAp(p); return; }
  if (tool === "survey") {
    const hit = hitSurvey(p);
    if (hit) selection = { type: "survey", id: hit.id };
    else {
      pushHistory();
      const pt = { id: uid(), x: p.x, y: p.y, dbm: null, band: project.settings.band };
      project.survey = [...(project.survey || []), pt];
      selection = { type: "survey", id: pt.id };
      scheduleAutosave();
    }
    renderPanel(); renderStats(); requestRender();
    setTimeout(() => { const i = $("#surveyDbm"); if (i) { i.focus(); i.select(); } }, 0);
    return;
  }
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") { e.preventDefault(); selectAllAps(); return; }
  if (e.code === "Space") { spaceDown = true; canvas.style.cursor = "grab"; e.preventDefault(); return; }
  const map = { v: "select", h: "pan", s: "scale", w: "wall", a: "ap", b: "area", m: "survey" };
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

// <option>s for the model picker. `q` filters by brand / model / standard; the selected
// model always stays in the list so filtering never changes the value silently.
function modelOptions(selected, withCustom, q = "") {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const match = m => m.id === selected || terms.every(w => `${m.brand} ${m.model} ${m.std}`.toLowerCase().includes(w));
  const list = AP_MODELS.filter(match);
  const opt = m => `<option value="${esc(m.id)}" ${m.id === selected ? "selected" : ""}>${esc(m.model)} · ${esc(m.std)}</option>`;
  const mine = list.filter(m => m.custom);
  const brands = [...new Set(list.filter(m => !m.custom).map(m => m.brand))];
  return (withCustom ? `<option value="custom" ${selected === "custom" ? "selected" : ""}>${t("custom")}</option>` : "") +
    (mine.length ? `<optgroup label="${esc(t("myModels"))}">` + mine.map(m =>
      `<option value="${esc(m.id)}" ${m.id === selected ? "selected" : ""}>${esc(m.brand)} ${esc(m.model)} · ${esc(m.std)}</option>`).join("") + "</optgroup>" : "") +
    brands.map(b => `<optgroup label="${esc(b)}">` + list.filter(m => !m.custom && m.brand === b).map(opt).join("") + "</optgroup>").join("");
}
// Search box + manage button that sit above a model <select>.
function modelSearchHtml(id) {
  return `<div class="model-tools"><input type="search" id="${id}" class="model-search" placeholder="${esc(tf("searchModels", { n: AP_MODELS.length }))}" autocomplete="off">
    <button type="button" class="link-btn" data-manage-models>${t("manageModels")}</button></div>`;
}
function wireModelSearch(input, select, getSelected, withCustom, extraTop = "") {
  input.addEventListener("input", () => {
    select.innerHTML = extraTop + modelOptions(getSelected(), withCustom, input.value);
  });
}

// ---------- user-defined AP models ----------
// Kept in this browser (wpth-custom-models) and copied into each saved project, so a project
// opened on another computer brings its models along (and adds them to that browser's list).
const CUSTOM_KEY = "wpth-custom-models";
const WIFI_STDS = ["Wi-Fi 4", "Wi-Fi 5", "Wi-Fi 6", "Wi-Fi 6E", "Wi-Fi 7"];
// Custom models arrive from project files and localStorage: keep known fields with the right types.
function cleanModel(m) {
  if (!m || typeof m !== "object") return null;
  const id = strOr(m.id, "", 64), model = strOr(m.model, "", 80);
  if (!id || !model) return null;
  const n = v => { const x = +v; return Number.isFinite(x) ? x : 0; };
  return { id, brand: strOr(m.brand, "", 60), model, std: WIFI_STDS.includes(m.std) ? m.std : "Wi-Fi 6",
           tx24: n(m.tx24), tx5: n(m.tx5), gain24: n(m.gain24), gain5: n(m.gain5) };
}
function customLibrary() {
  try { const l = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]"); return Array.isArray(l) ? l.map(cleanModel).filter(Boolean) : []; } catch (e) { return []; }
}
function saveCustomLibrary(list) { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.map(cleanModel).filter(Boolean))); } catch (e) {} }
function registerCustomModels(list) {
  for (const raw of list || []) {
    const m = cleanModel(raw);
    if (!m) continue;
    const spec = { ...m, brand: m.brand || t("myModels"), custom: true };
    const i = AP_MODELS.findIndex(x => x.id === spec.id);
    if (i >= 0) { if (AP_MODELS[i].custom) AP_MODELS[i] = spec; else continue; } else AP_MODELS.push(spec);
    AP_BY_ID[spec.id] = spec;
  }
}
function mergeIntoLibrary(list) {
  const lib = customLibrary();
  for (const m of list || []) if (m && m.id && !lib.some(x => x.id === m.id)) lib.push(m);
  saveCustomLibrary(lib);
}
const plainModel = m => ({ id: m.id, brand: m.brand, model: m.model, std: m.std, tx24: m.tx24, tx5: m.tx5, gain24: m.gain24, gain5: m.gain5 });

function openModelManager(prefillId) {
  const base = AP_BY_ID[prefillId] || AP_BY_ID[project.newApModel] || AP_BY_ID["generic-ax"];
  const stds = WIFI_STDS;
  const render = () => {
    const lib = customLibrary();
    openModal(`<h2>${t("manageModels").replace(/^\+\s*/, "")}</h2>
      <p>${t("customModelsHelp")}</p>
      ${lib.length ? `<table class="calib-tbl model-tbl"><thead><tr><th>${t("brandLbl")}</th><th>${t("apModel")}</th><th>Std</th>
        <th>Tx 2.4/5<br><span class="u">dBm</span></th><th>Gain 2.4/5<br><span class="u">dBi</span></th><th></th></tr></thead><tbody>
        ${lib.map(m => `<tr><td>${esc(m.brand)}</td><td>${esc(m.model)}</td><td>${esc(m.std)}</td><td>${esc(m.tx24)} / ${esc(m.tx5)}</td><td>${esc(m.gain24)} / ${esc(m.gain5)}</td>
          <td><button class="link-btn danger" data-del="${esc(m.id)}">${t("deleteShort")}</button></td></tr>`).join("")}</tbody></table>`
        : `<p class="unit">${t("noCustomModels")}</p>`}
      <h3 class="modal-sub">${t("addModel")}</h3>
      <div class="model-form">
        <label class="field"><span>${t("brandLbl")}</span><input id="cmBrand" value="${esc(base.custom ? base.brand : base.brand === "Generic" ? "" : base.brand)}"></label>
        <label class="field"><span>${t("apModel")}</span><input id="cmModel" placeholder="${esc(t("modelNamePh"))}"></label>
        <label class="field"><span>Standard</span><select id="cmStd">${stds.map(x => `<option ${x === base.std ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label class="field"><span>${t("tx24")} (dBm)</span><input id="cmTx24" type="number" step="1" min="0" max="36" value="${base.tx24}"></label>
        <label class="field"><span>${t("tx5")} (dBm)</span><input id="cmTx5" type="number" step="1" min="0" max="36" value="${base.tx5}"></label>
        <label class="field"><span>${t("gain24")} (dBi)</span><input id="cmG24" type="number" step="0.1" min="0" max="20" value="${base.gain24}"></label>
        <label class="field"><span>${t("gain5")} (dBi)</span><input id="cmG5" type="number" step="0.1" min="0" max="20" value="${base.gain5}"></label>
      </div>
      <p class="unit">${t("customModelsNote")}</p>
      <div class="btns inline"><button data-act="close">${t("close")}</button><button class="primary" data-act="add">${t("addModel")}</button></div>`, null, "wide");
    const box = $("#modalBox");
    box.querySelector('[data-act="close"]').onclick = closeModal;
    box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      const id = b.dataset.del;
      saveCustomLibrary(customLibrary().filter(m => m.id !== id));
      const i = AP_MODELS.findIndex(m => m.id === id && m.custom);
      if (i >= 0) AP_MODELS.splice(i, 1);
      delete AP_BY_ID[id];                       // APs using it keep their values and show as "Custom"
      if (project.newApModel === id) project.newApModel = "generic-ax";
      project.customModels = customLibrary();
      render(); renderPanel(); renderAiModel(); scheduleAutosave();
    });
    box.querySelector('[data-act="add"]').onclick = () => {
      const model = $("#cmModel").value.trim();
      if (!model) { $("#cmModel").focus(); return; }
      const num = id => { const v = parseFloat($(id).value); return isFinite(v) ? v : 0; };
      const m = { id: "user-" + uid(), brand: $("#cmBrand").value.trim() || t("myModels"), model, std: $("#cmStd").value,
                  tx24: num("#cmTx24"), tx5: num("#cmTx5"), gain24: num("#cmG24"), gain5: num("#cmG5") };
      saveCustomLibrary([...customLibrary(), m]);
      registerCustomModels([m]);
      project.customModels = customLibrary();
      project.newApModel = m.id;
      flash(tf("modelAdded", { m: `${m.brand} ${m.model}` }));
      render(); renderPanel(); renderAiModel(); scheduleAutosave();
    };
    setTimeout(() => $("#cmModel")?.focus(), 0);
  };
  render();
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-manage-models]");
  if (!b) return;
  const one = selectedAps();
  openModelManager(one.length === 1 ? one[0].model : null);
});
function eirpText(o) {
  const cap = project.settings.capNbtc;
  const part = (b, raw) => { const e = apEirp(o, b, cap); return !Number.isFinite(e) ? "—" : e < raw ? `${raw}→<b>${e}</b>` : `<b>${raw}</b>`; };
  return `EIRP 2.4G ${part("2.4", o.tx24 + o.gain24)} · 5G ${part("5", o.tx5 + o.gain5)} dBm` + (cap ? " (NBTC)" : "");
}

// Card title follows what the panel is showing (no generic "Properties" heading).
const noKey = label => label.replace(/\s*\([^)]*\)\s*$/, "");
function panelTitle(o) {
  if (tool === "scale") return noKey(t("toolScale"));
  if (o && selection.type === "ap") return `Access Point: ${o.name || "AP"}`;
  if (o && selection.type === "aps") return tf("apsSelected", { n: o.length });
  if (o && selection.type === "wall") return t("tlWall");
  if (o && selection.type === "area") return t("areaBoundary");
  if (o && selection.type === "survey") return `${t("surveyPoint")} #${project.survey.indexOf(o) + 1}`;
  if (tool === "survey") return noKey(t("toolSurvey"));
  if (tool === "area") return noKey(t("toolArea"));
  if (tool === "wall") return noKey(t("toolWall"));
  return "";
}

// AP settings for one AP or several at once. With several, a field shows its value when
// every selected AP agrees, otherwise it is blank ("mixed"); editing it sets all of them.
const CH24_LIST = [1,2,3,4,5,6,7,8,9,10,11,12,13];
const CH5_LIST = [36,40,44,48,52,56,60,64,100,104,108,112,116,120,124,128,132,136,140,149,153,157,161,165];
function renderApPanel(el, aps) {
  const one = aps.length === 1, o = aps[0];
  const same = f => aps.every(a => a[f] === o[f]);
  const val = f => same(f) ? o[f] : "";
  const mixed = esc(t("mixedValues"));
  const num = (f, max, step) => `<input type="number" data-f="${f}" min="0" max="${max}" step="${step}" value="${val(f) ?? ""}" ${same(f) ? "" : `placeholder="${mixed}"`}>`;
  const chSel = (f, list) => `<select data-f="${f}">${same(f) ? "" : `<option value="__mixed" selected>${mixed}</option>`}<option value="" ${same(f) && o[f] == null ? "selected" : ""}>–</option>` +
    list.map(c => `<option value="${c}" ${same(f) && c === o[f] ? "selected" : ""}>${c}</option>`).join("") + `</select>`;
  const modelSame = same("model");
  const spec = modelSame ? AP_BY_ID[o.model] : null;
  const eirpLine = () => one ? eirpText(o) : "";
  el.innerHTML = `
    ${one ? `<label class="row"><span>${t("apName")}</span><input type="text" data-f="name" value="${esc(o.name)}"></label>`
          : `<p class="unit">${t("multiHelp")}</p>`}
    <label class="row"><span>${t("apModel")}</span><select id="apModelSel">${modelSame ? "" : `<option value="__mixed" selected>${mixed}</option>`}${modelOptions(modelSame ? o.model : "", true)}</select></label>
    ${modelSearchHtml("apModelSearch")}
    <p class="unit model-info">${spec ? `${esc(spec.brand)} · ${esc(spec.std)} · ${t("modelNote")}` : ""}</p>
    <label class="row"><span>${t("tx24")} <span class="u">(dBm)</span></span>${num("tx24", 30, 1)}</label>
    <label class="row"><span>${t("tx5")} <span class="u">(dBm)</span></span>${num("tx5", 30, 1)}</label>
    <label class="row"><span>${t("gain24")} <span class="u">(dBi)</span></span>${num("gain24", 15, 0.1)}</label>
    <label class="row"><span>${t("gain5")} <span class="u">(dBi)</span></span>${num("gain5", 15, 0.1)}</label>
    <label class="row"><span>${t("ch24")}</span>${chSel("ch24", CH24_LIST)}</label>
    <label class="row"><span>${t("ch5")}</span>${chSel("ch5", CH5_LIST)}</label>
    <p class="unit eirp">${eirpLine()}</p>
    ${one && project.aps.length > 1 ? `<button class="btn" id="applyAllBtn">${t("applyToAll")}</button>` : ""}
    ${project.aps.length > aps.length ? `<button class="btn" id="selAllBtn">${t("selectAllAps")}</button>` : ""}
    ${one ? `<p class="unit">${t("multiTip")}</p>` : ""}
    <button class="btn danger" id="delBtn">${t("deleteItem")}</button>`;

  wireModelSearch($("#apModelSearch"), $("#apModelSel"), () => modelSame ? o.model : "", true,
    modelSame ? "" : `<option value="__mixed" selected>${mixed}</option>`);
  $("#apModelSel").addEventListener("change", e => {
    if (e.target.value === "__mixed") return;
    const m = AP_BY_ID[e.target.value];
    pushHistory();
    for (const a of aps) {
      a.model = e.target.value;
      if (m) Object.assign(a, { tx24: m.tx24, tx5: m.tx5, gain24: m.gain24, gain5: m.gain5 });
    }
    if (m) { project.newApModel = m.id; renderAiModel(); }
    changed();
  });
  el.querySelectorAll("[data-f]").forEach(inp => {
    inp.addEventListener("focus", pushHistory);
    const apply = () => {
      const f = inp.dataset.f;
      if (inp.value === "__mixed") return;
      if (f === "name") { o.name = inp.value; $("#propsTitle").textContent = panelTitle(o); }
      else if (f === "ch24" || f === "ch5") for (const a of aps) a[f] = inp.value ? +inp.value : null;
      else { const v = parseFloat(inp.value); if (!isFinite(v)) return; for (const a of aps) a[f] = v; }
      el.querySelector(".eirp").innerHTML = eirpLine();
      changed({ panel: false });
    };
    inp.addEventListener("input", apply);
    if (inp.tagName === "SELECT") inp.addEventListener("change", apply);
  });
  $("#applyAllBtn")?.addEventListener("click", () => {
    pushHistory();
    for (const a of project.aps) if (a !== o) Object.assign(a, { model: o.model, tx24: o.tx24, tx5: o.tx5, gain24: o.gain24, gain5: o.gain5 });
    changed();
    flash(tf("appliedAll", { n: project.aps.length }));
  });
  $("#selAllBtn")?.addEventListener("click", selectAllAps);
}

function renderPanel() {
  const el = $("#props");
  const o = findSel();
  const title = panelTitle(o);
  $("#propsTitle").textContent = title;
  $("#propsCard").hidden = !title;       // only shown while something is selected or a drawing tool needs options

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

  if (o && (selection.type === "ap" || selection.type === "aps")) {
    renderApPanel(el, selection.type === "ap" ? [o] : o);
  } else if (o && selection.type === "wall") {
    el.innerHTML = `
      <div class="row"><span>${t("material")}</span></div>${matButtons(o.mat)}
      <div class="row"><span>${t("length")}</span><b>${fmtLen(Math.hypot(o.x2 - o.x1, o.y2 - o.y1))}</b></div>
      <button class="btn danger" id="delBtn">${t("deleteItem")}</button>`;
    el.querySelectorAll("[data-mat]").forEach(b => b.addEventListener("click", () => {
      pushHistory(); o.mat = b.dataset.mat; project.newWallMat = o.mat; changed();
    }));
  } else if (o && selection.type === "survey") {
    const pred = project.aps.length ? predictBest(project, o.band, o.x, o.y) : -Infinity;
    const has = Number.isFinite(o.dbm);
    const errTxt = () => {
      if (!Number.isFinite(o.dbm)) return t("noValue");
      if (!Number.isFinite(pred)) return "—";
      const d = pred - o.dbm; return `${d >= 0 ? "+" : ""}${d.toFixed(1)} dB`;
    };
    el.innerHTML = `
      <label class="row"><span>${t("measured")} <span class="u">(dBm)</span></span>
        <input type="number" id="surveyDbm" min="-110" max="-10" step="1" value="${has ? o.dbm : ""}" placeholder="-65"></label>
      <div class="row"><span>${t("band")}</span>
        <div class="seg" id="surveyBand"><button data-b="2.4" class="${o.band === "2.4" ? "active" : ""}">2.4 GHz</button><button data-b="5" class="${o.band === "5" ? "active" : ""}">5 GHz</button></div></div>
      <div class="row"><span>${t("predicted")}</span><b>${Number.isFinite(pred) ? pred.toFixed(1) + " dBm" : "—"}</b></div>
      <div class="row"><span>${t("errorLbl")}</span><b id="surveyErr">${errTxt()}</b></div>
      <p class="unit">${t("surveyHowTo")}</p>
      <button class="btn danger" id="delBtn">${t("deleteItem")}</button>`;
    const inp = $("#surveyDbm");
    inp.addEventListener("focus", pushHistory);
    inp.addEventListener("input", () => {
      const v = parseFloat(inp.value);
      o.dbm = isFinite(v) ? Math.round(v * 10) / 10 : null;
      $("#surveyErr").textContent = errTxt();
      renderStats(); requestRender(); scheduleAutosave();
    });
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { inp.blur(); if (tool !== "survey") { selection = null; renderPanel(); requestRender(); } } });
    el.querySelectorAll("#surveyBand [data-b]").forEach(b => b.addEventListener("click", () => {
      pushHistory(); o.band = b.dataset.b; renderPanel(); renderStats(); requestRender(); scheduleAutosave();
    }));
  } else if (tool === "survey") {
    el.innerHTML = `<p class="empty">${t("surveyHelp")}</p>`;
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
    el.innerHTML = "";          // nothing to edit: the card is hidden (see top of renderPanel)
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
  $("#rulersChk").checked = st.rulers !== false;
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
  renderCalib();
  $("#stScale").textContent = project.scaleSet || !project.plan.image
    ? `1 m = ${(1 / project.mPerPx).toFixed(1)} px` : t("noScale");
}

// ---------- calibration card ----------
function renderCalib() {
  const card = $("#calibCard");
  const pts = project.survey || [];
  card.hidden = !pts.length && tool !== "survey" && !project.calib;
  if (card.hidden) return;
  const E = surveyErrors(project);
  const f = v => (v >= 0 ? "+" : "") + v.toFixed(1);
  const row = (label, st) => st ? `<tr><td>${label}</td><td>${st.n}</td><td>${f(st.bias)}</td><td>${st.rms.toFixed(1)}</td><td>${st.max.toFixed(1)}</td></tr>` : "";
  const cal = project.calib;
  const envN = (ENVIRONMENTS[project.settings.env] || ENVIRONMENTS[1]).n;
  const bigOff = cal && Math.max(Math.abs(cal.off24), Math.abs(cal.off5)) > CALIB_WARN_OFFSET;
  $("#calib").innerHTML = (E.all ? `
    <table class="calib-tbl">
      <thead><tr><th>${t("band")}</th><th>${t("calibPoints")}</th><th>${t("calibBias")}</th><th>RMS</th><th>${t("calibMax")}</th></tr></thead>
      <tbody>${row("2.4 GHz", E["2.4"])}${row("5 GHz", E["5"])}${E["2.4"] && E["5"] ? row(t("calibAll"), E.all) : ""}</tbody>
    </table>
    <p class="unit">${t("calibNote")}</p>` : `<p class="empty">${t("calibNeed")}</p>`) + `
    ${cal ? `<div class="calib-on">
      <b>${t("calibActive")}</b><br>
      n = ${cal.n} <span class="unit">(${t("calibEnvWas")} ${envN})</span><br>
      ${t("calibOffset")}: 2.4G ${f(cal.off24)} dB · 5G ${f(cal.off5)} dB
      ${cal.rmsBefore != null ? `<br>RMS ${cal.rmsBefore} → ${cal.rmsAfter} dB` : ""}
    </div>${bigOff ? `<p class="unit warn-text">${t("calibWarnOffset")}</p>` : ""}` : ""}
    <button class="btn primary" id="calibFit" ${E.all && project.aps.length ? "" : "disabled"}>${t("calibFit")}</button>
    ${cal ? `<button class="btn" id="calibReset">${t("calibReset")}</button>` : ""}
    ${!pts.length ? `<button class="btn" id="calibStart">${t("toolSurvey")}</button>` : ""}`;
  $("#calibFit")?.addEventListener("click", () => {
    const res = fitCalibration(project);
    if (!res) { flash(t("calibNeed")); return; }
    pushHistory(); project.calib = res; changed();
    flash(tf("calibDone", { a: res.rmsBefore ?? "—", b: res.rmsAfter }));
  });
  $("#calibReset")?.addEventListener("click", () => { pushHistory(); project.calib = null; changed(); });
  $("#calibStart")?.addEventListener("click", () => setTool("survey"));
}

$("#bandSeg").addEventListener("click", e => {
  const b = e.target.closest("[data-band]"); if (!b) return;
  project.settings.band = b.dataset.band; renderSettings(); changed({ panel: false });
});
$("#envSel").addEventListener("change", e => { project.settings.env = +e.target.value; renderSettings(); changed({ panel: false }); });
$("#reqSel").addEventListener("change", e => { project.settings.req = e.target.value === "auto" ? "auto" : +e.target.value; renderSettings(); changed({ panel: false }); });
$("#minSel").addEventListener("change", e => { project.settings.minDbm = e.target.value === "auto" ? "auto" : +e.target.value; changed({ panel: false }); });
$("#capNbtc").addEventListener("change", e => { project.settings.capNbtc = e.target.checked; changed(); });
$("#rulersChk").addEventListener("change", e => { project.settings.rulers = e.target.checked; fit(); scheduleAutosave(); });
$("#wavesChk").addEventListener("change", e => { project.settings.waves = e.target.checked; requestRender(); scheduleAutosave(); });

// ---------- AI assistant ----------
function renderAiModel() {
  const sel = $("#aiModel");
  if (!AP_BY_ID[project.newApModel]) project.newApModel = "generic-ax";
  sel.innerHTML = modelOptions(project.newApModel, false, $("#aiModelSearchBox input")?.value || "");
  sel.value = project.newApModel;
  const box = $("#aiModelSearchBox");
  if (!box.firstChild) {
    box.innerHTML = modelSearchHtml("aiModelSearch");
    wireModelSearch($("#aiModelSearch"), sel, () => project.newApModel, false);
  }
  $("#aiModelSearch").placeholder = tf("searchModels", { n: AP_MODELS.length });
  $("#aiModelSearchBox [data-manage-models]").textContent = t("manageModels");
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
  project.customModels = customLibrary();
  markSaved();
  download(new Blob([JSON.stringify(project)], { type: "application/json" }), `beamwise-project-${stamp()}.json`);
  flash(t("saved"));
}

// A project file comes from outside (shared by someone else, edited by hand), and many of its
// values end up in innerHTML. Keep only known fields, coerced to the expected types.
// (function declarations, so they are hoisted: cleanModel above uses them too)
function numOr(v, d) { const n = +v; return v !== null && v !== "" && Number.isFinite(n) ? n : d; }
function strOr(v, d = "", max = 120) { return typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v) : d; }
function chOr(v) { return v == null || v === "" ? null : numOr(v, null); }
function sanitizeProject(data) {
  const base = newProject();
  const arr = a => Array.isArray(a) ? a.filter(o => o && typeof o === "object") : [];
  const plan = data.plan || {};
  const img = typeof plan.image === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(plan.image) ? plan.image : null;
  const s = data.settings || {}, bs = base.settings;
  const autoOrNum = (v, d) => v === "auto" ? "auto" : numOr(v, d);
  const cal = data.calib && typeof data.calib === "object" ? data.calib : null;
  return {
    ...base,
    version: numOr(data.version, 1),
    plan: { image: img, width: Math.max(1, numOr(plan.width, base.plan.width)), height: Math.max(1, numOr(plan.height, base.plan.height)) },
    mPerPx: numOr(data.mPerPx, 0) > 0 ? +data.mPerPx : base.mPerPx,
    scaleSet: !!data.scaleSet,
    walls: arr(data.walls).map(w => ({ id: strOr(w.id, uid()), x1: numOr(w.x1, 0), y1: numOr(w.y1, 0), x2: numOr(w.x2, 0), y2: numOr(w.y2, 0),
                                      mat: MATERIALS[w.mat] ? w.mat : "brick" })),
    aps: arr(data.aps).map(a => ({ id: strOr(a.id, uid()), name: strOr(a.name, "AP"), x: numOr(a.x, 0), y: numOr(a.y, 0), model: strOr(a.model, "custom"),
                                   tx24: numOr(a.tx24, 0), tx5: numOr(a.tx5, 0),
                                   gain24: numOr(a.gain24 ?? a.gain, 3), gain5: numOr(a.gain5 ?? a.gain, 3),
                                   ch24: chOr(a.ch24), ch5: chOr(a.ch5) })),
    areas: arr(data.areas).map(a => ({ id: strOr(a.id, uid()), pts: arr(a.pts).map(p => ({ x: numOr(p.x, 0), y: numOr(p.y, 0) })) })),
    survey: arr(data.survey).map(p => ({ id: strOr(p.id, uid()), x: numOr(p.x, 0), y: numOr(p.y, 0), dbm: numOr(p.dbm, null),
                                         band: p.band === "2.4" ? "2.4" : "5" })),
    calib: cal && Number.isFinite(+cal.n) ? {
      n: +cal.n, off24: numOr(cal.off24, 0), off5: numOr(cal.off5, 0),
      rmsBefore: numOr(cal.rmsBefore, null), rmsAfter: numOr(cal.rmsAfter, null),
      count: numOr(cal.count, 0), date: strOr(cal.date, "", 40),
    } : null,
    settings: {
      ...bs,
      band: s.band === "2.4" ? "2.4" : s.band === "5" ? "5" : bs.band,
      env: ENVIRONMENTS[s.env] ? +s.env : bs.env,
      opacity: Math.min(0.9, Math.max(0.1, numOr(s.opacity, bs.opacity))),
      minDbm: autoOrNum(s.minDbm, bs.minDbm),
      req: autoOrNum(s.req, bs.req),
      capNbtc: s.capNbtc == null ? bs.capNbtc : !!s.capNbtc,
      waves: s.waves == null ? bs.waves : !!s.waves,
      rulers: s.rulers == null ? bs.rulers : !!s.rulers,
    },
    newWallMat: MATERIALS[data.newWallMat] ? data.newWallMat : base.newWallMat,
    newApModel: strOr(data.newApModel, base.newApModel),
    customModels: arr(data.customModels).map(cleanModel).filter(Boolean),
  };
}

function loadProjectData(data) {
  if (!data || !data.plan || !Array.isArray(data.walls) || !Array.isArray(data.aps)) throw new Error("bad");
  project = sanitizeProject(data);
  if (project.customModels.length) { mergeIntoLibrary(project.customModels); registerCustomModels(project.customModels); }
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
  }).then(() => { renderSettings(); fit(); changed(); markSaved(); });
}

// Downscale big floor plans so the heatmap stays fast and the project file stays small.
function loadPlanFile(file) {
  if (isPdfFile(file)) { loadPdfPlan(file); return; }
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
      // keep the old metres-per-pixel ratio meaningful: assume the long side is ~30 m until the user sets scale
      project.plan = { image: dataUrl, width: w, height: h };
      project.mPerPx = 30 / Math.max(w, h);
      project.scaleSet = false;
      project.walls = []; project.aps = []; project.areas = []; project.survey = []; project.calib = null;
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
  c.fillStyle = "#ffffff"; c.fillRect(0, 0, cv.width, cv.height);
  c.save(); c.scale(k, k);
  if (heatDirty) updateHeat();
  drawScene(c, 1 / k * Math.max(1, k * 0.8), { interactive: false, theme: "light" });
  c.restore();

  // footer legend
  const u = Math.max(1, k * 0.8), y0 = H * k + pad;
  c.fillStyle = "#f3f5f8"; c.fillRect(0, y0, cv.width, legendH);
  c.fillStyle = "#d8dde6"; c.fillRect(0, y0, cv.width, Math.max(1, u));
  c.fillStyle = "#1b2333"; c.font = `600 ${15 * u}px "Segoe UI", "Leelawadee UI", sans-serif`; c.textBaseline = "middle";
  const env = ENVIRONMENTS[project.settings.env];
  c.fillText(`Beamwise — ${t("exportTitle")} · ${project.settings.band} GHz · ${project.aps.length} AP · ${t("requirement")} ≥ ${reqDbm()} dBm`, 14 * u, y0 + 20 * u);
  let x = 14 * u;
  c.font = `${12 * u}px "Segoe UI", "Leelawadee UI", sans-serif`;
  for (const s of SIGNAL_STOPS) {
    c.fillStyle = `rgb(${s.rgb})`; c.fillRect(x, y0 + 38 * u, 18 * u, 12 * u);
    c.fillStyle = "#3b475c";
    const txt = `${s.label} dBm`;
    c.fillText(txt, x + 24 * u, y0 + 44 * u);
    x += 24 * u + c.measureText(txt).width + 18 * u;
  }
  c.fillStyle = "#5b6880";
  c.fillText(`${t(env.key)} · ${new Date().toLocaleDateString(langLocale())}`, x + 10 * u, y0 + 44 * u);

  cv.toBlob(b => { download(b, `beamwise-coverage-${stamp()}.png`); flash(t("exported")); }, "image/png");
}

// ---------- unsaved-changes tracking ----------
// Every start (open / refresh) is a blank project; nothing is restored from the browser.
// Work counts as unsaved when it differs from the last saved / opened state.
function workSnapshot() {
  const p = project;
  return JSON.stringify([p.plan.image, p.walls, p.aps, p.areas, p.survey, p.calib, p.mPerPx, p.scaleSet]);
}
let savedSnap = "";
const markSaved = () => { savedSnap = workSnapshot(); };
const isDirty = () => hasWork() && workSnapshot() !== savedSnap;
function scheduleAutosave() {}             // kept for call sites; the project is no longer autosaved

// Before replacing the current work: ask Save first / Don't save / Cancel (only if unsaved).
// `action` runs inside the button's click, so it may open a file picker.
function guardUnsaved(action) {
  if (!isDirty()) { action(); return; }
  openModal(`<h2>${t("unsavedTitle")}</h2><p>${t("unsavedBody")}</p>
    <div class="btns inline">
      <button data-act="cancel">${t("cancel")}</button>
      <button data-act="discard" class="danger">${t("dontSave")}</button>
      <button data-act="save" class="primary">${t("saveFirst")}</button>
    </div>`);
  const box = $("#modalBox");
  box.querySelector('[data-act="cancel"]').onclick = closeModal;
  box.querySelector('[data-act="discard"]').onclick = () => { closeModal(); action(); };
  box.querySelector('[data-act="save"]').onclick = () => { saveProject(); closeModal(); action(); };
}
// Refresh / close tab with unsaved work: browsers only allow their own standard warning.
window.addEventListener("beforeunload", e => { if (isDirty()) { e.preventDefault(); e.returnValue = ""; } });

// ---------- top bar ----------
function startBlank() {
  project = newProject(); planImg = null; selection = null; areaDraft = null; undoStack = []; redoStack = [];
  renderSettings(); setTool("select"); fit(); changed(); markSaved();
  flash(t("blankPlan"));
}
const hasWork = () => !!project.plan.image || project.walls.length > 0 || project.aps.length > 0 || (project.areas || []).length > 0 || (project.survey || []).length > 0;
$("#btnNew").addEventListener("click", () => guardUnsaved(startBlank));
// file pickers must open from a user gesture; guardUnsaved runs the action inside a click
function pickPlan() { guardUnsaved(() => $("#filePlan").click()); }
$("#btnPlan").addEventListener("click", pickPlan);
$("#btnHelp").addEventListener("click", showWelcome);
$("#btnTheme").addEventListener("click", () => setTheme(uiTheme === "dark" ? "light" : "dark"));
$("#filePlan").addEventListener("change", e => { const f = e.target.files[0]; if (f) loadPlanFile(f); e.target.value = ""; });
$("#btnOpen").addEventListener("click", () => guardUnsaved(() => $("#fileOpen").click()));
$("#fileOpen").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  f.text().then(txt => loadProjectData(JSON.parse(txt))).then(() => flash(t("loaded"))).catch(() => flash(t("badFile")));
});
$("#btnSave").addEventListener("click", saveProject);
$("#btnExport").addEventListener("click", exportPng);
$("#btnExportData").addEventListener("click", exportDesignCsv);
$("#langSel").addEventListener("change", e => {
  setLang(e.target.value);
  renderSettings(); renderPanel(); renderStats(); setTool(tool); setTheme(uiTheme);
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
  if (f.type.startsWith("image/") || isPdfFile(f)) guardUnsaved(() => loadPlanFile(f));
  else guardUnsaved(() => f.text().then(txt => loadProjectData(JSON.parse(txt))).then(() => flash(t("loaded"))).catch(() => flash(t("badFile"))));
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
    guardUnsaved(loadSample);
  };
  box.querySelector('[data-act="plan"]').onclick = () => { closeModal(); pickPlan(); };
  box.querySelector('[data-act="blank"]').onclick = () => { closeModal(); guardUnsaved(startBlank); };
  try { localStorage.setItem("wpth-welcomed", "1"); } catch (e) {}
}

// ---------- offline / installable (PWA) ----------
// "Install app" button: Chrome / Edge / Android offer a native install prompt; iPhone / iPad
// Safari has none, so show how to use "Add to Home Screen". Hidden when already installed.
let installPrompt = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function updateInstallBtn() {
  $("#btnInstall").hidden = isStandalone() || !(installPrompt || (isIos() && location.protocol === "https:"));
}
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; updateInstallBtn(); });
window.addEventListener("appinstalled", () => { installPrompt = null; updateInstallBtn(); flash(t("appInstalled")); });
$("#btnInstall").addEventListener("click", async () => {
  if (installPrompt) {
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) {}
    installPrompt = null; updateInstallBtn();
  } else {
    openModal(`<h2>${t("installApp")}</h2><p>${t("installIos")}</p>
      <div class="btns inline"><button class="primary" data-act="close">${t("close")}</button></div>`);
    $("#modalBox [data-act=close]").onclick = closeModal;
  }
});
updateInstallBtn();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  // The page was served from the old cache; once a new version has taken over, offer a reload.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || $("#updateBar")) return;
    const b = document.createElement("button");
    b.id = "updateBar"; b.className = "update-bar"; b.textContent = t("updateReady");
    b.onclick = () => location.reload();
    document.body.appendChild(b);
  });
}

// ---------- start ----------
window.addEventListener("resize", () => { resize(); });
registerCustomModels(customLibrary());
try { localStorage.removeItem("wpth-ai-key"); } catch (e) {}   // key saved by the removed AI review feature
applyI18n();
setTheme(uiTheme);
resize();
try { localStorage.removeItem("wpth-project"); } catch (e) {}      // old autosave from earlier versions
(() => {
  renderSettings(); fit(); changed(); markSaved(); flash(t("blankPlan"));
  setTool("select");
  let welcomed = false;
  try { welcomed = !!localStorage.getItem("wpth-welcomed"); } catch (e) {}
  if (!welcomed) showWelcome();
})();

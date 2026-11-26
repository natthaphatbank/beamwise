// Beamwise — main app: state, canvas rendering, tools, files.

const $ = sel => document.querySelector(sel);
const canvas = $("#canvas");
const ctx = canvas.getContext("2d");

// ---------- state ----------
function newProject() {
  const p = {
    version: 2,
    floors: [floorMeta("1", "f1")],  // every floor (floors.js); the active one mirrors the fields below
    floorIdx: 0,
    plan: { image: null, width: 1200, height: 800 },
    mPerPx: 30 / 1200,            // blank plan = 30 x 20 m
    scaleSet: false,
    walls: [],                     // {id, x1, y1, x2, y2, mat}
    aps: [],                       // {id, name, x, y, model, tx24/5/6, gain24/5/6, ch24/5/6, w24/5/6 (MHz), mount, h, az, bw}
    areas: [],                     // coverage boundary polygons {id, pts: [{x, y}]}
    attens: [],                    // attenuation zones {id, pts, preset, db24, db5, db6 (dB/m)} (model.js)
    openings: [],                  // holes in this floor's slab (atrium, void, stair well) {id, pts}
    notes: [],                     // map notes {id, x, y, text, cat, photo (data URL)}
    survey: [],                    // measured points {id, x, y, dbm, band} (survey.js)
    probes: [],                    // signal check pins {id, x, y}
    calib: null,                   // fitted model correction {n, off24, off5, off6, ...} or null
    settings: {
      band: "5", env: 1, opacity: 0.55,
      minDbm: "auto",              // display floor: "auto" = requirement - 15 dB
      req: "auto",                 // required RSSI: "auto" = by building type
      capNbtc: true,               // apply the country's power limits (REG in radio.js)
      country: "TH",
      client: "phone",             // receiving device (CLIENTS in model.js)
      clientH: DEFAULT_CLIENT_H,   // m above the floor
      margin: 3,                   // dB design margin for signal fluctuation (fading, people, devices)
      paths: true,                 // dominant paths around corners / along corridors
      waves: !matchMedia("(prefers-reduced-motion: reduce)").matches,
      rulers: true,
      dfs: false,                  // let auto channels use 5 GHz DFS channels (52–144)
      view: "signal",              // heatmap view (VIEW_DEFS in views.js)
      clientStd: "Wi-Fi 6",        // client device Wi-Fi standard (data rate view)
      clientSS: 2,                 // client spatial streams
      reqSet: "data",              // requirement set for network health (REQ_SETS in views.js)
      steer: true,                 // band steering: dual-band devices pushed to 5 / 6 GHz
      mlo: false,                  // Wi-Fi 7 multi-link: traffic of Wi-Fi 7 devices spread over bands
    },
    reqCustom: null,               // the "custom" requirement set {snr, rate, aps, cci, sec}
    newWallMat: "brick",
    newApModel: "generic-ax",
    newAttenPreset: "shelving",
    newDoor: { mat: "doorWood", width: 0.9 },   // Door / window tool
    bom: null,                     // bill of materials / quote settings (tables.js), created on first use
    patterns: null,                // measured antenna patterns per model and band (antenna.js)
    materials: [],                 // user wall materials {key "u_…", name, db24, db5, db6, thick (cm), color, door, window}
    report: null,                  // PDF report cover fields {title, customer, author, notes} (report-pdf.js)
  };
  for (const k of FLOOR_FIELDS) p.floors[0][k] = p[k];
  return p;
}

// Required RSSI and heatmap display floor (both can be automatic).
// reqDbm() includes the design margin: an area counts as covered only with that much headroom.
function baseReqDbm() {
  const st = project.settings;
  return st.req === "auto" ? (REQ_AUTO_BY_ENV[st.env] ?? -67) : +st.req;
}
function reqDbm() { return baseReqDbm() + (+project.settings.margin || 0); }
function effMinDbm() {
  const st = project.settings;
  return st.minDbm === "auto" ? baseReqDbm() - 15 : +st.minDbm;
}
// "≥ -67 dBm + 3 dB margin"
function reqText() {
  const mg = +project.settings.margin || 0;
  return `≥ ${baseReqDbm()} dBm` + (mg ? ` + ${mg} dB ${t("marginShort")}` : "");
}

// Older projects stored a single `gain`; give every AP per-band gain and a model id.
function normalizeAp(ap) {
  if (ap.gain24 == null) ap.gain24 = ap.gain ?? 3;
  if (ap.gain5 == null) ap.gain5 = ap.gain ?? 3;
  delete ap.gain;
  if (!ap.model) ap.model = "custom";
  if (ap.tx6 == null) { const m = AP_BY_ID[ap.model]; ap.tx6 = m ? m.tx6 : 0; ap.gain6 = m ? m.gain6 : 0; }
  if (ap.gain6 == null) ap.gain6 = 0;
  if (ap.ch6 === undefined) ap.ch6 = null;
  for (const b of BAND_LIST) ap["w" + BK[b]] = apWidth(ap, b);
  if (!MOUNTS[ap.mount]) Object.assign(ap, mountForModel(AP_BY_ID[ap.model]));
  if (!(ap.h >= 0)) ap.h = MOUNTS[ap.mount].h;
  if (!Number.isFinite(ap.az)) ap.az = 0;
  if (!(ap.bw > 0)) ap.bw = DEFAULT_BW;
  return ap;
}
function makeAp(p, spec) {
  spec = spec || AP_BY_ID[project.newApModel] || AP_BY_ID["generic-ax"];
  // a ceiling AP inside an area with its own ceiling height goes up there
  const ceilArea = (project.areas || []).slice().reverse().find(a => a.ceil && a.pts?.length >= 3 && pointInPoly(p.x, p.y, a.pts));
  const mnt = mountForModel(spec);
  if (ceilArea && mnt.mount === "ceiling") mnt.h = ceilArea.ceil;
  return { id: uid(), name: "AP-" + (project.aps.length + 1), x: p.x, y: p.y,
           model: spec.id, tx24: spec.tx24, tx5: spec.tx5, tx6: spec.tx6 || 0, gain24: spec.gain24, gain5: spec.gain5, gain6: spec.gain6 || 0,
           ch24: null, ch5: null, ch6: null, w24: DEFAULT_WIDTH["2.4"], w5: DEFAULT_WIDTH["5"], w6: DEFAULT_WIDTH["6"],
           ...mnt, az: 0, bw: DEFAULT_BW };
}

// UI theme: "dark" (default) or "light"; the <head> script applies it before first paint.
let uiTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
function setTheme(th) {
  uiTheme = th === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = uiTheme;
  try { localStorage.setItem("wpth-theme", uiTheme); } catch (e) {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", uiTheme === "dark" ? "#161c26" : "#ffffff");
  const b = document.querySelector("#btnTheme");
  if (b) {
    b.title = t(uiTheme === "dark" ? "themeLight" : "themeDark");
    let l = b.querySelector(".menu-label");
    if (!l) { l = document.createElement("span"); l.className = "menu-label"; b.appendChild(l); }
    l.textContent = b.title;
  }
  requestRender();
  if (typeof View3D !== "undefined") View3D.refresh();
}

let project = newProject();
let planImg = null;                // HTMLImageElement of plan.image
let view = { s: 1, ox: 0, oy: 0 };
let tool = "select";
let selection = null;              // {type: 'ap'|'wall'|'area'|'survey', id} | {type: 'aps'|'walls', ids} | {type: 'mixed', aps, walls}
let drag = null;
let wallChain = null;              // {x, y} start of next wall segment
let scaleLine = null;              // {a:{x,y}, b:{x,y}|null}
let areaDraft = null;              // [{x,y}] points of the boundary being drawn
let probeActive = -1;              // index in project.probes of the pin shown in the panel
let probeX = null;                 // world rect of the active pin's × (delete) button
let heatMask = null;               // Uint8Array from areaMask(), null = no boundary
let cursor = null;                 // world coords
let spaceDown = false;
let undoStack = [], redoStack = [];
let heat = null, heatCanvas = null, heatDirty = true, heatCoarse = false;
let viewGrids = null;              // {best, view, per, loads} from computeViewGrids (views.js)
let heatAreaIdx = null, heatReq = null;   // area index / requirement per heat cell (areas with their own requirement)
let capLoads = null;               // airtime per AP on the band shown (capacityLoads), null without demand
const curView = () => VIEW_DEFS[project.settings.view] ? project.settings.view : "signal";
let needsRender = true;
let nextId = 1;

const uid = () => (nextId++).toString(36) + Date.now().toString(36).slice(-4);

// ---------- history ----------
function snapshot() {
  return JSON.stringify({ walls: project.walls, aps: project.aps, areas: project.areas, attens: project.attens, openings: project.openings, notes: project.notes, survey: project.survey, probes: project.probes, calib: project.calib, mPerPx: project.mPerPx, scaleSet: project.scaleSet });
}
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
}
function restore(snap) {
  Object.assign(project, JSON.parse(snap));
  project.aps.forEach(normalizeAp);
  if (selection?.type === "aps" || selection?.type === "walls" || selection?.type === "mixed") { const s = selIds(); setSelection(s.aps, s.walls); }
  if (selection && !findSel()) selection = null;
  if (!project.probes[probeActive]) probeActive = project.probes.length - 1;
  changed();
}
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); }

// Several APs can be selected at once: selection = {type: "aps", ids: [...]}.
function selectedAps() {
  if (selection?.type === "ap") return project.aps.filter(a => a.id === selection.id);
  if (selection?.type === "aps") return project.aps.filter(a => selection.ids.includes(a.id));
  if (selection?.type === "mixed") return project.aps.filter(a => selection.aps.includes(a.id));
  return [];
}
const isApSelected = ap => (selection?.type === "ap" && selection.id === ap.id) || (selection?.type === "aps" && selection.ids.includes(ap.id)) ||
  (selection?.type === "mixed" && selection.aps.includes(ap.id));
function selectAps(ids) {
  ids = [...new Set(ids)].filter(id => project.aps.some(a => a.id === id));
  selection = !ids.length ? null : ids.length === 1 ? { type: "ap", id: ids[0] } : { type: "aps", ids };
}
// Walls can be multi-selected too, alone ({type: "walls", ids}) or with APs ({type: "mixed"}).
function selIds() {
  const s = selection;
  if (!s) return { aps: [], walls: [] };
  if (s.type === "ap") return { aps: [s.id], walls: [] };
  if (s.type === "aps") return { aps: [...s.ids], walls: [] };
  if (s.type === "wall") return { aps: [], walls: [s.id] };
  if (s.type === "walls") return { aps: [], walls: [...s.ids] };
  if (s.type === "mixed") return { aps: [...s.aps], walls: [...s.walls] };
  return { aps: [], walls: [] };
}
function setSelection(apIds, wallIds) {
  apIds = [...new Set(apIds)].filter(id => project.aps.some(a => a.id === id));
  wallIds = [...new Set(wallIds)].filter(id => project.walls.some(w => w.id === id));
  if (!wallIds.length) { selectAps(apIds); return; }
  if (!apIds.length) { selection = wallIds.length === 1 ? { type: "wall", id: wallIds[0] } : { type: "walls", ids: wallIds }; return; }
  selection = { type: "mixed", aps: apIds, walls: wallIds };
}
function selectedWalls() {
  const ids = selIds().walls;
  return project.walls.filter(w => ids.includes(w.id));
}
const isWallSelected = w => (selection?.type === "wall" && selection.id === w.id) ||
  (selection?.type === "walls" && selection.ids.includes(w.id)) || (selection?.type === "mixed" && selection.walls.includes(w.id));
const isGroupSel = () => selection && (selection.type === "aps" || selection.type === "walls" || selection.type === "mixed");
// Does segment (x1,y1)-(x2,y2) touch the rectangle?
function segTouchesRect(x1, y1, x2, y2, rx0, ry0, rx1, ry1) {
  const inR = (x, y) => x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1;
  if (inR(x1, y1) || inR(x2, y2)) return true;
  const edges = [[rx0, ry0, rx1, ry0], [rx1, ry0, rx1, ry1], [rx1, ry1, rx0, ry1], [rx0, ry1, rx0, ry0]];
  return edges.some(([a, b, c, d]) => {
    const den = (x2 - x1) * (d - b) - (y2 - y1) * (c - a);
    if (den === 0) return false;
    const u = ((a - x1) * (d - b) - (b - y1) * (c - a)) / den, v = ((a - x1) * (y2 - y1) - (b - y1) * (x2 - x1)) / den;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1;
  });
}
function selectAllAps() {
  if (!project.aps.length) return;
  if (tool !== "select") setTool("select");
  selectAps(project.aps.map(a => a.id)); renderPanel(); requestRender();
}

function findSel() {
  if (!selection) return null;
  if (selection.type === "aps") { const l = selectedAps(); return l.length ? l : null; }
  if (selection.type === "walls") { const l = selectedWalls(); return l.length ? l : null; }
  if (selection.type === "mixed") { const a = selectedAps(), w = selectedWalls(); return a.length || w.length ? { aps: a, walls: w } : null; }
  const list = selection.type === "ap" ? project.aps : selection.type === "area" ? project.areas : selection.type === "atten" ? (project.attens || [])
    : selection.type === "opening" ? (project.openings || []) : selection.type === "note" ? (project.notes || [])
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
let viewFitted = true;            // still the automatic "fit": re-fit when the canvas changes size
function fit() {
  const r = canvas.getBoundingClientRect();
  const { width: W, height: H } = project.plan;
  const R = rulersOn() ? RULER : 0;
  // not laid out yet (zero-size canvas): a negative scale would break drawing, so fit on the next resize
  if (r.width <= R + 1 || r.height <= R + 1) { fitPending = true; return; }
  fitPending = false;
  viewFitted = true;
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
  if (fitPending || viewFitted) fit();
  requestRender();
}

// ---------- heatmap ----------
function updateHeat() {
  syncActive();
  const { width: W, height: H } = project.plan;
  const view = curView();
  const target = heatCoarse ? 110 : view === "signal" ? 340 : 240;   // per-AP views cost more
  const cell = Math.max(2, Math.max(W, H) / target);
  viewGrids = computeViewGrids(project, project.settings.band, cell, view);
  heat = viewGrids.best;
  heatCanvas = view === "signal" ? heatmapToCanvas(heat, effMinDbm()) : viewToCanvas(viewGrids, view, effMinDbm());
  heatAreaIdx = projectAreas(project).length ? areaIndexGrid(project, heat) : null;
  heatReq = heatAreaIdx && projectAreas(project).some(a => a.req !== "auto" && a.req != null)
    ? reqGrid(project, heat, reqDbm(), +project.settings.margin || 0, heatAreaIdx) : null;
  // capacity: from the view's own per-AP grid, else a coarse extra pass (skipped while dragging)
  capLoads = viewGrids.loads || null;
  if (!capLoads && hasDemand(project) && project.aps.length && !heatCoarse)
    capLoads = computeViewGrids(project, project.settings.band, Math.max(2, Math.max(W, H) / 120), "capacity").loads;
  const slot = $("#apLoadSlot");
  if (slot && selection?.type === "ap") { const ap = findSel(); slot.innerHTML = ap ? apLoadHtml(ap) : ""; }
  heatMask = areaMask(project, heat);
  heatDirty = false;
  renderStats();
  View3D.refresh();
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
  const { rf, sources } = modelFor(project, band);
  const floor = effMinDbm();
  const now = performance.now() / 1000;
  const { width: W, height: H } = project.plan;
  c.save();
  c.beginPath(); c.rect(0, 0, W, H); c.clip();      // keep waves on the plan
  if (clipToAreas(c)) c.clip();                     // ...and inside the coverage boundary
  c.lineWidth = 2.4 * px; c.lineCap = "round";
  project.aps.forEach((ap, idx) => {
    const src = sources[idx];
    if (src.dead) return;
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
        const db = sourceRssi(rf, src, (px0 + px1) / 2, (py0 + py1) / 2, floor - 1);
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
    const isSel = interactive && isWallSelected(w);
    if (isSel) {
      c.strokeStyle = P.wallSel; c.lineWidth = 10 * px;
      c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
    }
    if (m.door || m.window) drawOpening(c, px, w, m);
    else {
      c.strokeStyle = m.color; c.lineWidth = 4 * px;
      c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
    }
    if (isSel && selection.type === "wall") for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) handle(c, px, x, y);
  }

  // floor openings (atrium, void): dark dashed outline with an X
  for (const z of project.openings || []) {
    if (!z.pts || z.pts.length < 3) continue;
    const isSel = interactive && selection?.type === "opening" && selection.id === z.id;
    c.save();
    c.beginPath(); z.pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath();
    c.fillStyle = "rgba(20,30,50,0.18)"; c.fill();
    c.strokeStyle = isSel ? P.sel : P.text; c.globalAlpha = isSel ? 1 : 0.7; c.lineWidth = (isSel ? 2.5 : 1.5) * px; c.setLineDash([7 * px, 4 * px]); c.stroke(); c.setLineDash([]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of z.pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    c.clip(); c.lineWidth = 1 * px; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.moveTo(x1, y0); c.lineTo(x0, y1); c.stroke();
    c.restore();
    if (isSel) for (const q of z.pts) handle(c, px, q.x, q.y);
  }

  // attenuation zones: tinted, hatched polygons
  for (const z of project.attens || []) {
    if (!z.pts || z.pts.length < 3) continue;
    const isSel = interactive && selection?.type === "atten" && selection.id === z.id;
    const col = (ATTEN_PRESETS[z.preset] || ATTEN_PRESETS.custom).color;
    c.save();
    c.beginPath(); z.pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath();
    c.fillStyle = col + "33"; c.fill();
    c.clip();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of z.pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    c.strokeStyle = col + "88"; c.lineWidth = 1.2 * px; c.beginPath();
    const step = 10 * px;
    for (let k = x0 - (y1 - y0); k < x1; k += step) { c.moveTo(k, y1); c.lineTo(k + (y1 - y0), y0); }
    c.stroke(); c.restore();
    c.beginPath(); z.pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath();
    c.strokeStyle = isSel ? P.sel : col; c.lineWidth = (isSel ? 3 : 1.8) * px; c.stroke();
    if (isSel) for (const q of z.pts) handle(c, px, q.x, q.y);
  }

  // walls of the floor below and APs on the floors above / below
  if (interactive) drawOtherFloors(c, px);

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

  // notes, measuring line
  drawNotes(c, px, interactive);
  if (interactive && tool === "measure") drawMeasure(c, px);

  // broadcast waves (screen only)
  if (interactive && project.settings.waves) drawWaves(c, px);

  // site-survey points
  (project.survey || []).forEach((pt, i) => drawSurveyPoint(c, px, pt, i + 1, interactive && selection?.type === "survey" && selection.id === pt.id));

  // access points
  for (const ap of project.aps) drawAp(c, px, ap, interactive && isApSelected(ap));

  if (!interactive) return;

  probeX = null;
  project.probes.forEach((pt, i) => drawProbe(c, px, pt, tool === "probe" && i === probeActive));

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
    const crossing = drag.b.x < drag.a.x;           // right-to-left: anything the box touches
    c.fillStyle = crossing ? "rgba(60,200,120,0.12)" : P.selFill; c.fillRect(x, y, w, h);
    c.strokeStyle = crossing ? "rgb(60,200,120)" : P.sel; c.lineWidth = 1.5 * px;
    if (crossing) c.setLineDash([6 * px, 4 * px]);
    c.strokeRect(x, y, w, h); c.setLineDash([]);
  }

  // boundary being drawn
  if (isPolyTool() && areaDraft) {
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

// Door: leaf in the wall line plus a dashed quarter-circle swing; window: two thin parallel lines.
function drawOpening(c, px, w, m) {
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
  c.save();
  c.strokeStyle = m.color;
  if (m.window) {
    const o = 2.2 * px;
    c.lineWidth = 1.6 * px;
    c.beginPath();
    for (const s of [-1, 1]) { c.moveTo(w.x1 - uy * o * s, w.y1 + ux * o * s); c.lineTo(w.x2 - uy * o * s, w.y2 + ux * o * s); }
    c.stroke();
    c.lineWidth = 1 * px; c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
  } else {
    c.lineWidth = 3 * px; c.lineCap = "butt";
    const a0 = Math.atan2(uy, ux);
    c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x1 + Math.cos(a0 - Math.PI / 2) * L, w.y1 + Math.sin(a0 - Math.PI / 2) * L); c.stroke();
    c.lineWidth = 1.2 * px; c.setLineDash([4 * px, 3 * px]);
    c.beginPath(); c.arc(w.x1, w.y1, L, a0 - Math.PI / 2, a0); c.stroke();
    c.setLineDash([]);
  }
  c.restore();
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
  // directional antenna: half-power beam as a wedge
  if (ap.mount === "directional") {
    const a = (ap.az || 0) * Math.PI / 180, h = ((ap.bw || DEFAULT_BW) / 2) * Math.PI / 180, R = r * 3.2;
    c.fillStyle = P.selFill; c.strokeStyle = P.sel; c.lineWidth = 1.2 * px;
    c.beginPath(); c.moveTo(x, y); c.arc(x, y, R, a - h, a + h); c.closePath(); c.fill(); c.stroke();
  }
  // serving-AP view: ring in the AP's zone colour
  if (curView() === "serving") {
    const idx = project.aps.indexOf(ap);
    if (idx >= 0) { c.strokeStyle = `rgb(${apColor(idx)})`; c.lineWidth = 4 * px; c.beginPath(); c.arc(x, y, r + 3 * px, 0, 7); c.stroke(); }
  }
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
  const bnd = project.settings.band, chv = apCh(ap, bnd), wv = apWidth(ap, bnd);
  const ch = apTx(ap, bnd) > 0 ? (chv != null ? `ch ${chv}` + (wv !== 20 ? ` · ${wv}` : "") : "") : t("noRadio");
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

// ---------- signal check (probe) ----------
// Predicted signal at a point from every AP on both bands, using the same model as the heatmap.
let probeMemo = { heat: null, map: new Map() };
function probeAt(x, y) {
  if (probeMemo.heat !== heat) probeMemo = { heat, map: new Map() };   // heatmap recomputed = project changed
  const key = x.toFixed(2) + "," + y.toFixed(2);
  let r = probeMemo.map.get(key);
  if (r) return r;
  const perAp = project.aps.map(ap => ({ ap, "2.4": -Infinity, "5": -Infinity, "6": -Infinity }));
  for (const band of BAND_LIST) {
    if (!project.aps.length) break;
    const { rf, sources } = modelFor(project, band);
    sources.forEach((src, i) => { perAp[i][band] = sourceRssi(rf, src, x, y); });
  }
  const best = b => perAp.reduce((m, a) => Math.max(m, a[b]), -Infinity);
  r = { "2.4": best("2.4"), "5": best("5"), "6": best("6"), perAp };
  if (probeMemo.map.size > 400) probeMemo.map.clear();
  probeMemo.map.set(key, r);
  return r;
}
// Quality against the requirement: [class, i18n key]
function probeGrade(v) {
  if (!Number.isFinite(v)) return ["bad", "probeNone"];
  if (v >= reqDbm()) return ["good", "probeOk"];
  if (v >= baseReqDbm()) return ["warn", "probeTight"];
  if (v >= effMinDbm()) return ["bad", "probeWeak"];
  return ["bad", "probeDead"];
}
const fmtDbm = v => Number.isFinite(v) ? `${Math.round(v)} dBm` : "—";
// heatmap value under a world point (fast, for the live status-bar readout)
function heatAt(p, grid = heat) {
  if (!grid || heatDirty || !project.aps.length) return null;   // stale grid: skip until the next frame
  const c = Math.floor(p.x / grid.cell), r = Math.floor(p.y / grid.cell);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return null;
  return grid.data[r * grid.cols + c];
}
// "≈ 24 dB SINR" etc. for the status bar
function viewReadout(p) {
  const v = curView(), hv = heatAt(p);
  if (hv == null) return "";
  if (v === "signal" || !viewGrids) return ` · ≈ ${fmtDbm(hv)}`;
  const x = heatAt(p, viewGrids.view);
  if (x == null || hv < effMinDbm()) return ` · ≈ ${fmtDbm(hv)}`;
  return ` · ${fmtViewVal(v, x)}`;
}
function fmtViewNum(v, x) {
  if (!Number.isFinite(x)) return "—";
  if (v === "signal" || v === "secondary" || v === "tertiary") return fmtDbm(x);
  if (v === "rate" || v === "throughput") return `${x >= 100 ? Math.round(x) : x.toFixed(1)} Mbps`;
  if (v === "cci" || v === "apcount" || v === "health") return String(Math.round(x * 10) / 10);
  if (v === "loss") return `${x < 10 ? x.toFixed(1) : Math.round(x)}%`;
  if (v === "rtt") return `${Math.round(x)} ms`;
  if (v === "capacity") return `${Math.round(x)}%`;
  return `${Math.round(x)} dB`;
}
function fmtViewVal(v, x) {
  if (v === "serving") return `${t("view_serving")}: ${esc(project.aps[x]?.name || "AP")}`;
  return `${t("view_" + v)}: ${fmtViewNum(v, x)}`;
}
function hitProbe(p) {
  const tol = 12 * touchK / view.s;
  for (let i = project.probes.length - 1; i >= 0; i--) if (Math.hypot(project.probes[i].x - p.x, project.probes[i].y - p.y) <= tol) return i;
  return -1;
}
function drawProbe(c, px, pt, isActive) {
  const band = project.settings.band, v = probeAt(pt.x, pt.y)[band];
  const col = Number.isFinite(v) ? `rgb(${signalColor(v)})` : P.plan;
  const x = pt.x, y = pt.y, r = 7 * px;
  c.save();
  // crosshair pin
  c.strokeStyle = isActive ? P.sel : P.text; c.lineWidth = 1.5 * px;
  c.beginPath(); c.moveTo(x - r * 1.9, y); c.lineTo(x - r * 0.6, y); c.moveTo(x + r * 0.6, y); c.lineTo(x + r * 1.9, y);
  c.moveTo(x, y - r * 1.9); c.lineTo(x, y - r * 0.6); c.moveTo(x, y + r * 0.6); c.lineTo(x, y + r * 1.9); c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 0.55, 0, 7); c.fill(); c.stroke();
  // value tag
  const txt = fmtDbm(v);
  c.font = `700 ${12 * px}px "Segoe UI", sans-serif`;
  const xw = isActive ? 18 * px : 0;                 // room for the × (delete) button
  const w = c.measureText(txt).width + 22 * px + xw, h = 20 * px, ty = y - h - r * 0.6;
  let tx = x + r * 2.2;
  if (view.ox + (tx + w) * view.s > canvas.clientWidth - 8) tx = x - r * 2.2 - w;   // near the right edge: tag on the left
  c.fillStyle = P.tagBg; c.strokeStyle = isActive ? P.sel : P.tagLine; c.lineWidth = (isActive ? 1.6 : 1) * px;
  roundRect(c, tx, ty, w, h, 4 * px); c.fill(); c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(tx + 8 * px, ty + h / 2, 4 * px, 0, 7); c.fill();
  c.fillStyle = P.text; c.textAlign = "left"; c.textBaseline = "middle";
  c.fillText(txt, tx + 15 * px, ty + h / 2 + 0.5 * px);
  if (isActive) {
    const bx = tx + w - xw;
    c.strokeStyle = P.tagLine; c.lineWidth = px;
    c.beginPath(); c.moveTo(bx, ty + 3 * px); c.lineTo(bx, ty + h - 3 * px); c.stroke();
    const cx = bx + xw / 2, cy = ty + h / 2, k = 3.5 * px;
    c.strokeStyle = P.text; c.lineWidth = 1.6 * px;
    c.beginPath(); c.moveTo(cx - k, cy - k); c.lineTo(cx + k, cy + k); c.moveTo(cx + k, cy - k); c.lineTo(cx - k, cy + k); c.stroke();
    const pad = 4 * px * touchK;
    probeX = { x0: bx - pad, x1: bx + xw + pad, y0: ty - pad, y1: ty + h + pad };
  }
  c.restore();
}
function clearProbes() { project.probes = []; probeActive = -1; }
function addProbe(p) {
  pushHistory();
  project.probes.push({ id: uid(), x: p.x, y: p.y });
  probeActive = project.probes.length - 1;
}
function deleteProbe(i) {
  if (!project.probes[i]) return;
  pushHistory();
  project.probes.splice(i, 1);
  probeActive = Math.min(probeActive, project.probes.length - 1);
  if (i < probeActive) probeActive--;
  renderPanel(); requestRender();
}
const inProbeX = p => probeX && p.x >= probeX.x0 && p.x <= probeX.x1 && p.y >= probeX.y0 && p.y <= probeX.y1;

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

// Map-style scale bar: alternating black / white blocks, "0 … N m", and whether the scale was measured.
// (x, y) = bottom-right corner in the context's current units; pxPerM = those units per metre.
const scaleIsSet = () => project.scaleSet || !project.plan.image;   // blank grid plans are drawn to scale
function drawScaleBar(c, x, y, pxPerM, { u = 1, theme = P, maxW = 160 } = {}) {
  const lenM = niceStep(maxW * 0.45 / pxPerM);
  let n = lenM;                                       // largest nice length that fits maxW
  for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) if (s * pxPerM <= maxW && s >= lenM) n = s;
  if (n * pxPerM > maxW) n = lenM;
  const segs = String(n)[0] === "2" ? 4 : 5, w = n * pxPerM, bh = 6 * u;
  const fmt = v => (Math.round(v * 100) / 100).toString();
  const set = scaleIsSet();
  const note = set ? `1 m = ${(1 / project.mPerPx).toFixed(1)} px` : t("scaleEstimate");
  c.save();
  c.font = `600 ${11 * u}px "Segoe UI", "Leelawadee UI", sans-serif`;
  const noteW = c.measureText(note).width;
  const boxW = Math.max(w + 22 * u, noteW + 16 * u), boxH = 44 * u;
  const bx = x - boxW, by = y - boxH;
  c.fillStyle = theme.tagBg; c.strokeStyle = set ? theme.tagLine : "#e0a23a"; c.lineWidth = u;
  roundRect(c, bx, by, boxW, boxH, 5 * u); c.fill(); c.stroke();
  const x0 = bx + (boxW - w) / 2, y0 = by + 19 * u;
  for (let i = 0; i < segs; i++) {
    c.fillStyle = i % 2 ? theme.tagBg : theme.text;
    c.fillRect(x0 + i * w / segs, y0, w / segs, bh);
  }
  c.strokeStyle = theme.text; c.strokeRect(x0, y0, w, bh);
  c.fillStyle = theme.text; c.textBaseline = "bottom";
  c.textAlign = "left"; c.fillText("0", x0 - 2 * u, y0 - 2 * u);
  c.textAlign = "right"; c.fillText(fmt(n) + " m", x0 + w + 4 * u, y0 - 2 * u);
  c.textAlign = "center"; c.textBaseline = "top"; c.font = `${10.5 * u}px "Segoe UI", "Leelawadee UI", sans-serif`;
  c.fillStyle = set ? theme.tagMuted : "#c27a00"; c.fillText(note, bx + boxW / 2, y0 + bh + 4 * u);
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (rulersOn()) drawRulers(ctx);
  drawScaleBar(ctx, canvas.clientWidth - 12, canvas.clientHeight - 12, view.s / project.mPerPx);
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
const isPolyTool = () => tool === "area" || tool === "atten" || tool === "opening";
const hitOpening = p => hitArea(p, project.openings) || (project.openings || []).slice().reverse().find(z => z.pts?.length >= 3 && pointInPoly(p.x, p.y, z.pts)) || null;
const hitAtten = p => hitArea(p, project.attens) || (project.attens || []).slice().reverse().find(z => z.pts?.length >= 3 && pointInPoly(p.x, p.y, z.pts)) || null;
function hitArea(p, list = project.areas) {
  const tol = 8 * touchK / view.s;
  let best = null, bd = tol;
  for (const a of list || []) {
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
// lock: keep the segment from `anchor` exactly horizontal or vertical. Wall end points nearby
// still snap, but only along the locked direction, so the line never comes out slanted.
function snapPoint(p, anchor, lock, skip = null) {
  const tol = 10 * touchK / view.s;
  let q = { x: p.x, y: p.y };
  const locked = lock && anchor;
  if (locked) {
    if (Math.abs(p.x - anchor.x) >= Math.abs(p.y - anchor.y)) q.y = anchor.y; else q.x = anchor.x;
  }
  const horiz = locked && q.y === anchor.y;
  for (const w of project.walls) {
    if (w === skip) continue;
    for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) {
      if (Math.hypot(q.x - x, q.y - y) > tol) continue;
      if (!locked) return { x, y };
      return horiz ? { x, y: anchor.y } : { x: anchor.x, y };
    }
  }
  return q;
}

// Straight-line mode (on by default): walls and boundaries go horizontal / vertical.
// Holding Shift flips it for that point (free angle while on, locked while off). O toggles it.
let orthoOn = true;
try { orthoOn = localStorage.getItem("bw-ortho") !== "0"; } catch (e) {}
const lockAngle = shift => orthoOn !== !!shift;
function setOrtho(on) {
  orthoOn = on;
  try { localStorage.setItem("bw-ortho", on ? "1" : "0"); } catch (e) {}
  updateOrthoBtn(); requestRender();
}
function updateOrthoBtn() {
  const b = $("#btnOrtho");
  if (!b) return;
  b.hidden = !(tool === "wall" || isPolyTool() || selection?.type === "wall");
  b.classList.toggle("on", orthoOn);
  b.setAttribute("aria-pressed", String(orthoOn));
  b.innerHTML = t(orthoOn ? "orthoOn" : "orthoOff") + (touchUI ? "" : ` <small>${t(orthoOn ? "orthoShiftFree" : "orthoShiftLock")}</small>`);   // no Shift key on touch
}
$("#btnOrtho").addEventListener("click", () => setOrtho(!orthoOn));
const snapWall = (p, shift = window.__shift) => snapPoint(p, wallChain, lockAngle(shift));
const snapArea = (p, shift = window.__shift) => snapPoint(p, areaDraft?.[areaDraft.length - 1], lockAngle(shift));

const fmtLen = px => (px * project.mPerPx).toFixed(2) + " m";
const fmtArea = px2 => (px2 * project.mPerPx ** 2).toFixed(1) + " m²";

// ---------- tools ----------
let hintTimer;
// Touch screens (phones, tablets): finger-friendly hint texts, shorter-lived hints.
let touchUI = matchMedia("(pointer: coarse)").matches;
function showHint(text) {
  const h = $("#hint");
  h.textContent = text; h.style.opacity = 1;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { h.style.opacity = 0; }, touchUI ? 4000 : 6000);
}
// "hintWall" -> "hintWallTouch" on touch screens when that text exists
const hintKey = k => (touchUI && I18N.en[k + "Touch"] ? k + "Touch" : k);

function setTool(name) {
  if (name !== "select") emptyDismissed = true;
  if (name !== "measure" && typeof measure !== "undefined") measure = null;
  if (name !== tool) finishArea();
  tool = name;
  wallChain = null;
  updateFinishBtn();
  if (name !== "scale") scaleLine = null;
  document.querySelectorAll("#tools [data-tool]").forEach(b => b.classList.toggle("active", b.dataset.tool === name));
  const hints = { note: "hintNote", measure: "hintMeasure", opening: "hintOpening", select: "hintSelect", pan: "hintPan", scale: "hintScale", wall: "hintWall", ap: "hintAp", area: "hintArea", atten: "hintAtten", survey: "hintSurvey", probe: "hintProbe", door: "hintDoor" };
  showHint(t(hintKey(hints[name])));
  updateOrthoBtn();
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
  else if (selection.type === "walls") project.walls = project.walls.filter(w => !o.includes(w));
  else if (selection.type === "mixed") { project.aps = project.aps.filter(a => !o.aps.includes(a)); project.walls = project.walls.filter(w => !o.walls.includes(w)); }
  else if (selection.type === "area") project.areas = project.areas.filter(a => a !== o);
  else if (selection.type === "atten") project.attens = project.attens.filter(a => a !== o);
  else if (selection.type === "opening") project.openings = project.openings.filter(a => a !== o);
  else if (selection.type === "note") project.notes = project.notes.filter(a => a !== o);
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
  if ((e.pointerType === "touch") !== touchUI && e.pointerType !== "pen") { touchUI = e.pointerType === "touch"; }
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
  if (e.button === 2 && tool !== "wall" && !isPolyTool()) {        // right-click a pin: remove it
    const pi = hitProbe(p);
    if (pi >= 0) { deleteProbe(pi); return; }
  }
  if (e.button === 2) { if (tool === "wall") finishWall(); else if (isPolyTool()) finishArea(); else if (tool === "select") startPan(e); return; }

  if (tool === "select") {
    const sel = findSel();
    if (sel && selection.type === "wall") {
      const end = hitWallEnd(p, sel);
      if (end) { drag = { type: "wallEnd", wall: sel, end, pushed: false }; return; }
    }
    if (sel && (selection.type === "area" || selection.type === "atten" || selection.type === "opening")) {
      const i = hitAreaPt(p, sel);
      if (i >= 0) { drag = { type: "areaPt", area: sel, i, pushed: false }; return; }
    }
    const ap = hitAp(p);
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    const toggle = (list, id) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];
    if (ap && multi) {                                   // Shift/Ctrl+click: add or remove from the selection
      const ids = selIds();
      setSelection(toggle(ids.aps, ap.id), ids.walls);
      renderPanel(); requestRender();
      return;
    }
    if (ap) {
      if (!isApSelected(ap)) selection = { type: "ap", id: ap.id };   // dragging a selected item moves the whole group
      drag = { type: "group", aps: selectedAps(), walls: selection.type === "mixed" ? selectedWalls() : [], last: p, pushed: false };
      renderPanel(); requestRender();
      return;
    }
    const nt = hitNote(p);
    if (nt && !multi) {
      selection = { type: "note", id: nt.id };
      drag = { type: "survey", pt: nt, last: p, pushed: false };
      renderPanel(); requestRender();
      return;
    }
    const wHit = !hitSurvey(p) && hitWall(p);
    if (wHit && multi) {
      const ids = selIds();
      setSelection(ids.aps, toggle(ids.walls, wHit.id));
      renderPanel(); requestRender();
      return;
    }
    if (wHit && isGroupSel() && isWallSelected(wHit)) {  // drag a selected wall: move the whole selection
      drag = { type: "group", aps: selectedAps(), walls: selectedWalls(), last: p, pushed: false };
      return;
    }
    // Shift+drag, or any mouse drag on empty space: box-select APs and walls
    if (multi || (e.pointerType === "mouse" && !wHit && !hitSurvey(p) && !hitArea(p) && !hitAtten(p))) {
      const ids = multi ? selIds() : { aps: [], walls: [] };
      drag = { type: "marquee", a: p, b: p, sx: e.clientX, sy: e.clientY, base: ids };
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
    const zn = hitAtten(p);
    if (zn) {
      selection = { type: "atten", id: zn.id };
      drag = { type: "area", area: zn, last: p, pushed: false };
      renderPanel(); requestRender();
      return;
    }
    const op = hitOpening(p);
    if (op) {
      selection = { type: "opening", id: op.id };
      drag = { type: "area", area: op, last: p, pushed: false };
      renderPanel(); requestRender();
      return;
    }
    if (selection) { selection = null; renderPanel(); requestRender(); }
    startPan(e);
    return;
  }

  // signal check: drag a pin to move it (live reading); the × on the active pin is a tap
  if (tool === "probe" && !inProbeX(p)) {
    const pi = hitProbe(p);
    if (pi >= 0) {
      probeActive = pi;
      drag = { type: "probe", pt: project.probes[pi], last: p, pushed: false };
      renderPanel(); requestRender();
      return;
    }
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
    view.s = s; viewFitted = false;
    view.ox = mx - r.left - wx * s;
    view.oy = my - r.top - wy * s;
    requestRender();
    return;
  }

  const p = toWorld(e);
  cursor = p;
  window.__shift = e.shiftKey;
  const inside = p.x >= 0 && p.y >= 0 && p.x <= project.plan.width && p.y <= project.plan.height;
  const hv = inside ? heatAt(p) : null;
  $("#stCursor").textContent = inside ? `x ${(p.x * project.mPerPx).toFixed(1)} m, y ${(p.y * project.mPerPx).toFixed(1)} m` +
    (hv != null ? `${viewReadout(p)} (${project.settings.band} GHz)` : "") : "—";

  if (pending && Math.hypot(e.clientX - pending.sx, e.clientY - pending.sy) > TAP_SLOP) {
    drag = { type: "pan", sx: pending.sx, sy: pending.sy, ox: pending.ox, oy: pending.oy };
    pending = null;
  }

  if (drag) {
    if (drag.type === "pan") {
      view.ox = drag.ox + (e.clientX - drag.sx); viewFitted = false;
      view.oy = drag.oy + (e.clientY - drag.sy);
      requestRender();
      return;
    }
    if (drag.type === "marquee") { drag.b = p; requestRender(); return; }
    if (drag.type === "probe") {
      if (!drag.pushed) { pushHistory(); drag.pushed = true; }
      drag.pt.x += p.x - drag.last.x; drag.pt.y += p.y - drag.last.y; drag.last = p;
      renderPanel(); requestRender();
      return;
    }
    if (!drag.pushed) { pushHistory(); drag.pushed = true; }
    if (drag.type === "group") {
      const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
      for (const a of drag.aps) { a.x += dx; a.y += dy; }
      for (const w of drag.walls) { w.x1 += dx; w.y1 += dy; w.x2 += dx; w.y2 += dy; }
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
      const q = snapPoint(p, anchor, lockAngle(e.shiftKey), w);
      if (drag.end === 1) { w.x1 = q.x; w.y1 = q.y; } else { w.x2 = q.x; w.y2 = q.y; }
    }
    changed({ coarse: true, panel: false });
    return;
  }

  if (tool === "select" && e.pointerType === "mouse") {
    canvas.style.cursor = hitAp(p) || hitSurvey(p) || hitWall(p) || hitArea(p) || hitAtten(p) ? "pointer" : "default";
  }
  if (rulersOn()) requestRender();
  if ((tool === "wall" && wallChain) || (isPolyTool() && areaDraft) || (tool === "scale" && scaleLine && !scaleLine.b)) requestRender();
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (pending && e.type === "pointerup") tapAction(pending);
  if (drag?.type === "marquee") {
    const x0 = Math.min(drag.a.x, drag.b.x), x1 = Math.max(drag.a.x, drag.b.x);
    const y0 = Math.min(drag.a.y, drag.b.y), y1 = Math.max(drag.a.y, drag.b.y);
    const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > TAP_SLOP;
    if (!moved) setSelection(drag.base.aps, drag.base.walls);       // a plain click on empty space
    else {
      const inR = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
      const crossing = drag.b.x < drag.a.x;
      const aps = project.aps.filter(a => inR(a.x, a.y)).map(a => a.id);
      const walls = project.walls.filter(w => crossing ? segTouchesRect(w.x1, w.y1, w.x2, w.y2, x0, y0, x1, y1)
                                                       : inR(w.x1, w.y1) && inR(w.x2, w.y2)).map(w => w.id);
      setSelection([...drag.base.aps, ...aps], [...drag.base.walls, ...walls]);
    }
    drag = null; renderPanel(); requestRender();
    return;
  }
  pending = null;
  if (drag?.type === "probe") { drag = null; scheduleAutosave(); return; }   // a pin does not change the heatmap
  if (drag && drag.type !== "pan" && drag.pushed) changed();   // fine heatmap after drag
  if (drag?.type === "pan") canvas.style.cursor = tool === "pan" ? "grab" : "default";
  drag = null;
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointerleave", () => { if (!drag) { cursor = null; $("#stCursor").textContent = "—"; requestRender(); } });
canvas.addEventListener("pointercancel", endPointer);

function tapAction({ p, shift }) {
  if (tool === "ap") { addAp(p); return; }
  if (tool === "door") { insertDoor(p); return; }
  if (tool === "measure") { measureTap(p); return; }
  if (tool === "note") {
    const hit = hitNote(p);
    if (hit) { selection = { type: "note", id: hit.id }; renderPanel(); requestRender(); }
    else addNote(p);
    return;
  }
  if (tool === "probe") {
    if (inProbeX(p)) { deleteProbe(probeActive); return; }
    const i = hitProbe(p);
    if (i >= 0) probeActive = i;
    else addProbe(p);
    selection = null;
    renderPanel(); requestRender();
    return;
  }
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
  if (isPolyTool()) {
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

// Door / window tool: cut the wall under the click and put a door, window or opening there,
// centred on the click (width in metres from the tool panel).
function insertDoor(p) {
  const w = hitWall(p);
  if (!w || MATERIALS[w.mat]?.door || MATERIALS[w.mat]?.window) { flash(t("doorNeedWall")); return; }
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
  const width = Math.min(L * 0.95, (+project.newDoor.width || 0.9) / project.mPerPx);
  let c = (p.x - w.x1) * ux + (p.y - w.y1) * uy;
  c = Math.max(width / 2, Math.min(L - width / 2, c));
  const a = c - width / 2, b = c + width / 2, P = s => [w.x1 + ux * s, w.y1 + uy * s];
  pushHistory();
  const i = project.walls.indexOf(w), out = [];
  if (a > 1) out.push({ id: uid(), x1: w.x1, y1: w.y1, x2: P(a)[0], y2: P(a)[1], mat: w.mat });
  if (project.newDoor.mat !== "opening") out.push({ id: uid(), x1: P(a)[0], y1: P(a)[1], x2: P(b)[0], y2: P(b)[1], mat: project.newDoor.mat });
  if (L - b > 1) out.push({ id: uid(), x1: P(b)[0], y1: P(b)[1], x2: w.x2, y2: w.y2, mat: w.mat });
  project.walls.splice(i, 1, ...out);
  selection = null;
  changed({ panel: false });
  flash(tf("doorAdded", { m: project.newDoor.mat === "opening" ? t("doorOpening") : matName(project.newDoor.mat) }));
}

function finishWall() { wallChain = null; updateFinishBtn(); requestRender(); }
// Close the boundary being drawn (needs 3+ points, otherwise it is discarded).
function finishArea() {
  if (!areaDraft) return;
  const pts = areaDraft;
  areaDraft = null;
  if (pts.length >= 3 && Math.abs(polyArea(pts)) * view.s * view.s > 25) {
    pushHistory();
    if (tool === "opening") {
      const z = { id: uid(), pts };
      project.openings = [...(project.openings || []), z];
      selection = { type: "opening", id: z.id };
      changed();
      flash(t("openingAdded"));
    } else if (tool === "atten") {
      const pr = ATTEN_PRESETS[project.newAttenPreset] ? project.newAttenPreset : "shelving";
      const P0 = ATTEN_PRESETS[pr];
      const z = { id: uid(), pts, preset: pr, db24: P0.db24, db5: P0.db5, db6: P0.db6 };
      project.attens = [...(project.attens || []), z];
      selection = { type: "atten", id: z.id };
      changed();
      flash(t("attenAdded"));
    } else {
      const a = { id: uid(), pts, name: "", req: "auto", devices: 0, app: "web", mbps: 2 };
      project.areas = [...(project.areas || []), a];
      selection = { type: "area", id: a.id };
      changed();
      flash(t("areaAdded"));
    }
  }
  updateFinishBtn();
  requestRender();
}
function cancelArea() { areaDraft = null; updateFinishBtn(); requestRender(); }
function updateFinishBtn() {
  const b = $("#btnFinishWall");
  const wall = tool === "wall" && wallChain, area = isPolyTool() && areaDraft;
  b.hidden = !(wall || area);
  b.textContent = t(area ? "finishArea" : "finishWall");
  b.disabled = !!area && areaDraft.length < 3;
}
$("#btnFinishWall").addEventListener("click", () => { if (isPolyTool()) finishArea(); else finishWall(); });

canvas.addEventListener("dblclick", () => { if (tool === "wall") finishWall(); if (isPolyTool()) finishArea(); if (tool === "measure" && measure) { measure.done = true; renderPanel(); requestRender(); } });

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const k = Math.exp(-e.deltaY * 0.0015);
  const s = Math.min(40, Math.max(0.05, view.s * k));
  view.ox = mx - (mx - view.ox) * (s / view.s);
  view.oy = my - (my - view.oy) * (s / view.s);
  view.s = s; viewFitted = false;
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
  if (e.key === "3" && !e.ctrlKey && !e.metaKey && !e.altKey) { View3D.toggle(); return; }
  if (View3D.isOpen()) {                                     // 2D editing keys do nothing while the plan is hidden
    if (e.key === "Escape") View3D.close();
    const map3 = { n: "note", r: "measure", v: "select", h: "pan", s: "scale", w: "wall", a: "ap", b: "area", z: "atten", m: "survey", p: "probe", d: "door", x: "opening" };
    if (!map3[e.key.toLowerCase()] || e.ctrlKey || e.metaKey) return;
    View3D.close();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") { e.preventDefault(); selectAllAps(); return; }
  if (e.code === "Space") { spaceDown = true; canvas.style.cursor = "grab"; e.preventDefault(); return; }
  const map = { n: "note", r: "measure", v: "select", h: "pan", s: "scale", w: "wall", a: "ap", b: "area", z: "atten", m: "survey", p: "probe", d: "door", x: "opening" };
  if (map[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) { openPanel(); setTool(map[e.key.toLowerCase()]); return; }
  if (e.key.toLowerCase() === "o" && !e.ctrlKey && !e.metaKey) { setOrtho(!orthoOn); return; }
  if (areaDraft && e.key === "Enter") { finishArea(); return; }
  if (areaDraft && e.key === "Backspace") {                  // remove the last boundary point
    areaDraft.pop(); if (!areaDraft.length) areaDraft = null;
    updateFinishBtn(); requestRender(); return;
  }
  if ((e.key === "Delete" || e.key === "Backspace") && tool === "probe") {
    deleteProbe(probeActive);
    return;
  }
  if (e.key === "Delete" || e.key === "Backspace") { deleteSelection(); return; }
  if (e.key === "Escape") {
    if (tool === "measure" && measure) { measure = null; renderPanel(); requestRender(); return; }
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
    `<button data-mat="${k}" class="${k === active ? "active" : ""}" title="${m.db24} / ${m.db5} / ${m.db6} dB">
       <span class="dot" style="background:${m.color}"></span>${esc(matName(k))}</button>`).join("")}</div>
    <button type="button" class="link-btn" data-manage-mats>${t("matManage")}</button>`;
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
           tx24: n(m.tx24), tx5: n(m.tx5), tx6: n(m.tx6), gain24: n(m.gain24), gain5: n(m.gain5), gain6: n(m.gain6) };
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
const plainModel = m => ({ id: m.id, brand: m.brand, model: m.model, std: m.std, tx24: m.tx24, tx5: m.tx5, tx6: m.tx6, gain24: m.gain24, gain5: m.gain5, gain6: m.gain6 });

function openModelManager(prefillId) {
  const base = AP_BY_ID[prefillId] || AP_BY_ID[project.newApModel] || AP_BY_ID["generic-ax"];
  const stds = WIFI_STDS;
  const render = () => {
    const lib = customLibrary();
    openModal(`<h2>${t("manageModels").replace(/^\+\s*/, "")}</h2>
      <p>${t("customModelsHelp")}</p>
      ${lib.length ? `<table class="calib-tbl model-tbl"><thead><tr><th>${t("brandLbl")}</th><th>${t("apModel")}</th><th>Std</th>
        <th>Tx 2.4/5/6<br><span class="u">dBm</span></th><th>Gain 2.4/5/6<br><span class="u">dBi</span></th><th></th></tr></thead><tbody>
        ${lib.map(m => `<tr><td>${esc(m.brand)}</td><td>${esc(m.model)}</td><td>${esc(m.std)}</td><td>${esc(m.tx24)} / ${esc(m.tx5)} / ${esc(m.tx6 || 0)}</td><td>${esc(m.gain24)} / ${esc(m.gain5)} / ${esc(m.gain6 || 0)}</td>
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
        <label class="field"><span>${t("tx6")} (dBm)</span><input id="cmTx6" type="number" step="1" min="0" max="36" value="${base.tx6 || 0}"></label>
        <label class="field"><span>${t("gain6")} (dBi)</span><input id="cmG6" type="number" step="0.1" min="0" max="20" value="${base.gain6 || 0}"></label>
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
                  tx24: num("#cmTx24"), tx5: num("#cmTx5"), tx6: num("#cmTx6"), gain24: num("#cmG24"), gain5: num("#cmG5"), gain6: num("#cmG6") };
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
  if (e.target.closest("[data-manage-mats]")) { openMaterialManager(); return; }
  const pb = e.target.closest("[data-patterns]");
  if (pb) { openPatternManager(pb.dataset.patterns); return; }
  const b = e.target.closest("[data-manage-models]");
  if (!b) return;
  const one = selectedAps();
  openModelManager(one.length === 1 ? one[0].model : null);
});
function eirpText(o) {
  const cap = project.settings.capNbtc;
  const part = b => { const raw = apTx(o, b) + apGain(o, b), e = apEirp(o, b, cap); return !Number.isFinite(e) ? "—" : e < raw ? `${raw}→<b>${e}</b>` : `<b>${raw}</b>`; };
  return `EIRP ${BAND_LIST.map(b => `${b}G ${part(b)}`).join(" · ")} dBm` + (cap ? ` (${project.settings.country || "TH"})` : "");
}

// Card title follows what the panel is showing (no generic "Properties" heading).
const noKey = label => label.replace(/\s*\([^)]*\)\s*$/, "");
function panelTitle(o) {
  if (tool === "scale") return noKey(t("toolScale"));
  if (tool === "probe") return noKey(t("toolProbe"));
  if (o && selection.type === "ap") return `Access Point: ${o.name || "AP"}`;
  if (o && selection.type === "aps") return tf("apsSelected", { n: o.length });
  if (o && selection.type === "wall") return t("tlWall");
  if (o && selection.type === "walls") return tf("wallsSelected", { n: o.length });
  if (o && selection.type === "mixed") return tf("itemsSelected", { a: o.aps.length, w: o.walls.length });
  if (o && selection.type === "area") return t("areaBoundary");
  if (o && selection.type === "atten") return t("attenZone");
  if (o && selection.type === "opening") return t("openingZone");
  if (o && selection.type === "note") return `${t("noteTitle")} #${project.notes.indexOf(o) + 1}`;
  if (tool === "note") return noKey(t("toolNote"));
  if (tool === "measure") return noKey(t("toolMeasure"));
  if (tool === "opening") return noKey(t("toolOpening"));
  if (tool === "atten") return noKey(t("toolAtten"));
  if (tool === "door") return noKey(t("toolDoor"));
  if (o && selection.type === "survey") return `${t("surveyPoint")} #${project.survey.indexOf(o) + 1}`;
  if (tool === "survey") return noKey(t("toolSurvey"));
  if (tool === "area") return noKey(t("toolArea"));
  if (tool === "wall") return noKey(t("toolWall"));
  return "";
}

// AP settings for one AP or several at once. With several, a field shows its value when
// every selected AP agrees, otherwise it is blank ("mixed"); editing it sets all of them.
function apLoadHtml(ap) {
  const i = project.aps.indexOf(ap), L = capLoads?.[i];
  if (!L) return "";
  const over = L.airtime > 1 || L.devices > DEVICES_PER_RADIO;
  return `<p class="unit ap-load ${over ? "warn-text" : ""}">${tf("apLoad", { b: project.settings.band, d: Math.round(L.devices), m: Math.round(L.demand), p: L.airtime > 9.99 ? "> 999" : Math.round(L.airtime * 100) })}</p>`;
}

const apHasPattern = a => !!project.patterns?.[a.model];
function patternRowHtml(aps) {
  const o = aps[0], same = aps.every(a => a.model === o.model);
  if (!same) return "";
  const e = project.patterns?.[o.model];
  const bands = e ? BAND_LIST.filter(b => e[b]).map(b => b + "G").join(", ") : "";
  return `<div class="row"><span>${t("patRow")}</span><b class="pat-state">${e ? `${t("patMeasured")} (${bands})` : t("patGeneric")}</b></div>
    <button class="btn" data-patterns="${esc(o.model)}">${t("patTitle")}</button>`;
}

function renderApPanel(el, aps) {
  const one = aps.length === 1, o = aps[0];
  const same = f => aps.every(a => a[f] === o[f]);
  const val = f => same(f) ? o[f] : "";
  const mixed = esc(t("mixedValues"));
  const num = (f, max, step) => `<input type="number" data-f="${f}" min="0" max="${max}" step="${step}" value="${val(f) ?? ""}" ${same(f) ? "" : `placeholder="${mixed}"`}>`;
  const chSel = (f, list, dfsMark) => `<select data-f="${f}">${same(f) ? "" : `<option value="__mixed" selected>${mixed}</option>`}<option value="" ${same(f) && o[f] == null ? "selected" : ""}>–</option>` +
    list.map(c => `<option value="${c}" ${same(f) && c === o[f] ? "selected" : ""}>${c}${dfsMark && isDfs(c) ? " DFS" : ""}</option>`).join("") + `</select>`;
  const wSel = b => { const f = "w" + BK[b]; return `<select data-f="${f}">${same(f) ? "" : `<option value="__mixed" selected>${mixed}</option>`}` +
    WIDTHS[b].map(w => `<option value="${w}" ${same(f) && o[f] === w ? "selected" : ""}>${w}</option>`).join("") + `</select>`; };
  const bandRow = b => { const k = BK[b]; return `<tr${b === project.settings.band ? ' class="cur"' : ""}><th>${b}</th><td>${num("tx" + k, 30, 1)}</td><td>${num("gain" + k, 15, 0.1)}</td><td>${chSel("ch" + k, regChannels(b), b === "5")}</td><td>${wSel(b)}</td></tr>`; };
  const modelSame = same("model");
  const spec = modelSame ? AP_BY_ID[o.model] : null;
  const eirpLine = () => one ? eirpText(o) : "";
  el.innerHTML = `
    ${one ? `<label class="row"><span>${t("apName")}</span><input type="text" data-f="name" value="${esc(o.name)}"></label>`
          : `<p class="unit">${t("multiHelp")}</p>`}
    <label class="row"><span>${t("apModel")}</span><select id="apModelSel">${modelSame ? "" : `<option value="__mixed" selected>${mixed}</option>`}${modelOptions(modelSame ? o.model : "", true)}</select></label>
    ${modelSearchHtml("apModelSearch")}
    <p class="unit model-info">${spec ? `${esc(spec.brand)} · ${esc(spec.std)} · ${t("modelNote")}` : ""}</p>
    <table class="band-grid"><thead><tr><th>GHz</th><th>Tx <span class="u">dBm</span></th><th>${t("gainShort")} <span class="u">dBi</span></th><th>${t("chShort")}</th><th>${t("widthShort")} <span class="u">MHz</span></th></tr></thead>
      <tbody>${BAND_LIST.map(bandRow).join("")}</tbody></table>
    <p class="unit">${t("bandGridNote")}</p>
    <label class="row"><span>${t("mount")}</span><select data-f="mount">${same("mount") ? "" : `<option value="__mixed" selected>${mixed}</option>`}${Object.keys(MOUNTS).map(k => `<option value="${k}" ${same("mount") && o.mount === k ? "selected" : ""}>${t("mount_" + k)}</option>`).join("")}</select></label>
    <label class="row"><span>${t("apHeight")} <span class="u">(m)</span></span>${num("h", 30, 0.1)}</label>
    ${patternRowHtml(aps)}
    <label class="row"><span>${t("antLbl")}</span><select data-f="antenna">${same("antenna") ? "" : `<option value="__mixed" selected>${mixed}</option>`}
      <option value="" ${same("antenna") && !o.antenna ? "selected" : ""}>${t("antInternal")}</option>
      ${Object.entries(ANTENNAS).map(([k, A]) => `<option value="${k}" ${same("antenna") && o.antenna === k ? "selected" : ""}>${t("ant_" + k)} · ${A.gain[24]}/${A.gain[5]}/${A.gain[6]} dBi</option>`).join("")}</select></label>
    ${aps.some(a => a.mount === "directional" || apHasPattern(a) || a.antenna) ? `
    <label class="row"><span>${t("azimuth")} <span class="u">(°)</span></span><input type="number" data-f="az" min="-360" max="360" step="5" value="${val("az") ?? ""}" ${same("az") ? "" : `placeholder="${mixed}"`}></label>
    <label class="row"><span>${t("tiltLbl")} <span class="u">(°)</span></span><input type="number" data-f="tilt" min="-90" max="90" step="1" value="${val("tilt") ?? 0}" ${same("tilt") ? "" : `placeholder="${mixed}"`}></label>
    ${aps.some(a => a.mount === "directional" && !a.antenna) ? `<label class="row"><span>${t("beamwidth")} <span class="u">(°)</span></span>${num("bw", 360, 5)}</label>` : ""}` : ""}
    <p class="unit eirp">${eirpLine()}</p>
    <div id="apLoadSlot">${one ? apLoadHtml(o) : ""}</div>
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
      if (m) Object.assign(a, { tx24: m.tx24, tx5: m.tx5, tx6: m.tx6 || 0, gain24: m.gain24, gain5: m.gain5, gain6: m.gain6 || 0 }, mountForModel(m));
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
      else if (/^ch(24|5|6)$/.test(f)) for (const a of aps) a[f] = inp.value ? +inp.value : null;
      else if (/^w(24|5|6)$/.test(f)) for (const a of aps) a[f] = +inp.value;
      else if (f === "antenna") { for (const a of aps) a.antenna = inp.value || null; changed(); return; }
      else if (f === "mount") {
        for (const a of aps) { a.mount = inp.value; a.h = MOUNTS[inp.value].h; }
        changed();                                   // re-render: height default, azimuth fields
        return;
      }
      else { const v = parseFloat(inp.value); if (!isFinite(v)) return; for (const a of aps) a[f] = v; }
      el.querySelector(".eirp").innerHTML = eirpLine();
      changed({ panel: false });
    };
    inp.addEventListener("input", apply);
    if (inp.tagName === "SELECT") inp.addEventListener("change", apply);
  });
  $("#applyAllBtn")?.addEventListener("click", () => {
    pushHistory();
    for (const a of project.aps) if (a !== o) Object.assign(a, { model: o.model, tx24: o.tx24, tx5: o.tx5, tx6: o.tx6, gain24: o.gain24, gain5: o.gain5, gain6: o.gain6, w24: o.w24, w5: o.w5, w6: o.w6, mount: o.mount, h: o.h, bw: o.bw, antenna: o.antenna, tilt: o.tilt });
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
  if (title) openPanel();
  updateOrthoBtn();

  if (tool === "scale") {
    const len = scaleLine?.b ? Math.hypot(scaleLine.b.x - scaleLine.a.x, scaleLine.b.y - scaleLine.a.y) : 0;
    const cur = len * project.mPerPx;
    el.innerHTML = `<p class="empty">${t("scaleHelp")}</p><p class="empty scale-tip">${t(project.scaleSet ? "scaleTipCheck" : "scaleTip")}</p>` + (len ? `
      <label class="row"><span>${t("scaleLen")}</span>
        <input type="number" id="scaleInput" min="0.1" step="0.1" value="${project.scaleSet ? "" : cur.toFixed(2)}" placeholder="${cur.toFixed(2)}"></label>
      ${project.scaleSet ? `<p class="scale-check" id="scaleCheck">${tf("scaleCurrent", { m: cur.toFixed(2) })}</p>` : ""}
      <button class="btn primary" id="scaleApply">${t("applyScale")}</button>` : "");
    $("#scaleInput")?.addEventListener("input", () => {
      const box = $("#scaleCheck"), real = parseFloat($("#scaleInput").value);
      if (!box) return;
      if (!(real > 0)) { box.className = "scale-check"; box.textContent = tf("scaleCurrent", { m: cur.toFixed(2) }); return; }
      const diff = (cur - real) / real * 100, ok = Math.abs(diff) <= 2;
      box.className = "scale-check " + (ok ? "good" : "warn");
      box.textContent = tf("scaleCurrent", { m: cur.toFixed(2) }) + " · " +
        tf(ok ? "scaleDiffOk" : "scaleDiffBad", { d: (diff > 0 ? "+" : "") + diff.toFixed(1) });
    });
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

  if (tool === "probe") { renderProbePanel(el); return; }

  if (o && (selection.type === "ap" || selection.type === "aps")) {
    renderApPanel(el, selection.type === "ap" ? [o] : o);
  } else if (o && (selection.type === "wall" || selection.type === "walls")) {
    const ws = selection.type === "wall" ? [o] : o;
    const mats = [...new Set(ws.map(w => w.mat))];
    const one = mats.length === 1 ? mats[0] : null;
    const sameMat = one ? project.walls.filter(w => w.mat === one) : [];
    const len = ws.reduce((a, w) => a + Math.hypot(w.x2 - w.x1, w.y2 - w.y1), 0);
    el.innerHTML = `
      ${ws.length > 1 ? `<p class="unit">${t(one ? "wallsSameMat" : "wallsMixedMat")}</p>` : ""}
      <div class="row"><span>${t(ws.length > 1 ? "materialAll" : "material")}</span></div>${matButtons(one)}
      <div class="row"><span>${t(ws.length > 1 ? "totalLength" : "length")}</span><b>${fmtLen(len)}</b></div>
      ${one && sameMat.length > ws.length ? `<button class="btn" id="selMatBtn">${tf("selectSameMat", { m: esc(matName(one)), n: sameMat.length })}</button>` : ""}
      <p class="unit">${t("wallSelTip")}</p>
      <button class="btn danger" id="delBtn">${ws.length > 1 ? tf("deleteN", { n: ws.length }) : t("deleteItem")}</button>`;
    el.querySelectorAll("[data-mat]").forEach(b => b.addEventListener("click", () => {
      pushHistory();
      for (const w of ws) w.mat = b.dataset.mat;
      project.newWallMat = b.dataset.mat;
      changed();
      if (ws.length > 1) flash(tf("wallsChanged", { n: ws.length, m: matName(b.dataset.mat) }));
    }));
    $("#selMatBtn")?.addEventListener("click", () => { setSelection([], sameMat.map(w => w.id)); renderPanel(); requestRender(); });
  } else if (o && selection.type === "mixed") {
    el.innerHTML = `
      <p class="unit">${t("mixedSelHelp")}</p>
      <button class="btn" id="onlyWallsBtn">${tf("onlyWalls", { n: o.walls.length })}</button>
      <button class="btn" id="onlyApsBtn">${tf("onlyAps", { n: o.aps.length })}</button>
      <p class="unit">${t("wallSelTip")}</p>
      <button class="btn danger" id="delBtn">${tf("deleteN", { n: o.aps.length + o.walls.length })}</button>`;
    $("#onlyWallsBtn").addEventListener("click", () => { setSelection([], o.walls.map(w => w.id)); renderPanel(); requestRender(); });
    $("#onlyApsBtn").addEventListener("click", () => { setSelection(o.aps.map(a => a.id), []); renderPanel(); requestRender(); });
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
        <div class="seg" id="surveyBand">${BAND_LIST.map(b => `<button data-b="${b}" class="${o.band === b ? "active" : ""}">${b} GHz</button>`).join("")}</div></div>
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
  } else if (o && selection.type === "note") {
    renderNotePanel(el, o);
  } else if (tool === "note") {
    el.innerHTML = `<p class="empty">${t("noteHelp")}</p>`;
  } else if (tool === "measure") {
    renderMeasurePanel(el);
  } else if (o && selection.type === "opening") {
    const above = project.floors.length - 1 - project.floorIdx;
    el.innerHTML = `<div class="row"><span>${t("area")}</span><b>${fmtArea(Math.abs(polyArea(o.pts)))}</b></div>
      <p class="unit">${t("openingNote")}</p>
      ${above > 0 ? `<button class="btn" id="opCopyUp">${tf("openingCopyUp", { n: above })}</button>` : ""}
      <button class="btn danger" id="delBtn">${t("deleteItem")}</button>`;
    $("#opCopyUp")?.addEventListener("click", () => {
      syncActive();
      const F = project.floors, me = F[project.floorIdx], m0 = +me.mPerPx;
      for (let j = project.floorIdx + 1; j < F.length; j++) {
        const f = F[j], fm = +f.mPerPx || m0;
        f.openings = [...(f.openings || []), { id: uid(), pts: o.pts.map(q => ({ x: (q.x * m0 + (+me.ox || 0) - (+f.ox || 0)) / fm, y: (q.y * m0 + (+me.oy || 0) - (+f.oy || 0)) / fm })) }];
      }
      changed(); flash(tf("openingCopied", { n: F.length - 1 - project.floorIdx }));
    });
  } else if (tool === "opening") {
    el.innerHTML = `<p class="empty">${t("openingHelp")}</p>`;
  } else if (o && selection.type === "atten") {
    renderAttenPanel(el, o);
  } else if (tool === "door") {
    const d = project.newDoor, opts = [...Object.keys(MATERIALS).filter(k => MATERIALS[k].door || MATERIALS[k].window), "opening"];
    el.innerHTML = `<p class="empty">${t("doorHelp")}</p>
      <div class="row"><span>${t("doorType")}</span><select id="doorMat">${opts.map(k => `<option value="${k}" ${d.mat === k ? "selected" : ""}>${k === "opening" ? t("doorOpening") : esc(matName(k))}${k === "opening" ? "" : ` (${MATERIALS[k].db24}/${MATERIALS[k].db5}/${MATERIALS[k].db6} dB)`}</option>`).join("")}</select></div>
      <label class="row"><span>${t("doorWidth")} <span class="u">(m)</span></span><input type="number" id="doorW" min="0.4" max="10" step="0.1" value="${d.width}"></label>
      <div class="btn-row2"><button class="btn" data-dw="0.9">${t("doorPresetDoor")}</button><button class="btn" data-dw="1.6">${t("doorPresetDouble")}</button></div>`;
    $("#doorMat").addEventListener("change", e => { d.mat = e.target.value; if (MATERIALS[d.mat]?.window && d.width < 1) { d.width = 1.2; $("#doorW").value = 1.2; } });
    $("#doorW").addEventListener("input", e => { const v = parseFloat(e.target.value); if (v > 0) d.width = Math.min(10, v); });
    el.querySelectorAll("[data-dw]").forEach(b => b.onclick = () => { d.width = +b.dataset.dw; $("#doorW").value = d.width; });
  } else if (tool === "atten") {
    el.innerHTML = `<p class="empty">${t("attenHelp")}</p>
      <div class="row"><span>${t("attenPresetNew")}</span><select id="attenNew">${attenOptions(project.newAttenPreset)}</select></div>
      <p class="unit">${t("attenNote")}</p>`;
    $("#attenNew").addEventListener("change", e => { project.newAttenPreset = e.target.value; });
  } else if (o && selection.type === "area") {
    renderAreaPanel(el, o);
  } else if (tool === "area") {
    const n = projectAreas(project).length;
    el.innerHTML = `<p class="empty">${t("areaHelp")}</p>` + (n ? `
      <div class="row"><span>${t("areaBoundary")}</span><b>${n} · ${fmtArea(areasPx2(project))}</b></div>
      <button class="btn danger" id="areaClear">${t("areaClear")}</button>` : "");
    $("#areaClear")?.addEventListener("click", () => {
      pushHistory(); project.areas = []; if (selection?.type === "area") selection = null; changed();
    });
  } else if (tool === "wall") {
    el.innerHTML = `<div class="row"><span>${t("wallMaterialForNew")}</span></div>${matButtons(project.newWallMat)}
      ${planImg ? `<button class="btn" id="detectBtn">${t("detectTitle")}</button>` : ""}`;
    $("#detectBtn")?.addEventListener("click", openDetectWalls);
    el.querySelectorAll("[data-mat]").forEach(b => b.addEventListener("click", () => {
      project.newWallMat = b.dataset.mat; renderPanel(); scheduleAutosave();
    }));
  } else {
    el.innerHTML = "";          // nothing to edit: the card is hidden (see top of renderPanel)
  }
  $("#delBtn")?.addEventListener("click", deleteSelection);
}

// Wi-Fi 7 MLO: a Wi-Fi 7 device on a Wi-Fi 7 AP sums its 5 GHz and 6 GHz (or 2.4 GHz) links.
function mloRateHtml(pt, m) {
  const st = project.settings, ap = m.servingAp;
  if (!st.mlo || (STD_RANK[st.clientStd] ?? 6) < 7 || !ap || (STD_RANK[apStd(ap)] ?? 6) < 7) return "";
  const bands = BAND_LIST.filter(b => b !== "2.4" && apTx(ap, b) > 0);
  if (bands.length < 2) return "";
  let sum = 0;
  for (const b of bands) { const x = pointMetrics(project, b, pt.x, pt.y); if (x && x.servingAp === ap) sum += x.rate; }
  return `<div class="row"><span>${t("mloRate")} (${bands.join("+")} GHz)</span><b>${fmtViewNum("rate", sum)}</b></div>`;
}

// SNR, SINR, data rate and interference at a pin, on the band shown.
function probeMetricsHtml(pt) {
  const band = project.settings.band;
  const m = pointMetrics(project, band, pt.x, pt.y);
  if (!m || !Number.isFinite(m.best)) return "";
  const db = x => Number.isFinite(x) ? `${Math.round(x)} dB` : "—";
  const sw = (view, x) => Number.isFinite(x) ? `<i class="sw" style="background:rgb(${viewColor(view, x)})"></i>` : "";
  return `<div class="probe-metrics">
    <div class="row"><span>${t("view_serving")}</span><b>${esc(m.servingAp?.name || "AP")}${m.servingAp && apCh(m.servingAp, band) != null ? ` <span class="unit">ch ${apCh(m.servingAp, band)} · ${apWidth(m.servingAp, band)} MHz</span>` : ""}</b></div>
    <div class="row"><span>${t("view_secondary")}</span><b>${sw("secondary", m.second)}${fmtDbm(m.second)}</b></div>
    <div class="row"><span>SNR</span><b>${sw("snr", m.snr)}${db(m.snr)}</b></div>
    <div class="row"><span>SINR</span><b>${sw("sinr", m.sinr)}${db(m.sinr)}</b></div>
    <div class="row"><span>${t("view_cci")}</span><b>${sw("cci", m.cci)}${m.cci}</b></div>
    <div class="row"><span>${t("view_rate")}</span><b>${sw("rate", m.rate)}${m.rate >= 100 ? Math.round(m.rate) : m.rate.toFixed(1)} Mbps</b></div>
    ${mloRateHtml(pt, m)}
    <div class="row"><span>${t("view_tertiary")}</span><b>${sw("tertiary", m.tertiary)}${fmtDbm(m.tertiary)}</b></div>
    <div class="row"><span>${t("view_throughput")}</span><b>${sw("throughput", m.throughput)}${fmtViewNum("throughput", m.throughput)}</b></div>
    <div class="row"><span>${t("view_loss")}</span><b>${sw("loss", m.loss)}${fmtViewNum("loss", m.loss)}</b></div>
    <div class="row"><span>${t("view_rtt")}</span><b>${sw("rtt", m.rtt)}${fmtViewNum("rtt", m.rtt)}</b></div>
    <div class="probe-health ${m.health.fails ? "bad" : "good"}"><b>${t("view_health")}</b> · ${t("reqSet_" + m.health.set)}<br>
      ${m.health.fails ? tf("healthFailList", { c: HEALTH_BITS.filter((_, i) => m.health.fails & (1 << i)).map(k => t("crit_" + k)).join(", ") }) : t("healthPassAll")}</div>
  </div>`;
}

// Boundary area: name, its own requirement and the devices / demand it must carry.
function renderAreaPanel(el, o) {
  const reqOpts = `<option value="auto" ${o.req === "auto" || o.req == null ? "selected" : ""}>${t("areaReqProject")} (${baseReqDbm()} dBm)</option>` +
    REQ_PROFILES.map(p => `<option value="${p.dbm}" ${+o.req === p.dbm ? "selected" : ""}>${p.dbm} dBm · ${t(p.key)}</option>`).join("");
  const appOpts = Object.keys(APP_PROFILES).map(k => `<option value="${k}" ${o.app === k ? "selected" : ""}>${t("app_" + k)}${APP_PROFILES[k] != null ? ` (${APP_PROFILES[k]} Mbps)` : ""}</option>`).join("");
  el.innerHTML = `
    <label class="row"><span>${t("areaName")}</span><input type="text" id="arName" value="${esc(o.name || "")}" placeholder="${esc(t("areaNamePh"))}"></label>
    <label class="row"><span>${t("requirement")}</span><select id="arReq">${reqOpts}</select></label>
    <label class="row"><span>${t("reqSetLbl")}</span><select id="arReqSet"><option value="project" ${!o.reqSet || o.reqSet === "project" ? "selected" : ""}>${t("areaReqProject")} (${t("reqSet_" + (project.settings.reqSet || "data"))})</option>
      ${REQ_SET_KEYS.map(k => `<option value="${k}" ${o.reqSet === k ? "selected" : ""}>${t("reqSet_" + k)}</option>`).join("")}</select></label>
    <div class="row"><span>${t("areaBoundary")}</span><b>${fmtArea(Math.abs(polyArea(o.pts)))}</b></div>
    <label class="row"><span>${t("ceilLbl")} <span class="u">(m)</span></span><input type="number" id="arCeil" min="2" max="30" step="0.1" value="${o.ceil ?? ""}" placeholder="${t("ceilAuto")}"></label>
    ${o.ceil ? `<button class="btn" id="arCeilAps">${t("ceilApply")}</button>` : ""}
    <h4 class="sub-h">${t("capTitle")}</h4>
    <label class="row"><span>${t("capDevicesLbl")}</span><input type="number" id="arDev" min="0" max="5000" step="1" value="${+o.devices || 0}"></label>
    <div class="row"><span>${t("devMixLbl")} <span class="u">(%)</span></span></div>
    <div class="mix-grid">${DEVICE_KEYS.map(k => { const m = o.mix || DEFAULT_MIX; return `<label><span>${t("dev_" + k)}</span><input type="number" data-mix="${k}" min="0" max="100" step="5" value="${+m[k] || 0}"></label>`; }).join("")}</div>
    <label class="row"><span>${t("capApp")}</span><select id="arApp">${appOpts}</select></label>
    <label class="row" ${o.app === "custom" ? "" : "hidden"} id="arMbpsRow"><span>${t("capMbps")} <span class="u">(Mbps)</span></span><input type="number" id="arMbps" min="0" max="1000" step="0.1" value="${+o.mbps || 0}"></label>
    <p class="unit">${t("capAreaHelp")}</p>
    <p class="unit">${t("areaEditHelp")}</p>
    <button class="btn danger" id="delBtn">${t("deleteItem")}</button>`;
  const set = (f, v, panel = false) => { o[f] = v; changed({ panel }); };
  $("#arName").addEventListener("focus", pushHistory);
  $("#arName").addEventListener("input", e => { o.name = e.target.value.slice(0, 60); renderStats(); });
  $("#arReq").addEventListener("change", e => { pushHistory(); set("req", e.target.value === "auto" ? "auto" : +e.target.value); });
  $("#arReqSet").addEventListener("change", e => { pushHistory(); set("reqSet", e.target.value); });
  $("#arCeil").addEventListener("focus", pushHistory);
  $("#arCeil").addEventListener("change", e => { const v = parseFloat(e.target.value); o.ceil = v >= 2 ? Math.min(30, v) : null; changed(); });
  $("#arCeilAps")?.addEventListener("click", () => {
    pushHistory();
    let n = 0;
    for (const ap of project.aps) if (ap.mount === "ceiling" && pointInPoly(ap.x, ap.y, o.pts)) { ap.h = o.ceil; n++; }
    changed(); flash(tf("ceilApplied", { n, h: o.ceil }));
  });
  el.querySelectorAll("[data-mix]").forEach(inp => {
    inp.addEventListener("focus", pushHistory);
    inp.addEventListener("input", () => {
      const v = parseFloat(inp.value);
      if (!(v >= 0)) return;
      o.mix = { ...(o.mix || DEFAULT_MIX), [inp.dataset.mix]: Math.min(100, v) };
      changed({ panel: false });
    });
  });
  $("#arDev").addEventListener("focus", pushHistory);
  $("#arDev").addEventListener("input", e => { const v = parseInt(e.target.value, 10); if (v >= 0) set("devices", Math.min(5000, v)); });
  $("#arApp").addEventListener("change", e => { pushHistory(); set("app", e.target.value, true); });
  $("#arMbps").addEventListener("focus", pushHistory);
  $("#arMbps").addEventListener("input", e => { const v = parseFloat(e.target.value); if (v >= 0) set("mbps", Math.min(1000, v)); });
}

const attenOptions = sel => Object.entries(ATTEN_PRESETS).map(([k, v]) =>
  `<option value="${k}" ${k === sel ? "selected" : ""}>${t("atten_" + k)}${k === "custom" ? "" : ` (${v.db24}/${v.db5}/${v.db6} dB/m)`}</option>`).join("");
function renderAttenPanel(el, z) {
  const areaM2 = Math.abs(polyArea(z.pts)) * project.mPerPx ** 2;
  el.innerHTML = `
    <div class="row"><span>${t("attenPreset")}</span><select id="attenPreset">${attenOptions(z.preset)}</select></div>
    <table class="band-grid"><thead><tr><th>GHz</th><th>dB/m</th></tr></thead><tbody>
      ${BAND_LIST.map(b => `<tr><th>${b}</th><td><input type="number" data-zf="db${BK[b]}" min="0" max="20" step="0.1" value="${z["db" + BK[b]]}"></td></tr>`).join("")}
    </tbody></table>
    <div class="row"><span>${t("area")}</span><b>${areaM2.toFixed(1)} m²</b></div>
    <p class="unit">${t("attenNote")}</p>
    <button class="btn danger" id="delBtn">${t("deleteItem")}</button>`;
  $("#attenPreset").addEventListener("change", e => {
    pushHistory();
    const pr = ATTEN_PRESETS[e.target.value];
    z.preset = e.target.value; project.newAttenPreset = z.preset;
    if (e.target.value !== "custom") Object.assign(z, { db24: pr.db24, db5: pr.db5, db6: pr.db6 });
    changed();
  });
  el.querySelectorAll("[data-zf]").forEach(inp => {
    inp.addEventListener("focus", pushHistory);
    inp.addEventListener("input", () => {
      const v = parseFloat(inp.value);
      if (!(v >= 0)) return;
      z[inp.dataset.zf] = Math.min(20, v); z.preset = "custom";
      $("#attenPreset").value = "custom";
      changed({ panel: false });
    });
  });
}

function renderProbePanel(el) {
  const pt = project.probes[probeActive];
  if (!pt) { el.innerHTML = `<p class="empty">${t("probeHelp")}</p>`; return; }
  const band = project.settings.band, others = BAND_LIST.filter(b => b !== band);
  const r = probeAt(pt.x, pt.y), v = r[band];
  const [cls, key] = project.aps.length ? probeGrade(v) : ["bad", "probeNoAp"];
  const swatch = x => Number.isFinite(x) ? `<i class="sw" style="background:rgb(${signalColor(x)})"></i>` : "";
  const rows = r.perAp.map(a => ({ ...a, d: Math.hypot(a.ap.x - pt.x, a.ap.y - pt.y) * project.mPerPx }))
    .sort((a, b) => b[band] - a[band]).slice(0, 6);
  el.innerHTML = `
    <div class="probe-main">
      <div class="probe-val">${swatch(v)}<b>${fmtDbm(v)}</b><span>${band} GHz</span></div>
      <div class="probe-grade ${cls}">${t(key)}</div>
      <div class="probe-sub">${t("requirement")} ${reqText()}</div>
    </div>
    ${others.map(ob => `<div class="row"><span>${ob} GHz</span><b>${swatch(r[ob])}${fmtDbm(r[ob])}</b></div>`).join("")}
    ${probeMetricsHtml(pt)}
    <div class="row"><span>${t("probePos")}</span><span>x ${(pt.x * project.mPerPx).toFixed(1)} m, y ${(pt.y * project.mPerPx).toFixed(1)} m</span></div>
    ${rows.length ? `<table class="probe-aps">
      <tr><th>AP</th><th>${t("probeDist")}</th>${BAND_LIST.map(b => `<th>${b}</th>`).join("")}</tr>
      ${rows.map((a, i) => `<tr class="${i === 0 && Number.isFinite(a[band]) ? "best" : ""}"><td>${esc(a.ap.name || "AP")}</td><td>${a.d.toFixed(1)} m</td>
        ${BAND_LIST.map(b => `<td>${Number.isFinite(a[b]) ? Math.round(a[b]) : "—"}</td>`).join("")}</tr>`).join("")}
    </table>` : ""}
    <p class="unit">${t("probeNote")}</p>
    <p class="unit">${t("probeDelHelp")}</p>
    <div class="btn-row">
      <button class="btn" id="probeDel">${t("probeDelete")}</button>
      ${project.probes.length > 1 ? `<button class="btn" id="probeClear">${tf("probeClear", { n: project.probes.length })}</button>` : ""}
    </div>`;
  $("#probeDel").onclick = () => deleteProbe(probeActive);
  $("#probeClear")?.addEventListener("click", () => { pushHistory(); clearProbes(); renderPanel(); requestRender(); });
}

// Legend for the heatmap view being shown.
// "Voice: SNR ≥ 25 dB · rate ≥ 24 Mbps · 2 APs · co-channel ≤ 1 · 2nd ≥ -75 dBm" (signal is the requirement line)
function reqSetText(set) {
  const d = set.def, p = [];
  if (d.snr != null) p.push(`SNR ≥ ${d.snr} dB`);
  if (d.rate != null) p.push(`${t("view_rate")} ≥ ${d.rate} Mbps`);
  if (d.aps != null && d.aps > 1) p.push(tf("critApsN", { n: d.aps }));
  if (d.cci != null) p.push(`${t("critCci")} ≤ ${d.cci}`);
  if (d.sec != null) p.push(`${t("critSec")} ≥ ${d.sec} dBm`);
  return `<b>${t("reqSet_" + set.key)}</b>: ${p.join(" · ")}`;
}

function renderLegend() {
  const st = project.settings, v = curView(), def = VIEW_DEFS[v];
  const item = (rgb, lbl) => `<div class="item"><span class="sw" style="background:rgb(${rgb})"></span><span class="lbl">${lbl}</span></div>`;
  // compact legend for the box on the plan: a colour strip with values (strongest / best first)
  const seg = (rgb, lbl, title = "") => `<span class="lg-seg" title="${esc(title)}"><i style="background:rgb(${rgb})"></i><span>${lbl}</span></span>`;
  let html = "";
  if (v === "signal" || v === "secondary" || v === "tertiary") html = SIGNAL_STOPS.map(s => seg(s.rgb, s.label.replace("≥ ", ""), t(s.key))).join("") + `<span class="lg-unit">dBm</span>`;
  else if (v === "serving") html = project.aps.slice(0, 8).map((a, i) => seg(apColor(i), esc(a.name || "AP"))).join("") + (project.aps.length > 8 ? `<span class="lg-unit">+${project.aps.length - 8}</span>` : "");
  else if (v === "health") html = def.stops.map((s, i) => seg(s.rgb, s.label, i ? tf(i === 3 ? "healthFailN3" : i === 1 ? "healthFail1" : "healthFailN", { n: i }) : t("healthPassAll"))).join("") + `<span class="lg-unit">${esc(t("healthFailShort"))}</span>`;
  else html = def.stops.map(s => seg(s.rgb, s.label.replace("≥ ", ""))).join("") + (def.unit ? `<span class="lg-unit">${def.unit}</span>` : "");
  $("#legend").innerHTML = `<div class="lg-strip">${html}</div>`;
  $("#viewDock").title = t("viewHelp_" + v) + (v === "health" ? "\n" + reqSetText(areaReqSet(project, null)).replace(/<[^>]+>/g, "") : "");
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
  $("#minSel").innerHTML = `<option value="auto">${t("autoShort")} (${baseReqDbm() - 15} dBm)</option>` +
    [-75, -80, -85, -90].map(v => `<option value="${v}">${v} dBm</option>`).join("");
  $("#minSel").value = String(st.minDbm);
  $("#capNbtc").checked = !!st.capNbtc;
  $("#countrySel").innerHTML = REG_KEYS.map(k => `<option value="${k}">${t("cty_" + k)}</option>`).join("");
  $("#countrySel").value = st.country || "TH";
  $("#clientSel").innerHTML = Object.entries(CLIENTS).map(([k, v]) => `<option value="${k}">${t("client_" + k)} (${v > 0 ? "+" : ""}${v} dB)</option>`).join("");
  $("#clientSel").value = st.client;
  $("#clientH").value = st.clientH;
  $("#marginSel").innerHTML = [0, 3, 5, 8, 10].map(v => `<option value="${v}">${v} dB</option>`).join("");
  $("#marginSel").value = String(st.margin);
  $("#pathsChk").checked = st.paths !== false;
  $("#wavesChk").checked = !!st.waves;
  $("#rulersChk").checked = st.rulers !== false;
  $("#dfsChk").checked = !!st.dfs;
  $("#steerChk").checked = st.steer !== false;
  $("#mloChk").checked = !!st.mlo;
  renderLegend();
  $("#viewSel").innerHTML = VIEW_KEYS.map(k => `<option value="${k}">${t("view_" + k)}</option>`).join("");
  $("#viewSel").value = curView();
  $("#clientStdSel").innerHTML = WIFI_STDS.map(x => `<option>${x}</option>`).join("");
  $("#clientStdSel").value = st.clientStd || "Wi-Fi 6";
  $("#clientSSSel").innerHTML = [1, 2, 3, 4].map(n => `<option value="${n}">${n}</option>`).join("");
  $("#clientSSSel").value = String(clientStreams(st));
  $("#reqSetSel").innerHTML = REQ_SET_KEYS.map(k => `<option value="${k}">${t("reqSet_" + k)}</option>`).join("");
  $("#reqSetSel").value = REQ_SETS[st.reqSet] !== undefined ? st.reqSet : "data";
  renderAiModel();
  const ls = $("#langSel");
  if (!ls.options.length) ls.innerHTML = LANGS.map(l => `<option value="${l.code}">${l.name}</option>`).join("");
  ls.value = LANG;
}

// Side panel shows only what can be used yet: shortcuts on a project without APs,
// the AI once there are walls, summary / display once there is something drawn,
// and the legend once there is a heatmap.
// A card that has appeared stays (deleting one AP does not hide the legend) until the
// project is empty again or another project is opened.
const revealed = { owner: null, summary: false, ai: false, display: false, legend: false };
// Until the user starts working, the side panel is folded away and the plan fills the page.
// It slides in on the first tool / selection (or when the project already has content) and
// stays open; a new empty project folds it again.
let panelOpen = false;
function openPanel(open = true) {
  if (panelOpen === open) return;
  panelOpen = open;
  $("#layout").classList.toggle("collapsed", !open);
}
function renderPanelCards() {
  const hasWalls = project.walls.length > 0, hasAps = project.aps.length > 0;
  const started = hasWalls || hasAps;
  if (revealed.owner !== project) openPanel(started);
  else if (started || selection) openPanel();
  if (revealed.owner !== project || !started) Object.assign(revealed, { owner: project, summary: false, ai: false, display: false, legend: false });
  revealed.summary ||= started; revealed.display ||= started; revealed.ai ||= hasWalls; revealed.legend ||= hasAps;
  $("#summaryCard").hidden = !revealed.summary;
  $("#aiCard").hidden = !revealed.ai;
  $("#displayCard").hidden = !revealed.display;
  $("#pTabs").hidden = !revealed.summary;
  document.querySelector('#pTabs [data-ptab="ai"]').hidden = !revealed.ai;
  if (!revealed.ai && panelTab === "ai") setPanelTab("results");
  $("#viewDock").hidden = !revealed.legend;
  $("#ctrlDock").hidden = !started && !project.plan.image;
  updateEmptyState();
}

// ---------- side panel tabs: Results / Settings / AI ----------
let panelTab = "results";
try { panelTab = ["results", "settings", "ai"].includes(localStorage.getItem("bw-ptab")) ? localStorage.getItem("bw-ptab") : "results"; } catch (e) {}
function setPanelTab(tb) {
  panelTab = tb;
  try { localStorage.setItem("bw-ptab", tb); } catch (e) {}
  document.querySelector(".panel").dataset.tab = tb;
  document.querySelectorAll("#pTabs [data-ptab]").forEach(b => { b.classList.toggle("active", b.dataset.ptab === tb); b.setAttribute("aria-selected", String(b.dataset.ptab === tb)); });
}
$("#pTabs").addEventListener("click", e => { const b = e.target.closest("[data-ptab]"); if (b) setPanelTab(b.dataset.ptab); });

// ---------- empty project: three ways to start, in the middle of the plan ----------
let emptyDismissed = false;
function updateEmptyState() {
  const empty = !hasWork() && !emptyDismissed && tool === "select";
  $("#emptyState").hidden = !empty;
}
$("#emptyState").addEventListener("click", e => {
  const b = e.target.closest("[data-es]");
  if (!b) return;
  const a = b.dataset.es;
  if (a === "plan") pickPlan();
  else if (a === "tpl") openTemplates();
  else if (a === "demo") guardUnsaved(loadSample);
  else if (a === "draw") { emptyDismissed = true; openPanel(); setTool("wall"); }
  updateEmptyState();
});

// ---------- File menu (top bar) ----------
$("#fileMenu").addEventListener("click", e => { if (e.target.closest(".menu-pop button")) $("#fileMenu").open = false; });
document.addEventListener("pointerdown", e => { if (!e.target.closest("#fileMenu")) $("#fileMenu").open = false; });

// Keyboard shortcuts: listed in the Help window only (folded), not in the side panel.
function shortcutsHtml() {
  const K = k => `<kbd>${k}</kbd>`;
  const rows = [
    [K("W"), "k_wall"], [K("A"), "k_ap"], [K("S"), "k_scale"], [`${K("B")} ${K("M")}`, "k_area"], [K("V"), "k_select"],
    [K("Z"), "k_atten"], [K("D"), "k_door"], [K("X"), "k_opening"], [K("N"), "k_note"], [K("R"), "k_measure"], [K("P"), "k_probe"], [K("3"), "k_3d"],
    [t("k_drag"), "k_box"], [t("k_click"), "k_shift"], [t("k_rdrag"), "k_pan"],
    [`${K("O")} / Shift`, "k_ortho"], [K("Delete"), "k_del"], [`${K("Ctrl+Z")} ${K("Ctrl+Y")}`, "k_undo"], [K("Ctrl+S"), "k_save"],
  ];
  return `<details class="adv help-keys"><summary>${t("keysTitle")}</summary>
    <dl class="keys">${rows.map(([k, d]) => `<dt>${k}</dt><dd>${t(d)}</dd>`).join("")}</dl></details>`;
}

function renderStats() {
  renderPanelCards();
  const box = buildingBox(project);
  const area = (areasPx2(project) ?? (box.x1 - box.x0) * (box.y1 - box.y0)) * project.mPerPx ** 2;
  const req = reqDbm();
  const cov = heat && project.aps.length ? coverageStats(heat, effMinDbm(), heatReq || req, box, heatMask) : null;
  const v = curView(), def = VIEW_DEFS[v];
  const vst = cov && viewGrids?.per && (def.good != null || def.goodMax != null) ? viewStats(viewGrids, v, box, heatMask, effMinDbm()) : null;
  const noRadio = project.aps.length && !project.aps.some(a => apTx(a, project.settings.band) > 0);
  const counts = {};
  for (const ap of project.aps) { const m = AP_BY_ID[ap.model]; const k = m ? `${m.brand} ${m.model}` : t("custom"); counts[k] = (counts[k] || 0) + 1; }
  const pct = v => (v * 100).toFixed(0) + "%";
  const cls = (v, g, w) => v >= g ? "good" : v >= w ? "warn" : "bad";
  $("#stats").innerHTML = `
    ${floorCount() > 1 ? `<span class="k">${t("floorLbl")}</span><span class="v">${esc(floorName(project.floorIdx))} (${project.floorIdx + 1}/${floorCount()})</span>` : ""}
    <span class="k">${t("apCount")}</span><span class="v">${project.aps.length}</span>
    <span class="k">${t("wallCount")}</span><span class="v">${project.walls.length}</span>
    <span class="k">${t("area")}${projectAreas(project).length ? ` (${t("areaBoundaryShort")})` : ""}</span><span class="v">${project.scaleSet || !project.plan.image ? area.toFixed(0) + " m²" : "—"}</span>
    ${cov ? `
    <span class="k">${t("meetsReq")} (${heatReq ? t("perArea") : `≥ ${req}`})</span><span class="v ${cls(cov.meet, 0.95, 0.8)}">${pct(cov.meet)}</span>
    <span class="k">${t("covNone")}</span><span class="v ${cov.none < 0.02 ? "good" : cov.none < 0.1 ? "warn" : "bad"}">${pct(cov.none)}</span>` : ""}
    ${vst ? `<span class="k">${tf("viewGood_" + v, { n: def.good ?? def.goodMax })}</span><span class="v ${cls(vst.good, 0.9, 0.7)}">${pct(vst.good)}</span>
    ${Number.isFinite(vst.avg) && !["cci", "apcount", "capacity", "health"].includes(v) ? `<span class="k">${t("viewAvg")}</span><span class="v">${fmtViewNum(v, vst.avg)}</span>` : ""}` : ""}
    ${noRadio ? `<div class="models warn-text">${tf("noBandRadio", { b: project.settings.band })}</div>` : ""}
    ${capacitySummaryHtml()}
    ${areaTableHtml()}
    ${project.aps.length ? `<div class="models"><b>${t("apModels")}:</b><br>${Object.entries(counts).map(([k, n]) => `${n} × ${esc(k)}`).join("<br>")}</div>` : ""}`;
  renderCalib();
  if (!$("#viewDock").hidden) renderLegend();
  $("#stScale").textContent = project.scaleSet || !project.plan.image
    ? `1 m = ${(1 / project.mPerPx).toFixed(1)} px` : t("noScale");
}

// Capacity on the band shown: total devices, busiest AP, overloaded APs.
function capacitySummaryHtml() {
  if (!capLoads || !project.aps.length) return "";
  const own = capLoads.slice(0, project.aps.length);
  const dev = own.reduce((s, L) => s + L.devices, 0), unserved = own.reduce((s, L) => s + L.unserved, 0);
  const worst = own.reduce((m, L, i) => L.airtime > m.v ? { v: L.airtime, i } : m, { v: 0, i: -1 });
  const over = own.filter(L => L.airtime > 1 || L.devices > DEVICES_PER_RADIO).length;
  const pctA = v => v > 9.99 ? "> 999%" : Math.round(v * 100) + "%";
  return `<div class="models cap-sum"><b>${t("capTitle")} · ${project.settings.band} GHz</b><br>
    ${tf("capDevicesBand", { n: Math.round(dev), b: project.settings.band })}${unserved >= 1 ? ` · <span class="bad">${tf("capUnserved", { n: Math.round(unserved) })}</span>` : ""}<br>
    ${worst.i >= 0 ? tf("capBusiest", { ap: esc(project.aps[worst.i].name || "AP"), p: pctA(worst.v) }) + "<br>" : ""}
    <span class="${over ? "bad" : "good"}">${over ? tf("capOver", { n: over }) : t("capOk")}</span></div>`;
}
// Per-area coverage (areas with a name, their own requirement or devices).
function areaTableHtml() {
  const A = projectAreas(project);
  if (!heat || !heatAreaIdx || !A.length || !A.some(a => a.name || a.req !== "auto" || +a.devices > 0)) return "";
  const n = new Array(A.length).fill(0), ok = new Array(A.length).fill(0), glob = reqDbm();
  for (let k = 0; k < heatAreaIdx.length; k++) {
    const i = heatAreaIdx[k];
    if (i < 0) continue;
    n[i]++;
    if (heat.data[k] >= (heatReq ? heatReq[k] : glob)) ok[i]++;
  }
  return `<table class="calib-tbl area-tbl"><thead><tr><th>${t("areaName")}</th><th>${t("requirementShort")}</th><th>${t("capDevShort")}</th><th>${t("meetsShort")}</th></tr></thead><tbody>
    ${A.map((a, i) => { const p = n[i] ? ok[i] / n[i] : 0; return `<tr><td>${esc(a.name || `#${i + 1}`)}</td><td>${a.req === "auto" || a.req == null ? baseReqDbm() : a.req}</td><td>${+a.devices || 0}</td>
      <td class="${p >= 0.95 ? "good" : p >= 0.8 ? "warn" : "bad"}">${Math.round(p * 100)}%</td></tr>`; }).join("")}</tbody></table>`;
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
  const bigOff = cal && Math.max(Math.abs(cal.off24), Math.abs(cal.off5), Math.abs(cal.off6 || 0)) > CALIB_WARN_OFFSET;
  $("#calib").innerHTML = (E.all ? `
    <table class="calib-tbl">
      <thead><tr><th>${t("band")}</th><th>${t("calibPoints")}</th><th>${t("calibBias")}</th><th>RMS</th><th>${t("calibMax")}</th></tr></thead>
      <tbody>${BAND_LIST.map(b => row(b + " GHz", E[b])).join("")}${BAND_LIST.filter(b => E[b]).length > 1 ? row(t("calibAll"), E.all) : ""}</tbody>
    </table>
    <p class="unit">${t("calibNote")}</p>` : `<p class="empty">${t("calibNeed")}</p>`) + `
    ${cal ? `<div class="calib-on">
      <b>${t("calibActive")}</b><br>
      n = ${cal.n} <span class="unit">(${t("calibEnvWas")} ${envN})</span><br>
      ${t("calibOffset")}: 2.4G ${f(cal.off24)} dB · 5G ${f(cal.off5)} dB · 6G ${f(cal.off6 ?? cal.off5)} dB
      ${cal.rmsBefore != null ? `<br>RMS ${cal.rmsBefore} → ${cal.rmsAfter} dB` : ""}
    </div>${bigOff ? `<p class="unit warn-text">${t("calibWarnOffset")}</p>` : ""}` : ""}
    <button class="btn primary" id="calibFit" ${E.all && project.aps.length ? "" : "disabled"}>${t("calibFit")}</button>
    ${cal ? `<button class="btn" id="calibReset">${t("calibReset")}</button>` : ""}
    ${!pts.length ? `<button class="btn" id="calibStart">${t("toolSurvey")}</button>` : ""}
    <button class="btn" id="surveyImport">${t("surveyImport")}</button>
    <p class="unit">${t("surveyImportHelp")} <button class="link-btn" id="surveyTpl">${t("surveyTemplate")}</button></p>`;
  $("#surveyImport").addEventListener("click", () => $("#fileSurvey").click());
  $("#surveyTpl").addEventListener("click", () => downloadCsv([["x_m", "y_m", "dBm", "band"], [5.0, 3.2, -58, 5], [12.5, 8.0, -71, 5], [5.0, 3.2, -49, 2.4]], "beamwise-survey-template"));
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
  project.settings.band = b.dataset.band; renderSettings(); changed();
});
$("#envSel").addEventListener("change", e => { project.settings.env = +e.target.value; renderSettings(); changed({ panel: false }); });
$("#reqSel").addEventListener("change", e => { project.settings.req = e.target.value === "auto" ? "auto" : +e.target.value; renderSettings(); changed({ panel: false }); });
$("#minSel").addEventListener("change", e => { project.settings.minDbm = e.target.value === "auto" ? "auto" : +e.target.value; changed({ panel: false }); });
$("#capNbtc").addEventListener("change", e => { project.settings.capNbtc = e.target.checked; changed(); });
$("#countrySel").addEventListener("change", e => {
  project.settings.country = e.target.value;
  // channels the new country does not allow are cleared (re-plan with Auto channels)
  syncActive();
  let cleared = 0;
  for (const f of project.floors) for (const ap of f.aps || []) for (const b of BAND_LIST) {
    const k = "ch" + BK[b];
    if (ap[k] != null && !regChannels(b).includes(ap[k])) { ap[k] = null; cleared++; }
  }
  renderSettings(); changed();
  flash(cleared ? tf("ctyCleared", { n: cleared }) : tf("ctySet", { c: t("cty_" + project.settings.country) }));
}); 
$("#clientSel").addEventListener("change", e => { project.settings.client = e.target.value; changed({ panel: false }); });
$("#clientH").addEventListener("change", e => {
  const v = parseFloat(e.target.value);
  if (Number.isFinite(v) && v >= 0 && v <= 10) project.settings.clientH = v; else e.target.value = project.settings.clientH;
  changed({ panel: false });
});
$("#marginSel").addEventListener("change", e => { project.settings.margin = +e.target.value; renderSettings(); changed({ panel: false }); });
$("#pathsChk").addEventListener("change", e => { project.settings.paths = e.target.checked; changed({ panel: false }); });
$("#rulersChk").addEventListener("change", e => { project.settings.rulers = e.target.checked; fit(); scheduleAutosave(); });
$("#dfsChk").addEventListener("change", e => { project.settings.dfs = e.target.checked; });
$("#steerChk").addEventListener("change", e => { project.settings.steer = e.target.checked; changed({ panel: false }); });
$("#mloChk").addEventListener("change", e => { project.settings.mlo = e.target.checked; changed({ panel: false }); });
$("#reqSetSel").addEventListener("change", e => {
  const k = e.target.value, def = reqSetDef(project, k);
  project.settings.reqSet = k;
  if (def.signal != null) project.settings.req = def.signal;      // a set suggests its signal level
  renderSettings(); changed({ panel: false });
  if (k === "custom") openReqCustom();
});
$("#reqSetEdit").addEventListener("click", () => openReqCustom());
// Edit the custom requirement set.
function openReqCustom() {
  const d = reqSetDef(project, "custom");
  const f = (k, lbl, step, ph) => `<label class="field"><span>${lbl}</span><input type="number" data-k="${k}" step="${step}" value="${d[k] ?? ""}" placeholder="${ph}"></label>`;
  openModal(`<h2>${t("reqCustomTitle")}</h2><p class="unit">${t("reqCustomHelp")}</p>
    <div class="model-form">
      ${f("signal", t("crit_signal") + " (dBm)", 1, "-67")}${f("snr", "SNR (dB)", 1, "25")}${f("rate", t("view_rate") + " (Mbps)", 1, "24")}
      ${f("aps", t("crit_aps"), 1, "1")}${f("cci", t("critCci") + " (max)", 1, "1")}${f("sec", t("crit_sec") + " (dBm)", 1, t("critOff"))}
    </div>
    <div class="btns inline"><button data-act="cancel">${t("cancel")}</button><button class="primary" data-act="ok">${t("apply")}</button></div>`, null, "wide");
  const box = $("#modalBox");
  box.querySelector("[data-act=cancel]").onclick = closeModal;
  box.querySelector("[data-act=ok]").onclick = () => {
    const c = {};
    box.querySelectorAll("[data-k]").forEach(i => { const v = parseFloat(i.value); c[i.dataset.k] = Number.isFinite(v) ? v : null; });
    project.reqCustom = c; project.settings.reqSet = "custom";
    if (c.signal != null) project.settings.req = Math.min(-30, Math.max(-95, c.signal));
    closeModal(); renderSettings(); changed({ panel: false });
  };
}
$("#viewSel").addEventListener("change", e => { project.settings.view = e.target.value; renderLegend(); changed({ panel: false }); });
$("#clientStdSel").addEventListener("change", e => { project.settings.clientStd = e.target.value; changed({ panel: false }); });
$("#clientSSSel").addEventListener("change", e => { project.settings.clientSS = +e.target.value; changed({ panel: false }); });
$("#wavesChk").addEventListener("change", e => { project.settings.waves = e.target.checked; requestRender(); scheduleAutosave(); });

// ---------- user wall materials ----------
function cleanMaterials(list) {
  return (Array.isArray(list) ? list : []).filter(m => m && typeof m === "object").slice(0, 100).map(m => {
    const n = (v, d) => Math.min(60, Math.max(0, numOr(v, d)));
    const key = /^u_[a-z0-9]{1,16}$/.test(m.key) ? m.key : "u_" + Math.random().toString(36).slice(2, 8);
    return { key, name: strOr(m.name, "Material", 40) || "Material", db24: n(m.db24, 5), db5: n(m.db5, 7), db6: n(m.db6, 8),
             thick: Math.min(200, Math.max(0, numOr(m.thick, 10))), color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : "#8899aa", door: !!m.door, window: !!m.window };
  });
}
function openMaterialManager() {
  const list = project.materials || (project.materials = []);
  const builtins = BUILTIN_MATERIALS.map(k => `<tr><td><span class="dot" style="background:${MATERIALS[k].color}"></span> ${esc(matName(k))}</td><td>${MATERIALS[k].db24}</td><td>${MATERIALS[k].db5}</td><td>${MATERIALS[k].db6}</td><td></td></tr>`).join("");
  const row = (m, i) => `<tr data-i="${i}"><td><input type="color" data-f="color" value="${m.color}"> <input type="text" data-f="name" value="${esc(m.name)}" class="w-name"></td>
    ${["db24", "db5", "db6"].map(f => `<td><input type="number" data-f="${f}" min="0" max="60" step="0.5" value="${m[f]}"></td>`).join("")}
    <td><input type="number" data-f="thick" min="0" max="200" step="1" value="${m.thick}" title="cm"> <button class="link-btn danger" data-del="${i}">${t("deleteShort")}</button></td></tr>`;
  openModal(`<h2>${t("matTitle")}</h2><p class="unit">${t("matHelp")}</p>
    <div class="tbl-wrap"><table class="calib-tbl mat-tbl"><thead><tr><th>${t("material")}</th><th>2.4 GHz</th><th>5 GHz</th><th>6 GHz</th><th>${t("matThick")}</th></tr></thead>
      <tbody>${list.map(row).join("") || `<tr><td colspan="5" class="unit">${t("matNone")}</td></tr>`}</tbody>
      <tbody class="mat-builtin"><tr><th colspan="5">${t("matBuiltin")} (dB)</th></tr>${builtins}</tbody></table></div>
    <div class="btns inline"><button data-act="add">+ ${t("matAdd")}</button><button class="primary" data-act="close">${t("close")}</button></div>`, () => changed(), "xwide");
  const box = $("#modalBox");
  setTimeout(() => box.querySelector("[data-act=close]")?.focus(), 0);
  const apply = () => { registerMaterials(project.materials); heatDirty = true; requestRender(); };
  box.querySelectorAll("tr[data-i]").forEach(tr => {
    const m = list[+tr.dataset.i];
    tr.querySelectorAll("[data-f]").forEach(inp => inp.addEventListener("change", () => {
      const f = inp.dataset.f;
      if (f === "name") m.name = inp.value.trim().slice(0, 40) || m.name;
      else if (f === "color") m.color = inp.value;
      else { const v = parseFloat(inp.value); if (v >= 0) m[f] = Math.min(f === "thick" ? 200 : 60, v); }
      apply();
    }));
  });
  box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const m = list[+b.dataset.del];
    if (project.floors.some(f => (f === project.floors[project.floorIdx] ? project.walls : f.walls || []).some(w => w.mat === m.key))) {
      flash(t("matInUse")); return;
    }
    list.splice(+b.dataset.del, 1); apply(); openMaterialManager();
  });
  box.querySelector("[data-act=add]").onclick = () => {
    list.push({ key: "u_" + Math.random().toString(36).slice(2, 8), name: t("matNew") + " " + (list.length + 1), db24: 6, db5: 9, db6: 10, thick: 10, color: "#8899aa" });
    apply(); openMaterialManager();
  };
  box.querySelector("[data-act=close]").onclick = closeModal;
}

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

// Requirement at a point (dBm, margin included): the area's own value, else the project's.
function areaReqAt(x, y) {
  const A = projectAreas(project);
  for (let i = A.length - 1; i >= 0; i--) if (pointInPoly(x, y, A[i].pts)) {
    const r = A[i].req;
    return r !== "auto" && r != null && Number.isFinite(+r) ? +r + (+project.settings.margin || 0) : reqDbm();
  }
  return reqDbm();
}
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
      band: project.settings.band, req: reqDbm(), reqAt: areaReqAt, target: +$("#aiTarget").value,
      maxAps: Math.max(1, Math.min(50, +$("#aiMax").value || 12)), keep, modelId: project.newApModel,
    }, p => { bar.firstElementChild.style.width = (p * 100).toFixed(0) + "%"; });
    if (!res.aps.length) { flash(t("aiNoGain")); return; }
    pushHistory();
    if (!keep) project.aps = [];
    for (const p of res.aps) project.aps.push(makeAp(p));
    assignChannelsAllFloors();
    selection = null;
    changed();
    flash(tf("aiPlaced", { n: res.aps.length, p: Math.round(res.coverage * 100), r: reqDbm() }));
  } finally {
    aiBusy = false; btn.disabled = false;
    setTimeout(() => { bar.hidden = true; }, 600);
  }
});

$("#btnCapacity").addEventListener("click", async () => {
  if (aiBusy) return;
  if (!project.aps.length) { flash(t("aiNeedAps")); return; }
  if (!hasDemand(project)) { flash(t("aiCapNeedDemand")); return; }
  aiBusy = true;
  try {
    pushHistory();
    const n = await addApsForCapacity(project, project.settings.band, 30, makeAp);
    if (n) { assignChannelsAllFloors(); changed(); }
    flash(n ? tf("aiCapAdded", { n }) : t("aiCapOk"));
  } finally { aiBusy = false; }
});
$("#btnChannels").addEventListener("click", () => {
  if (!project.aps.length) { flash(t("aiNeedAps")); return; }
  pushHistory(); assignChannelsAllFloors(); changed(); flash(t("aiChannelsDone"));
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
  syncActive();
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
// Multi-floor files: each floor is checked like a one-floor project; meta fields per floor.
function sanitizeProject(data) {
  registerMaterials(cleanMaterials(data.materials));       // before the walls are checked: they may use them
  const one = sanitizeOneFloor(data);
  one.materials = cleanMaterials(data.materials);
  const raw = Array.isArray(data.floors) ? data.floors.filter(f => f && typeof f === "object" && f.plan).slice(0, 60) : [];
  if (!raw.length) {
    one.floors = [Object.assign(floorMeta("1", "f1"), pickFloor(one))];
    one.floorIdx = 0;
  } else {
    one.floors = raw.map((f, i) => {
      const s = sanitizeOneFloor({ ...data, ...f, floors: null });
      const meta = floorMeta(strOr(f.name, String(i + 1), 30) || String(i + 1), strOr(f.id, "", 20) || undefined);
      meta.height = Math.min(20, Math.max(2, numOr(f.height, FLOOR_H_DEFAULT)));
      meta.slab = SLABS[f.slab] ? f.slab : "concrete";
      meta.ox = Math.min(1000, Math.max(-1000, numOr(f.ox, 0))); meta.oy = Math.min(1000, Math.max(-1000, numOr(f.oy, 0)));
      return Object.assign(meta, pickFloor(s));
    });
    const ids = new Set();
    for (const f of one.floors) { while (ids.has(f.id)) f.id += "x"; ids.add(f.id); }
    one.floorIdx = Math.min(one.floors.length - 1, Math.max(0, Math.round(numOr(data.floorIdx, 0))));
  }
  Object.assign(one, pickFloor(one.floors[one.floorIdx]));
  for (const k of FLOOR_FIELDS) one.floors[one.floorIdx][k] = one[k];
  return one;
}
function sanitizeOneFloor(data) {
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
                                   tx24: numOr(a.tx24, 0), tx5: numOr(a.tx5, 0), tx6: a.tx6 == null ? null : numOr(a.tx6, 0),
                                   gain24: numOr(a.gain24 ?? a.gain, 3), gain5: numOr(a.gain5 ?? a.gain, 3), gain6: numOr(a.gain6, 0),
                                   ch24: chOr(a.ch24), ch5: chOr(a.ch5), ch6: chOr(a.ch6),
                                   w24: numOr(a.w24, null), w5: numOr(a.w5, null), w6: numOr(a.w6, null),
                                   mount: MOUNTS[a.mount] ? a.mount : null, h: a.h == null ? null : Math.min(30, Math.max(0, numOr(a.h, 2.7))),
                                   az: numOr(a.az, 0), bw: Math.min(360, Math.max(10, numOr(a.bw, DEFAULT_BW))),
                                   tilt: Math.min(90, Math.max(-90, numOr(a.tilt, 0))), antenna: ANTENNAS[a.antenna] ? a.antenna : null })),
    areas: arr(data.areas).map(a => ({ id: strOr(a.id, uid()), pts: arr(a.pts).map(p => ({ x: numOr(p.x, 0), y: numOr(p.y, 0) })),
                                       name: strOr(a.name, "", 60), req: a.req == null || a.req === "auto" ? "auto" : Math.min(-30, Math.max(-95, numOr(a.req, -67))),
                                       devices: Math.min(5000, Math.max(0, Math.round(numOr(a.devices, 0)))),
                                       app: APP_PROFILES[a.app] !== undefined ? a.app : "web", mbps: Math.min(1000, Math.max(0, numOr(a.mbps, 2))),
                                       reqSet: REQ_SETS[a.reqSet] !== undefined ? a.reqSet : "project",
                                       ceil: a.ceil == null || a.ceil === "" ? null : Math.min(30, Math.max(2, numOr(a.ceil, 2.7))),
                                       mix: a.mix && typeof a.mix === "object" ? Object.fromEntries(DEVICE_KEYS.map(k => [k, Math.min(100, Math.max(0, numOr(a.mix[k], 0)))])) : null })),
    notes: arr(data.notes).slice(0, 500).map(n => ({ id: strOr(n.id, uid()), x: numOr(n.x, 0), y: numOr(n.y, 0), text: strOr(n.text, "", 1000),
      cat: NOTE_CATS[n.cat] ? n.cat : "info", photo: typeof n.photo === "string" && /^data:image\/(jpeg|png|webp);base64,/i.test(n.photo) && n.photo.length < 3e6 ? n.photo : null })),
    openings: arr(data.openings).slice(0, 200).map(z => ({ id: strOr(z.id, uid()), pts: arr(z.pts).map(p => ({ x: numOr(p.x, 0), y: numOr(p.y, 0) })) })),
    attens: arr(data.attens).map(z => ({ id: strOr(z.id, uid()), preset: ATTEN_PRESETS[z.preset] ? z.preset : "custom",
                                         pts: arr(z.pts).map(p => ({ x: numOr(p.x, 0), y: numOr(p.y, 0) })),
                                         db24: Math.min(20, Math.max(0, numOr(z.db24, 1))), db5: Math.min(20, Math.max(0, numOr(z.db5, 1.5))), db6: Math.min(20, Math.max(0, numOr(z.db6, 1.7))) })),
    survey: arr(data.survey).map(p => ({ id: strOr(p.id, uid()), x: numOr(p.x, 0), y: numOr(p.y, 0), dbm: numOr(p.dbm, null),
                                         band: BAND_LIST.includes(p.band) ? p.band : "5" })),
    probes: arr(data.probes).slice(0, 500).map(p => ({ id: strOr(p.id, uid()), x: numOr(p.x, 0), y: numOr(p.y, 0) })),
    calib: cal && Number.isFinite(+cal.n) ? {
      n: +cal.n, off24: numOr(cal.off24, 0), off5: numOr(cal.off5, 0), off6: numOr(cal.off6, numOr(cal.off5, 0)),
      rmsBefore: numOr(cal.rmsBefore, null), rmsAfter: numOr(cal.rmsAfter, null),
      count: numOr(cal.count, 0), date: strOr(cal.date, "", 40),
    } : null,
    settings: {
      ...bs,
      band: BAND_LIST.includes(s.band) ? s.band : bs.band,
      env: ENVIRONMENTS[s.env] ? +s.env : bs.env,
      opacity: Math.min(0.9, Math.max(0.1, numOr(s.opacity, bs.opacity))),
      minDbm: autoOrNum(s.minDbm, bs.minDbm),
      req: autoOrNum(s.req, bs.req),
      capNbtc: s.capNbtc == null ? bs.capNbtc : !!s.capNbtc,
      country: REG[s.country] ? s.country : bs.country,
      client: CLIENTS[s.client] != null ? s.client : bs.client,
      clientH: Math.min(10, Math.max(0, numOr(s.clientH, bs.clientH))),
      margin: Math.min(20, Math.max(0, numOr(s.margin, bs.margin))),
      paths: s.paths == null ? bs.paths : !!s.paths,
      waves: s.waves == null ? bs.waves : !!s.waves,
      rulers: s.rulers == null ? bs.rulers : !!s.rulers,
      dfs: !!s.dfs,
      view: VIEW_DEFS[s.view] ? s.view : bs.view,
      clientStd: WIFI_STDS.includes(s.clientStd) ? s.clientStd : bs.clientStd,
      clientSS: Math.min(4, Math.max(1, Math.round(numOr(s.clientSS, bs.clientSS)))),
      reqSet: REQ_SETS[s.reqSet] !== undefined ? s.reqSet : bs.reqSet,
      steer: s.steer == null ? bs.steer : !!s.steer, mlo: !!s.mlo,
    },
    reqCustom: data.reqCustom && typeof data.reqCustom === "object" ? Object.fromEntries(["signal", "snr", "rate", "aps", "cci", "sec"].map(k => [k, numOr(data.reqCustom[k], null)])) : null,
    newWallMat: MATERIALS[data.newWallMat] ? data.newWallMat : base.newWallMat,
    newApModel: strOr(data.newApModel, base.newApModel),
    newAttenPreset: ATTEN_PRESETS[data.newAttenPreset] ? data.newAttenPreset : base.newAttenPreset,
    bom: cleanBom(data.bom),
    patterns: cleanPatterns(data.patterns),
    report: data.report && typeof data.report === "object" ? { title: strOr(data.report.title, "", 120), customer: strOr(data.report.customer, "", 120),
              author: strOr(data.report.author, "", 120), notes: strOr(data.report.notes, "", 400) } : null,
    customModels: arr(data.customModels).map(cleanModel).filter(Boolean),
  };
}

function loadProjectData(data) {
  if (!data || !data.plan || !Array.isArray(data.walls) || !Array.isArray(data.aps)) throw new Error("bad");
  project = sanitizeProject(data);
  if (project.customModels.length) { mergeIntoLibrary(project.customModels); registerCustomModels(project.customModels); }
  for (const f of project.floors) (f.aps || []).forEach(normalizeAp);
  floorImgs.clear();
  renderFloorBar();
  selection = null; wallChain = null; scaleLine = null; areaDraft = null; probeActive = project.probes.length - 1;
  undoStack = []; redoStack = [];
  planImg = null;
  return new Promise(res => {
    if (!project.plan.image) { res(); return; }
    const img = new Image();
    img.onload = () => { planImg = img; floorImgs.set(project.floors[project.floorIdx].id, img); res(); };
    img.onerror = () => { project.plan.image = null; res(); };
    img.src = project.plan.image;
  }).then(() => { View3D.reset(); renderSettings(); fit(); changed(); markSaved(); });
}

// Downscale big floor plans so the heatmap stays fast and the project file stays small.
function loadPlanFile(file) {
  if (isPdfFile(file)) { loadPdfPlan(file); return; }
  if (isDxfFile(file)) { loadDxfPlan(file); return; }
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
      project.walls = []; project.aps = []; project.areas = []; project.attens = []; project.openings = []; project.notes = []; project.survey = []; project.calib = null;
      undoStack = []; redoStack = [];
      selection = null;
      planImg = plan; clearProbes();
      floorImgs.set(project.floors[project.floorIdx].id, plan);
      View3D.reset();
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
  c.fillText(`Beamwise — ${t("exportTitle")} · ${project.settings.band} GHz · ${project.aps.length} AP · ${t("requirement")} ${reqText()}`, 14 * u, y0 + 20 * u);
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
  drawScaleBar(c, cv.width - 10 * u, y0 + legendH - 8 * u, k / project.mPerPx, { u, theme: CANVAS_THEMES.light, maxW: Math.max(170 * u, cv.width * 0.2) });

  cv.toBlob(b => { download(b, `beamwise-coverage-${stamp()}.png`); flash(t("exported")); }, "image/png");
}

// ---------- unsaved-changes tracking ----------
// Every start (open / refresh) is a blank project; nothing is restored from the browser.
// Work counts as unsaved when it differs from the last saved / opened state.
function workSnapshot() {
  syncActive();
  return JSON.stringify([project.bom, patternsRev(project), project.materials]) + JSON.stringify(project.floors.map(f => [f.name, f.height, f.slab, f.ox, f.oy, f.plan.image, f.walls, f.aps, f.areas, f.attens, f.openings, f.notes, f.survey, f.probes, f.calib, f.mPerPx, f.scaleSet]));
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
  emptyDismissed = false;
  registerMaterials([]);
  project = newProject(); planImg = null; selection = null; areaDraft = null; clearProbes(); undoStack = []; redoStack = [];
  renderFloorBar();
  View3D.reset();
  renderSettings(); setTool("select"); fit(); changed(); markSaved();
  flash(t("blankPlan"));
}
const floorHasWork = f => !!f.plan?.image || (f.walls || []).length > 0 || (f.aps || []).length > 0 || (f.areas || []).length > 0 || (f.attens || []).length > 0;
const hasWork = () => (syncActive(), project.floors.length > 1 || project.floors.some(floorHasWork)) || !!project.plan.image || project.walls.length > 0 || project.aps.length > 0 || (project.areas || []).length > 0 || (project.attens || []).length > 0 || (project.survey || []).length > 0 || (project.probes || []).length > 0;
$("#btnNew").addEventListener("click", () => guardUnsaved(startBlank));
$("#btnTemplates").addEventListener("click", () => { View3D.close(); openTemplates(); });
// file pickers must open from a user gesture; guardUnsaved runs the action inside a click
// Importing a plan replaces this floor only: no need to ask when this floor is still empty.
function pickPlan() { if (project.floors.length > 1 && !floorHasWork(project)) $("#filePlan").click(); else guardUnsaved(() => $("#filePlan").click()); }
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
$("#fileSurvey").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  f.text().then(txt => {
    const rows = parseSurveyCsv(txt, project.settings.band);
    if (!rows.length) { flash(t("surveyImportNone")); return; }
    pushHistory();
    const W = project.plan.width * project.mPerPx, H = project.plan.height * project.mPerPx;
    const inside = rows.filter(r => r.x >= 0 && r.y >= 0 && r.x <= W && r.y <= H);
    project.survey = [...(project.survey || []), ...inside.map(r => ({ id: uid(), x: r.x / project.mPerPx, y: r.y / project.mPerPx, dbm: r.dbm, band: r.band }))];
    changed();
    flash(tf("surveyImported", { n: inside.length, s: rows.length - inside.length }));
  }).catch(() => flash(t("badFile")));
});
$("#btnExportMenu").addEventListener("click", openExportMenu);
$("#langSel").addEventListener("change", e => {
  setLang(e.target.value);
  renderFloorBar();
  renderSettings(); renderPanel(); renderStats(); setTool(tool); setTheme(uiTheme);
  if (!$("#modal").hidden && $("#modalBox [data-act=demo]")) showWelcome();   // re-render welcome in new language
});
$("#btnUndo").addEventListener("click", undo);
$("#btnRedo").addEventListener("click", redo);
$("#btnFit").addEventListener("click", () => { View3D.close(); fit(); });
$("#btnView3d").addEventListener("click", () => View3D.toggle());
document.querySelectorAll("#tools [data-tool]").forEach(b => b.addEventListener("click", () => { View3D.close(); openPanel(); setTool(b.dataset.tool); }));

// Drag & drop a floor plan image or project file onto the canvas.
$("#stage").addEventListener("dragover", e => e.preventDefault());
$("#stage").addEventListener("drop", e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (f.type.startsWith("image/") || isPdfFile(f) || isDxfFile(f)) guardUnsaved(() => loadPlanFile(f));
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
    ${shortcutsHtml()}
    <p class="help-note">${t("disclaimer")}</p>
    <div class="btns help-btns">
      <button class="primary" data-act="tpl">${t("tplStart")}</button>
      <button data-act="demo">${t("tryDemo")}</button>
      <button data-act="plan">${t("startOwn")}</button>
      <button data-act="blank">${t("startBlank")}</button>
    </div>`, null, "help");
  const box = $("#modalBox");
  box.querySelector('[data-act="demo"]').onclick = () => {
    closeModal();
    guardUnsaved(loadSample);
  };
  box.querySelector('[data-act="plan"]').onclick = () => { closeModal(); pickPlan(); };
  box.querySelector('[data-act="tpl"]').onclick = () => { closeModal(); openTemplates(); };
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

// ---------- compact top bar (phones, small tablets, phone landscape): actions in a menu ----------
function setMenu(open) {
  $(".topbar").classList.toggle("menu-open", open);
  $("#btnMenu").setAttribute("aria-expanded", String(open));
}
$("#btnMenu").addEventListener("click", e => { e.stopPropagation(); setMenu(!$(".topbar").classList.contains("menu-open")); });
$("#actions").addEventListener("click", e => { if (e.target.closest("button")) setMenu(false); });
document.addEventListener("pointerdown", e => { if (!e.target.closest(".topbar")) setMenu(false); });
window.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

// ---------- heatmap box on the plan: drag it out of the way, or fold it down ----------
// Where it sits and whether it is folded is a UI preference (wpth-dock), not project data.
(() => {
  const dock = $("#viewDock"), stage = $("#stage"), grip = $("#vdGrip"), fold = $("#vdFold");
  let pref = { x: null, y: null, folded: false };
  try { Object.assign(pref, JSON.parse(localStorage.getItem("wpth-dock") || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem("wpth-dock", JSON.stringify(pref)); } catch (e) {} };
  const place = () => {
    if (pref.x == null || dock.hidden) return;
    const maxX = Math.max(0, stage.clientWidth - dock.offsetWidth - 4), maxY = Math.max(0, stage.clientHeight - dock.offsetHeight - 4);
    dock.style.left = Math.round(Math.min(Math.max(4, pref.x), maxX)) + "px";
    dock.style.top = Math.round(Math.min(Math.max(4, pref.y), maxY)) + "px";
  };
  const setMoved = on => {
    dock.classList.toggle("moved", on);
    if (!on) { pref.x = pref.y = null; dock.style.left = dock.style.top = ""; }
    else place();
  };
  const setFolded = on => {
    pref.folded = on;
    dock.classList.toggle("folded", on);
    fold.setAttribute("aria-expanded", String(!on));
    fold.dataset.i18nTitle = on ? "dockShow" : "dockHide";
    fold.title = t(fold.dataset.i18nTitle);
  };
  fold.addEventListener("click", () => { setFolded(!pref.folded); save(); });
  // drag by the grip, or by the box's own background (not its buttons, select or legend)
  dock.addEventListener("pointerdown", e => {
    if (e.button !== 0 || (e.target !== dock && !e.target.closest(".vd-grip") && !e.target.classList.contains("vd-row"))) return;
    e.preventDefault();
    const s = stage.getBoundingClientRect(), d = dock.getBoundingClientRect();
    const dx = e.clientX - d.left, dy = e.clientY - d.top;
    dock.setPointerCapture(e.pointerId);
    dock.classList.add("dragging");
    const move = ev => { pref.x = ev.clientX - s.left - dx; pref.y = ev.clientY - s.top - dy; setMoved(true); };
    const up = () => {
      dock.classList.remove("dragging");
      dock.removeEventListener("pointermove", move); dock.removeEventListener("pointerup", up); dock.removeEventListener("pointercancel", up);
      if (pref.x != null) save();
    };
    dock.addEventListener("pointermove", move); dock.addEventListener("pointerup", up); dock.addEventListener("pointercancel", up);
  });
  grip.addEventListener("dblclick", () => { setMoved(false); save(); });
  setFolded(!!pref.folded);
  if (pref.x != null) setMoved(true);
  // keep it inside the plan area when the window, the panel or the box itself changes size
  if (window.ResizeObserver) { const ro = new ResizeObserver(place); ro.observe(stage); ro.observe(dock); }
  window.addEventListener("resize", place);
})();

// ---------- start ----------
window.addEventListener("resize", () => { resize(); });
// The canvas also changes size without a window resize (top bar wrapping once fonts load,
// panel height on phones, language change): keep its pixel buffer matched, or it stretches.
if (window.ResizeObserver) new ResizeObserver(() => {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (Math.round(r.width * dpr) !== canvas.width || Math.round(r.height * dpr) !== canvas.height) resize();
}).observe(canvas);
registerCustomModels(customLibrary());
try { localStorage.removeItem("wpth-ai-key"); } catch (e) {}   // key saved by the removed AI review feature
applyI18n();
setPanelTab(panelTab);
wireFloorBar();
wireTables();
setTheme(uiTheme);
resize();
try { localStorage.removeItem("wpth-project"); } catch (e) {}      // old autosave from earlier versions
(() => {
  renderSettings(); renderFloorBar(); fit(); changed(); markSaved(); flash(t("blankPlan"));
  setTool("select");
  let welcomed = false;
  try { welcomed = !!localStorage.getItem("wpth-welcomed"); } catch (e) {}
  if (!welcomed) showWelcome();
})();

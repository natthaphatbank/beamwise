// CAD floor plans (DXF) and automatic wall detection from a plan image.
// DXF: lines, polylines, arcs, circles and block inserts are drawn into the plan image; the
// units give the scale; chosen layers become walls (double-line walls merged to one centre line).
// DWG is a closed binary format: save it as DXF from AutoCAD / LibreCAD / DraftSight first.
// Loaded before app.js; runs only after app.js has started.

const isDxfFile = f => /\.dxf$/i.test(f.name || "");
const DXF_UNITS = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 };   // $INSUNITS -> metres
const WALL_LAYER_RE = /wall|ผนัง|a-wal|wand|mur|muro|墙|壁|벽/i;

// ---------- DXF parsing ----------
function parseDxf(text) {
  const lines = text.split(/\r?\n/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([parseInt(lines[i].trim(), 10), lines[i + 1].trim()]);
  let units = 0, sec = null;
  const blocks = new Map(), ents = [];
  let curBlock = null;
  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i];
    if (c === 0 && v === "SECTION") { sec = pairs[i + 1]?.[1]; continue; }
    if (c === 0 && v === "ENDSEC") { sec = null; continue; }
    if (sec === "HEADER" && c === 9 && v === "$INSUNITS") { units = parseInt(pairs[i + 1]?.[1], 10) || 0; continue; }
    if (c !== 0) continue;
    if (sec === "BLOCKS" && v === "BLOCK") {
      let name = "", bx = 0, by = 0;
      for (let j = i + 1; j < pairs.length && pairs[j][0] !== 0; j++) {
        if (pairs[j][0] === 2) name = pairs[j][1];
        if (pairs[j][0] === 10) bx = +pairs[j][1];
        if (pairs[j][0] === 20) by = +pairs[j][1];
      }
      curBlock = { name, bx, by, ents: [] };
      blocks.set(name, curBlock);
      continue;
    }
    if (sec === "BLOCKS" && v === "ENDBLK") { curBlock = null; continue; }
    if (sec !== "ENTITIES" && !(sec === "BLOCKS" && curBlock)) continue;
    const target = sec === "ENTITIES" ? ents : curBlock.ents;
    // collect this entity's group codes
    const g = [];
    let j = i + 1;
    for (; j < pairs.length && pairs[j][0] !== 0; j++) g.push(pairs[j]);
    const get = (code, d = 0) => { const p = g.find(q => q[0] === code); return p ? (isNaN(+p[1]) ? p[1] : +p[1]) : d; };
    const layer = String(get(8, "0"));
    if (v === "LINE") target.push({ t: "L", layer, pts: [[get(10), get(20)], [get(11), get(21)]] });
    else if (v === "LWPOLYLINE") {
      const pts = [];
      for (let k = 0; k < g.length; k++) if (g[k][0] === 10) pts.push([+g[k][1], +(g.find((q, m) => m > k && q[0] === 20)?.[1] || 0)]);
      if (get(70) & 1 && pts.length > 2) pts.push(pts[0]);
      target.push({ t: "L", layer, pts });
    } else if (v === "POLYLINE") {
      const pts = [], closed = get(70) & 1;
      let k = j;
      while (k < pairs.length && !(pairs[k][0] === 0 && pairs[k][1] === "SEQEND")) {
        if (pairs[k][0] === 0 && pairs[k][1] === "VERTEX") {
          let x = 0, y = 0;
          for (let m = k + 1; m < pairs.length && pairs[m][0] !== 0; m++) { if (pairs[m][0] === 10) x = +pairs[m][1]; if (pairs[m][0] === 20) y = +pairs[m][1]; }
          pts.push([x, y]);
        }
        k++;
      }
      if (closed && pts.length > 2) pts.push(pts[0]);
      target.push({ t: "L", layer, pts });
      i = k;
      continue;
    } else if (v === "ARC" || v === "CIRCLE") {
      const cx = get(10), cy = get(20), r = get(40);
      let a0 = v === "ARC" ? get(50) : 0, a1 = v === "ARC" ? get(51) : 360;
      if (a1 <= a0) a1 += 360;
      const n = Math.max(4, Math.ceil((a1 - a0) / 10)), pts = [];
      for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      target.push({ t: "L", layer, pts, arc: true });
    } else if (v === "INSERT") {
      target.push({ t: "I", layer, name: String(get(2, "")), x: get(10), y: get(20), sx: get(41, 1) || 1, sy: get(42, 1) || 1, rot: get(50) });
    }
    i = j - 1;
  }
  // expand block inserts (nested up to 4 levels); entities on layer "0" take the insert's layer
  const out = [];
  const expand = (list, tf, depth, parentLayer) => {
    for (const e of list) {
      const layer = e.layer === "0" && parentLayer ? parentLayer : e.layer;
      if (e.t === "L") out.push({ layer, arc: e.arc, pts: e.pts.map(p => tf(p)) });
      else if (e.t === "I" && depth < 4 && blocks.has(e.name) && out.length < 200000) {
        const b = blocks.get(e.name), c = Math.cos(e.rot * Math.PI / 180), s = Math.sin(e.rot * Math.PI / 180);
        expand(b.ents, p => { const x = (p[0] - b.bx) * e.sx, y = (p[1] - b.by) * e.sy; return tf([e.x + x * c - y * s, e.y + x * s + y * c]); }, depth + 1, layer);
      }
    }
  };
  expand(ents, p => p, 0, null);
  return { units, ents: out.filter(e => e.pts.length > 1 && e.pts.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))) };
}

// Guess the unit when the file does not say: architectural plans are usually in mm.
function guessDxfUnit(ents) {
  let x0 = Infinity, x1 = -Infinity;
  for (const e of ents) for (const p of e.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
  const w = x1 - x0;
  return w > 2000 ? 4 : w > 300 ? 5 : 6;
}

// ---------- double-line walls -> centre lines ----------
// segs: [[x1, y1, x2, y2]] in metres. Pairs of parallel lines 5–50 cm apart that overlap become
// one wall along their middle; short leftovers (wall ends, door jambs) are dropped.
function mergeDoubleLines(segs, { minGap = 0.05, maxGap = 0.5, minLen = 0.5 } = {}) {
  const S = segs.map(([x1, y1, x2, y2]) => {
    const L = Math.hypot(x2 - x1, y2 - y1);
    return { x1, y1, x2, y2, L, ux: (x2 - x1) / L, uy: (y2 - y1) / L, used: false };
  }).filter(s => s.L > 0.05).sort((a, b) => b.L - a.L);
  // bucket by midpoint for neighbour search
  const cell = 2, B = new Map(), key = (x, y) => Math.floor(x / cell) + "," + Math.floor(y / cell);
  S.forEach((s, i) => { const k = key((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2); (B.get(k) || B.set(k, []).get(k)).push(i); });
  const near = s => {
    const out = [], r = Math.ceil((s.L / 2 + maxGap) / cell);
    const cx = Math.floor((s.x1 + s.x2) / 2 / cell), cy = Math.floor((s.y1 + s.y2) / 2 / cell);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const l = B.get((cx + i) + "," + (cy + j)); if (l) out.push(...l); }
    return out;
  };
  const walls = [];
  for (const s of S) {
    if (s.used) continue;
    let best = null, bestD = Infinity, bestOv = null;
    for (const j of near(s)) {
      const o = S[j];
      if (o === s || o.used || Math.abs(s.ux * o.uy - s.uy * o.ux) > 0.05) continue;   // not parallel (~3°)
      const d = Math.abs((o.x1 - s.x1) * -s.uy + (o.y1 - s.y1) * s.ux);
      if (d < minGap || d > maxGap) continue;
      const p1 = (o.x1 - s.x1) * s.ux + (o.y1 - s.y1) * s.uy, p2 = (o.x2 - s.x1) * s.ux + (o.y2 - s.y1) * s.uy;
      const lo = Math.max(0, Math.min(p1, p2)), hi = Math.min(s.L, Math.max(p1, p2));
      if (hi - lo < 0.5 * Math.min(s.L, o.L) || hi - lo < 0.2) continue;
      if (d < bestD) { bestD = d; best = o; bestOv = [lo, hi]; }
    }
    if (best) {
      best.used = s.used = true;
      const sign = (best.x1 - s.x1) * -s.uy + (best.y1 - s.y1) * s.ux > 0 ? 1 : -1;
      const ox = -s.uy * sign * bestD / 2, oy = s.ux * sign * bestD / 2;
      walls.push([s.x1 + s.ux * bestOv[0] + ox, s.y1 + s.uy * bestOv[0] + oy, s.x1 + s.ux * bestOv[1] + ox, s.y1 + s.uy * bestOv[1] + oy]);
    }
  }
  for (const s of S) if (!s.used && s.L >= minLen) walls.push([s.x1, s.y1, s.x2, s.y2]);
  return walls;
}

// ---------- import dialog ----------
async function loadDxfPlan(file) {
  let dxf;
  try { dxf = parseDxf(await file.text()); } catch (e) { dxf = null; }
  if (!dxf || !dxf.ents.length) { flash(t("dxfEmpty")); return; }
  const layers = new Map();
  for (const e of dxf.ents) layers.set(e.layer, (layers.get(e.layer) || 0) + 1);
  const unit = DXF_UNITS[dxf.units] ? dxf.units : guessDxfUnit(dxf.ents);
  const list = [...layers.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  openModal(`<h2>${t("dxfTitle")}</h2>
    <p class="unit">${tf("dxfHelp", { n: dxf.ents.length, l: layers.size })}</p>
    <div class="model-form">
      <label class="field"><span>${t("dxfUnit")}${DXF_UNITS[dxf.units] ? "" : ` <span class="warn-text">(${t("dxfUnitGuess")})</span>`}</span><select id="dxUnit">
        ${[[4, "mm"], [5, "cm"], [6, "m"], [1, "inch"], [2, "feet"]].map(([k, l]) => `<option value="${k}" ${k === unit ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span>${t("dxfMat")}</span><select id="dxMat">${Object.keys(MATERIALS).map(k => `<option value="${k}" ${k === project.newWallMat ? "selected" : ""}>${esc(t("mat_" + k))}</option>`).join("")}</select></label>
    </div>
    <label class="check"><input type="checkbox" id="dxMerge" checked> ${t("dxfMerge")}</label>
    <h3 class="modal-sub">${t("dxfLayers")}</h3>
    <div class="dxf-layers">${list.map(([name, n]) => `<label class="check"><input type="checkbox" data-layer="${esc(name)}" ${WALL_LAYER_RE.test(name) ? "checked" : ""}> <b>${esc(name)}</b> <span class="unit">(${n})</span></label>`).join("")}</div>
    <p class="unit">${t("dxfLayersHelp")}</p>
    <div class="btns inline"><button data-act="cancel">${t("cancel")}</button><button class="primary" data-act="go">${t("dxfImport")}</button></div>`, null, "wide");
  const box = $("#modalBox");
  box.querySelector('[data-act="cancel"]').onclick = closeModal;
  box.querySelector('[data-act="go"]').onclick = () => {
    const wallLayers = new Set([...box.querySelectorAll("[data-layer]:checked")].map(x => x.dataset.layer));
    const opts = { unit: +$("#dxUnit").value, mat: $("#dxMat").value, merge: $("#dxMerge").checked, wallLayers };
    closeModal();
    applyDxf(dxf, opts);
  };
}

function applyDxf(dxf, { unit, mat, merge, wallLayers }) {
  const k = DXF_UNITS[unit] || 0.001;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of dxf.ents) for (const p of e.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const pad = 0.04 * Math.max(x1 - x0, y1 - y0);
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const wM = (x1 - x0) * k, hM = (y1 - y0) * k;
  if (!(wM > 0.5 && hM > 0.5) || wM > 5000 || hM > 5000) { flash(t("dxfBadSize")); return; }
  // plan image: at most 3000 px on the long side, at least ~25 px per metre when it fits
  const pxPerM = Math.min(3000 / Math.max(wM, hM), 60);
  const W = Math.max(50, Math.round(wM * pxPerM)), H = Math.max(50, Math.round(hM * pxPerM));
  const toPx = p => [(p[0] - x0) * k * pxPerM, (y1 - p[1]) * k * pxPerM];   // DXF y points up
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
  c.lineCap = "round"; c.lineJoin = "round";
  for (const e of dxf.ents) {
    const wall = wallLayers.has(e.layer);
    c.strokeStyle = wall ? "#222" : "#8a8f99"; c.lineWidth = wall ? 1.6 : 1;
    c.beginPath();
    e.pts.forEach((p, i) => { const [x, y] = toPx(p); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke();
  }
  // walls in metres (plan frame, y down)
  let segs = [];
  for (const e of dxf.ents) {
    if (!wallLayers.has(e.layer) || e.arc) continue;
    for (let i = 0; i + 1 < e.pts.length; i++) {
      const [ax, ay] = toPx(e.pts[i]), [bx, by] = toPx(e.pts[i + 1]);
      segs.push([ax / pxPerM, ay / pxPerM, bx / pxPerM, by / pxPerM]);
    }
  }
  if (segs.length > 40000) segs = segs.slice(0, 40000);
  const wallsM = merge ? mergeDoubleLines(segs) : segs.filter(s => Math.hypot(s[2] - s[0], s[3] - s[1]) >= 0.2);
  const dataUrl = cv.toDataURL("image/png");
  const img = new Image();
  img.onload = () => {
    project.plan = { image: dataUrl, width: W, height: H };
    project.mPerPx = 1 / pxPerM;
    project.scaleSet = true;
    project.walls = wallsM.map(([a, b, d, e]) => ({ id: uid(), x1: a * pxPerM, y1: b * pxPerM, x2: d * pxPerM, y2: e * pxPerM, mat }));
    project.aps = []; project.areas = []; project.attens = []; project.survey = []; project.calib = null;
    undoStack = []; redoStack = []; selection = null;
    planImg = img; clearProbes();
    floorImgs.set(project.floors[project.floorIdx].id, img);
    View3D.reset(); fit(); changed(); setTool("select");
    flash(tf("dxfDone", { w: project.walls.length, m: `${wM.toFixed(1)} × ${hM.toFixed(1)}` }));
  };
  img.src = dataUrl;
}

// ---------- wall detection on a raster plan ----------
// Dark, straight, thick-enough strokes (horizontal and vertical) become walls. Thin lines
// (text, furniture, dimensions) are ignored by the minimum thickness.
function detectWallsFromImage(img, opts) {
  const { mPerPx, minThickM = 0.06, maxThickM = 0.6, minLenM = 0.8, dark = 110 } = opts;
  const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
  const s = Math.min(1, 1600 / Math.max(W0, H0));              // work at ≤ 1600 px
  const W = Math.round(W0 * s), H = Math.round(H0 * s);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d", { willReadFrequently: true });
  c.fillStyle = "#fff"; c.fillRect(0, 0, W, H); c.drawImage(img, 0, 0, W, H);
  const d = c.getImageData(0, 0, W, H).data;
  const on = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) on[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) < dark ? 1 : 0;
  const mpp = mPerPx / s;                                       // metres per working pixel
  const minT = Math.max(2, Math.round(minThickM / mpp)), maxT = Math.max(minT + 1, Math.round(maxThickM / mpp));
  const minL = Math.max(8, Math.round(minLenM / mpp));
  const out = [];
  // horizontal: runs per row, stacked rows with overlapping runs form a band
  const scan = (horiz) => {
    const A = horiz ? H : W, Bn = horiz ? W : H;
    const at = (a, b) => on[horiz ? a * W + b : b * W + a];
    let open = [];                                              // bands still growing: {b0, b1, a0, n}
    const close = band => {
      const t = band.n;
      if (t >= minT && t <= maxT && band.b1 - band.b0 >= minL) {
        const mid = (band.a0 + band.a0 + t - 1) / 2 + 0.5;
        out.push(horiz ? [band.b0, mid, band.b1, mid] : [mid, band.b0, mid, band.b1]);
      }
    };
    for (let a = 0; a <= A; a++) {
      const runs = [];
      if (a < A) {
        let b = 0;
        while (b < Bn) {
          if (!at(a, b)) { b++; continue; }
          const b0 = b;
          while (b < Bn && at(a, b)) b++;
          if (b - b0 >= minL) runs.push([b0, b]);
        }
      }
      const next = [];
      for (const r of runs) {
        const m = open.find(o => !o.taken && Math.min(o.b1, r[1]) - Math.max(o.b0, r[0]) > 0.8 * Math.min(o.b1 - o.b0, r[1] - r[0]));
        if (m) { m.taken = true; next.push({ b0: Math.max(m.b0, r[0]), b1: Math.min(m.b1, r[1]), a0: m.a0, n: m.n + 1 }); }
        else next.push({ b0: r[0], b1: r[1], a0: a, n: 1 });
      }
      for (const o of open) if (!o.taken) close(o);
      open = next;
    }
  };
  scan(true); scan(false);
  return out.map(([x1, y1, x2, y2]) => [x1 / s, y1 / s, x2 / s, y2 / s]);   // plan px
}

function openDetectWalls() {
  if (!planImg) { flash(t("detectNeedPlan")); return; }
  openModal(`<h2>${t("detectTitle")}</h2>
    <p class="unit">${t("detectHelp")}</p>
    ${project.scaleSet ? "" : `<p class="warn-text">${t("detectNeedScale")}</p>`}
    <div class="model-form">
      <label class="field"><span>${t("dxfMat")}</span><select id="dtMat">${Object.keys(MATERIALS).map(k => `<option value="${k}" ${k === project.newWallMat ? "selected" : ""}>${esc(t("mat_" + k))}</option>`).join("")}</select></label>
      <label class="field"><span>${t("detectThick")} (cm)</span><input id="dtThick" type="number" min="2" max="40" step="1" value="6"></label>
      <label class="field"><span>${t("detectLen")} (m)</span><input id="dtLen" type="number" min="0.3" max="10" step="0.1" value="0.8"></label>
      <label class="field"><span>${t("detectDark")}</span><input id="dtDark" type="range" min="40" max="200" value="110"></label>
    </div>
    <label class="check"><input type="checkbox" id="dtReplace"> ${t("detectReplace")}</label>
    <div class="btns inline"><button data-act="cancel">${t("cancel")}</button><button class="primary" data-act="go">${t("detectGo")}</button></div>`, null, "wide");
  const box = $("#modalBox");
  box.querySelector('[data-act="cancel"]').onclick = closeModal;
  box.querySelector('[data-act="go"]').onclick = () => {
    const segs = detectWallsFromImage(planImg, {
      mPerPx: project.mPerPx * project.plan.width / (planImg.naturalWidth || project.plan.width),
      minThickM: (+$("#dtThick").value || 6) / 100, minLenM: +$("#dtLen").value || 0.8, dark: +$("#dtDark").value || 110,
    });
    const k = project.plan.width / (planImg.naturalWidth || project.plan.width);
    const mat = $("#dtMat").value, replace = $("#dtReplace").checked;
    closeModal();
    if (!segs.length) { flash(t("detectNone")); return; }
    pushHistory();
    if (replace) project.walls = [];
    for (const [x1, y1, x2, y2] of segs) project.walls.push({ id: uid(), x1: x1 * k, y1: y1 * k, x2: x2 * k, y2: y2 * k, mat });
    changed();
    flash(tf("detectDone", { n: segs.length }));
  };
}

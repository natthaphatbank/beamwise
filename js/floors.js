// Multiple floors. The active floor's data lives in the top-level project fields (plan, walls,
// aps, …) so the rest of the app works on "the plan"; project.floors keeps every floor, and
// syncActive() writes the active floor's current fields back into its record.
// Loaded before app.js; everything here runs only after app.js has started.

const FLOOR_FIELDS = ["plan", "mPerPx", "scaleSet", "walls", "aps", "areas", "attens", "survey", "probes", "calib"];
const FLOOR_H_DEFAULT = 3;              // m, floor to floor
const floorImgs = new Map();            // floor id -> HTMLImageElement of its plan

function floorMeta(name, id) { return { id: id || "f" + Math.random().toString(36).slice(2, 8), name, height: FLOOR_H_DEFAULT, slab: "concrete", ox: 0, oy: 0 }; }

function syncActive() {
  if (!project.floors?.length) return;
  const f = project.floors[project.floorIdx] || project.floors[0];
  for (const k of FLOOR_FIELDS) f[k] = project[k];
}
const floorCount = () => project.floors?.length || 1;
const floorName = i => project.floors?.[i]?.name || String(i + 1);

// The project as seen from floor i (the active floor is the project itself).
function floorView(i) {
  if (i === project.floorIdx) return project;
  return { ...project, ...pickFloor(project.floors[i]), floorIdx: i };
}
function pickFloor(f) { const o = {}; for (const k of FLOOR_FIELDS) o[k] = f[k]; return o; }

// Plan image of a floor (cached); calls back when a not-yet-loaded image arrives.
function floorImage(f, onload) {
  if (!f.plan?.image) return null;
  let img = floorImgs.get(f.id);
  if (img && img.src === f.plan.image) return img.complete ? img : null;
  img = new Image();
  img.onload = () => onload && onload(img);
  img.src = f.plan.image;
  floorImgs.set(f.id, img);
  return img.complete ? img : null;
}

function resetEditing() {
  selection = null; wallChain = null; scaleLine = null; areaDraft = null;
  probeActive = (project.probes || []).length - 1;
  undoStack = []; redoStack = [];               // undo history is per floor visit
}

function switchFloor(i) {
  if (i === project.floorIdx || !project.floors[i]) return;
  if (typeof finishArea === "function") finishArea();
  syncActive();
  project.floorIdx = i;
  Object.assign(project, pickFloor(project.floors[i]));
  project.aps.forEach(normalizeAp);
  resetEditing();
  planImg = floorImage(project.floors[i], img => { if (project.floors[project.floorIdx] === project.floors[i]) { planImg = img; requestRender(); View3D.refresh(); } });
  View3D.reset();
  fit(); changed(); renderFloorBar();
  flash(tf("floorNow", { f: floorName(i) }));
}

// New floor above the top one: empty (same plan size and scale as this floor) or a copy of this floor.
function addFloor(copy) {
  syncActive();
  const cur = project.floors[project.floorIdx];
  const name = String(project.floors.length + 1);
  const f = floorMeta(name);
  f.height = cur.height; f.slab = cur.slab; f.ox = cur.ox; f.oy = cur.oy;
  const clone = v => JSON.parse(JSON.stringify(v));
  if (copy) {
    Object.assign(f, clone(pickFloor(cur)));
    f.aps = []; f.survey = []; f.probes = []; f.calib = null;
    for (const k of ["walls", "areas", "attens"]) f[k] = (f[k] || []).map(o => ({ ...o, id: uid() }));
  } else {
    Object.assign(f, { plan: { image: null, width: cur.plan.width, height: cur.plan.height }, mPerPx: cur.mPerPx, scaleSet: false,
                       walls: [], aps: [], areas: [], attens: [], survey: [], probes: [], calib: null });
  }
  project.floors.push(f);
  switchFloor(project.floors.length - 1);
}

function deleteFloor(i) {
  if (project.floors.length < 2) return;
  syncActive();
  project.floors.splice(i, 1);
  const to = Math.min(i, project.floors.length - 1);
  project.floorIdx = -1;                        // force the switch to load the floor
  switchFloorForce(to);
}
function switchFloorForce(i) {
  project.floorIdx = i;
  Object.assign(project, pickFloor(project.floors[i]));
  project.aps.forEach(normalizeAp);
  resetEditing();
  planImg = floorImage(project.floors[i], img => { planImg = img; requestRender(); });
  View3D.reset(); fit(); changed(); renderFloorBar();
}
function moveFloor(i, d) {
  const j = i + d;
  if (j < 0 || j >= project.floors.length) return;
  syncActive();
  const F = project.floors, act = F[project.floorIdx];
  [F[i], F[j]] = [F[j], F[i]];
  project.floorIdx = F.indexOf(act);
  changed(); renderFloorBar();
}

// ---------- floor bar (top left of the plan) ----------
function renderFloorBar() {
  const bar = $("#floorBar");
  if (!bar) return;
  const F = project.floors || [];
  // highest floor on top, like a lift panel
  bar.innerHTML = `<span class="fb-lbl">${t("floorLbl")}</span>` +
    F.map((f, i) => ({ f, i })).reverse().map(({ f, i }) =>
      `<button data-floor="${i}" class="${i === project.floorIdx ? "active" : ""}" title="${esc(f.name)}">${esc(f.name)}</button>`).join("") +
    `<button data-floor-act="settings" class="fb-icon" title="${esc(t("floorSettings"))}" aria-label="${esc(t("floorSettings"))}"><svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>` +
    `<button data-floor-act="add" class="fb-icon" title="${esc(t("floorAdd"))}" aria-label="${esc(t("floorAdd"))}">+</button>`;
}

function openFloorSettings() {
  syncActive();
  const i = project.floorIdx, f = project.floors[i], F = project.floors;
  const el = floorElevations(F);
  openModal(`<h2>${t("floorSettings")}</h2>
    <p class="unit">${t("floorHelp")}</p>
    <div class="model-form">
      <label class="field"><span>${t("floorName")}</span><input id="flName" value="${esc(f.name)}" maxlength="30"></label>
      <label class="field"><span>${t("floorHeight")} (m)</span><input id="flH" type="number" min="2" max="20" step="0.1" value="${f.height}"></label>
      <label class="field"><span>${t("floorSlab")}</span><select id="flSlab">${Object.keys(SLABS).map(k => `<option value="${k}" ${f.slab === k ? "selected" : ""}>${t("slab_" + k)} (${SLABS[k].db24}/${SLABS[k].db5}/${SLABS[k].db6} dB)</option>`).join("")}</select></label>
      <label class="field"><span>${t("floorElev")}</span><input value="${el[i].toFixed(1)} m" disabled></label>
      <label class="field"><span>${t("floorOx")} (m)</span><input id="flOx" type="number" step="0.1" value="${f.ox || 0}"></label>
      <label class="field"><span>${t("floorOy")} (m)</span><input id="flOy" type="number" step="0.1" value="${f.oy || 0}"></label>
    </div>
    <p class="unit">${t("floorAlignHelp")}</p>
    <div class="btns inline floor-btns">
      <button data-act="down" ${i === 0 ? "disabled" : ""}>${t("floorMoveDown")}</button>
      <button data-act="up" ${i === F.length - 1 ? "disabled" : ""}>${t("floorMoveUp")}</button>
      <button data-act="dup">${t("floorDuplicate")}</button>
      <button data-act="copyaps" ${F.length < 2 || !(f.aps || []).length ? "disabled" : ""}>${t("floorCopyAps")}</button>
      <button data-act="add">${t("floorAddEmpty")}</button>
      <button data-act="del" class="danger" ${F.length < 2 ? "disabled" : ""}>${t("floorDelete")}</button>
    </div>
    <div class="btns inline"><button class="primary" data-act="close">${t("close")}</button></div>`, null, "wide");
  const box = $("#modalBox");
  const num = (id, lo, hi, d) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const apply = () => {
    f.name = ($("#flName").value.trim() || String(i + 1)).slice(0, 30);
    f.height = num("#flH", 2, 20, FLOOR_H_DEFAULT);
    f.slab = SLABS[$("#flSlab").value] ? $("#flSlab").value : "concrete";
    f.ox = num("#flOx", -1000, 1000, 0); f.oy = num("#flOy", -1000, 1000, 0);
    renderFloorBar(); changed({ panel: false });
  };
  box.querySelectorAll("input, select").forEach(x => x.addEventListener("change", apply));
  box.querySelector('[data-act="close"]').onclick = () => { apply(); closeModal(); };
  box.querySelector('[data-act="up"]').onclick = () => { apply(); moveFloor(i, 1); openFloorSettings(); };
  box.querySelector('[data-act="down"]').onclick = () => { apply(); moveFloor(i, -1); openFloorSettings(); };
  box.querySelector('[data-act="dup"]').onclick = () => { apply(); closeModal(); addFloor(true); };
  box.querySelector('[data-act="copyaps"]').onclick = () => {
    apply(); closeModal();
    confirmModal(t("floorCopyAps"), tf("floorCopyApsBody", { f: esc(f.name), n: (f.aps || []).length }), () => {
      copyApsToFloors(i); undoStack = []; redoStack = []; changed();
      flash(tf("floorCopiedAps", { n: (f.aps || []).length, c: F.length - 1 }));
    });
  };
  box.querySelector('[data-act="add"]').onclick = () => { apply(); closeModal(); addFloor(false); };
  box.querySelector('[data-act="del"]').onclick = () => {
    closeModal();
    confirmModal(t("floorDelete"), tf("floorDeleteBody", { f: esc(f.name) }), () => deleteFloor(i));
  };
}

function wireFloorBar() {
  $("#floorBar").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.floor != null) { View3D.close(); switchFloor(+b.dataset.floor); return; }
    if (b.dataset.floorAct === "settings") openFloorSettings();
    if (b.dataset.floorAct === "add") {
      openModal(`<h2>${t("floorAdd")}</h2><p>${t("floorAddHelp")}</p>
        <div class="btns inline"><button data-act="cancel">${t("cancel")}</button><button data-act="empty">${t("floorAddEmpty")}</button><button class="primary" data-act="dup">${t("floorDuplicate")}</button></div>`);
      const box = $("#modalBox");
      box.querySelector('[data-act="cancel"]').onclick = closeModal;
      box.querySelector('[data-act="empty"]').onclick = () => { closeModal(); addFloor(false); };
      box.querySelector('[data-act="dup"]').onclick = () => { closeModal(); addFloor(true); };
    }
  });
}

// ---------- other floors on the plan: faint walls of the floor below, APs above / below ----------
function drawOtherFloors(c, px) {
  const F = project.floors;
  if (!F || F.length < 2) return;
  const me = project.floorIdx, mpp = project.mPerPx, ox = +F[me].ox || 0, oy = +F[me].oy || 0;
  const conv = (f, x, y) => [(x * (+f.mPerPx || mpp) + (+f.ox || 0) - ox) / mpp, (y * (+f.mPerPx || mpp) + (+f.oy || 0) - oy) / mpp];
  c.save();
  const below = F[me - 1];
  if (below) {
    c.strokeStyle = P.text; c.globalAlpha = 0.16; c.lineWidth = 2 * px; c.setLineDash([6 * px, 5 * px]);
    c.beginPath();
    for (const w of below.walls || []) { const [a, b] = conv(below, w.x1, w.y1), [d, e] = conv(below, w.x2, w.y2); c.moveTo(a, b); c.lineTo(d, e); }
    c.stroke(); c.setLineDash([]);
  }
  c.globalAlpha = 0.55;
  F.forEach((f, j) => {
    if (j === me || Math.abs(j - me) > 1) return;
    for (const ap of f.aps || []) {
      const [x, y] = conv(f, ap.x, ap.y), r = 10 * px;
      c.fillStyle = P.tagBg; c.strokeStyle = P.sel; c.lineWidth = 1.5 * px; c.setLineDash([3 * px, 2 * px]);
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke(); c.setLineDash([]);
      c.fillStyle = P.text; c.font = `600 ${9 * px}px "Segoe UI", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(j > me ? "▲" : "▼", x, y + 0.5 * px);
      c.font = `${10 * px}px "Segoe UI", sans-serif`; c.textBaseline = "bottom";   // above: this floor's AP tags sit below
      c.fillText(`${ap.name || "AP"} · ${t("floorLbl")} ${f.name}`, x, y - r - 2 * px);
    }
  });
  c.restore();
}

// Channels across every floor: APs above and below interfere too.
function assignChannelsAllFloors() {
  syncActive();
  const F = project.floors;
  if (!F || F.length < 2) { assignChannels(project); return; }
  const list = [];
  F.forEach((f, i) => (f.aps || []).forEach(ap => list.push({ ap, floor: i })));
  const models = new Map();
  const model = (fi, band) => {
    const k = fi + "|" + band;
    if (!models.has(k)) models.set(k, modelFor(floorView(fi), band));
    return models.get(k);
  };
  assignChannels(project, list, (band, i, j) => {
    const { rf, sources, aps } = model(list[i].floor, band);
    const s = sources[aps.indexOf(list[j].ap)];
    return s ? sourceRssi(rf, s, list[i].ap.x, list[i].ap.y) : -Infinity;
  });
}

// Copy floor `from`'s APs to the other floors at the same spot in the building (plan offsets and
// scales respected), replacing their APs. Names become AP-<floor><nn>. Channels are re-planned.
function copyApsToFloors(from, targets = null) {
  syncActive();
  const F = project.floors, src = F[from];
  const list = targets || F.map((_, j) => j);
  const sm = +src.mPerPx || project.mPerPx, sox = +src.ox || 0, soy = +src.oy || 0;
  const name = (j, k) => `AP-${j + 1}${String(k + 1).padStart(2, "0")}`;
  for (const j of list) {
    const f = F[j], fm = +f.mPerPx || sm;
    if (j === from) { (f.aps || []).forEach((a, k) => { a.name = name(j, k); }); continue; }
    f.aps = (src.aps || []).map((ap, k) => ({ ...JSON.parse(JSON.stringify(ap)), id: uid(), name: name(j, k),
      x: (ap.x * sm + sox - (+f.ox || 0)) / fm, y: (ap.y * sm + soy - (+f.oy || 0)) / fm }));
  }
  project.aps = F[project.floorIdx].aps;
  project.aps.forEach(normalizeAp);
  assignChannelsAllFloors();
}

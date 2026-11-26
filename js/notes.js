// Map notes (pins with text, a category and an optional photo) and the distance measuring tool.
// Loaded before app.js; runs only after app.js has started.

const NOTE_CATS = {
  info:    { color: "#3b82f6" },
  install: { color: "#16a34a" },
  cable:   { color: "#f59e0b" },
  issue:   { color: "#dc2626" },
  photo:   { color: "#8b5cf6" },
};
const NOTE_KEYS = Object.keys(NOTE_CATS);

function hitNote(p) {
  const tol = 13 * touchK / view.s, L = project.notes || [];
  for (let i = L.length - 1; i >= 0; i--) if (Math.hypot(p.x - L[i].x, p.y - L[i].y - (-14 / view.s)) <= tol || Math.hypot(p.x - L[i].x, p.y - L[i].y) <= tol) return L[i];
  return null;
}

// Pin: a coloured drop with the note number, plus the first words of the text.
function drawNotes(c, px, interactive) {
  (project.notes || []).forEach((n, i) => {
    const col = (NOTE_CATS[n.cat] || NOTE_CATS.info).color, r = 9 * px, x = n.x, y = n.y - 14 * px;
    const isSel = interactive && selection?.type === "note" && selection.id === n.id;
    c.save();
    if (isSel) { c.fillStyle = P.selFill; c.strokeStyle = P.sel; c.lineWidth = 2 * px; c.beginPath(); c.arc(x, y, r + 5 * px, 0, 7); c.fill(); c.stroke(); }
    c.fillStyle = col; c.strokeStyle = "#fff"; c.lineWidth = 1.6 * px;
    c.beginPath(); c.moveTo(n.x, n.y); c.lineTo(x - r * 0.6, y + r * 0.6); c.arc(x, y, r, Math.PI * 0.75, Math.PI * 0.25); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#fff"; c.font = `700 ${10 * px}px "Segoe UI", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(i + 1), x, y + 0.5 * px);
    const txt = (n.text || "").split("\n")[0].slice(0, 28) + (n.photo ? ` · ${t("notePhotoTag")}` : "");
    if (txt.trim()) {
      c.font = `${10.5 * px}px "Segoe UI", "Leelawadee UI", sans-serif`; c.textAlign = "left";
      const w = c.measureText(txt).width + 8 * px, h = 15 * px, tx = x + r + 3 * px, ty = y - h / 2;
      c.fillStyle = P.tagBg; c.strokeStyle = isSel ? P.sel : P.tagLine; c.lineWidth = 1 * px;
      roundRect(c, tx, ty, w, h, 3 * px); c.fill(); c.stroke();
      c.fillStyle = P.text; c.fillText(txt, tx + 4 * px, y + 0.5 * px);
    }
    c.restore();
  });
}

function addNote(p) {
  pushHistory();
  const n = { id: uid(), x: p.x, y: p.y, text: "", cat: project.newNoteCat || "info", photo: null };
  project.notes = [...(project.notes || []), n];
  selection = { type: "note", id: n.id };
  renderPanel(); requestRender();
  setTimeout(() => $("#noteText")?.focus(), 0);
}

// Downscale a photo to ≤ 1280 px JPEG so project files stay reasonable.
function loadNotePhoto(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      res(cv.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

function renderNotePanel(el, n) {
  const i = project.notes.indexOf(n);
  el.innerHTML = `
    <div class="row"><span>${t("noteCat")}</span><select id="noteCat">${NOTE_KEYS.map(k => `<option value="${k}" ${n.cat === k ? "selected" : ""}>${t("noteCat_" + k)}</option>`).join("")}</select></div>
    <textarea id="noteText" class="note-text" rows="4" maxlength="1000" placeholder="${esc(t("notePh"))}">${esc(n.text || "")}</textarea>
    ${n.photo ? `<img src="${n.photo}" class="note-photo" alt="">` : ""}
    <div class="btn-row2">
      <button class="btn" id="notePhotoBtn">${t(n.photo ? "notePhotoReplace" : "notePhotoAdd")}</button>
      ${n.photo ? `<button class="btn" id="notePhotoDel">${t("notePhotoRemove")}</button>` : `<span></span>`}
    </div>
    <input type="file" id="notePhotoIn" accept="image/*" capture="environment" hidden>
    <p class="unit">${tf("noteInfo", { n: i + 1, x: (n.x * project.mPerPx).toFixed(1), y: (n.y * project.mPerPx).toFixed(1) })}</p>
    <button class="btn danger" id="delBtn">${t("deleteItem")}</button>`;
  $("#noteCat").addEventListener("change", e => { pushHistory(); n.cat = e.target.value; project.newNoteCat = n.cat; requestRender(); });
  $("#noteText").addEventListener("focus", pushHistory);
  $("#noteText").addEventListener("input", e => { n.text = e.target.value.slice(0, 1000); requestRender(); });
  $("#notePhotoBtn").addEventListener("click", () => $("#notePhotoIn").click());
  $("#notePhotoIn").addEventListener("change", async e => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try { pushHistory(); n.photo = await loadNotePhoto(f); renderPanel(); requestRender(); } catch (err) { flash(t("badFile")); }
  });
  $("#notePhotoDel")?.addEventListener("click", () => { pushHistory(); n.photo = null; renderPanel(); requestRender(); });
}

// ---------- measuring ----------
let measure = null;                       // { pts: [{x, y}], done: bool }
function measureTap(p) {
  if (!measure || measure.done) measure = { pts: [], done: false };
  measure.pts.push(snapPoint(p, measure.pts[measure.pts.length - 1], lockAngle(window.__shift)));
  renderPanel(); requestRender();
}
function measureLen(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return s; }
function drawMeasure(c, px) {
  if (!measure || !measure.pts.length) return;
  const pts = !measure.done && cursor ? [...measure.pts, snapPoint(cursor, measure.pts[measure.pts.length - 1], lockAngle(window.__shift))] : measure.pts;
  c.save();
  c.strokeStyle = "#ff7a00"; c.lineWidth = 2.5 * px; c.setLineDash([8 * px, 5 * px]);
  c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke(); c.setLineDash([]);
  c.fillStyle = "#ff7a00";
  for (const q of pts) { c.beginPath(); c.arc(q.x, q.y, 4 * px, 0, 7); c.fill(); }
  for (let i = 1; i < pts.length; i++) label(c, px, (pts[i].x + pts[i - 1].x) / 2, (pts[i].y + pts[i - 1].y) / 2, fmtLen(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)));
  if (pts.length > 2) { const e = pts[pts.length - 1]; label(c, px, e.x, e.y - 16 * px, `Σ ${fmtLen(measureLen(pts))}`); }
  c.restore();
}
function renderMeasurePanel(el) {
  const pts = measure?.pts || [];
  el.innerHTML = `<p class="empty">${t("measureHelp")}</p>` + (pts.length > 1 ? `
    <div class="row"><span>${t("measureTotal")}</span><b>${fmtLen(measureLen(pts))}</b></div>
    <div class="row"><span>${t("measureSegs")}</span><b>${pts.length - 1}</b></div>
    <button class="btn" id="measureClear">${t("measureClear")}</button>` : "");
  $("#measureClear")?.addEventListener("click", () => { measure = null; renderPanel(); requestRender(); });
}

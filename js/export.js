// Export menu: PDF report / PDF summary, Excel workbook, CSV, image, heatmap images (ZIP),
// project file. Everything is generated in the browser.
// Loaded before app.js; runs only after app.js has started.

function openExportMenu() {
  View3D.close();
  const item = (act, icon, title, desc) => `<button class="exp-item" data-exp="${act}"><span class="exp-ic">${icon}</span>
    <span><b>${title}</b><small>${desc}</small></span></button>`;
  openModal(`<h2>${t("expTitle")}</h2>
    <p class="unit">${t("expHelp")}</p>
    <div class="exp-grid">
      ${item("pdf", "PDF", t("expPdf"), t("expPdfD"))}
      ${item("pdfsum", "PDF", t("expPdfSum"), t("expPdfSumD"))}
      ${item("docx", "DOC", t("expDocx"), t("expDocxD"))}
      ${item("xlsx", "XLS", t("expXlsx"), t("expXlsxD"))}
      ${item("zip", "ZIP", t("expZip"), t("expZipD"))}
      ${item("png", "PNG", t("exportPng"), t("expPngD"))}
      ${item("csv", "CSV", t("exportData"), t("expCsvD"))}
      ${item("json", "JSON", t("save"), t("expJsonD"))}
    </div>
    <div class="progress" id="expProg" hidden><div></div></div>
    <div class="btns inline"><button data-act="close">${t("close")}</button></div>`, null, "wide");
  const box = $("#modalBox");
  box.querySelector("[data-act=close]").onclick = closeModal;
  const busy = async fn => {
    box.querySelectorAll("button").forEach(b => { b.disabled = true; });
    const bar = $("#expProg"); bar.hidden = false;
    try { await fn(p => { bar.firstElementChild.style.width = Math.round(p * 100) + "%"; }); closeModal(); }
    catch (e) { console.error(e); closeModal(); flash(t("pdfFailed")); }
  };
  box.querySelectorAll("[data-exp]").forEach(b => b.onclick = () => {
    const a = b.dataset.exp;
    if (a === "pdf") openReportDialog();
    else if (a === "pdfsum") openReportDialog("summary");
    else if (a === "docx") openReportDialog("docx");
    else if (a === "png") { closeModal(); exportPng(); }
    else if (a === "csv") { closeModal(); exportDesignCsv(); }
    else if (a === "json") { closeModal(); saveProject(); }
    else if (a === "xlsx") busy(async prog => { download(await buildSummaryXlsx(prog), `beamwise-summary-${stamp()}.xlsx`); flash(t("expDone")); });
    else if (a === "zip") busy(async prog => { download(await buildImagesZip(prog), `beamwise-heatmaps-${stamp()}.zip`); flash(t("expDone")); });
  });
}

const projDemand = () => project.floors.some(f => (f.areas || []).some(a => +a.devices > 0));
const r1 = v => Number.isFinite(v) ? Math.round(v * 10) / 10 : "";
const pct1 = v => v == null || !Number.isFinite(v) ? "" : Math.round(v * 1000) / 10;

async function buildSummaryXlsx(onProgress = () => {}) {
  syncActive();
  await preloadFloorImages();
  const F = project.floors, bands = reportBands(), st = project.settings, rep = project.report || {};
  const env = ENVIRONMENTS[st.env] || ENVIRONMENTS[1];
  const view = projDemand() ? "capacity" : "signal";
  const S = [];
  let done = 0;
  for (let i = 0; i < F.length; i++) {
    S[i] = {};
    for (const b of bands) {
      S[i][b] = await renderFloorShot(i, b, view, { image: false, with3d: b === bands[0] });
      onProgress(++done / (F.length * bands.length));
      await tickUi();
    }
  }
  changed();
  const B = v => ({ v, b: true });
  const multi = F.length > 1;
  const nAp = F.reduce((s, f) => s + (f.aps || []).length, 0);

  // Summary
  const sum = [
    [B(rep.title || t("pdfDefaultTitle"))],
    [t("pdfCustomer"), rep.customer || ""], [t("pdfAuthor"), rep.author || ""], [t("dateLbl"), new Date().toLocaleString(langLocale())],
    [],
    [B(t("pdfAssume"))],
    [t("environment"), `${t(env.key)} (n = ${project.calib?.n ?? env.n})`],
    [t("requirement"), reqText()],
    [t("clientDevice"), `${t("client_" + st.client)} · ${st.clientStd} · ${clientStreams(st)} SS`],
    [t("capReg"), st.capNbtc ? `✓ ${t("cty_" + (st.country || "TH"))}` : "—"],
    [t("patRow"), project.patterns ? Object.keys(project.patterns).join(", ") : t("patGeneric")],
    [],
    [B(t("summary"))],
    [B(t("floorLbl")), B("AP"), B(`${t("area")} (m²)`), ...bands.flatMap(b => [B(`${t("meetsShort")} ${b}G (%)`), B(`${t("covNone")} ${b}G (%)`), B(`Avg ${b}G (dBm)`)])],
  ];
  F.forEach((f, i) => sum.push([f.name, (f.aps || []).length, r1(S[i][bands[0]].area),
    ...bands.flatMap(b => { const s = S[i][b]; return [pct1(s.cov?.meet), pct1(s.cov?.none), r1(s.avg)]; })]));
  sum.push([B(t("bomTotal")), B(nAp), B(r1(F.reduce((s, f, i) => s + S[i][bands[0]].area, 0)))]);
  if (project.bom) { const q = bomRows(); sum.push([], [B(t("bomGrand")), B(+q.total.toFixed(2)), project.bom.currency]); }

  // Coverage per floor and band
  const cov = [[B(t("floorLbl")), B(t("band")), B(`${t("meetsReq")} (%)`), B(`${t("covNone")} (%)`), B("Avg (dBm)"), B("Min (dBm)"), B(t("pdfWeakN"))]];
  F.forEach((f, i) => bands.forEach(b => { const s = S[i][b]; cov.push([f.name, `${b} GHz`, pct1(s.cov?.meet), pct1(s.cov?.none), r1(s.avg), r1(s.min), s.weak.length]); }));

  // APs
  const apRows = apTableCsv(allApRows());
  const aps = [apRows[0].map(B), ...apRows.slice(1)];

  // Areas
  const areas = [[B(t("floorLbl")), B(t("areaName")), B(`${t("requirement")} (dBm)`), B(`${t("area")} (m²)`), B(t("capDevShort")), B(t("capApp")), B("Mbps"),
    ...bands.map(b => B(`${t("meetsShort")} ${b}G (%)`))]];
  F.forEach((f, i) => projectAreas(f).forEach((a, k) => areas.push([f.name, a.name || `#${k + 1}`, a.req === "auto" || a.req == null ? baseReqDbm() : +a.req,
    r1(Math.abs(polyArea(a.pts)) * (+f.mPerPx) ** 2), +a.devices || 0, +a.devices ? t("app_" + (a.app || "web")) : "", +a.devices ? areaMbps(a) : "",
    ...bands.map(b => pct1(S[i][b].areaMeet[k]))])));

  // Capacity
  const cap = [[B(t("floorLbl")), B(t("band")), B("AP"), B(t("capDevShort")), B(`${t("pdfDemand")} (Mbps)`), B("Airtime (%)"), B(t("capStatus"))]];
  F.forEach((f, i) => bands.forEach(b => (S[i][b].caps || []).forEach((L, k) => {
    if (L.devices < 0.5) return;
    cap.push([f.name, `${b} GHz`, S[i][b].aps[k]?.name || "AP", Math.round(L.devices), Math.round(L.demand), Math.round(L.airtime * 100),
      L.airtime > 1 || L.devices > DEVICES_PER_RADIO ? t("capOverShort") : L.airtime > 0.8 ? t("capBusyShort") : "OK"]);
  })));

  // Weak areas
  const weak = [[B(t("floorLbl")), B(t("band")), B("x (m)"), B("y (m)"), B(`${t("area")} (m²)`), B("Worst (dBm)")]];
  F.forEach((f, i) => bands.forEach(b => S[i][b].weak.forEach(w => weak.push([f.name, `${b} GHz`, w.x_m, w.y_m, w.area_m2, w.worst_dbm ?? ""]))));

  // Walls
  const walls = [[B(t("floorLbl")), B(t("material")), B(t("pdfCount")), B(`${t("totalLength")} (m)`), B("dB 2.4G"), B("dB 5G"), B("dB 6G")]];
  F.forEach(f => {
    const by = {};
    for (const w of f.walls || []) { const e = by[w.mat] || (by[w.mat] = { n: 0, len: 0 }); e.n++; e.len += Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * (+f.mPerPx); }
    for (const [k, e] of Object.entries(by)) { const m = MATERIALS[k] || MATERIALS.brick; walls.push([f.name, matName(k), e.n, r1(e.len), m.db24, m.db5, m.db6]); }
  });

  // Survey
  const sur = [[B(t("floorLbl")), B("#"), B(t("band")), B("x (m)"), B("y (m)"), B(`${t("measured")} (dBm)`), B(`${t("predicted")} (dBm)`), B(`${t("errorLbl")} (dB)`)]];
  F.forEach(f => {
    const E = surveyErrors({ ...project, ...pickFloor(f), floorIdx: F.indexOf(f) });
    (f.survey || []).forEach((p, k) => { const r = E.rows.find(q => q.pt === p);
      sur.push([f.name, k + 1, `${p.band} GHz`, r1(p.x * f.mPerPx), r1(p.y * f.mPerPx), Number.isFinite(p.dbm) ? p.dbm : "", r && Number.isFinite(r.pred) ? r1(r.pred) : "", r && r.err != null ? r1(r.err) : ""]); });
  });

  const sheets = [
    { name: t("summary"), rows: sum, widths: [30, 14, 14, ...bands.flatMap(() => [14, 14, 14])] },
    { name: t("xlsCoverage"), rows: cov, widths: [14, 10, 20, 16, 12, 12, 14] },
    { name: "APs", rows: aps, widths: apRows[0].map((_, i) => i < 3 ? 22 : 12) },
  ];
  if (areas.length > 1) sheets.push({ name: t("pdfAreas"), rows: areas, widths: [12, 22, 16, 12, 10, 26, 8, ...bands.map(() => 14)] });
  if (cap.length > 1) sheets.push({ name: t("capTitle"), rows: cap, widths: [12, 10, 16, 10, 16, 12, 14] });
  if (weak.length > 1) sheets.push({ name: t("xlsWeak"), rows: weak, widths: [12, 10, 10, 10, 12, 12] });
  if (walls.length > 1) sheets.push({ name: t("pdfWalls"), rows: walls, widths: [12, 24, 10, 16, 9, 9, 9] });
  const notesRows = [[B(t("floorLbl")), B("#"), B(t("noteCat")), B(t("xlsNotes")), B("x (m)"), B("y (m)"), B(t("notePhotoTag"))]];
  F.forEach(f => (f.notes || []).forEach((n, k) => notesRows.push([f.name, k + 1, t("noteCat_" + n.cat), n.text || "", r1(n.x * f.mPerPx), r1(n.y * f.mPerPx), n.photo ? "✓" : ""])));
  if (notesRows.length > 1) sheets.push({ name: t("xlsNotes"), rows: notesRows, widths: [12, 5, 16, 60, 9, 9, 8] });
  if (sur.length > 1) sheets.push({ name: t("calibTitle"), rows: sur, widths: [12, 6, 10, 10, 10, 16, 16, 14] });
  // 3D pictures, one per floor
  const pics = F.map((f, i) => ({ f, url: S[i][bands[0]].url3d })).filter(p => p.url);
  if (pics.length) {
    const rows = [], images = [];
    let row = 0;
    for (const p of pics) {
      rows[row] = [{ v: `${t("pdf3dCap")}${F.length > 1 ? ` · ${t("floorLbl")} ${p.f.name}` : ""} · ${bands[0]} GHz`, b: true }];
      images.push({ bytes: dataUrlBytes(p.url), w: 800, h: 500, row: row + 1, col: 0 });
      row += 28;
    }
    sheets.splice(1, 0, { name: "3D", rows, widths: [20], images });
  }
  if (project.bom) {
    const q = bomRows(), rows = bomCsv(q);
    sheets.push({ name: t("bomTitle"), rows: [rows[0].map(B), ...rows.slice(1)], widths: [36, 10, 10, 18, 18] });
  }
  return makeXlsx(sheets);
}

// PNG heatmaps: every floor × band, signal view plus the view on screen.
async function buildImagesZip(onProgress = () => {}) {
  syncActive();
  await preloadFloorImages();
  const F = project.floors, bands = reportBands();
  const views = [...new Set(["signal", curView()])];
  const safe = s => String(s).replace(/[\\/:*?"<>|]+/g, "-").slice(0, 40);
  const files = [];
  let done = 0;
  const total = F.length * bands.length * views.length;
  for (let i = 0; i < F.length; i++) for (const b of bands) for (const v of views) {
    const s = await renderFloorShot(i, b, v, { png: true, with3d: v === "signal" });
    files.push({ name: `${F.length > 1 ? `floor-${safe(F[i].name)}_` : ""}${b}GHz_${v}.png`, data: dataUrlBytes(s.url) });
    if (v === "signal") {
      const u3 = s.url3d;
      if (u3) files.push({ name: `${F.length > 1 ? `floor-${safe(F[i].name)}_` : ""}${b}GHz_3d.png`, data: dataUrlBytes(u3) });
    }
    onProgress(++done / total);
    await tickUi();
  }
  // note photos
  F.forEach(f => (f.notes || []).forEach((n, k) => { if (n.photo) files.push({ name: `notes/${F.length > 1 ? `floor-${safe(f.name)}_` : ""}note-${k + 1}.${/png/.test(n.photo.slice(0, 20)) ? "png" : "jpg"}`, data: dataUrlBytes(n.photo) }); }));
  changed();
  return makeZip(files);
}

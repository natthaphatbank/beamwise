// PDF report: a printable page built in the browser (cover, summary, heatmaps per floor / band /
// view with legends, AP table, areas, capacity, walls, calibration, quote, assumptions) and
// printed with the browser's "Save as PDF". Nothing leaves the device.
// Loaded before app.js; runs only after app.js has started.

const tickUi = () => new Promise(r => setTimeout(r, 0));

function reportBands() {
  syncActive();
  const all = project.floors.flatMap(f => f.aps || []);
  const b = BAND_LIST.filter(x => all.some(a => apTx(a, x) > 0));
  return b.length ? b : ["5"];
}

// preset "summary": a short report (signal heatmap per floor and band, summary, quote)
function openReportDialog(preset) {
  const short = preset === "summary";
  syncActive();
  const r = project.report || (project.report = { title: "", customer: "", author: "", notes: "" });
  const bands = reportBands();
  const demand = project.floors.some(f => (f.areas || []).some(a => +a.devices > 0));
  const views = ["signal", "secondary", "sinr", "rate", "cci", "serving", ...(demand ? ["capacity"] : [])];
  const defViews = new Set(short ? ["signal"] : ["signal", "sinr", "rate", ...(demand ? ["capacity"] : [])]);
  const hasQuote = project.bom && (Object.values(project.bom.prices || {}).some(v => v > 0) || project.bom.lines.some(l => l.price > 0));
  openModal(`<h2>${t(short ? "expPdfSum" : "pdfTitle")}</h2>
    <p class="unit">${t("pdfHelp")}</p>
    <div class="model-form">
      <label class="field"><span>${t("pdfProject")}</span><input id="rpTitle" value="${esc(r.title)}" maxlength="120" placeholder="${esc(t("pdfProjectPh"))}"></label>
      <label class="field"><span>${t("pdfCustomer")}</span><input id="rpCust" value="${esc(r.customer)}" maxlength="120"></label>
      <label class="field"><span>${t("pdfAuthor")}</span><input id="rpAuth" value="${esc(r.author)}" maxlength="120"></label>
      <label class="field"><span>${t("pdfNotes")}</span><input id="rpNotes" value="${esc(r.notes)}" maxlength="400"></label>
    </div>
    <h3 class="modal-sub">${t("pdfBands")}</h3>
    <div class="chk-row">${BAND_LIST.map(b => `<label class="check"><input type="checkbox" data-band="${b}" ${bands.includes(b) ? "checked" : ""}> ${b} GHz</label>`).join("")}</div>
    <h3 class="modal-sub">${t("pdfViews")}</h3>
    <div class="chk-row">${views.map(v => `<label class="check"><input type="checkbox" data-view="${v}" ${defViews.has(v) ? "checked" : ""}> ${t("view_" + v)}</label>`).join("")}</div>
    <h3 class="modal-sub">${t("pdfSections")}</h3>
    <div class="chk-row">
      <label class="check"><input type="checkbox" id="rpAps" ${short ? "" : "checked"}> ${t("apTableTitle")}</label>
      <label class="check"><input type="checkbox" id="rpDetails" ${short ? "" : "checked"}> ${t("pdfDetails")}</label>
      <label class="check"><input type="checkbox" id="rpQuote" ${hasQuote ? "checked" : ""}> ${t("bomTitle")}</label>
    </div>
    <div class="progress" id="rpProg" hidden><div></div></div>
    <div class="btns inline"><button data-act="cancel">${t("cancel")}</button><button class="primary" data-act="go">${t("pdfCreate")}</button></div>`, null, "wide");
  const box = $("#modalBox");
  box.querySelector('[data-act="cancel"]').onclick = closeModal;
  box.querySelector('[data-act="go"]').onclick = async () => {
    Object.assign(r, { title: $("#rpTitle").value.trim(), customer: $("#rpCust").value.trim(), author: $("#rpAuth").value.trim(), notes: $("#rpNotes").value.trim() });
    const opts = {
      bands: [...box.querySelectorAll("[data-band]:checked")].map(x => x.dataset.band),
      views: [...box.querySelectorAll("[data-view]:checked")].map(x => x.dataset.view),
      aps: $("#rpAps").checked, quote: $("#rpQuote").checked, details: $("#rpDetails").checked,
    };
    if (!opts.bands.length || !opts.views.length) { flash(t("pdfPickOne")); return; }
    box.querySelectorAll("button").forEach(b => { b.disabled = true; });
    const bar = $("#rpProg"); bar.hidden = false;
    try {
      const html = await buildReport(opts, p => { bar.firstElementChild.style.width = Math.round(p * 100) + "%"; });
      closeModal();
      printReport(html);
    } catch (e) {
      console.error(e); closeModal(); flash(t("pdfFailed"));
    }
  };
}

// Load every floor's plan image before drawing.
function preloadFloorImages() {
  return Promise.all(project.floors.map(f => new Promise(res => {
    if (!f.plan?.image) { res(); return; }
    const img = floorImage(f, () => res());
    if (img) res();
    else setTimeout(res, 3000);                // do not hang on a broken image
  })));
}

// Draw floor i on a band and view into an image; returns { url, cov, vst, req, area, caps }.
// opts.image: false = statistics only; opts.png: lossless image (for the images ZIP)
async function renderFloorShot(i, band, view, opts = {}) {
  const wantImg = opts.image !== false;
  const keep = { idx: project.floorIdx, band: project.settings.band, view: project.settings.view, planImg, waves: project.settings.waves };
  syncActive();
  const f = project.floors[i];
  project.floorIdx = i;
  Object.assign(project, pickFloor(f));
  planImg = f.plan?.image ? floorImgs.get(f.id) || null : null;
  project.settings.band = band; project.settings.view = view;
  heatCoarse = false; heatDirty = true;
  let out;
  try {
    updateHeat();
    let url = null;
    const { width: W, height: H } = project.plan;
    if (wantImg) {
    const k = Math.min(2, 1600 / Math.max(W, H));
    const cv = document.createElement("canvas");
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    const c = cv.getContext("2d");
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, cv.width, cv.height);
    c.save(); c.scale(k, k);
    drawScene(c, 1.5 / k, { interactive: false, theme: "light" });     // icons and labels readable at A4 width
    c.restore();
    const u = Math.max(1, k * 0.8);
    drawScaleBar(c, cv.width - 8 * u, cv.height - 8 * u, k / project.mPerPx, { u, theme: CANVAS_THEMES.light, maxW: Math.max(150 * u, cv.width * 0.18) });
    url = opts.png ? cv.toDataURL("image/png") : cv.toDataURL("image/jpeg", 0.9);
    }
    const box = buildingBox(project);
    const cov = heat && project.aps.length + crossFloorAps(project, band).length ? coverageStats(heat, effMinDbm(), heatReq || reqDbm(), box, heatMask) : null;
    const def = VIEW_DEFS[view];
    const vst = cov && viewGrids?.per && (def.good != null || def.goodMax != null) ? viewStats(viewGrids, view, box, heatMask, effMinDbm()) : null;
    // signal statistics inside the design area, per boundary area, weak spots
    let sum = 0, n = 0, mn = Infinity;
    const c0 = Math.max(0, Math.floor(box.x0 / heat.cell)), c1 = Math.min(heat.cols, Math.ceil(box.x1 / heat.cell));
    const r0 = Math.max(0, Math.floor(box.y0 / heat.cell)), r1 = Math.min(heat.rows, Math.ceil(box.y1 / heat.cell));
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
      const k = r * heat.cols + c, v = heat.data[k];
      if (heatMask && !heatMask[k]) continue;
      if (Number.isFinite(v)) { sum += v; n++; mn = Math.min(mn, v); }
    }
    const A = projectAreas(project), aN = new Array(A.length).fill(0), aOk = new Array(A.length).fill(0);
    if (heatAreaIdx) for (let k = 0; k < heatAreaIdx.length; k++) {
      const ai = heatAreaIdx[k];
      if (ai < 0) continue;
      aN[ai]++;
      if (heat.data[k] >= (heatReq ? heatReq[k] : reqDbm())) aOk[ai]++;
    }
    out = { url, cov, vst, caps: capLoads ? capLoads.slice(0, project.aps.length) : null,
            area: (areasPx2(project) ?? (box.x1 - box.x0) * (box.y1 - box.y0)) * project.mPerPx ** 2, aps: project.aps.slice(),
            avg: n ? sum / n : NaN, min: n ? mn : NaN, areaMeet: A.map((a, k) => aN[k] ? aOk[k] / aN[k] : null),
            weak: cov ? weakRegions(project, heat, heatReq || reqDbm(), 10) : [], viewAvg: vst ? vst.avg : NaN };
  } finally {
    project.floorIdx = keep.idx;
    Object.assign(project, pickFloor(project.floors[keep.idx]));
    planImg = keep.planImg;
    project.settings.band = keep.band; project.settings.view = keep.view;
    heatDirty = true;
  }
  return out;
}

function legendHtml(view, band) {
  const def = VIEW_DEFS[view];
  const sw = (rgb, lbl) => `<span class="rl-i"><i style="background:rgb(${rgb})"></i>${lbl}</span>`;
  let items;
  if (view === "signal" || view === "secondary") items = SIGNAL_STOPS.map(s => sw(s.rgb, `${s.label} dBm`));
  else if (view === "serving") items = [`<span class="rl-i">${esc(t("viewHelp_serving"))}</span>`];
  else items = def.stops.map(s => sw(s.rgb, `${s.label}${def.unit ? " " + def.unit : ""}`));
  return `<div class="r-legend"><b>${esc(t("view_" + view))} · ${band} GHz</b> ${items.join("")}</div>`;
}

async function buildReport(opts, onProgress) {
  syncActive();
  await preloadFloorImages();
  const F = project.floors, st = project.settings, r = project.report || {};
  const env = ENVIRONMENTS[st.env] || ENVIRONMENTS[1];
  const pct = v => v == null ? "—" : Math.round(v * 100) + "%";
  const date = new Date().toLocaleDateString(langLocale(), { year: "numeric", month: "long", day: "numeric" });
  const total = F.length * opts.bands.length * opts.views.length;
  let done = 0;
  const shots = [];                      // [floor][band] = { view: shot }
  for (let i = 0; i < F.length; i++) {
    shots[i] = {};
    for (const b of opts.bands) {
      shots[i][b] = {};
      for (const v of opts.views) {
        shots[i][b][v] = await renderFloorShot(i, b, v);
        onProgress(++done / total);
        await tickUi();
      }
    }
  }
  changed();
  const nAp = F.reduce((s, f) => s + (f.aps || []).length, 0);
  const sigView = opts.views.includes("signal") ? "signal" : opts.views[0];

  // ---- summary table: coverage per floor and band ----
  const sumRows = F.map((f, i) => `<tr><td>${esc(f.name)}</td><td>${(f.aps || []).length}</td><td>${shots[i][opts.bands[0]][sigView].area.toFixed(0)} m²</td>
    ${opts.bands.map(b => { const c = shots[i][b][sigView].cov; return `<td class="${c && c.meet >= 0.95 ? "ok" : c && c.meet >= 0.8 ? "mid" : "bad"}">${c ? pct(c.meet) : "—"}</td>`; }).join("")}</tr>`).join("");

  // ---- floor sections ----
  const floorSecs = F.map((f, i) => opts.bands.map(b => `
    <section class="r-page">
      <h2>${F.length > 1 ? `${esc(t("floorLbl"))} ${esc(f.name)} · ` : ""}${b} GHz</h2>
      ${opts.views.map(v => { const s = shots[i][b][v]; return `
        <figure class="r-fig">
          <img src="${s.url}" alt="">
          ${legendHtml(v, b)}
          <figcaption>${s.cov ? `${esc(t("meetsReq"))}: <b>${pct(s.cov.meet)}</b> · ${esc(t("covNone"))}: <b>${pct(s.cov.none)}</b>` : esc(t("pdfNoAps"))}
            ${s.vst ? ` · ${esc(tf("viewGood_" + v, { n: VIEW_DEFS[v].good ?? VIEW_DEFS[v].goodMax }))}: <b>${pct(s.vst.good)}</b>` : ""}</figcaption>
        </figure>`; }).join("")}
    </section>`).join("")).join("");

  // ---- AP table ----
  const apRows = opts.aps ? apTableCsv(allApRows()) : null;
  const apTbl = apRows && apRows.length > 1 ? `<section class="r-page r-flow"><h2>${esc(t("apTableTitle"))} (${nAp})</h2>
    <table class="r-tbl r-small"><thead><tr>${apRows[0].map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${apRows.slice(1).map(rw => `<tr>${rw.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>` : "";

  // ---- areas, capacity ----
  const areaRows = F.flatMap((f, i) => projectAreas(f).filter(a => a.name || a.req !== "auto" || +a.devices > 0).map(a => `<tr>${F.length > 1 ? `<td>${esc(f.name)}</td>` : ""}
    <td>${esc(a.name || "—")}</td><td>${a.req === "auto" || a.req == null ? baseReqDbm() : a.req} dBm</td><td>${(Math.abs(polyArea(a.pts)) * (+f.mPerPx) ** 2).toFixed(0)} m²</td>
    <td>${+a.devices || 0}</td><td>${+a.devices ? `${esc(t("app_" + (a.app || "web")))} (${areaMbps(a)} Mbps)` : ""}</td></tr>`));
  const areaTbl = areaRows.length ? `<h3>${esc(t("pdfAreas"))}</h3><table class="r-tbl"><thead><tr>${F.length > 1 ? `<th>${esc(t("floorLbl"))}</th>` : ""}<th>${esc(t("areaName"))}</th>
    <th>${esc(t("requirement"))}</th><th>${esc(t("area"))}</th><th>${esc(t("capDevShort"))}</th><th>${esc(t("capApp"))}</th></tr></thead><tbody>${areaRows.join("")}</tbody></table>` : "";
  const capRows = [];
  F.forEach((f, i) => opts.bands.forEach(b => {
    const s = Object.values(shots[i][b])[0];
    if (!s.caps) return;
    s.caps.forEach((L, k) => { if (L.devices >= 0.5) capRows.push(`<tr>${F.length > 1 ? `<td>${esc(f.name)}</td>` : ""}<td>${b} GHz</td><td>${esc(s.aps[k]?.name || "AP")}</td>
      <td>${Math.round(L.devices)}</td><td>${Math.round(L.demand)} Mbps</td><td class="${L.airtime > 1 ? "bad" : L.airtime > 0.8 ? "mid" : "ok"}">${L.airtime > 9.99 ? "> 999" : Math.round(L.airtime * 100)}%</td></tr>`); });
  }));
  const capTbl = capRows.length ? `<h3>${esc(t("capTitle"))}</h3><table class="r-tbl"><thead><tr>${F.length > 1 ? `<th>${esc(t("floorLbl"))}</th>` : ""}<th>${esc(t("band"))}</th><th>AP</th>
    <th>${esc(t("capDevShort"))}</th><th>${esc(t("pdfDemand"))}</th><th>Airtime</th></tr></thead><tbody>${capRows.join("")}</tbody></table>` : "";

  // ---- walls ----
  const byMat = {};
  for (const f of F) for (const w of f.walls || []) {
    const e = byMat[w.mat] || (byMat[w.mat] = { n: 0, len: 0 });
    e.n++; e.len += Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * (+f.mPerPx);
  }
  const wallTbl = Object.keys(byMat).length ? `<h3>${esc(t("pdfWalls"))}</h3><table class="r-tbl"><thead><tr><th>${esc(t("material"))}</th><th>${esc(t("pdfCount"))}</th><th>${esc(t("totalLength"))}</th><th>dB 2.4 / 5 / 6 GHz</th></tr></thead>
    <tbody>${Object.entries(byMat).map(([k, e]) => { const m = MATERIALS[k] || MATERIALS.brick; return `<tr><td>${esc(t("mat_" + k))}</td><td>${e.n}</td><td>${e.len.toFixed(1)} m</td><td>${m.db24} / ${m.db5} / ${m.db6}</td></tr>`; }).join("")}</tbody></table>` : "";

  // ---- calibration ----
  const calRows = F.map(f => {
    const E = surveyErrors({ ...project, ...pickFloor(f) });
    return E.all ? `<tr><td>${esc(f.name)}</td><td>${E.all.n}</td><td>${E.all.rms.toFixed(1)} dB</td><td>${f.calib ? `n = ${f.calib.n}` : "—"}</td></tr>` : "";
  }).filter(Boolean);
  const calTbl = calRows.length ? `<h3>${esc(t("calibTitle"))}</h3><table class="r-tbl"><thead><tr><th>${esc(t("floorLbl"))}</th><th>${esc(t("calibPoints"))}</th><th>RMS</th><th>${esc(t("pdfModel"))}</th></tr></thead><tbody>${calRows.join("")}</tbody></table>` : "";

  // ---- quote ----
  let quote = "";
  if (opts.quote) {
    const q = bomRows();
    quote = `<section class="r-page r-flow"><h2>${esc(t("bomTitle"))}</h2><table class="r-tbl"><thead><tr><th>${esc(t("bomItem"))}</th><th>${esc(t("bomQty"))}</th><th>${esc(t("bomUnit"))}</th>
      <th class="n">${esc(t("bomPrice"))}</th><th class="n">${esc(t("bomTotal"))}</th></tr></thead><tbody>
      ${q.rows.map(x => `<tr><td>${esc(x.name)}</td><td>${x.qty}</td><td>${esc(x.unit)}</td><td class="n">${money(x.price)}</td><td class="n">${money(x.total)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="4">${esc(t("bomSubtotal"))}</td><td class="n">${money(q.sub)}</td></tr><tr><td colspan="4">VAT ${q.bom.vat}%</td><td class="n">${money(q.vat)}</td></tr>
      <tr class="grand"><td colspan="4">${esc(t("bomGrand"))} (${esc(q.bom.currency)})</td><td class="n">${money(q.total)}</td></tr></tfoot></table>
      <p class="r-note">${esc(t("bomNote"))}</p></section>`;
  }

  const assumptions = [
    [t("environment"), `${t(env.key)} (n = ${project.calib?.n ?? env.n})`],
    [t("requirement"), reqText()],
    [t("clientDevice"), `${t("client_" + st.client)} · ${st.clientStd} · ${clientStreams(st)} SS · ${st.clientH} m`],
    [t("capNbtc"), st.capNbtc ? "✓" : "—"],
    [t("pathsOpt"), st.paths !== false ? "✓" : "—"],
    [t("patRow"), project.patterns ? Object.keys(project.patterns).map(id => AP_BY_ID[id] ? `${AP_BY_ID[id].brand} ${AP_BY_ID[id].model}` : id).join(", ") + ` (${t("patMeasured")})` : t("patGeneric")],
  ];

  return `
  <section class="r-cover">
    <div class="r-brand"><img src="icons/favicon.svg" alt="" width="34" height="34"> Beamwise</div>
    <h1>${esc(r.title || t("pdfDefaultTitle"))}</h1>
    ${r.customer ? `<p class="r-sub">${esc(r.customer)}</p>` : ""}
    <p class="r-meta">${esc(date)}${r.author ? ` · ${esc(t("pdfAuthor"))}: ${esc(r.author)}` : ""}</p>
    ${r.notes ? `<p class="r-notes">${esc(r.notes)}</p>` : ""}
    <h3>${esc(t("summary"))}</h3>
    <table class="r-tbl"><thead><tr><th>${esc(t("floorLbl"))}</th><th>AP</th><th>${esc(t("area"))}</th>${opts.bands.map(b => `<th>${esc(t("meetsShort"))} ${b} GHz</th>`).join("")}</tr></thead>
      <tbody>${sumRows}</tbody></table>
    <p class="r-note">${esc(tf("pdfSumNote", { n: nAp, f: F.length }))}</p>
    <h3>${esc(t("pdfAssume"))}</h3>
    <table class="r-tbl r-kv"><tbody>${assumptions.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</tbody></table>
    ${areaTbl}${capTbl}
    <p class="r-note">${esc(t("disclaimer"))}</p>
  </section>
  ${floorSecs}
  ${apTbl}
  ${opts.details !== false && (wallTbl || calTbl) ? `<section class="r-page r-flow"><h2>${esc(t("pdfDetails"))}</h2>${wallTbl}${calTbl}</section>` : ""}
  ${quote}`;
}

function printReport(html) {
  let root = $("#printRoot");
  if (!root) { root = document.createElement("div"); root.id = "printRoot"; document.body.appendChild(root); }
  root.innerHTML = html;
  document.body.classList.add("printing");
  const done = () => { document.body.classList.remove("printing"); root.innerHTML = ""; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  // let the images decode before the print snapshot
  Promise.all([...root.querySelectorAll("img")].map(i => i.decode ? i.decode().catch(() => {}) : null)).then(() => {
    setTimeout(() => { window.print(); flash(t("pdfPrinted")); }, 50);
  });
}

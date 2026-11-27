// AP table (every AP on every floor, editable in one place) and the bill of materials / quote.
// Loaded before app.js; runs only after app.js has started.

// ---------- AP table ----------
function allApRows() {
  syncActive();
  const rows = [];
  project.floors.forEach((f, fi) => (f.aps || []).forEach(ap => rows.push({ ap, fi, f })));
  return rows;
}

function openApTable() {
  const rows = allApRows();
  const multi = project.floors.length > 1;
  const cap = project.settings.capNbtc;
  const loadOf = (r) => r.fi === project.floorIdx && capLoads ? capLoads[project.aps.indexOf(r.ap)] : null;
  const chSel = (r, b) => { const k = "ch" + BK[b], v = r.ap[k];
    return `<select data-k="${k}" ${apTx(r.ap, b) > 0 ? "" : "disabled"}><option value="">–</option>${regChannels(b).map(c => `<option ${c === v ? "selected" : ""}>${c}</option>`).join("")}</select>`; };
  const wSel = (r, b) => { const k = "w" + BK[b], v = apWidth(r.ap, b);
    return `<select data-k="${k}" ${apTx(r.ap, b) > 0 ? "" : "disabled"}>${WIDTHS[b].map(w => `<option ${w === v ? "selected" : ""}>${w}</option>`).join("")}</select>`; };
  const txIn = (r, b) => `<input type="number" data-k="tx${BK[b]}" min="0" max="30" step="1" value="${apTx(r.ap, b)}">`;
  const body = rows.map((r, i) => {
    const spec = AP_BY_ID[r.ap.model];
    const L = loadOf(r);
    return `<tr data-i="${i}">
      ${multi ? `<td>${esc(r.f.name)}</td>` : ""}
      <td><input type="text" data-k="name" value="${esc(r.ap.name || "")}" class="w-name"></td>
      <td class="mdl">${spec ? esc(`${spec.brand} ${spec.model}`) : t("custom")}</td>
      <td>${t("mount_" + r.ap.mount)} · ${r.ap.h} m</td>
      ${BAND_LIST.map(b => `<td class="band-c">${txIn(r, b)}</td><td>${chSel(r, b)}</td><td>${wSel(r, b)}</td>`).join("")}
      <td class="eirp-c">${BAND_LIST.map(b => { const e = apEirp(r.ap, b, cap); return Number.isFinite(e) ? e : "–"; }).join(" / ")}</td>
      <td>${L ? (L.airtime > 9.99 ? "> 999" : Math.round(L.airtime * 100)) + "%" : ""}</td>
      <td><button class="link-btn" data-go="${i}">${t("apTableShow")}</button></td></tr>`;
  }).join("");
  openModal(`<h2>${t("apTableTitle")} <span class="unit">(${rows.length})</span></h2>
    <p class="unit">${t("apTableHelp")}</p>
    ${rows.length ? `<div class="tbl-wrap"><table class="calib-tbl ap-tbl">
      <thead><tr>${multi ? `<th>${t("floorLbl")}</th>` : ""}<th>${t("apName")}</th><th>${t("apModel")}</th><th>${t("mount")}</th>
        ${BAND_LIST.map(b => `<th class="band-c">${b}G Tx</th><th>${t("chShort")}</th><th>MHz</th>`).join("")}
        <th>EIRP ${BAND_LIST.join("/")}</th><th>${t("capLoadShort")}</th><th></th></tr></thead>
      <tbody>${body}</tbody></table></div>` : `<p>${t("aiNeedAps")}</p>`}
    <div class="btns inline">
      <button data-act="csv" ${rows.length ? "" : "disabled"}>${t("tableCsv")}</button>
      <button class="primary" data-act="close">${t("close")}</button></div>`, () => { changed(); }, "xwide");
  const box = $("#modalBox");
  focusClose();
  box.querySelector('[data-act="close"]').onclick = closeModal;
  box.querySelector('[data-act="csv"]').onclick = () => downloadCsv(apTableCsv(rows), "beamwise-ap-list");
  box.querySelectorAll("tbody tr").forEach(tr => {
    const r = rows[+tr.dataset.i];
    tr.querySelectorAll("[data-k]").forEach(inp => {
      inp.addEventListener("focus", () => { if (r.fi === project.floorIdx) pushHistory(); });
      inp.addEventListener("change", () => {
        const k = inp.dataset.k;
        if (k === "name") r.ap.name = inp.value.slice(0, 40);
        else if (/^ch/.test(k)) r.ap[k] = inp.value ? +inp.value : null;
        else { const v = parseFloat(inp.value); if (Number.isFinite(v)) r.ap[k] = Math.max(0, Math.min(30, v)); }
        heatDirty = true; requestRender();
      });
    });
  });
  box.querySelectorAll("[data-go]").forEach(b => b.onclick = () => {
    const r = rows[+b.dataset.go];
    closeModal();
    if (r.fi !== project.floorIdx) switchFloor(r.fi);
    if (tool !== "select") setTool("select");
    selection = { type: "ap", id: r.ap.id };
    view.ox = canvas.clientWidth / 2 - r.ap.x * view.s; view.oy = canvas.clientHeight / 2 - r.ap.y * view.s; viewFitted = false;
    renderPanel(); requestRender();
  });
}

function apTableCsv(rows) {
  const head = [t("floorLbl"), t("apName"), t("apModel"), t("mount"), "h (m)", "x (m)", "y (m)"];
  for (const b of BAND_LIST) head.push(`${b}G Tx (dBm)`, `${b}G ${t("gainShort")} (dBi)`, `${b}G EIRP`, `${b}G ${t("chShort")}`, `${b}G MHz`);
  const out = [head];
  for (const r of rows) {
    const spec = AP_BY_ID[r.ap.model], m = +r.f.mPerPx || project.mPerPx;
    const line = [r.f.name, r.ap.name, spec ? `${spec.brand} ${spec.model}` : t("custom"), t("mount_" + r.ap.mount), r.ap.h, +(r.ap.x * m).toFixed(2), +(r.ap.y * m).toFixed(2)];
    for (const b of BAND_LIST) {
      const e = apEirp(r.ap, b, project.settings.capNbtc);
      line.push(apTx(r.ap, b), apGain(r.ap, b), Number.isFinite(e) ? e : "", apCh(r.ap, b) ?? "", apTx(r.ap, b) > 0 ? apWidth(r.ap, b) : "");
    }
    out.push(line);
  }
  return out;
}

// openModal focuses the first button; in these tables that could be a delete ×.
const focusClose = () => setTimeout(() => $("#modalBox [data-act=close]")?.focus(), 0);

// A cell that starts with = + - @ (or tab / CR) is run as a formula by Excel, so a crafted AP or area
// name could run commands on the reader's PC. Prefix text like that with ' (numbers stay numbers).
const csvSafe = v => { const s = String(v ?? ""); return typeof v !== "number" && /^[=+\-@\t\r]/.test(s) && !/^[-+]?\d+(\.\d+)?$/.test(s) ? "'" + s : s; };
const csvCell = v => { const s = csvSafe(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function downloadCsv(rows, name) {
  const txt = "﻿" + rows.map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  download(new Blob([txt], { type: "text/csv;charset=utf-8" }), `${name}-${stamp()}.csv`);
}

// ---------- bill of materials / quote ----------
// project.bom = { currency, vat (%), cablePerAp (m), prices: {modelKey: unit price}, lines: [{id, name, auto, unit, qty, price}] }
// auto: "aps" (qty = number of APs), "cable" (qty = APs × cablePerAp), "" (qty typed).
function defaultBom() {
  return { currency: "THB", vat: 7, cablePerAp: 30, prices: {}, lines: [
    { id: "poe", name: t("bomPoe"), auto: "aps", unit: t("bomUnitPort"), qty: 0, price: 0 },
    { id: "cable", name: t("bomCable"), auto: "cable", unit: "m", qty: 0, price: 0 },
    { id: "install", name: t("bomInstall"), auto: "aps", unit: t("bomUnitSet"), qty: 0, price: 0 },
  ] };
}
function cleanBom(b) {
  if (!b || typeof b !== "object") return null;
  const n = (v, d, lo = 0, hi = 1e9) => { const x = +v; return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  const prices = {};
  if (b.prices && typeof b.prices === "object") for (const [k, v] of Object.entries(b.prices).slice(0, 500)) prices[String(k).slice(0, 80)] = n(v, 0);
  return {
    currency: strOr(b.currency, "THB", 8) || "THB", vat: n(b.vat, 7, 0, 100), cablePerAp: n(b.cablePerAp, 30, 0, 1000), prices,
    lines: (Array.isArray(b.lines) ? b.lines : []).filter(l => l && typeof l === "object").slice(0, 100).map(l => ({
      id: strOr(l.id, "", 20) || uid(), name: strOr(l.name, "", 80), auto: ["aps", "cable"].includes(l.auto) ? l.auto : "",
      unit: strOr(l.unit, "", 12), qty: n(l.qty, 0), price: n(l.price, 0) })),
  };
}

// Quote rows: AP models (all floors) then the other lines, with quantities resolved.
function bomRows() {
  const bom = project.bom || (project.bom = defaultBom());
  const rows = allApRows();
  const nAp = rows.length;
  const byModel = new Map();
  for (const r of rows) {
    const spec = AP_BY_ID[r.ap.model];
    const key = spec ? spec.id : "custom";
    const e = byModel.get(key) || { key, name: spec ? `${spec.brand} ${spec.model}` : t("custom"), qty: 0 };
    e.qty++; byModel.set(key, e);
  }
  const out = [...byModel.values()].map(e => ({ kind: "model", key: e.key, name: e.name, unit: t("bomUnitPc"), qty: e.qty, price: +bom.prices[e.key] || 0 }));
  for (const l of bom.lines) {
    const qty = l.auto === "aps" ? nAp : l.auto === "cable" ? Math.round(nAp * bom.cablePerAp) : l.qty;
    out.push({ kind: "line", line: l, name: l.name, unit: l.unit, qty, price: l.price });
  }
  for (const r of out) r.total = r.qty * r.price;
  const sub = out.reduce((s, r) => s + r.total, 0), vat = sub * bom.vat / 100;
  return { rows: out, sub, vat, total: sub + vat, bom, nAp };
}
const money = v => (Math.round(v * 100) / 100).toLocaleString(langLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function openBom() {
  const q = bomRows(), b = q.bom;
  openModal(`<h2>${t("bomTitle")}</h2>
    <p class="unit">${t("bomHelp")}</p>
    <div class="model-form bom-set">
      <label class="field"><span>${t("bomCurrency")}</span><input id="bmCur" value="${esc(b.currency)}" maxlength="8"></label>
      <label class="field"><span>VAT (%)</span><input id="bmVat" type="number" min="0" max="100" step="0.5" value="${b.vat}"></label>
      <label class="field"><span>${t("bomCablePerAp")} (m)</span><input id="bmCab" type="number" min="0" max="1000" step="1" value="${b.cablePerAp}"></label>
    </div>
    <div class="tbl-wrap"><table class="calib-tbl bom-tbl">
      <thead><tr><th>${t("bomItem")}</th><th>${t("bomQty")}</th><th>${t("bomUnit")}</th><th>${t("bomPrice")}</th><th>${t("bomTotal")}</th><th></th></tr></thead>
      <tbody>${q.rows.map((r, i) => `<tr data-i="${i}">
        <td>${r.kind === "model" ? esc(r.name) : `<input type="text" data-f="name" value="${esc(r.name)}">`}</td>
        <td>${r.kind === "line" && !r.line.auto ? `<input type="number" data-f="qty" min="0" step="1" value="${r.qty}">` : `${r.qty}${r.kind === "line" ? ` <span class="unit" title="${esc(t("bomAutoQty"))}">auto</span>` : ""}`}</td>
        <td>${r.kind === "model" ? esc(r.unit) : `<input type="text" data-f="unit" value="${esc(r.unit)}" class="w-unit">`}</td>
        <td><input type="number" data-f="price" min="0" step="1" value="${r.price}"></td>
        <td class="num">${money(r.total)}</td>
        <td>${r.kind === "line" ? `<button class="link-btn danger" data-del="${i}">×</button>` : ""}</td></tr>`).join("")}</tbody>
      <tfoot>
        <tr><td colspan="4">${t("bomSubtotal")}</td><td class="num">${money(q.sub)}</td><td></td></tr>
        <tr><td colspan="4">VAT ${b.vat}%</td><td class="num">${money(q.vat)}</td><td></td></tr>
        <tr class="grand"><td colspan="4">${t("bomGrand")} (${esc(b.currency)})</td><td class="num">${money(q.total)}</td><td></td></tr>
      </tfoot></table></div>
    <button class="link-btn" data-act="addline">+ ${t("bomAddLine")}</button>
    <p class="unit">${t("bomNote")}</p>
    <div class="btns inline"><button data-act="csv">${t("tableCsv")}</button><button class="primary" data-act="close">${t("close")}</button></div>`, null, "xwide");
  const box = $("#modalBox");
  focusClose();
  const rerender = () => { const y = box.scrollTop; openBom(); $("#modalBox").scrollTop = y; };
  const num = v => { const x = parseFloat(v); return Number.isFinite(x) && x >= 0 ? x : 0; };
  $("#bmCur").onchange = e => { b.currency = e.target.value.trim().slice(0, 8) || "THB"; rerender(); };
  $("#bmVat").onchange = e => { b.vat = Math.min(100, num(e.target.value)); rerender(); };
  $("#bmCab").onchange = e => { b.cablePerAp = Math.min(1000, num(e.target.value)); rerender(); };
  box.querySelectorAll("tbody tr").forEach(tr => {
    const r = q.rows[+tr.dataset.i];
    tr.querySelectorAll("[data-f]").forEach(inp => inp.addEventListener("change", () => {
      const f = inp.dataset.f;
      if (r.kind === "model") { if (f === "price") b.prices[r.key] = num(inp.value); }
      else if (f === "name" || f === "unit") r.line[f] = inp.value.slice(0, f === "name" ? 80 : 12);
      else r.line[f] = num(inp.value);
      rerender();
    }));
  });
  box.querySelectorAll("[data-del]").forEach(btn => btn.onclick = () => {
    const r = q.rows[+btn.dataset.del];
    b.lines = b.lines.filter(l => l !== r.line); rerender();
  });
  box.querySelector('[data-act="addline"]').onclick = () => { b.lines.push({ id: uid(), name: t("bomNewLine"), auto: "", unit: t("bomUnitPc"), qty: 1, price: 0 }); rerender(); };
  box.querySelector('[data-act="close"]').onclick = closeModal;
  box.querySelector('[data-act="csv"]').onclick = () => downloadCsv(bomCsv(bomRows()), "beamwise-quote");
}

function bomCsv(q) {
  const out = [[t("bomItem"), t("bomQty"), t("bomUnit"), `${t("bomPrice")} (${q.bom.currency})`, `${t("bomTotal")} (${q.bom.currency})`]];
  for (const r of q.rows) out.push([r.name, r.qty, r.unit, r.price, +r.total.toFixed(2)]);
  out.push([], [t("bomSubtotal"), "", "", "", +q.sub.toFixed(2)], [`VAT ${q.bom.vat}%`, "", "", "", +q.vat.toFixed(2)], [t("bomGrand"), "", "", "", +q.total.toFixed(2)]);
  return out;
}

function wireTables() {
  document.addEventListener("click", e => {
    if (e.target.closest("[data-open=aptable]")) openApTable();
    if (e.target.closest("[data-open=bom]")) openBom();
  });
}

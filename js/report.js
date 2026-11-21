// Design data export: a CSV (opens in Excel / Google Sheets) with everything needed to
// review the design or chart it elsewhere. Headings are Thai when the UI is Thai, else English.

const REPORT_TEXT = {
  th: {
    title: "รายงานข้อมูลการออกแบบ Wi-Fi", project: "ข้อมูลโปรเจกต์", item: "รายการ", value: "ค่า",
    date: "วันที่", bandShown: "ย่านที่แสดง (GHz)", env: "สภาพแวดล้อม", pathLoss: "ค่า path-loss exponent",
    req: "สัญญาณขั้นต่ำที่ต้องการ (dBm)", floor: "สัญญาณต่ำสุดที่แสดง (dBm)", nbtc: "จำกัดกำลังส่งตาม กสทช.",
    scale: "ตั้งสเกลแล้ว", boundary: "มีขอบเขตสัญญาณ", area: "พื้นที่ออกแบบ (m²)", planSize: "ขนาดแบบแปลน (m)",
    yes: "ใช่", no: "ไม่",
    coverage: "ผลการครอบคลุม", band: "ย่านความถี่", meets: "ผ่านเกณฑ์ (%)", below: "ต่ำกว่าที่แสดง / จุดอับ (%)",
    avg: "สัญญาณเฉลี่ย (dBm)", min: "สัญญาณต่ำสุด (dBm)",
    aps: "Access Point", name: "ชื่อ", model: "รุ่น", x: "x (m)", y: "y (m)",
    tx24: "กำลังส่ง 2.4G (dBm)", gain24: "เกนเสา 2.4G (dBi)", eirp24: "EIRP 2.4G (dBm)", ch24: "ช่อง 2.4G",
    tx5: "กำลังส่ง 5G (dBm)", gain5: "เกนเสา 5G (dBi)", eirp5: "EIRP 5G (dBm)", ch5: "ช่อง 5G",
    walls: "ผนังแยกตามวัสดุ", material: "วัสดุ", count: "จำนวนเส้น", length: "ความยาวรวม (m)", loss24: "ลดทอน 2.4G (dB)", loss5: "ลดทอน 5G (dB)",
    weak: "จุดอ่อนสัญญาณ", areaM2: "พื้นที่ (m²)", worst: "สัญญาณต่ำสุด (dBm)",
    calib: "การสอบเทียบกับค่าที่วัดจริง", calibUsed: "ใช้โมเดลที่ปรับแล้ว", nUsed: "path-loss exponent ที่ใช้", off24: "ค่าชดเชย 2.4G (dB)", off5: "ค่าชดเชย 5G (dB)",
    points: "จำนวนจุดวัด", bias: "คลาดเคลื่อนเฉลี่ย (dB)", rms: "RMS (dB)", maxErr: "คลาดเคลื่อนสูงสุด (dB)",
    surveyPts: "จุดวัด", measured: "ค่าที่วัด (dBm)", predicted: "ค่าที่คาดการณ์ (dBm)", err: "คลาดเคลื่อน คาด − วัด (dB)",
    hist: "การกระจายความแรงสัญญาณ (สำหรับทำกราฟ)", range: "ช่วงสัญญาณ (dBm)", share: "% ของพื้นที่", noSignal: "ไม่มีสัญญาณ",
  },
  en: {
    title: "Wi-Fi design data report", project: "Project", item: "Item", value: "Value",
    date: "Date", bandShown: "Displayed band (GHz)", env: "Environment", pathLoss: "Path-loss exponent",
    req: "Required signal (dBm)", floor: "Display floor (dBm)", nbtc: "Thai NBTC power cap",
    scale: "Scale calibrated", boundary: "Coverage boundary drawn", area: "Design area (m²)", planSize: "Plan size (m)",
    yes: "Yes", no: "No",
    coverage: "Coverage", band: "Band", meets: "Meets requirement (%)", below: "Below display floor / dead zone (%)",
    avg: "Average signal (dBm)", min: "Minimum signal (dBm)",
    aps: "Access points", name: "Name", model: "Model", x: "x (m)", y: "y (m)",
    tx24: "Tx power 2.4G (dBm)", gain24: "Antenna gain 2.4G (dBi)", eirp24: "EIRP 2.4G (dBm)", ch24: "Channel 2.4G",
    tx5: "Tx power 5G (dBm)", gain5: "Antenna gain 5G (dBi)", eirp5: "EIRP 5G (dBm)", ch5: "Channel 5G",
    walls: "Walls by material", material: "Material", count: "Segments", length: "Total length (m)", loss24: "Loss 2.4G (dB)", loss5: "Loss 5G (dB)",
    weak: "Weak areas", areaM2: "Area (m²)", worst: "Worst signal (dBm)",
    calib: "Calibration with site measurements", calibUsed: "Calibrated model in use", nUsed: "Path-loss exponent used", off24: "Offset 2.4G (dB)", off5: "Offset 5G (dB)",
    points: "Survey points", bias: "Mean error (dB)", rms: "RMS (dB)", maxErr: "Max error (dB)",
    surveyPts: "Survey points", measured: "Measured (dBm)", predicted: "Predicted (dBm)", err: "Error predicted − measured (dB)",
    hist: "Signal distribution (for charts)", range: "Signal range (dBm)", share: "% of area", noSignal: "No signal",
  },
};

// Heatmap for one band at a fixed resolution, plus the boundary mask.
function bandHeat(band) {
  const h = computeHeatmap(project, band, Math.max(2, Math.max(project.plan.width, project.plan.height) / 260));
  return { h, mask: areaMask(project, h) };
}

// Values of the cells inside the design area (boundary, else building box).
function cellsInDesign(h, mask) {
  const box = buildingBox(project);
  const c0 = Math.max(0, Math.floor(box.x0 / h.cell)), c1 = Math.min(h.cols, Math.ceil(box.x1 / h.cell));
  const r0 = Math.max(0, Math.floor(box.y0 / h.cell)), r1 = Math.min(h.rows, Math.ceil(box.y1 / h.cell));
  const out = [];
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    const k = r * h.cols + c;
    if (!mask || mask[k]) out.push(h.data[k]);
  }
  return out;
}

const eirpCell = (ap, band) => { const e = apEirp(ap, band, project.settings.capNbtc); return Number.isFinite(e) ? e : "—"; };

function buildDesignCsv() {
  const L = REPORT_TEXT[LANG === "th" ? "th" : "en"];
  const mpp = project.mPerPx, m = v => +(v * mpp).toFixed(2);
  const st = project.settings, env = ENVIRONMENTS[st.env] || ENVIRONMENTS[1];
  const req = reqDbm(), floor = effMinDbm();
  const box = buildingBox(project);
  const areaPx = areasPx2(project) ?? (box.x1 - box.x0) * (box.y1 - box.y0);
  const rows = [];
  const blank = () => rows.push([]);
  const section = title => { if (rows.length) blank(); rows.push([`# ${title}`]); };

  rows.push([L.title, "Beamwise"]);
  section(L.project);
  rows.push([L.item, L.value]);
  rows.push([L.date, new Date().toLocaleString(langLocale())]);
  rows.push([L.planSize, `${m(project.plan.width)} x ${m(project.plan.height)}`]);
  rows.push([L.area, +(areaPx * mpp * mpp).toFixed(1)]);
  rows.push([L.boundary, projectAreas(project).length ? L.yes : L.no]);
  rows.push([L.scale, project.scaleSet || !project.plan.image ? L.yes : L.no]);
  rows.push([L.env, t(env.key)]);
  rows.push([L.pathLoss, env.n]);
  rows.push([L.req, req]);
  rows.push([L.floor, floor]);
  rows.push([L.nbtc, st.capNbtc ? L.yes : L.no]);
  rows.push([L.bandShown, st.band]);

  section(L.coverage);
  rows.push([L.band, L.meets, L.below, L.avg, L.min]);
  const heats = {};
  for (const b of ["2.4", "5"]) {
    const { h, mask } = heats[b] = bandHeat(b);
    const vals = cellsInDesign(h, mask);
    const n = vals.length || 1;
    const finite = vals.filter(Number.isFinite);
    const meet = vals.filter(v => v >= req).length, below = vals.filter(v => v < floor).length;
    rows.push([`${b} GHz`, +(meet / n * 100).toFixed(1), +(below / n * 100).toFixed(1),
      finite.length ? +(finite.reduce((a, v) => a + v, 0) / finite.length).toFixed(1) : "",
      finite.length ? +Math.min(...finite).toFixed(1) : ""]);
  }

  section(L.aps);
  rows.push([L.name, L.model, L.x, L.y, L.tx24, L.gain24, L.eirp24, L.ch24, L.tx5, L.gain5, L.eirp5, L.ch5]);
  for (const ap of project.aps) {
    const spec = AP_BY_ID[ap.model];
    rows.push([ap.name, spec ? `${spec.brand} ${spec.model}` : t("custom"), m(ap.x), m(ap.y),
      ap.tx24, ap.gain24, eirpCell(ap, "2.4"), ap.ch24 ?? "",
      ap.tx5, ap.gain5, eirpCell(ap, "5"), ap.ch5 ?? ""]);
  }

  section(L.walls);
  rows.push([L.material, L.count, L.length, L.loss24, L.loss5]);
  const byMat = {};
  for (const w of project.walls) {
    const e = byMat[w.mat] || (byMat[w.mat] = { n: 0, len: 0 });
    e.n++; e.len += Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * mpp;
  }
  for (const [k, e] of Object.entries(byMat)) {
    const mt = MATERIALS[k] || MATERIALS.brick;
    rows.push([t("mat_" + k), e.n, +e.len.toFixed(2), mt.db24, mt.db5]);
  }

  for (const b of ["2.4", "5"]) {
    section(`${L.weak} ${b} GHz`);
    rows.push(["#", L.x, L.y, L.areaM2, L.worst]);
    weakRegions(project, heats[b].h, req, 20).forEach((w, i) => rows.push([i + 1, w.x_m, w.y_m, w.area_m2, w.worst_dbm ?? L.noSignal]));
  }

  const E = surveyErrors(project);
  if ((project.survey || []).length || project.calib) {
    section(L.calib);
    rows.push([L.item, L.value]);
    rows.push([L.calibUsed, project.calib ? L.yes : L.no]);
    rows.push([L.nUsed, project.calib ? project.calib.n : env.n]);
    if (project.calib) { rows.push([L.off24, project.calib.off24]); rows.push([L.off5, project.calib.off5]); }
    blank();
    rows.push([L.band, L.points, L.bias, L.rms, L.maxErr]);
    for (const b of ["2.4", "5"]) {
      const st = E[b];
      if (st) rows.push([`${b} GHz`, st.n, +st.bias.toFixed(1), +st.rms.toFixed(1), +st.max.toFixed(1)]);
    }
    section(L.surveyPts);
    rows.push(["#", L.band, L.x, L.y, L.measured, L.predicted, L.err]);
    (project.survey || []).forEach((pt, i) => {
      const r = E.rows.find(q => q.pt === pt);
      rows.push([i + 1, `${pt.band} GHz`, m(pt.x), m(pt.y), Number.isFinite(pt.dbm) ? pt.dbm : "",
        r && Number.isFinite(r.pred) ? +r.pred.toFixed(1) : "", r && r.err != null ? +r.err.toFixed(1) : ""]);
    });
  }

  section(L.hist);
  rows.push([L.range, `2.4 GHz ${L.share}`, `5 GHz ${L.share}`]);
  const bins = [];
  for (let hi = -30; hi > -95; hi -= 5) bins.push([hi - 5, hi]);
  const dist = {};
  for (const b of ["2.4", "5"]) {
    const vals = cellsInDesign(heats[b].h, heats[b].mask), n = vals.length || 1;
    dist[b] = bins.map(([lo, hi]) => +(vals.filter(v => v >= lo && v < hi).length / n * 100).toFixed(1));
    dist[b].unshift(+(vals.filter(v => v >= -30).length / n * 100).toFixed(1));
    dist[b].push(+(vals.filter(v => v < -95).length / n * 100).toFixed(1));
  }
  const labels = ["≥ -30", ...bins.map(([lo, hi]) => `${lo} … ${hi}`), `< -95 / ${L.noSignal}`];
  labels.forEach((lb, i) => rows.push([lb, dist["2.4"][i], dist["5"][i]]));

  const cell = v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";   // BOM so Excel reads UTF-8 (Thai)
}

function exportDesignCsv() {
  download(new Blob([buildDesignCsv()], { type: "text/csv;charset=utf-8" }), `beamwise-design-data-${stamp()}.csv`);
  flash(t("dataExported"));
}

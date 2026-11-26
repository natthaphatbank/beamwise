// Measured antenna patterns. A pattern file from the vendor (or one you made) replaces the
// generic mount-based pattern for an AP model on one band.
//
// project.patterns = { modelId: { "2.4" | "5" | "6": { name, h: [360], v: [360], gain } } }
//   h[a]: gain (dB, ≤ 0, peak = 0) at azimuth a° from the AP's pointing direction
//   v[e]: gain (dB, ≤ 0) at e° below the horizon (0 = horizon, 90 = straight down, 270 = straight up)
// The 3D gain is h + v (the usual way to combine two cuts). The peak gain stays the AP's
// antenna gain (datasheet), or the file's gain when "use the file's gain" is chosen.
//
// Formats read:
//   .msi / .pln (Planet): NAME, GAIN, HORIZONTAL 360 / VERTICAL 360 blocks of "angle loss" lines
//   .ant (720 numbers): 360 azimuth then 360 elevation gains, dBi
//   .csv: angle, horizontal dB, vertical dB (gain or loss; normalised to peak 0)

const PATTERN_FLOOR_DB = -40;

// Normalise any 360-value cut to peak 0 dB. `loss` = values are attenuation (positive = weaker).
function normCut(vals, loss) {
  const g = vals.map(v => (loss ? -v : v));
  const mx = Math.max(...g);
  return g.map(v => Math.max(PATTERN_FLOOR_DB, +(v - mx).toFixed(2)));
}

// Resample "angle value" pairs to whole degrees 0..359 (linear, wrapping).
function resample(pairs) {
  const p = pairs.map(([a, v]) => [((a % 360) + 360) % 360, v]).sort((x, y) => x[0] - y[0]);
  if (p.length < 4) return null;
  const out = new Array(360);
  for (let d = 0; d < 360; d++) {
    let i = p.findIndex(q => q[0] >= d);
    const hi = i < 0 ? [p[0][0] + 360, p[0][1]] : p[i];
    const lo = i <= 0 ? [p[p.length - 1][0] - (i < 0 ? 0 : 360), p[p.length - 1][1]] : p[i - 1];
    out[d] = hi[0] === lo[0] ? hi[1] : lo[1] + (hi[1] - lo[1]) * (d - lo[0]) / (hi[0] - lo[0]);
  }
  return out;
}

/**
 * Parse a pattern file. Returns { name, gain (dBi | null), h, v } or throws.
 * opts.vZero: "horizon" (default) | "down" (0° = straight down / boresight of a ceiling AP)
 * opts.vDir: "down" (angles grow downwards, default) | "up"
 */
function parsePattern(text, fileName, opts = {}) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let name = (fileName || "").replace(/\.[^.]+$/, ""), gain = null, h = null, v = null;
  const msiStart = lines.findIndex(l => /^horizontal\b/i.test(l));
  if (msiStart >= 0) {
    for (const l of lines.slice(0, msiStart)) {
      const m = l.match(/^(\w+)\s+(.*)$/);
      if (!m) continue;
      if (/^name$/i.test(m[1])) name = m[2].trim() || name;
      if (/^gain$/i.test(m[1])) { const g = parseFloat(m[2]); if (Number.isFinite(g)) gain = /dbd/i.test(m[2]) ? g + 2.15 : g; }
    }
    const block = re => {
      const i = lines.findIndex(l => re.test(l));
      if (i < 0) return null;
      const pairs = [];
      for (let k = i + 1; k < lines.length && !/^[a-z]/i.test(lines[k]); k++) {
        const [a, b] = lines[k].split(/[\s,;]+/).map(Number);
        if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b]);
      }
      return resample(pairs);
    };
    const hr = block(/^horizontal\b/i), vr = block(/^vertical\b/i);
    if (!hr || !vr) throw new Error("msi");
    h = normCut(hr, true); v = normCut(vr, true);
  } else {
    const rows = lines.filter(l => /^[-+\d.]/.test(l)).map(l => l.split(/[\s,;\t]+/).map(x => parseFloat(x.replace(",", "."))));
    if (rows.length >= 720 && rows.every(r => r.length === 1 || !Number.isFinite(r[1]))) {
      const nums = rows.map(r => r[0]);                         // .ant: 360 azimuth then 360 elevation (dBi)
      gain = Math.max(...nums.slice(0, 360));
      h = normCut(nums.slice(0, 360), false); v = normCut(nums.slice(360, 720), false);
    } else if (rows.filter(r => r.length >= 3).length >= 4) {
      const r3 = rows.filter(r => r.length >= 3 && r.slice(0, 3).every(Number.isFinite));
      const hr = resample(r3.map(r => [r[0], r[1]])), vr = resample(r3.map(r => [r[0], r[2]]));
      // mostly ≥ 0 means attenuation values, otherwise gains
      const loss = r3.filter(r => r[1] >= 0).length > r3.length * 0.8 && Math.min(...r3.map(r => r[1])) === 0;
      h = normCut(hr, loss); v = normCut(vr, loss);
      if (!loss) gain = Math.max(...hr);
    } else throw new Error("format");
  }
  // bring the vertical cut to "0 = horizon, growing downwards"
  if (opts.vZero === "down") v = v.map((_, e) => v[((e - 90) % 360 + 360) % 360]);
  if (opts.vDir === "up") v = v.map((_, e) => v[(360 - e) % 360]);
  return { name: String(name).slice(0, 80), gain: Number.isFinite(gain) ? +gain.toFixed(2) : null, h, v };
}

// Pattern for an AP on a band, or null (generic pattern).
function apPattern(project, ap, band) {
  const P = project.patterns;
  if (!P) return null;
  const e = P[ap.model]?.[band];
  return e && e.h?.length === 360 && e.v?.length === 360 ? e : null;
}

// Gain change (dB) from a measured pattern. azRel: degrees from the AP's pointing direction;
// elevSigned: degrees below the horizon (negative = above).
function patternLookup(p, azRel, elevSigned) {
  const at = (arr, a) => {
    a = ((a % 360) + 360) % 360;
    const i = Math.floor(a), f = a - i;
    return arr[i] * (1 - f) + arr[(i + 1) % 360] * f;
  };
  return Math.max(PATTERN_FLOOR_DB, at(p.h, azRel) + at(p.v, elevSigned));
}

// Short revision string so model caches notice pattern changes without hashing arrays.
function patternsRev(project) {
  const P = project.patterns;
  if (!P) return "";
  return Object.entries(P).map(([m, b]) => m + ":" + Object.entries(b).map(([k, e]) => k + (e.rev || e.name)).join(",")).join("|");
}

// Small polar preview of both cuts (canvas).
function drawPatternPreview(cv, p) {
  const c = cv.getContext("2d"), W = cv.width, H = cv.height, r = Math.min(W / 4, H / 2) - 12;
  c.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const line = css.getPropertyValue("--line-strong") || "#999", text = css.getPropertyValue("--muted") || "#666", acc = css.getPropertyValue("--accent") || "#1f5fbf";
  const plot = (cx, arr, label, rot) => {
    c.strokeStyle = line; c.lineWidth = 1;
    for (const k of [1, 0.75, 0.5, 0.25]) { c.beginPath(); c.arc(cx, H / 2, r * k, 0, 7); c.stroke(); }
    c.beginPath(); c.moveTo(cx - r, H / 2); c.lineTo(cx + r, H / 2); c.moveTo(cx, H / 2 - r); c.lineTo(cx, H / 2 + r); c.stroke();
    c.strokeStyle = acc; c.lineWidth = 2; c.beginPath();
    for (let a = 0; a <= 360; a++) {
      const g = arr[a % 360], rr = r * Math.max(0, 1 + g / 40);
      const t = (a + rot) * Math.PI / 180, x = cx + rr * Math.cos(t), y = H / 2 + rr * Math.sin(t);
      a ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
    c.fillStyle = text; c.font = "11px sans-serif"; c.textAlign = "center"; c.fillText(label, cx, 11);
  };
  plot(W / 4, p.h, t("patH"), 0);
  plot(3 * W / 4, p.v, t("patV"), 0);       // 0° = horizon on the right, 90° = down
}

// ---------- pattern manager (opened from the AP panel) ----------
function openPatternManager(modelId) {
  const P = project.patterns || (project.patterns = {});
  const used = [...new Set(allApRows().map(r => r.ap.model))];
  if (!used.includes(modelId)) used.unshift(modelId);
  const label = id => { const m = AP_BY_ID[id]; return m ? `${m.brand} ${m.model}` : t("custom"); };
  const cur = P[modelId] || {};
  openModal(`<h2>${t("patTitle")}</h2>
    <p class="unit">${t("patHelp")}</p>
    <label class="row"><span>${t("apModel")}</span><select id="patModel">${used.map(id => `<option value="${esc(id)}" ${id === modelId ? "selected" : ""}>${esc(label(id))}${P[id] ? " ✓" : ""}</option>`).join("")}</select></label>
    <div class="model-form">
      <label class="field"><span>${t("patVZero")}</span><select id="patVZero"><option value="horizon">${t("patVZeroH")}</option><option value="down">${t("patVZeroD")}</option></select></label>
      <label class="field"><span>${t("patVDir")}</span><select id="patVDir"><option value="down">${t("patVDirDown")}</option><option value="up">${t("patVDirUp")}</option></select></label>
    </div>
    <table class="calib-tbl pat-tbl"><thead><tr><th>${t("band")}</th><th>${t("patFile")}</th><th></th></tr></thead><tbody>
      ${BAND_LIST.map(b => { const e = cur[b]; return `<tr><td>${b} GHz</td><td>${e ? `<b>${esc(e.name)}</b>${e.gain != null ? ` <span class="unit">(${e.gain} dBi)</span>` : ""}` : `<span class="unit">${t("patGeneric")}</span>`}</td>
        <td><button class="link-btn" data-load="${b}">${t(e ? "patReplace" : "patLoad")}</button>${e ? ` · <button class="link-btn" data-show="${b}">${t("patShow")}</button> · <button class="link-btn danger" data-rm="${b}">${t("deleteShort")}</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table>
    <canvas id="patCanvas" width="520" height="220" class="pat-canvas" ${BAND_LIST.some(b => cur[b]) ? "" : "hidden"}></canvas>
    <p class="unit">${t("patNote")}</p>
    <input type="file" id="patFileIn" accept=".msi,.pln,.ant,.csv,.txt" hidden>
    <div class="btns inline"><button class="primary" data-act="close">${t("close")}</button></div>`, () => changed(), "wide");
  const box = $("#modalBox");
  setTimeout(() => box.querySelector("[data-act=close]")?.focus(), 0);
  box.querySelector("[data-act=close]").onclick = closeModal;
  $("#patModel").onchange = e => openPatternManager(e.target.value);
  const show = b => { const cv = $("#patCanvas"); cv.hidden = false; drawPatternPreview(cv, cur[b]); };
  const first = BAND_LIST.find(b => cur[b]);
  if (first) show(first);
  let loadBand = null;
  box.querySelectorAll("[data-show]").forEach(x => x.onclick = () => show(x.dataset.show));
  box.querySelectorAll("[data-rm]").forEach(x => x.onclick = () => {
    delete cur[x.dataset.rm];
    if (!Object.keys(cur).length) delete P[modelId];
    heatDirty = true; openPatternManager(modelId);
  });
  box.querySelectorAll("[data-load]").forEach(x => x.onclick = () => { loadBand = x.dataset.load; $("#patFileIn").click(); });
  $("#patFileIn").onchange = async e => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f || !loadBand) return;
    try {
      const p = parsePattern(await f.text(), f.name, { vZero: $("#patVZero").value, vDir: $("#patVDir").value });
      p.rev = Date.now().toString(36);
      P[modelId] = { ...(P[modelId] || {}), [loadBand]: p };
      heatDirty = true;
      flash(tf("patLoaded", { m: label(modelId), b: loadBand }));
      openPatternManager(modelId);
    } catch (err) { flash(t("patBad")); }
  };
}

// Patterns from a project file: keep well-formed entries only.
function cleanPatterns(P) {
  if (!P || typeof P !== "object") return null;
  const out = {};
  for (const [id, bands] of Object.entries(P).slice(0, 300)) {
    if (!bands || typeof bands !== "object") continue;
    for (const b of BAND_LIST) {
      const e = bands[b];
      if (!e || !Array.isArray(e.h) || !Array.isArray(e.v) || e.h.length !== 360 || e.v.length !== 360) continue;
      const cut = a => a.map(x => Math.min(0, Math.max(PATTERN_FLOOR_DB, Number.isFinite(+x) ? +x : PATTERN_FLOOR_DB)));
      (out[String(id).slice(0, 80)] ||= {})[b] = { name: strOr(e.name, "pattern", 80), gain: Number.isFinite(+e.gain) && e.gain !== null ? +e.gain : null, h: cut(e.h), v: cut(e.v), rev: strOr(e.rev, "", 20) };
    }
  }
  return Object.keys(out).length ? out : null;
}

// ---------- external antennas ----------
// Generic antenna types for APs with antenna connectors. Gain per band (dBi) and half-power
// beamwidths; the pattern is a parabolic main lobe with a −25 dB floor (back / side lobes).
const ANTENNAS = {
  omni3:    { gain: { 24: 3,  5: 4,  6: 4 },  hbw: 360, vbw: 60 },
  omni6:    { gain: { 24: 6,  5: 7,  6: 7 },  hbw: 360, vbw: 25 },
  patch8:   { gain: { 24: 7,  5: 8,  6: 8 },  hbw: 70,  vbw: 70 },
  panel12:  { gain: { 24: 10, 5: 12, 6: 12 }, hbw: 60,  vbw: 30 },
  sector14: { gain: { 24: 13, 5: 15, 6: 15 }, hbw: 90,  vbw: 12 },
  sector17: { gain: { 24: 15, 5: 17, 6: 17 }, hbw: 60,  vbw: 8 },
  narrow20: { gain: { 24: 18, 5: 20, 6: 20 }, hbw: 30,  vbw: 30 },
};
const _antPat = {};
function antennaPattern(key) {
  const A = ANTENNAS[key];
  if (!A) return null;
  if (_antPat[key]) return _antPat[key];
  const cut = bw => Array.from({ length: 360 }, (_, a) => {
    if (bw >= 360) return 0;
    const d = Math.min(a, 360 - a);
    return Math.max(-25, -12 * (d / bw) ** 2);
  });
  return (_antPat[key] = { h: cut(A.hbw), v: cut(A.vbw), name: key });
}

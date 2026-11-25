// Site-survey calibration: compare predicted RSSI with values measured on site, and fit the
// model (path-loss exponent n + a per-band offset) so the heatmap matches the measurements.
//
// project.survey = [{id, x, y, dbm (measured, null until entered), band: "2.4" | "5" | "6"}]
// project.calib  = null | {n, off24, off5, off6, rmsBefore, rmsAfter, count, date}
// Error convention: error = predicted - measured (positive = the model is too optimistic).

const CALIB_N_RANGE = [1.5, 4.5, 0.05];
const CALIB_MAX_OFFSET = 20;           // dB; larger usually means wrong scale, AP position or power
const CALIB_WARN_OFFSET = 10;
// Prior that keeps n near the environment preset unless the measurements clearly disagree
// (dB² per unit of n²). Without it a few noisy points trade an implausible n against large
// offsets; in simulated surveys (σ = 4 dB noise, 3-8 points per band) it lowered the heatmap
// error in every case, most in the worst case with few points.
const CALIB_N_PRIOR = 100;

// Best-server RSSI at a point, optionally with a different n / offset than the project uses.
function predictBest(project, band, x, y, override = null) {
  const { rf, sources } = modelFor(project, band, override);
  let best = -Infinity;
  for (const src of sources) best = Math.max(best, sourceRssi(rf, src, x, y, best));
  return best;
}

const validSurvey = project => (project.survey || []).filter(p => Number.isFinite(p.dbm));

function errStats(errs) {
  if (!errs.length) return null;
  const n = errs.length;
  const bias = errs.reduce((a, e) => a + e, 0) / n;
  const rms = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / n);
  const max = errs.reduce((a, e) => Math.max(a, Math.abs(e)), 0);
  return { n, bias, rms, max };
}

// Per-point predictions and errors with the project's current model.
function surveyErrors(project) {
  const rows = validSurvey(project).map(pt => {
    const pred = project.aps.length ? predictBest(project, pt.band, pt.x, pt.y) : -Infinity;
    return { pt, pred, err: Number.isFinite(pred) ? pred - pt.dbm : null };
  });
  const by = b => errStats(rows.filter(r => r.pt.band === b && r.err != null).map(r => r.err));
  const out = { rows, all: errStats(rows.filter(r => r.err != null).map(r => r.err)) };
  for (const b of BAND_LIST) out[b] = by(b);
  return out;
}

/**
 * Least-squares fit. With 3+ points: grid search over n, and for each n the best per-band offset
 * (the mean residual, closed form), with a penalty CALIB_N_PRIOR·(n − preset n)².
 * With 1-2 points only the offsets are fitted (n stays).
 * Returns the new calib object, or null when there is nothing to fit.
 */
function fitCalibration(project) {
  const pts = validSurvey(project);
  if (!pts.length || !project.aps.length) return null;
  const before = surveyErrors(project).all;
  const envN = (ENVIRONMENTS[project.settings.env] || ENVIRONMENTS[1]).n;

  const evalN = n => {
    const off = {}, resid = [];
    for (const b of BAND_LIST) {
      const bp = pts.filter(p => p.band === b);
      const base = bp.map(p => predictBest(project, b, p.x, p.y, { n, offset: 0 }));
      const ok = bp.map((p, i) => [p.dbm, base[i]]).filter(([, v]) => Number.isFinite(v));
      // no 6 GHz readings: 6 GHz follows the 5 GHz correction (closest band)
      let o = ok.length ? ok.reduce((a, [m, v]) => a + (m - v), 0) / ok.length : b === "6" ? off["5"] : 0;
      o = Math.max(-CALIB_MAX_OFFSET, Math.min(CALIB_MAX_OFFSET, o));
      off[b] = o;
      for (const [m, v] of ok) resid.push(v + o - m);
    }
    const sse = resid.reduce((a, e) => a + e * e, 0);
    return { n, off, sse, cost: sse + CALIB_N_PRIOR * (n - envN) ** 2, count: resid.length };
  };

  let best = null;
  if (pts.length >= 3) {
    const [lo, hi, step] = CALIB_N_RANGE;
    for (let n = lo; n <= hi + 1e-9; n += step) {
      const r = evalN(+n.toFixed(2));
      if (!best || r.cost < best.cost) best = r;
    }
  } else {
    best = evalN(project.calib?.n ?? envN);
  }
  if (!best.count) return null;
  return {
    n: best.n, off24: +best.off["2.4"].toFixed(2), off5: +best.off["5"].toFixed(2), off6: +best.off["6"].toFixed(2),
    rmsBefore: before ? +before.rms.toFixed(2) : null,
    rmsAfter: +Math.sqrt(best.sse / best.count).toFixed(2),
    count: best.count, date: new Date().toISOString(),
  };
}

// Site-survey calibration: compare predicted RSSI with values measured on site, and fit the
// model (path-loss exponent n + a per-band offset) so the heatmap matches the measurements.
//
// project.survey = [{id, x, y, dbm (measured, null until entered), band: "2.4" | "5"}]
// project.calib  = null | {n, off24, off5, rmsBefore, rmsAfter, count, date}
// Error convention: error = predicted - measured (positive = the model is too optimistic).

const CALIB_N_RANGE = [1.5, 4.5, 0.05];
const CALIB_MAX_OFFSET = 20;           // dB; larger usually means wrong scale, AP position or power
const CALIB_WARN_OFFSET = 10;

// Best-server RSSI at a point, optionally with a different n / offset than the project uses.
function predictBest(project, band, x, y, override = null) {
  const rf = rfContext(project, band);
  if (override) { rf.n = override.n; rf.offset = override.offset; }
  let best = -Infinity;
  for (const ap of project.aps) best = Math.max(best, rssiAt(rf, apEirp(ap, band, rf.cap), ap.x, ap.y, x, y));
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
  return { rows, all: errStats(rows.filter(r => r.err != null).map(r => r.err)), "2.4": by("2.4"), "5": by("5") };
}

/**
 * Least-squares fit. With 3+ points: grid search over n, and for each n the best per-band offset
 * (the mean residual, closed form). With 1-2 points only the offsets are fitted (n stays).
 * Returns the new calib object, or null when there is nothing to fit.
 */
function fitCalibration(project) {
  const pts = validSurvey(project);
  if (!pts.length || !project.aps.length) return null;
  const before = surveyErrors(project).all;
  const envN = (ENVIRONMENTS[project.settings.env] || ENVIRONMENTS[1]).n;

  const evalN = n => {
    const off = {}, resid = [];
    for (const b of ["2.4", "5"]) {
      const bp = pts.filter(p => p.band === b);
      const base = bp.map(p => predictBest(project, b, p.x, p.y, { n, offset: 0 }));
      const ok = bp.map((p, i) => [p.dbm, base[i]]).filter(([, v]) => Number.isFinite(v));
      let o = ok.length ? ok.reduce((a, [m, v]) => a + (m - v), 0) / ok.length : 0;
      o = Math.max(-CALIB_MAX_OFFSET, Math.min(CALIB_MAX_OFFSET, o));
      off[b] = o;
      for (const [m, v] of ok) resid.push(v + o - m);
    }
    const sse = resid.reduce((a, e) => a + e * e, 0);
    return { n, off, sse, count: resid.length };
  };

  let best = null;
  if (pts.length >= 3) {
    const [lo, hi, step] = CALIB_N_RANGE;
    for (let n = lo; n <= hi + 1e-9; n += step) {
      const r = evalN(+n.toFixed(2));
      if (!best || r.sse < best.sse) best = r;
    }
  } else {
    best = evalN(project.calib?.n ?? envN);
  }
  if (!best.count) return null;
  return {
    n: best.n, off24: +best.off["2.4"].toFixed(2), off5: +best.off["5"].toFixed(2),
    rmsBefore: before ? +before.rms.toFixed(2) : null,
    rmsAfter: +Math.sqrt(best.sse / best.count).toFixed(2),
    count: best.count, date: new Date().toISOString(),
  };
}

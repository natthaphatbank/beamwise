// AI design review with Claude (bring-your-own API key, called straight from the browser).
// The key is kept in this browser only and sent only to Anthropic's API.

const AI_MODEL = "claude-opus-5-5";
const ANTHROPIC_SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.6.0/+esm";

let AnthropicSdk = null;
async function loadAnthropicSdk() {
  if (!AnthropicSdk) {
    const mod = await import(ANTHROPIC_SDK_URL);
    AnthropicSdk = mod.default || mod.Anthropic;
  }
  return AnthropicSdk;
}

const AI_SYSTEM = `You are a senior Wi-Fi design engineer reviewing a predictive Wi-Fi plan made in "WiFi Planner TH", a tool used by small installers, IT shops and dorm owners in Thailand.

You receive a rendered image of the floor plan with the coverage heatmap, walls and AP icons, plus a JSON summary. Coordinates are in metres from the top-left corner of the plan (x to the right, y downwards). RSSI values come from a multi-wall log-distance model, so treat them as estimates.

Write a practical design review for the installer:
1. Verdict: one or two sentences: does the design meet the stated requirement, and how confident are you.
2. Problems: the weak areas that matter most, located by coordinates and by what they look like on the plan (for example "the back rooms on the north side"). Mention co-channel interference if APs share channels and hear each other strongly.
3. Recommendations: concrete, ordered by impact: move a named AP to (x, y), add an AP at (x, y), change power, change channels, or pick a different model from the catalogue list provided. Prefer the fewest APs and the lowest cost that meet the requirement; say when a cheaper model would do.
4. Notes: anything to verify on site (wall materials that look uncertain, ceiling height, interference sources) and the Thai NBTC EIRP limits when relevant.

Keep it under about 350 words. Use short Markdown headings and bullet points. Do not restate the JSON. Write the whole review in the language requested by the user.`;

// Compact description of the design for the model.
function buildDesignSummary() {
  const mpp = project.mPerPx, m = v => +(v * mpp).toFixed(1);
  const box = buildingBox(project);
  const band = project.settings.band;
  const env = ENVIRONMENTS[project.settings.env];
  const req = reqDbm();
  const matLen = {};
  for (const w of project.walls) matLen[w.mat] = +((matLen[w.mat] || 0) + Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * mpp).toFixed(1);

  const stats = {};
  for (const b of ["2.4", "5"]) {
    const h = computeHeatmap(project, b, Math.max(2, Math.max(project.plan.width, project.plan.height) / 220));
    const s = coverageStats(h, effMinDbm(), req, box, areaMask(project, h));
    stats[b + "GHz"] = { meets_requirement_pct: Math.round(s.meet * 100), below_display_floor_pct: Math.round(s.none * 100) };
  }
  return {
    coverage_boundary_drawn: projectAreas(project).length > 0,
    building: { width_m: m(box.x1 - box.x0), depth_m: m(box.y1 - box.y0), origin_m: [m(box.x0), m(box.y0)], scale_calibrated: !!(project.scaleSet || !project.plan.image) },
    environment: { type: t(env.key), path_loss_exponent: env.n },
    requirement: { min_rssi_dbm: req, mode: project.settings.req === "auto" ? "auto" : "manual" },
    displayed_band_ghz: band,
    nbtc_cap_enabled: !!project.settings.capNbtc,
    walls_total_length_m_by_material: matLen,
    wall_loss_db_by_material: Object.fromEntries(Object.entries(MATERIALS).map(([k, v]) => [k, { "2.4GHz": v.db24, "5GHz": v.db5 }])),
    access_points: project.aps.map(ap => {
      const spec = AP_BY_ID[ap.model];
      return {
        name: ap.name, x_m: m(ap.x), y_m: m(ap.y),
        model: spec ? `${spec.brand} ${spec.model}` : "custom",
        eirp_dbm: { "2.4GHz": apEirp(ap, "2.4", project.settings.capNbtc), "5GHz": apEirp(ap, "5", project.settings.capNbtc) },
        channel: { "2.4GHz": ap.ch24 || null, "5GHz": ap.ch5 || null },
      };
    }),
    coverage: stats,
    weak_areas_on_displayed_band: heat ? weakRegions(project, heat, req) : [],
    ap_catalogue: AP_MODELS.map(a => `${a.brand} ${a.model} (${a.std})`),
  };
}

// The scene (plan + heatmap + walls + APs) as a PNG, long side <= 1400 px.
function sceneImageBase64() {
  const { width: W, height: H } = project.plan;
  const k = Math.min(1400 / Math.max(W, H), 2);
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * k); cv.height = Math.round(H * k);
  const c = cv.getContext("2d");
  c.fillStyle = "#0b0f1a"; c.fillRect(0, 0, cv.width, cv.height);
  c.scale(k, k);
  drawScene(c, 1 / k, { interactive: false });
  return cv.toDataURL("image/png").split(",")[1];
}

/** Stream a design review. Calls onText(delta) as text arrives; resolves with the final message. */
async function runAiReview(apiKey, onText) {
  const Anthropic = await loadAnthropicSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const langName = (LANGS.find(l => l.code === LANG) || LANGS[1]).name;
  const summary = buildDesignSummary();

  const stream = client.beta.messages.stream({
    model: AI_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: AI_SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: sceneImageBase64() } },
        { type: "text", text: `Language for the review: ${langName} (${LANG}).\n\nDesign summary:\n${JSON.stringify(summary, null, 1)}` },
      ],
    }],
  });
  stream.on("text", delta => onText(delta));
  return await stream.finalMessage();
}

// Map SDK errors to a short, translated message.
function aiErrorMessage(err) {
  const A = AnthropicSdk;
  if (A) {
    if (err instanceof A.AuthenticationError || err instanceof A.PermissionDeniedError) return t("aiErrKey");
    if (err instanceof A.RateLimitError) return t("aiErrRate");
    if (err instanceof A.APIConnectionError) return t("aiErrNet");
    if (err instanceof A.APIError) return `${t("aiErr")} (${err.status ?? ""}) ${err.message || ""}`.trim();
  }
  if (err && /import|fetch|module/i.test(String(err.message))) return t("aiErrNet");
  return `${t("aiErr")}: ${err?.message || err}`;
}

// Minimal, safe Markdown -> HTML for the review (headings, bullets, bold, code).
function renderMarkdown(md) {
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  let html = "", inList = false;
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (li) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    if (inList) { html += "</ul>"; inList = false; }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) html += `<h4>${inline(h[1])}</h4>`;
    else if (line.trim()) html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

// Building templates: a few numbers -> walls (with materials and doors), attenuation zones,
// boundary areas with demand, floors and settings, optionally with APs placed and channels set.
// All sizes in metres; origin = top-left of the building. Loaded before app.js.

// Geometry helpers handed to every template's build().
function tplKit() {
  const walls = [], areas = [], attens = [];
  const w = (x1, y1, x2, y2, mat) => { if (Math.hypot(x2 - x1, y2 - y1) > 0.05) walls.push([x1, y1, x2, y2, mat]); };
  // straight wall with openings: doors = [[from start (m), width, material | null = opening]]
  const wd = (x1, y1, x2, y2, mat, doors = []) => {
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    const P = t => [x1 + ux * t, y1 + uy * t];
    let t = 0;
    for (const [at, width, dm] of doors.slice().sort((a, b) => a[0] - b[0])) {
      const a = Math.max(t, Math.min(L, at)), b = Math.min(L, a + width);
      w(...P(t), ...P(a), mat);
      if (dm) w(...P(a), ...P(b), dm);
      t = b;
    }
    w(...P(t), ...P(L), mat);
  };
  const rect = (x, y, W, H, mat) => { w(x, y, x + W, y, mat); w(x + W, y, x + W, y + H, mat); w(x + W, y + H, x, y + H, mat); w(x, y + H, x, y, mat); };
  const box = (x, y, W, H) => [{ x, y }, { x: x + W, y }, { x: x + W, y: y + H }, { x, y: y + H }];
  const area = (x, y, W, H, props) => areas.push({ pts: box(x, y, W, H), ...props });
  const zone = (x, y, W, H, preset) => attens.push({ pts: box(x, y, W, H), preset });
  return { walls, areas, attens, w, wd, rect, area, zone };
}

const TEMPLATES = {
  dorm: {
    icon: "🏢", env: 2,
    params: { rooms: [8, 2, 30, 1], roomW: [3.5, 2.8, 6, 0.1], roomD: [6, 4, 10, 0.1], corridor: [1.8, 1.2, 4, 0.1], floors: [4, 1, 30, 1], devPer: [3, 1, 10, 1] },
    build(p, k) {
      const n = p.rooms, W = n * p.roomW, rd = p.roomD, cw = p.corridor, H = 2 * rd + cw;
      k.w(0, 0, W, 0, "concrete"); k.w(0, H, W, H, "concrete");
      for (const x of [0, W]) { k.w(x, 0, x, rd, "concrete"); k.w(x, rd, x, rd + cw, "glass"); k.w(x, rd + cw, x, H, "concrete"); }
      for (let i = 0; i < n; i++) {
        const x0 = i * p.roomW, x1 = x0 + p.roomW;
        if (i) { k.w(x0, 0, x0, rd, "brick"); k.w(x0, rd + cw, x0, H, "brick"); }
        for (const y of [rd, rd + cw]) k.wd(x0, y, x1, y, "brick", [[p.roomW - 1.3, 0.9, "wood"]]);
        // bathroom by the entrance
        k.w(x0 + 1.6, rd - 2.2, x0 + 1.6, rd, "aac"); k.w(x0, rd - 2.2, x0 + 1.6, rd - 2.2, "aac");
        k.w(x0 + 1.6, rd + cw, x0 + 1.6, rd + cw + 2.2, "aac"); k.w(x0, rd + cw + 2.2, x0 + 1.6, rd + cw + 2.2, "aac");
      }
      k.area(0, 0, W, H, { name: t("tplAreaRooms"), devices: 2 * n * p.devPer, app: "video" });
      return { W, H };
    },
  },
  condo: {
    icon: "🏙️", env: 2,
    params: { units: [6, 2, 20, 1], unitW: [5, 3.5, 10, 0.1], unitD: [8, 5, 14, 0.1], corridor: [2, 1.4, 4, 0.1], floors: [8, 1, 60, 1], devPer: [5, 1, 15, 1] },
    build(p, k) {
      const n = p.units, uw = p.unitW, ud = p.unitD, cw = p.corridor, W = n * uw, H = 2 * ud + cw;
      k.w(0, 0, W, 0, "glass"); k.w(0, H, W, H, "glass");
      for (const x of [0, W]) { k.w(x, 0, x, ud, "concrete"); k.w(x, ud, x, ud + cw, "concrete"); k.w(x, ud + cw, x, H, "concrete"); }
      for (let i = 0; i < n; i++) {
        const x0 = i * uw, x1 = x0 + uw;
        for (const m of [false, true]) {
          const Y = y => (m ? H - y : y);
          if (i) k.w(x0, Y(0), x0, Y(ud), "concrete");
          k.wd(x0, Y(ud), x1, Y(ud), "brick", [[0.6, 0.9, "wood"]]);
          // bedroom on the facade side, bathroom by the corridor
          k.w(x0 + uw * 0.6, Y(0), x0 + uw * 0.6, Y(ud * 0.45), "brick");
          k.wd(x0, Y(ud * 0.45), x0 + uw * 0.6, Y(ud * 0.45), "brick", [[Math.max(0.3, uw * 0.6 - 1.2), 0.8, "wood"]]);
          k.w(x1 - 2, Y(ud - 2.2), x1 - 2, Y(ud), "aac"); k.w(x1 - 2, Y(ud - 2.2), x1, Y(ud - 2.2), "aac");
        }
      }
      k.area(0, 0, W, H, { name: t("tplAreaUnits"), devices: 2 * n * p.devPer, app: "video" });
      return { W, H };
    },
  },
  hotel: {
    icon: "🏨", env: 2, req: -67,
    params: { rooms: [10, 2, 40, 1], roomW: [4, 3, 7, 0.1], roomD: [8, 5, 12, 0.1], corridor: [2, 1.4, 4, 0.1], floors: [6, 1, 50, 1], devPer: [3, 1, 10, 1] },
    build(p, k) {
      const n = p.rooms, rw = p.roomW, rd = p.roomD, cw = p.corridor, W = n * rw, H = 2 * rd + cw;
      k.rect(0, 0, W, H, "concrete");
      for (let i = 0; i < n; i++) {
        const x0 = i * rw, x1 = x0 + rw;
        if (i) { k.w(x0, 0, x0, rd, "brick"); k.w(x0, rd + cw, x0, H, "brick"); }
        for (const y of [rd, rd + cw]) k.wd(x0, y, x1, y, "brick", [[rw - 1.1, 0.9, "wood"]]);
        k.w(x0 + 2.2, rd - 2.6, x0 + 2.2, rd, "aac"); k.w(x0, rd - 2.6, x0 + 2.2, rd - 2.6, "aac");
        k.w(x0 + 2.2, rd + cw, x0 + 2.2, rd + cw + 2.6, "aac"); k.w(x0, rd + cw + 2.6, x0 + 2.2, rd + cw + 2.6, "aac");
      }
      k.area(0, 0, W, H, { name: t("tplAreaRooms"), devices: 2 * n * p.devPer, app: "video" });
      return { W, H };
    },
  },
  townhouse: {
    icon: "🏘️", env: 2,
    params: { width: [4.5, 3.5, 8, 0.1], depth: [16, 8, 30, 0.1], floors: [3, 1, 5, 1], devices: [8, 1, 40, 1] },
    build(p, k) {
      const W = p.width, D = p.depth, mid = D * 0.55;
      k.w(0, 0, W, 0, "glass"); k.w(0, D, W, D, "brick");
      k.w(0, 0, 0, D, "brick"); k.w(W, 0, W, D, "brick");
      k.wd(0, mid, W, mid, "brick", [[W - 1.2, 0.9, "wood"]]);
      k.w(1.0, mid - 3.5, 1.0, mid, "brick");                          // stair
      k.w(W - 2, D - 2.2, W - 2, D, "aac"); k.wd(W - 2, D - 2.2, W, D - 2.2, "aac", [[0.5, 0.7, "wood"]]);
      k.area(0, 0, W, D, { name: t("tplAreaHome"), devices: p.devices, app: "video" });
      return { W, H: D };
    },
  },
  house: {
    icon: "🏠", env: 2,
    params: { width: [10, 7, 20, 0.1], depth: [12, 7, 20, 0.1], floors: [2, 1, 3, 1], devices: [10, 1, 50, 1] },
    build(p, k) {
      const W = p.width, D = p.depth, h = W / 2;
      k.wd(0, 0, W, 0, "brick", [[1, 2, "glass"], [W - 3, 2, "glass"]]);
      k.w(W, 0, W, D, "brick"); k.w(W, D, 0, D, "brick"); k.w(0, D, 0, 0, "brick");
      k.wd(h, 0, h, D, "brick", [[D * 0.25, 0.9, "wood"], [D * 0.7, 0.9, "wood"]]);
      k.wd(0, D * 0.55, h, D * 0.55, "brick", [[h - 1.6, 1.2, null]]);  // living | kitchen (opening)
      k.wd(h, D * 0.5, W, D * 0.5, "brick", [[0.4, 0.8, "wood"]]);       // bedroom 1 | bedroom 2
      k.w(W - 2.2, D * 0.5, W - 2.2, D * 0.5 + 2.2, "aac"); k.wd(W - 2.2, D * 0.5 + 2.2, W, D * 0.5 + 2.2, "aac", [[0.4, 0.7, "wood"]]);
      k.area(0, 0, W, D, { name: t("tplAreaHome"), devices: p.devices, app: "video" });
      return { W, H: D };
    },
  },
  cafe: {
    icon: "☕", env: 1,
    params: { width: [12, 6, 40, 0.1], depth: [10, 6, 30, 0.1], seats: [40, 5, 300, 1] },
    build(p, k) {
      const W = p.width, D = p.depth, kx = W * 0.6;
      k.w(0, 0, W, 0, "glass"); k.w(W, 0, W, D, "brick"); k.w(W, D, 0, D, "brick"); k.w(0, D, 0, 0, "brick");
      k.wd(0, D - 3.5, kx, D - 3.5, "brick", [[kx - 1.4, 0.9, "wood"]]);       // kitchen / back of house
      k.w(kx, D - 3.5, kx, D, "brick");
      k.w(W - 2.5, D - 3, W - 2.5, D, "aac"); k.wd(W - 2.5, D - 3, W, D - 3, "aac", [[0.4, 0.8, "wood"]]);   // restroom
      k.zone(1, D - 5, kx - 2, 1, "furniture");                                 // counter
      k.area(0, 0, W, D, { name: t("tplAreaShop"), devices: p.seats, app: "web" });
      return { W, H: D };
    },
  },
  minimart: {
    icon: "🛒", env: 1,
    params: { width: [15, 8, 60, 0.1], depth: [12, 8, 40, 0.1], shelves: [5, 1, 20, 1], devices: [15, 2, 200, 1] },
    build(p, k) {
      const W = p.width, D = p.depth;
      k.w(0, 0, W, 0, "glass"); k.w(W, 0, W, D, "brick"); k.w(W, D, 0, D, "brick"); k.w(0, D, 0, 0, "brick");
      k.wd(0, D - 3, W, D - 3, "brick", [[W - 2.2, 1.2, "wood"]]);             // stock room
      const y0 = 3, y1 = D - 4.5, step = (y1 - y0) / Math.max(1, p.shelves);
      for (let i = 0; i < p.shelves; i++) k.zone(2, y0 + i * step + step / 2 - 0.3, W - 4, 0.6, "shelving");
      k.zone(0.8, 0.8, 3, 1, "furniture");                                     // checkout
      k.area(0, 0, W, D, { name: t("tplAreaShop"), devices: p.devices, app: "web" });
      return { W, H: D };
    },
  },
  office: {
    icon: "💼", env: 1,
    params: { width: [30, 12, 100, 0.5], depth: [20, 10, 60, 0.5], staff: [60, 5, 600, 1], meetings: [4, 0, 12, 1], managers: [2, 0, 12, 1] },
    build(p, k) {
      const W = p.width, D = p.depth, rd = 4.5, ry = D - rd;
      k.w(0, 0, W, 0, "glass"); k.w(W, 0, W, D, "concrete"); k.w(W, D, 0, D, "concrete"); k.w(0, D, 0, 0, "concrete");
      let x = 0;
      for (let i = 0; i < p.meetings && x + 5 <= W - 7; i++, x += 5) {
        k.wd(x, ry, x + 5, ry, "glass", [[0.5, 0.9, "glass"]]);
        k.w(x + 5, ry, x + 5, D, "glass");
        k.area(x, ry, 5, rd, { name: `${t("tplAreaMeeting")} ${i + 1}`, devices: 10, app: "call" });
      }
      for (let i = 0; i < p.managers && x + 4 <= W - 7; i++, x += 4) {
        k.wd(x, ry, x + 4, ry, "drywall", [[0.5, 0.9, "wood"]]);
        k.w(x + 4, ry, x + 4, D, "drywall");
      }
      // pantry and server room at the far end
      k.wd(W - 7, ry, W - 3, ry, "drywall", [[0.5, 1.2, null]]); k.w(W - 7, ry, W - 7, D, "drywall"); k.w(W - 3, ry, W - 3, D, "brick");
      k.wd(W - 3, ry, W, ry, "brick", [[1, 0.9, "metal"]]);
      k.zone(1, 1, W - 2, Math.max(1, ry - 2.5), "furniture");
      k.areas.unshift({ pts: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }], name: t("tplAreaOffice"), devices: p.staff * 2, app: "web" });
      return { W, H: D };
    },
  },
  school: {
    icon: "🏫", env: 1,
    params: { classes: [6, 1, 20, 1], classW: [8, 6, 12, 0.1], classD: [9, 6, 12, 0.1], corridor: [3, 2, 5, 0.1], floors: [3, 1, 8, 1], students: [40, 10, 80, 1] },
    build(p, k) {
      const n = p.classes, cw = p.classW, cd = p.classD, W = n * cw, H = cd + p.corridor;
      k.wd(0, 0, W, 0, "brick", Array.from({ length: n }, (_, i) => [i * cw + 1.5, cw - 3, "glass"]));   // windows
      k.w(0, 0, 0, H, "brick"); k.w(W, 0, W, H, "brick");                       // open corridor on the other side
      for (let i = 0; i < n; i++) {
        const x0 = i * cw;
        if (i) k.w(x0, 0, x0, cd, "brick");
        k.wd(x0, cd, x0 + cw, cd, "brick", [[0.6, 0.9, "wood"], [cw - 1.5, 0.9, "wood"]]);
        k.area(x0, 0, cw, cd, { name: `${t("tplAreaClass")} ${i + 1}`, devices: p.students, app: "web" });
      }
      k.areas.unshift({ pts: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }], name: t("tplAreaCorridor"), devices: 0, app: "web" });
      return { W, H };
    },
  },
  warehouse: {
    icon: "🏭", env: 0, req: -72,
    params: { width: [60, 20, 200, 1], depth: [40, 15, 150, 1], racks: [8, 0, 40, 1], devices: [30, 1, 500, 1] },
    build(p, k) {
      const W = p.width, D = p.depth;
      k.wd(0, 0, W, 0, "metal", [[W * 0.5 - 2, 4, null]]);                      // loading door (open)
      k.w(W, 0, W, D, "metal"); k.w(W, D, 0, D, "metal"); k.w(0, D, 0, 0, "metal");
      k.rect(0, 0, 10, 6, "brick");                                             // office
      k.wd(10, 0, 10, 6, "brick", [[2, 0.9, "wood"]]);
      const x0 = 14, x1 = W - 4, gap = (x1 - x0) / Math.max(1, p.racks);
      for (let i = 0; i < p.racks; i++) k.zone(x0 + i * gap + gap / 2 - 0.6, 8, 1.2, Math.max(2, D - 12), "racks");
      k.area(0, 0, W, D, { name: t("tplAreaWarehouse"), devices: p.devices, app: "web" });
      k.area(0, 0, 10, 6, { name: t("tplAreaOffice"), req: -67, devices: 6, app: "call" });
      return { W, H: D };
    },
  },
  hall: {
    icon: "🎤", env: 0, req: -65,
    params: { width: [30, 10, 100, 0.5], depth: [20, 8, 80, 0.5], people: [300, 20, 3000, 10] },
    build(p, k) {
      const W = p.width, D = p.depth;
      k.rect(0, 0, W, D, "concrete");
      k.wd(0, 4, W, 4, "drywall", [[1, W - 2, null]]);                          // stage edge (open)
      k.zone(1, 5, W - 2, D - 6, "crowd");
      k.area(0, 0, W, D, { name: t("tplAreaHall"), devices: p.people, app: "web" });
      return { W, H: D };
    },
  },
};
const TEMPLATE_KEYS = Object.keys(TEMPLATES);

// ---------- dialog ----------
let tplState = { key: "dorm", vals: {} };
function tplValues(key) {
  const T = TEMPLATES[key], v = {};
  for (const [p, [def]] of Object.entries(T.params)) v[p] = tplState.vals[key]?.[p] ?? def;
  return v;
}

function openTemplates() {
  const key = tplState.key, T = TEMPLATES[key], v = tplValues(key);
  openModal(`<h2>${t("tplTitle")}</h2>
    <p class="unit">${t("tplHelp")}</p>
    <div class="tpl-wrap">
      <div class="tpl-list">${TEMPLATE_KEYS.map(k => `<button class="tpl-card ${k === key ? "active" : ""}" data-tpl="${k}"><span class="tpl-ic">${TEMPLATES[k].icon}</span>
        <span><b>${t("tpl_" + k)}</b><small>${t("tplD_" + k)}</small></span></button>`).join("")}</div>
      <div class="tpl-form">
        <h3 class="modal-sub">${TEMPLATES[key].icon} ${t("tpl_" + key)}</h3>
        <div class="model-form">${Object.entries(T.params).map(([p, [, lo, hi, st]]) =>
          `<label class="field"><span>${t("tp_" + p)}</span><input type="number" data-p="${p}" min="${lo}" max="${hi}" step="${st}" value="${v[p]}"></label>`).join("")}</div>
        <canvas id="tplPrev" width="560" height="300" class="tpl-prev"></canvas>
        <p class="unit" id="tplInfo"></p>
        <label class="check"><input type="checkbox" id="tplAuto" checked> ${t("tplAuto")}</label>
        <label class="row"><span>${t("tplLayout")}</span><select id="tplLayout"><option value="same">${t("tplLayoutSame")}</option><option value="each">${t("tplLayoutEach")}</option></select></label>
        <label class="row"><span>${t("aiModelUsed")}</span><select id="tplModel">${modelOptions(project.newApModel || "generic-ax", false)}</select></label>
        <p class="unit">${t("tplNote")}</p>
      </div>
    </div>
    <div class="progress" id="tplProg" hidden><div></div></div>
    <div class="btns inline"><button data-act="cancel">${t("cancel")}</button><button class="primary" data-act="go">${t("tplCreate")}</button></div>`, null, "xwide");
  const box = $("#modalBox");
  setTimeout(() => box.querySelector("[data-act=go]")?.focus(), 0);
  box.querySelectorAll("[data-tpl]").forEach(b => b.onclick = () => { tplState.key = b.dataset.tpl; openTemplates(); });
  const read = () => {
    const vals = {};
    box.querySelectorAll("[data-p]").forEach(i => {
      const [def, lo, hi] = T.params[i.dataset.p];
      const x = parseFloat(i.value);
      vals[i.dataset.p] = Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : def;
    });
    tplState.vals[key] = vals;
    return vals;
  };
  const preview = () => {
    const vals = read(), k = tplKit(), g = T.build(vals, k);
    drawTplPreview($("#tplPrev"), g, k);
    const devs = k.areas.reduce((s, a) => s + (+a.devices || 0), 0);
    $("#tplInfo").textContent = tf("tplInfo", { w: g.W.toFixed(1), d: g.H.toFixed(1), a: Math.round(g.W * g.H), f: vals.floors || 1, n: devs * (vals.floors || 1) });
  };
  box.querySelectorAll("[data-p]").forEach(i => i.addEventListener("input", preview));
  preview();
  box.querySelector("[data-act=cancel]").onclick = closeModal;
  box.querySelector("[data-act=go]").onclick = () => {
    const vals = read(), auto = $("#tplAuto").checked, model = $("#tplModel").value, layout = $("#tplLayout").value;
    // replacing unsaved work asks first (Save first / Don't save / Cancel), then builds with a progress bar
    const go = () => {
      openModal(`<h2>${TEMPLATES[key].icon} ${t("tpl_" + key)}</h2><p>${t(auto ? "tplBuildingAps" : "tplBuilding")}</p><div class="progress" id="tplProg"><div></div></div>`);
      applyTemplate(key, vals, { auto, model, layout }, p => { const b = $("#tplProg"); if (b) b.firstElementChild.style.width = Math.round(p * 100) + "%"; })
        .catch(e => { console.error(e); flash(t("pdfFailed")); }).finally(() => closeModal());
    };
    closeModal();
    guardUnsaved(go);
  };
}

function drawTplPreview(cv, g, k) {
  const c = cv.getContext("2d"), pad = 12;
  const s = Math.min((cv.width - pad * 2) / g.W, (cv.height - pad * 2) / g.H);
  const ox = (cv.width - g.W * s) / 2, oy = (cv.height - g.H * s) / 2;
  const css = getComputedStyle(document.documentElement);
  c.clearRect(0, 0, cv.width, cv.height);
  c.fillStyle = css.getPropertyValue("--panel-2"); c.fillRect(0, 0, cv.width, cv.height);
  for (const z of k.attens) {
    c.fillStyle = (ATTEN_PRESETS[z.preset] || ATTEN_PRESETS.custom).color + "55";
    const p = z.pts; c.fillRect(ox + p[0].x * s, oy + p[0].y * s, (p[1].x - p[0].x) * s, (p[2].y - p[1].y) * s);
  }
  c.setLineDash([5, 4]); c.strokeStyle = css.getPropertyValue("--accent"); c.lineWidth = 1;
  for (const a of k.areas.slice(1)) { const p = a.pts; c.strokeRect(ox + p[0].x * s, oy + p[0].y * s, (p[1].x - p[0].x) * s, (p[2].y - p[1].y) * s); }
  c.setLineDash([]); c.lineCap = "round"; c.lineWidth = 2.5;
  for (const [x1, y1, x2, y2, m] of k.walls) {
    c.strokeStyle = (MATERIALS[m] || MATERIALS.brick).color;
    c.beginPath(); c.moveTo(ox + x1 * s, oy + y1 * s); c.lineTo(ox + x2 * s, oy + y2 * s); c.stroke();
  }
}

// layout "same": APs designed on the lowest floor and copied to every floor (same spots, easy
// cabling); "each": every floor placed on its own, counting signal from the floors around it.
async function applyTemplate(key, vals, { auto, model, layout = "same" }, onProgress = () => {}) {
  const T = TEMPLATES[key], k = tplKit(), g = T.build(vals, k);
  const margin = 1, Wm = g.W + 2 * margin, Hm = g.H + 2 * margin;
  const ppm = Math.min(40, 3000 / Math.max(Wm, Hm));
  // fresh project, like New
  project = newProject(); planImg = null; selection = null; areaDraft = null; clearProbes(); undoStack = []; redoStack = [];
  floorImgs.clear();
  project.plan = { image: null, width: Math.round(Wm * ppm), height: Math.round(Hm * ppm) };
  project.mPerPx = 1 / ppm; project.scaleSet = true;
  const P = m => (m + margin) * ppm;
  project.walls = k.walls.map(([x1, y1, x2, y2, mat]) => ({ id: uid(), x1: P(x1), y1: P(y1), x2: P(x2), y2: P(y2), mat }));
  project.areas = k.areas.map(a => ({ id: uid(), pts: a.pts.map(q => ({ x: P(q.x), y: P(q.y) })), name: a.name || "", req: a.req ?? "auto",
                                     devices: Math.round(a.devices || 0), app: a.app || "web", mbps: 2 }));
  project.attens = k.attens.map(z => { const pr = ATTEN_PRESETS[z.preset]; return { id: uid(), pts: z.pts.map(q => ({ x: P(q.x), y: P(q.y) })), preset: z.preset, db24: pr.db24, db5: pr.db5, db6: pr.db6 }; });
  project.settings.env = T.env;
  project.settings.req = T.req ?? "auto";
  project.newApModel = AP_BY_ID[model] ? model : "generic-ax";
  project.report = { title: `${t("tpl_" + key)} · ${t("tplReportSuffix")}`, customer: "", author: "", notes: "" };
  syncActive();
  const nf = Math.max(1, Math.round(vals.floors || 1));
  for (let i = 1; i < nf; i++) addFloor(true);
  if (nf > 1) switchFloor(0);
  renderFloorBar(); View3D.reset(); renderSettings(); setTool("select"); fit(); changed();
  if (auto) {
    const each = layout === "each" && nf > 1, rounds = each ? nf : 1;
    for (let i = 0; i < rounds; i++) {
      if (i !== project.floorIdx) switchFloor(i);
      const res = await autoPlace(project, { band: project.settings.band, req: reqDbm(), reqAt: areaReqAt, target: 0.95,
        maxAps: 40, keep: false, modelId: project.newApModel }, p => onProgress((i + p) / rounds));
      for (const q of res.aps) project.aps.push(makeAp(q));
      await addApsForCapacity(project, project.settings.band, 30, makeAp);      // then enough APs for the devices
      project.aps.forEach((a, j) => { a.name = nf > 1 ? `AP-${i + 1}${String(j + 1).padStart(2, "0")}` : `AP-${j + 1}`; });
      changed();
    }
    if (!each && nf > 1) { switchFloor(0); copyApsToFloors(0); }
    else assignChannelsAllFloors();
    switchFloor(0);
    changed();
  }
  const nAp = project.floors.reduce((s, f) => s + (f.aps || []).length, 0);
  flash(tf("tplDone", { t: t("tpl_" + key), f: nf, n: nAp }));
}

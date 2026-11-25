// Beamwise — 3D view: the drawn walls extruded to height, the floor plan + heatmap on the floor,
// APs at their mounting height. three.js (MIT, vendored in js/vendor/three) is loaded only when
// the view is first opened. Reads app.js globals (project, heat, heatCanvas, planImg, uiTheme, …).

const View3D = (() => {
  let THREE = null, loading = null;
  let renderer, scene, camera, root, el, host;
  let open = false, built = false, framed = "";        // framed: plan size (m) the camera was fitted to
  let wallH = 3.0, seeThrough = false;
  // orbit camera: target point, distance, yaw (around up) and pitch (above the floor)
  const cam = { tx: 0, ty: 0, tz: 0, dist: 30, yaw: -0.6, pitch: 0.85 };

  function loadThree() {
    if (THREE) return Promise.resolve(THREE);
    if (!loading) loading = import("./vendor/three/three.module.min.js").then(m => (THREE = m));
    return loading;
  }

  // ---------- UI ----------
  function ensureDom() {
    if (el) return;
    el = document.createElement("div");
    el.className = "view3d"; el.id = "view3d"; el.hidden = true;
    el.innerHTML = `
      <div class="v3-host"></div>
      <div class="v3-bar">
        <button class="v3-back" data-act="close"></button>
        <label class="v3-h"><span data-l="wallHeight3d"></span>
          <input type="range" min="1" max="6" step="0.1" data-act="height"><output></output></label>
        <label class="v3-chk"><input type="checkbox" data-act="see"><span data-l="seeThrough3d"></span></label>
        <button data-act="reset" data-l="resetView3d"></button>
        <button data-act="png" data-l="save3dPng"></button>
      </div>
      <div class="v3-help" data-l="help3d"></div>`;
    $("#stage").appendChild(el);
    host = el.querySelector(".v3-host");
    el.querySelector('[data-act=close]').onclick = close;
    const h = el.querySelector('[data-act=height]');
    h.oninput = () => { wallH = +h.value; el.querySelector(".v3-h output").textContent = wallH.toFixed(1) + " m"; rebuild(); };
    el.querySelector('[data-act=see]').onchange = e => { seeThrough = e.target.checked; rebuild(); };
    el.querySelector('[data-act=reset]').onclick = () => { frame(); render(); };
    el.querySelector('[data-act=png]').onclick = savePng;
    wireControls();
    new ResizeObserver(() => { if (open && renderer) { sizeRenderer(); render(); } }).observe(host);
  }
  function applyText() {
    if (!el) return;
    el.querySelectorAll("[data-l]").forEach(n => { n.textContent = t(n.dataset.l); });
    el.querySelector(".v3-back").textContent = "← " + t("back2d");
    el.querySelector('[data-act=height]').value = wallH;
    el.querySelector(".v3-h output").textContent = wallH.toFixed(1) + " m";
    el.querySelector('[data-act=see]').checked = seeThrough;
  }

  // ---------- open / close ----------
  async function show() {
    ensureDom();
    const key = sizeKey();
    if (framed !== key) {                         // new plan / scale: walls a bit above the highest AP
      const top = Math.max(0, ...project.aps.map(a => +a.h || 0));
      wallH = Math.min(6, Math.max(3.0, Math.ceil((top + 0.3) * 10) / 10));
    }
    applyText();
    open = true; el.hidden = false;
    $("#btnView3d")?.classList.add("active");
    try {
      await loadThree();
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(renderer.domElement);
        initScene();
      }
    } catch (e) {
      console.error(e);
      close();
      flash(t("view3dFail"));
      return;
    }
    if (!open) return;
    sizeRenderer();
    rebuild();
    if (framed !== key) { frame(); framed = key; }
    render();
  }
  function initScene() {
    if (scene) return;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-0.6, 1, 0.45);
    scene.add(sun);
  }

  // Off-screen picture of the current floor (plan, heatmap, walls, APs, other floors) for
  // reports and exports, from the default viewpoint and in the light theme. Returns a PNG
  // data URL, or null when 3D (WebGL) is not available.
  let snapR = null;
  async function snapshot(w = 1600, h = 1000) {
    try { await loadThree(); } catch (e) { return null; }
    try {
      if (!snapR) {
        snapR = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        snapR.outputColorSpace = THREE.SRGBColorSpace;
        snapR.setPixelRatio(2);                    // rendered at twice the size: sharp edges and labels
      }
    } catch (e) { return null; }
    initScene();
    snapR.setSize(w, h, false);
    const keep = { renderer, open, built, cam: { ...cam }, wallH, aspect: camera.aspect, theme: uiTheme, see: seeThrough };
    const top = Math.max(0, ...project.aps.map(a => +a.h || 0));
    try {
      renderer = snapR; open = true; uiTheme = "light"; seeThrough = false;
      wallH = Math.min(6, Math.max(3.0, Math.ceil((top + 0.3) * 10) / 10));
      camera.aspect = w / h; camera.updateProjectionMatrix();
      rebuild();
      cam.yaw = -0.62; cam.pitch = 0.78;           // a bit lower than the on-screen default: walls read better
      fitToContent(0.94);
      render();
      // downscale the 2x render: smooth edges at a normal file size
      const out = document.createElement("canvas");
      out.width = w; out.height = h;
      const c = out.getContext("2d");
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
      c.drawImage(snapR.domElement, 0, 0, w, h);
      return out.toDataURL("image/png");
    } catch (e) {
      console.error(e); return null;
    } finally {
      renderer = keep.renderer; open = keep.open; uiTheme = keep.theme; seeThrough = keep.see;
      Object.assign(cam, keep.cam); wallH = keep.wallH;
      if (camera) { camera.aspect = keep.aspect; camera.updateProjectionMatrix(); }
      if (open && renderer) { rebuild(); } else { built = keep.built; }
    }
  }

  function close() {
    open = false;
    if (el) el.hidden = true;
    $("#btnView3d")?.classList.remove("active");
    requestRender();
  }
  const toggle = () => (open ? close() : show());

  function sizeRenderer() {
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }

  // ---------- scene ----------
  const sizeKey = () => { const { w, d } = planSizeM(); return w.toFixed(2) + "x" + d.toFixed(2); };
  const planSizeM = () => ({ w: project.plan.width * project.mPerPx, d: project.plan.height * project.mPerPx });
  // world px -> scene metres, plan centred on the origin, plan y -> scene +z
  function toScene(x, y) {
    const k = project.mPerPx, { w, d } = planSizeM();
    return [x * k - w / 2, y * k - d / 2];
  }

  // The floor: plan image (or blank grid), heatmap clipped to the boundaries, boundary outlines.
  function floorTexture() {
    const { width: W, height: H } = project.plan;
    const s = Math.min(2048 / Math.max(W, H), 4);   // up to 2048 px on the long side
    const m = 1 / project.mPerPx;                     // world px per metre
    const cv = document.createElement("canvas");
    cv.width = Math.max(2, Math.round(W * s)); cv.height = Math.max(2, Math.round(H * s));
    const c = cv.getContext("2d");
    const th = CANVAS_THEMES[uiTheme] || CANVAS_THEMES.light;
    c.scale(s, s);
    const px = 1 / s;
    if (planImg) c.drawImage(planImg, 0, 0, W, H);
    else {
      c.fillStyle = th.plan; c.fillRect(0, 0, W, H);
      c.strokeStyle = th.grid; c.lineWidth = 1.5 * px; c.beginPath();
      for (let x = 0; x <= W; x += m) { c.moveTo(x, 0); c.lineTo(x, H); }
      for (let y = 0; y <= H; y += m) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke();
    }
    if (heatCanvas && heat) {
      c.save();
      if (clipToAreas(c)) c.clip();
      c.globalAlpha = Math.min(0.9, project.settings.opacity + 0.1);
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
      c.drawImage(heatCanvas, 0, 0, heat.cols * heat.cell, heat.rows * heat.cell);
      c.restore();
    }
    for (const a of projectAreas(project)) {
      c.beginPath();
      a.pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
      c.closePath();
      c.strokeStyle = th.area; c.lineWidth = Math.max(2 * px, 0.07 * m);
      c.setLineDash([0.4 * m, 0.25 * m]); c.stroke(); c.setLineDash([]);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  function labelSprite(text, sub) {
    const th = CANVAS_THEMES[uiTheme] || CANVAS_THEMES.light;
    const fs = 44, pad = 18;
    const cv = document.createElement("canvas"), c = cv.getContext("2d");
    const font = w => `${w} ${fs}px ${getComputedStyle(document.documentElement).fontFamily}`;
    c.font = font(600);
    const w1 = c.measureText(text).width;
    c.font = font(400);
    const w2 = sub ? c.measureText(sub).width * 0.8 : 0;
    cv.width = Math.ceil(Math.max(w1, w2) + pad * 2);
    cv.height = Math.ceil(fs * (sub ? 2.3 : 1.4) + pad);
    c.fillStyle = th.tagBg; c.strokeStyle = th.tagLine; c.lineWidth = 3;
    roundRect(c, 1.5, 1.5, cv.width - 3, cv.height - 3, 14); c.fill(); c.stroke();
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = th.text; c.font = font(600);
    c.fillText(text, cv.width / 2, sub ? pad / 2 + fs * 0.75 : cv.height / 2);
    if (sub) { c.fillStyle = th.tagMuted; c.font = `400 ${fs * 0.8}px ${getComputedStyle(document.documentElement).fontFamily}`; c.fillText(sub, cv.width / 2, pad / 2 + fs * 1.75); }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.renderOrder = 10;
    sp.userData.aspect = cv.width / cv.height;
    return sp;
  }

  function disposeTree(o) {
    o.traverse(n => {
      n.geometry?.dispose();
      for (const m of [].concat(n.material || [])) { m.map?.dispose(); m.dispose(); }
    });
  }

  function rebuild() {
    if (!open || !renderer) return;
    if (root) { scene.remove(root); disposeTree(root); }
    root = new THREE.Group();
    scene.add(root);
    const th = CANVAS_THEMES[uiTheme] || CANVAS_THEMES.light;
    scene.background = new THREE.Color(th.stage);
    const { w, d } = planSizeM();

    // floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    root.add(floor);

    // walls: a box per segment, extended by half a thickness at each end so corners close
    const thick = Math.max(0.08, Math.min(0.25, Math.max(w, d) / 250));
    const edgeColor = new THREE.Color(uiTheme === "dark" ? 0x0b0f15 : 0x3a4556);
    for (const wl of project.walls) {
      const [x1, z1] = toScene(wl.x1, wl.y1), [x2, z2] = toScene(wl.x2, wl.y2);
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 1e-3) continue;
      const m = MATERIALS[wl.mat] || MATERIALS.brick;
      const isGlass = wl.mat === "glass" || wl.mat === "lowe";
      const tk = wl.mat === "concreteHeavy" ? thick * 1.4 : thick;
      const geo = new THREE.BoxGeometry(len + tk, wallH, tk);
      const op = isGlass ? 0.35 : seeThrough ? 0.4 : 1;
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(m.color), roughness: isGlass ? 0.1 : 0.85,
        metalness: wl.mat === "metal" ? 0.4 : 0, transparent: op < 1, opacity: op, depthWrite: op === 1 });
      const box = new THREE.Mesh(geo, mat);
      box.position.set((x1 + x2) / 2, wallH / 2, (z1 + z2) / 2);
      box.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      box.renderOrder = op < 1 ? 2 : 0;
      root.add(box);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: op < 1 ? 0.35 : 0.5 }));
      edges.position.copy(box.position); edges.rotation.copy(box.rotation);
      root.add(edges);
    }

    // other floors: wall outlines at their real level (this floor is at 0), APs as small dots
    const F = project.floors || [];
    if (F.length > 1) {
      const el = floorElevations(F), me = project.floorIdx, mpp = project.mPerPx;
      const ox = +F[me].ox || 0, oy = +F[me].oy || 0;
      const ghost = new THREE.LineBasicMaterial({ color: new THREE.Color(th.text), transparent: true, opacity: 0.22 });
      F.forEach((f, j) => {
        if (j === me) return;
        const dz = el[j] - el[me], fm = +f.mPerPx || mpp;
        const conv = (x, y) => toScene((x * fm + (+f.ox || 0) - ox) / mpp, (y * fm + (+f.oy || 0) - oy) / mpp);
        const pts = [];
        for (const wl of f.walls || []) {
          const [x1, z1] = conv(wl.x1, wl.y1), [x2, z2] = conv(wl.x2, wl.y2);
          for (const y of [dz, dz + Math.min(wallH, Math.max(2, +f.height || 3))]) pts.push(new THREE.Vector3(x1, y, z1), new THREE.Vector3(x2, y, z2));
        }
        if (pts.length) root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), ghost));
        for (const ap of f.aps || []) {
          const [x, z] = conv(ap.x, ap.y);
          const s = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.15, Math.max(w, d) / 120), 12, 8),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(th.apTop), transparent: true, opacity: 0.5 }));
          s.position.set(x, dz + (Number.isFinite(+ap.h) ? +ap.h : 2.7), z);
          root.add(s);
        }
      });
    }

    // access points: a puck at mounting height, a drop line to the floor and a name tag
    const band = project.settings.band;
    const apColor = new THREE.Color(th.apTop);
    for (const ap of project.aps) {
      const [x, z] = toScene(ap.x, ap.y);
      const h = Number.isFinite(+ap.h) ? +ap.h : 2.7;
      const r = Math.max(0.25, Math.max(w, d) / 70);     // drawn larger than life so it reads at a distance
      const puck = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, r * 0.35, 32),
        new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.4 }));
      puck.position.set(x, h, z);
      root.add(puck);
      const led = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, r * 0.37, 24),
        new THREE.MeshBasicMaterial({ color: apColor }));
      led.position.set(x, h, z);
      root.add(led);
      if (ap.mount === "directional") {             // aim arrow along the azimuth
        const a = (ap.az || 0) * Math.PI / 180;
        const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));   // same angle as the 2D wedge (plan y = scene z)
        root.add(new THREE.ArrowHelper(dir, new THREE.Vector3(x, h, z), r * 6, apColor.getHex(), r * 2, r * 1.2));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.01, z), new THREE.Vector3(x, h, z)]),
        new THREE.LineDashedMaterial({ color: apColor, dashSize: 0.15, gapSize: 0.1 }));
      line.computeLineDistances();
      root.add(line);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(r * 0.8, 32), new THREE.MeshBasicMaterial({ color: apColor }));
      dot.rotation.x = -Math.PI / 2; dot.position.set(x, 0.02, z);
      root.add(dot);
      const ch = apCh(ap, band);
      const tag = labelSprite(ap.name || "AP", `${h.toFixed(1)} m` + (ch ? ` · ch ${ch}` : ""));
      tag.userData.anchor = new THREE.Vector3(x, h + r * 1.2, z);
      tag.position.copy(tag.userData.anchor);
      root.add(tag);
    }
    built = true;
    render();
  }

  // ---------- camera ----------
  // What is worth looking at: walls, boundaries and APs of this floor (and the outlines of the
  // other floors), else the whole plan. Scene metres: x, y (up), z.
  function contentBox() {
    const b = { x0: Infinity, x1: -Infinity, y0: 0, y1: wallH, z0: Infinity, z1: -Infinity };
    const add = (x, z) => { b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z); };
    for (const w of project.walls) { add(...toScene(w.x1, w.y1)); add(...toScene(w.x2, w.y2)); }
    for (const a of projectAreas(project)) for (const q of a.pts) add(...toScene(q.x, q.y));
    for (const ap of project.aps) { add(...toScene(ap.x, ap.y)); b.y1 = Math.max(b.y1, (+ap.h || 2.7) + 0.6); }
    const F = project.floors || [];
    if (F.length > 1 && project.walls.length) {
      const el = floorElevations(F), me = project.floorIdx;
      F.forEach((f, j) => { if (j !== me && (f.walls || []).length) { b.y0 = Math.min(b.y0, el[j] - el[me]); b.y1 = Math.max(b.y1, el[j] - el[me] + Math.max(2, +f.height || 3)); } });
    }
    if (!Number.isFinite(b.x0) || b.x1 - b.x0 < 1 || b.z1 - b.z0 < 1) {
      const { w, d } = planSizeM();
      Object.assign(b, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 });
    }
    return b;
  }
  function placeCamera() {
    const cp = Math.cos(cam.pitch);
    camera.position.set(cam.tx + cam.dist * cp * Math.sin(cam.yaw), cam.ty + cam.dist * Math.sin(cam.pitch), cam.tz + cam.dist * cp * Math.cos(cam.yaw));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.near = Math.max(0.05, cam.dist / 500); camera.far = cam.dist * 20 + 500;
    camera.updateProjectionMatrix();
  }
  // Move and zoom so the content box fills `fill` of the picture (both ways), centred.
  function fitToContent(fill = 0.9) {
    const b = contentBox();
    cam.tx = (b.x0 + b.x1) / 2; cam.tz = (b.z0 + b.z1) / 2; cam.ty = (b.y0 + b.y1) / 2 * 0.5;
    cam.dist = Math.max(4, Math.hypot(b.x1 - b.x0, b.z1 - b.z0, b.y1 - b.y0));
    const corners = [];
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) corners.push(new THREE.Vector3(x, y, z));
    const v = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
    for (let it = 0; it < 30; it++) {
      placeCamera();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) { v.copy(c).project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      // recentre: shift the target along the camera's right / up axes by the picture offset
      const halfH = cam.dist * Math.tan(camera.fov * Math.PI / 360), halfW = halfH * camera.aspect;
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      cam.tx += right.x * mx * halfW * 0.8 + up.x * my * halfH * 0.8;
      cam.ty += right.y * mx * halfW * 0.8 + up.y * my * halfH * 0.8;
      cam.tz += right.z * mx * halfW * 0.8 + up.z * my * halfH * 0.8;
      const span = Math.max((x1 - x0) / 2, (y1 - y0) / 2) / fill;   // 1 = exactly the picture
      cam.dist *= Math.max(0.5, Math.min(2, Math.pow(span, 0.8)));
      if (Math.abs(span - 1) < 0.01 && Math.abs(mx) < 0.01 && Math.abs(my) < 0.01) break;
    }
  }
  function frame() {
    cam.yaw = -0.6; cam.pitch = 0.85;
    if (THREE && camera) fitToContent(0.86);
    else {
      const { w, d } = planSizeM();
      cam.tx = 0; cam.ty = 0; cam.tz = 0;
      cam.dist = Math.max(w, d, 4) * 1.05 / Math.tan(camera.fov * Math.PI / 360) / Math.max(1, Math.min(camera.aspect, 1.6)) * 0.95;
    }
  }
  function render() {
    if (!open || !renderer || !built) return;
    placeCamera();
    // name tags: constant size on screen
    const hpx = renderer.domElement.clientHeight || renderer.domElement.height / renderer.getPixelRatio() || 600;
    const v = new THREE.Vector3();
    root?.children.forEach(o => {
      if (!o.isSprite) return;
      const dist = v.copy(o.position).distanceTo(camera.position);
      const worldPerPx = 2 * dist * Math.tan(camera.fov * Math.PI / 360) / hpx;
      const hh = 34 * worldPerPx;
      o.scale.set(hh * o.userData.aspect, hh, 1);
      o.position.copy(o.userData.anchor).add(new THREE.Vector3(0, hh * 0.75, 0));
    });
    renderer.render(scene, camera);
  }
  let raf = 0;
  const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  // pointer: left drag = orbit, right / middle / Shift+drag = pan, wheel = zoom, two fingers = pinch + pan
  function wireControls() {
    const pts = new Map();
    let last = null, mode = null, pinch = null;
    host.addEventListener("contextmenu", e => e.preventDefault());
    host.addEventListener("pointerdown", e => {
      host.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: cam.dist };
        mode = "pinch";
      } else {
        mode = e.button === 2 || e.button === 1 || e.shiftKey ? "pan" : "orbit";
        last = { x: e.clientX, y: e.clientY };
      }
    });
    host.addEventListener("pointermove", e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === "pinch" && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const dd = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        cam.dist = clampDist(pinch.dist * pinch.d / Math.max(dd, 1));
        pan(cx - pinch.cx, cy - pinch.cy);
        pinch.cx = cx; pinch.cy = cy;
        queue(); return;
      }
      if (!last) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      if (mode === "orbit") {
        cam.yaw -= dx * 0.008;
        cam.pitch = Math.min(1.55, Math.max(0.08, cam.pitch + dy * 0.006));
      } else pan(dx, dy);
      queue();
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const p = [...pts.values()][0]; last = { x: p.x, y: p.y }; mode = "orbit"; }
      if (!pts.size) { last = null; mode = null; }
    };
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    host.addEventListener("wheel", e => {
      e.preventDefault();
      cam.dist = clampDist(cam.dist * Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
      queue();
    }, { passive: false });
  }
  function clampDist(dd) {
    const { w, d } = planSizeM();
    return Math.min(Math.max(w, d) * 6 + 20, Math.max(1, dd));
  }
  // move the target in the floor plane, so the point under the pointer follows the drag
  function pan(dx, dy) {
    const hpx = renderer.domElement.clientHeight || 600;
    const k = 2 * cam.dist * Math.tan(camera.fov * Math.PI / 360) / hpx;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    const fwd = 1 / Math.max(0.25, Math.sin(cam.pitch));  // screen-vertical drag covers more floor at low angles
    cam.tx += (-dx * cy - dy * sy * fwd) * k;
    cam.tz += (dx * sy - dy * cy * fwd) * k;
    const { w, d } = planSizeM();
    cam.tx = Math.max(-w, Math.min(w, cam.tx)); cam.tz = Math.max(-d, Math.min(d, cam.tz));
  }

  function savePng() {
    if (!renderer) return;
    render();
    renderer.domElement.toBlob(b => { if (b) download(b, `beamwise-3d-${stamp()}.png`); }, "image/png");
  }

  return {
    toggle, close, snapshot,
    isOpen: () => open,
    // the project, heatmap, theme or language changed: rebuild while visible
    refresh() { if (open && renderer) { applyText(); rebuild(); } },
    // new project / file: frame it again on the next open
    reset() { framed = ""; if (open) show(); },
  };
})();

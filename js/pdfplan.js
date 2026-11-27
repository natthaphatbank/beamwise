// PDF floor plans: render one page of a PDF to an image with pdf.js (vendored in js/vendor/pdfjs,
// loaded only when a PDF is opened, works offline). The image then goes through the normal
// floor-plan path (loadPlanFile), so scale, walls and saving work the same as for PNG/JPG.

const PDFJS_DIR = "js/vendor/pdfjs/";
const PDF_RENDER_LONG_SIDE = 4000;     // px; loadPlanFile downsizes to its own limit afterwards

const isPdfFile = f => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));

let pdfjsReady = null;
function loadPdfJs() {
  if (!pdfjsReady) pdfjsReady = new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const s = document.createElement("script");
    s.src = PDFJS_DIR + "pdf.min.js";
    s.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) { reject(new Error("pdf.js did not load")); return; }
      lib.GlobalWorkerOptions.workerSrc = PDFJS_DIR + "pdf.worker.min.js";
      resolve(lib);
    };
    s.onerror = () => { pdfjsReady = null; reject(new Error("pdf.js did not load")); };
    document.head.appendChild(s);
  });
  return pdfjsReady;
}

// Ask which page to use when the PDF has more than one.
function askPdfPage(count) {
  return new Promise(resolve => {
    openModal(`<h2>${t("pdfPageTitle")}</h2>
      <p>${tf("pdfPageBody", { n: count })}</p>
      <label class="field"><span>${t("pdfPageLbl")}</span>
        <input type="number" id="pdfPageInput" min="1" max="${count}" step="1" value="1"></label>
      <div class="btns inline"><button data-act="cancel">${t("cancel")}</button><button class="primary" data-act="ok">${t("pdfUsePage")}</button></div>`,
      () => resolve(null));
    const box = $("#modalBox"), inp = $("#pdfPageInput");
    const ok = () => {
      const n = Math.round(+inp.value);
      if (!(n >= 1 && n <= count)) { inp.focus(); return; }
      modalOnClose = null; closeModal(); resolve(n);
    };
    box.querySelector('[data-act="cancel"]').onclick = closeModal;
    box.querySelector('[data-act="ok"]').onclick = ok;
    inp.addEventListener("keydown", e => { if (e.key === "Enter") ok(); });
    setTimeout(() => { inp.focus(); inp.select(); }, 0);
  });
}

async function loadPdfPlan(file) {
  flash(t("pdfLoading"));
  try {
    const lib = await loadPdfJs();
    // isEvalSupported: false closes CVE-2024-4367 (a crafted PDF font could run code in this page).
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const pageNo = doc.numPages > 1 ? await askPdfPage(doc.numPages) : 1;
    if (!pageNo) { flash(""); return; }
    const page = await doc.getPage(pageNo);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(8, PDF_RENDER_LONG_SIDE / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const cv = document.createElement("canvas");
    cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const c = cv.getContext("2d");
    c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height);      // PDF pages are transparent
    await page.render({ canvasContext: c, viewport: vp }).promise;
    doc.destroy();
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    if (!blob) throw new Error("render failed");
    loadPlanFile(blob);
  } catch (err) {
    console.warn(err);
    flash(err && err.name === "PasswordException" ? t("pdfPassword") : t("pdfError"));
  }
}

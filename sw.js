// Offline support: network first, so every visit gets the latest deploy right away;
// the cache is only the fallback when offline (or the network is too slow).
// VERSION only names the cache; bumping it is not needed to ship an update.
const VERSION = "wpth-v20";
const ASSETS = [
  "./", "index.html", "css/style.css", "css/pro.css",
  "js/i18n.js", "js/i18n-pro.js", "js/i18n-pro2.js", "js/i18n-pro-zh.js", "js/i18n-pro-ja.js", "js/i18n-pro-ko.js", "js/i18n-pro-vi.js", "js/i18n-pro-lo.js", "js/i18n-pro-my.js", "js/catalog.js", "js/radio.js", "js/antenna.js", "js/model.js", "js/views.js", "js/optimizer.js", "js/survey.js", "js/report.js", "js/pdfplan.js", "js/vendor/pdfjs/pdf.min.js", "js/vendor/pdfjs/pdf.worker.min.js", "js/sample.js", "js/view3d.js", "js/floors.js", "js/tables.js", "js/report-pdf.js", "js/xlsx.js", "js/export.js", "js/cad.js", "js/templates.js", "js/vendor/three/three.module.min.js", "js/app.js",
  "manifest.webmanifest", "icons/favicon.svg", "icons/icon-192.png", "icons/icon-512.png",
];
const NETWORK_TIMEOUT_MS = 4000;       // then answer from the cache (the download still refreshes it)

self.addEventListener("install", e => {
  // cache: "reload" skips the HTTP cache (GitHub Pages: max-age=600), so the cache never starts out stale
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // "no-cache" revalidates with the server (a cheap 304 when unchanged) instead of trusting
    // the 10-minute HTTP cache. Fetch by URL: a navigation Request cannot be re-used with options.
    const network = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    e.waitUntil(network.then(() => {}, () => {}));   // let the cache refresh finish after a timeout
    const cached = await cache.match(req, { ignoreSearch: true });
    if (!cached) return network;
    const timeout = new Promise(r => setTimeout(() => r(cached), NETWORK_TIMEOUT_MS));
    return Promise.race([network.catch(() => cached), timeout]);
  })());
});

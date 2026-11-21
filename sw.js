// Offline support: cache the app shell, serve from cache, refresh in the background.
// Bump VERSION when releasing so old caches are cleared.
const VERSION = "wpth-v15";
const ASSETS = [
  "./", "index.html", "css/style.css",
  "js/i18n.js", "js/catalog.js", "js/model.js", "js/optimizer.js", "js/survey.js", "js/report.js", "js/pdfplan.js", "js/vendor/pdfjs/pdf.min.js", "js/vendor/pdfjs/pdf.worker.min.js", "js/sample.js", "js/app.js",
  "manifest.webmanifest", "icons/favicon.svg", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// ChromaView service worker – everything is local, so the app runs with no connection.
// Bump CACHE when you change any file so phones pick up the new version.
const CACHE = "chromaview-v8";
const CORE = ["./", "index.html", "style.css", "app.js", "manifest.json", "fonts/TitanOne-Regular.ttf",
  "icons/logo.png", "icons/logo-128.png", "icons/favicon-64.png", "icons/qr.svg",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined));
      return hit || net;   // instant from cache; refreshes in the background
    })
  );
});

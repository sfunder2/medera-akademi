/* Uygulama kabuğu için önbellek. Veriler (Supabase) her zaman ağdan gelir. */
const CACHE = "medera-v2";
const SHELL = ["./", "index.html", "admin.html", "config.js", "manifest.webmanifest",
  "assets/style.css", "assets/qol.css", "assets/shared.js", "assets/features.js", "assets/duels.js",
  "assets/roleplay.js", "assets/field-training.js", "assets/qol.js", "assets/app.js", "assets/admin.js",
  "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Önce ağ: her açılışta güncel sürüm gelir; bağlantı yoksa son kopya gösterilir.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});

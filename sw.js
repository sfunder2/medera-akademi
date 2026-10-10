/* Uygulama kabuğu önbelleği. Veriler (Supabase) offline.js tarafından cihazda ayrıca saklanır. */
const CACHE = "medera-v4";
const SHELL = ["./", "index.html", "admin.html", "config.js", "manifest.webmanifest",
  "assets/style.css", "assets/qol.css", "assets/shared.js", "assets/offline.js", "assets/features.js", "assets/duels.js",
  "assets/roleplay.js", "assets/field-training.js", "assets/signals.js", "assets/qol.js", "assets/app.js", "assets/admin.js",
  "icons/icon-192.png", "icons/icon-512.png"];
// Uygulamanın açılması için gereken dış dosyalar; internetsiz ilk açılışta da hazır olmalı.
const VENDOR = ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3"];
const VENDOR_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([
    c.addAll(SHELL),
    ...VENDOR.map(u => fetch(u, { mode: "no-cors" }).then(r => c.put(u, r)).catch(() => {}))
  ])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // Kütüphane ve yazı tipleri: önce cihazdaki kopya, arkada güncelleme.
  if (VENDOR_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Uygulama dosyaları: önce ağ (her açılışta güncel sürüm), bağlantı yoksa son kopya.
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});

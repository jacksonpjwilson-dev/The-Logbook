// The Logbook service worker. Bump CACHE when shipping a new version.
const CACHE = "logbook-v33";
const SHELL = ["./", "./index.html", "./styles.css", "./manifest.json", "./icon.png", "./icon-192.png", "./icon-512.png"];
const CDN = [
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js",
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js"
];
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    await Promise.all(CDN.map(u => fetch(u, { mode: "cors" }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
const STATIC_HOSTS = ["cdn.jsdelivr.net", "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Network-first for the page so updates show up right away; cached copy when offline.
  if (req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith(".html"))) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: "no-store" });
        const c = await caches.open(CACHE); c.put("./index.html", res.clone());
        return res;
      } catch {
        return (await caches.match(req)) || (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }
  // Cache-first for same-origin assets and pinned CDN files (fonts, Chart.js, Firebase SDK).
  if (url.origin === location.origin || STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") { const c = await caches.open(CACHE); c.put(req, res.clone()); }
        return res;
      } catch { return Response.error(); }
    })());
  }
  // Everything else (Firestore, auth) goes straight to the network.
});

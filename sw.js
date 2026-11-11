/* Liepa service worker – offline first.
   App shell is served from cache immediately (works with no connection) and refreshed in the background;
   when a new version is downloaded the open app is told so it can offer a reload. */
const CACHE = "liepa-v37";
const SHELL = ["./", "index.html", "liepa.webmanifest", "icons/liepa-icon-192.png", "icons/liepa-icon-512.png", "icons/liepa-icon-180.png", "icons/liepa-maskable-512.png"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function refreshShell(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: "no-store" });
    if (!res.ok) return;
    const old = await cache.match("index.html");
    const fresh = res.clone();
    await cache.put("index.html", res);
    if (old) {
      const [a, b] = await Promise.all([old.text(), fresh.text()]);
      if (a !== b) (await self.clients.matchAll()).forEach(c => c.postMessage({ type: "updated" }));
    }
  } catch (e) { /* offline – keep cached copy */ }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google fonts: cache first (so the look is the same offline)
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      try { const r = await fetch(req); c.put(req, r.clone()); return r; } catch (err) { return new Response("", { status: 504 }); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // App page: answer from cache instantly, update in background
  if (req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
    e.respondWith(caches.match("index.html").then(hit => {
      const upd = refreshShell(new Request("index.html"));
      if (hit) { e.waitUntil(upd); return hit; }
      return upd.then(() => caches.match("index.html")).then(r => r || fetch(req));
    }));
    return;
  }

  // Other same-origin files: stale-while-revalidate
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response("", { status: 504 });
  }));
});

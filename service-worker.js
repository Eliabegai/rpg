const CACHE_ID = "grimorio-static-v2";

/** Só assets estáticos — HTML via rede (evita 301 do serve e páginas erradas no cache). */
const STATIC_ASSETS = [
  "styles.css",
  "base-path.js",
  "pwa-init.js",
  "shared.js",
  "script.js",
  "sheet.js",
  "dm.js",
  "detail-layouts.js",
  "spellcasting-data.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "robots.txt",
];

const OFFLINE_PAGES = ["index.html", "sheet.html", "dm.html"];

function isHtmlNavigation(request) {
  if (request.mode === "navigate") return true;
  if (request.destination === "document") return true;
  const path = new URL(request.url).pathname;
  return /\.html$/i.test(path) || /\/(index|sheet|dm)$/.test(path);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_ID).then((cache) => {
      const base = self.registration.scope;
      return cache.addAll(
        STATIC_ASSETS.map((path) => new URL(path, base).href)
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_ID).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function offlinePageFallback(request) {
  const base = self.registration.scope;
  const path = new URL(request.url).pathname;
  const name = path.endsWith("/") || path.endsWith("/index")
    ? "index.html"
    : path.includes("sheet")
      ? "sheet.html"
      : path.includes("dm")
        ? "dm.html"
        : "index.html";
  for (const page of [name, ...OFFLINE_PAGES]) {
    const cached = await caches.match(new URL(page, base).href);
    if (cached) return cached;
  }
  return caches.match(new URL("index.html", base).href);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isHtmlNavigation(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.type !== "opaque") {
            const copy = response.clone();
            caches.open(CACHE_ID).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => offlinePageFallback(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") return response;
          const copy = response.clone();
          caches.open(CACHE_ID).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request));
    })
  );
});

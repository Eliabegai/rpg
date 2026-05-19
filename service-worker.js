const CACHE_ID = "grimorio-static-v4";

/** Pré-cache mínimo para offline. CSS/JS não passam pelo SW (navegador trata direto). */
const PRECACHE_ASSETS = ["manifest.webmanifest", "icons/icon.svg", "robots.txt"];

const OFFLINE_PAGES = ["index.html", "sheet.html", "dm.html"];

function isHtmlNavigation(request) {
  if (request.mode === "navigate") return true;
  if (request.destination === "document") return true;
  const path = new URL(request.url).pathname;
  return /\.html$/i.test(path) || /\/(index|sheet|dm)$/.test(path);
}

/** Nunca interceptar — evita CSS/JS presos em cache do SW. */
function bypassServiceWorker(url) {
  return /\.(css|js)$/i.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_ID).then((cache) => {
      const base = self.registration.scope;
      return Promise.allSettled(
        PRECACHE_ASSETS.map((path) => cache.add(new URL(path, base).href))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => {
      return caches.open(CACHE_ID);
    })
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

  if (bypassServiceWorker(url)) return;

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
  }
});

/**
 * Define <base href> para GitHub Pages (ex.: /rpg/) e desenvolvimento local.
 * Deve carregar no <head> antes de outros scripts.
 * Injeta o CSS principal com URL absoluta + versão (evita cache antigo do SW/navegador).
 */
(function initAppBasePath() {
  /** Incrementar quando `styles.css` mudar de forma relevante. */
  const APP_ASSET_VERSION = "16";

  function detectBasePath() {
    const { hostname, pathname } = window.location;

    if (hostname.endsWith(".github.io")) {
      const segment = pathname.split("/").filter(Boolean)[0];
      if (segment && !segment.includes(".")) {
        return `/${segment}/`;
      }
      return "/";
    }

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
      const PAGE_SLUGS = new Set(["index", "sheet", "dm", "about", "privacy"]);
      const segment = pathname.split("/").filter(Boolean)[0];
      if (segment && !segment.includes(".") && !PAGE_SLUGS.has(segment)) {
        return `/${segment}/`;
      }
      return "/";
    }

    if (pathname.endsWith("/")) return pathname;
    const last = pathname.split("/").pop() || "";
    if (last.includes(".")) {
      return pathname.slice(0, pathname.lastIndexOf("/") + 1) || "/";
    }
    return "/";
  }

  const basePath = detectBasePath();
  let baseEl = document.querySelector("base[data-app-base]");
  if (!baseEl) {
    baseEl = document.createElement("base");
    baseEl.setAttribute("data-app-base", "");
    document.head.prepend(baseEl);
  }
  baseEl.href = basePath;

  function appPageHref(page) {
    const file = String(page || "").replace(/^\//, "");
    return `${basePath}${file}`;
  }

  function appAssetHref(file) {
    const clean = String(file || "").replace(/^\//, "");
    return `${basePath}${clean}?v=${encodeURIComponent(APP_ASSET_VERSION)}`;
  }

  function ensureMainStylesheet() {
    const existing = document.getElementById("grimorio-main-css");
    const href = appAssetHref("assets/css/styles.css");
    if (existing) {
      if (existing.getAttribute("href") !== href) existing.setAttribute("href", href);
      return;
    }
    const link = document.createElement("link");
    link.id = "grimorio-main-css";
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  ensureMainStylesheet();

  window.appPageHref = appPageHref;
  window.appAssetHref = appAssetHref;
  window.__GRIMORIO_ASSET_V__ = APP_ASSET_VERSION;

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("a[data-app-page]").forEach((a) => {
      const page = a.getAttribute("data-app-page");
      if (page) a.href = appPageHref(page);
    });
  });
})();

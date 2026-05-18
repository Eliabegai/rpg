/**
 * Define <base href> para GitHub Pages (ex.: /rpg/) e desenvolvimento local.
 * Deve carregar no <head> antes de CSS e outros scripts.
 */
(function initAppBasePath() {
  function detectBasePath() {
    const { hostname, pathname } = window.location;

    // GitHub Pages (project site): https://user.github.io/rpg/
    if (hostname.endsWith(".github.io")) {
      const segment = pathname.split("/").filter(Boolean)[0];
      if (segment && !segment.includes(".")) {
        return `/${segment}/`;
      }
      return "/";
    }

    // Local: raiz ou subpasta de projeto (ex. /rpg/), não o nome da página (/dm, /sheet)
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
      const PAGE_SLUGS = new Set(["index", "sheet", "dm"]);
      const segment = pathname.split("/").filter(Boolean)[0];
      if (segment && !segment.includes(".") && !PAGE_SLUGS.has(segment)) {
        return `/${segment}/`;
      }
      return "/";
    }

    // Outro host na raiz (domínio próprio, etc.)
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

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("a[data-app-page]").forEach((a) => {
      const page = a.getAttribute("data-app-page");
      if (page) a.href = appPageHref(page);
    });
  });
})();

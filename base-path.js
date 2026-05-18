/**
 * Define <base href> para GitHub Pages (ex.: /rpg/) e desenvolvimento local.
 * Deve carregar no <head> antes de CSS e outros scripts.
 */
(function initAppBasePath() {
  function detectBasePath() {
    const { hostname, pathname } = window.location;

    if (hostname.endsWith(".github.io")) {
      const segment = pathname.split("/").filter(Boolean)[0];
      if (segment && !segment.includes(".")) {
        return `/${segment}/`;
      }
      return "/";
    }

    if (pathname.endsWith("/")) return pathname;
    const last = pathname.split("/").pop() || "";
    if (last.includes(".")) {
      return pathname.slice(0, pathname.lastIndexOf("/") + 1) || "/";
    }
    return `${pathname}/`;
  }

  const basePath = detectBasePath();
  let baseEl = document.querySelector("base[data-app-base]");
  if (!baseEl) {
    baseEl = document.createElement("base");
    baseEl.setAttribute("data-app-base", "");
    document.head.prepend(baseEl);
  }
  baseEl.href = basePath;
})();

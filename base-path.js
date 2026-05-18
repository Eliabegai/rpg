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

    // Local (serve na raiz): assets em /styles.css, não em /dm/styles.css
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
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
})();

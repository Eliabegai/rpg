/**
 * PWA: service worker + modo mesa (classe .table-mode no <html>).
 */
function syncTableModeToggleButtons() {
  const on = isTableModeEnabled();
  document.querySelectorAll("[data-action='toggle-table-mode']").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(on));
    const label = btn.querySelector(".table-mode-label");
    if (label) label.textContent = on ? "Modo mesa: ligado" : "Modo mesa";
  });
}

(function initPwa() {
  applyTableModeClass();
  syncTableModeToggleButtons();

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='toggle-table-mode']");
    if (!btn) return;
    const next = !isTableModeEnabled();
    setTableModeEnabled(next);
    applyTableModeClass();
    syncTableModeToggleButtons();
  });

  const isLocalDev =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "[::1]";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      if (isLocalDev) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
        return;
      }

      const scope = document.querySelector("base[data-app-base]")?.href || "/";
      const swUrl = new URL("service-worker.js", document.baseURI).href;
      if ("caches" in window) {
        caches.keys().then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("grimorio-") && k !== "grimorio-static-v5")
              .map((k) => caches.delete(k))
          )
        );
      }

      navigator.serviceWorker
        .register(swUrl, { scope })
        .then((reg) => reg.update())
        .catch(() => {});
    });
  }
})();

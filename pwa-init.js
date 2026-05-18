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

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const scope = document.querySelector("base[data-app-base]")?.href || "/";
      const swUrl = new URL("service-worker.js", document.baseURI).href;
      navigator.serviceWorker.register(swUrl, { scope }).catch(() => {});
    });
  }
})();

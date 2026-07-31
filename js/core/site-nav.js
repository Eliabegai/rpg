/**
 * Navegação do site: abre Sobre e Política em modal na home,
 * ou redireciona com query quando estás noutra página.
 */
(function initSiteNav() {
  function pageHref(page) {
    if (typeof window.appPageHref === "function") return window.appPageHref(page);
    return page;
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function openDialog(dialog) {
    if (!dialog) return false;
    ["aboutDialog", "privacyDialog"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el !== dialog) closeDialog(el);
    });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return true;
  }

  function openSobre() {
    const dialog = document.getElementById("aboutDialog");
    if (openDialog(dialog)) {
      const section = document.getElementById("sobre");
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      try {
        history.replaceState(null, "", `${pageHref("index.html")}#sobre`);
      } catch (_) {
        /* ignore */
      }
      return;
    }
    window.location.href = `${pageHref("index.html")}?open=sobre#sobre`;
  }

  function openPrivacy() {
    const dialog = document.getElementById("privacyDialog");
    if (openDialog(dialog)) {
      try {
        history.replaceState(null, "", `${pageHref("index.html")}?open=privacy`);
      } catch (_) {
        /* ignore */
      }
      return;
    }
    window.location.href = pageHref("privacy.html");
  }

  function wireDialogDismiss(dialog) {
    if (!dialog) return;
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  }

  function onNavClick(event) {
    const trigger = event.target.closest("[data-open-panel]");
    if (!trigger) return;
    const panel = trigger.getAttribute("data-open-panel");
    if (panel !== "sobre" && panel !== "privacy") return;
    event.preventDefault();
    if (panel === "sobre") openSobre();
    else openPrivacy();
  }

  document.addEventListener("click", onNavClick);
  wireDialogDismiss(document.getElementById("aboutDialog"));
  wireDialogDismiss(document.getElementById("privacyDialog"));

  function openFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const open = params.get("open");
    const hash = (window.location.hash || "").replace(/^#/, "");

    if (open === "privacy" || hash === "privacy") {
      openPrivacy();
      return;
    }
    if (open === "sobre" || hash === "sobre") {
      openSobre();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", openFromUrl);
  } else {
    openFromUrl();
  }

  window.addEventListener("hashchange", () => {
    if ((window.location.hash || "").replace(/^#/, "") === "sobre") openSobre();
  });
})();

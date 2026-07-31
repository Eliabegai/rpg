/**
 * Modal de contacto na página Sobre / home (email / WhatsApp do editor).
 */
(function initAboutContactModal() {
  const dialog = document.getElementById("contactDialog");
  const openBtns = [
    document.getElementById("openContactModal"),
    document.getElementById("openContactModalFromAbout"),
  ].filter(Boolean);

  if (!dialog || !openBtns.length) return;

  function openContact() {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  openBtns.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      openContact();
    });
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
})();

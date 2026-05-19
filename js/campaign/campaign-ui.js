/**
 * v3.3 — Seletor de campanhas (ficha + mesa).
 */
function renderCampaignPicker(container) {
  if (!container || typeof loadCampaignRegistry !== "function") return;
  const activeId = getActiveCampaignId();
  const list = loadCampaignRegistry();
  const options = list
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}"${c.id === activeId ? " selected" : ""}>${escapeHtml(c.name)}</option>`
    )
    .join("");
  container.innerHTML = `
    <label class="campaign-picker-field">
      <span class="sheet-name-label">Campanha ativa</span>
      <select class="campaign-picker-select" data-campaign-select aria-label="Campanha ativa">
        ${options}
      </select>
    </label>
    <div class="campaign-picker-actions">
      <button type="button" class="sheet-dice-btn sheet-dice-btn--compact campaign-picker-btn" data-action="campaign-new">
        Nova campanha
      </button>
      <button type="button" class="sheet-dice-btn sheet-dice-btn--compact campaign-picker-btn" data-action="campaign-delete"${list.length <= 1 ? " disabled" : ""}>
        Apagar
      </button>
    </div>`;
}

function initCampaignPicker(containerId, options = {}) {
  const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
  if (!container) return;

  const onStatus = typeof options.onStatus === "function" ? options.onStatus : () => {};

  function refresh() {
    renderCampaignPicker(container);
  }

  refresh();

  container.addEventListener("change", (e) => {
    const select = e.target.closest("[data-campaign-select]");
    if (!select) return;
    const id = select.value;
    if (id === getActiveCampaignId()) return;
    const result = switchToCampaign(id);
    if (!result.ok) {
      onStatus(result.error || "Não foi possível mudar de campanha.", true);
      refresh();
      return;
    }
    window.location.reload();
  });

  document.addEventListener("grimorio-campaign-changed", refresh);
}

function handleCampaignUiAction(action, onStatus) {
  const status = typeof onStatus === "function" ? onStatus : () => {};

  if (action === "campaign-new") {
    const name = window.prompt("Nome da nova campanha:");
    if (name == null) return;
    const result = createCampaign(name);
    if (!result.ok) {
      status(result.error || "Não foi possível criar a campanha.", true);
      return;
    }
    status(`Campanha «${result.campaign.name}» criada.`);
    window.location.reload();
    return;
  }

  if (action === "campaign-delete") {
    const id = getActiveCampaignId();
    const active = getActiveCampaign();
    if (
      !window.confirm(
        `Apagar a campanha «${active?.name || id}» e todos os dados locais (ficha, mesa, histórico)?`
      )
    ) {
      return;
    }
    const result = deleteCampaign(id);
    if (!result.ok) {
      status(result.error || "Não foi possível apagar.", true);
      return;
    }
    status("Campanha apagada.");
    window.location.reload();
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action^='campaign-']");
  if (!btn || btn.disabled) return;
  const mount = btn.closest(".campaign-picker");
  const onStatus =
    mount?.id === "dmCampaignPicker" && typeof setCampaignStatus === "function"
      ? setCampaignStatus
      : () => {};
  handleCampaignUiAction(btn.dataset.action, onStatus);
});

/**
 * v3.2 — Turnos de iniciativa, encontros guardados, referência rápida.
 */
const dmTurnToolbar = document.getElementById("dmTurnToolbar");
const dmSnapshotsList = document.getElementById("dmSnapshotsList");
const dmSnapshotNameInput = document.getElementById("dmSnapshotNameInput");
const dmTreasureResult = document.getElementById("dmTreasureResult");
const dmQuickRulesMount = document.getElementById("dmQuickRulesMount");

function getInitiativeTurnOrder(battle) {
  return typeof buildInitiativeEntries === "function" ? buildInitiativeEntries(battle) : [];
}

function sanitizeActiveTurnKey(battle, key) {
  if (!key) return "";
  const parsed = parseDmTurnKey(key);
  if (!parsed) return "";
  const canonical = dmTurnKey(parsed.kind, parsed.id);
  const order = getInitiativeTurnOrder(battle);
  const ok = order.some((r) => dmTurnKey(r.kind, r.id) === canonical);
  return ok ? canonical : "";
}

function ensureCombatTrack(battle) {
  if (!battle.combat) battle.combat = normalizeDmCombatTrack(null);
  battle.combat.activeTurnKey = sanitizeActiveTurnKey(battle, battle.combat.activeTurnKey);
  if (!Number.isFinite(battle.combat.round) || battle.combat.round < 1) battle.combat.round = 1;
}

function advanceDmTurn() {
  patchBattle((battle) => {
    ensureCombatTrack(battle);
    const order = getInitiativeTurnOrder(battle);
    if (!order.length) {
      battle.combat.activeTurnKey = "";
      return;
    }
    let idx = order.findIndex((r) => dmTurnKey(r.kind, r.id) === battle.combat.activeTurnKey);
    if (idx < 0) {
      battle.combat.activeTurnKey = dmTurnKey(order[0].kind, order[0].id);
      return;
    }
    const next = (idx + 1) % order.length;
    if (next === 0) battle.combat.round += 1;
    battle.combat.activeTurnKey = dmTurnKey(order[next].kind, order[next].id);
  });
}

function resetDmTurns() {
  patchBattle((battle) => {
    ensureCombatTrack(battle);
    battle.combat.round = 1;
    const order = getInitiativeTurnOrder(battle);
    battle.combat.activeTurnKey = order.length ? dmTurnKey(order[0].kind, order[0].id) : "";
  });
}

function clearDmTurnHighlight() {
  patchBattle((battle) => {
    ensureCombatTrack(battle);
    battle.combat.activeTurnKey = "";
    battle.combat.round = 1;
  });
}

function renderDmTurnToolbar(battle) {
  if (!dmTurnToolbar) return;
  ensureCombatTrack(battle);
  const order = getInitiativeTurnOrder(battle);
  const activeKey = battle.combat.activeTurnKey;
  const active = order.find((r) => dmTurnKey(r.kind, r.id) === activeKey);
  const activeLabel = active ? active.name : "—";
  const label = battle.combat.encounterLabel
    ? escapeHtml(battle.combat.encounterLabel)
    : "";

  dmTurnToolbar.innerHTML = `
    <div class="dm-turn-toolbar-inner">
      <div class="dm-turn-toolbar-main">
        <span class="dm-turn-round" aria-live="polite">Rodada <strong>${battle.combat.round}</strong></span>
        <span class="dm-turn-active">Turno: <strong>${escapeHtml(activeLabel)}</strong></span>
        <div class="dm-turn-actions" role="group" aria-label="Controlo de turnos">
          <button type="button" class="sheet-dice-btn sheet-dice-btn--compact" data-action="dm-next-turn"${order.length ? "" : " disabled"}>Próximo turno</button>
          <button type="button" class="sheet-dice-btn sheet-dice-btn--compact" data-action="dm-reset-turns"${order.length ? "" : " disabled"}>Início da rodada</button>
          <button type="button" class="sheet-dice-btn sheet-dice-btn--compact" data-action="dm-clear-turn">Limpar destaque</button>
        </div>
      </div>
      <label class="dm-encounter-label-field sheet-inline-field">
        <span class="sheet-name-label">Nome do encontro</span>
        <input type="text" id="dmEncounterLabelInput" class="sheet-name-input" value="${label}" placeholder="Ex.: Emboscada na estrada" maxlength="120" />
      </label>
    </div>`;

}

function renderDmSnapshotsList() {
  if (!dmSnapshotsList) return;
  const list = loadDmSnapshots();
  if (!list.length) {
    dmSnapshotsList.innerHTML = `<p class="dm-sidebar-hint">Nenhum encontro guardado. Guarda o estado atual (party + monstros + iniciativa).</p>`;
    return;
  }
  dmSnapshotsList.innerHTML = `<ul class="dm-snapshot-list">${list
    .map((s) => {
      const when = new Date(s.savedAt);
      const dateStr = Number.isFinite(when.getTime())
        ? when.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
        : "";
      const nParty = s.battle.party?.length || 0;
      const nEnc = s.battle.encounters?.length || 0;
      return `<li class="dm-snapshot-item">
        <div class="dm-snapshot-meta">
          <strong class="dm-snapshot-name">${escapeHtml(s.name)}</strong>
          <span class="dm-snapshot-date">${escapeHtml(dateStr)} · ${nParty} pers., ${nEnc} criat.</span>
        </div>
        <div class="dm-snapshot-actions">
          <button type="button" class="sheet-dice-btn sheet-dice-btn--compact" data-action="dm-load-snapshot" data-snapshot-id="${escapeHtml(s.id)}">Abrir</button>
          <button type="button" class="sheet-portrait-clear dm-snapshot-delete" data-action="dm-delete-snapshot" data-snapshot-id="${escapeHtml(s.id)}" aria-label="Apagar encontro guardado">×</button>
        </div>
      </li>`;
    })
    .join("")}</ul>`;
}

function renderDmQuickRef() {
  if (!dmQuickRulesMount) return;
  const crOptions = DM_TREASURE_CR_OPTIONS.map(
    (o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)}</option>`
  ).join("");
  const rulesHtml = DM_QUICK_RULES.map(
    (r) => `<details class="dm-quick-rule">
      <summary>${escapeHtml(r.title)}</summary>
      <div class="dm-quick-rule-body">${r.body}</div>
    </details>`
  ).join("");

  dmQuickRulesMount.innerHTML = `
    <section class="dm-quick-treasure" aria-labelledby="dmTreasureTitle">
      <h3 id="dmTreasureTitle" class="dm-sidebar-xp-title">Tesouro (DMG)</h3>
      <p class="dm-sidebar-hint">Rolagem simplificada — consulta o DMG para gemas, arte e tabelas mágicas.</p>
      <label class="sheet-inline-field">
        <span class="sheet-name-label">ND do monstro</span>
        <select id="dmTreasureCrSelect" class="sheet-select">${crOptions}</select>
      </label>
      <div class="dm-treasure-actions">
        <button type="button" class="sheet-dice-btn sheet-dice-btn--compact" data-action="dm-roll-treasure-individual">Tesouro individual</button>
        <button type="button" class="sheet-dice-btn sheet-dice-btn--compact" data-action="dm-roll-treasure-hoard">Acumulação</button>
      </div>
      <p id="dmTreasureResult" class="dm-treasure-result" role="status" aria-live="polite"></p>
    </section>
    <section class="dm-quick-rules" aria-labelledby="dmRulesTitle">
      <h3 id="dmRulesTitle" class="dm-sidebar-xp-title">Regras rápidas</h3>
      ${rulesHtml}
    </section>`;
}

function onDmEncounterLabelChange(value) {
  mutateBattle((battle) => {
    ensureCombatTrack(battle);
    battle.combat.encounterLabel = String(value || "").trim().slice(0, 120);
  });
}

function saveDmSnapshotFromUi() {
  const name =
    dmSnapshotNameInput?.value?.trim() ||
    document.getElementById("dmEncounterLabelInput")?.value?.trim() ||
    loadDmBattle().combat?.encounterLabel ||
    "";
  const result = addDmSnapshot(name || `Encontro ${new Date().toLocaleDateString("pt-BR")}`);
  if (!result.ok) {
    setCampaignStatus?.(result.error, true);
    return;
  }
  if (dmSnapshotNameInput) dmSnapshotNameInput.value = "";
  renderDmSnapshotsList();
  setCampaignStatus?.(`Encontro «${result.snapshot.name}» guardado.`);
}

function handleDmV32Action(action, btn) {
  if (action === "dm-next-turn") {
    advanceDmTurn();
    return true;
  }
  if (action === "dm-reset-turns") {
    resetDmTurns();
    return true;
  }
  if (action === "dm-clear-turn") {
    clearDmTurnHighlight();
    return true;
  }
  if (action === "dm-save-snapshot") {
    saveDmSnapshotFromUi();
    return true;
  }
  if (action === "dm-load-snapshot") {
    const id = btn.dataset.snapshotId;
    if (!id) return true;
    const result = restoreDmSnapshot(id);
    if (!result.ok) setCampaignStatus?.(result.error, true);
    else {
      setCampaignStatus?.(`Encontro «${result.name}» carregado.`);
      renderAll?.();
    }
    return true;
  }
  if (action === "dm-delete-snapshot") {
    const id = btn.dataset.snapshotId;
    if (!id) return true;
    if (window.confirm("Apagar este encontro guardado?")) {
      deleteDmSnapshot(id);
      renderDmSnapshotsList();
      setCampaignStatus?.("Encontro guardado apagado.");
    }
    return true;
  }
  if (action === "dm-roll-treasure-individual" || action === "dm-roll-treasure-hoard") {
    const cr = document.getElementById("dmTreasureCrSelect")?.value || "0-4";
    const kind = action === "dm-roll-treasure-hoard" ? "hoard" : "individual";
    const rolled = rollDmTreasure(kind, cr);
    const el = document.getElementById("dmTreasureResult") || dmTreasureResult;
    if (el) el.textContent = rolled.text;
    return true;
  }
  return false;
}

function initDmV32() {
  renderDmQuickRef();
  renderDmSnapshotsList();
  if (dmSnapshotNameInput) {
    dmSnapshotNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveDmSnapshotFromUi();
      }
    });
  }
  document.addEventListener("input", (e) => {
    if (e.target.id === "dmEncounterLabelInput") onDmEncounterLabelChange(e.target.value);
  });
}

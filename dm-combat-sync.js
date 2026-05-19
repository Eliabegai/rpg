/**
 * Inspiração e condições — sync ficha ↔ mesa (iniciativa).
 */
function renderDmInitCombatBar(row) {
  if (!row || (row.kind !== "party" && row.kind !== "monster")) return "";
  const active = new Set(row.activeConditions || []);
  const activeChips = SHEET_CONDITION_OPTIONS.filter((c) => active.has(c.index))
    .map((c) => {
      const toggleAction =
        row.kind === "party" ? "dm-toggle-party-condition" : "dm-toggle-enc-condition";
      const idAttr =
        row.kind === "party"
          ? `data-party-id="${escapeHtml(row.id)}"`
          : `data-enc-id="${escapeHtml(row.id)}"`;
      return `<button type="button" class="dm-condition-chip dm-condition-chip--on" data-action="${toggleAction}" ${idAttr} data-condition="${c.index}" aria-pressed="true">${escapeHtml(c.label)}</button>`;
    })
    .join("");

  const inspBlock =
    row.kind === "party"
      ? (() => {
          const inspClass = row.inspiration ? " dm-inspiration-btn--on" : "";
          return `<button type="button" class="dm-inspiration-btn${inspClass}" data-action="dm-toggle-party-inspiration" data-party-id="${escapeHtml(row.id)}" aria-pressed="${row.inspiration ? "true" : "false"}" title="Inspiração">✨</button>`;
        })()
      : "";

  const conc =
    row.kind === "party" && row.concentrationSpell && String(row.concentrationSpell).trim()
      ? `<span class="dm-init-concentration" title="Concentração">${escapeHtml(String(row.concentrationSpell).slice(0, 60))}${String(row.concentrationSpell).length > 60 ? "…" : ""}</span>`
      : "";

  const pickButtons = SHEET_CONDITION_OPTIONS.map((c) => {
    const on = active.has(c.index);
    const toggleAction = row.kind === "party" ? "dm-toggle-party-condition" : "dm-toggle-enc-condition";
    const idAttr =
      row.kind === "party"
        ? `data-party-id="${escapeHtml(row.id)}"`
        : `data-enc-id="${escapeHtml(row.id)}"`;
    return `<button type="button" class="dm-condition-chip${on ? " dm-condition-chip--on" : ""}" data-action="${toggleAction}" ${idAttr} data-condition="${c.index}" aria-pressed="${on}">${escapeHtml(c.label)}</button>`;
  }).join("");

  return `<div class="dm-init-combat" data-${row.kind === "party" ? "party" : "enc"}-id="${escapeHtml(row.id)}">
    ${inspBlock}
    <div class="dm-init-conditions" role="group" aria-label="Condições">${activeChips || '<span class="dm-init-conditions-empty">Sem condições</span>'}</div>
    <details class="dm-init-conditions-edit">
      <summary>+ condição</summary>
      <div class="dm-init-conditions-pick">${pickButtons}</div>
    </details>
    ${conc}
  </div>`;
}


/** @deprecated use renderDmInitCombatBar */
function renderDmPartyCombatBar(row) {
  return renderDmInitCombatBar(row);
}

function patchDmPartyMember(partyId, mutator) {
  patchBattle((battle) => {
    const p = battle.party.find((x) => x.id === partyId);
    if (p) mutator(p);
  });
}

function patchDmEncounterMember(encId, mutator) {
  patchBattle((battle) => {
    const e = battle.encounters.find((x) => x.id === encId);
    if (e) mutator(e);
  });
}

function toggleDmPartyInspiration(partyId) {
  patchDmPartyMember(partyId, (p) => {
    p.inspiration = !p.inspiration;
  });
  tryPushDmCombatToSheet(partyId);
  scheduleRender?.();
}

function toggleDmPartyCondition(partyId, conditionIndex) {
  patchDmPartyMember(partyId, (p) => {
    const set = new Set(p.activeConditions || []);
    if (set.has(conditionIndex)) set.delete(conditionIndex);
    else set.add(conditionIndex);
    p.activeConditions = [...set];
  });
  tryPushDmCombatToSheet(partyId);
  scheduleRender?.();
}

function toggleDmEncounterCondition(encId, conditionIndex) {
  patchDmEncounterMember(encId, (e) => {
    const set = new Set(e.activeConditions || []);
    if (set.has(conditionIndex)) set.delete(conditionIndex);
    else set.add(conditionIndex);
    e.activeConditions = [...set];
  });
  scheduleRender?.();
}

function tryPushDmCombatToSheet(partyId) {
  const member = loadDmBattle().party.find((p) => p.id === partyId);
  const sheet = loadSheet();
  if (!member || !sheet.characterName) return;
  if (normalizePartySyncName(sheet.characterName) !== normalizePartySyncName(member.name)) return;
  copyMemberCombatStateToSheet(sheet, member);
  saveSheet(normalizeSheet(sheet));
}

function handleDmCombatSyncAction(action, btn) {
  if (action === "dm-toggle-party-inspiration") {
    const partyId = btn?.dataset?.partyId;
    if (!partyId) return false;
    toggleDmPartyInspiration(partyId);
    return true;
  }
  if (action === "dm-toggle-party-condition") {
    const partyId = btn?.dataset?.partyId;
    if (!partyId) return false;
    toggleDmPartyCondition(partyId, btn.dataset.condition);
    return true;
  }
  if (action === "dm-toggle-enc-condition") {
    const encId = btn?.dataset?.encId;
    if (!encId) return false;
    toggleDmEncounterCondition(encId, btn.dataset.condition);
    return true;
  }
  return false;
}

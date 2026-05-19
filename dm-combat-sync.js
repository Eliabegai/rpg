/**
 * Inspiração e condições — sync ficha ↔ mesa (iniciativa).
 */
function renderDmPartyCombatBar(row) {
  if (!row || row.kind !== "party") return "";
  const active = new Set(row.activeConditions || []);
  const activeChips = SHEET_CONDITION_OPTIONS.filter((c) => active.has(c.index))
    .map(
      (c) =>
        `<button type="button" class="dm-condition-chip dm-condition-chip--on" data-action="dm-toggle-party-condition" data-party-id="${escapeHtml(row.id)}" data-condition="${c.index}" aria-pressed="true">${escapeHtml(c.label)}</button>`
    )
    .join("");
  const inspClass = row.inspiration ? " dm-inspiration-btn--on" : "";
  const conc =
    row.concentrationSpell && String(row.concentrationSpell).trim()
      ? `<span class="dm-init-concentration" title="Concentração">${escapeHtml(String(row.concentrationSpell).slice(0, 60))}${String(row.concentrationSpell).length > 60 ? "…" : ""}</span>`
      : "";
  return `<div class="dm-init-combat" data-party-id="${escapeHtml(row.id)}">
    <button type="button" class="dm-inspiration-btn${inspClass}" data-action="dm-toggle-party-inspiration" data-party-id="${escapeHtml(row.id)}" aria-pressed="${row.inspiration ? "true" : "false"}" title="Inspiração">✨</button>
    <div class="dm-init-conditions" role="group" aria-label="Condições">${activeChips || '<span class="dm-init-conditions-empty">Sem condições</span>'}</div>
    <details class="dm-init-conditions-edit">
      <summary>+ condição</summary>
      <div class="dm-init-conditions-pick">${SHEET_CONDITION_OPTIONS.map((c) => {
        const on = active.has(c.index);
        return `<button type="button" class="dm-condition-chip${on ? " dm-condition-chip--on" : ""}" data-action="dm-toggle-party-condition" data-party-id="${escapeHtml(row.id)}" data-condition="${c.index}" aria-pressed="${on}">${escapeHtml(c.label)}</button>`;
      }).join("")}</div>
    </details>
    ${conc}
  </div>`;
}

function patchDmPartyMember(partyId, mutator) {
  patchBattle((battle) => {
    const p = battle.party.find((x) => x.id === partyId);
    if (p) mutator(p);
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

function tryPushDmCombatToSheet(partyId) {
  const member = loadDmBattle().party.find((p) => p.id === partyId);
  const sheet = loadSheet();
  if (!member || !sheet.characterName) return;
  if (normalizePartySyncName(sheet.characterName) !== normalizePartySyncName(member.name)) return;
  copyMemberCombatStateToSheet(sheet, member);
  saveSheet(normalizeSheet(sheet));
}

function handleDmCombatSyncAction(action, btn) {
  const partyId = btn?.dataset?.partyId;
  if (!partyId) return false;
  if (action === "dm-toggle-party-inspiration") {
    toggleDmPartyInspiration(partyId);
    return true;
  }
  if (action === "dm-toggle-party-condition") {
    toggleDmPartyCondition(partyId, btn.dataset.condition);
    return true;
  }
  return false;
}

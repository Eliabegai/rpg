const dmMonsterLibrary = document.getElementById("dmMonsterLibrary");
const dmMonsterEmpty = document.getElementById("dmMonsterEmpty");
const dmPartyForm = document.getElementById("dmPartyForm");
const dmPartyNameInput = document.getElementById("dmPartyNameInput");
const dmPartyLevelInput = document.getElementById("dmPartyLevelInput");
const dmPartyInitInput = document.getElementById("dmPartyInitInput");
const dmCampaignNameInput = document.getElementById("dmCampaignNameInput");
const dmCampaignImportInput = document.getElementById("dmCampaignImportInput");
const dmCampaignStatus = document.getElementById("dmCampaignStatus");
const dmXpPhbTable = document.getElementById("dmXpPhbTable");
const dmInitiativeList = document.getElementById("dmInitiativeList");
const dmInitEmpty = document.getElementById("dmInitEmpty");
const dmEncounterList = document.getElementById("dmEncounterList");
const dmEncounterEmpty = document.getElementById("dmEncounterEmpty");
const dmEncounterDeadWrap = document.getElementById("dmEncounterDeadWrap");
const dmEncounterDeadList = document.getElementById("dmEncounterDeadList");
const dmXpLedger = document.getElementById("dmXpLedger");
const dmEncounterDiff = document.getElementById("dmEncounterDiff");
const dmSessionHistory = document.getElementById("dmSessionHistory");
const dmSessionNotesInput = document.getElementById("dmSessionNotesInput");
const localeSelect = document.getElementById("localeSelect");

const DM_DAMAGE_TICK_MS = [45, 48, 52, 58, 68, 82, 100, 125, 160, 200];
const DM_D20_TICK_MS = [42, 44, 48, 54, 62, 72, 86, 105, 130, 165, 210];
const MAX_DAMAGE_DICE = 16;

const dmRollLocks = new Set();
let dmRenderTimer = null;
let dmFocusedEncId = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleRender() {
  clearTimeout(dmRenderTimer);
  dmRenderTimer = setTimeout(renderAll, 260);
}

function mutateBattle(mutator) {
  const battle = loadDmBattle();
  mutator(battle);
  saveDmBattle(battle);
}

function patchBattle(mutator) {
  mutateBattle(mutator);
  renderAll();
}

function parseInitiativeValue(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function sortByInitiativeDesc(items, getInit) {
  return [...items].sort((a, b) => {
    const ai = getInit(a);
    const bi = getInit(b);
    if (ai == null && bi == null) return 0;
    if (ai == null) return 1;
    if (bi == null) return -1;
    return bi - ai;
  });
}

function isEncounterDead(enc) {
  const cur = Number(enc.hpCurrent);
  return Number.isFinite(cur) && cur <= 0;
}

function encounterHpRatio(enc) {
  const max = Number(enc.hpMax);
  const cur = Number(enc.hpCurrent);
  if (!Number.isFinite(max) || max <= 0) return 1;
  if (!Number.isFinite(cur)) return 1;
  return Math.max(0, Math.min(1, cur / max));
}

function encounterDangerClass(enc) {
  if (isEncounterDead(enc)) return "is-dead";
  const ratio = encounterHpRatio(enc);
  if (ratio <= 0.25) return "is-danger-critical";
  if (ratio <= 0.5) return "is-danger-high";
  if (ratio < 1) return "is-danger-low";
  return "";
}

const ENCOUNTER_DANGER_CLASSES = ["is-dead", "is-danger-low", "is-danger-high", "is-danger-critical"];

/** 0 = cheio, 1 = crítico; curva acentua vermelho cedo e escurece no fim. */
function encounterDangerIntensity(enc) {
  if (isEncounterDead(enc)) return 0;
  const ratio = encounterHpRatio(enc);
  if (ratio >= 1) return 0;
  const t = 1 - ratio;
  return Math.min(1, t * t * 1.35 + t * 0.45);
}

function encounterDangerStyle(enc) {
  const hpPct = Math.round(encounterHpRatio(enc) * 100);
  const intensity = encounterDangerIntensity(enc);
  return `--hp-pct: ${hpPct}; --hp-danger: ${intensity.toFixed(3)}`;
}

function applyEncounterDangerVars(card, enc) {
  if (!card) return;
  const hpPct = Math.round(encounterHpRatio(enc) * 100);
  card.style.setProperty("--hp-pct", String(hpPct));
  card.style.setProperty("--hp-danger", encounterDangerIntensity(enc).toFixed(3));
  card.classList.remove(...ENCOUNTER_DANGER_CLASSES);
  const danger = encounterDangerClass(enc);
  if (danger) card.classList.add(danger);
  const hpInput = card.querySelector("[data-field='hpCurrent']");
  if (hpInput) hpInput.classList.toggle("dm-hp-dead", isEncounterDead(enc));
}

function syncEncounterCardVisuals(enc) {
  applyEncounterDangerVars(document.getElementById(`enc-${enc.id}`), enc);
}

function computePartyXpLedger(battle) {
  const totals = new Map();
  for (const p of activePartyMembers(battle.party)) totals.set(p.id, 0);
  for (const enc of battle.encounters) {
    if (!isEncounterDead(enc)) continue;
    const xp = Number(enc.xp) || 0;
    const killers = filterKilledByForXp(enc.killedBy, battle.party);
    if (!xp || !killers.length) continue;
    const split = splitXpAmongParty(xp, killers);
    split.forEach((amt, id) => totals.set(id, (totals.get(id) || 0) + amt));
  }
  return totals;
}

function renderXpPhbReferenceTable() {
  if (!dmXpPhbTable) return;
  const rows = XP_THRESHOLDS.map((xp, i) => {
    const level = i + 1;
    const next = level < 20 ? XP_THRESHOLDS[level] - xp : null;
    return `<tr>
      <td>${level}</td>
      <td class="dm-xp-value">${xp.toLocaleString("pt-BR")}</td>
      <td class="dm-xp-phb-delta">${next != null ? next.toLocaleString("pt-BR") : "—"}</td>
    </tr>`;
  }).join("");
  dmXpPhbTable.innerHTML = `<table class="dm-xp-table dm-xp-phb-table">
    <thead>
      <tr><th scope="col">Nív.</th><th scope="col">XP total</th><th scope="col">Para subir</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderXpProgressBar(p) {
  const prog = characterXpProgress(p.xpTotal, p.level);
  if (prog.nextAt == null) {
    return `<div class="dm-xp-progress dm-xp-progress--max" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"><span class="dm-xp-progress-fill" style="width:100%"></span></div>`;
  }
  const label = `${prog.inLevel.toLocaleString("pt-BR")} / ${prog.span.toLocaleString("pt-BR")} XP`;
  return `<div class="dm-xp-progress" role="progressbar" aria-valuenow="${prog.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso para o nível ${p.level + 1}">
    <span class="dm-xp-progress-fill" style="width:${prog.pct}%"></span>
  </div><span class="dm-xp-progress-label">${label}</span>`;
}

function pullPartyMemberFromSheet(partyId) {
  const battle = loadDmBattle();
  const member = battle.party.find((p) => p.id === partyId);
  if (!member) return;
  const sheet = loadSheet();
  const sheetName = String(sheet.characterName || "").trim();
  const memberName = String(member.name || "").trim();
  if (!sheetName) {
    setCampaignStatus("A ficha não tem nome de personagem.", true);
    return;
  }
  if (normalizePartySyncName(sheetName) !== normalizePartySyncName(memberName)) {
    const ok = window.confirm(
      `A ficha é «${sheetName}» e a mesa tem «${memberName}». Importar nível e XP da ficha mesmo assim?`
    );
    if (!ok) return;
    patchBattle((b) => {
      const p = b.party.find((x) => x.id === partyId);
      if (p) {
        p.level = clampCharacterLevel(sheet.characterLevel);
        p.xpTotal = normalizeXpTotal(sheet.xpTotal);
        copySheetCombatStateToMember(p, sheet);
      }
    });
    setCampaignStatus(`Dados de «${sheetName}» aplicados a «${memberName}» (incl. inspiração e condições).`);
    scheduleRender();
    return;
  }
  patchBattle((b) => {
    const p = b.party.find((x) => x.id === partyId);
    if (p) {
      p.level = clampCharacterLevel(sheet.characterLevel);
      p.xpTotal = normalizeXpTotal(sheet.xpTotal);
      copySheetCombatStateToMember(p, sheet);
    }
  });
  setCampaignStatus(`«${memberName}» sincronizado com a ficha (incl. inspiração e condições).`);
  scheduleRender();
}

function pushPartyMemberToSheet(partyId) {
  const member = loadDmBattle().party.find((p) => p.id === partyId);
  if (!member) return;
  const result = syncDmPartyMemberToSheet(member);
  if (!result.ok && result.nameMismatch) {
    const ok = window.confirm(`${result.error}\n\nSubstituir o nome e dados da ficha?`);
    if (ok) syncDmPartyMemberToSheet(member, { forceName: true });
    return;
  }
  if (!result.ok) {
    setCampaignStatus(result.error || "Falha ao enviar para a ficha.", true);
    return;
  }
  setCampaignStatus(`Ficha atualizada com dados de «${member.name}».`);
}

function syncAllPartyFromSheet() {
  const sheet = loadSheet();
  const name = String(sheet.characterName || "").trim();
  if (!name) {
    setCampaignStatus("Define o nome na ficha de personagem.", true);
    return;
  }
  const result = syncSheetToDmBattle(sheet);
  if (!result.ok) {
    setCampaignStatus(result.error || "Sincronização falhou.", true);
    return;
  }
  setCampaignStatus(result.created ? "Personagem criado na mesa a partir da ficha." : "Mesa atualizada a partir da ficha.");
}

function buildSessionHistoryEntry(battle, ledger, totalXp) {
  const campaign = loadCampaign();
  const members = activePartyMembers(battle.party).map((p) => ({
    name: p.name,
    xp: ledger.get(p.id) || 0,
    level: p.level,
  }));
  const monstersDefeated = battle.encounters.filter((e) => isEncounterDead(e)).length;
  const notes = dmSessionNotesInput ? String(dmSessionNotesInput.value || "").trim().slice(0, 500) : "";
  return {
    campaignName: campaign.name || "",
    totalXp,
    monstersDefeated,
    notes,
    members,
  };
}

function renderSessionHistory() {
  if (!dmSessionHistory) return;
  const entries = loadSessionHistory();
  if (!entries.length) {
    dmSessionHistory.innerHTML = '<p class="dm-history-empty">Ainda sem sessões registadas.</p>';
    return;
  }
  dmSessionHistory.innerHTML = `<ul class="dm-history-list">${entries
    .map((e) => {
      const when = new Date(e.at);
      const dateStr = Number.isFinite(when.getTime())
        ? when.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
        : e.at;
      const camp = e.campaignName ? ` · ${escapeHtml(e.campaignName)}` : "";
      const memberRows = (e.members || [])
        .filter((m) => m.xp > 0)
        .map((m) => `<li>${escapeHtml(m.name)} +${m.xp} XP (nív. ${m.level})</li>`)
        .join("");
      const notesBlock = e.notes
        ? `<p class="dm-history-notes">${escapeHtml(e.notes)}</p>`
        : "";
      return `<li class="dm-history-item">
        <p class="dm-history-meta"><time datetime="${escapeHtml(e.at)}">${escapeHtml(dateStr)}</time>${camp}</p>
        <p class="dm-history-summary">${e.totalXp} XP · ${e.monstersDefeated} monstro(s)</p>
        ${notesBlock}
        ${memberRows ? `<ul class="dm-history-members">${memberRows}</ul>` : ""}
      </li>`;
    })
    .join("")}</ul>`;
}

function applySessionXpToParty() {
  const battle = loadDmBattle();
  const ledger = computePartyXpLedger(battle);
  let credited = 0;
  patchBattle((b) => {
    for (const p of b.party) {
      const gain = ledger.get(p.id) || 0;
      if (!gain) continue;
      p.xpTotal = normalizeXpTotal(p.xpTotal) + gain;
      p.level = levelFromXpTotal(p.xpTotal);
      credited += gain;
    }
    for (const enc of b.encounters) {
      if (isEncounterDead(enc)) enc.killedBy = [];
    }
  });
  if (credited > 0) {
    appendSessionHistory(buildSessionHistoryEntry(battle, ledger, credited));
    if (dmSessionNotesInput) dmSessionNotesInput.value = "";
    renderSessionHistory();
    setCampaignStatus(`+${credited} XP creditado ao grupo.`);
  } else {
    setCampaignStatus("Nada a creditar — elimina monstros e marca participantes.");
  }
}

function renderEncounterDifficulty() {
  if (!dmEncounterDiff) return;
  const battle = loadDmBattle();
  const active = activePartyMembers(battle.party);
  const living = battle.encounters.filter((e) => !isEncounterDead(e));

  if (!active.length) {
    dmEncounterDiff.innerHTML = '<p class="dm-diff-empty">Adiciona personagens vivos para calcular o orçamento.</p>';
    return;
  }
  if (!living.length) {
    dmEncounterDiff.innerHTML = '<p class="dm-diff-empty">Sem criaturas vivas na mesa.</p>';
    return;
  }

  const diff = computeEncounterDifficulty(battle.party, battle.encounters);
  const multLabel = diff.multiplier % 1 === 0 ? String(diff.multiplier) : String(diff.multiplier).replace(".", ",");

  const budgetRows = ["easy", "medium", "hard", "deadly"]
    .map(
      (tier) =>
        `<tr><th scope="row">${escapeHtml(ENCOUNTER_DIFFICULTY_LABELS[tier])}</th><td>${diff.budget[tier].toLocaleString("pt-BR")}</td></tr>`
    )
    .join("");

  dmEncounterDiff.innerHTML = `<div class="dm-diff-card dm-diff-card--${escapeHtml(diff.difficulty)}">
    <p class="dm-diff-verdict"><span class="dm-diff-badge">${escapeHtml(diff.difficultyLabel)}</span></p>
    <dl class="dm-diff-stats">
      <div><dt>Criaturas</dt><dd>${diff.monsterCount}</dd></div>
      <div><dt>XP base</dt><dd>${diff.rawXp.toLocaleString("pt-BR")}</dd></div>
      <div><dt>Multiplicador</dt><dd>×${multLabel}</dd></div>
      <div><dt>XP ajustado</dt><dd class="dm-diff-adjusted">${diff.adjustedXp.toLocaleString("pt-BR")}</dd></div>
    </dl>
    <details class="dm-diff-budget-collapse">
      <summary>Orçamento do grupo (DMG)</summary>
      <table class="dm-xp-table dm-diff-budget-table">
        <tbody>${budgetRows}</tbody>
      </table>
    </details>
  </div>`;
}

function renderXpSidebar() {
  if (!dmXpLedger) return;
  const battle = loadDmBattle();
  const totals = computePartyXpLedger(battle);

  const active = activePartyMembers(battle.party);
  if (active.length === 0) {
    dmXpLedger.innerHTML =
      battle.party.length > 0
        ? '<p class="dm-xp-empty">Todos os personagens estão eliminados.</p>'
        : '<p class="dm-xp-empty">Sem personagens em combate.</p>';
    return;
  }

  let grandSession = 0;
  const rows = active
    .map((p) => {
      const sessionXp = totals.get(p.id) || 0;
      grandSession += sessionXp;
      const total = normalizeXpTotal(p.xpTotal);
      return `<tr class="dm-xp-row">
        <td class="dm-xp-name">
          ${escapeHtml(p.name)}
          <span class="dm-xp-level">Nív. ${p.level}</span>
          <span class="dm-xp-meta">${total.toLocaleString("pt-BR")} XP total</span>
          ${renderXpProgressBar(p)}
        </td>
        <td class="dm-xp-value">${sessionXp}</td>
      </tr>`;
    })
    .join("");

  const grandTotal = active.reduce((s, p) => s + normalizeXpTotal(p.xpTotal), 0);

  dmXpLedger.innerHTML = `<table class="dm-xp-table dm-xp-table--progress">
    <thead>
      <tr><th scope="col">Personagem</th><th scope="col">Sessão</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><th scope="row">Sessão</th><td class="dm-xp-value dm-xp-total">${grandSession}</td></tr>
      <tr><th scope="row">Total acum.</th><td class="dm-xp-value">${grandTotal.toLocaleString("pt-BR")}</td></tr>
    </tfoot>
  </table>`;
}

function renderCampaignUi() {
  const campaign = loadCampaign();
  if (dmCampaignNameInput && dmCampaignNameInput !== document.activeElement) {
    dmCampaignNameInput.value = campaign.name;
  }
}

function setCampaignStatus(message, isError = false) {
  if (!dmCampaignStatus) return;
  dmCampaignStatus.textContent = message;
  dmCampaignStatus.classList.toggle("is-error", isError);
}

function exportCampaignJson() {
  const bundle = buildCampaignExportBundle();
  const name = bundle.campaign?.name?.trim() || "campanha";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "campanha";
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `grimorio-${slug}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setCampaignStatus("Exportação concluída.");
}

async function importCampaignJsonFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const result = importCampaignBundle(parsed);
    if (!result.ok) {
      setCampaignStatus(result.error || "Importação falhou.", true);
      return;
    }
    renderCampaignUi();
    renderAll();
    setCampaignStatus("Campanha importada.");
  } catch {
    setCampaignStatus("Ficheiro JSON inválido.", true);
  }
}

function encounterLabelFor(entry, battle) {
  const base = entry.name || entry.index;
  const same = battle.encounters.filter(
    (e) => e.sourceKey === entry.resourceKey && e.sourceIndex === String(entry.index)
  ).length;
  return same > 0 ? `${base} #${same + 1}` : base;
}

function getEncounterById(id) {
  return loadDmBattle().encounters.find((e) => e.id === id) ?? null;
}

function buildInitiativeEntries(battle) {
  const rows = [
    ...battle.party.map((p) => ({
      kind: "party",
      id: p.id,
      name: p.name,
      initiative: p.initiative,
      level: p.level,
      dead: false,
      downed: isPartyMemberDowned(p),
      imageUrl: "",
      inspiration: Boolean(p.inspiration),
      activeConditions: p.activeConditions || [],
      concentrationSpell: p.concentrationSpell || "",
    })),
    ...battle.encounters
      .filter((e) => !isEncounterDead(e))
      .map((e) => ({
        kind: "monster",
        id: e.id,
        name: e.label || e.sourceName,
        initiative: e.initiative,
        dead: false,
        imageUrl: encounterImageUrl(e),
        activeConditions: e.activeConditions || [],
      })),
  ];
  return sortByInitiativeDesc(rows, (r) => parseInitiativeValue(r.initiative));
}

function formatDamageResultText(rolls, mod) {
  const diceSum = rolls.reduce((s, r) => s + r.value, 0);
  const total = diceSum + mod;
  if (rolls.length <= 5) {
    const breakdown = rolls.map((r) => r.value).join(" + ");
    return mod === 0 ? `${breakdown} = ${total}` : `(${breakdown}) ${formatRollModifier(mod)} = ${total}`;
  }
  return mod === 0 ? `Total ${total} (${rolls.length}d)` : `Total ${total} (${rolls.length}d ${formatRollModifier(mod)})`;
}

function partyInitialLetter(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "?";
  return [...trimmed][0].toUpperCase();
}

function portraitHtml(imageUrl, alt, className = "dm-portrait-img") {
  if (imageUrl) {
    return `<img class="${className}" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt || "")}" loading="lazy" decoding="async" />`;
  }
  return `<span class="dm-portrait-placeholder" aria-hidden="true">?</span>`;
}

function captureEncounterUiState() {
  const open = new Map();
  document.querySelectorAll(".dm-encounter-card").forEach((card) => {
    const id = card.dataset.encId;
    if (!id) return;
    open.set(id, {
      meta: card.querySelector(".dm-encounter-meta")?.open ?? false,
      dice: card.querySelector(".dm-encounter-dice")?.open ?? false,
    });
  });
  return { open, focus: dmFocusedEncId };
}

function restoreEncounterUiState(state) {
  if (!state) return;
  state.open.forEach((flags, id) => {
    const card = document.getElementById(`enc-${id}`);
    if (!card) return;
    const meta = card.querySelector(".dm-encounter-meta");
    const dice = card.querySelector(".dm-encounter-dice");
    if (meta) meta.open = flags.meta;
    if (dice) dice.open = flags.dice;
  });
  if (state.focus) {
    const card = document.getElementById(`enc-${state.focus}`);
    card?.classList.add("is-focused");
  }
}

function encounterEntry(enc) {
  const fav = findFavorite(enc.sourceKey, enc.sourceIndex);
  const path = fav?.path || `/api/2014/monsters/${enc.sourceIndex}`;
  return {
    resourceKey: enc.sourceKey,
    index: enc.sourceIndex,
    name: enc.sourceName,
    path,
  };
}

function encounterImageUrl(enc) {
  const url = resolveEntryImageUrl({
    resourceKey: enc.sourceKey,
    index: enc.sourceIndex,
    imageUrl: enc.imageUrl,
  });
  return url || (enc.imageUrl?.includes("/api/images/") ? apiAssetUrl(enc.imageUrl) : "");
}

function monsterInfoPanelHtml(enc) {
  const fav = findFavorite(enc.sourceKey, enc.sourceIndex);
  const data = getCachedEntryData(fav);
  const table = formatMonsterBrief(data);
  const body = table
    ? `<table class="dm-info-table"><tbody>${table}</tbody></table>`
    : `<p class="dm-info-empty">Ainda não há dados em cache.</p>
       <button type="button" class="sheet-dice-btn sheet-dice-btn--compact" data-action="dm-fetch-info" data-enc-id="${escapeHtml(enc.id)}">Carregar da API</button>`;
  return `${body}
    <p class="dm-info-actions">
      <button type="button" class="dm-link-btn" data-action="dm-open-explorer" data-enc-id="${escapeHtml(enc.id)}">Abrir na exploração da API →</button>
    </p>`;
}

function initiativeCornerHtml(enc) {
  const settled = enc.initiative !== "" && enc.initiative != null;
  if (settled) {
    return `<div class="dm-encounter-init-corner dm-encounter-init-corner--settled">
      <span class="dm-init-corner-label">Inic.</span>
      <span class="dm-init-corner-display">${escapeHtml(enc.initiative)}</span>
      <button type="button" class="dm-init-reroll-btn" data-action="dm-reset-init" data-enc-id="${escapeHtml(enc.id)}" title="Rolar iniciativa de novo" aria-label="Rolar iniciativa de novo">↻</button>
    </div>`;
  }
  return `<div class="dm-encounter-init-corner">
    <span class="dm-init-corner-label">Inic.</span>
    <input
      type="number"
      class="sheet-number-input dm-init-corner-value"
      value=""
      data-field="initiative"
      placeholder="—"
      inputmode="numeric"
      aria-label="Iniciativa"
    />
    ${compactD20Block(enc, "initiative")}
  </div>`;
}

function renderMonsterLibrary() {
  if (!dmMonsterLibrary || !dmMonsterEmpty) return;
  const monsters = loadFavorites().filter((f) => f.resourceKey === "monsters");
  if (monsters.length === 0) {
    dmMonsterLibrary.innerHTML = "";
    dmMonsterEmpty.hidden = false;
    return;
  }
  dmMonsterEmpty.hidden = true;
  dmMonsterLibrary.innerHTML = monsters
    .map((entry) => {
      const img = resolveEntryImageUrl(entry);
      return `<li class="dm-monster-item">
        <div class="dm-monster-item-thumb">${portraitHtml(img, entry.name, "dm-monster-thumb-img")}</div>
        <span class="dm-monster-item-name">${escapeHtml(entry.name || entry.index)}</span>
        <button
          type="button"
          class="sheet-dice-btn sheet-dice-btn--compact"
          data-action="dm-add-monster"
          data-resource="${escapeHtml(entry.resourceKey)}"
          data-index="${escapeHtml(String(entry.index))}"
          data-name="${escapeHtml(entry.name || "")}"
          data-path="${escapeHtml(entry.path || "")}"
        >+ Mesa</button>
      </li>`;
    })
    .join("");
}

function initiativeOrderHtml(initValue) {
  const display =
    initValue !== "" && initValue != null ? escapeHtml(String(initValue)) : "—";
  return `<div class="dm-init-order" title="Ordem na iniciativa — valor maior age primeiro">
    <span class="dm-init-order-label">Iniciativa</span>
    <span class="dm-init-order-value" aria-hidden="true">${display}</span>
    <span class="visually-hidden">Iniciativa ${display}</span>
  </div>`;
}

function renderInitiative() {
  if (!dmInitiativeList || !dmInitEmpty) return;
  const battle = loadDmBattle();
  if (typeof ensureCombatTrack === "function") ensureCombatTrack(battle);
  if (typeof renderDmTurnToolbar === "function") renderDmTurnToolbar(battle);
  const activeTurnKey = battle.combat?.activeTurnKey || "";
  const rows = buildInitiativeEntries(battle);

  if (rows.length === 0) {
    dmInitiativeList.innerHTML = "";
    dmInitEmpty.hidden = false;
    return;
  }

  dmInitEmpty.hidden = true;
  dmInitiativeList.innerHTML = rows
    .map((row) => {
      const kindClass = row.kind === "party" ? "dm-init-row--party" : "dm-init-row--monster";
      const turnClass =
        activeTurnKey && dmTurnKey(row.kind, row.id) === activeTurnKey ? " dm-init-row--turn" : "";
      const deadClass = row.dead ? " is-dead" : row.downed ? " is-downed" : "";
      const dataAttr =
        row.kind === "party"
          ? `data-party-id="${escapeHtml(row.id)}"`
          : `data-enc-id="${escapeHtml(row.id)}" data-action="dm-focus-enc"`;

      const thumb =
        row.kind === "monster"
          ? `<span class="dm-init-thumb">${portraitHtml(row.imageUrl, row.name, "dm-init-thumb-img")}</span>`
          : `<span class="dm-init-kind" title="${escapeHtml(row.name)}">${escapeHtml(partyInitialLetter(row.name))}</span>`;

      const levelInput =
        row.kind === "party"
          ? `<label class="dm-init-field dm-init-field--level">
              <span class="dm-init-field-label">Nív.</span>
              <input type="number" class="sheet-number-input dm-init-level-input" value="${row.level}" data-field="level" min="1" max="20" inputmode="numeric" />
            </label>`
          : "";

      const initInput =
        row.kind === "party"
          ? `<label class="dm-init-field dm-init-field--init">
              <span class="dm-init-field-label">Inic.</span>
              <input type="number" class="sheet-number-input dm-init-input" value="${row.initiative !== "" ? escapeHtml(row.initiative) : ""}" data-field="initiative" placeholder="—" inputmode="numeric" />
            </label>`
          : "";

      const nameCell =
        row.kind === "party"
          ? `<input type="text" class="dm-init-name-input sheet-name-input" value="${escapeHtml(row.name)}" data-field="name" maxlength="120" aria-label="Nome" />`
          : `<button type="button" class="dm-init-name-btn" data-action="dm-focus-enc" data-enc-id="${escapeHtml(row.id)}">${escapeHtml(row.name)}</button>`;

      const partyActions =
        row.kind === "party"
          ? `<div class="dm-init-actions-wrap">
             <div class="dm-init-actions" role="group" aria-label="Sincronizar com a ficha">
               <button type="button" class="dm-sync-sheet-btn dm-btn-tip" data-action="dm-sync-from-sheet" data-party-id="${escapeHtml(row.id)}"
                 data-tip="Da ficha → mesa: nome, nível, XP, inspiração e condições"
                 title="Da ficha → mesa: nome, nível, XP, inspiração e condições"
                 aria-label="Sincronizar da ficha para a mesa">↓</button>
               <button type="button" class="dm-sync-sheet-btn dm-btn-tip" data-action="dm-push-to-sheet" data-party-id="${escapeHtml(row.id)}"
                 data-tip="Da mesa → ficha: nome, nível, XP, inspiração e condições"
                 title="Da mesa → ficha: nome, nível, XP, inspiração e condições"
                 aria-label="Enviar dados da mesa para a ficha">↑</button>
             </div>
             <div class="dm-init-danger" role="group" aria-label="Remover ou eliminar">
               <button type="button" class="sheet-portrait-clear dm-init-remove dm-btn-tip" data-action="dm-remove-party"
                 data-tip="Remover personagem da mesa"
                 title="Remover personagem da mesa"
                 aria-label="Remover personagem da mesa">×</button>
               <button type="button" class="dm-party-down-btn dm-btn-tip" data-action="dm-toggle-party-down" data-party-id="${escapeHtml(row.id)}"
                 data-tip="${row.downed ? "Restaurar personagem na iniciativa e no XP" : "Marcar eliminado (fora da divisão de XP da sessão)"}"
                 title="${row.downed ? "Restaurar personagem na iniciativa e no XP" : "Marcar eliminado (fora da divisão de XP da sessão)"}"
                 aria-label="${row.downed ? "Restaurar personagem" : "Marcar como eliminado"}"
                 aria-pressed="${row.downed ? "true" : "false"}">${row.downed ? "↩" : "☠"}</button>
             </div>
           </div>`
          : "";

      const identityBlock = `<div class="dm-init-identity">
        ${thumb}
        <div class="dm-init-body">${nameCell}</div>
      </div>`;

      const statsBlock =
        row.kind === "party" ? `<div class="dm-init-stats">${levelInput}${initInput}</div>` : "";

      const combatBar =
        typeof renderDmInitCombatBar === "function"
          ? renderDmInitCombatBar(row)
          : typeof renderDmPartyCombatBar === "function" && row.kind === "party"
            ? renderDmPartyCombatBar(row)
            : "";

      return `<li class="dm-init-row ${kindClass}${turnClass}${deadClass}" ${dataAttr}>
        ${initiativeOrderHtml(row.initiative)}
        <span class="dm-init-gap" aria-hidden="true"></span>
        ${identityBlock}
        ${statsBlock}
        ${partyActions}
        ${combatBar}
      </li>`;
    })
    .join("");
}

function killerFieldHtml(enc, party) {
  const killers = filterKilledByForXp(enc.killedBy, party);
  const eligible = activePartyMembers(party);
  const xp = Number(enc.xp) || 0;
  const share = killers.length && xp ? Math.floor(xp / killers.length) : 0;
  const xpLegend =
    xp > 0
      ? killers.length
        ? ` · ${xp} XP (${share} cada)`
        : ` · ${xp} XP`
      : "";

  const checks =
    eligible.length > 0
      ? eligible
          .map((p) => {
            const on = killers.includes(p.id);
            return `<label class="dm-killer-check">
              <input type="checkbox" data-action="dm-toggle-killer" data-enc-id="${escapeHtml(enc.id)}" data-party-id="${escapeHtml(p.id)}"${on ? " checked" : ""} />
              <span>${escapeHtml(p.name)}</span>
            </label>`;
          })
          .join("")
      : `<p class="dm-info-empty">Adiciona personagens vivos em combate.</p>`;

  return `<fieldset class="dm-killer-field">
    <legend class="sheet-name-label">Eliminado por${escapeHtml(xpLegend)}</legend>
    <div class="dm-killer-checks">${checks}</div>
  </fieldset>`;
}

function compactD20Block(enc, kind) {
  const modField = kind === "action" ? "actionMod" : "initiativeMod";
  const mod = enc[modField] ?? "0";
  const title = kind === "action" ? "Ação" : "Inic.";
  const showResult = kind !== "initiative";
  return `<div class="dm-compact-dice dm-compact-d20" data-enc-id="${escapeHtml(enc.id)}" data-d20-kind="${kind}">
    <span class="dm-compact-label">${title}</span>
    <div class="dm-compact-d20-arena" data-d20-arena>
      <div class="sheet-d20-stage dm-compact-d20-stage" role="status" aria-live="polite">
        <span class="sheet-d20-glow" aria-hidden="true"></span>
        <span class="sheet-d20-face" data-d20-face>—</span>
      </div>
    </div>
    <input
      type="number"
      class="sheet-number-input dm-compact-mod-input"
      value="${escapeHtml(mod)}"
      data-field="${modField}"
      min="-20"
      max="20"
      step="1"
      inputmode="numeric"
      aria-label="Modificador ${title}"
    />
    <button type="button" class="sheet-dice-btn sheet-dice-btn--compact sheet-dice-btn--d20" data-action="dm-roll-d20" data-d20-kind="${kind}">
      Rolar
    </button>
    ${showResult ? '<span class="dm-compact-result" data-d20-result aria-live="polite"></span>' : ""}
  </div>`;
}

function compactDamageBlock(enc) {
  const pool = enc.damageRoll?.pool ?? [];
  const mod = enc.damageRoll?.modifier ?? "0";
  const diceHtml =
    pool.length === 0
      ? `<p class="dm-dmg-empty">Sem dados</p>`
      : pool
          .map(
            (die) => `<button type="button" class="sheet-dmg-die sheet-dmg-die--d${die.sides} dm-compact-dmg-die"
              data-action="dm-remove-dmg" data-die-id="${escapeHtml(die.id)}" data-sides="${die.sides}"
              title="Remover d${die.sides}">
              <span class="sheet-dmg-die-shell" aria-hidden="true">
                <span class="sheet-dmg-die-shine"></span>
                <span class="sheet-dmg-die-facet"></span>
              </span>
              <span class="sheet-dmg-die-face">—</span>
              <span class="sheet-dmg-die-label">d${die.sides}</span>
            </button>`
          )
          .join("");

  const palette = DAMAGE_DIE_SIDES.map(
    (s) => `<button type="button" class="sheet-dmg-add-btn sheet-dmg-add-btn--d${s} dm-compact-dmg-add"
      data-action="dm-add-dmg" data-sides="${s}" title="Adicionar d${s}">
      <span class="sheet-dmg-add-icon sheet-dmg-add-icon--d${s}" aria-hidden="true"></span>
    </button>`
  ).join("");

  return `<div class="dm-compact-dice dm-compact-damage" data-enc-id="${escapeHtml(enc.id)}">
    <span class="dm-compact-label">Dano</span>
    <div class="dm-compact-dmg-palette" aria-label="Adicionar dados">${palette}</div>
    <p class="dm-compact-formula" data-dmg-formula>${escapeHtml(formatDamageFormula(pool, Number(mod)))}</p>
    <div class="dm-compact-dmg-arena" data-dmg-arena>${diceHtml}</div>
    <div class="dm-compact-dmg-footer">
      <input
        type="number"
        class="sheet-number-input dm-compact-mod-input"
        value="${escapeHtml(mod)}"
        data-field="damageModifier"
        min="-99"
        max="99"
        step="1"
        inputmode="numeric"
        aria-label="Modificador de dano"
      />
      <button type="button" class="sheet-dice-btn sheet-dice-btn--compact sheet-dice-btn--dmg" data-action="dm-roll-damage"${
        pool.length ? "" : " disabled"
      }>Rolar</button>
    </div>
    <p class="dm-compact-result dm-compact-result--block" data-dmg-result aria-live="polite"></p>
  </div>`;
}

function renderEncounters() {
  if (!dmEncounterList || !dmEncounterEmpty) return;
  const battle = loadDmBattle();
  const party = battle.party;
  const encounters = battle.encounters;
  const alive = encounters.filter((e) => !isEncounterDead(e));
  const deadEnc = encounters.filter((e) => isEncounterDead(e));

  if (encounters.length === 0) {
    dmEncounterList.innerHTML = "";
    dmEncounterEmpty.hidden = false;
    if (dmEncounterDeadWrap) dmEncounterDeadWrap.hidden = true;
    if (dmEncounterDeadList) dmEncounterDeadList.innerHTML = "";
    return;
  }

  dmEncounterEmpty.hidden = encounters.length > 0;
  dmEncounterList.innerHTML = alive
    .map((enc) => {
      const dead = isEncounterDead(enc);
      const danger = encounterDangerClass(enc);
      const focused = dmFocusedEncId === enc.id ? " is-focused" : "";
      const img = encounterImageUrl(enc);
      const xp = Number(enc.xp) || 0;
      const dangerStyle = encounterDangerStyle(enc);
      return `<article class="dm-encounter-card ${danger}${focused}" id="enc-${escapeHtml(enc.id)}" data-enc-id="${escapeHtml(enc.id)}" style="${dangerStyle}">
        <div class="dm-encounter-top">
          <div class="dm-encounter-portrait">${portraitHtml(img, enc.label)}</div>
          <div class="dm-encounter-main">
            <div class="dm-encounter-title-row">
              <input type="text" class="sheet-name-input dm-encounter-label" value="${escapeHtml(enc.label)}" data-field="label" maxlength="120" aria-label="Identificador" />
              ${xp ? `<span class="dm-enc-xp-badge" title="Experiência">${xp} XP</span>` : ""}
            </div>
            <div class="dm-encounter-hp">
              <label class="dm-hp-chip dm-hp-chip--current">
                <span class="dm-hp-chip-label">Atual</span>
                <input type="number" class="sheet-number-input dm-hp-input--current${dead ? " dm-hp-dead" : ""}" value="${escapeHtml(enc.hpCurrent)}" data-field="hpCurrent" min="0" max="9999" inputmode="numeric" />
              </label>
              <label class="dm-hp-chip dm-hp-chip--max">
                <span class="dm-hp-chip-label">Máx</span>
                <input type="number" class="sheet-number-input dm-hp-input--max" value="${escapeHtml(enc.hpMax)}" data-field="hpMax" min="0" max="9999" inputmode="numeric" />
              </label>
            </div>
          </div>
          ${initiativeCornerHtml(enc)}
          <button type="button" class="sheet-portrait-clear dm-encounter-remove" data-action="dm-remove-enc" title="Remover da mesa">×</button>
        </div>
        <details class="dm-encounter-meta">
          <summary class="dm-encounter-meta-summary">Informações do monstro</summary>
          <div class="dm-encounter-meta-body">${monsterInfoPanelHtml(enc)}</div>
        </details>
        <details class="dm-encounter-dice">
          <summary class="dm-encounter-dice-summary">Dados e ações</summary>
          <div class="dm-encounter-dice-inner">
            <div class="dm-encounter-dice-row">
              ${compactD20Block(enc, "action")}
            </div>
            ${compactDamageBlock(enc)}
          </div>
        </details>
      </article>`;
    })
    .join("");

  if (dmEncounterDeadWrap && dmEncounterDeadList) {
    dmEncounterDeadWrap.hidden = deadEnc.length === 0;
    dmEncounterDeadList.innerHTML = deadEnc
      .map((enc) => {
        const danger = "is-dead";
        const focused = dmFocusedEncId === enc.id ? " is-focused" : "";
        const img = encounterImageUrl(enc);
        const xp = Number(enc.xp) || 0;
        const dangerStyle = encounterDangerStyle(enc);
        return `<article class="dm-encounter-card ${danger}${focused}" id="enc-${escapeHtml(enc.id)}" data-enc-id="${escapeHtml(enc.id)}" style="${dangerStyle}">
        <div class="dm-encounter-top">
          <div class="dm-encounter-portrait">${portraitHtml(img, enc.label)}</div>
          <div class="dm-encounter-main">
            <div class="dm-encounter-title-row">
              <input type="text" class="sheet-name-input dm-encounter-label" value="${escapeHtml(enc.label)}" data-field="label" maxlength="120" aria-label="Identificador" />
              ${xp ? `<span class="dm-enc-xp-badge" title="Experiência">${xp} XP</span>` : ""}
            </div>
            <div class="dm-encounter-hp">
              <label class="dm-hp-chip dm-hp-chip--current">
                <span class="dm-hp-chip-label">Atual</span>
                <input type="number" class="sheet-number-input dm-hp-input--current dm-hp-dead" value="${escapeHtml(enc.hpCurrent)}" data-field="hpCurrent" min="0" max="9999" inputmode="numeric" />
              </label>
              <label class="dm-hp-chip dm-hp-chip--max">
                <span class="dm-hp-chip-label">Máx</span>
                <input type="number" class="sheet-number-input dm-hp-input--max" value="${escapeHtml(enc.hpMax)}" data-field="hpMax" min="0" max="9999" inputmode="numeric" />
              </label>
            </div>
          </div>
          ${initiativeCornerHtml(enc)}
          <button type="button" class="sheet-portrait-clear dm-encounter-remove" data-action="dm-remove-enc" title="Remover da mesa">×</button>
        </div>
        <section class="dm-encounter-killer">${killerFieldHtml(enc, party)}</section>
        <details class="dm-encounter-meta">
          <summary class="dm-encounter-meta-summary">Informações do monstro</summary>
          <div class="dm-encounter-meta-body">${monsterInfoPanelHtml(enc)}</div>
        </details>
      </article>`;
      })
      .join("");
  }
}

function renderAll() {
  const encUi = captureEncounterUiState();
  renderCampaignUi();
  renderMonsterLibrary();
  renderInitiative();
  renderEncounterDifficulty();
  renderEncounters();
  restoreEncounterUiState(encUi);
  renderXpSidebar();
  renderSessionHistory();
  if (typeof renderDmSnapshotsList === "function") renderDmSnapshotsList();
}

function refreshEncountersUi() {
  const encUi = captureEncounterUiState();
  renderInitiative();
  renderEncounterDifficulty();
  renderEncounters();
  restoreEncounterUiState(encUi);
  renderXpSidebar();
}

function focusEncounter(encId) {
  dmFocusedEncId = encId;
  const encUi = captureEncounterUiState();
  renderEncounters();
  restoreEncounterUiState(encUi);
  const el = document.getElementById(`enc-${encId}`);
  el?.classList.add("is-focused");
  el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  el?.querySelector(".dm-encounter-dice")?.setAttribute("open", "");
}

function addPartyMember(name, initiative, level) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return;
  patchBattle((battle) => {
    battle.party.push({
      id: newEntityId("party"),
      name: trimmed,
      initiative: initiative != null && initiative !== "" ? String(initiative) : "",
      level: clampCharacterLevel(level),
      downed: false,
    });
  });
}

function removePartyMember(id) {
  patchBattle((battle) => {
    battle.party = battle.party.filter((p) => p.id !== id);
    for (const enc of battle.encounters) {
      enc.killedBy = normalizeKilledBy(enc.killedBy).filter((kid) => kid !== id);
    }
  });
}

function togglePartyMemberDowned(id) {
  patchBattle((battle) => {
    const p = battle.party.find((x) => x.id === id);
    if (!p) return;
    p.downed = !p.downed;
    if (p.downed) {
      for (const enc of battle.encounters) {
        enc.killedBy = normalizeKilledBy(enc.killedBy).filter((kid) => kid !== id);
      }
    }
  });
}

function updatePartyField(id, field, value) {
  mutateBattle((battle) => {
    const p = battle.party.find((x) => x.id === id);
    if (!p) return;
    if (field === "name") {
      const v = String(value || "").trim();
      if (v) p.name = v.slice(0, 120);
    } else if (field === "initiative") {
      p.initiative = value != null && value !== "" ? String(value) : "";
    } else if (field === "level") {
      p.level = clampCharacterLevel(value);
    }
  });
  scheduleRender();
}

async function addMonsterToTable(entry) {
  let hp = 10;
  let xp = 0;
  let imageUrl = resolveEntryImageUrl(entry);
  const cached = getCachedEntryData(entry);
  if (cached) {
    hp = monsterHpFromApiData(cached);
    xp = monsterXpFromApiData(cached);
    if (cached.image) {
      imageUrl =
        (await ensureMonsterImageCached(entry.resourceKey, entry.index, cached.image)) ||
        entryImageUrl(cached);
    }
  } else if (entry.path) {
    try {
      const res = await apiFetch(entry.path);
      if (res.ok) {
        const data = await res.json();
        updateFavoriteCache(entry.resourceKey, entry.index, data);
        hp = monsterHpFromApiData(data);
        xp = monsterXpFromApiData(data);
        imageUrl = data.image
          ? (await ensureMonsterImageCached(entry.resourceKey, entry.index, data.image)) ||
            entryImageUrl(data)
          : imageUrl;
      }
    } catch {
      /* ignore */
    }
  }

  const battle = loadDmBattle();
  const label = encounterLabelFor(entry, battle);
  const newId = newEntityId("enc");

  patchBattle((b) => {
    b.encounters.push({
      id: newId,
      sourceKey: entry.resourceKey,
      sourceIndex: String(entry.index),
      sourceName: entry.name || entry.index,
      label,
      hpMax: String(hp),
      hpCurrent: String(hp),
      initiative: "",
      initiativeMod: "0",
      actionMod: "0",
      damageRoll: { modifier: "0", pool: [] },
      killedBy: [],
      xp,
      imageUrl,
    });
  });
  focusEncounter(newId);
}

function removeEncounter(id) {
  if (dmFocusedEncId === id) dmFocusedEncId = null;
  patchBattle((battle) => {
    battle.encounters = battle.encounters.filter((e) => e.id !== id);
  });
}

function updateEncounterField(id, field, value, { render = false } = {}) {
  const encBefore = field === "hpCurrent" || field === "hpMax" ? getEncounterById(id) : null;
  const deadBefore = encBefore ? isEncounterDead(encBefore) : false;

  mutateBattle((battle) => {
    const enc = battle.encounters.find((e) => e.id === id);
    if (!enc) return;

    if (field === "label") {
      const v = String(value || "").trim();
      if (v) enc.label = v.slice(0, 120);
    } else if (field === "hpMax" || field === "hpCurrent" || field === "initiative") {
      enc[field] = value != null && value !== "" ? String(value) : field === "initiative" ? "" : "0";
      if (field === "hpCurrent" && Number(enc.hpCurrent) > 0) enc.killedBy = [];
    } else if (field === "initiativeMod" || field === "actionMod") {
      enc[field] = String(clampInt(value, -20, 20, 0));
    } else if (field === "damageModifier") {
      if (!enc.damageRoll) enc.damageRoll = { modifier: "0", pool: [] };
      enc.damageRoll.modifier = String(clampInt(value, -99, 99, 0));
    }
  });

  if (field === "hpCurrent" || field === "hpMax") {
    const enc = getEncounterById(id);
    if (!enc) return;
    const deadAfter = isEncounterDead(enc);
    if (deadBefore !== deadAfter) {
      refreshEncountersUi();
      return;
    }
    syncEncounterCardVisuals(enc);
    renderInitiative();
    renderXpSidebar();
    return;
  }

  if (render) renderAll();
  else if (
    field === "damageModifier" ||
    field === "initiativeMod" ||
    field === "actionMod"
  ) {
    refreshEncountersUi();
  } else scheduleRender();
}

function addEncounterDamageDie(encId, sides) {
  const n = Number(sides);
  if (!DAMAGE_DIE_SIDES.includes(n)) return;
  mutateBattle((battle) => {
    const enc = battle.encounters.find((e) => e.id === encId);
    if (!enc) return;
    if (!enc.damageRoll) enc.damageRoll = { modifier: "0", pool: [] };
    if (enc.damageRoll.pool.length >= MAX_DAMAGE_DICE) return;
    enc.damageRoll.pool.push({ id: newDamageDieId(), sides: n });
  });
  refreshEncountersUi();
}

function removeEncounterDamageDie(encId, dieId) {
  mutateBattle((battle) => {
    const enc = battle.encounters.find((e) => e.id === encId);
    if (!enc?.damageRoll?.pool) return;
    enc.damageRoll.pool = enc.damageRoll.pool.filter((d) => d.id !== dieId);
  });
  refreshEncountersUi();
}

function setD20Face(stage, value) {
  const face = stage?.querySelector("[data-d20-face]");
  if (face) face.textContent = String(value);
}

function setDamageDieFace(el, value) {
  const face = el?.querySelector(".sheet-dmg-die-face");
  if (face) face.textContent = String(value);
}

async function animateCompactD20(card, finalNatural, mod) {
  const stage = card?.querySelector(".sheet-d20-stage");
  const resultEl = card?.querySelector("[data-d20-result]");
  if (!stage) return;

  stage.classList.add("is-rolling");
  const settleAt = DM_D20_TICK_MS.length - 2;

  for (let i = 0; i < DM_D20_TICK_MS.length; i++) {
    const value = i >= settleAt ? finalNatural : rollDie(20);
    setD20Face(stage, value);
    if (i === Math.floor(DM_D20_TICK_MS.length * 0.55)) stage.classList.add("is-slowing");
    await delay(DM_D20_TICK_MS[i]);
  }

  stage.classList.remove("is-rolling", "is-slowing");
  stage.classList.add("is-landed");
  if (finalNatural === 20) stage.classList.add("is-crit");
  else if (finalNatural === 1) stage.classList.add("is-fumble");

  const total = finalNatural + mod;
  if (resultEl) {
    resultEl.textContent = `${finalNatural} ${formatRollModifier(mod)} = ${total}`;
  }

  await delay(400);
  stage.classList.remove("is-landed", "is-crit", "is-fumble");
  return total;
}

async function rollEncounterD20(encId, kind) {
  const lockKey = `d20-${encId}-${kind}`;
  if (dmRollLocks.has(lockKey)) return;
  dmRollLocks.add(lockKey);

  const enc = getEncounterById(encId);
  const card = document.querySelector(
    `.dm-encounter-card[data-enc-id="${encId}"] .dm-compact-d20[data-d20-kind="${kind}"]`
  );
  if (!enc || !card) {
    dmRollLocks.delete(lockKey);
    return;
  }

  const modField = kind === "action" ? "actionMod" : "initiativeMod";
  const mod = clampInt(card.querySelector(`[data-field="${modField}"]`)?.value ?? enc[modField], -20, 20, 0);
  const natural = rollDie(20);

  try {
    const total = await animateCompactD20(card, natural, mod);
    if (kind === "initiative") {
      mutateBattle((battle) => {
        const e = battle.encounters.find((x) => x.id === encId);
        if (e) e.initiative = String(total);
      });
      const initInput = document.querySelector(
        `.dm-encounter-card[data-enc-id="${encId}"] [data-field="initiative"]`
      );
      if (initInput) initInput.value = String(total);
      scheduleRender();
    }
  } finally {
    dmRollLocks.delete(lockKey);
  }
}

async function rollEncounterDamage(encId) {
  const lockKey = `dmg-${encId}`;
  if (dmRollLocks.has(lockKey)) return;

  const enc = getEncounterById(encId);
  if (!enc?.damageRoll?.pool?.length) return;

  dmRollLocks.add(lockKey);
  const card = document.querySelector(`.dm-compact-damage[data-enc-id="${encId}"]`);
  const diceEls = [...(card?.querySelectorAll(".dm-compact-dmg-die") ?? [])];
  const mod = clampInt(
    card?.querySelector('[data-field="damageModifier"]')?.value ?? enc.damageRoll.modifier,
    -99,
    99,
    0
  );
  const pool = enc.damageRoll.pool;
  const rolls = pool.map((die) => ({ sides: die.sides, value: rollDie(die.sides) }));

  try {
    diceEls.forEach((el) => el.classList.add("is-rolling"));
    const settleAt = DM_DAMAGE_TICK_MS.length - 2;
    for (let i = 0; i < DM_DAMAGE_TICK_MS.length; i++) {
      diceEls.forEach((el, idx) => {
        const sides = rolls[idx]?.sides ?? 6;
        const value = i >= settleAt ? rolls[idx].value : rollDie(sides);
        setDamageDieFace(el, value);
      });
      await delay(DM_DAMAGE_TICK_MS[i]);
    }
    diceEls.forEach((el) => {
      el.classList.remove("is-rolling");
      el.classList.add("is-landed");
    });

    const resultEl = card?.querySelector("[data-dmg-result]");
    if (resultEl) {
      resultEl.textContent = formatDamageResultText(rolls, mod);
    }
    await delay(350);
    diceEls.forEach((el) => el.classList.remove("is-landed"));
  } finally {
    dmRollLocks.delete(lockKey);
  }
}

function onPartyFormSubmit(e) {
  e.preventDefault();
  const name = dmPartyNameInput?.value;
  const init = dmPartyInitInput?.value;
  const level = dmPartyLevelInput?.value;
  addPartyMember(name, init, level);
  if (dmPartyNameInput) dmPartyNameInput.value = "";
  if (dmPartyInitInput) dmPartyInitInput.value = "";
  if (dmPartyLevelInput) dmPartyLevelInput.value = "1";
  dmPartyNameInput?.focus();
}

function handleDocumentClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  if (typeof handleDmCombatSyncAction === "function" && handleDmCombatSyncAction(action, btn)) {
    return;
  }

  if (typeof handleDmV32Action === "function" && handleDmV32Action(action, btn)) {
    return;
  }

  if (
    action === "dm-add-dmg" ||
    action === "dm-remove-dmg" ||
    btn.closest(".dm-compact-damage") ||
    btn.closest(".dm-compact-d20")
  ) {
    e.stopPropagation();
  }

  if (action === "dm-export-campaign") {
    exportCampaignJson();
    return;
  }

  if (action === "dm-apply-session-xp") {
    applySessionXpToParty();
    return;
  }

  if (action === "dm-sync-from-sheet") {
    const partyId = btn.dataset.partyId;
    if (partyId) pullPartyMemberFromSheet(partyId);
    return;
  }

  if (action === "dm-push-to-sheet") {
    const partyId = btn.dataset.partyId;
    if (partyId) pushPartyMemberToSheet(partyId);
    return;
  }

  if (action === "dm-sync-all-from-sheet") {
    syncAllPartyFromSheet();
    return;
  }

  if (action === "dm-clear-session-history") {
    if (window.confirm("Apagar todo o histórico de sessões?")) {
      clearSessionHistory();
      renderSessionHistory();
      setCampaignStatus("Histórico limpo.");
    }
    return;
  }

  if (action === "dm-explore-monsters") {
    e.preventDefault();
    openMonstersInExplorer();
    return;
  }

  if (action === "dm-add-monster") {
    addMonsterToTable({
      resourceKey: btn.dataset.resource,
      index: btn.dataset.index,
      name: btn.dataset.name,
      path: btn.dataset.path,
    });
    return;
  }

  if (action === "dm-focus-enc") {
    const id = btn.dataset.encId || btn.closest("[data-enc-id]")?.dataset.encId;
    if (id) focusEncounter(id);
    return;
  }

  if (action === "dm-remove-party") {
    const row = btn.closest("[data-party-id]");
    if (row) removePartyMember(row.dataset.partyId);
    return;
  }

  if (action === "dm-toggle-party-down") {
    const partyId = btn.dataset.partyId || btn.closest("[data-party-id]")?.dataset.partyId;
    if (partyId) togglePartyMemberDowned(partyId);
    return;
  }

  if (action === "dm-remove-enc") {
    const card = btn.closest("[data-enc-id]");
    if (card) removeEncounter(card.dataset.encId);
    return;
  }

  if (action === "dm-reset-init") {
    resetEncounterInitiative(btn.dataset.encId);
    return;
  }

  if (action === "dm-open-explorer") {
    openEncounterInExplorer(btn.dataset.encId);
    return;
  }

  if (action === "dm-fetch-info") {
    fetchEncounterInfo(btn.dataset.encId);
    return;
  }

  if (action === "dm-roll-d20") {
    const block = btn.closest(".dm-compact-d20");
    if (block) rollEncounterD20(block.dataset.encId, block.dataset.d20Kind);
    return;
  }

  if (action === "dm-roll-damage") {
    const block = btn.closest(".dm-compact-damage");
    if (block) rollEncounterDamage(block.dataset.encId);
    return;
  }

  if (action === "dm-add-dmg") {
    const block = btn.closest(".dm-compact-damage");
    if (block) addEncounterDamageDie(block.dataset.encId, btn.dataset.sides);
    return;
  }

  if (action === "dm-remove-dmg") {
    const block = btn.closest(".dm-compact-damage");
    if (block) removeEncounterDamageDie(block.dataset.encId, btn.dataset.dieId);
    return;
  }
}

function handleDocumentChange(e) {
  const killerToggle = e.target.closest("[data-action='dm-toggle-killer']");
  if (killerToggle) {
    toggleEncounterKiller(killerToggle.dataset.encId, killerToggle.dataset.partyId, killerToggle.checked);
  }
}

function handleDocumentInput(e) {
  const el = e.target;
  const field = el.dataset?.field;
  if (!field) return;

  const partyRow = el.closest("[data-party-id]");
  if (partyRow) {
    updatePartyField(partyRow.dataset.partyId, field, el.value);
    return;
  }

  const encCard = el.closest("[data-enc-id]");
  if (encCard) {
    updateEncounterField(encCard.dataset.encId, field, el.value);
  }
}

function backfillEncounterMeta() {
  mutateBattle((battle) => {
    for (const enc of battle.encounters) {
      const fav = findFavorite(enc.sourceKey, enc.sourceIndex);
      const data = getCachedEntryData(fav);
      if (data) {
        if (!enc.xp) enc.xp = monsterXpFromApiData(data);
      }
      const url = encounterImageUrl(enc);
      if (url) enc.imageUrl = url;
      enc.killedBy = normalizeKilledBy(enc.killedBy);
    }
  });
}

function toggleEncounterKiller(encId, partyId, checked) {
  mutateBattle((battle) => {
    const enc = battle.encounters.find((e) => e.id === encId);
    if (!enc || !isEncounterDead(enc)) return;
    const member = battle.party.find((p) => p.id === partyId);
    if (!member || isPartyMemberDowned(member)) return;
    let killers = normalizeKilledBy(enc.killedBy);
    if (checked) {
      if (!killers.includes(partyId)) killers.push(partyId);
    } else {
      killers = killers.filter((id) => id !== partyId);
    }
    enc.killedBy = killers;
  });
  refreshEncountersUi();
}

async function fetchEncounterInfo(encId) {
  const enc = getEncounterById(encId);
  if (!enc) return;
  const entry = encounterEntry(enc);
  const path = entry.path;
  if (!path) return;
  try {
    const res = await apiFetch(path);
    if (!res.ok) return;
    const data = await res.json();
    updateFavoriteCache(enc.sourceKey, enc.sourceIndex, data);
    const img = data.image
      ? await ensureMonsterImageCached(enc.sourceKey, enc.sourceIndex, data.image)
      : "";
    mutateBattle((battle) => {
      const e = battle.encounters.find((x) => x.id === encId);
      if (e) {
        e.imageUrl = img || entryImageUrl(data);
        e.xp = monsterXpFromApiData(data);
      }
    });
    renderAll();
  } catch {
    /* ignore */
  }
}

function openEncounterInExplorer(encId) {
  const enc = getEncounterById(encId);
  if (!enc) return;
  openEntryInExplorer(encounterEntry(enc));
}

function resetEncounterInitiative(encId) {
  patchBattle((battle) => {
    const enc = battle.encounters.find((e) => e.id === encId);
    if (enc) enc.initiative = "";
  });
}

async function warmFavoriteMonsterImages() {
  const monsters = loadFavorites().filter((f) => f.resourceKey === "monsters");
  await Promise.all(
    monsters.map(async (entry) => {
      const data = getCachedEntryData(entry);
      if (data?.image) {
        await ensureMonsterImageCached(entry.resourceKey, entry.index, data.image);
      }
    })
  );
}

function initDmPage() {
  if (isDmFirstVisit()) {
    markDmPageVisited();
    openMonstersInExplorer();
    return;
  }

  populateLocalesDropdown(localeSelect, {
    onChange: () => renderMonsterLibrary(),
  });

  backfillEncounterMeta();

  dmPartyForm?.addEventListener("submit", onPartyFormSubmit);
  dmCampaignNameInput?.addEventListener("change", () => {
    saveCampaign({ name: dmCampaignNameInput.value });
    setCampaignStatus("Nome da campanha guardado.");
  });
  dmCampaignNameInput?.addEventListener("blur", () => {
    saveCampaign({ name: dmCampaignNameInput.value });
  });
  dmCampaignImportInput?.addEventListener("change", () => {
    const file = dmCampaignImportInput.files?.[0];
    void importCampaignJsonFile(file);
    dmCampaignImportInput.value = "";
  });
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("change", handleDocumentChange);
  document.addEventListener("input", handleDocumentInput);

  renderXpPhbReferenceTable();
  if (typeof initDmV32 === "function") initDmV32();
  if (typeof initCampaignPicker === "function") initCampaignPicker("dmCampaignPicker");
  renderAll();
  void warmFavoriteMonsterImages().then(() => {
    backfillEncounterMeta();
    renderMonsterLibrary();
    refreshEncountersUi();
  });
}

initDmPage();

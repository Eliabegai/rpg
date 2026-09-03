/**
 * v3.3 — Assistente PHB: raça → classe → antecedente → equipamento → atributos → magias.
 */
const WIZARD_STEPS = [
  { id: "race", title: "Raça", hint: "Escolhe a raça ou sub-raça do personagem." },
  { id: "class", title: "Classe", hint: "Define a classe de 1.º nível." },
  { id: "background", title: "Antecedente", hint: "Antecedente PHB (traços, perícias, equipamento) — opcional." },
  { id: "equipment", title: "Equipamento", hint: "Importa o pacote inicial da classe e antecedente." },
  { id: "abilities", title: "Atributos", hint: "Array padrão, rolagem 4d6 no wizard ou mantém valores atuais; os bónus raciais somam no fim." },
  { id: "spells", title: "Magias", hint: "Conjuradores: importa magias dos favoritos ou da biblioteca." },
];

const creationWizardDialog = document.getElementById("creationWizardDialog");
const creationWizardBody = document.getElementById("creationWizardBody");
const creationWizardTitle = document.getElementById("creationWizardTitle");
const creationWizardStepLabel = document.getElementById("creationWizardStepLabel");
const creationWizardBackBtn = document.getElementById("creationWizardBackBtn");
const creationWizardNextBtn = document.getElementById("creationWizardNextBtn");
const creationWizardFinishBtn = document.getElementById("creationWizardFinishBtn");
const creationWizardStatus = document.getElementById("creationWizardStatus");

const wizardState = {
  step: 0,
  characterName: "",
  race: null,
  subrace: null,
  classEntry: null,
  background: null,
  raceData: null,
  classData: null,
  backgroundData: null,
  importEquipment: true,
  applyBackgroundPersonality: true,
  abilityMethod: "standard",
  standardAssignment: {},
  rolledAbilitySets: [],
  rolledAssignment: {},
  importSpells: false,
  lists: { races: [], subraces: [], classes: [], backgrounds: [] },
};

function setWizardStatus(msg, isError = false) {
  if (!creationWizardStatus) return;
  creationWizardStatus.textContent = msg || "";
  creationWizardStatus.classList.toggle("is-error", isError);
}

function currentWizardStep() {
  return WIZARD_STEPS[wizardState.step] || WIZARD_STEPS[0];
}

function selectedRaceEntry() {
  return wizardState.subrace || wizardState.race;
}

function updateWizardNav() {
  const step = currentWizardStep();
  if (creationWizardTitle) creationWizardTitle.textContent = `Criar personagem — ${step.title}`;
  if (creationWizardStepLabel) {
    creationWizardStepLabel.textContent = `Passo ${wizardState.step + 1} de ${WIZARD_STEPS.length}`;
  }
  if (creationWizardBackBtn) creationWizardBackBtn.disabled = wizardState.step === 0;
  if (creationWizardNextBtn) creationWizardNextBtn.hidden = wizardState.step >= WIZARD_STEPS.length - 1;
  if (creationWizardFinishBtn) creationWizardFinishBtn.hidden = wizardState.step < WIZARD_STEPS.length - 1;
}

function renderWizardPickList(items, selectedIndex, fieldName, resourceKey) {
  if (!items.length) {
    return '<p class="creation-wizard-muted">A carregar lista da API…</p>';
  }
  return `<ul class="creation-wizard-list" role="listbox" aria-label="${escapeHtml(fieldName)}">
    ${items
      .map(
        (item) => `<li>
      <label class="creation-wizard-option">
        <input type="radio" name="${escapeHtml(fieldName)}" value="${escapeHtml(item.index)}" data-resource="${escapeHtml(resourceKey)}"${selectedIndex === item.index ? " checked" : ""} />
        <span class="creation-wizard-option-label">${escapeHtml(item.name)}</span>
      </label>
    </li>`
      )
      .join("")}
  </ul>`;
}

async function ensureWizardLists() {
  const need = ["races", "classes", "backgrounds"];
  for (const key of need) {
    if (!wizardState.lists[key]?.length) {
      wizardState.lists[key] = await fetchWizardResourceList(key);
    }
  }
  if (!wizardState.lists.subraces?.length) {
    wizardState.lists.subraces = await fetchWizardResourceList("subraces");
  }
}

async function renderWizardStep() {
  if (!creationWizardBody) return;
  updateWizardNav();
  const step = currentWizardStep();
  setWizardStatus("");
  creationWizardBody.innerHTML = `<p class="creation-wizard-hint">${escapeHtml(step.hint)}</p><p class="creation-wizard-loading">A carregar…</p>`;

  await ensureWizardLists();

  if (step.id === "race") {
    const nameVal = escapeHtml(wizardState.characterName || loadSheet().characterName || "");
    creationWizardBody.innerHTML = `
      <p class="creation-wizard-hint">${escapeHtml(step.hint)}</p>
      <label class="sheet-inline-field creation-wizard-name-field">
        <span class="sheet-name-label">Nome do personagem</span>
        <input type="text" id="wizardCharacterName" class="sheet-name-input" maxlength="120" value="${nameVal}" placeholder="Ex.: Aelindra" />
      </label>
      <h3 class="creation-wizard-subtitle">Raça</h3>
      ${renderWizardPickList(wizardState.lists.races, wizardState.race?.index, "wizard-race", "races")}
      <h3 class="creation-wizard-subtitle">Sub-raça (opcional)</h3>
      ${renderWizardPickList(
        [{ index: "", name: "— Nenhuma —" }, ...wizardState.lists.subraces],
        wizardState.subrace?.index || "",
        "wizard-subrace",
        "subraces"
      )}`;
    return;
  }

  if (step.id === "class") {
    creationWizardBody.innerHTML = `
      <p class="creation-wizard-hint">${escapeHtml(step.hint)}</p>
      ${renderWizardPickList(wizardState.lists.classes, wizardState.classEntry?.index, "wizard-class", "classes")}`;
    return;
  }

  if (step.id === "background") {
    creationWizardBody.innerHTML = `
      <p class="creation-wizard-hint">${escapeHtml(step.hint)}</p>
      ${renderWizardPickList(
        [{ index: "", name: "— Sem antecedente (opcional) —" }, ...wizardState.lists.backgrounds],
        wizardState.background?.index || "",
        "wizard-background",
        "backgrounds"
      )}
      <label class="creation-wizard-check">
        <input type="checkbox" id="wizardApplyPersonality"${wizardState.applyBackgroundPersonality ? " checked" : ""} />
        Preencher traços / ideais / vínculos / defeitos (aleatório PHB)
      </label>`;
    return;
  }

  if (step.id === "equipment") {
    if (!wizardState.classData && wizardState.classEntry) {
      wizardState.classData = await fetchWizardDetail(wizardState.classEntry);
    }
    if (!wizardState.backgroundData && wizardState.background) {
      wizardState.backgroundData = await fetchWizardDetail(wizardState.background);
    }
    const rows = collectStartingEquipmentFromSources(wizardState.classData, wizardState.backgroundData);
    const list =
      rows.length > 0
        ? `<ul class="creation-wizard-equip-preview">${rows
            .map((r) => `<li>${escapeHtml(r.qty > 1 ? `${r.qty}× ` : "")}${escapeHtml(r.name)}</li>`)
            .join("")}</ul>`
        : '<p class="creation-wizard-muted">Sem equipamento fixo na API para esta combinação. Adiciona manualmente no inventário.</p>';
    creationWizardBody.innerHTML = `
      <p class="creation-wizard-hint">${escapeHtml(step.hint)}</p>
      <label class="creation-wizard-check">
        <input type="checkbox" id="wizardImportEquipment"${wizardState.importEquipment ? " checked" : ""} />
        Importar itens para o inventário (${rows.length} item${rows.length === 1 ? "" : "ns"})
      </label>
      ${list}
      <p class="creation-wizard-muted">Pacotes com escolha (A ou B) não são resolvidos automaticamente — ajusta depois na ficha.</p>`;
    return;
  }

  if (step.id === "abilities") {
    if (!wizardState.raceData && selectedRaceEntry()) {
      wizardState.raceData = await fetchWizardDetail(selectedRaceEntry());
    }
    const bonuses = layoutAbilityBonuses(wizardState.raceData?.ability_bonuses) || "—";
    creationWizardBody.innerHTML = `
      <p class="creation-wizard-hint">${escapeHtml(step.hint)}</p>
      <p class="creation-wizard-muted">Bónus raciais (aplicados ao concluir): <strong>${escapeHtml(bonuses)}</strong></p>
      <fieldset class="creation-wizard-ability-method">
        <legend class="sheet-name-label">Método</legend>
        <label class="creation-wizard-option creation-wizard-option--inline">
          <input type="radio" name="wizard-ability-method" value="standard"${wizardState.abilityMethod === "standard" ? " checked" : ""} />
          Array padrão (15, 14, 13, 12, 10, 8)
        </label>
        <label class="creation-wizard-option creation-wizard-option--inline">
          <input type="radio" name="wizard-ability-method" value="keep"${wizardState.abilityMethod === "keep" ? " checked" : ""} />
          Manter valores atuais da ficha
        </label>
        <label class="creation-wizard-option creation-wizard-option--inline">
          <input type="radio" name="wizard-ability-method" value="roll"${wizardState.abilityMethod === "roll" ? " checked" : ""} />
          Rolar aqui (7x 4d6) e distribuir
        </label>
      </fieldset>
      <div class="creation-wizard-standard-grid" id="wizardAbilityGrid">
        ${ABILITY_KEYS.map((key) => {
          return `<label class="sheet-inline-field">
          <span class="sheet-name-label">${key.toUpperCase()}</span>
          <select class="sheet-select wizard-ability-select" data-ability="${key}">
            ${buildWizardAbilityOptions(key)}
          </select>
        </label>`;
        }).join("")}
      </div>
      <div id="wizardRollWrap" class="creation-wizard-roll-wrap" hidden>
        <div class="sheet-dice-actions creation-wizard-roll-actions">
          <button type="button" class="sheet-dice-btn sheet-dice-btn--compact" data-wizard-action="roll-abilities">Rolar 7x 4d6</button>
          <button type="button" class="sheet-dice-btn sheet-dice-btn--muted sheet-dice-btn--compact" data-wizard-action="clear-ability-rolls"${
            wizardState.rolledAbilitySets.length ? "" : " hidden"
          }>
            Limpar rolagens
          </button>
        </div>
        ${renderWizardAbilityRollSets()}
      </div>
      `;
    syncWizardAbilityGridVisibility();
    syncWizardRollWrapVisibility();
    syncWizardAbilitySelectOptions();
    return;
  }

  if (step.id === "spells") {
    if (!wizardState.classData && wizardState.classEntry) {
      wizardState.classData = await fetchWizardDetail(wizardState.classEntry);
    }
    const casterHint =
      typeof CLASS_CASTER_HINTS !== "undefined" ? CLASS_CASTER_HINTS[wizardState.classEntry?.index] : null;
    const isCaster =
      Boolean(wizardState.classData?.spellcasting) ||
      (casterHint && casterHint.caster && casterHint.caster !== "none");
    const hint = isCaster
      ? "Esta classe conjura. Marca magias ★ no explorador ou usa «+ Na ficha», depois importa abaixo."
      : "Esta classe não é conjuradora principal — podes saltar este passo.";
    creationWizardBody.innerHTML = `
      <p class="creation-wizard-hint">${escapeHtml(step.hint)}</p>
      <p class="creation-wizard-muted">${escapeHtml(hint)}</p>
      <label class="creation-wizard-check">
        <input type="checkbox" id="wizardImportSpells"${wizardState.importSpells ? " checked" : ""} />
        Importar magias dos favoritos / itens na ficha
      </label>`;
  }
}

function syncWizardAbilityGridVisibility() {
  const grid = document.getElementById("wizardAbilityGrid");
  if (!grid) return;
  grid.hidden = wizardState.abilityMethod === "keep";
}

function syncWizardRollWrapVisibility() {
  const rollWrap = document.getElementById("wizardRollWrap");
  if (rollWrap) rollWrap.hidden = wizardState.abilityMethod !== "roll";
}

function rollWizardAbilityGeneration() {
  const sets = [];
  for (let i = 0; i < 7; i++) {
    const r = roll4d6DropLowest();
    sets.push({
      id: String(i),
      rolls: r.rolls,
      dropped: r.dropped,
      droppedIndex: r.droppedIndex,
      total: r.total,
      inactive: false,
    });
  }
  let minIdx = 0;
  for (let i = 1; i < sets.length; i++) {
    if (sets[i].total < sets[minIdx].total) minIdx = i;
  }
  sets[minIdx].inactive = true;
  wizardState.rolledAbilitySets = sets;
  wizardState.rolledAssignment = {};
}

function clearWizardAbilityGeneration() {
  wizardState.rolledAbilitySets = [];
  wizardState.rolledAssignment = {};
}

function renderWizardAbilityRollSets() {
  if (!wizardState.rolledAbilitySets.length) {
    return '<p class="creation-wizard-muted">Ainda sem rolagens. Usa "Rolar 7x 4d6".</p>';
  }
  return `<p class="sheet-dice-legend">
      <span class="sheet-dice-legend-kept">Azul</span> = conta no total ·
      <span class="sheet-dice-legend-dropped">Riscado</span> = descartado
    </p>
    <ul class="sheet-ability-rolls">
      ${wizardState.rolledAbilitySets
        .map((set, i) => {
          const diceHtml = renderDieFacesHtml(set);
          const inactive = set.inactive ? " sheet-ability-roll--inactive" : "";
          const note = set.inactive
            ? '<span class="sheet-ability-roll-note sheet-ability-roll-note--struck">menor — referencia (descartado)</span>'
            : "";
          return `<li class="sheet-ability-roll${inactive}">
            <span class="sheet-ability-roll-num">#${i + 1}</span>
            <span class="sheet-ability-roll-dice">${diceHtml}</span>
            <strong class="sheet-ability-roll-total${set.inactive ? " sheet-ability-roll-total--discarded" : ""}">${set.total}</strong>
            ${note}
          </li>`;
        })
        .join("")}
    </ul>`;
}

function getWizardAbilityAssignedElsewhere(currentKey, map) {
  const used = new Set();
  for (const key of ABILITY_KEYS) {
    if (key === currentKey) continue;
    const picked = map[key];
    if (picked) used.add(String(picked));
  }
  return used;
}

function buildWizardAbilityOptions(abilityKey) {
  if (wizardState.abilityMethod === "roll") {
    const current = wizardState.rolledAssignment[abilityKey] || "";
    const usedElsewhere = getWizardAbilityAssignedElsewhere(abilityKey, wizardState.rolledAssignment);
    let html = '<option value="">—</option>';
    for (const set of wizardState.rolledAbilitySets) {
      if (set.inactive) continue;
      if (usedElsewhere.has(set.id) && current !== set.id) continue;
      html += `<option value="${escapeHtml(set.id)}"${current === set.id ? " selected" : ""}>${set.total}</option>`;
    }
    return html;
  }
  const current = String(wizardState.standardAssignment[abilityKey] || "");
  const usedElsewhere = getWizardAbilityAssignedElsewhere(abilityKey, wizardState.standardAssignment);
  let html = '<option value="">—</option>';
  for (const n of CREATION_STANDARD_ARRAY) {
    const v = String(n);
    if (usedElsewhere.has(v) && current !== v) continue;
    html += `<option value="${v}"${current === v ? " selected" : ""}>${v}</option>`;
  }
  return html;
}

function syncWizardAbilitySelectOptions() {
  creationWizardBody?.querySelectorAll(".wizard-ability-select").forEach((sel) => {
    const key = sel.dataset.ability;
    if (!key) return;
    sel.innerHTML = buildWizardAbilityOptions(key);
    if (wizardState.abilityMethod === "roll") {
      sel.value = wizardState.rolledAssignment[key] || "";
    } else {
      sel.value = wizardState.standardAssignment[key] || "";
    }
  });
}

function readWizardInputsFromDom() {
  const nameInput = document.getElementById("wizardCharacterName");
  if (nameInput) wizardState.characterName = nameInput.value.trim();

  const raceRadio = creationWizardBody?.querySelector('input[name="wizard-race"]:checked');
  if (raceRadio?.value) {
    wizardState.race = wizardState.lists.races.find((r) => r.index === raceRadio.value) || null;
  }
  const subRadio = creationWizardBody?.querySelector('input[name="wizard-subrace"]:checked');
  wizardState.subrace =
    subRadio?.value && subRadio.value !== ""
      ? wizardState.lists.subraces.find((r) => r.index === subRadio.value) || null
      : null;

  const classRadio = creationWizardBody?.querySelector('input[name="wizard-class"]:checked');
  if (classRadio?.value) {
    wizardState.classEntry = wizardState.lists.classes.find((c) => c.index === classRadio.value) || null;
    wizardState.classData = null;
  }

  const bgRadio = creationWizardBody?.querySelector('input[name="wizard-background"]:checked');
  if (bgRadio?.value) {
    wizardState.background = wizardState.lists.backgrounds.find((b) => b.index === bgRadio.value) || null;
    wizardState.backgroundData = null;
  } else if (bgRadio && bgRadio.value === "") {
    wizardState.background = null;
    wizardState.backgroundData = null;
  }

  const pers = document.getElementById("wizardApplyPersonality");
  if (pers) wizardState.applyBackgroundPersonality = pers.checked;

  const equip = document.getElementById("wizardImportEquipment");
  if (equip) wizardState.importEquipment = equip.checked;

  const method = creationWizardBody?.querySelector('input[name="wizard-ability-method"]:checked');
  if (method) wizardState.abilityMethod = method.value;

  creationWizardBody?.querySelectorAll(".wizard-ability-select").forEach((sel) => {
    const key = sel.dataset.ability;
    if (!key) return;
    if (wizardState.abilityMethod === "roll") {
      wizardState.rolledAssignment[key] = sel.value;
    } else if (wizardState.abilityMethod === "standard") {
      wizardState.standardAssignment[key] = sel.value;
    }
  });

  const spells = document.getElementById("wizardImportSpells");
  if (spells) wizardState.importSpells = spells.checked;
}

function validateWizardStep() {
  const step = currentWizardStep();
  if (step.id === "race" && !wizardState.race) {
    setWizardStatus("Escolhe uma raça.", true);
    return false;
  }
  if (step.id === "class" && !wizardState.classEntry) {
    setWizardStatus("Escolhe uma classe.", true);
    return false;
  }
  if (step.id === "abilities" && wizardState.abilityMethod === "standard") {
    const used = new Set();
    for (const key of ABILITY_KEYS) {
      const v = wizardState.standardAssignment[key];
      if (!v) {
        setWizardStatus("Atribui um valor do array a cada atributo.", true);
        return false;
      }
      if (used.has(v)) {
        setWizardStatus("Cada valor do array só pode ser usado uma vez.", true);
        return false;
      }
      used.add(v);
    }
  }
  if (step.id === "abilities" && wizardState.abilityMethod === "roll") {
    if (!wizardState.rolledAbilitySets.length) {
      setWizardStatus("Rola os atributos antes de avançar.", true);
      return false;
    }
    const activeSetIds = new Set(
      wizardState.rolledAbilitySets.filter((s) => !s.inactive).map((s) => String(s.id))
    );
    const used = new Set();
    for (const key of ABILITY_KEYS) {
      const setId = wizardState.rolledAssignment[key];
      if (!setId) {
        setWizardStatus("Atribui um total rolado a cada atributo.", true);
        return false;
      }
      if (!activeSetIds.has(String(setId))) {
        setWizardStatus("Só podes usar resultados ativos da rolagem.", true);
        return false;
      }
      if (used.has(String(setId))) {
        setWizardStatus("Cada rolagem só pode ser usada uma vez.", true);
        return false;
      }
      used.add(String(setId));
    }
  }
  return true;
}

async function finishCreationWizard() {
  readWizardInputsFromDom();
  setWizardStatus("A aplicar escolhas…");

  const raceEntry = selectedRaceEntry();
  if (!raceEntry || !wizardState.classEntry) {
    setWizardStatus("Completa raça e classe.", true);
    return;
  }

  const [raceData, subraceData, classData, backgroundData] = await Promise.all([
    fetchWizardDetail(wizardState.race),
    wizardState.subrace ? fetchWizardDetail(wizardState.subrace) : Promise.resolve(null),
    fetchWizardDetail(wizardState.classEntry),
    wizardState.background ? fetchWizardDetail(wizardState.background) : Promise.resolve(null),
  ]);

  const bonusSource = subraceData || raceData;
  let feedback = [];

  patchSheet((sheet) => {
    if (wizardState.characterName) sheet.characterName = wizardState.characterName.slice(0, 120);
    sheet.characterLevel = 1;
    sheet.xpTotal = 0;

    sheet.items = (sheet.items || []).filter((i) => !["races", "subraces"].includes(i.resourceKey));
    const raceItem = normalizeSheetItem({
      ...wizardState.race,
      cachedData: raceData,
      dataLocale: currentLocale,
    });
    if (raceItem) sheet.items.push(raceItem);
    if (wizardState.subrace) {
      const subItem = normalizeSheetItem({
        ...wizardState.subrace,
        cachedData: subraceData,
        dataLocale: currentLocale,
      });
      if (subItem) sheet.items.push(subItem);
    }

    setPrimarySheetItem(sheet, {
      ...wizardState.classEntry,
      cachedData: classData,
      dataLocale: currentLocale,
    });
    setPrimarySheetItem(sheet, {
      ...wizardState.background,
      cachedData: backgroundData,
      dataLocale: currentLocale,
    });

    if (classData && typeof applyClassDataToSheet === "function") {
      const r = applyClassDataToSheet(sheet, classData, wizardState.classEntry.index);
      if (r.ok) feedback.push("classe");
    }

    if (wizardState.applyBackgroundPersonality && backgroundData && typeof applyBackgroundPersonalityToSheet === "function") {
      const r = applyBackgroundPersonalityToSheet(sheet, backgroundData);
      if (r.ok) feedback.push("personalidade");
    }

    if (wizardState.importEquipment) {
      const rows = collectStartingEquipmentFromSources(classData, backgroundData);
      const n = importStartingEquipmentRows(sheet, rows);
      if (n) feedback.push(`${n} itens`);
    }

    if (wizardState.abilityMethod === "standard") {
      applyStandardArrayToSheet(sheet, wizardState.standardAssignment);
      feedback.push("atributos");
    }
    if (wizardState.abilityMethod === "roll") {
      for (const key of ABILITY_KEYS) {
        const setId = wizardState.rolledAssignment[key];
        if (!setId) continue;
        const set = wizardState.rolledAbilitySets.find((s) => String(s.id) === String(setId) && !s.inactive);
        if (set) sheet.abilityScores[key] = String(set.total);
      }
      feedback.push("atributos rolados");
    }

    if (bonusSource?.ability_bonuses?.length) {
      const ch = applyRaceAbilityBonusesToSheet(sheet, bonusSource.ability_bonuses, { mode: "add" });
      if (ch.length) feedback.push("bónus raciais");
    }

    if (wizardState.importSpells && typeof importSpellFavoritesToSheet === "function") {
      const n = importSpellFavoritesToSheet(sheet);
      if (n) feedback.push(`${n} magias`);
    }
  });

  if (typeof syncSheetAfterClassOrBackgroundApply === "function") {
    syncSheetAfterClassOrBackgroundApply();
  } else if (typeof renderAll === "function") {
    renderAll();
  }

  closeCreationWizard();
  const msg = feedback.length ? `Personagem criado: ${feedback.join(" · ")}.` : "Personagem criado.";
  if (typeof setSheetApplyFeedback === "function") {
    setSheetApplyFeedback(msg, false, { target: "class" });
  }
}

function openCreationWizard() {
  if (!creationWizardDialog) return;
  wizardState.step = 0;
  wizardState.race = null;
  wizardState.subrace = null;
  wizardState.classEntry = null;
  wizardState.background = null;
  wizardState.raceData = null;
  wizardState.classData = null;
  wizardState.backgroundData = null;
  wizardState.importEquipment = true;
  wizardState.applyBackgroundPersonality = true;
  wizardState.abilityMethod = "standard";
  wizardState.standardAssignment = {};
  wizardState.rolledAbilitySets = [];
  wizardState.rolledAssignment = {};
  wizardState.importSpells = false;
  wizardState.characterName = loadSheet().characterName || "";

  creationWizardDialog.showModal();
  void renderWizardStep();
}

function closeCreationWizard() {
  creationWizardDialog?.close();
}

function wizardGo(delta) {
  readWizardInputsFromDom();
  if (delta > 0 && !validateWizardStep()) return;
  wizardState.step = Math.max(0, Math.min(WIZARD_STEPS.length - 1, wizardState.step + delta));
  void renderWizardStep();
}

function onWizardClick(e) {
  const btn = e.target.closest("[data-wizard-action]");
  if (!btn) return;
  const action = btn.dataset.wizardAction;
  if (action === "cancel") {
    closeCreationWizard();
    return;
  }
  if (action === "back") {
    wizardGo(-1);
    return;
  }
  if (action === "next") {
    wizardGo(1);
    return;
  }
  if (action === "roll-abilities") {
    rollWizardAbilityGeneration();
    void renderWizardStep();
    return;
  }
  if (action === "clear-ability-rolls") {
    clearWizardAbilityGeneration();
    void renderWizardStep();
    return;
  }
  if (action === "finish") {
    void finishCreationWizard();
  }
}

function onWizardChange(e) {
  if (e.target.matches('input[name="wizard-ability-method"]')) {
    readWizardInputsFromDom();
    wizardState.abilityMethod = e.target.value;
    syncWizardAbilityGridVisibility();
    syncWizardRollWrapVisibility();
    syncWizardAbilitySelectOptions();
    return;
  }

  const sel = e.target.closest(".wizard-ability-select");
  if (sel) {
    const key = sel.dataset.ability;
    if (!key) return;
    if (wizardState.abilityMethod === "roll") {
      wizardState.rolledAssignment[key] = sel.value;
    } else {
      wizardState.standardAssignment[key] = sel.value;
    }
    syncWizardAbilitySelectOptions();
  }
}

async function onApplyRaceBonusesFromSheetClick() {
  const entry = findRaceOrSubraceOnSheet(loadSheet());
  if (!entry) {
    setSheetApplyFeedback?.("Adiciona uma raça ou sub-raça à ficha.", true, { target: "class" });
    return;
  }
  const data = entry.cachedData || (await fetchWizardDetail(entry));
  if (!data) {
    setSheetApplyFeedback?.("Não foi possível carregar a raça.", true, { target: "class" });
    return;
  }
  if (!entry.cachedData) {
    patchSheet((s) => {
      const it = s.items.find(
        (i) => i.resourceKey === entry.resourceKey && String(i.index) === String(entry.index)
      );
      if (it) applyCacheToEntry(it, data);
    });
  }
  let msg = "";
  let err = false;
  patchSheet((s) => {
    const r = applyRaceBonusesFromSheetRaceSync(s, data);
    msg = r.message || r.error || "";
    err = !r.ok;
  });
  syncCharacterCoreFromSheet?.();
  refreshCombatBonuses?.();
  setSheetApplyFeedback?.(msg, err, { target: "class" });
}

function initCreationWizard() {
  document.getElementById("openCreationWizardBtn")?.addEventListener("click", openCreationWizard);
  document.getElementById("applyRaceBonusesBtn")?.addEventListener("click", () => {
    void onApplyRaceBonusesFromSheetClick();
  });
  creationWizardDialog?.addEventListener("click", onWizardClick);
  creationWizardDialog?.addEventListener("change", onWizardChange);
  creationWizardDialog?.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeCreationWizard();
  });
}

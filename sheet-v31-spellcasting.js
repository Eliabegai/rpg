/**
 * v3.1 — Multiclasse, preparadas, descanso curto com gasto de DV.
 */
let multiclassUiBound = false;

function renderMulticlassPanel() {
  const panel = document.getElementById("multiclassPanel");
  if (!panel) return;
  const sheet = loadSheet();
  const mc = sheet.spellcasting?.multiclass || { enabled: false, classes: [] };
  const enabled = Boolean(mc.enabled);

  const rowsHtml =
    mc.classes.length > 0
      ? mc.classes
          .map(
            (c, i) => `
        <div class="multiclass-row" data-mc-index="${i}">
          <input type="text" class="sheet-text-input multiclass-name" data-mc-field="name" value="${escapeHtml(c.name)}" placeholder="Classe" />
          <input type="number" class="sheet-number-input multiclass-level" data-mc-field="level" min="1" max="20" value="${c.level}" aria-label="Nível na classe" />
          <select class="sheet-select multiclass-caster" data-mc-field="caster" aria-label="Conjuração">
            <option value="none"${c.caster === "none" ? " selected" : ""}>Sem magia</option>
            <option value="full"${c.caster === "full" ? " selected" : ""}>Pleno</option>
            <option value="half"${c.caster === "half" ? " selected" : ""}>Meio</option>
            <option value="third"${c.caster === "third" ? " selected" : ""}>1/3</option>
            <option value="pact"${c.caster === "pact" ? " selected" : ""}>Pacto</option>
          </select>
          <button type="button" class="sheet-inventory-remove multiclass-remove" data-mc-remove="${i}" aria-label="Remover classe">×</button>
        </div>`
          )
          .join("")
      : `<p class="sheet-combat-hint">Nenhuma classe. Adiciona abaixo.</p>`;

  const combined =
    enabled && mc.classes.length && typeof combinedMulticlassCasterLevel === "function"
      ? combinedMulticlassCasterLevel(mc.classes)
      : 0;

  panel.innerHTML = `
    <label class="sheet-inline-field multiclass-enable">
      <input type="checkbox" id="multiclassEnabled" ${enabled ? "checked" : ""} />
      <span>Usar tabela de slots multiclasse (PHB)</span>
    </label>
    <div id="multiclassRows" class="multiclass-rows">${rowsHtml}</div>
    <div class="multiclass-actions">
      <button type="button" class="sheet-dice-btn sheet-dice-btn--compact" id="multiclassAddBtn">+ Classe</button>
    </div>
    <p class="sheet-combat-hint" id="multiclassSummary">${
      enabled && combined > 0
        ? `Nível de conjurador combinado: ${combined}.`
        : "Desativado — usa o tipo de conjurador simples acima."
    }</p>`;

  const preparedSelect = document.getElementById("preparedCasterSelect");
  if (preparedSelect && document.activeElement !== preparedSelect) {
    preparedSelect.value = sheet.spellcasting?.preparedCaster || "none";
  }
  updatePreparedSpellsHint();
}

function updatePreparedSpellsHint() {
  const el = document.getElementById("preparedSpellsHint");
  if (!el) return;
  const sheet = loadSheet();
  const max = maxPreparedSpellsForSheet(sheet);
  if (max == null) {
    el.textContent = "Sem limite de preparação (conjurador que conhece magias).";
    return;
  }
  const count = countPreparedSpells(sheet);
  el.textContent = `Preparadas: ${count} / ${max} (nível + atributo de conjuração).`;
  el.classList.toggle("sheet-carry--over", count > max);
}

function readMulticlassFromDom() {
  const enabled = Boolean(document.getElementById("multiclassEnabled")?.checked);
  const rows = document.querySelectorAll("#multiclassRows .multiclass-row");
  const classes = [];
  rows.forEach((row) => {
    const name = row.querySelector('[data-mc-field="name"]')?.value?.trim();
    const level = Math.min(20, Math.max(1, Math.floor(Number(row.querySelector('[data-mc-field="level"]')?.value) || 1)));
    const caster = row.querySelector('[data-mc-field="caster"]')?.value || "none";
    if (!name) return;
    classes.push({
      index: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      level,
      caster: ["full", "half", "third", "pact", "none"].includes(caster) ? caster : "none",
    });
  });
  return { enabled: enabled && classes.length > 0, classes };
}

function saveMulticlassFromDom() {
  patchSheet((s) => {
    if (!s.spellcasting) s.spellcasting = { casterType: "none", slotsUsed: {}, spells: [] };
    s.spellcasting.multiclass = readMulticlassFromDom();
    s.spellcasting.slotsUsed = {};
  });
  renderSpellSlotsGrid?.();
  renderSpellListByLevel?.();
  renderMulticlassPanel();
}

function onMulticlassPanelChange(e) {
  if (e.target.id === "multiclassEnabled" || e.target.closest("[data-mc-field]")) {
    saveMulticlassFromDom();
    return;
  }
  if (e.target.id === "preparedCasterSelect") {
    patchSheet((s) => {
      if (!s.spellcasting) return;
      s.spellcasting.preparedCaster = normalizePreparedCaster(e.target.value);
    });
    updatePreparedSpellsHint();
    renderSpellListByLevel?.();
  }
}

function onMulticlassPanelClick(e) {
  if (e.target.id === "multiclassAddBtn") {
    patchSheet((s) => {
      if (!s.spellcasting) s.spellcasting = { casterType: "none", slotsUsed: {}, spells: [] };
      if (!s.spellcasting.multiclass) s.spellcasting.multiclass = { enabled: true, classes: [] };
      s.spellcasting.multiclass.classes.push({
        index: `class-${Date.now()}`,
        name: "Nova classe",
        level: 1,
        caster: "none",
      });
      s.spellcasting.multiclass.enabled = true;
    });
    renderMulticlassPanel();
    return;
  }
  const remove = e.target.closest("[data-mc-remove]");
  if (remove) {
    const i = Number(remove.dataset.mcRemove);
    if (!Number.isFinite(i) || i < 0) return;
    patchSheet((s) => {
      if (!s.spellcasting) return;
      if (!s.spellcasting.multiclass) s.spellcasting.multiclass = { enabled: false, classes: [] };
      s.spellcasting.multiclass.classes.splice(i, 1);
      if (s.spellcasting.multiclass.classes.length === 0) {
        s.spellcasting.multiclass.enabled = false;
      }
      s.spellcasting.slotsUsed = {};
    });
    renderMulticlassPanel();
    renderSpellSlotsGrid?.();
    renderSpellListByLevel?.();
  }
}

function onShortRestSpendHd() {
  const count = Math.max(1, Math.floor(Number(document.getElementById("shortRestHdCount")?.value) || 1));
  const sheet = loadSheet();
  const remaining = hitDiceRemainingForSheet(sheet);
  if (remaining <= 0) {
    setRestMessage?.("Sem dados de vida para gastar.", true);
    return;
  }
  const spend = Math.min(count, remaining);
  const sides = hitDieSidesFromSheet(sheet);
  const con = Number(sheet.abilityScores?.con);
  const conMod = Number.isFinite(con) ? Math.floor((con - 10) / 2) : 0;
  let totalHeal = 0;
  const rolls = [];
  for (let i = 0; i < spend; i++) {
    const roll = rollDie(sides);
    rolls.push(roll);
    totalHeal += Math.max(1, roll + conMod);
  }
  const maxHp = clampHpValue(Number(sheet.hpMax) || 0);
  let current = clampHpValue(Number(sheet.hpCurrent) || 0);
  current = maxHp ? Math.min(maxHp, current + totalHeal) : current + totalHeal;

  patchSheet((s) => {
    s.hitDiceRemaining = remaining - spend;
    s.hpCurrent = String(current);
  });
  syncHpFields?.();
  syncHitDiceUi?.();
  if (typeof applyRestEnvironmentTheme === "function") applyRestEnvironmentTheme();
  document.querySelector(".sheet-rest")?.classList.add("sheet-rest--pulse");
  setTimeout(() => document.querySelector(".sheet-rest")?.classList.remove("sheet-rest--pulse"), 900);
  setRestMessage?.(
    `Descanso curto: ${spend}× d${sides} (${rolls.join(", ")}) +${totalHeal} PV. Restam ${remaining - spend} dados.`
  );
}

const REST_THEME_SCENES = {
  wilderness: { label: "Ermo / viagem", icon: "🌲", mood: "Ar livre, vigília recomendada." },
  campfire: { label: "Fogueira", icon: "🔥", mood: "Calor da fogueira, céu aberto." },
  tavern: { label: "Taverna ou pousada", icon: "🍺", mood: "Camas, refeição quente, descanso seguro." },
  dungeon: { label: "Masmorra", icon: "⚔️", mood: "Pedra fria, perigo à espreita." },
  stronghold: { label: "Fortaleza / santuário", icon: "🏰", mood: "Muralhas, refúgio consagrado." },
};

function applyRestEnvironmentTheme() {
  const restBlock = document.querySelector(".sheet-rest");
  const vitalsBlock = document.querySelector(".sheet-core-vitals");
  const healBlock = document.querySelector(".sheet-hp-actions");
  const sheet = loadSheet();
  const theme = sheet.restEnvironment || "tavern";
  const scene = REST_THEME_SCENES[theme] || REST_THEME_SCENES.tavern;
  const env = REST_ENVIRONMENTS?.[theme];

  for (const el of [restBlock, vitalsBlock, healBlock]) {
    if (el) el.setAttribute("data-rest-theme", theme);
  }

  const sceneEl = document.getElementById("restEnvironmentScene");
  if (sceneEl) {
    sceneEl.dataset.theme = theme;
    const icon = sceneEl.querySelector(".rest-environment-scene__icon");
    const label = sceneEl.querySelector(".rest-environment-scene__label");
    const mood = sceneEl.querySelector(".rest-environment-scene__mood");
    if (icon) icon.textContent = scene.icon;
    if (label) label.textContent = scene.label;
    if (mood) mood.textContent = env?.hint || scene.mood;
  }

  document.documentElement.style.setProperty("--rest-theme-accent", getRestThemeAccent(theme));
}

function getRestThemeAccent(theme) {
  const map = {
    wilderness: "#15803d",
    campfire: "#c2410c",
    tavern: "#b45309",
    dungeon: "#475569",
    stronghold: "#1d4ed8",
  };
  return map[theme] || map.tavern;
}

function onImportEquipmentFavorites() {
  let added = 0;
  patchSheet((s) => {
    added = importEquipmentFavoritesToSheet(s);
  });
  if (typeof syncCombatV3Fields === "function") syncCombatV3Fields(loadSheet());
  if (added > 0) setRestMessage?.(`${added} item${added === 1 ? "" : "s"} de equipamento importado${added === 1 ? "" : "s"}.`);
  else setRestMessage?.("Nada novo — marca ★ em equipamento ou adiciona à ficha.", true);
}

let sheetV31ActionsBound = false;

function bindSheetV31Actions() {
  if (sheetV31ActionsBound) return;
  sheetV31ActionsBound = true;

  const panel = document.getElementById("multiclassPanel");
  if (panel) {
    panel.addEventListener("change", onMulticlassPanelChange);
    panel.addEventListener("input", onMulticlassPanelChange);
    panel.addEventListener("click", onMulticlassPanelClick);
  }

  document.getElementById("shortRestSpendHdBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    onShortRestSpendHd();
  });
  document.getElementById("applyClassFromSheetBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    void onApplyClassFromSheet();
  });
  document.getElementById("suggestHpMaxBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    onSuggestHpMax();
  });
  document.getElementById("applyBackgroundFromSheetBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    void onApplyBackgroundFromSheet();
  });
  document.getElementById("importEquipmentFavoritesBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    onImportEquipmentFavorites();
  });
}

function initSheetV31Spellcasting() {
  if (typeof initSheetPersonalityLinks === "function") initSheetPersonalityLinks();
  bindSheetV31Actions();
  if (!multiclassUiBound) multiclassUiBound = true;
  renderMulticlassPanel();
  applyRestEnvironmentTheme();
}

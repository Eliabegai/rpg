/**
 * Importar dados da classe / antecedente na ficha (API 2014).
 */
const CLASS_CASTER_HINTS = {
  wizard: { caster: "full", prepared: "wizard" },
  sorcerer: { caster: "full", prepared: "none" },
  warlock: { caster: "warlock", prepared: "none" },
  cleric: { caster: "full", prepared: "cleric" },
  druid: { caster: "full", prepared: "druid" },
  bard: { caster: "full", prepared: "none" },
  paladin: { caster: "half", prepared: "none" },
  ranger: { caster: "half", prepared: "none" },
  artificer: { caster: "half", prepared: "none" },
  fighter: { caster: "none", prepared: "none" },
  barbarian: { caster: "none", prepared: "none" },
  monk: { caster: "none", prepared: "none" },
  rogue: { caster: "none", prepared: "none" },
};

function proficiencyRefToSkillIndex(refIndex) {
  const m = String(refIndex || "").match(/^skill-(.+)$/);
  return m ? m[1] : null;
}

function findPrimaryClassOnSheet(sheet) {
  return (sheet?.items || []).find((i) => i.resourceKey === "classes") || null;
}

function findPrimaryBackgroundOnSheet(sheet) {
  return (sheet?.items || []).find((i) => i.resourceKey === "backgrounds") || null;
}

function setSheetApplyFeedback(text, isError = false, { target = "auto" } = {}) {
  const classEl = document.getElementById("classApplyFeedback");
  const persEl = document.getElementById("personalityApplyFeedback");
  const showClass = target === "class" || (target === "auto" && classEl?.offsetParent !== null);
  const showPers = target === "personality" || target === "background";

  if (showPers && persEl) {
    persEl.textContent = text;
    persEl.classList.toggle("is-error", isError);
    persEl.hidden = !text;
    if (classEl && target === "background") classEl.hidden = true;
  } else if (classEl) {
    classEl.textContent = text;
    classEl.classList.toggle("is-error", isError);
    classEl.hidden = !text;
  }
  if (typeof setRestMessage === "function" && (target === "class" || target === "auto")) {
    setRestMessage(text, isError);
  }
}

function syncSheetAfterClassOrBackgroundApply() {
  const sheet = loadSheet();
  if (typeof syncHpFields === "function") syncHpFields();
  if (typeof syncHitDiceUi === "function") syncHitDiceUi();
  if (typeof renderDeathSaves === "function") renderDeathSaves();
  if (typeof renderSpellSlotsGrid === "function") renderSpellSlotsGrid();
  if (typeof renderSpellListByLevel === "function") renderSpellListByLevel();
  if (typeof syncCharacterCoreFromSheet === "function") syncCharacterCoreFromSheet();
  else if (typeof syncSheetCombatV3 === "function") syncSheetCombatV3();
  else if (typeof refreshCombatBonuses === "function") refreshCombatBonuses();
  if (typeof updatePreparedSpellsHint === "function") updatePreparedSpellsHint();
  if (typeof syncCombatV3Fields === "function") syncCombatV3Fields(sheet);
}

async function fetchEntryDataForSheet(entry) {
  if (!entry?.resourceKey || !entry?.index) return null;
  if (entry.cachedData && Object.keys(entry.cachedData).length > 1) return entry.cachedData;
  const cached = getCachedEntryData({
    resourceKey: entry.resourceKey,
    index: entry.index,
    path: buildApiEntryPath(entry),
  });
  if (cached) return cached;
  try {
    const res = await apiFetch(buildApiEntryPath(entry));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function applyCasterHintFromClass(sheet, classIndex) {
  const hint = CLASS_CASTER_HINTS[classIndex];
  if (!hint || !sheet.spellcasting) return;
  if (hint.caster && hint.caster !== "none") {
    sheet.spellcasting.casterType = hint.caster;
  }
  if (hint.prepared) {
    sheet.spellcasting.preparedCaster = hint.prepared;
  }
}

function applyClassDataToSheet(sheet, data, classIndex) {
  if (!data) return { ok: false, error: "Sem dados da classe." };
  const changed = [];

  if (data.hit_die != null) {
    sheet.hitDie = `d${data.hit_die}`;
    changed.push(`DV d${data.hit_die}`);
  }

  sheet.saveProficiencies = { str: false, dex: false, con: false, int: false, wis: false, cha: false };
  if (Array.isArray(data.saving_throws)) {
    for (const st of data.saving_throws) {
      const key = String(st.index || st.name || "").toLowerCase();
      if (ABILITY_KEYS.includes(key)) sheet.saveProficiencies[key] = true;
    }
    changed.push("salvaguardas");
  }

  applyCasterHintFromClass(sheet, classIndex);

  const suggested = computeSuggestedHpMax(sheet);
  if (suggested != null) {
    sheet.hpMax = String(suggested);
    sheet.hpCurrent = String(suggested);
    sheet.hpTemp = "0";
    changed.push(`PV ${suggested}`);
  }
  sheet.deathSaves = { successes: 0, failures: 0 };
  const maxHd = hitDiceMaxForSheet(sheet);
  sheet.hitDiceRemaining = maxHd;
  changed.push(`${maxHd} dados de vida`);

  return {
    ok: true,
    message: `Classe aplicada: ${changed.join(" · ")}. Escolhe perícias da classe manualmente (proficiências variáveis).`,
  };
}

async function onApplyClassFromSheet() {
  setSheetApplyFeedback("A carregar classe…");
  const sheet = loadSheet();
  const entry = findPrimaryClassOnSheet(sheet);
  if (!entry) {
    setSheetApplyFeedback("Adiciona uma classe à ficha («+ Na ficha» na biblioteca).", true);
    return;
  }
  const data = await fetchEntryDataForSheet(entry);
  if (!data) {
    setSheetApplyFeedback("Não foi possível carregar a classe. Verifica a ligação à API.", true);
    return;
  }
  let message = "";
  patchSheet((s) => {
    const result = applyClassDataToSheet(s, data, String(entry.index));
    message = result.ok ? result.message : result.error;
  });
  syncSheetAfterClassOrBackgroundApply();
  setSheetApplyFeedback(message || "Classe aplicada.");
}

async function onSuggestHpMax() {
  const sheet = loadSheet();
  const suggested = computeSuggestedHpMax(sheet);
  if (suggested == null) {
    setSheetApplyFeedback("Define nível e dado de vida para sugerir PV.", true);
    return;
  }
  patchSheet((s) => {
    s.hpMax = String(suggested);
    if (!s.hpCurrent || Number(s.hpCurrent) > suggested) s.hpCurrent = String(suggested);
  });
  syncHpFields?.();
  setSheetApplyFeedback(`PV máximos sugeridos (média PHB): ${suggested}.`);
}

function pickBackgroundOptionText(opt) {
  if (!opt || typeof opt !== "object") return "";
  if (opt.string) return String(opt.string);
  if (opt.desc) return String(opt.desc);
  if (opt.name) return String(opt.name);
  return "";
}

function pickFromBackgroundTable(table) {
  if (!table || typeof table !== "object") return "";
  const options = table.from?.options || table.options || [];
  if (!Array.isArray(options) || !options.length) return "";
  const pick = options[Math.floor(Math.random() * options.length)];
  return pickBackgroundOptionText(pick).trim();
}

function applyBackgroundPersonalityToSheet(sheet, data) {
  if (!data) return { ok: false, error: "Sem dados do antecedente." };
  if (!sheet.personality) {
    sheet.personality = { traits: "", ideals: "", bonds: "", flaws: "" };
  }
  const traits = pickFromBackgroundTable(data.personality_traits);
  const ideals = pickFromBackgroundTable(data.ideals);
  const bonds = pickFromBackgroundTable(data.bonds);
  const flaws = pickFromBackgroundTable(data.flaws);
  const parts = [];
  if (traits) {
    sheet.personality.traits = traits.slice(0, 800);
    parts.push("traço");
  }
  if (ideals) {
    sheet.personality.ideals = ideals.slice(0, 800);
    parts.push("ideal");
  }
  if (bonds) {
    sheet.personality.bonds = bonds.slice(0, 800);
    parts.push("vínculo");
  }
  if (flaws) {
    sheet.personality.flaws = flaws.slice(0, 800);
    parts.push("defeito");
  }
  if (!parts.length) {
    return { ok: false, error: "Antecedente sem tabelas de personalidade na API." };
  }
  return {
    ok: true,
    message: `Personalidade do antecedente (${parts.join(", ")}) — valores aleatórios PHB. Clica de novo para rerrolar.`,
  };
}

function scrollToSheetBackgroundLibrary() {
  const group = document.getElementById("lib-backgrounds");
  const library = document.getElementById("sheetFavoritesLibrary");
  const target = group || library;
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  const section = group?.closest(".sheet-library-group");
  if (section) {
    section.classList.add("sheet-library-group--highlight");
    setTimeout(() => section.classList.remove("sheet-library-group--highlight"), 2500);
  }
  if (!group) {
    setSheetApplyFeedback(
      "Ainda não tens antecedentes nos favoritos. Usa o link «escolher na API», marca ★ e «+ Na ficha».",
      true,
      { target: "background" }
    );
    return false;
  }
  return true;
}

function initSheetPersonalityLinks() {
  document.getElementById("linkSheetLibraryBackgrounds")?.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToSheetBackgroundLibrary();
  });
  document.getElementById("linkExploreBackgrounds")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof openExplorerResource === "function") {
      openExplorerResource("backgrounds", apiListPath("backgrounds"));
    } else {
      navigateToAppPage("index.html");
    }
  });
}

async function onApplyBackgroundFromSheet() {
  setSheetApplyFeedback("A carregar antecedente…", false, { target: "background" });
  const entry = findPrimaryBackgroundOnSheet(loadSheet());
  if (!entry) {
    setSheetApplyFeedback(
      "Adiciona um antecedente à ficha — vê o link «biblioteca à esquerda» acima.",
      true,
      { target: "background" }
    );
    scrollToSheetBackgroundLibrary();
    return;
  }
  const data = await fetchEntryDataForSheet(entry);
  if (!data) {
    setSheetApplyFeedback("Não foi possível carregar o antecedente.", true, { target: "background" });
    return;
  }
  let message = "";
  let ok = false;
  patchSheet((s) => {
    const result = applyBackgroundPersonalityToSheet(s, data);
    ok = result.ok;
    message = result.ok ? result.message : result.error;
  });
  syncSheetAfterClassOrBackgroundApply();
  setSheetApplyFeedback(message, !ok, { target: "background" });
}

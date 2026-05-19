/**
 * v3.0 — Perícias, salvaguardas, condições, inspiração, concentração, inventário leve, personalidade.
 */
const SHEET_SKILL_LABELS = {
  acrobatics: "Acrobacia",
  "animal-handling": "Lidar com animais",
  arcana: "Arcanismo",
  athletics: "Atletismo",
  deception: "Enganação",
  history: "História",
  insight: "Intuição",
  intimidation: "Intimidação",
  investigation: "Investigação",
  medicine: "Medicina",
  nature: "Natureza",
  perception: "Percepção",
  performance: "Atuação",
  persuasion: "Persuasão",
  religion: "Religião",
  "sleight-of-hand": "Prestidigitação",
  stealth: "Furtividade",
  survival: "Sobrevivência",
};

let sheetCombatV3Bound = false;
let skillLabelsFromApi = null;

function getSkillLabel(index) {
  return skillLabelsFromApi?.[index] || SHEET_SKILL_LABELS[index] || index;
}

function computeSkillBonus(sheet, skillIndex) {
  return typeof computeSkillBonusFromSheet === "function"
    ? computeSkillBonusFromSheet(sheet, skillIndex)
    : 0;
}

function computeSaveBonus(sheet, abilityKey) {
  return typeof computeSaveBonusFromSheet === "function"
    ? computeSaveBonusFromSheet(sheet, abilityKey)
    : 0;
}

function cycleSkillProfRank(current) {
  const order = ["none", "half", "prof", "expertise"];
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}

function skillRankLabel(rank) {
  if (rank === "half") return "½";
  if (rank === "prof") return "●";
  if (rank === "expertise") return "2×";
  return "—";
}

function computeCarryingCapacity(sheet) {
  const str = Number(sheet.abilityScores.str);
  if (!Number.isFinite(str) || str < 1) return null;
  return str * 15;
}

function computeInventoryWeight(sheet) {
  let total = 0;
  for (const row of sheet.inventory || []) {
    const w = parseFloat(String(row.weight).replace(",", "."));
    if (Number.isFinite(w)) total += w * (row.qty || 1);
  }
  return total;
}

async function loadSkillLabelsFromApi() {
  if (skillLabelsFromApi) return;
  try {
    const res = await apiFetch(apiListPath("skills"));
    if (!res.ok) return;
    const data = await res.json();
    const map = {};
    for (const row of data.results || []) {
      if (row.index && row.name) map[row.index] = row.name;
    }
    if (Object.keys(map).length) skillLabelsFromApi = map;
  } catch {
    /* offline */
  }
}

function renderSavingThrows(sheet) {
  const el = document.getElementById("sheetSavingThrows");
  if (!el) return;
  const prof = proficiencyBonusFromLevel(sheet.characterLevel);
  el.innerHTML = ABILITY_KEYS.map((key) => {
    const bonus = computeSaveBonus(sheet, key);
    const checked = sheet.saveProficiencies[key] ? "checked" : "";
    return `
      <label class="sheet-save-row" data-ability="${key}">
        <input type="checkbox" class="sheet-save-prof" data-save="${key}" ${checked} aria-label="Proficiência em salvaguarda de ${ABILITY_LABELS[key] || key}" />
        <span class="sheet-save-ability">${escapeHtml(ABILITY_LABELS[key] || key)}</span>
        <span class="sheet-save-bonus" data-save-bonus="${key}">${escapeHtml(formatSignedMod(bonus))}</span>
      </label>`;
  }).join("");
  const hint = document.getElementById("sheetProfBonusHint");
  if (hint) hint.textContent = formatSignedMod(prof);
}

function renderSkills(sheet) {
  const el = document.getElementById("sheetSkills");
  if (!el) return;
  el.innerHTML = SHEET_SKILLS.map((skill) => {
    const bonus = computeSkillBonus(sheet, skill.index);
    const rank = getSkillProficiencyRank(sheet, skill.index);
    const abbr = ABILITY_LABELS[skill.ability] || skill.ability;
    return `
      <div class="sheet-skill-row" data-skill="${skill.index}">
        <button type="button" class="sheet-skill-rank-btn sheet-skill-rank-btn--${rank}" data-skill-rank="${skill.index}"
          aria-label="Proficiência em ${escapeHtml(getSkillLabel(skill.index))}: ${rank}" title="Clica para alternar: —, ½, prof., 2×">
          ${escapeHtml(skillRankLabel(rank))}
        </button>
        <span class="sheet-skill-name">${escapeHtml(getSkillLabel(skill.index))}</span>
        <span class="sheet-skill-ability" title="Atributo">${escapeHtml(abbr)}</span>
        <span class="sheet-skill-bonus" data-skill-bonus="${skill.index}">${escapeHtml(formatSignedMod(bonus))}</span>
      </div>`;
  }).join("");
}

function renderConditions(sheet) {
  const el = document.getElementById("sheetConditions");
  if (!el) return;
  const active = new Set(sheet.activeConditions || []);
  el.innerHTML = SHEET_CONDITION_OPTIONS.map((c) => {
    const on = active.has(c.index) ? " sheet-condition-chip--on" : "";
    const pressed = active.has(c.index) ? "true" : "false";
    return `
      <button type="button" class="sheet-condition-chip${on}" data-condition="${c.index}" aria-pressed="${pressed}">
        ${escapeHtml(c.label)}
      </button>`;
  }).join("");
}

function syncCombatV3Fields(sheet) {
  const inspBtn = document.getElementById("sheetInspirationBtn");
  if (inspBtn) {
    inspBtn.classList.toggle("sheet-inspiration--on", Boolean(sheet.inspiration));
    inspBtn.setAttribute("aria-pressed", sheet.inspiration ? "true" : "false");
    inspBtn.textContent = sheet.inspiration ? "Inspiração ativa" : "Sem inspiração";
  }

  const conc = document.getElementById("sheetConcentrationInput");
  if (conc && document.activeElement !== conc) conc.value = sheet.concentrationSpell || "";

  const p = sheet.personality || {};
  const fields = [
    ["traits", "sheetPersonalityTraits"],
    ["ideals", "sheetPersonalityIdeals"],
    ["bonds", "sheetPersonalityBonds"],
    ["flaws", "sheetPersonalityFlaws"],
  ];
  for (const [key, id] of fields) {
    const input = document.getElementById(id);
    if (input && document.activeElement !== input) input.value = p[key] || "";
  }

  const cur = sheet.currency || {};
  for (const coin of ["cp", "sp", "ep", "gp", "pp"]) {
    const input = document.getElementById(`sheetCurrency${coin.toUpperCase()}`);
    if (input && document.activeElement !== input) input.value = cur[coin] ?? "";
  }

  renderInventoryList(sheet);

  const cap = computeCarryingCapacity(sheet);
  const weight = computeInventoryWeight(sheet);
  const carryEl = document.getElementById("sheetCarrySummary");
  if (carryEl) {
    if (cap == null) {
      carryEl.textContent = "Carga: defina FOR para calcular (For × 15 lb).";
    } else {
      const wStr = weight > 0 ? `${weight.toFixed(1)} lb` : "0 lb";
      carryEl.textContent = `Carga: ${wStr} / ${cap} lb`;
      carryEl.classList.toggle("sheet-carry--over", weight > cap);
    }
  }
}

function renderInventoryList(sheet) {
  const list = document.getElementById("sheetInventoryList");
  if (!list) return;
  const rows = sheet.inventory || [];
  if (!rows.length) {
    list.innerHTML = `<p class="sheet-inventory-empty">Nenhum item. Adicione abaixo ou importe dos favoritos.</p>`;
    return;
  }
  list.innerHTML = rows
    .map(
      (row) => `
    <div class="sheet-inventory-row" data-inv-id="${escapeHtml(row.id)}">
      <span class="sheet-inventory-name">${escapeHtml(row.name)}</span>
      <span class="sheet-inventory-meta">×${row.qty}${row.weight ? ` · ${escapeHtml(row.weight)} lb` : ""}</span>
      <button type="button" class="sheet-inventory-remove" data-inv-remove="${escapeHtml(row.id)}" aria-label="Remover ${escapeHtml(row.name)}">×</button>
    </div>`
    )
    .join("");
}

function refreshCombatBonuses() {
  const sheet = loadSheet();
  document.querySelectorAll("[data-save-bonus]").forEach((el) => {
    const key = el.dataset.saveBonus;
    if (key) el.textContent = formatSignedMod(computeSaveBonus(sheet, key));
  });
  document.querySelectorAll("[data-skill-bonus]").forEach((el) => {
    const key = el.dataset.skillBonus;
    if (key) el.textContent = formatSignedMod(computeSkillBonus(sheet, key));
  });
  const hint = document.getElementById("sheetProfBonusHint");
  if (hint) hint.textContent = formatSignedMod(proficiencyBonusFromLevel(sheet.characterLevel));
  syncCombatV3Fields(sheet);
}

function syncSheetCombatV3() {
  const sheet = loadSheet();
  renderSavingThrows(sheet);
  renderSkills(sheet);
  renderConditions(sheet);
  syncCombatV3Fields(sheet);
}

function syncCombatStateToDmIfLinked() {
  if (typeof trySyncCombatStateToDm !== "function") return;
  trySyncCombatStateToDm(loadSheet());
}

function onCombatV3Click(e) {
  const rankBtn = e.target.closest("[data-skill-rank]");
  if (rankBtn?.dataset.skillRank) {
    const index = rankBtn.dataset.skillRank;
    patchSheet((s) => {
      if (!s.skillProficiencyRanks) s.skillProficiencyRanks = {};
      const next = cycleSkillProfRank(getSkillProficiencyRank(s, index));
      if (next === "none") {
        delete s.skillProficiencyRanks[index];
        delete s.skillProficiencies[index];
      } else {
        s.skillProficiencyRanks[index] = next;
        s.skillProficiencies[index] = next === "prof" || next === "expertise";
      }
    });
    renderSkills(loadSheet());
    refreshCombatBonuses();
    return;
  }

  const cond = e.target.closest("[data-condition]");
  if (cond?.dataset.condition) {
    const index = cond.dataset.condition;
    patchSheet((s) => {
      const set = new Set(s.activeConditions || []);
      if (set.has(index)) set.delete(index);
      else set.add(index);
      s.activeConditions = [...set];
    });
    renderConditions(loadSheet());
    syncCombatStateToDmIfLinked();
    return;
  }

  if (e.target.closest("#sheetInspirationBtn")) {
    patchSheet((s) => {
      s.inspiration = !s.inspiration;
    });
    syncCombatV3Fields(loadSheet());
    syncCombatStateToDmIfLinked();
    return;
  }

  const removeBtn = e.target.closest("[data-inv-remove]");
  if (removeBtn?.dataset.invRemove) {
    const id = removeBtn.dataset.invRemove;
    patchSheet((s) => {
      s.inventory = (s.inventory || []).filter((r) => r.id !== id);
    });
    syncCombatV3Fields(loadSheet());
  }
}

function onCombatV3Change(e) {
  const saveCb = e.target.closest(".sheet-save-prof");
  if (saveCb?.dataset.save) {
    const key = saveCb.dataset.save;
    patchSheet((s) => {
      s.saveProficiencies[key] = saveCb.checked;
    });
    refreshCombatBonuses();
    return;
  }

  if (e.target.id === "sheetConcentrationInput") {
    patchSheet((s) => {
      s.concentrationSpell = e.target.value;
    });
    syncCombatStateToDmIfLinked();
    return;
  }

  const persIds = {
    sheetPersonalityTraits: "traits",
    sheetPersonalityIdeals: "ideals",
    sheetPersonalityBonds: "bonds",
    sheetPersonalityFlaws: "flaws",
  };
  if (persIds[e.target.id]) {
    const field = persIds[e.target.id];
    patchSheet((s) => {
      if (!s.personality) s.personality = { traits: "", ideals: "", bonds: "", flaws: "" };
      s.personality[field] = e.target.value;
    });
    return;
  }

  const coinMatch = e.target.id?.match(/^sheetCurrency([A-Z]{2})$/);
  if (coinMatch) {
    const coin = coinMatch[1].toLowerCase();
    patchSheet((s) => {
      if (!s.currency) s.currency = { cp: "", sp: "", ep: "", gp: "", pp: "" };
      s.currency[coin] = e.target.value;
    });
  }
}

function onInventoryAdd(e) {
  e.preventDefault();
  const nameEl = document.getElementById("sheetInventoryName");
  const qtyEl = document.getElementById("sheetInventoryQty");
  const weightEl = document.getElementById("sheetInventoryWeight");
  const name = nameEl?.value?.trim();
  if (!name) return;
  const qty = Math.max(1, Math.floor(Number(qtyEl?.value) || 1));
  const weight = weightEl?.value?.trim() || "";
  patchSheet((s) => {
    if (!Array.isArray(s.inventory)) s.inventory = [];
    s.inventory.push({
      id: `inv-${Date.now()}`,
      name: name.slice(0, 120),
      qty,
      weight,
    });
  });
  if (nameEl) nameEl.value = "";
  if (qtyEl) qtyEl.value = "1";
  if (weightEl) weightEl.value = "";
  syncCombatV3Fields(loadSheet());
}

function initSheetCombatV3() {
  const section = document.getElementById("sheetCombatV3Section");
  if (!section) return;

  loadSkillLabelsFromApi().then(() => {
    renderSkills(loadSheet());
  });

  if (!sheetCombatV3Bound) {
    sheetCombatV3Bound = true;
    section.addEventListener("click", onCombatV3Click);
    section.addEventListener("change", onCombatV3Change);
    section.addEventListener("input", onCombatV3Change);
    const addForm = document.getElementById("sheetInventoryAddForm");
    addForm?.addEventListener("submit", onInventoryAdd);
  }

  syncSheetCombatV3();
}

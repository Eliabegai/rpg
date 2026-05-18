const favoritesLibrary = document.getElementById("favoritesLibrary");
const libraryEmpty = document.getElementById("libraryEmpty");
const sheetBoard = document.getElementById("sheetBoard");
const sheetEmpty = document.getElementById("sheetEmpty");
const characterNameInput = document.getElementById("characterName");
const localeSelect = document.getElementById("localeSelect");
const abilityScoresGrid = document.getElementById("abilityScoresGrid");
const armorClassInput = document.getElementById("armorClassInput");
const alignmentSelect = document.getElementById("alignmentSelect");
const alignmentSummary = document.getElementById("alignmentSummary");
const portraitInput = document.getElementById("portraitInput");
const portraitPreview = document.getElementById("portraitPreview");
const portraitPlaceholder = document.getElementById("portraitPlaceholder");
const portraitClear = document.getElementById("portraitClear");
const portraitError = document.getElementById("portraitError");

const PORTRAIT_MAX_BYTES = 380 * 1024;

const ABILITY_LABELS = {
  str: "FOR",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
};

const detailCache = new Map();
/** index → { name, abbreviation, desc, … } */
const alignmentsCache = new Map();
let alignmentsLoaded = false;

function patchSheet(mutator) {
  const sheet = loadSheet();
  mutator(sheet);
  saveSheet(sheet);
  return sheet;
}

function abilityModifier(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "—";
  const mod = Math.floor((n - 10) / 2);
  return mod >= 0 ? `+${mod}` : String(mod);
}

const rollAbilitiesBtn = document.getElementById("rollAbilitiesBtn");
const clearAbilitiesRollBtn = document.getElementById("clearAbilitiesRollBtn");
const abilityRollSets = document.getElementById("abilityRollSets");
const abilityRollLegend = document.getElementById("abilityRollLegend");
const hitDieSelect = document.getElementById("hitDieSelect");
const rollHitDieBtn = document.getElementById("rollHitDieBtn");
const hitDieRollResult = document.getElementById("hitDieRollResult");
const hpMaxInput = document.getElementById("hpMaxInput");
const hpCurrentInput = document.getElementById("hpCurrentInput");
const hpTempInput = document.getElementById("hpTempInput");
const hpFullHealBtn = document.getElementById("hpFullHealBtn");
const hpHealAmount = document.getElementById("hpHealAmount");
const hpHealBtn = document.getElementById("hpHealBtn");
const deathSaveSuccess = document.getElementById("deathSaveSuccess");
const deathSaveFailure = document.getElementById("deathSaveFailure");
const deathSaveResetBtn = document.getElementById("deathSaveResetBtn");
const d20Panel = document.getElementById("d20Panel");
const d20Arena = document.getElementById("d20Arena");
const d20Racer = document.getElementById("d20Racer");
const d20Stage = document.getElementById("d20Stage");
const d20Face = document.getElementById("d20Face");
const d20Outcome = document.getElementById("d20Outcome");
const d20ModifierInput = document.getElementById("d20ModifierInput");
const rollD20Btn = document.getElementById("rollD20Btn");
const d20ResultText = document.getElementById("d20ResultText");
const dmgPanel = document.getElementById("dmgPanel");
const dmgArena = document.getElementById("dmgArena");
const dmgFormula = document.getElementById("dmgFormula");
const dmgEmpty = document.getElementById("dmgEmpty");
const dmgDiceField = document.getElementById("dmgDiceField");
const dmgModifierInput = document.getElementById("dmgModifierInput");
const rollDmgBtn = document.getElementById("rollDmgBtn");
const clearDmgBtn = document.getElementById("clearDmgBtn");
const dmgResultText = document.getElementById("dmgResultText");
const gameToolsFab = document.getElementById("gameToolsFab");
const gameToolsOpenHeader = document.getElementById("gameToolsOpenHeader");
const gameToolsBackdrop = document.getElementById("gameToolsBackdrop");
const gameToolsPanel = document.getElementById("gameToolsPanel");
const gameToolsClose = document.getElementById("gameToolsClose");

function rollD6() {
  return 1 + Math.floor(Math.random() * 6);
}

function roll4d6DropLowest() {
  const rolls = [rollD6(), rollD6(), rollD6(), rollD6()];
  let minIdx = 0;
  for (let i = 1; i < rolls.length; i++) {
    if (rolls[i] < rolls[minIdx]) minIdx = i;
  }
  const dropped = rolls[minIdx];
  const total = rolls.reduce((sum, v) => sum + v, 0) - dropped;
  return { rolls, dropped, droppedIndex: minIdx, total };
}

let abilityRollTicker = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function buildRollingDiceHtml() {
  return [0, 1, 2, 3]
    .map(() => `<span class="sheet-die sheet-die--rolling" aria-hidden="true">–</span>`)
    .join("");
}

function ensureSetDroppedIndex(set) {
  if (set.droppedIndex != null && set.droppedIndex >= 0 && set.droppedIndex < set.rolls.length) {
    return set.droppedIndex;
  }
  if (!set.rolls?.length) return 0;
  let minIdx = 0;
  for (let i = 1; i < set.rolls.length; i++) {
    if (set.rolls[i] < set.rolls[minIdx]) minIdx = i;
  }
  return minIdx;
}

function renderDieFacesHtml(set) {
  const droppedIndex = ensureSetDroppedIndex(set);
  return set.rolls
    .map((d, di) => {
      const dropped = di === droppedIndex;
      const cls = dropped ? " sheet-die--dropped" : " sheet-die--kept";
      const title = dropped ? "Descartado" : "Conta para o total";
      return `<span class="sheet-die${cls}" title="${title}">${d}</span>`;
    })
    .join("");
}

function renderAbilityRollAnimationPlaceholder() {
  if (!abilityRollSets) return;
  abilityRollSets.classList.add("is-rolling");
  abilityRollSets.innerHTML = Array.from(
    { length: 7 },
    (_, i) => `<li class="sheet-ability-roll sheet-ability-roll--rolling-row" style="--roll-row-delay:${i * 0.05}s">
      <span class="sheet-ability-roll-num">#${i + 1}</span>
      <span class="sheet-ability-roll-dice">${buildRollingDiceHtml()}</span>
      <span class="sheet-ability-roll-total sheet-ability-roll-total--pending" aria-hidden="true">…</span>
    </li>`
  ).join("");
}

function startAbilityRollAnimation() {
  renderAbilityRollAnimationPlaceholder();
  if (abilityRollTicker) clearInterval(abilityRollTicker);
  abilityRollTicker = setInterval(() => {
    abilityRollSets?.querySelectorAll(".sheet-die--rolling").forEach((die) => {
      die.textContent = String(rollD6());
    });
  }, 70);
  return () => {
    if (abilityRollTicker) {
      clearInterval(abilityRollTicker);
      abilityRollTicker = null;
    }
  };
}

function setAbilityRollControlsBusy(busy) {
  if (rollAbilitiesBtn) {
    rollAbilitiesBtn.disabled = busy;
    rollAbilitiesBtn.setAttribute("aria-busy", String(busy));
  }
  if (clearAbilitiesRollBtn) clearAbilitiesRollBtn.disabled = busy;
}

async function rollAbilityGeneration() {
  if (rollAbilitiesBtn?.disabled) return;

  const reducedMotion = prefersReducedMotion();
  setAbilityRollControlsBusy(true);

  if (!reducedMotion) {
    const stopTicker = startAbilityRollAnimation();
    await delay(1650);
    stopTicker();
  }

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
  patchSheet((sheet) => {
    sheet.abilityGeneration = { sets, assignment: {} };
  });
  renderAbilityRollSets({ reveal: !reducedMotion });
  syncAbilityAssignDropdowns();
  setAbilityRollControlsBusy(false);
}

function clearAbilityGeneration() {
  if (abilityRollTicker) {
    clearInterval(abilityRollTicker);
    abilityRollTicker = null;
  }
  patchSheet((sheet) => {
    sheet.abilityGeneration = { sets: [], assignment: {} };
  });
  renderAbilityRollSets();
  syncAbilityAssignDropdowns();
  setAbilityRollControlsBusy(false);
}

function getActiveAbilitySets(sheet) {
  return (sheet.abilityGeneration?.sets || []).filter((s) => !s.inactive);
}

function renderAbilityRollSets({ reveal = false } = {}) {
  if (!abilityRollSets) return;
  const sheet = loadSheet();
  const sets = sheet.abilityGeneration?.sets || [];
  if (clearAbilitiesRollBtn) clearAbilitiesRollBtn.hidden = sets.length === 0;

  abilityRollSets.classList.remove("is-rolling");

  if (abilityRollLegend) abilityRollLegend.hidden = sets.length === 0;

  if (!sets.length) {
    abilityRollSets.innerHTML = "";
    return;
  }

  abilityRollSets.innerHTML = sets
    .map((set, i) => {
      const diceHtml = renderDieFacesHtml(set);
      const inactive = set.inactive ? " sheet-ability-roll--inactive" : "";
      const revealCls = reveal ? " sheet-ability-roll--reveal" : "";
      const note = set.inactive
        ? '<span class="sheet-ability-roll-note sheet-ability-roll-note--struck">menor — referência (descartado)</span>'
        : "";
      const delayStyle = reveal ? ` style="--reveal-delay:${i * 0.07}s"` : "";
      return `<li class="sheet-ability-roll${inactive}${revealCls}"${delayStyle}>
        <span class="sheet-ability-roll-num">#${i + 1}</span>
        <span class="sheet-ability-roll-dice">${diceHtml}</span>
        <strong class="sheet-ability-roll-total${set.inactive ? " sheet-ability-roll-total--discarded" : ""}">${set.total}</strong>
        ${note}
      </li>`;
    })
    .join("");
}

function syncAbilityAssignDropdowns() {
  if (!abilityScoresGrid) return;
  const sheet = loadSheet();
  const sets = sheet.abilityGeneration?.sets || [];
  const hasRolls = getActiveAbilitySets(sheet).length > 0;

  abilityScoresGrid.querySelectorAll(".sheet-ability-assign").forEach((sel) => {
    const key = sel.dataset.ability;
    if (!key) return;
    sel.hidden = !hasRolls;
    const current = sheet.abilityGeneration?.assignment?.[key] || "";
    const assignedElsewhere = new Set(
      ABILITY_KEYS.filter((k) => k !== key && sheet.abilityGeneration?.assignment?.[k]).map(
        (k) => sheet.abilityGeneration.assignment[k]
      )
    );

    let html = '<option value="">— manual —</option>';
    for (const set of sets) {
      if (set.inactive) continue;
      if (assignedElsewhere.has(set.id) && current !== set.id) continue;
      const selected = current === set.id ? " selected" : "";
      html += `<option value="${escapeHtml(set.id)}"${selected}>${set.total}</option>`;
    }
    sel.innerHTML = html;
    if (document.activeElement !== sel) sel.value = current;
  });
}

function parseDieSides(die) {
  const m = String(die || "d10").match(/^d(\d+)$/i);
  return m ? Number(m[1]) : 10;
}

function rollDie(sides) {
  return 1 + Math.floor(Math.random() * sides);
}

let hitDieRollTicker = null;
let d20RollActive = false;
let d20CornerHitTimer = null;

const D20_ROLL_TICK_MS = [
  58, 58, 62, 66, 72, 78, 86, 94, 106, 118, 132, 150, 172, 198, 228, 265, 310, 365, 430, 520, 640,
];

function clampD20Modifier(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-20, Math.min(20, Math.floor(n)));
}

function readD20Modifier() {
  return clampD20Modifier(Number(d20ModifierInput?.value));
}

function formatRollModifier(mod) {
  if (mod === 0) return "+0";
  return mod > 0 ? `+ ${mod}` : String(mod);
}

function resetD20StageClasses() {
  d20Stage?.classList.remove(
    "is-rolling",
    "is-slowing",
    "is-landing",
    "is-landed",
    "is-crit",
    "is-fumble",
    "is-corner-hit"
  );
}

function setD20Face(value) {
  if (!d20Face) return;
  d20Face.textContent = String(value);
  d20Face.dataset.value = String(value);
}

function getArenaBounds() {
  const pad = 22;
  const w = d20Arena?.clientWidth ?? 280;
  const h = d20Arena?.clientHeight ?? 120;
  const size = d20Stage?.offsetWidth ?? 116;
  return {
    size,
    center: { left: (w - size) / 2, top: (h - size) / 2 },
    corners: [
      { left: pad, top: pad },
      { left: w - size - pad, top: pad },
      { left: w - size - pad, top: h - size - pad },
      { left: pad, top: h - size - pad },
    ],
  };
}

function clearD20CornerHitTimer() {
  if (d20CornerHitTimer) {
    clearTimeout(d20CornerHitTimer);
    d20CornerHitTimer = null;
  }
}

function pulseD20CornerHit(delayMs) {
  clearD20CornerHitTimer();
  d20CornerHitTimer = setTimeout(() => {
    d20Stage?.classList.remove("is-corner-hit");
    void d20Stage?.offsetWidth;
    d20Stage?.classList.add("is-corner-hit");
    d20CornerHitTimer = null;
  }, delayMs);
}

function moveD20RacerTo(pos, durationMs, { hit = true } = {}) {
  if (!d20Racer) return;
  const ms = Math.max(95, durationMs);
  const ease =
    ms > 220 ? "cubic-bezier(0.22, 1, 0.36, 1)" : "cubic-bezier(0.55, 0.06, 0.68, 0.99)";
  d20Racer.style.transition = `left ${ms}ms ${ease}, top ${ms}ms ${ease}`;
  d20Racer.style.left = `${pos.left}px`;
  d20Racer.style.top = `${pos.top}px`;
  if (hit) pulseD20CornerHit(ms);
}

function prepareD20RacerForBounce() {
  if (!d20Racer) return;
  d20Racer.style.transform = "none";
  const { center } = getArenaBounds();
  d20Racer.style.left = `${center.left}px`;
  d20Racer.style.top = `${center.top}px`;
}

function resetD20RacerPosition() {
  if (!d20Racer) return;
  d20Racer.style.transition = "";
  d20Racer.style.left = "";
  d20Racer.style.top = "";
  d20Racer.style.transform = "";
}

async function expandD20Panel() {
  d20Panel?.classList.add("is-expanded");
  await delay(380);
  prepareD20RacerForBounce();
}

async function collapseD20Panel() {
  const { center } = getArenaBounds();
  moveD20RacerTo(center, 360, { hit: false });
  await delay(360);
  resetD20RacerPosition();
  d20Panel?.classList.remove("is-expanded", "is-rolling", "is-slowing");
}

async function animateD20Suspense(finalNatural) {
  if (!d20Face || !d20Stage || !d20Arena || !d20Racer || !d20Panel) return;

  try {
    await expandD20Panel();
    d20Panel.classList.add("is-rolling");
    resetD20StageClasses();
    d20Stage.classList.add("is-rolling");

    const center = () => getArenaBounds().center;
    const corners = () => getArenaBounds().corners;
    let cornerIndex = 0;
    const slowAt = Math.floor(D20_ROLL_TICK_MS.length * 0.52);
    const settleAt = D20_ROLL_TICK_MS.length - 4;

    for (let i = 0; i < D20_ROLL_TICK_MS.length; i++) {
      const ms = D20_ROLL_TICK_MS[i];

      if (i === slowAt) {
        d20Stage.classList.remove("is-rolling");
        d20Stage.classList.add("is-slowing");
        d20Panel.classList.remove("is-rolling");
        d20Panel.classList.add("is-slowing");
        moveD20RacerTo(center(), ms, { hit: false });
      } else if (i < slowAt) {
        moveD20RacerTo(corners()[cornerIndex % corners().length], Math.round(ms * 1.12));
        cornerIndex += 1;
      } else if (i >= slowAt && i < settleAt) {
        const jitter = 18;
        const c = center();
        moveD20RacerTo(
          {
            left: c.left + (Math.random() - 0.5) * jitter * 2,
            top: c.top + (Math.random() - 0.5) * jitter * 2,
          },
          Math.round(ms * 0.75),
          { hit: i % 2 === 0 }
        );
      }

      setD20Face(i >= settleAt ? finalNatural : rollDie(20));
      await delay(ms);
    }

    d20Stage.classList.remove("is-slowing");
    d20Stage.classList.add("is-landing");
    moveD20RacerTo(center(), 0, { hit: false });
    setD20Face(finalNatural);
    await delay(240);

    d20Stage.classList.remove("is-landing");
    d20Stage.classList.add("is-landed");
    if (finalNatural === 20) d20Stage.classList.add("is-crit");
    if (finalNatural === 1) d20Stage.classList.add("is-fumble");

    await delay(380);
  } finally {
    clearD20CornerHitTimer();
    await collapseD20Panel();
  }
}

function presentD20Result(natural, modifier) {
  const total = natural + modifier;
  const modLabel = formatRollModifier(modifier);

  if (d20Outcome) {
    if (natural === 20) {
      d20Outcome.textContent = "Crítico natural!";
      d20Outcome.hidden = false;
    } else if (natural === 1) {
      d20Outcome.textContent = "Falha crítica";
      d20Outcome.hidden = false;
    } else {
      d20Outcome.hidden = true;
    }
  }

  if (d20ResultText) {
    d20ResultText.textContent =
      modifier === 0 ? `Total: ${total}` : `${natural} ${modLabel} = ${total}`;
  }

  const aria =
    natural === 20
      ? `Crítico natural! ${natural} ${modLabel}, total ${total}`
      : natural === 1
        ? `Falha crítica. ${natural} ${modLabel}, total ${total}`
        : `Rolou ${natural} ${modLabel}, total ${total}`;
  if (d20Stage) d20Stage.setAttribute("aria-label", aria);

  return { natural, modifier, total };
}

async function rollD20Check() {
  if (d20RollActive) return;

  const modifier = readD20Modifier();
  const natural = rollDie(20);

  d20RollActive = true;
  if (rollD20Btn) {
    rollD20Btn.disabled = true;
    rollD20Btn.setAttribute("aria-busy", "true");
  }
  if (d20ResultText) d20ResultText.textContent = "";
  if (d20Outcome) d20Outcome.hidden = true;
  resetD20StageClasses();

  if (prefersReducedMotion()) {
    setD20Face(natural);
    if (natural === 20) d20Stage?.classList.add("is-crit", "is-landed");
    else if (natural === 1) d20Stage?.classList.add("is-fumble", "is-landed");
    else d20Stage?.classList.add("is-landed");
  } else {
    await animateD20Suspense(natural);
  }

  const result = presentD20Result(natural, modifier);

  d20RollActive = false;
  if (rollD20Btn) {
    rollD20Btn.disabled = false;
    rollD20Btn.setAttribute("aria-busy", "false");
  }
  return result;
}

function onD20ModifierChange() {
  const mod = readD20Modifier();
  if (d20ModifierInput && d20ModifierInput.value !== String(mod)) {
    d20ModifierInput.value = String(mod);
  }
  patchSheet((sheet) => {
    sheet.d20Modifier = String(mod);
  });
}

function syncD20Fields() {
  const sheet = loadSheet();
  if (d20ModifierInput && document.activeElement !== d20ModifierInput) {
    d20ModifierInput.value = sheet.d20Modifier ?? "0";
  }
}

const DAMAGE_ROLL_TICK_MS = [55, 58, 62, 68, 76, 88, 102, 120, 145, 175, 210, 260, 320, 400];
const MAX_DAMAGE_DICE = 24;

let dmgRollActive = false;

function newDamageDieId() {
  return `dmg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clampDamageModifier(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-99, Math.min(99, Math.floor(n)));
}

function readDamageModifier() {
  return clampDamageModifier(Number(dmgModifierInput?.value));
}

function getDamageRollState(sheet = loadSheet()) {
  return sheet.damageRoll ?? { modifier: "0", pool: [] };
}

function formatDamageFormula(pool, modifier = 0) {
  if (!pool?.length) return "—";
  const counts = {};
  for (const die of pool) {
    counts[die.sides] = (counts[die.sides] || 0) + 1;
  }
  const parts = DAMAGE_DIE_SIDES.filter((s) => counts[s]).map((s) =>
    counts[s] === 1 ? `d${s}` : `${counts[s]}d${s}`
  );
  const mod = clampDamageModifier(modifier);
  let formula = parts.join(" + ");
  if (mod !== 0) formula += ` ${formatRollModifier(mod)}`;
  return formula;
}

function renderDamagePoolUi() {
  const sheet = loadSheet();
  const { pool, modifier } = getDamageRollState(sheet);
  const mod = readDamageModifier();

  if (dmgFormula) dmgFormula.textContent = formatDamageFormula(pool, mod);
  if (clearDmgBtn) clearDmgBtn.hidden = pool.length === 0;

  if (!dmgDiceField || !dmgEmpty) return;

  if (pool.length === 0) {
    dmgEmpty.hidden = false;
    dmgDiceField.hidden = true;
    dmgDiceField.innerHTML = "";
    return;
  }

  dmgEmpty.hidden = true;
  dmgDiceField.hidden = false;
  dmgDiceField.innerHTML = pool
    .map(
      (die) => `<button type="button" class="sheet-dmg-die sheet-dmg-die--d${die.sides}"
        data-action="remove-damage-die" data-id="${escapeHtml(die.id)}" data-sides="${die.sides}"
        title="Remover d${die.sides}" aria-label="Remover d${die.sides}">
        <span class="sheet-dmg-die-shell" aria-hidden="true">
          <span class="sheet-dmg-die-shine"></span>
          <span class="sheet-dmg-die-facet"></span>
        </span>
        <span class="sheet-dmg-die-face">—</span>
        <span class="sheet-dmg-die-label">d${die.sides}</span>
      </button>`
    )
    .join("");
}

function syncDamageFields() {
  const sheet = loadSheet();
  const { modifier } = getDamageRollState(sheet);
  if (dmgModifierInput && document.activeElement !== dmgModifierInput) {
    dmgModifierInput.value = modifier ?? "0";
  }
  renderDamagePoolUi();
}

function addDamageDie(sides) {
  const n = Number(sides);
  if (!DAMAGE_DIE_SIDES.includes(n)) return;
  patchSheet((sheet) => {
    if (!sheet.damageRoll) sheet.damageRoll = { modifier: "0", pool: [] };
    if (sheet.damageRoll.pool.length >= MAX_DAMAGE_DICE) return;
    sheet.damageRoll.pool.push({ id: newDamageDieId(), sides: n });
  });
  renderDamagePoolUi();
}

function removeDamageDie(id) {
  if (!id) return;
  patchSheet((sheet) => {
    if (!sheet.damageRoll?.pool) return;
    sheet.damageRoll.pool = sheet.damageRoll.pool.filter((d) => d.id !== id);
  });
  renderDamagePoolUi();
}

function clearDamagePool() {
  patchSheet((sheet) => {
    sheet.damageRoll = { modifier: readDamageModifier(), pool: [] };
  });
  if (dmgResultText) dmgResultText.textContent = "";
  renderDamagePoolUi();
}

function onDamageModifierChange() {
  const mod = readDamageModifier();
  if (dmgModifierInput && dmgModifierInput.value !== String(mod)) {
    dmgModifierInput.value = String(mod);
  }
  patchSheet((sheet) => {
    if (!sheet.damageRoll) sheet.damageRoll = { modifier: "0", pool: [] };
    sheet.damageRoll.modifier = String(mod);
  });
  renderDamagePoolUi();
}

function scatterDamageDicePositions() {
  dmgDiceField?.querySelectorAll(".sheet-dmg-die").forEach((el) => {
    const x = 6 + Math.random() * 72;
    const y = 8 + Math.random() * 68;
    el.style.setProperty("--dmg-x", `${x}%`);
    el.style.setProperty("--dmg-y", `${y}%`);
  });
}

function setDamageDieFace(el, value) {
  const face = el?.querySelector(".sheet-dmg-die-face");
  if (!face) return;
  face.textContent = String(value);
  face.dataset.value = String(value);
}

async function expandDamagePanel() {
  dmgPanel?.classList.add("is-expanded");
  await delay(380);
}

async function collapseDamagePanel() {
  dmgPanel?.classList.remove("is-expanded", "is-rolling", "is-slowing");
  dmgDiceField?.querySelectorAll(".sheet-dmg-die").forEach((el) => {
    el.style.removeProperty("--dmg-x");
    el.style.removeProperty("--dmg-y");
    el.classList.remove("is-rolling", "is-corner-hit");
  });
  await delay(300);
}

async function animateDamageRoll(rolls) {
  const diceEls = [...(dmgDiceField?.querySelectorAll(".sheet-dmg-die") ?? [])];
  if (!diceEls.length) return rolls;

  try {
    await expandDamagePanel();
    dmgPanel?.classList.add("is-rolling");
    scatterDamageDicePositions();

    diceEls.forEach((el) => {
      el.classList.add("is-rolling");
      el.disabled = true;
    });

    const slowAt = Math.floor(DAMAGE_ROLL_TICK_MS.length * 0.55);
    const settleAt = DAMAGE_ROLL_TICK_MS.length - 3;

    for (let i = 0; i < DAMAGE_ROLL_TICK_MS.length; i++) {
      const ms = DAMAGE_ROLL_TICK_MS[i];
      if (i === slowAt) {
        dmgPanel?.classList.add("is-slowing");
        diceEls.forEach((el) => el.classList.remove("is-rolling"));
        diceEls.forEach((el) => el.classList.add("is-rolling"));
      }

      diceEls.forEach((el, idx) => {
        const sides = rolls[idx]?.sides ?? Number(el.dataset.sides) ?? 6;
        const value = i >= settleAt ? rolls[idx].value : rollDie(sides);
        setDamageDieFace(el, value);
        if (i >= settleAt && i === DAMAGE_ROLL_TICK_MS.length - 1) {
          el.classList.remove("is-rolling");
          el.classList.add("is-landed", "is-corner-hit");
        }
      });

      if (i < slowAt && i % 2 === 0) scatterDamageDicePositions();
      await delay(ms);
    }

    await delay(350);
  } finally {
    diceEls.forEach((el) => {
      el.disabled = false;
    });
    await collapseDamagePanel();
  }

  return rolls;
}

function presentDamageResult(rolls, modifier) {
  const diceSum = rolls.reduce((s, r) => s + r.value, 0);
  const total = diceSum + modifier;
  const breakdown = rolls.map((r) => r.value).join(" + ");
  const modLabel = formatRollModifier(modifier);

  if (dmgResultText) {
    if (modifier === 0) {
      dmgResultText.textContent = `${breakdown} = ${total}`;
    } else {
      dmgResultText.textContent = `(${breakdown}) ${modLabel} = ${total}`;
    }
  }

  if (dmgArena) {
    const pool = getDamageRollState().pool;
    dmgArena.setAttribute(
      "aria-label",
      `Dano: ${formatDamageFormula(pool, modifier)}. Resultado ${total}.`
    );
  }

  return { rolls, diceSum, modifier, total };
}

async function rollDamagePool() {
  if (dmgRollActive) return;

  const sheet = loadSheet();
  const pool = getDamageRollState(sheet).pool;
  if (!pool.length) {
    if (dmgResultText) dmgResultText.textContent = "Adiciona pelo menos um dado.";
    return;
  }

  const modifier = readDamageModifier();
  const rolls = pool.map((die) => ({
    id: die.id,
    sides: die.sides,
    value: rollDie(die.sides),
  }));

  dmgRollActive = true;
  if (rollDmgBtn) {
    rollDmgBtn.disabled = true;
    rollDmgBtn.setAttribute("aria-busy", "true");
  }
  if (dmgResultText) dmgResultText.textContent = "";

  if (prefersReducedMotion()) {
    rolls.forEach((r) => {
      const el = dmgDiceField?.querySelector(`[data-id="${r.id}"]`);
      if (el) {
        setDamageDieFace(el, r.value);
        el.classList.add("is-landed");
      }
    });
  } else {
    await animateDamageRoll(rolls);
  }

  const result = presentDamageResult(rolls, modifier);

  dmgRollActive = false;
  if (rollDmgBtn) {
    rollDmgBtn.disabled = false;
    rollDmgBtn.setAttribute("aria-busy", "false");
  }
  return result;
}

async function rollHitDie() {
  const sides = parseDieSides(hitDieSelect?.value);
  if (!hitDieRollResult) return rollDie(sides);

  if (rollHitDieBtn) rollHitDieBtn.disabled = true;

  hitDieRollResult.classList.add("is-rolling");
  if (!prefersReducedMotion()) {
    if (hitDieRollTicker) clearInterval(hitDieRollTicker);
    hitDieRollTicker = setInterval(() => {
      hitDieRollResult.textContent = String(rollDie(sides));
    }, 65);
    await delay(850);
    if (hitDieRollTicker) {
      clearInterval(hitDieRollTicker);
      hitDieRollTicker = null;
    }
  }

  const result = rollDie(sides);
  hitDieRollResult.classList.remove("is-rolling");
  hitDieRollResult.textContent = `Rolou ${result} (d${sides})`;
  hitDieRollResult.dataset.lastRoll = String(result);

  if (rollHitDieBtn) rollHitDieBtn.disabled = false;
  return result;
}

function clampHpValue(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(999, Math.floor(n)));
}

function readHpFromInputs() {
  return {
    max: hpMaxInput?.value ?? "",
    current: hpCurrentInput?.value ?? "",
    temp: hpTempInput?.value ?? "0",
  };
}

function syncHpFields() {
  const sheet = loadSheet();
  if (hitDieSelect && document.activeElement !== hitDieSelect) {
    hitDieSelect.value = sheet.hitDie || "d10";
  }
  if (hpMaxInput && document.activeElement !== hpMaxInput) hpMaxInput.value = sheet.hpMax;
  if (hpCurrentInput && document.activeElement !== hpCurrentInput) hpCurrentInput.value = sheet.hpCurrent;
  if (hpTempInput && document.activeElement !== hpTempInput) hpTempInput.value = sheet.hpTemp ?? "0";
}

function buildDeathSaveDots() {
  const mk = (container, type) => {
    if (!container) return;
    container.innerHTML = [1, 2, 3]
      .map(
        (n) =>
          `<button type="button" class="sheet-death-dot" data-save-type="${type}" data-level="${n}" aria-label="${type === "success" ? "Sucesso" : "Falha"} ${n}"></button>`
      )
      .join("");
  };
  mk(deathSaveSuccess, "success");
  mk(deathSaveFailure, "failure");
}

function renderDeathSaves() {
  const sheet = loadSheet();
  const { successes, failures } = sheet.deathSaves || { successes: 0, failures: 0 };
  deathSaveSuccess?.querySelectorAll(".sheet-death-dot").forEach((btn) => {
    const level = Number(btn.dataset.level);
    btn.classList.toggle("is-filled", level <= successes);
    btn.setAttribute("aria-pressed", String(level <= successes));
  });
  deathSaveFailure?.querySelectorAll(".sheet-death-dot").forEach((btn) => {
    const level = Number(btn.dataset.level);
    btn.classList.toggle("is-filled", level <= failures);
    btn.setAttribute("aria-pressed", String(level <= failures));
  });
}

function getClassProficiencyPicks(sheet, entryId, blockIndex) {
  const byEntry = sheet.classProficiencyPicks[entryId];
  if (!byEntry) return [];
  return byEntry[String(blockIndex)] || [];
}

function setClassProficiencyPicks(entryId, blockIndex, picks) {
  patchSheet((sheet) => {
    if (!sheet.classProficiencyPicks[entryId]) sheet.classProficiencyPicks[entryId] = {};
    sheet.classProficiencyPicks[entryId][String(blockIndex)] = picks;
  });
}

function isOnSheet(entry) {
  const sheet = loadSheet();
  return sheet.items.some(
    (i) => i.resourceKey === entry.resourceKey && String(i.index) === String(entry.index)
  );
}

function toggleSheetItem(entry) {
  const sheet = loadSheet();
  const ix = sheet.items.findIndex(
    (i) => i.resourceKey === entry.resourceKey && String(i.index) === String(entry.index)
  );
  if (ix >= 0) {
    sheet.items.splice(ix, 1);
  } else {
    const fav = findFavorite(entry.resourceKey, entry.index);
    const item = {
      resourceKey: entry.resourceKey,
      index: String(entry.index),
      name: entry.name != null ? String(entry.name) : String(entry.index),
      path: cleanApiPath(entry.path || ""),
    };
    if (fav?.cachedData) {
      applyCacheToEntry(item, fav.cachedData, fav.dataLocale || currentLocale);
    }
    sheet.items.push(item);
  }
  saveSheet(sheet);
  renderAll();
}

function removeFromSheet(resourceKey, index) {
  const sheet = loadSheet();
  sheet.items = sheet.items.filter(
    (i) => !(i.resourceKey === resourceKey && String(i.index) === String(index))
  );
  saveSheet(sheet);
  renderAll();
}

function groupFavorites(favorites) {
  const groups = new Map();
  for (const f of favorites) {
    const key = f.resourceKey || "outros";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }));
  }
  const keys = [...groups.keys()].sort((a, b) => {
    const ia = SHEET_RESOURCE_ORDER.indexOf(a);
    const ib = SHEET_RESOURCE_ORDER.indexOf(b);
    const ra = ia === -1 ? 999 : ia;
    const rb = ib === -1 ? 999 : ib;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return keys.map((k) => [k, groups.get(k)]);
}

function renderLibrary() {
  const favorites = loadFavorites();
  if (!favoritesLibrary || !libraryEmpty) return;

  if (favorites.length === 0) {
    favoritesLibrary.innerHTML = "";
    libraryEmpty.hidden = false;
    return;
  }

  libraryEmpty.hidden = true;
  const groups = groupFavorites(favorites);
  favoritesLibrary.innerHTML = groups
    .map(([resourceKey, items]) => {
      const title = formatResourceLabel(resourceKey);
      const rows = items
        .map((entry) => {
          const on = isOnSheet(entry);
          const id = favoriteEntryId(entry);
          return `<li class="sheet-library-item">
            <span class="sheet-library-item-name">${escapeHtml(entry.name || entry.index)}</span>
            <button
              type="button"
              class="sheet-toggle-btn${on ? " is-on-sheet" : ""}"
              data-action="toggle-sheet"
              data-resource="${escapeHtml(entry.resourceKey)}"
              data-index="${escapeHtml(String(entry.index))}"
              data-name="${escapeHtml(entry.name || "")}"
              data-path="${escapeHtml(entry.path || "")}"
              aria-pressed="${on}"
            >${on ? "Na ficha ✓" : "+ Na ficha"}</button>
          </li>`;
        })
        .join("");
      return `<section class="sheet-library-group" aria-labelledby="lib-${escapeHtml(resourceKey)}">
        <h2 class="sheet-library-group-title" id="lib-${escapeHtml(resourceKey)}">${escapeHtml(title)} <span class="sheet-count">(${items.length})</span></h2>
        <ul class="sheet-library-list">${rows}</ul>
      </section>`;
    })
    .join("");
}

function openInExplorer(entry) {
  openEntryInExplorer(entry);
}

function renderSheetSummary(resourceKey, data) {
  const rows = [];

  if (resourceKey === "races" || resourceKey === "subraces") {
    if (data.size) rows.push(["Tamanho", data.size]);
    if (data.speed != null) rows.push(["Deslocamento", `${data.speed} pés`]);
    if (Array.isArray(data.ability_bonuses) && data.ability_bonuses.length) {
      const bonuses = data.ability_bonuses
        .map((b) => `${b.ability_score?.name ?? b.ability_score?.index} +${b.bonus}`)
        .join(", ");
      rows.push(["Bónus", bonuses]);
    }
  } else if (resourceKey === "classes") {
    if (data.hit_die) rows.push(["Dado de vida", `d${data.hit_die}`]);
    if (Array.isArray(data.saving_throws) && data.saving_throws.length) {
      rows.push([
        "Salvaguardas",
        data.saving_throws.map((s) => s.name ?? s.index).join(", "),
      ]);
    }
  } else if (resourceKey === "backgrounds") {
    if (Array.isArray(data.feature?.desc)) {
      rows.push(["Característica", data.feature.desc[0].slice(0, 200) + (data.feature.desc[0].length > 200 ? "…" : "")]);
    } else if (data.feature?.name) {
      rows.push(["Característica", data.feature.name]);
    }
  } else if (resourceKey === "spells") {
    if (data.level !== undefined) rows.push(["Nível", data.level === 0 ? "Truque" : String(data.level)]);
    if (data.school?.name) rows.push(["Escola", data.school.name]);
    if (data.casting_time) rows.push(["Conjuração", data.casting_time]);
    if (data.range) rows.push(["Alcance", data.range]);
  } else if (resourceKey === "feats") {
    const featDesc = formatDescText(data.desc, 220);
    if (featDesc) rows.push(["Descrição", featDesc]);
  } else if (resourceKey === "alignments") {
    if (data.abbreviation) rows.push(["Abrev.", data.abbreviation]);
    const alignDesc = formatDescText(data.desc, 500);
    if (alignDesc) rows.push(["Descrição", alignDesc]);
  }

  const hasDescRow = rows.some(([k]) => k === "Descrição" || k === "Resumo");
  if (!hasDescRow && rows.length < 3) {
    const extra = formatDescText(data.desc, 240);
    if (extra) rows.push(["Resumo", extra]);
  }

  if (!rows.length) return "";

  return renderKeyValueRows(rows);
}

function formatDescText(desc, maxLen = 0) {
  let text = "";
  if (typeof desc === "string") text = desc;
  else if (Array.isArray(desc)) text = desc.map((d) => String(d)).join(" ").trim();
  if (!text) return "";
  if (maxLen > 0 && text.length > maxLen) return `${text.slice(0, maxLen)}…`;
  return text;
}

function renderAlignmentDetail(data) {
  const rows = [];
  if (data.abbreviation) rows.push(["Abrev.", data.abbreviation]);
  let html = renderKeyValueRows(rows);
  const desc = formatDescText(data.desc, 0);
  if (desc) {
    html += `<p class="detail-text sheet-alignment-desc">${escapeHtml(desc)}</p>`;
  }
  if (!html) return '<p class="sheet-card-muted">Sem descrição para este alinhamento.</p>';
  return html;
}

function renderKeyValueRows(rows) {
  if (!rows.length) return "";
  return `<dl class="detail-kv sheet-card-kv">${rows
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd>`)
    .join("")}</dl>`;
}

function formatEquipmentCost(cost) {
  if (!cost || cost.quantity == null) return "";
  const unit = cost.unit ? String(cost.unit) : "";
  return `${cost.quantity}${unit ? ` ${unit}` : ""}`.trim();
}

function formatArmorClass(ac) {
  if (!ac || ac.base == null) return "";
  let text = String(ac.base);
  if (ac.dex_bonus) {
    text += " + modificador de DES";
    if (ac.max_bonus != null) text += ` (máx. +${ac.max_bonus})`;
  } else {
    text += " (CA fixa)";
  }
  return text;
}

function formatDamage(dmg) {
  if (!dmg?.damage_dice) return "";
  const type = dmg.damage_type?.name ?? dmg.damage_type?.index ?? "";
  return type ? `${dmg.damage_dice} ${type}` : String(dmg.damage_dice);
}

function isEquipmentLike(data) {
  return Boolean(
    data?.equipment_category ||
      data?.damage ||
      data?.armor_class ||
      data?.weapon_category ||
      data?.armor_category ||
      (Array.isArray(data?.contents) && data.contents.length > 0)
  );
}

function renderEquipmentDetail(data) {
  const rows = [];

  const cat = data.equipment_category?.name ?? data.equipment_category?.index;
  if (cat) rows.push(["Categoria", cat]);
  if (data.gear_category?.name) rows.push(["Tipo", data.gear_category.name]);
  if (data.weapon_category) {
    const range = data.weapon_range ? ` · ${data.weapon_range}` : "";
    rows.push(["Arma", `${data.weapon_category}${range}`]);
  }
  if (data.armor_category) rows.push(["Armadura", data.armor_category]);

  const acText = formatArmorClass(data.armor_class);
  if (acText) rows.push(["Defesa (CA)", acText]);

  const dmg = formatDamage(data.damage);
  if (dmg) rows.push(["Dano", dmg]);

  const twoHand = formatDamage(data.two_handed_damage);
  if (twoHand) rows.push(["Dano (duas mãos)", twoHand]);

  if (data.range?.normal != null) {
    const normal = data.range.normal;
    const long = data.range.long;
    rows.push(["Alcance", long != null ? `${normal} / ${long} pés` : `${normal} pés`]);
  }

  if (Array.isArray(data.properties) && data.properties.length) {
    rows.push(["Propriedades", data.properties.map((p) => p.name ?? p.index).join(", ")]);
  }

  if (data.str_minimum) rows.push(["FOR mínima", String(data.str_minimum)]);
  if (data.stealth_disadvantage) rows.push(["Furtividade", "Desvantagem"]);

  if (data.rarity?.name) rows.push(["Raridade", data.rarity.name]);

  const cost = formatEquipmentCost(data.cost);
  if (cost) rows.push(["Custo", cost]);
  if (data.weight != null) rows.push(["Peso", `${data.weight} lb`]);

  let html = renderKeyValueRows(rows);

  if (Array.isArray(data.contents) && data.contents.length) {
    const items = data.contents
      .map((c) => {
        const qty = c.quantity != null && c.quantity !== 1 ? `${c.quantity}× ` : "";
        const name = c.item?.name ?? c.item?.index ?? "—";
        return `${qty}${name}`;
      })
      .join(", ");
    html += `<h4 class="sheet-card-subtitle">Conteúdo</h4><p class="detail-text">${escapeHtml(items)}</p>`;
  }

  if (Array.isArray(data.desc) && data.desc.length) {
    const text = data.desc.map((d) => String(d)).join(" ").trim();
    if (text) {
      const short = text.length > 420 ? `${text.slice(0, 420)}…` : text;
      html += `<h4 class="sheet-card-subtitle">Descrição</h4><p class="detail-text">${escapeHtml(short)}</p>`;
    }
  }

  if (!html) {
    return '<p class="sheet-card-muted">Sem dados de dano ou defesa para este item.</p>';
  }
  return html;
}

function proficiencyOptionLabel(opt) {
  const item = opt?.item;
  if (item?.name) return item.name.replace(/^Skill:\s*/i, "");
  if (item?.index) return formatResourceLabel(String(item.index).replace(/^skill-/, ""));
  return "—";
}

function proficiencyOptionId(opt) {
  return opt?.item?.index ? String(opt.item.index) : "";
}

function renderClassProficiencyChoiceBlock(entry, block, blockIndex) {
  const entryId = favoriteEntryId(entry);
  const sheet = loadSheet();
  const max = block.choose != null ? Number(block.choose) : 2;
  const options = block.from?.option_set_type === "options_array" ? block.from.options || [] : [];
  const picks = getClassProficiencyPicks(sheet, entryId, blockIndex);
  const title =
    block.desc ||
    `Escolhe ${max} ${block.type ? formatResourceLabel(String(block.type)).toLowerCase() : "proficiências"}`;

  const items = options
    .map((opt) => {
      const id = proficiencyOptionId(opt);
      if (!id) return "";
      const checked = picks.includes(id);
      return `<li><label class="detail-pick-item">
        <input type="checkbox" class="detail-pick-input sheet-class-prof-pick" value="${escapeHtml(id)}"
          ${checked ? " checked" : ""} />
        <span class="detail-pick-text">${escapeHtml(proficiencyOptionLabel(opt))}</span>
      </label></li>`;
    })
    .filter(Boolean)
    .join("");

  return `<section class="sheet-class-prof-block">
    <h4 class="sheet-card-subtitle">${escapeHtml(title)}</h4>
    <fieldset class="detail-pick-list sheet-class-prof-fieldset"
      data-entry-id="${escapeHtml(entryId)}"
      data-block-index="${blockIndex}"
      data-max-choose="${max}">
      <ul class="detail-pick-ul">${items}</ul>
      <p class="detail-pick-hint">${escapeHtml(formatClassProfHint(picks.length, max))}</p>
    </fieldset>
  </section>`;
}

function formatClassProfHint(selected, max) {
  return max === 1 ? `${selected} / 1 selecionada` : `${selected} / ${max} selecionadas`;
}

function renderClassDetail(entry, data) {
  const rowsHtml = renderSheetSummary("classes", data);
  let html = rowsHtml || "";

  if (Array.isArray(data.proficiencies) && data.proficiencies.length) {
    html += `<h4 class="sheet-card-subtitle">Proficiências fixas</h4>
      <ul class="detail-chip-list">${data.proficiencies
        .map((p) => `<li><span class="detail-ref">${escapeHtml(p.name ?? p.index)}</span></li>`)
        .join("")}</ul>`;
  }

  const choices = Array.isArray(data.proficiency_choices)
    ? data.proficiency_choices
    : data.proficiency_choices
      ? [data.proficiency_choices]
      : [];

  choices.forEach((block, blockIndex) => {
    if (block?.from?.option_set_type === "options_array" && Array.isArray(block.from.options)) {
      html += renderClassProficiencyChoiceBlock(entry, block, blockIndex);
    }
  });

  if (!html) return '<p class="sheet-card-muted">Sem dados de classe.</p>';
  return html;
}

async function fetchSheetDetail(entry) {
  const path = cleanApiPath(entry.path);
  if (!path) return null;
  const cacheKey = `${currentLocale}:${path}`;

  const stored = getCachedEntryData(entry);
  if (stored) {
    detailCache.set(cacheKey, stored);
    return stored;
  }

  if (detailCache.has(cacheKey)) return detailCache.get(cacheKey);

  const res = await apiFetch(path);
  if (!res.ok) return null;
  const data = await res.json();
  detailCache.set(cacheKey, data);
  persistItemCacheForEntry(entry, data);
  return data;
}

function renderSheetCard(entry, { open = false } = {}) {
  const resourceLabel = formatResourceLabel(entry.resourceKey);
  const openAttr = open ? " open" : "";
  return `<article class="sheet-card" data-sheet-id="${escapeHtml(favoriteEntryId(entry))}">
    <details class="sheet-card-details"${openAttr}>
      <summary class="sheet-card-summary">
        <span class="sheet-card-resource">${escapeHtml(resourceLabel)}</span>
        <span class="sheet-card-name">${escapeHtml(entry.name || entry.index)}</span>
      </summary>
      <div class="sheet-card-body" data-path="${escapeHtml(cleanApiPath(entry.path))}">
        <p class="sheet-card-loading">A carregar…</p>
      </div>
    </details>
    <div class="sheet-card-actions">
      <button type="button" class="sheet-card-link" data-action="open-explorer"
        data-resource="${escapeHtml(entry.resourceKey)}"
        data-index="${escapeHtml(String(entry.index))}"
        data-name="${escapeHtml(entry.name || "")}"
        data-path="${escapeHtml(entry.path || "")}">Ver na exploração</button>
      <button type="button" class="sheet-card-remove" data-action="remove-sheet"
        data-resource="${escapeHtml(entry.resourceKey)}"
        data-index="${escapeHtml(String(entry.index))}">Remover da ficha</button>
    </div>
  </article>`;
}

function renderSheetBoard() {
  const sheet = loadSheet();
  if (!sheetBoard || !sheetEmpty) return;

  if (characterNameInput && characterNameInput.value !== sheet.characterName) {
    characterNameInput.value = sheet.characterName;
  }

  if (sheet.items.length === 0) {
    sheetBoard.innerHTML = "";
    sheetEmpty.hidden = false;
    return;
  }

  sheetEmpty.hidden = true;
  const grouped = groupFavorites(sheet.items);

  sheetBoard.innerHTML = grouped
    .map(([resourceKey, items], gi) => {
      const title = formatResourceLabel(resourceKey);
      const cards = items
        .map((entry, i) => renderSheetCard(entry, { open: gi === 0 && i === 0 }))
        .join("");
      return `<section class="sheet-section">
        <h2 class="sheet-section-title">${escapeHtml(title)}</h2>
        <div class="sheet-section-cards">${cards}</div>
      </section>`;
    })
    .join("");

  sheetBoard.querySelectorAll(".sheet-card-details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.open) loadCardBody(details.closest(".sheet-card"));
    });
    if (details.open) loadCardBody(details.closest(".sheet-card"));
  });
}

async function loadCardBody(cardEl) {
  if (!cardEl) return;
  const body = cardEl.querySelector(".sheet-card-body");
  if (!body || body.dataset.loaded === "1") return;

  const path = body.dataset.path;
  const sheetId = cardEl.dataset.sheetId;
  const sheet = loadSheet();
  const entry = sheet.items.find((i) => favoriteEntryId(i) === sheetId);
  if (!entry || !path) {
    body.innerHTML = '<p class="sheet-card-muted">Dados indisponíveis.</p>';
    body.dataset.loaded = "1";
    return;
  }

  try {
    const data = await fetchSheetDetail(entry);
    if (!data) {
      body.innerHTML = '<p class="sheet-card-muted">Não foi possível carregar.</p>';
    } else if (entry.resourceKey === "classes") {
      body.innerHTML = renderClassDetail(entry, data);
    } else if (
      entry.resourceKey === "equipment" ||
      entry.resourceKey === "magic-items" ||
      isEquipmentLike(data)
    ) {
      body.innerHTML = renderEquipmentDetail(data);
    } else if (entry.resourceKey === "alignments") {
      body.innerHTML = renderAlignmentDetail(data);
    } else {
      const html = renderSheetSummary(entry.resourceKey, data);
      body.innerHTML = html || '<p class="sheet-card-muted">Sem resumo para este item.</p>';
    }
  } catch {
    body.innerHTML = '<p class="sheet-card-muted">Erro de rede.</p>';
  }
  body.dataset.loaded = "1";
}

function renderAll() {
  syncCharacterCoreFromSheet();
  renderLibrary();
  renderSheetBoard();
}

function onSheetClick(e) {
  if (e.target.closest(".sheet-death-dot")) {
    onDeathSaveClick(e);
    return;
  }

  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const entry = {
    resourceKey: btn.dataset.resource,
    index: btn.dataset.index,
    name: btn.dataset.name,
    path: btn.dataset.path,
  };

  if (action === "toggle-sheet") {
    toggleSheetItem(entry);
    return;
  }
  if (action === "remove-sheet") {
    removeFromSheet(entry.resourceKey, entry.index);
    return;
  }
  if (action === "open-explorer") {
    openInExplorer(entry);
    return;
  }
  if (action === "roll-abilities") {
    rollAbilityGeneration();
    return;
  }
  if (action === "clear-abilities") {
    clearAbilityGeneration();
    return;
  }
  if (action === "roll-hit-die") {
    rollHitDie();
    return;
  }
  if (action === "roll-d20") {
    rollD20Check();
    return;
  }
  if (action === "add-damage-die") {
    addDamageDie(Number(btn.dataset.sides));
    return;
  }
  if (action === "remove-damage-die") {
    if (dmgRollActive) return;
    removeDamageDie(btn.dataset.id);
    return;
  }
  if (action === "roll-damage") {
    rollDamagePool();
    return;
  }
  if (action === "clear-damage") {
    clearDamagePool();
    return;
  }
  if (action === "open-game-tools") {
    openGameTools();
    return;
  }
  if (action === "game-tools-tab") {
    setGameToolsTab(btn.dataset.toolsTab);
    return;
  }
  if (action === "hp-full-heal") {
    onHpFullHeal();
    return;
  }
  if (action === "hp-heal") {
    onHpHeal();
    return;
  }
  if (action === "death-save-reset") {
    onDeathSaveReset();
  }
}

function onCharacterNameInput() {
  patchSheet((sheet) => {
    sheet.characterName = characterNameInput ? characterNameInput.value.trim() : "";
  });
}

function buildAbilityScoresGrid() {
  if (!abilityScoresGrid) return;
  abilityScoresGrid.innerHTML = ABILITY_KEYS.map(
    (key) => `<label class="sheet-ability-cell">
      <span class="sheet-ability-abbr">${ABILITY_LABELS[key]}</span>
      <select class="sheet-ability-assign sheet-select" data-ability="${key}" hidden aria-label="Atribuir ${ABILITY_LABELS[key]}">
        <option value="">— manual —</option>
      </select>
      <input type="number" class="sheet-ability-input" data-ability="${key}"
        min="1" max="30" inputmode="numeric" placeholder="10" />
      <span class="sheet-ability-mod" data-mod-for="${key}" aria-label="Modificador">—</span>
    </label>`
  ).join("");
}

function syncCharacterCoreFromSheet() {
  const sheet = loadSheet();

  if (characterNameInput && document.activeElement !== characterNameInput) {
    characterNameInput.value = sheet.characterName;
  }
  if (armorClassInput && document.activeElement !== armorClassInput) {
    armorClassInput.value = sheet.armorClass;
  }
  if (alignmentSelect && document.activeElement !== alignmentSelect) {
    alignmentSelect.value = sheet.alignment;
  }

  abilityScoresGrid?.querySelectorAll(".sheet-ability-input").forEach((input) => {
    const key = input.dataset.ability;
    if (!key || document.activeElement === input) return;
    input.value = sheet.abilityScores[key] ?? "";
    const modEl = abilityScoresGrid.querySelector(`[data-mod-for="${key}"]`);
    if (modEl) modEl.textContent = abilityModifier(input.value);
  });

  syncPortraitUi(sheet.portraitImage);
  syncAlignmentSummary();
  renderAbilityRollSets();
  syncAbilityAssignDropdowns();
  syncHpFields();
  syncD20Fields();
  syncDamageFields();
  renderDeathSaves();
}

async function syncAlignmentSummary() {
  if (!alignmentSummary) return;
  const sheet = loadSheet();
  const index = sheet.alignment;
  if (!index) {
    alignmentSummary.hidden = true;
    alignmentSummary.textContent = "";
    return;
  }

  let data = alignmentsCache.get(index);
  if (!data?.desc) {
    const fav = findFavorite("alignments", index);
    if (fav?.cachedData?.desc) {
      data = fav.cachedData;
      alignmentsCache.set(index, data);
    }
  }
  if (!data?.desc) {
    const cached = getCachedEntryData({
      resourceKey: "alignments",
      index,
      path: `/api/2014/alignments/${index}`,
    });
    if (cached?.desc) {
      data = cached;
      alignmentsCache.set(index, data);
    }
  }
  if (!data?.desc) {
    try {
      const res = await apiFetch(`/api/2014/alignments/${index}`);
      if (res.ok) {
        data = await res.json();
        alignmentsCache.set(index, data);
      }
    } catch {
      /* rede */
    }
  }

  const desc = formatDescText(data?.desc, 0);
  if (desc) {
    const name = data?.name ?? alignmentSelect?.selectedOptions?.[0]?.textContent ?? index;
    alignmentSummary.textContent = desc;
    alignmentSummary.hidden = false;
    alignmentSummary.setAttribute("aria-label", `Descrição: ${name}`);
  } else {
    alignmentSummary.hidden = true;
    alignmentSummary.textContent = "";
  }
}

function syncPortraitUi(dataUrl) {
  const has = Boolean(dataUrl);
  if (portraitPreview) {
    if (has) {
      portraitPreview.src = dataUrl;
      portraitPreview.hidden = false;
      portraitPreview.alt = characterNameInput?.value?.trim() || "Retrato do personagem";
    } else {
      portraitPreview.removeAttribute("src");
      portraitPreview.hidden = true;
    }
  }
  if (portraitPlaceholder) portraitPlaceholder.hidden = has;
  if (portraitClear) portraitClear.hidden = !has;
}

function showPortraitError(msg) {
  if (!portraitError) return;
  if (msg) {
    portraitError.textContent = msg;
    portraitError.hidden = false;
  } else {
    portraitError.hidden = true;
    portraitError.textContent = "";
  }
}

function onPortraitSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  showPortraitError("");
  if (!file.type.startsWith("image/")) {
    showPortraitError("Escolhe um ficheiro de imagem (JPEG, PNG, WebP ou GIF).");
    e.target.value = "";
    return;
  }
  if (file.size > PORTRAIT_MAX_BYTES) {
    showPortraitError(`Imagem demasiado grande (máx. ${Math.round(PORTRAIT_MAX_BYTES / 1024)} KB).`);
    e.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (typeof dataUrl !== "string") return;
    patchSheet((sheet) => {
      sheet.portraitImage = dataUrl;
    });
    syncPortraitUi(dataUrl);
  };
  reader.onerror = () => showPortraitError("Não foi possível ler a imagem.");
  reader.readAsDataURL(file);
}

function onPortraitClear() {
  patchSheet((sheet) => {
    sheet.portraitImage = "";
  });
  if (portraitInput) portraitInput.value = "";
  showPortraitError("");
  syncPortraitUi("");
}

function onAbilityInput(e) {
  const input = e.target.closest(".sheet-ability-input");
  if (!input) return;
  const key = input.dataset.ability;
  if (!key) return;
  patchSheet((sheet) => {
    sheet.abilityScores[key] = input.value;
    if (sheet.abilityGeneration?.assignment?.[key]) {
      delete sheet.abilityGeneration.assignment[key];
    }
  });
  const modEl = abilityScoresGrid?.querySelector(`[data-mod-for="${key}"]`);
  if (modEl) modEl.textContent = abilityModifier(input.value);
  syncAbilityAssignDropdowns();
}

function onAbilityAssignChange(e) {
  const sel = e.target.closest(".sheet-ability-assign");
  if (!sel) return;
  const key = sel.dataset.ability;
  if (!key) return;
  const setId = sel.value;

  patchSheet((sheet) => {
    if (!sheet.abilityGeneration) sheet.abilityGeneration = { sets: [], assignment: {} };
    for (const k of ABILITY_KEYS) {
      if (k !== key && sheet.abilityGeneration.assignment[k] === setId) {
        delete sheet.abilityGeneration.assignment[k];
      }
    }
    if (setId) {
      const set = sheet.abilityGeneration.sets.find((s) => s.id === setId && !s.inactive);
      if (set) {
        sheet.abilityGeneration.assignment[key] = setId;
        sheet.abilityScores[key] = String(set.total);
      }
    } else {
      delete sheet.abilityGeneration.assignment[key];
    }
  });

  const input = abilityScoresGrid?.querySelector(`.sheet-ability-input[data-ability="${key}"]`);
  if (input) input.value = loadSheet().abilityScores[key] ?? "";
  const modEl = abilityScoresGrid?.querySelector(`[data-mod-for="${key}"]`);
  if (modEl) modEl.textContent = abilityModifier(input?.value);
  syncAbilityAssignDropdowns();
}

function onHitDieSelectChange() {
  patchSheet((sheet) => {
    sheet.hitDie = hitDieSelect ? hitDieSelect.value : "d10";
  });
}

function onHpFieldChange() {
  const hp = readHpFromInputs();
  patchSheet((sheet) => {
    sheet.hpMax = hp.max;
    sheet.hpCurrent = hp.current;
    sheet.hpTemp = hp.temp;
  });
}

function onHpFullHeal() {
  const hp = readHpFromInputs();
  const max = clampHpValue(Number(hp.max));
  patchSheet((sheet) => {
    sheet.hpMax = hp.max;
    sheet.hpTemp = hp.temp;
    sheet.hpCurrent = max > 0 ? String(max) : hp.max;
  });
  syncHpFields();
}

function onHpHeal() {
  const amount = clampHpValue(Number(hpHealAmount?.value || 0));
  if (amount <= 0) return;
  const hp = readHpFromInputs();
  const max = clampHpValue(Number(hp.max));
  let cur = clampHpValue(Number(hp.current) || 0);
  const next = max > 0 ? Math.min(max, cur + amount) : cur + amount;
  patchSheet((sheet) => {
    sheet.hpMax = hp.max;
    sheet.hpTemp = hp.temp;
    sheet.hpCurrent = String(next);
  });
  syncHpFields();
}

function onDeathSaveClick(e) {
  const btn = e.target.closest(".sheet-death-dot");
  if (!btn) return;
  const type = btn.dataset.saveType;
  const level = Number(btn.dataset.level);
  if (!type || !level) return;

  patchSheet((sheet) => {
    if (!sheet.deathSaves) sheet.deathSaves = { successes: 0, failures: 0 };
    const key = type === "success" ? "successes" : "failures";
    sheet.deathSaves[key] = sheet.deathSaves[key] === level ? level - 1 : level;
  });
  renderDeathSaves();
}

function onDeathSaveReset() {
  patchSheet((sheet) => {
    sheet.deathSaves = { successes: 0, failures: 0 };
  });
  renderDeathSaves();
}

function onArmorClassInput() {
  patchSheet((sheet) => {
    sheet.armorClass = armorClassInput ? armorClassInput.value : "";
  });
}

function onAlignmentChange() {
  patchSheet((sheet) => {
    sheet.alignment = alignmentSelect ? alignmentSelect.value : "";
  });
  syncAlignmentSummary();
}

async function loadAlignmentsDropdown() {
  if (!alignmentSelect || alignmentsLoaded) return;
  try {
    const res = await apiFetch("/api/2014/alignments");
    if (!res.ok) return;
    const data = await res.json();
    const sheet = loadSheet();
    const rows = data.results || [];
    for (const row of rows) {
      const o = document.createElement("option");
      o.value = row.index;
      o.textContent = row.name ?? row.index;
      alignmentSelect.appendChild(o);
      alignmentsCache.set(row.index, { index: row.index, name: row.name });
    }
    alignmentSelect.value = sheet.alignment;

    await Promise.all(
      rows.map(async (row) => {
        const fav = loadFavorites().find(
          (f) => f.resourceKey === "alignments" && String(f.index) === String(row.index)
        );
        if (fav?.cachedData?.desc) {
          alignmentsCache.set(row.index, fav.cachedData);
          return;
        }
        try {
          const detailRes = await apiFetch(row.url || `/api/2014/alignments/${row.index}`);
          if (detailRes.ok) {
            alignmentsCache.set(row.index, await detailRes.json());
          }
        } catch {
          /* ignora falha individual */
        }
      })
    );

    alignmentsLoaded = true;
    await syncAlignmentSummary();
  } catch {
    /* rede */
  }
}

function updateClassProfHint(fieldset) {
  const hint = fieldset.querySelector(".detail-pick-hint");
  if (!hint) return;
  const max = Number(fieldset.dataset.maxChoose) || 2;
  const selected = fieldset.querySelectorAll(".sheet-class-prof-pick:checked").length;
  hint.textContent = formatClassProfHint(selected, max);
}

function onClassProficiencyChange(e) {
  const input = e.target;
  if (!input.classList?.contains("sheet-class-prof-pick")) return;
  const fieldset = input.closest(".sheet-class-prof-fieldset");
  if (!fieldset) return;

  const entryId = fieldset.dataset.entryId;
  const blockIndex = fieldset.dataset.blockIndex ?? "0";
  const max = Number(fieldset.dataset.maxChoose) || 2;

  if (input.checked) {
    const count = fieldset.querySelectorAll(".sheet-class-prof-pick:checked").length;
    if (count > max) {
      input.checked = false;
      updateClassProfHint(fieldset);
      return;
    }
  }

  const picks = [...fieldset.querySelectorAll(".sheet-class-prof-pick:checked")].map((el) => el.value);
  setClassProficiencyPicks(entryId, blockIndex, picks);
  updateClassProfHint(fieldset);
}

function onLocaleReload() {
  detailCache.clear();
  alignmentsCache.clear();
  alignmentsLoaded = false;
  if (alignmentSelect) {
    alignmentSelect.replaceChildren();
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "— Escolher —";
    alignmentSelect.appendChild(o);
  }
  loadAlignmentsDropdown();
  sheetBoard?.querySelectorAll(".sheet-card-body").forEach((body) => {
    body.dataset.loaded = "0";
    body.innerHTML = '<p class="sheet-card-loading">A carregar…</p>';
  });
  renderSheetBoard();
}

function syncGameToolsUi() {
  const prefs = loadGameToolsPrefs();
  const open = prefs.open;
  const tab = prefs.tab;

  document.body.classList.toggle("game-tools-open", open);
  if (gameToolsPanel) {
    gameToolsPanel.classList.toggle("is-open", open);
    gameToolsPanel.setAttribute("aria-hidden", String(!open));
  }
  if (gameToolsBackdrop) gameToolsBackdrop.hidden = !open;

  for (const el of [gameToolsFab, gameToolsOpenHeader]) {
    if (!el) continue;
    el.setAttribute("aria-expanded", String(open));
  }

  setGameToolsTab(tab, { save: false });
}

function openGameTools(tab) {
  const prefs = loadGameToolsPrefs();
  saveGameToolsPrefs({ open: true, tab: tab || prefs.tab || "combat" });
  syncGameToolsUi();
  (gameToolsClose || gameToolsPanel)?.focus();
}

function closeGameTools() {
  saveGameToolsPrefs({ ...loadGameToolsPrefs(), open: false });
  syncGameToolsUi();
  (gameToolsFab || gameToolsOpenHeader)?.focus();
}

function setGameToolsTab(tab, { save = true } = {}) {
  if (tab === "dm") {
    window.location.href = "dm.html";
    return;
  }
  const id = GAME_TOOLS_TABS.includes(tab) ? tab : "combat";
  const activeTab = id;

  document.querySelectorAll(".game-tools-tab").forEach((btn) => {
    const on = btn.dataset.toolsTab === activeTab;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", String(on));
  });

  document.querySelectorAll(".game-tools-pane").forEach((pane) => {
    pane.classList.toggle("is-active", pane.dataset.toolsPane === activeTab);
    pane.hidden = pane.dataset.toolsPane !== activeTab;
  });

  if (save) {
    saveGameToolsPrefs({ ...loadGameToolsPrefs(), tab: activeTab });
  }
}

function initGameTools() {
  syncGameToolsUi();

  gameToolsFab?.addEventListener("click", () => {
    const prefs = loadGameToolsPrefs();
    if (prefs.open) closeGameTools();
    else openGameTools();
  });
  gameToolsOpenHeader?.addEventListener("click", () => openGameTools());
  gameToolsClose?.addEventListener("click", closeGameTools);
  gameToolsBackdrop?.addEventListener("click", closeGameTools);

  document.querySelectorAll(".game-tools-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      setGameToolsTab(btn.dataset.toolsTab);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && loadGameToolsPrefs().open) {
      e.preventDefault();
      closeGameTools();
    }
  });
}

async function boot() {
  await populateLocalesDropdown(localeSelect, { onChange: onLocaleReload });
  await loadAlignmentsDropdown();

  buildAbilityScoresGrid();
  buildDeathSaveDots();
  syncCharacterCoreFromSheet();
  initGameTools();

  document.body.addEventListener("click", onSheetClick);
  document.body.addEventListener("change", (e) => {
    onClassProficiencyChange(e);
    onAbilityAssignChange(e);
    if (e.target === hitDieSelect) onHitDieSelectChange();
    if (e.target === d20ModifierInput) onD20ModifierChange();
    if (e.target === dmgModifierInput) onDamageModifierChange();
    if (e.target === hpMaxInput || e.target === hpCurrentInput || e.target === hpTempInput) onHpFieldChange();
  });

  if (characterNameInput) {
    characterNameInput.addEventListener("input", onCharacterNameInput);
    characterNameInput.addEventListener("change", onCharacterNameInput);
  }
  if (abilityScoresGrid) {
    abilityScoresGrid.addEventListener("input", onAbilityInput);
    abilityScoresGrid.addEventListener("change", onAbilityInput);
  }
  if (hpMaxInput) {
    hpMaxInput.addEventListener("input", onHpFieldChange);
    hpMaxInput.addEventListener("change", onHpFieldChange);
  }
  if (hpCurrentInput) {
    hpCurrentInput.addEventListener("input", onHpFieldChange);
    hpCurrentInput.addEventListener("change", onHpFieldChange);
  }
  if (hpTempInput) {
    hpTempInput.addEventListener("input", onHpFieldChange);
    hpTempInput.addEventListener("change", onHpFieldChange);
  }
  if (hpFullHealBtn) {
    hpFullHealBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onHpFullHeal();
    });
  }
  if (hpHealBtn) {
    hpHealBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onHpHeal();
    });
  }
  if (rollHitDieBtn) {
    rollHitDieBtn.addEventListener("click", (e) => {
      e.preventDefault();
      rollHitDie();
    });
  }
  if (rollD20Btn) {
    rollD20Btn.addEventListener("click", (e) => {
      e.preventDefault();
      rollD20Check();
    });
  }
  if (d20ModifierInput) {
    d20ModifierInput.addEventListener("input", onD20ModifierChange);
    d20ModifierInput.addEventListener("change", onD20ModifierChange);
  }
  if (rollDmgBtn) {
    rollDmgBtn.addEventListener("click", (e) => {
      e.preventDefault();
      rollDamagePool();
    });
  }
  if (dmgModifierInput) {
    dmgModifierInput.addEventListener("input", onDamageModifierChange);
    dmgModifierInput.addEventListener("change", onDamageModifierChange);
  }
  if (armorClassInput) {
    armorClassInput.addEventListener("input", onArmorClassInput);
    armorClassInput.addEventListener("change", onArmorClassInput);
  }
  if (alignmentSelect) alignmentSelect.addEventListener("change", onAlignmentChange);
  if (portraitInput) portraitInput.addEventListener("change", onPortraitSelected);
  if (portraitClear) portraitClear.addEventListener("click", onPortraitClear);

  renderAll();
}

boot();

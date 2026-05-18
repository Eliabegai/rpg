/**
 * Tabelas de slots de magia PHB 2014 (v1: pleno e meio-conjurador).
 * Cada entrada = [1º, 2º, 3º, 4º, 5º, 6º, 7º, 8º, 9º] no nível de personagem correspondente.
 */

const FULL_CASTER_SLOTS_BY_LEVEL = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const HALF_CASTER_SLOTS_BY_LEVEL = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
];

const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const REST_ENVIRONMENTS = {
  wilderness: {
    label: "Ermo / viagem",
    hint: "Descanso exposto; vigia recomendado (DMG).",
  },
  campfire: {
    label: "Fogueira",
    hint: "Descanso ao ar livre com calor e luz limitados.",
  },
  tavern: {
    label: "Taverna ou pousada",
    hint: "Ambiente confortável; descanso longo completo (PHB).",
  },
  dungeon: {
    label: "Masmorra",
    hint: "Ruído e perigo podem interromper o descanso.",
  },
  stronghold: {
    label: "Fortaleza / santuário",
    hint: "Local seguro; ideal para descanso longo.",
  },
};

function slotsArrayToMap(arr) {
  const map = {};
  SPELL_SLOT_LEVELS.forEach((lv, i) => {
    const n = arr[i] ?? 0;
    if (n > 0) map[String(lv)] = n;
  });
  return map;
}

/** Progressão 1/3 (ex.: Campeão arcano) — slots esparsos por nível de personagem. */
const THIRD_CASTER_SLOTS_BY_LEVEL = (() => {
  const rows = Array.from({ length: 20 }, () => [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  rows[2] = [2, 0, 0, 0, 0, 0, 0, 0, 0];
  rows[6] = [0, 1, 0, 0, 0, 0, 0, 0, 0];
  rows[9] = [0, 0, 1, 0, 0, 0, 0, 0, 0];
  rows[12] = [0, 0, 0, 1, 0, 0, 0, 0, 0];
  rows[17] = [0, 0, 0, 0, 1, 0, 0, 0, 0];
  rows[18] = [0, 0, 0, 0, 2, 0, 0, 0, 0];
  rows[19] = [0, 0, 0, 0, 2, 0, 0, 0, 0];
  return rows;
})();

/** Bruxo: todos os slots ao mesmo nível (pacto). */
function warlockPactSlotsMap(characterLevel) {
  const lv = Math.min(20, Math.max(1, Math.floor(Number(characterLevel) || 1)));
  if (lv === 1) return { 1: 1 };
  if (lv === 2) return { 1: 2 };
  if (lv <= 4) return { 2: 2 };
  if (lv <= 6) return { 3: 2 };
  if (lv <= 8) return { 4: 2 };
  if (lv <= 10) return { 5: 2 };
  if (lv <= 16) return { 5: 3 };
  return { 5: 4 };
}

function getMaxSpellSlotsMap(casterType, characterLevel) {
  const type = casterType;
  const lv = Math.min(20, Math.max(1, Math.floor(Number(characterLevel) || 1)));
  if (type === "full") return slotsArrayToMap(FULL_CASTER_SLOTS_BY_LEVEL[lv - 1] || []);
  if (type === "half") return slotsArrayToMap(HALF_CASTER_SLOTS_BY_LEVEL[lv - 1] || []);
  if (type === "third") return slotsArrayToMap(THIRD_CASTER_SLOTS_BY_LEVEL[lv - 1] || []);
  if (type === "warlock") return warlockPactSlotsMap(lv);
  return {};
}

function getSpellSlotsUsedMap(raw) {
  const used = {};
  if (!raw || typeof raw !== "object") return used;
  for (const lv of SPELL_SLOT_LEVELS) {
    const n = Number(raw[String(lv)]);
    if (Number.isFinite(n) && n > 0) used[String(lv)] = Math.floor(n);
  }
  return used;
}

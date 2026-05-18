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

function getMaxSpellSlotsMap(casterType, characterLevel) {
  const type = casterType === "full" || casterType === "half" ? casterType : "none";
  if (type === "none") return {};
  const lv = Math.min(20, Math.max(1, Math.floor(Number(characterLevel) || 1)));
  const table = type === "full" ? FULL_CASTER_SLOTS_BY_LEVEL : HALF_CASTER_SLOTS_BY_LEVEL;
  return slotsArrayToMap(table[lv - 1] || []);
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

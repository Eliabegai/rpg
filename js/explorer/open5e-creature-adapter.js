/**
 * Adapta JSON de creature (Open5e v2) para o formato esperado por renderMonsterDetailLayout.
 */
function formatOpen5eSpeed(speed, speedAll) {
  const src = speedAll && typeof speedAll === "object" ? speedAll : speed;
  if (!src || typeof src !== "object") return {};
  const unit = src.unit === "feet" ? "ft." : src.unit || "ft.";
  const out = {};
  for (const [mode, val] of Object.entries(src)) {
    if (mode === "unit" || mode === "hover") continue;
    if (typeof val === "number" && val > 0) out[mode] = `${val} ${unit}`;
  }
  return out;
}

function mapOpen5eActions(actions, actionType) {
  if (!Array.isArray(actions)) return [];
  return actions
    .filter((a) => !actionType || a.action_type === actionType)
    .map((a) => ({
      name: a.name,
      desc: a.desc ? [String(a.desc)] : [],
    }));
}

function adaptOpen5eCreatureToMonster(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const scores = raw.ability_scores || {};
  const traits = Array.isArray(raw.traits) ? raw.traits : [];
  const actions = Array.isArray(raw.actions) ? raw.actions : [];

  return {
    index: raw.key,
    name: raw.name,
    url: `/v2/creatures/${raw.key}/`,
    size: raw.size?.name || raw.size?.key || "",
    type: raw.type?.name || raw.type?.key || "",
    subtype: raw.subcategory || "",
    alignment: raw.alignment || "",
    armor_class: [{ type: "natural", value: raw.armor_class }],
    hit_points: raw.hit_points,
    hit_dice: raw.hit_dice,
    challenge_rating: raw.challenge_rating,
    xp: raw.experience_points,
    proficiency_bonus: raw.proficiency_bonus,
    speed: formatOpen5eSpeed(raw.speed, raw.speed_all),
    strength: scores.strength,
    dexterity: scores.dexterity,
    constitution: scores.constitution,
    intelligence: scores.intelligence,
    wisdom: scores.wisdom,
    charisma: scores.charisma,
    senses: { passive_perception: raw.passive_perception },
    languages: raw.languages?.as_string || "",
    special_abilities: traits.map((t) => ({ name: t.name, desc: t.desc ? [String(t.desc)] : [] })),
    actions: mapOpen5eActions(actions, "ACTION"),
    legendary_actions: mapOpen5eActions(actions, "LEGENDARY_ACTION"),
    reactions: mapOpen5eActions(actions, "REACTION"),
    _provider: "open5e",
    _document: raw.document?.display_name || raw.document?.name || "",
  };
}

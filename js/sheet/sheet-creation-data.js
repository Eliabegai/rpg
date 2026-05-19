/**
 * v3.3 — Dados e helpers para criação de personagem (PHB / API 2014).
 */
const CREATION_STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

const ABILITY_API_TO_KEY = {
  str: "str",
  dex: "dex",
  con: "con",
  int: "int",
  wis: "wis",
  cha: "cha",
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

function abilityScoreIndexToKey(ref) {
  const raw = String(ref?.index || ref?.name || ref || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  return ABILITY_API_TO_KEY[raw] || "";
}

function parseAbilityBonusesFromApi(bonuses) {
  const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  if (!Array.isArray(bonuses)) return out;
  for (const row of bonuses) {
    const key = abilityScoreIndexToKey(row?.ability_score);
    const bonus = Number(row?.bonus) || 0;
    if (key && bonus) out[key] = (out[key] || 0) + bonus;
  }
  return out;
}

async function fetchWizardResourceList(resourceKey) {
  const path = `/api/2014/${resourceKey}`;
  try {
    const res = await apiFetch(path);
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results
      .map((r) => ({
        resourceKey,
        index: String(r.index),
        name: r.name != null ? String(r.name) : formatResourceLabel(r.index),
        path: cleanApiPath(r.url || `${path}/${r.index}`),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  } catch {
    return [];
  }
}

async function fetchWizardDetail(entry) {
  if (!entry?.path && !entry?.resourceKey) return null;
  const path = entry.path || `/api/2014/${entry.resourceKey}/${entry.index}`;
  try {
    const res = await apiFetch(path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function flattenStartingEquipmentRows(rows, resourceKey = "equipment") {
  const out = [];
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    const eq = row?.equipment;
    if (!eq?.index) continue;
    out.push({
      resourceKey,
      index: String(eq.index),
      name: eq.name != null ? String(eq.name) : formatResourceLabel(eq.index),
      path: cleanApiPath(eq.url || `/api/2014/${resourceKey}/${eq.index}`),
      qty: Math.max(1, Math.floor(Number(row.quantity) || 1)),
    });
  }
  return out;
}

function collectStartingEquipmentFromSources(...sources) {
  const seen = new Set();
  const out = [];
  for (const data of sources) {
    if (!data) continue;
    const rows = [...flattenStartingEquipmentRows(data.starting_equipment)];
    for (const item of rows) {
      const key = `${item.resourceKey}:${item.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function applyRaceAbilityBonusesToSheet(sheet, bonuses, { mode = "add" } = {}) {
  const deltas = parseAbilityBonusesFromApi(bonuses);
  const changed = [];
  for (const key of ABILITY_KEYS) {
    const delta = deltas[key] || 0;
    if (!delta) continue;
    const current = Number(sheet.abilityScores[key]);
    const base = Number.isFinite(current) && current > 0 ? current : 10;
    const next = mode === "set" ? 10 + delta : base + delta;
    sheet.abilityScores[key] = String(Math.min(30, Math.max(1, next)));
    changed.push(`${key.toUpperCase()} +${delta}`);
  }
  return changed;
}

function applyStandardArrayToSheet(sheet, assignment) {
  if (!assignment || typeof assignment !== "object") return false;
  for (const key of ABILITY_KEYS) {
    const val = assignment[key];
    if (val != null && val !== "") sheet.abilityScores[key] = String(val);
  }
  return true;
}

function setPrimarySheetItem(sheet, entry) {
  if (!entry?.resourceKey || !entry?.index) return;
  const keys =
    entry.resourceKey === "subraces"
      ? ["races", "subraces"]
      : entry.resourceKey === "races"
        ? ["races", "subraces"]
        : [entry.resourceKey];
  sheet.items = (sheet.items || []).filter((i) => !keys.includes(i.resourceKey));
  const item = normalizeSheetItem({
    resourceKey: entry.resourceKey,
    index: entry.index,
    name: entry.name,
    path: entry.path,
    cachedData: entry.cachedData,
    dataLocale: entry.dataLocale,
  });
  if (item) sheet.items.push(item);
}

function importStartingEquipmentRows(sheet, rows) {
  if (!Array.isArray(sheet.inventory)) sheet.inventory = [];
  const existing = new Set(
    sheet.inventory.map((r) => `${r.resourceKey || ""}:${r.index || r.name}`.toLowerCase())
  );
  let added = 0;
  for (const src of rows) {
    const key = `${src.resourceKey}:${src.index}`.toLowerCase();
    if (existing.has(key)) continue;
    sheet.inventory.push({
      id: `inv-wiz-${src.index}-${Date.now()}-${added}`,
      name: String(src.name || src.index).slice(0, 120),
      qty: src.qty || 1,
      weight: "",
      resourceKey: src.resourceKey,
      index: String(src.index),
    });
    existing.add(key);
    added += 1;
  }
  return added;
}

function findRaceOrSubraceOnSheet(sheet) {
  return (
    (sheet?.items || []).find((i) => i.resourceKey === "subraces") ||
    (sheet?.items || []).find((i) => i.resourceKey === "races") ||
    null
  );
}

function applyRaceBonusesFromSheetRaceSync(sheet, raceData) {
  if (!raceData?.ability_bonuses?.length) {
    return { ok: false, error: "Esta raça não tem bónus de atributos fixos na API." };
  }
  const changed = applyRaceAbilityBonusesToSheet(sheet, raceData.ability_bonuses, { mode: "add" });
  if (!changed.length) {
    return { ok: false, error: "Nenhum bónus aplicado." };
  }
  return { ok: true, message: `Bónus aplicados: ${changed.join(", ")}.` };
}

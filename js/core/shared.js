/** Utilitários partilhados entre a exploração da API e a ficha. */
/** API_BASE e paths: js/core/api-client.js (carregar antes deste ficheiro). */
const STORAGE_LOCALE = "dnd5eapi.locale";
const STORAGE_FAVORITES = "dnd5eapi.favorites";
const STORAGE_LIST_SCOPE = "dnd5eapi.listScope";
const STORAGE_SESSION = "dnd5eapi.session";
const STORAGE_SHEET = "dnd5eapi.sheet";
const STORAGE_GAME_TOOLS = "dnd5eapi.gameTools";
const STORAGE_DM_BATTLE = "dnd5eapi.dmBattle";
const STORAGE_DM_SNAPSHOTS = "dnd5eapi.dmEncounterSnapshots";
const STORAGE_CAMPAIGN = "dnd5eapi.campaign";
const STORAGE_SESSION_HISTORY = "dnd5eapi.sessionHistory";
const STORAGE_TABLE_MODE = "dnd5eapi.tableMode";
const STORAGE_DM_VISITED = "dnd5eapi.dmVisited";
const SESSION_HISTORY_MAX = 48;
const CAMPAIGN_EXPORT_VERSION = 1;

/** XP acumulado mínimo por nível (PHB 2014). Índice = nível (1–20). */
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000,
  165000, 195000, 225000, 265000, 305000, 355000,
];

/** DMG 2014 — orçamento de XP por personagem [fácil, médio, difícil, mortal]. Índice = nível−1. */
const ENCOUNTER_XP_BUDGET = [
  [25, 50, 75, 100],
  [50, 100, 150, 200],
  [75, 150, 225, 400],
  [125, 250, 375, 500],
  [250, 500, 750, 1100],
  [300, 600, 900, 1400],
  [350, 750, 1100, 1700],
  [450, 900, 1400, 2100],
  [550, 1100, 1600, 2400],
  [600, 1200, 1900, 2800],
  [800, 1600, 2400, 3600],
  [1000, 2000, 3000, 4500],
  [1100, 2200, 3400, 5100],
  [1250, 2500, 3800, 5700],
  [1400, 2800, 4300, 6400],
  [1600, 3200, 4800, 7200],
  [2000, 3900, 5900, 8800],
  [2100, 4200, 6300, 9500],
  [2400, 4900, 7300, 10900],
  [2800, 5700, 8500, 12700],
];

const ENCOUNTER_DIFFICULTY_LABELS = {
  trivial: "Trivial",
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
  deadly: "Mortal",
  beyond: "Além do mortal",
};
const STORAGE_IMAGE_CACHE = "dnd5eapi.imageCache";
const IMAGE_CACHE_MAX_ENTRIES = 96;

/** Abas do painel de ferramentas (mesa). `dm` → página dedicada do mestre. */
const GAME_TOOLS_TABS = ["combat", "character", "dm"];

/**
 * @typedef {object} DmPartyMember
 * @property {string} id
 * @property {string} name
 * @property {string} initiative
 * @property {number} level nível de personagem (1–20)
 * @property {number} xpTotal XP acumulado (PHB)
 * @property {boolean} downed fora do XP (mantido no registo para reviver)
 */

/**
 * @typedef {object} DmEncounter
 * @property {string} id
 * @property {string} sourceKey favorito monsters:index
 * @property {string} sourceIndex
 * @property {string} sourceName
 * @property {string} label identificador na mesa
 * @property {string} hpMax
 * @property {string} hpCurrent
 * @property {string} initiative
 * @property {string} initiativeMod modificador d20 iniciativa
 * @property {string} actionMod modificador d20 ação
 * @property {{ modifier: string, pool: Array<{ id: string, sides: number }> }} damageRoll
 * @property {string[]} killedBy ids dos personagens que eliminaram (XP dividido)
 * @property {number} xp experiência do monstro (API)
 * @property {string} imageUrl retrato do monstro (API)
 */

function normalizeKilledBy(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (raw != null && raw !== "") return [String(raw)];
  return [];
}

function isPartyMemberDowned(member) {
  return Boolean(member?.downed);
}

function activePartyMembers(party) {
  return (party || []).filter((p) => p && !isPartyMemberDowned(p));
}

function filterKilledByForXp(killerIds, party) {
  const activeIds = new Set(activePartyMembers(party).map((p) => p.id));
  return normalizeKilledBy(killerIds).filter((id) => activeIds.has(id));
}

function monsterXpFromApiData(data) {
  const xp = Number(data?.xp);
  return Number.isFinite(xp) && xp >= 0 ? Math.floor(xp) : 0;
}

function clampCharacterLevel(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

function xpThresholdForLevel(level) {
  const lv = clampCharacterLevel(level);
  return XP_THRESHOLDS[lv - 1] ?? 0;
}

function xpToNextLevel(level) {
  const lv = clampCharacterLevel(level);
  if (lv >= 20) return null;
  return XP_THRESHOLDS[lv] - XP_THRESHOLDS[lv - 1];
}

function normalizeXpTotal(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** Progresso de XP dentro do nível atual (0–100). */
function characterXpProgress(xpTotal, level) {
  const lv = clampCharacterLevel(level);
  const total = normalizeXpTotal(xpTotal);
  const floor = xpThresholdForLevel(lv);
  if (lv >= 20) {
    return { level: lv, xpTotal: total, floor, nextAt: null, inLevel: 0, span: 0, pct: 100 };
  }
  const nextAt = XP_THRESHOLDS[lv];
  const span = nextAt - floor;
  const inLevel = Math.max(0, total - floor);
  const pct = span > 0 ? Math.min(100, Math.round((inLevel / span) * 100)) : 0;
  return { level: lv, xpTotal: total, floor, nextAt, inLevel, span, pct };
}

function levelFromXpTotal(xpTotal) {
  const total = normalizeXpTotal(xpTotal);
  let lv = 1;
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (total >= XP_THRESHOLDS[i]) {
      lv = i + 1;
      break;
    }
  }
  return clampCharacterLevel(lv);
}

function encounterMonsterMultiplier(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 1) return 1;
  if (n === 2) return 1.5;
  if (n <= 6) return 2;
  if (n <= 10) return 2.5;
  if (n <= 14) return 3;
  return 4;
}

/** Orçamento de encontro somado para o grupo (DMG, grupos 3–5; ajuste simples fora disso). */
function partyEncounterBudget(party) {
  const members = activePartyMembers(party);
  const tiers = ["easy", "medium", "hard", "deadly"];
  const budget = { easy: 0, medium: 0, hard: 0, deadly: 0 };
  if (!members.length) return budget;

  for (const m of members) {
    const row = ENCOUNTER_XP_BUDGET[clampCharacterLevel(m.level) - 1];
    if (!row) continue;
    budget.easy += row[0];
    budget.medium += row[1];
    budget.hard += row[2];
    budget.deadly += row[3];
  }

  const n = members.length;
  let factor = 1;
  if (n < 3) factor = 1.5;
  else if (n > 5) factor = 5 / n;

  if (factor !== 1) {
    for (const t of tiers) budget[t] = Math.floor(budget[t] * factor);
  }
  return budget;
}

function classifyEncounterDifficulty(adjustedXp, budget) {
  if (!budget || adjustedXp <= 0) return "trivial";
  if (adjustedXp <= budget.easy) return "easy";
  if (adjustedXp <= budget.medium) return "medium";
  if (adjustedXp <= budget.hard) return "hard";
  if (adjustedXp <= budget.deadly) return "deadly";
  return "beyond";
}

/**
 * @param {DmPartyMember[]} party
 * @param {DmEncounter[]} encounters criaturas vivas na mesa
 */
function computeEncounterDifficulty(party, encounters) {
  const living = (encounters || []).filter((e) => {
    const cur = Number(e?.hpCurrent);
    const max = Number(e?.hpMax);
    if (!Number.isFinite(cur)) return true;
    return cur > 0 && (!Number.isFinite(max) || cur <= max);
  });
  const monsterCount = living.length;
  const rawXp = living.reduce((s, e) => s + (Number(e.xp) || 0), 0);
  const multiplier = encounterMonsterMultiplier(monsterCount);
  const adjustedXp = Math.floor(rawXp * multiplier);
  const budget = partyEncounterBudget(party);
  const difficulty = classifyEncounterDifficulty(adjustedXp, budget);
  return {
    monsterCount,
    rawXp,
    multiplier,
    adjustedXp,
    budget,
    difficulty,
    difficultyLabel: ENCOUNTER_DIFFICULTY_LABELS[difficulty] || difficulty,
  };
}

function splitXpAmongParty(totalXp, partyIds) {
  const ids = [...new Set(partyIds)].filter(Boolean);
  const n = ids.length;
  const map = new Map();
  if (!n || totalXp <= 0) return map;
  const base = Math.floor(totalXp / n);
  let rem = totalXp % n;
  ids.forEach((id, i) => {
    map.set(id, base + (i < rem ? 1 : 0));
  });
  return map;
}

/** URL de imagens e outros assets estáticos — sem parâmetro `lang` (a API devolve 400). */
function apiAssetUrl(pathOrUrl) {
  if (!pathOrUrl) return "";
  const raw = String(pathOrUrl).trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const u = new URL(raw);
      if (u.hostname.replace(/^www\./, "") === "dnd5eapi.co") {
        u.search = "";
        return u.toString();
      }
      return raw;
    } catch {
      return raw;
    }
  }
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API_BASE}${path}`;
}

function entryImageUrl(data) {
  if (!data?.image) return "";
  return apiAssetUrl(data.image);
}

function imageCacheKey(resourceKey, index) {
  return `${resourceKey}:${String(index)}`;
}

function loadImageCache() {
  try {
    const raw = localStorage.getItem(STORAGE_IMAGE_CACHE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getCachedImageDataUrl(resourceKey, index) {
  const key = imageCacheKey(resourceKey, index);
  const hit = loadImageCache()[key];
  return typeof hit === "string" && hit.startsWith("data:") ? hit : "";
}

function saveImageCacheEntry(key, dataUrl) {
  if (!dataUrl || !key) return false;
  const cache = loadImageCache();
  cache[key] = dataUrl;
  const keys = Object.keys(cache);
  while (keys.length > IMAGE_CACHE_MAX_ENTRIES) {
    const oldest = keys.shift();
    delete cache[oldest];
  }
  try {
    localStorage.setItem(STORAGE_IMAGE_CACHE, JSON.stringify(cache));
    return true;
  } catch {
    try {
      const trimmed = { ...cache };
      delete trimmed[keys[0]];
      localStorage.setItem(STORAGE_IMAGE_CACHE, JSON.stringify(trimmed));
      return true;
    } catch {
      return false;
    }
  }
}

/** Guarda PNG dos monstros favoritos em data URL para carregamento offline/rápido. */
async function ensureMonsterImageCached(resourceKey, index, imagePath) {
  if (!imagePath || resourceKey !== "monsters") return entryImageUrl({ image: imagePath });
  const ix = String(index);
  const cached = getCachedImageDataUrl(resourceKey, ix);
  if (cached) return cached;

  const url = apiAssetUrl(imagePath);
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    if (typeof dataUrl === "string" && dataUrl.length > 0 && dataUrl.length < 500_000) {
      saveImageCacheEntry(imageCacheKey(resourceKey, ix), dataUrl);
      return dataUrl;
    }
    return url;
  } catch {
    return url;
  }
}

function resolveEntryImageUrl(entry) {
  const resourceKey = entry?.resourceKey;
  const index = entry?.index != null ? String(entry.index) : "";
  if (resourceKey && index) {
    const imgHit = getCachedImageDataUrl(resourceKey, index);
    if (imgHit) return imgHit;
  }
  const cached = getCachedEntryData(entry);
  if (cached?.image) return entryImageUrl(cached);
  if (entry?.imageUrl && String(entry.imageUrl).includes("/api/images/")) {
    return apiAssetUrl(entry.imageUrl);
  }
  return "";
}

/** Caminho base da app (ex.: `/rpg/` no GitHub Pages). */
function getAppBasePath() {
  const baseEl = document.querySelector("base[data-app-base]");
  if (baseEl?.href) {
    try {
      const path = new URL(baseEl.href, window.location.origin).pathname;
      return path.endsWith("/") ? path : `${path}/`;
    } catch {
      /* ignore */
    }
  }
  return "/";
}

function appHref(relativePath) {
  const rel = String(relativePath || "").replace(/^\//, "");
  const base = getAppBasePath();
  return `${base}${rel}`;
}

function navigateToAppPage(relativePath) {
  window.location.assign(appHref(relativePath));
}

function openMonstersInExplorer() {
  try {
    const session = {
      resourceKey: "monsters",
      resourcePath: apiListPath("monsters"),
      itemIndex: "",
      itemPath: "",
      filter: "",
      spellLevel: "",
      spellSchool: "",
      spellClass: "",
      spellSubclass: "",
      page: 1,
      listScope: "all",
    };
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
  } catch {
    /* quota */
  }
  navigateToAppPage("index.html");
}

function markDmPageVisited() {
  try {
    localStorage.setItem(STORAGE_DM_VISITED, "1");
  } catch {
    /* quota */
  }
}

function isDmFirstVisit() {
  try {
    return !localStorage.getItem(STORAGE_DM_VISITED);
  } catch {
    return false;
  }
}

function openEntryInExplorer(entry) {
  const path = cleanApiPath(entry.path || "");
  const resourcePath = resourcePathFromItemPath(path);
  try {
    const session = {
      resourceKey: entry.resourceKey,
      resourcePath,
      itemIndex: String(entry.index),
      itemPath: path,
      filter: "",
      spellLevel: "",
      spellSchool: "",
      spellClass: "",
      spellSubclass: "",
      page: 1,
      listScope: "all",
    };
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
  } catch {
    /* quota */
  }
  navigateToAppPage("index.html");
}

/** Abre o explorador num recurso da API (ex.: antecedentes, classes). */
function openExplorerResource(resourceKey, resourcePath) {
  const key = String(resourceKey || "").trim();
  if (!key) return;
  const path = resourcePath || apiListPath(key);
  try {
    localStorage.setItem(
      STORAGE_SESSION,
      JSON.stringify({
        resourceKey: key,
        resourcePath: path,
        itemIndex: "",
        itemPath: "",
        filter: "",
        spellLevel: "",
        spellSchool: "",
        spellClass: "",
        spellSubclass: "",
        page: 1,
        listScope: "all",
      })
    );
  } catch {
    /* quota */
  }
  navigateToAppPage("index.html");
}

function formatArmorClass(ac) {
  if (ac == null) return "—";
  if (typeof ac === "number") return String(ac);
  if (Array.isArray(ac)) {
    return ac
      .map((row) => {
        const v = row?.value ?? row;
        const t = row?.type ? ` (${row.type})` : "";
        return `${v}${t}`;
      })
      .join(", ");
  }
  return String(ac);
}

function formatMonsterBrief(data) {
  if (!data || typeof data !== "object") return "";
  const rows = [];
  if (data.size || data.type) {
    rows.push(["Tipo", [data.size, data.type, data.subtype].filter(Boolean).join(" ")]);
  }
  if (data.alignment) rows.push(["Alinhamento", data.alignment]);
  rows.push(["CA", formatArmorClass(data.armor_class)]);
  if (data.hit_points != null) rows.push(["PV", String(data.hit_points)]);
  if (data.hit_dice) rows.push(["Dados de vida", data.hit_dice]);
  if (data.challenge_rating != null) rows.push(["ND", String(data.challenge_rating)]);
  if (data.xp != null) rows.push(["XP", String(data.xp)]);
  if (data.proficiency_bonus != null) rows.push(["Bónus prof.", `+${data.proficiency_bonus}`]);
  if (data.speed && typeof data.speed === "object") {
    rows.push(["Deslocamento", Object.entries(data.speed).map(([k, v]) => `${k} ${v}`).join(", ")]);
  }
  if (data.senses?.passive_perception != null) {
    rows.push(["Percepção passiva", String(data.senses.passive_perception)]);
  }
  if (data.languages) rows.push(["Idiomas", data.languages]);
  return rows
    .map(
      ([label, val]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(String(val))}</td></tr>`
    )
    .join("");
}

const DEFAULT_GAME_TOOLS = {
  open: false,
  tab: "combat",
};

function normalizeGameTools(raw) {
  const tab = GAME_TOOLS_TABS.includes(raw?.tab) ? raw.tab : "combat";
  return {
    open: Boolean(raw?.open),
    tab,
  };
}

function newEntityId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function rollDie(sides) {
  const n = Number(sides);
  if (!Number.isFinite(n) || n < 1) return 1;
  return 1 + Math.floor(Math.random() * n);
}

function clampInt(n, min, max, fallback = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function formatRollModifier(mod) {
  const n = clampInt(mod, -99, 99, 0);
  if (n === 0) return "+0";
  return n > 0 ? `+ ${n}` : String(n);
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
  const mod = clampInt(modifier, -99, 99, 0);
  let formula = parts.join(" + ");
  if (mod !== 0) formula += ` ${formatRollModifier(mod)}`;
  return formula;
}

function newDamageDieId() {
  return newEntityId("dmg");
}

const DEFAULT_DM_BATTLE = {
  party: [],
  encounters: [],
  combat: { activeTurnKey: "", round: 1, encounterLabel: "" },
};

function normalizeDmTurnKind(kind) {
  if (kind === "monster") return "enc";
  return kind;
}

function dmTurnKey(kind, id) {
  const k = normalizeDmTurnKind(kind);
  if (!id || (k !== "party" && k !== "enc")) return "";
  return `${k}:${id}`;
}

function parseDmTurnKey(key) {
  if (!key || typeof key !== "string") return null;
  const normalized = key.startsWith("monster:") ? `enc:${key.slice(8)}` : key;
  const i = normalized.indexOf(":");
  if (i <= 0) return null;
  const kind = normalized.slice(0, i);
  const id = normalized.slice(i + 1);
  if ((kind !== "party" && kind !== "enc") || !id) return null;
  return { kind, id };
}

function normalizeDmCombatTrack(raw) {
  const round = Math.max(1, Math.floor(Number(raw?.round)) || 1);
  const activeTurnKey =
    raw?.activeTurnKey != null && String(raw.activeTurnKey).trim()
      ? String(raw.activeTurnKey).trim().slice(0, 80)
      : "";
  const encounterLabel =
    raw?.encounterLabel != null ? String(raw.encounterLabel).trim().slice(0, 120) : "";
  return { activeTurnKey, round, encounterLabel };
}

function normalizeDmPartyMember(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = raw.name != null ? String(raw.name).trim() : "";
  if (!name) return null;
  return {
    id: raw.id != null ? String(raw.id) : newEntityId("party"),
    name: name.slice(0, 120),
    initiative: raw.initiative != null ? String(raw.initiative) : "",
    level: clampCharacterLevel(raw.level),
    xpTotal: normalizeXpTotal(raw.xpTotal),
    downed: Boolean(raw.downed),
    inspiration: Boolean(raw.inspiration),
    activeConditions: normalizeActiveConditions(raw.activeConditions),
    concentrationSpell:
      raw.concentrationSpell != null ? String(raw.concentrationSpell).slice(0, 200) : "",
  };
}

function copySheetCombatStateToMember(member, sheet) {
  if (!member || !sheet) return;
  member.inspiration = Boolean(sheet.inspiration);
  member.activeConditions = normalizeActiveConditions(sheet.activeConditions);
  member.concentrationSpell =
    sheet.concentrationSpell != null ? String(sheet.concentrationSpell).slice(0, 200) : "";
}

function copyMemberCombatStateToSheet(sheet, member) {
  if (!sheet || !member) return;
  sheet.inspiration = Boolean(member.inspiration);
  sheet.activeConditions = normalizeActiveConditions(member.activeConditions);
  sheet.concentrationSpell =
    member.concentrationSpell != null ? String(member.concentrationSpell).slice(0, 200) : "";
}

/** Atualiza inspiração/condições na mesa se o nome da ficha coincidir com um personagem. */
function trySyncCombatStateToDm(sheet) {
  const name = String(sheet?.characterName || "").trim();
  if (!name) return false;
  const battle = loadDmBattle();
  const member = findDmPartyMemberByName(battle.party, name);
  if (!member) return false;
  copySheetCombatStateToMember(member, sheet);
  saveDmBattle(battle);
  return true;
}

function normalizeDmEncounter(raw) {
  if (!raw || typeof raw !== "object") return null;
  const sourceKey = raw.sourceKey != null ? String(raw.sourceKey) : "monsters";
  const sourceIndex = raw.sourceIndex != null ? String(raw.sourceIndex) : "";
  if (!sourceIndex) return null;
  const label =
    raw.label != null && String(raw.label).trim()
      ? String(raw.label).trim().slice(0, 120)
      : raw.sourceName != null
        ? String(raw.sourceName).slice(0, 120)
        : sourceIndex;
  return {
    id: raw.id != null ? String(raw.id) : newEntityId("enc"),
    sourceKey,
    sourceIndex,
    sourceName: raw.sourceName != null ? String(raw.sourceName) : sourceIndex,
    label,
    hpMax: raw.hpMax != null ? String(raw.hpMax) : "10",
    hpCurrent: raw.hpCurrent != null ? String(raw.hpCurrent) : raw.hpMax != null ? String(raw.hpMax) : "10",
    initiative: raw.initiative != null ? String(raw.initiative) : "",
    initiativeMod: raw.initiativeMod != null ? String(raw.initiativeMod) : "0",
    actionMod: raw.actionMod != null ? String(raw.actionMod) : "0",
    damageRoll: normalizeDamageRoll(raw.damageRoll),
    killedBy: normalizeKilledBy(raw.killedBy),
    xp: monsterXpFromApiData({ xp: raw.xp }),
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : "",
    activeConditions: normalizeActiveConditions(raw.activeConditions),
  };
}

function normalizeDmBattle(parsed) {
  const base = { ...DEFAULT_DM_BATTLE, combat: { ...DEFAULT_DM_BATTLE.combat } };
  if (!parsed || typeof parsed !== "object") return base;
  const party = Array.isArray(parsed.party)
    ? parsed.party.map(normalizeDmPartyMember).filter(Boolean)
    : [];
  const encounters = Array.isArray(parsed.encounters)
    ? parsed.encounters.map(normalizeDmEncounter).filter(Boolean)
    : [];
  const combat = normalizeDmCombatTrack(parsed.combat);
  return { party, encounters, combat };
}

function cloneDmBattleSlice(battle) {
  return {
    party: (battle?.party || []).map((p) => ({ ...p, activeConditions: [...(p.activeConditions || [])] })),
    encounters: (battle?.encounters || []).map((e) => ({
      ...e,
      killedBy: [...(e.killedBy || [])],
      damageRoll: e.damageRoll
        ? {
            modifier: e.damageRoll.modifier,
            pool: (e.damageRoll.pool || []).map((d) => ({ ...d })),
          }
        : { modifier: "0", pool: [] },
      activeConditions: [...(e.activeConditions || [])],
    })),
    combat: { ...normalizeDmCombatTrack(battle?.combat) },
  };
}

function loadDmSnapshots() {
  try {
    const raw =
      typeof readCampaignScoped === "function" ? readCampaignScoped("dmSnapshots") : localStorage.getItem(STORAGE_DM_SNAPSHOTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const name = s.name != null ? String(s.name).trim().slice(0, 120) : "";
        if (!name) return null;
        const slice = s.battle && typeof s.battle === "object" ? normalizeDmBattle(s.battle) : null;
        if (!slice) return null;
        return {
          id: s.id != null ? String(s.id) : newEntityId("snap"),
          name,
          savedAt: s.savedAt != null ? String(s.savedAt) : new Date().toISOString(),
          battle: slice,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveDmSnapshots(list) {
  try {
    const payload = JSON.stringify(list);
    if (typeof writeCampaignScoped === "function") writeCampaignScoped("dmSnapshots", payload);
    else localStorage.setItem(STORAGE_DM_SNAPSHOTS, payload);
    return true;
  } catch {
    return false;
  }
}

function addDmSnapshot(name) {
  const label = String(name || "").trim().slice(0, 120);
  if (!label) return { ok: false, error: "Indica um nome para o encontro." };
  const list = loadDmSnapshots();
  const snap = {
    id: newEntityId("snap"),
    name: label,
    savedAt: new Date().toISOString(),
    battle: cloneDmBattleSlice(loadDmBattle()),
  };
  list.unshift(snap);
  saveDmSnapshots(list.slice(0, 24));
  return { ok: true, snapshot: snap };
}

function restoreDmSnapshot(snapshotId) {
  const snap = loadDmSnapshots().find((s) => s.id === snapshotId);
  if (!snap) return { ok: false, error: "Encontro guardado não encontrado." };
  saveDmBattle(snap.battle);
  return { ok: true, name: snap.name };
}

function deleteDmSnapshot(snapshotId) {
  const list = loadDmSnapshots().filter((s) => s.id !== snapshotId);
  saveDmSnapshots(list);
}

function loadDmBattle() {
  try {
    const raw =
      typeof readCampaignScoped === "function" ? readCampaignScoped("dmBattle") : localStorage.getItem(STORAGE_DM_BATTLE);
    if (!raw) return normalizeDmBattle(null);
    return normalizeDmBattle(JSON.parse(raw));
  } catch {
    return normalizeDmBattle(null);
  }
}

function saveDmBattle(battle) {
  try {
    const payload = JSON.stringify(normalizeDmBattle(battle));
    if (typeof writeCampaignScoped === "function") writeCampaignScoped("dmBattle", payload);
    else localStorage.setItem(STORAGE_DM_BATTLE, payload);
    return true;
  } catch {
    return false;
  }
}

function normalizeCampaign(parsed) {
  const base = { name: "" };
  if (!parsed || typeof parsed !== "object") return base;
  return {
    name: parsed.name != null ? String(parsed.name).trim().slice(0, 120) : "",
  };
}

function loadCampaign() {
  try {
    const raw =
      typeof readCampaignScoped === "function" ? readCampaignScoped("meta") : localStorage.getItem(STORAGE_CAMPAIGN);
    const meta = raw ? normalizeCampaign(JSON.parse(raw)) : normalizeCampaign(null);
    if (typeof getActiveCampaign === "function") {
      const active = getActiveCampaign();
      if (active?.name && !meta.name) meta.name = active.name;
    }
    return meta;
  } catch {
    return normalizeCampaign(null);
  }
}

function saveCampaign(campaign) {
  try {
    const normalized = normalizeCampaign(campaign);
    const payload = JSON.stringify(normalized);
    if (typeof writeCampaignScoped === "function") writeCampaignScoped("meta", payload);
    else localStorage.setItem(STORAGE_CAMPAIGN, payload);
    if (typeof loadCampaignRegistry === "function" && normalized.name) {
      const id = getActiveCampaignId();
      const list = loadCampaignRegistry();
      const entry = list.find((c) => c.id === id);
      if (entry) {
        entry.name = normalized.name;
        saveCampaignRegistry(list);
      }
    }
    return true;
  } catch {
    return false;
  }
}

function buildCampaignExportBundle() {
  const campaign = loadCampaign();
  return {
    version: CAMPAIGN_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    campaignId: typeof getActiveCampaignId === "function" ? getActiveCampaignId() : DEFAULT_CAMPAIGN_ID,
    campaign,
    dmBattle: loadDmBattle(),
    favorites: loadFavorites(),
    sheet: loadSheet(),
    sessionHistory: loadSessionHistory(),
    dmSnapshots: typeof loadDmSnapshots === "function" ? loadDmSnapshots() : [],
  };
}

function importCampaignBundle(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, error: "JSON inválido." };
  const version = Number(raw.version);
  if (!Number.isFinite(version) || version < 1) {
    return { ok: false, error: "Versão de exportação não suportada." };
  }
  if (raw.campaign) saveCampaign(raw.campaign);
  if (raw.dmBattle != null) saveDmBattle(raw.dmBattle);
  if (Array.isArray(raw.favorites)) saveFavorites(raw.favorites);
  if (raw.sheet != null) saveSheet(normalizeSheet(raw.sheet));
  if (Array.isArray(raw.sessionHistory)) saveSessionHistory(raw.sessionHistory);
  if (Array.isArray(raw.dmSnapshots) && typeof saveDmSnapshots === "function") saveDmSnapshots(raw.dmSnapshots);
  return { ok: true };
}

/** PV médios a partir do JSON do monstro na API 2014. */
function monsterHpFromApiData(data) {
  if (!data || typeof data !== "object") return 10;
  if (typeof data.hit_points === "number" && data.hit_points > 0) {
    return Math.floor(data.hit_points);
  }
  const hp = data.hit_points;
  if (hp && typeof hp === "object") {
    const avg = Number(hp.average ?? hp.hit_points_average);
    if (Number.isFinite(avg) && avg > 0) return Math.floor(avg);
  }
  return 10;
}

function loadGameToolsPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_GAME_TOOLS);
    return normalizeGameTools(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_GAME_TOOLS };
  }
}

function saveGameToolsPrefs(prefs) {
  localStorage.setItem(STORAGE_GAME_TOOLS, JSON.stringify(normalizeGameTools(prefs)));
}

let currentLocale = "pt-BR";

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

/** Perícias PHB: índice API → atributo */
const SHEET_SKILLS = [
  { index: "acrobatics", ability: "dex" },
  { index: "animal-handling", ability: "wis" },
  { index: "arcana", ability: "int" },
  { index: "athletics", ability: "str" },
  { index: "deception", ability: "cha" },
  { index: "history", ability: "int" },
  { index: "insight", ability: "wis" },
  { index: "intimidation", ability: "cha" },
  { index: "investigation", ability: "int" },
  { index: "medicine", ability: "wis" },
  { index: "nature", ability: "int" },
  { index: "perception", ability: "wis" },
  { index: "performance", ability: "cha" },
  { index: "persuasion", ability: "cha" },
  { index: "religion", ability: "int" },
  { index: "sleight-of-hand", ability: "dex" },
  { index: "stealth", ability: "dex" },
  { index: "survival", ability: "wis" },
];

const SHEET_CONDITION_OPTIONS = [
  { index: "blinded", label: "Cego" },
  { index: "charmed", label: "Enfeitiçado" },
  { index: "deafened", label: "Surdo" },
  { index: "exhaustion", label: "Exaustão" },
  { index: "frightened", label: "Amedrontado" },
  { index: "grappled", label: "Agarrado" },
  { index: "incapacitated", label: "Incapacitado" },
  { index: "invisible", label: "Invisível" },
  { index: "paralyzed", label: "Paralisado" },
  { index: "petrified", label: "Petrificado" },
  { index: "poisoned", label: "Envenenado" },
  { index: "prone", label: "Prostrado" },
  { index: "restrained", label: "Impedido" },
  { index: "stunned", label: "Atordoado" },
  { index: "unconscious", label: "Inconsciente" },
];

/** none | half | prof | expertise */
const SKILL_PROF_RANKS = ["none", "half", "prof", "expertise"];

const DEFAULT_SHEET_COMBAT = {
  skillProficiencies: {},
  skillProficiencyRanks: {},
  saveProficiencies: { str: false, dex: false, con: false, int: false, wis: false, cha: false },
  activeConditions: [],
  inspiration: false,
  concentrationSpell: "",
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
  currency: { cp: "", sp: "", ep: "", gp: "", pp: "" },
  inventory: [],
};

function proficiencyBonusFromLevel(level) {
  const lv = clampCharacterLevel(level);
  return Math.floor((lv - 1) / 4) + 2;
}

function abilityModNumber(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.floor((n - 10) / 2);
}

function formatSignedMod(n) {
  if (!Number.isFinite(n)) return "—";
  return n >= 0 ? `+${n}` : String(n);
}

function normalizeSkillProficiencyRanks(rawRanks, legacyProf) {
  const out = {};
  const legacy = legacyProf && typeof legacyProf === "object" ? legacyProf : {};
  const ranks = rawRanks && typeof rawRanks === "object" ? rawRanks : {};
  for (const skill of SHEET_SKILLS) {
    const ix = skill.index;
    let rank = ranks[ix];
    if (!SKILL_PROF_RANKS.includes(rank)) {
      rank = legacy[ix] ? "prof" : "none";
    }
    if (rank !== "none") out[ix] = rank;
  }
  return out;
}

function normalizeSkillProficiencies(raw) {
  const out = {};
  if (raw && typeof raw === "object") {
    for (const skill of SHEET_SKILLS) {
      if (raw[skill.index]) out[skill.index] = true;
    }
  }
  return out;
}

function getSkillProficiencyRank(sheet, skillIndex) {
  const ranks = sheet?.skillProficiencyRanks;
  if (ranks && ranks[skillIndex] && SKILL_PROF_RANKS.includes(ranks[skillIndex])) {
    return ranks[skillIndex];
  }
  return sheet?.skillProficiencies?.[skillIndex] ? "prof" : "none";
}

function proficiencyBonusForRank(level, rank) {
  const prof = proficiencyBonusFromLevel(level);
  if (rank === "expertise") return prof * 2;
  if (rank === "prof") return prof;
  if (rank === "half") return Math.floor(prof / 2);
  return 0;
}

function computeSkillBonusFromSheet(sheet, skillIndex) {
  const skill = SHEET_SKILLS.find((s) => s.index === skillIndex);
  if (!skill) return 0;
  const mod = abilityModNumber(sheet.abilityScores[skill.ability]);
  const rank = getSkillProficiencyRank(sheet, skillIndex);
  return mod + proficiencyBonusForRank(sheet.characterLevel, rank);
}

function computeSaveBonusFromSheet(sheet, abilityKey) {
  const mod = abilityModNumber(sheet.abilityScores[abilityKey]);
  const prof = proficiencyBonusFromLevel(sheet.characterLevel);
  return sheet.saveProficiencies?.[abilityKey] ? mod + prof : mod;
}

function normalizeSaveProficiencies(raw) {
  const out = { ...DEFAULT_SHEET_COMBAT.saveProficiencies };
  if (raw && typeof raw === "object") {
    for (const key of ABILITY_KEYS) {
      if (raw[key]) out[key] = true;
    }
  }
  return out;
}

function normalizeActiveConditions(raw) {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(SHEET_CONDITION_OPTIONS.map((c) => c.index));
  return [...new Set(raw.map((c) => String(c)).filter((c) => allowed.has(c)))];
}

function normalizePersonality(raw) {
  const base = { ...DEFAULT_SHEET_COMBAT.personality };
  if (!raw || typeof raw !== "object") return base;
  return {
    traits: raw.traits != null ? String(raw.traits) : "",
    ideals: raw.ideals != null ? String(raw.ideals) : "",
    bonds: raw.bonds != null ? String(raw.bonds) : "",
    flaws: raw.flaws != null ? String(raw.flaws) : "",
  };
}

function normalizeCurrency(raw) {
  const base = { ...DEFAULT_SHEET_COMBAT.currency };
  if (!raw || typeof raw !== "object") return base;
  for (const key of ["cp", "sp", "ep", "gp", "pp"]) {
    if (raw[key] != null && raw[key] !== "") base[key] = String(raw[key]);
  }
  return base;
}

function normalizeInventory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const name = String(row.name || "").trim();
      if (!name) return null;
      const rowOut = {
        id: row.id != null ? String(row.id) : `inv-${i}`,
        name: name.slice(0, 120),
        qty: Math.max(1, Math.floor(Number(row.qty) || 1)),
        weight: row.weight != null && row.weight !== "" ? String(row.weight) : "",
      };
      if (row.resourceKey) rowOut.resourceKey = String(row.resourceKey);
      if (row.index != null) rowOut.index = String(row.index);
      return rowOut;
    })
    .filter(Boolean)
    .slice(0, 80);
}

const DEFAULT_SHEET = {
  characterName: "",
  characterLevel: 1,
  xpTotal: 0,
  portraitImage: "",
  armorClass: "",
  alignment: "",
  abilityScores: { str: "", dex: "", con: "", int: "", wis: "", cha: "" },
  /** { "classes:fighter": { "0": ["skill-acrobatics", ...] } } */
  classProficiencyPicks: {},
  /** 7× 4d6 (descarta menor dado); um conjunto fica inactive */
  abilityGeneration: { sets: [], assignment: {} },
  hitDie: "d10",
  d20Modifier: "0",
  damageRoll: { modifier: "0", pool: [] },
  hpMax: "",
  hpCurrent: "",
  hpTemp: "0",
  deathSaves: { successes: 0, failures: 0 },
  spellcasting: { casterType: "none", slotsUsed: {}, spells: [] },
  hitDiceRemaining: null,
  restEnvironment: "tavern",
  items: [],
  ...DEFAULT_SHEET_COMBAT,
};

function normalizeCasterType(raw) {
  if (raw === "full" || raw === "half" || raw === "warlock" || raw === "third") return raw;
  return "none";
}

function isTableModeEnabled() {
  try {
    return localStorage.getItem(STORAGE_TABLE_MODE) === "1";
  } catch {
    return false;
  }
}

function setTableModeEnabled(on) {
  try {
    localStorage.setItem(STORAGE_TABLE_MODE, on ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

function applyTableModeClass() {
  document.documentElement.classList.toggle("table-mode", isTableModeEnabled());
}

function loadSessionHistory() {
  try {
    const raw =
      typeof readCampaignScoped === "function"
        ? readCampaignScoped("sessionHistory")
        : localStorage.getItem(STORAGE_SESSION_HISTORY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveSessionHistory(entries) {
  try {
    const payload = JSON.stringify(entries.slice(0, SESSION_HISTORY_MAX));
    if (typeof writeCampaignScoped === "function") writeCampaignScoped("sessionHistory", payload);
    else localStorage.setItem(STORAGE_SESSION_HISTORY, payload);
    return true;
  } catch {
    return false;
  }
}

function appendSessionHistory(entry) {
  if (!entry || typeof entry !== "object") return false;
  const list = loadSessionHistory();
  list.unshift({
    id: entry.id != null ? String(entry.id) : newEntityId("hist"),
    at: entry.at || new Date().toISOString(),
    campaignName: entry.campaignName != null ? String(entry.campaignName).slice(0, 120) : "",
    totalXp: Number(entry.totalXp) || 0,
    monstersDefeated: Number(entry.monstersDefeated) || 0,
    notes: entry.notes != null ? String(entry.notes).slice(0, 500) : "",
    members: Array.isArray(entry.members)
      ? entry.members.map((m) => ({
          name: String(m?.name || "").slice(0, 120),
          xp: Number(m?.xp) || 0,
          level: clampCharacterLevel(m?.level),
        }))
      : [],
  });
  return saveSessionHistory(list);
}

function clearSessionHistory() {
  try {
    if (typeof removeCampaignScoped === "function") removeCampaignScoped("sessionHistory");
    else localStorage.removeItem(STORAGE_SESSION_HISTORY);
    return true;
  } catch {
    return false;
  }
}

function spellLevelFromApiData(data) {
  const n = Number(data?.level);
  return Number.isFinite(n) ? Math.min(9, Math.max(0, Math.floor(n))) : 0;
}

function isSpellResourceKey(resourceKey) {
  const k = String(resourceKey || "").toLowerCase();
  return k === "spells" || k === "spell";
}

function spellIndexFromEntry(entry) {
  if (entry?.index != null && String(entry.index) !== "") return String(entry.index);
  const parts = cleanApiPath(entry?.path || "").split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function ensureSpellcastingSpells(sheet) {
  if (!sheet.spellcasting || typeof sheet.spellcasting !== "object") {
    sheet.spellcasting = { casterType: "none", slotsUsed: {}, spells: [] };
  }
  if (!Array.isArray(sheet.spellcasting.spells)) {
    sheet.spellcasting.spells = [];
  }
}

/** Favoritos ★ e magias já marcadas «Na ficha». */
function gatherSpellEntriesForImport(sheet) {
  const seen = new Set();
  const out = [];
  const add = (entry) => {
    if (!entry || !isSpellResourceKey(entry.resourceKey)) return;
    const index = spellIndexFromEntry(entry);
    if (!index || seen.has(index)) return;
    seen.add(index);
    const fav =
      findFavorite("spells", index) ||
      (isSpellResourceKey(entry.resourceKey) ? findFavorite(entry.resourceKey, index) : null);
    const cached = entry.cachedData || fav?.cachedData;
    out.push({
      resourceKey: "spells",
      index,
      name: entry.name != null ? String(entry.name) : index,
      path: cleanApiPath(entry.path || fav?.path || ""),
      cachedData: cached,
      dataLocale: entry.dataLocale || fav?.dataLocale,
    });
  };
  loadFavorites().forEach(add);
  (sheet?.items || []).forEach(add);
  return out;
}

function normalizeSpellListEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const resourceKey = raw.resourceKey != null ? String(raw.resourceKey) : "spells";
  if (resourceKey !== "spells") return null;
  const index = raw.index != null ? String(raw.index) : "";
  if (!index) return null;
  const levelRaw = Number(raw.level);
  const level = Number.isFinite(levelRaw) ? Math.min(9, Math.max(0, Math.floor(levelRaw))) : 0;
  return {
    resourceKey: "spells",
    index,
    name: raw.name != null ? String(raw.name) : index,
    path: pathnameFromApiRef(withActiveApiPath(raw.path || "")),
    level,
    prepared: raw.prepared !== false,
  };
}

function normalizeMulticlassEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const index = raw.index != null ? String(raw.index) : "";
  if (!index) return null;
  const level = Math.min(20, Math.max(1, Math.floor(Number(raw.level) || 1)));
  const caster =
    raw.caster === "full" ||
    raw.caster === "half" ||
    raw.caster === "third" ||
    raw.caster === "pact" ||
    raw.caster === "none"
      ? raw.caster
      : "none";
  return {
    index,
    name: raw.name != null ? String(raw.name) : index,
    level,
    caster,
  };
}

function normalizeMulticlassSpellcasting(raw) {
  if (!raw || typeof raw !== "object") {
    return { enabled: false, classes: [] };
  }
  const classes = Array.isArray(raw.classes)
    ? raw.classes.map(normalizeMulticlassEntry).filter(Boolean).slice(0, 6)
    : [];
  return { enabled: Boolean(raw.enabled) && classes.length > 0, classes };
}

function normalizePreparedCaster(raw) {
  const allowed = ["none", "wizard", "cleric", "druid"];
  return allowed.includes(raw) ? raw : "none";
}

function normalizeSpellcasting(raw) {
  const casterType = normalizeCasterType(raw?.casterType);
  const slotsUsed =
    typeof getSpellSlotsUsedMap === "function" ? getSpellSlotsUsedMap(raw?.slotsUsed) : {};
  const seen = new Set();
  const spells = [];
  if (Array.isArray(raw?.spells)) {
    for (const entry of raw.spells) {
      const norm = normalizeSpellListEntry(entry);
      if (!norm || seen.has(norm.index)) continue;
      seen.add(norm.index);
      spells.push(norm);
    }
  }
  spells.sort(
    (a, b) => a.level - b.level || String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" })
  );
  return {
    casterType,
    slotsUsed,
    spells,
    multiclass: normalizeMulticlassSpellcasting(raw?.multiclass),
    preparedCaster: normalizePreparedCaster(raw?.preparedCaster),
  };
}

function maxPreparedSpellsForSheet(sheet) {
  const key = sheet?.spellcasting?.preparedCaster;
  const abilityByClass = { wizard: "int", cleric: "wis", druid: "wis" };
  const ability = abilityByClass[key];
  if (!ability) return null;
  let classLevel = clampCharacterLevel(sheet?.characterLevel);
  const mc = sheet?.spellcasting?.multiclass;
  if (mc?.enabled && mc.classes?.length) {
    const entry = mc.classes.find((c) => {
      if (key === "wizard") return c.index === "wizard" || c.caster === "full";
      if (key === "cleric") return c.index === "cleric";
      if (key === "druid") return c.index === "druid";
      return false;
    });
    if (entry) classLevel = entry.level;
  }
  const mod = abilityModNumber(sheet?.abilityScores?.[ability]);
  return Math.max(1, classLevel + mod);
}

function countPreparedSpells(sheet) {
  return (sheet?.spellcasting?.spells || []).filter((s) => s.prepared && s.level > 0).length;
}

/** Slots restantes no nível da magia ou acima (PHB; bruxo: qualquer slot de pacto). */
function hasAvailableSpellSlot(sheet, spellLevel) {
  const lv = Math.min(9, Math.max(0, Math.floor(Number(spellLevel) || 0)));
  if (lv === 0) return true;
  const casterType = sheet?.spellcasting?.casterType;
  if (!casterType || casterType === "none") return false;
  const maxMap = getSheetMaxSpellSlots(sheet);
  const usedMap = clampSpellSlotsUsed(sheet.spellcasting.slotsUsed, maxMap);
  if (casterType === "warlock") {
    return Object.keys(maxMap).some((key) => (maxMap[key] || 0) - (usedMap[key] || 0) > 0);
  }
  for (const slotLv of SPELL_SLOT_LEVELS) {
    if (slotLv < lv) continue;
    const rem = (maxMap[String(slotLv)] || 0) - (usedMap[String(slotLv)] || 0);
    if (rem > 0) return true;
  }
  return false;
}

function getSpellCastStatus(sheet, spell) {
  if (!spell?.prepared) return { key: "unprepared", label: "Não preparada" };
  if (spell.level === 0) return { key: "ready", label: "Truque" };
  if (sheet?.spellcasting?.casterType === "none") return { key: "no-caster", label: "Sem conjuração" };
  if (hasAvailableSpellSlot(sheet, spell.level)) return { key: "ready", label: "Posso usar" };
  return { key: "no-slot", label: "Sem slot" };
}

function remainingSlotsSummaryForLevel(sheet, spellLevel) {
  const lv = Math.min(9, Math.max(1, Math.floor(Number(spellLevel) || 1)));
  const maxMap = getSheetMaxSpellSlots(sheet);
  const usedMap = clampSpellSlotsUsed(sheet.spellcasting.slotsUsed, maxMap);
  let rem = 0;
  let max = 0;
  for (const slotLv of SPELL_SLOT_LEVELS) {
    if (slotLv < lv) continue;
    rem += (maxMap[String(slotLv)] || 0) - (usedMap[String(slotLv)] || 0);
    max += maxMap[String(slotLv)] || 0;
  }
  return { remaining: rem, max };
}

function importSpellFavoritesToSheet(sheet) {
  ensureSpellcastingSpells(sheet);
  const existing = new Set(sheet.spellcasting.spells.map((s) => s.index));
  let added = 0;
  for (const src of gatherSpellEntriesForImport(sheet)) {
    const ix = String(src.index);
    if (existing.has(ix)) continue;
    const level = src.cachedData ? spellLevelFromApiData(src.cachedData) : 0;
    const entry = normalizeSpellListEntry({ ...src, level, prepared: true });
    if (!entry) continue;
    sheet.spellcasting.spells.push(entry);
    existing.add(ix);
    added += 1;
  }
  sheet.spellcasting.spells.sort(
    (a, b) => a.level - b.level || String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" })
  );
  return added;
}

function addSpellToSheetList(sheet, entry, { level, prepared = true } = {}) {
  const ix = String(entry.index);
  if ((sheet.spellcasting.spells || []).some((s) => s.index === ix)) return false;
  const spellLevel =
    level != null && Number.isFinite(Number(level))
      ? Math.min(9, Math.max(0, Math.floor(Number(level))))
      : 0;
  const norm = normalizeSpellListEntry({
    resourceKey: "spells",
    index: ix,
    name: entry.name,
    path: entry.path,
    level: spellLevel,
    prepared,
  });
  if (!norm) return false;
  sheet.spellcasting.spells.push(norm);
  sheet.spellcasting.spells.sort(
    (a, b) => a.level - b.level || String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" })
  );
  return true;
}

function normalizeRestEnvironment(raw) {
  const allowed = ["wilderness", "campfire", "tavern", "dungeon", "stronghold"];
  return allowed.includes(raw) ? raw : "tavern";
}

function normalizePartySyncName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function findDmPartyMemberByName(party, name) {
  const key = normalizePartySyncName(name);
  if (!key) return null;
  return (party || []).find((p) => normalizePartySyncName(p.name) === key) ?? null;
}

function hitDiceMaxForSheet(sheet) {
  return clampCharacterLevel(sheet?.characterLevel);
}

function hitDiceRemainingForSheet(sheet) {
  const max = hitDiceMaxForSheet(sheet);
  const raw = sheet?.hitDiceRemaining;
  if (raw == null || raw === "") return max;
  const n = Number(raw);
  if (!Number.isFinite(n)) return max;
  return Math.min(max, Math.max(0, Math.floor(n)));
}

function getSheetMaxSpellSlots(sheet) {
  if (typeof getMaxSpellSlotsMap !== "function") return {};
  const sc = sheet?.spellcasting;
  if (sc?.multiclass?.enabled && typeof getMulticlassSpellSlotsMap === "function") {
    return getMulticlassSpellSlotsMap(sc.multiclass, sheet?.characterLevel);
  }
  return getMaxSpellSlotsMap(sc?.casterType, sheet?.characterLevel);
}

/** PV máximos sugeridos (PHB): 1º nível = DV + CON; depois média fixa por nível. */
function computeSuggestedHpMax(sheet, { useAverage = true } = {}) {
  const level = clampCharacterLevel(sheet?.characterLevel);
  if (level < 1) return null;
  const m = String(sheet?.hitDie || "d10").match(/d(\d+)/i);
  const sides = m ? Number(m[1]) : 10;
  if (!Number.isFinite(sides) || sides < 1) return null;
  const conMod = abilityModNumber(sheet?.abilityScores?.con);
  const first = sides + conMod;
  if (level === 1) return Math.max(1, first);
  const perLevel = useAverage ? Math.floor(sides / 2) + 1 + conMod : sides + conMod;
  return Math.max(1, first + (level - 1) * perLevel);
}

function gatherEquipmentEntriesForImport(sheet) {
  const keys = new Set(["equipment", "magic-items"]);
  const seen = new Set();
  const out = [];
  const add = (entry) => {
    if (!entry || !keys.has(entry.resourceKey)) return;
    const ix = String(entry.index || "");
    const id = `${entry.resourceKey}:${ix}`;
    if (!ix || seen.has(id)) return;
    seen.add(id);
    out.push(entry);
  };
  loadFavorites().forEach(add);
  (sheet?.items || []).forEach(add);
  return out;
}

function equipmentWeightFromEntry(entry) {
  const w = entry?.cachedData?.weight;
  if (w == null || w === "") return "";
  const n = Number(w);
  return Number.isFinite(n) ? String(n) : "";
}

function importEquipmentFavoritesToSheet(sheet) {
  if (!Array.isArray(sheet.inventory)) sheet.inventory = [];
  const existing = new Set(
    sheet.inventory.map((r) => `${r.resourceKey || ""}:${r.index || r.name}`.toLowerCase())
  );
  let added = 0;
  for (const src of gatherEquipmentEntriesForImport(sheet)) {
    const key = `${src.resourceKey}:${src.index}`.toLowerCase();
    if (existing.has(key)) continue;
    let weight = equipmentWeightFromEntry(src);
    if (!weight) {
      const fav = findFavorite(src.resourceKey, src.index);
      if (fav?.cachedData) weight = equipmentWeightFromEntry(fav);
      else {
        const cached = getCachedEntryData({
          resourceKey: src.resourceKey,
          index: src.index,
          path: buildApiEntryPath(src),
        });
        if (cached) weight = equipmentWeightFromEntry({ cachedData: cached });
      }
    }
    sheet.inventory.push({
      id: `inv-${src.resourceKey}-${src.index}-${Date.now()}-${added}`,
      name: String(src.name || src.index).slice(0, 120),
      qty: 1,
      weight,
      resourceKey: src.resourceKey,
      index: String(src.index),
    });
    existing.add(key);
    added += 1;
  }
  return added;
}

function clampSpellSlotsUsed(used, maxMap) {
  const out = {};
  for (const [lv, max] of Object.entries(maxMap || {})) {
    const u = Number(used?.[lv]) || 0;
    out[lv] = Math.min(max, Math.max(0, Math.floor(u)));
  }
  return out;
}

function syncSheetToDmBattle(sheet) {
  const name = sheet?.characterName != null ? String(sheet.characterName).trim() : "";
  if (!name) return { ok: false, error: "Define o nome do personagem na ficha." };
  const battle = loadDmBattle();
  const existing = findDmPartyMemberByName(battle.party, name);
  if (existing) {
    existing.level = clampCharacterLevel(sheet.characterLevel);
    existing.xpTotal = normalizeXpTotal(sheet.xpTotal);
    copySheetCombatStateToMember(existing, sheet);
    saveDmBattle(battle);
    return { ok: true, memberId: existing.id, created: false };
  }
  const member = normalizeDmPartyMember({
    name,
    level: sheet.characterLevel,
    xpTotal: sheet.xpTotal,
    initiative: "",
    downed: false,
    inspiration: sheet.inspiration,
    activeConditions: sheet.activeConditions,
    concentrationSpell: sheet.concentrationSpell,
  });
  if (!member) return { ok: false, error: "Não foi possível criar o personagem na mesa." };
  battle.party.push(member);
  saveDmBattle(battle);
  return { ok: true, memberId: member.id, created: true };
}

function syncDmPartyMemberToSheet(member, { forceName = false } = {}) {
  if (!member) return { ok: false, error: "Personagem inválido." };
  const sheet = loadSheet();
  const sheetName = String(sheet.characterName || "").trim();
  const memberName = String(member.name || "").trim();
  if (!sheetName && memberName) {
    sheet.characterName = memberName;
  } else if (!forceName && sheetName && normalizePartySyncName(sheetName) !== normalizePartySyncName(memberName)) {
    return {
      ok: false,
      error: `A ficha é «${sheetName}» e a mesa tem «${memberName}». Ajusta o nome ou confirma a substituição.`,
      nameMismatch: true,
    };
  } else if (forceName && memberName) {
    sheet.characterName = memberName;
  }
  sheet.characterLevel = clampCharacterLevel(member.level);
  sheet.xpTotal = normalizeXpTotal(member.xpTotal);
  copyMemberCombatStateToSheet(sheet, member);
  saveSheet(normalizeSheet(sheet));
  return { ok: true };
}

function normalizeSheet(parsed) {
  const base = {
    ...DEFAULT_SHEET,
    abilityScores: { ...DEFAULT_SHEET.abilityScores },
    classProficiencyPicks: {},
    items: [],
  };
  if (!parsed || typeof parsed !== "object") return base;

  const abilityScores = { ...base.abilityScores };
  if (parsed.abilityScores && typeof parsed.abilityScores === "object") {
    for (const key of ABILITY_KEYS) {
      if (parsed.abilityScores[key] != null && parsed.abilityScores[key] !== "") {
        abilityScores[key] = String(parsed.abilityScores[key]);
      }
    }
  }

  const classProficiencyPicks = {};
  if (parsed.classProficiencyPicks && typeof parsed.classProficiencyPicks === "object") {
    for (const [entryId, val] of Object.entries(parsed.classProficiencyPicks)) {
      if (Array.isArray(val)) {
        classProficiencyPicks[entryId] = { 0: val.map(String) };
      } else if (val && typeof val === "object") {
        classProficiencyPicks[entryId] = {};
        for (const [block, picks] of Object.entries(val)) {
          classProficiencyPicks[entryId][block] = Array.isArray(picks) ? picks.map(String) : [];
        }
      }
    }
  }

  return {
    characterName: parsed.characterName != null ? String(parsed.characterName) : "",
    characterLevel: clampCharacterLevel(parsed.characterLevel),
    xpTotal: normalizeXpTotal(parsed.xpTotal),
    portraitImage: typeof parsed.portraitImage === "string" ? parsed.portraitImage : "",
    armorClass: parsed.armorClass != null ? String(parsed.armorClass) : "",
    alignment: parsed.alignment != null ? String(parsed.alignment) : "",
    abilityScores,
    classProficiencyPicks,
    abilityGeneration: normalizeAbilityGeneration(parsed.abilityGeneration),
    hitDie: parsed.hitDie != null ? String(parsed.hitDie) : "d10",
    d20Modifier: parsed.d20Modifier != null ? String(parsed.d20Modifier) : "0",
    damageRoll: normalizeDamageRoll(parsed.damageRoll),
    hpMax: parsed.hpMax != null ? String(parsed.hpMax) : "",
    hpCurrent: parsed.hpCurrent != null ? String(parsed.hpCurrent) : "",
    hpTemp: parsed.hpTemp != null ? String(parsed.hpTemp) : "0",
    deathSaves: normalizeDeathSaves(parsed.deathSaves),
    spellcasting: normalizeSpellcasting(parsed.spellcasting),
    hitDiceRemaining:
      parsed.hitDiceRemaining != null && parsed.hitDiceRemaining !== ""
        ? Math.max(0, Math.floor(Number(parsed.hitDiceRemaining)))
        : null,
    restEnvironment: normalizeRestEnvironment(parsed.restEnvironment),
    items: Array.isArray(parsed.items)
      ? parsed.items.map(normalizeSheetItem).filter(Boolean)
      : [],
    skillProficiencyRanks: (() => {
      const ranks = normalizeSkillProficiencyRanks(
        parsed.skillProficiencyRanks,
        parsed.skillProficiencies
      );
      return ranks;
    })(),
    skillProficiencies: (() => {
      const ranks = normalizeSkillProficiencyRanks(
        parsed.skillProficiencyRanks,
        parsed.skillProficiencies
      );
      const legacy = {};
      for (const [k, rank] of Object.entries(ranks)) {
        if (rank === "prof" || rank === "expertise") legacy[k] = true;
      }
      return legacy;
    })(),
    saveProficiencies: normalizeSaveProficiencies(parsed.saveProficiencies),
    activeConditions: normalizeActiveConditions(parsed.activeConditions),
    inspiration: Boolean(parsed.inspiration),
    concentrationSpell:
      parsed.concentrationSpell != null ? String(parsed.concentrationSpell).slice(0, 200) : "",
    personality: normalizePersonality(parsed.personality),
    currency: normalizeCurrency(parsed.currency),
    inventory: normalizeInventory(parsed.inventory),
  };
}

function normalizeAbilityGeneration(raw) {
  if (!raw || typeof raw !== "object") return { sets: [], assignment: {} };
  const sets = Array.isArray(raw.sets)
    ? raw.sets.map((s, i) => {
        const rolls = Array.isArray(s.rolls) ? s.rolls.map(Number) : [];
        let droppedIndex =
          s.droppedIndex != null && s.droppedIndex !== "" ? Number(s.droppedIndex) : null;
        if ((droppedIndex == null || Number.isNaN(droppedIndex)) && rolls.length) {
          let minIdx = 0;
          for (let j = 1; j < rolls.length; j++) {
            if (rolls[j] < rolls[minIdx]) minIdx = j;
          }
          droppedIndex = minIdx;
        }
        const dropped =
          s.dropped != null ? Number(s.dropped) : rolls[droppedIndex ?? 0];
        return {
          id: s.id != null ? String(s.id) : String(i),
          rolls,
          dropped,
          droppedIndex: droppedIndex ?? 0,
          total: s.total != null ? Number(s.total) : 0,
          inactive: Boolean(s.inactive),
        };
      })
    : [];
  const assignment = {};
  if (raw.assignment && typeof raw.assignment === "object") {
    for (const key of ABILITY_KEYS) {
      if (raw.assignment[key] != null && raw.assignment[key] !== "") {
        assignment[key] = String(raw.assignment[key]);
      }
    }
  }
  return { sets, assignment };
}

const DAMAGE_DIE_SIDES = [4, 6, 8, 10, 12, 20];

function normalizeDamageRoll(raw) {
  const modifier = raw?.modifier != null ? String(raw.modifier) : "0";
  const pool = Array.isArray(raw?.pool)
    ? raw.pool
        .map((die, i) => {
          const sides = Number(die?.sides);
          if (!DAMAGE_DIE_SIDES.includes(sides)) return null;
          return {
            id: die?.id != null ? String(die.id) : `dmg-${i}`,
            sides,
          };
        })
        .filter(Boolean)
        .slice(0, 24)
    : [];
  return { modifier, pool };
}

function normalizeDeathSaves(raw) {
  const successes = Math.min(3, Math.max(0, Number(raw?.successes) || 0));
  const failures = Math.min(3, Math.max(0, Number(raw?.failures) || 0));
  return { successes, failures };
}

const SHEET_RESOURCE_ORDER = [
  "races",
  "subraces",
  "classes",
  "levels",
  "backgrounds",
  "feats",
  "features",
  "traits",
  "spells",
  "equipment",
  "magic-items",
  "proficiencies",
  "languages",
  "alignments",
  "conditions",
  "damage-types",
  "magic-schools",
  "monsters",
  "rules",
  "rule-sections",
];

function initLocaleFromStorage() {
  const v = localStorage.getItem(STORAGE_LOCALE);
  currentLocale = v && typeof v === "string" && v.length > 0 ? v : "pt-BR";
}

function setLocale(locale) {
  currentLocale = locale && String(locale).length > 0 ? String(locale) : "pt-BR";
  try {
    localStorage.setItem(STORAGE_LOCALE, currentLocale);
  } catch {
    /* quota */
  }
}

function apiUrl(pathOrUrl) {
  if (!pathOrUrl) return "";
  const path = withActiveApiPath(pathOrUrl);
  const absolute = path.startsWith("http") ? path : `${API_BASE}${path}`;
  try {
    const u = new URL(absolute);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "dnd5eapi.co") return absolute;
    if (u.pathname.startsWith("/api/images/")) return absolute;
    u.searchParams.set("lang", currentLocale);
    return u.toString();
  } catch {
    const sep = absolute.includes("?") ? "&" : "?";
    return `${absolute}${sep}lang=${encodeURIComponent(currentLocale)}`;
  }
}

function apiFetch(pathOrUrl, init = {}) {
  const url = apiUrl(pathOrUrl);
  const headers = new Headers(init.headers);
  headers.set("Accept-Language", currentLocale);
  return fetch(url, { ...init, headers });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function formatResourceLabel(key) {
  return String(key)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function cleanApiPath(pathOrUrl) {
  return pathnameFromApiRef(withActiveApiPath(pathOrUrl));
}

function favoriteEntryId(entry) {
  return `${entry.resourceKey}:${String(entry.index)}`;
}

function normalizeFavoriteEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const resourceKey = raw.resourceKey;
  const index = raw.index != null ? String(raw.index) : "";
  if (!resourceKey || !index) return null;
  const entry = {
    resourceKey: String(resourceKey),
    index,
    name: raw.name != null ? String(raw.name) : index,
    path: pathnameFromApiRef(withActiveApiPath(raw.path || "")),
  };
  if (raw.cachedData && typeof raw.cachedData === "object") {
    entry.cachedData = raw.cachedData;
    entry.dataLocale = raw.dataLocale != null ? String(raw.dataLocale) : "";
  }
  return entry;
}

function normalizeSheetItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const resourceKey = raw.resourceKey;
  const index = raw.index != null ? String(raw.index) : "";
  if (!resourceKey || !index) return null;
  const entry = {
    resourceKey: String(resourceKey),
    index,
    name: raw.name != null ? String(raw.name) : index,
    path: pathnameFromApiRef(withActiveApiPath(raw.path || "")),
  };
  if (raw.cachedData && typeof raw.cachedData === "object") {
    entry.cachedData = raw.cachedData;
    entry.dataLocale = raw.dataLocale != null ? String(raw.dataLocale) : "";
  }
  return entry;
}

function findFavorite(resourceKey, index) {
  const ix = String(index);
  return loadFavorites().find((f) => f.resourceKey === resourceKey && String(f.index) === ix) ?? null;
}

/** Dados em cache do favorito/ficha para o idioma atual (evita novo pedido à API). */
function getCachedEntryData(entry) {
  if (entry?.cachedData && entry.dataLocale === currentLocale) {
    return entry.cachedData;
  }
  const fav = findFavorite(entry.resourceKey, entry.index);
  if (fav?.cachedData && fav.dataLocale === currentLocale) {
    return fav.cachedData;
  }
  return null;
}

function applyCacheToEntry(entry, data, locale = currentLocale) {
  if (!entry || !data || typeof data !== "object") return entry;
  entry.cachedData = data;
  entry.dataLocale = locale;
  return entry;
}

function updateFavoriteCache(resourceKey, index, data) {
  const favs = loadFavorites();
  const i = favs.findIndex((f) => f.resourceKey === resourceKey && String(f.index) === String(index));
  if (i < 0) return false;
  applyCacheToEntry(favs[i], data);
  if (data.name) favs[i].name = String(data.name);
  const ok = saveFavorites(favs);
  if (ok && resourceKey === "monsters" && data?.image) {
    void ensureMonsterImageCached(resourceKey, index, data.image);
  }
  return ok;
}

function updateSheetItemCache(resourceKey, index, data) {
  const sheet = loadSheet();
  const i = sheet.items.findIndex((it) => it.resourceKey === resourceKey && String(it.index) === String(index));
  if (i < 0) return false;
  applyCacheToEntry(sheet.items[i], data);
  return saveSheet(sheet);
}

function persistItemCacheForEntry(entry, data) {
  updateFavoriteCache(entry.resourceKey, entry.index, data);
  updateSheetItemCache(entry.resourceKey, entry.index, data);
}

async function fetchAndCacheFavoriteEntry(entry) {
  const path = cleanApiPath(entry.path);
  if (!path) return null;
  try {
    const res = await apiFetch(path);
    if (!res.ok) return null;
    const data = await res.json();
    updateFavoriteCache(entry.resourceKey, entry.index, data);
    return data;
  } catch {
    return null;
  }
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_FAVORITES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeFavoriteEntry).filter(Boolean);
  } catch {
    return [];
  }
}

function saveFavorites(entries) {
  try {
    localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(entries));
    return true;
  } catch {
    try {
      const slim = entries.map(({ cachedData, dataLocale, ...rest }) => rest);
      localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(slim));
      return true;
    } catch {
      return false;
    }
  }
}

function loadSheet() {
  try {
    const raw =
      typeof readCampaignScoped === "function" ? readCampaignScoped("sheet") : localStorage.getItem(STORAGE_SHEET);
    if (!raw) return normalizeSheet(null);
    return normalizeSheet(JSON.parse(raw));
  } catch {
    return normalizeSheet(null);
  }
}

function saveSheet(sheet) {
  try {
    const payload = JSON.stringify(sheet);
    if (typeof writeCampaignScoped === "function") writeCampaignScoped("sheet", payload);
    else localStorage.setItem(STORAGE_SHEET, payload);
    return true;
  } catch {
    try {
      const slim = {
        ...sheet,
        items: (sheet.items || []).map(({ cachedData, dataLocale, ...rest }) => rest),
      };
      const payload = JSON.stringify(slim);
      if (typeof writeCampaignScoped === "function") writeCampaignScoped("sheet", payload);
      else localStorage.setItem(STORAGE_SHEET, payload);
      return true;
    } catch {
      return false;
    }
  }
}

async function populateLocalesDropdown(selectEl, { onChange } = {}) {
  initLocaleFromStorage();
  if (!selectEl) return;
  selectEl.replaceChildren();

  const addOpt = (value, label) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    selectEl.appendChild(o);
  };

  addOpt("en", "English (predefinição)");

  try {
    const res = await apiFetch(apiLocalesPath());
    if (res.ok) {
      const data = await res.json();
      const seen = new Set(["en"]);
      for (const row of data.results || []) {
        const lang = row.lang;
        if (typeof lang === "string" && !seen.has(lang)) {
          seen.add(lang);
          addOpt(lang, lang);
        }
      }
    }
  } catch {
    /* fallback */
  }

  if (![...selectEl.options].some((o) => o.value === "pt-BR")) addOpt("pt-BR", "pt-BR");
  if (![...selectEl.options].some((o) => o.value === "fr-FR")) addOpt("fr-FR", "fr-FR");

  const saved = localStorage.getItem(STORAGE_LOCALE);
  const pick = saved && [...selectEl.options].some((o) => o.value === saved) ? saved : "pt-BR";
  selectEl.value = [...selectEl.options].some((o) => o.value === pick) ? pick : "en";
  setLocale(selectEl.value);

  if (onChange) {
    selectEl.addEventListener("change", () => {
      setLocale(selectEl.value);
      onChange(selectEl.value);
    });
  }
}

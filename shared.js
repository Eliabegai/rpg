/** Utilitários partilhados entre a exploração da API e a ficha. */
const API_BASE = "https://www.dnd5eapi.co";
const STORAGE_LOCALE = "dnd5eapi.locale";
const STORAGE_FAVORITES = "dnd5eapi.favorites";
const STORAGE_LIST_SCOPE = "dnd5eapi.listScope";
const STORAGE_SESSION = "dnd5eapi.session";
const STORAGE_SHEET = "dnd5eapi.sheet";
const STORAGE_GAME_TOOLS = "dnd5eapi.gameTools";
const STORAGE_DM_BATTLE = "dnd5eapi.dmBattle";
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
      resourcePath: "/api/2014/monsters",
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
};

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
  };
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
  };
}

function normalizeDmBattle(parsed) {
  const base = {
    party: [],
    encounters: [],
  };
  if (!parsed || typeof parsed !== "object") return base;
  const party = Array.isArray(parsed.party)
    ? parsed.party.map(normalizeDmPartyMember).filter(Boolean)
    : [];
  const encounters = Array.isArray(parsed.encounters)
    ? parsed.encounters.map(normalizeDmEncounter).filter(Boolean)
    : [];
  return { party, encounters };
}

function loadDmBattle() {
  try {
    const raw = localStorage.getItem(STORAGE_DM_BATTLE);
    if (!raw) return normalizeDmBattle(null);
    return normalizeDmBattle(JSON.parse(raw));
  } catch {
    return normalizeDmBattle(null);
  }
}

function saveDmBattle(battle) {
  try {
    localStorage.setItem(STORAGE_DM_BATTLE, JSON.stringify(normalizeDmBattle(battle)));
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
    const raw = localStorage.getItem(STORAGE_CAMPAIGN);
    if (!raw) return normalizeCampaign(null);
    return normalizeCampaign(JSON.parse(raw));
  } catch {
    return normalizeCampaign(null);
  }
}

function saveCampaign(campaign) {
  try {
    localStorage.setItem(STORAGE_CAMPAIGN, JSON.stringify(normalizeCampaign(campaign)));
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
    campaign,
    dmBattle: loadDmBattle(),
    favorites: loadFavorites(),
    sheet: loadSheet(),
    sessionHistory: loadSessionHistory(),
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
  spellcasting: { casterType: "none", slotsUsed: {} },
  hitDiceRemaining: null,
  restEnvironment: "tavern",
  items: [],
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
    const raw = localStorage.getItem(STORAGE_SESSION_HISTORY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveSessionHistory(entries) {
  try {
    localStorage.setItem(STORAGE_SESSION_HISTORY, JSON.stringify(entries.slice(0, SESSION_HISTORY_MAX)));
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
    localStorage.removeItem(STORAGE_SESSION_HISTORY);
    return true;
  } catch {
    return false;
  }
}

function normalizeSpellcasting(raw) {
  const casterType = normalizeCasterType(raw?.casterType);
  const slotsUsed =
    typeof getSpellSlotsUsedMap === "function" ? getSpellSlotsUsedMap(raw?.slotsUsed) : {};
  return { casterType, slotsUsed };
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
  return getMaxSpellSlotsMap(sheet?.spellcasting?.casterType, sheet?.characterLevel);
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
    saveDmBattle(battle);
    return { ok: true, memberId: existing.id, created: false };
  }
  const member = normalizeDmPartyMember({
    name,
    level: sheet.characterLevel,
    xpTotal: sheet.xpTotal,
    initiative: "",
    downed: false,
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
  const absolute = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE}${pathOrUrl}`;
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
  if (!pathOrUrl) return "";
  try {
    const u = new URL(pathOrUrl, API_BASE);
    return u.pathname;
  } catch {
    return String(pathOrUrl).split("?")[0];
  }
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
    path: cleanApiPath(raw.path || ""),
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
    path: cleanApiPath(raw.path || ""),
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
    const raw = localStorage.getItem(STORAGE_SHEET);
    if (!raw) return normalizeSheet(null);
    return normalizeSheet(JSON.parse(raw));
  } catch {
    return normalizeSheet(null);
  }
}

function saveSheet(sheet) {
  try {
    localStorage.setItem(STORAGE_SHEET, JSON.stringify(sheet));
    return true;
  } catch {
    try {
      const slim = {
        ...sheet,
        items: (sheet.items || []).map(({ cachedData, dataLocale, ...rest }) => rest),
      };
      localStorage.setItem(STORAGE_SHEET, JSON.stringify(slim));
      return true;
    } catch {
      return false;
    }
  }
}

/** `/api/2014/monsters/foo` → lista `/api/2014/monsters` */
function resourcePathFromItemPath(path) {
  const parts = cleanApiPath(path).split("/").filter(Boolean);
  if (parts.length >= 4 && parts[0] === "api" && parts[1] === "2014") {
    return `/${parts.slice(0, 3).join("/")}`;
  }
  if (parts.length === 3 && parts[0] === "api" && parts[1] === "2014") {
    return `/${parts.join("/")}`;
  }
  return cleanApiPath(path);
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
    const res = await fetch(`${API_BASE}/api/2014/locales`);
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

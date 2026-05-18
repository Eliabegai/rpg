/** Utilitários partilhados entre a exploração da API e a ficha. */
const API_BASE = "https://www.dnd5eapi.co";
const STORAGE_LOCALE = "dnd5eapi.locale";
const STORAGE_FAVORITES = "dnd5eapi.favorites";
const STORAGE_LIST_SCOPE = "dnd5eapi.listScope";
const STORAGE_SESSION = "dnd5eapi.session";
const STORAGE_SHEET = "dnd5eapi.sheet";
const STORAGE_GAME_TOOLS = "dnd5eapi.gameTools";
const STORAGE_DM_BATTLE = "dnd5eapi.dmBattle";
const STORAGE_DM_VISITED = "dnd5eapi.dmVisited";
const STORAGE_IMAGE_CACHE = "dnd5eapi.imageCache";
const IMAGE_CACHE_MAX_ENTRIES = 96;

/** Abas do painel de ferramentas (mesa). `dm` → página dedicada do mestre. */
const GAME_TOOLS_TABS = ["combat", "character", "dm"];

/**
 * @typedef {object} DmPartyMember
 * @property {string} id
 * @property {string} name
 * @property {string} initiative
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
  items: [],
};

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

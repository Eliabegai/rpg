/** Utilitários partilhados entre a exploração da API e a ficha. */
const API_BASE = "https://www.dnd5eapi.co";
const STORAGE_LOCALE = "dnd5eapi.locale";
const STORAGE_FAVORITES = "dnd5eapi.favorites";
const STORAGE_LIST_SCOPE = "dnd5eapi.listScope";
const STORAGE_SESSION = "dnd5eapi.session";
const STORAGE_SHEET = "dnd5eapi.sheet";

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
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
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

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_FAVORITES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveFavorites(entries) {
  try {
    localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(entries));
    return true;
  } catch {
    return false;
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
    return false;
  }
}

function resourcePathFromItemPath(path) {
  const parts = cleanApiPath(path).split("/").filter(Boolean);
  if (parts.length >= 4) return `/${parts.slice(0, 4).join("/")}`;
  return "";
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

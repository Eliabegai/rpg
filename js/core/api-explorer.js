/**
 * Explorador: dual-provider (dnd5eapi default + Open5e v2).
 * Ficha e mesa continuam só dnd5eapi via api-client.js / shared.js.
 */
const STORAGE_EXPLORER_PROVIDER = "dnd5eapi.explorerProvider";
const OPEN5E_API_BASE = "https://api.open5e.com";
const OPEN5E_API_PREFIX = "/v2";
const OPEN5E_FETCH_TIMEOUT_MS = 12000;
const OPEN5E_FETCH_RETRIES = 2;
const OPEN5E_FETCH_RETRY_BASE_MS = 450;

const EXPLORER_PROVIDERS = new Set(["dnd5eapi", "open5e"]);

const OPEN5E_RESOURCE_ALIASES = {
  creatures: "monsters",
};

const OPEN5E_RESOURCE_LABELS = {
  monsters: "Creatures",
  spells: "Spells",
  backgrounds: "Backgrounds",
  feats: "Feats",
  classes: "Classes",
  species: "Species",
  weapons: "Weapons",
  armor: "Armor",
  conditions: "Conditions",
  languages: "Languages",
  alignments: "Alignments",
  items: "Items",
  magicitems: "Magic Items",
  rules: "Rules",
};

const OPEN5E_RESOURCE_ORDER = [
  "creatures",
  "spells",
  "backgrounds",
  "feats",
  "classes",
  "species",
  "weapons",
  "armor",
  "conditions",
  "languages",
  "alignments",
  "items",
  "magicitems",
  "rules",
];

function getExplorerProvider() {
  try {
    const v = localStorage.getItem(STORAGE_EXPLORER_PROVIDER);
    if (EXPLORER_PROVIDERS.has(v)) return v;
  } catch {
    /* ignore */
  }
  return "dnd5eapi";
}

function setExplorerProvider(provider) {
  const p = String(provider || "").trim();
  if (!EXPLORER_PROVIDERS.has(p)) return false;
  try {
    localStorage.setItem(STORAGE_EXPLORER_PROVIDER, p);
    return true;
  } catch {
    return false;
  }
}

function isExplorerOpen5e() {
  return getExplorerProvider() === "open5e";
}

function explorerProviderLabel() {
  return isExplorerOpen5e() ? "Open5e" : "dnd5eapi";
}

/** Ficha/mesa: sempre dnd5eapi; explorador pode estar em Open5e. */
function explorerSupportsResource() {
  return true;
}

function isExplorerServerPaginated(resourceKey) {
  return false;
}

function isOpen5eDataPath(pathOrUrl) {
  return pathnameFromApiRef(pathOrUrl).startsWith(`${OPEN5E_API_PREFIX}/`);
}

function open5eAbsoluteUrl(pathOrUrl) {
  const path = pathnameFromApiRef(pathOrUrl);
  return `${OPEN5E_API_BASE}${path}`;
}

async function open5eFetch(pathOrUrl, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), OPEN5E_FETCH_TIMEOUT_MS);
  if (init.signal) {
    init.signal.addEventListener("abort", () => timeoutCtrl.abort(), { once: true });
  }
  try {
    return await fetch(open5eAbsoluteUrl(pathOrUrl), { ...init, headers, signal: timeoutCtrl.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      const e = new Error("open5e-timeout");
      e.cause = err;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOpen5eTimeoutError(err) {
  return Boolean(err && (err.message === "open5e-timeout" || err.name === "AbortError"));
}

function isOpen5eRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function isOpen5eRetryableError(err) {
  return (
    isOpen5eTimeoutError(err) ||
    err?.name === "TypeError" ||
    err?.message === "Failed to fetch" ||
    err?.message === "fetch failed"
  );
}

async function open5eFetchWithRetry(pathOrUrl, init = {}) {
  const maxAttempts = 1 + Math.max(0, OPEN5E_FETCH_RETRIES);
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await open5eFetch(pathOrUrl, init);
      if (res.ok || !isOpen5eRetryableStatus(res.status) || attempt === maxAttempts) {
        return res;
      }
      const waitMs = OPEN5E_FETCH_RETRY_BASE_MS * 2 ** (attempt - 1);
      await delay(waitMs);
    } catch (err) {
      lastErr = err;
      if (!isOpen5eRetryableError(err) || attempt === maxAttempts) {
        throw err;
      }
      const waitMs = OPEN5E_FETCH_RETRY_BASE_MS * 2 ** (attempt - 1);
      await delay(waitMs);
    }
  }
  if (lastErr) throw lastErr;
  throw new Error("open5e-fetch-failed");
}

function normalizeOpen5eListItem(row, resourceKey, listPath) {
  const rawKey = row?.key ?? row?.slug ?? row?.index ?? row?.id ?? row?.name;
  const key = rawKey != null ? String(rawKey) : "";
  const name = row?.name != null ? String(row.name) : row?.title != null ? String(row.title) : key;
  const fallbackPath = key ? `${String(listPath || "").replace(/\/?$/, "/")}${encodeURIComponent(key)}/` : "";
  const url = pathnameFromApiRef(row?.url || fallbackPath);
  const item = {
    index: key,
    name,
    url,
    _provider: "open5e",
    _open5eResourceKey: resourceKey,
  };
  if (row?.level != null && row.level !== "") item.level = row.level;

  const schoolObj = row?.school;
  const schoolName =
    schoolObj && typeof schoolObj === "object"
      ? String(schoolObj.name || schoolObj.key || "")
      : typeof schoolObj === "string"
        ? schoolObj
        : "";
  const schoolKey = schoolObj && typeof schoolObj === "object" ? String(schoolObj.key || "") : "";

  const classNames = [];
  const classKeys = [];
  const subclassKeys = [];
  const classRows = Array.isArray(row?.classes) ? row.classes : [];
  for (const cls of classRows) {
    if (cls == null) continue;
    if (typeof cls === "string") {
      classNames.push(cls);
      continue;
    }
    const ck = String(cls.key || "").trim();
    const cn = String(cls.name || "").trim();
    if (cn) classNames.push(cn);
    if (ck) classKeys.push(ck);
    if (cls.subclass_of && ck) subclassKeys.push(ck);
  }

  if (schoolName || schoolKey || classKeys.length || classNames.length) {
    item.spellMeta = {
      school: schoolName,
      schoolKey,
      classes: classKeys,
      classKeys,
      classNames,
      subclasses: subclassKeys.length ? subclassKeys : classKeys,
    };
  }
  return item;
}

function open5eCatalogFieldQuery(resourceKey) {
  if (resourceKey === "spells") {
    return {
      fields: "key,name,level,school,classes",
      "school__fields": "key,name",
      "classes__fields": "key,name",
    };
  }
  return { fields: "key,name" };
}

const OPEN5E_CATALOG_MEM = new Map();
const OPEN5E_CATALOG_STORAGE_PREFIX = "open5e.explorerCatalog.v2:";
const OPEN5E_CATALOG_PAGE_SIZE = 200;
const OPEN5E_CATALOG_MAX_PAGES = 40;

function open5eCatalogStorageKey(resourcePath) {
  return `${OPEN5E_CATALOG_STORAGE_PREFIX}${pathnameFromApiRef(resourcePath)}`;
}

function loadOpen5eCatalogCache(resourcePath) {
  const mem = OPEN5E_CATALOG_MEM.get(resourcePath);
  if (mem?.results?.length) return mem;
  try {
    const raw = sessionStorage.getItem(open5eCatalogStorageKey(resourcePath));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.results) || !parsed.results.length) return null;
    OPEN5E_CATALOG_MEM.set(resourcePath, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function saveOpen5eCatalogCache(resourcePath, payload) {
  OPEN5E_CATALOG_MEM.set(resourcePath, payload);
  try {
    sessionStorage.setItem(open5eCatalogStorageKey(resourcePath), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

async function fetchOpen5eCatalogPage(listPath, page, pageSize, extraQuery) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    page: String(page),
  });
  appendOpen5eQueryParams(params, extraQuery);
  const res = await open5eFetchWithRetry(`${listPath}${listPath.includes("?") ? "&" : "?"}${params.toString()}`);
  if (!res.ok) throw new Error("open5e-list");
  return res.json();
}

/**
 * Catálogo completo Open5e (campos leves). Pesquisa/filtros/paginação ficam no browser.
 * @returns {Promise<{ results: object[], total: number, serverPaginated: false, incomplete?: boolean, fromCache?: boolean }>}
 */
async function fetchOpen5eFullCatalog(
  resourceKey,
  resourcePath,
  { onChunk, shouldStop } = {}
) {
  const listPath = pathnameFromApiRef(resourcePath || "");
  if (!listPath.startsWith(`${OPEN5E_API_PREFIX}/`)) throw new Error("open5e-path");

  const cached = loadOpen5eCatalogCache(resourcePath);
  if (cached) {
    return {
      results: cached.results,
      total: cached.total || cached.results.length,
      serverPaginated: false,
      fromCache: true,
    };
  }

  let extraQuery = open5eCatalogFieldQuery(resourceKey);
  const all = [];
  let total = 0;
  let droppedFields = false;

  for (let page = 1; page <= OPEN5E_CATALOG_MAX_PAGES; page++) {
    if (typeof shouldStop === "function" && shouldStop()) {
      return { results: all, total: total || all.length, serverPaginated: false, incomplete: true };
    }
    let data;
    try {
      data = await fetchOpen5eCatalogPage(listPath, page, OPEN5E_CATALOG_PAGE_SIZE, extraQuery);
    } catch (err) {
      if (!droppedFields && extraQuery.fields) {
        droppedFields = true;
        extraQuery = {};
        page -= 1;
        continue;
      }
      if (all.length) {
        return { results: all, total: total || all.length, serverPaginated: false, incomplete: true };
      }
      throw err;
    }
    total = Number(data.count) || total;
    const rows = Array.isArray(data.results) ? data.results : [];
    const chunk = rows.map((row) => normalizeOpen5eListItem(row, resourceKey, listPath));
    all.push(...chunk);
    if (typeof onChunk === "function") {
      onChunk({ results: all.slice(), total: total || all.length, page });
    }
    if (!data.next || rows.length === 0) break;
  }

  const payload = { results: all, total: total || all.length };
  if (all.length) saveOpen5eCatalogCache(resourcePath, payload);
  return { ...payload, serverPaginated: false };
}

function appendOpen5eQueryParams(params, extraQuery) {
  if (!extraQuery || typeof extraQuery !== "object") return;
  for (const [key, value] of Object.entries(extraQuery)) {
    if (value == null) continue;
    const s = String(value).trim();
    if (!s) continue;
    params.set(key, s);
  }
}

/**
 * Lista paginada Open5e (dropdowns de filtros). `fields` no extraQuery evita payloads pesados.
 */
async function fetchOpen5ePagedResults(resourcePath, { extraQuery = {}, pageSize = 100, maxPages = 5 } = {}) {
  const listPath = pathnameFromApiRef(resourcePath || "");
  if (!listPath.startsWith(`${OPEN5E_API_PREFIX}/`)) throw new Error("open5e-path");
  const all = [];
  const pages = Math.max(1, maxPages);
  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      limit: String(pageSize),
      page: String(page),
    });
    appendOpen5eQueryParams(params, extraQuery);
    const res = await open5eFetchWithRetry(`${listPath}${listPath.includes("?") ? "&" : "?"}${params.toString()}`);
    if (!res.ok) throw new Error("open5e-list");
    const data = await res.json();
    const rows = Array.isArray(data.results) ? data.results : [];
    all.push(...rows);
    if (!data.next || rows.length === 0) break;
  }
  return all;
}

/**
 * Entradas da sidebar do explorador.
 * @returns {Promise<Array<{ key: string, path: string, label?: string, hint?: string }>>}
 */
async function fetchExplorerCatalog() {
  if (isExplorerOpen5e()) {
    const res = await open5eFetchWithRetry(`${OPEN5E_API_PREFIX}/`);
    if (!res.ok) throw new Error("open5e-catalog");
    const data = await res.json();
    const entries = Object.entries(data)
      .filter(([, v]) => typeof v === "string" && pathnameFromApiRef(v).startsWith(`${OPEN5E_API_PREFIX}/`))
      .map(([rawKey, fullUrl]) => {
        const key = OPEN5E_RESOURCE_ALIASES[rawKey] || rawKey;
        return {
          rawKey,
          key,
          path: pathnameFromApiRef(fullUrl),
          label: OPEN5E_RESOURCE_LABELS[key] || formatResourceLabel(key),
          hint: "Open5e v2 (inglês)",
        };
      });
    const rank = (rawKey) => {
      const i = OPEN5E_RESOURCE_ORDER.indexOf(rawKey);
      return i >= 0 ? i : OPEN5E_RESOURCE_ORDER.length + 1;
    };
    return entries.sort((a, b) => rank(a.rawKey) - rank(b.rawKey) || a.label.localeCompare(b.label));
  }
  const res = await apiFetch(apiRootPath());
  if (!res.ok) throw new Error("catalog");
  const data = await res.json();
  return Object.entries(data)
    .filter(([, v]) => typeof v === "string" && isApiCatalogDataPath(v))
    .map(([key, path]) => ({ key, path }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * @returns {Promise<{ results: object[], total: number, serverPaginated: boolean }>}
 */
async function fetchExplorerResourceList(
  resourceKey,
  resourcePath,
  { onChunk, shouldStop } = {}
) {
  if (isExplorerOpen5e()) {
    return fetchOpen5eFullCatalog(resourceKey, resourcePath, { onChunk, shouldStop });
  }

  const res = await apiFetch(resourcePath);
  if (!res.ok) throw new Error("list");
  const data = await res.json();
  const results =
    typeof resultsFromPayload === "function" ? resultsFromPayload(data) : data.results || [];
  if (!results) {
    return { results: [], total: 0, serverPaginated: false, notAList: true, raw: data };
  }
  return {
    results,
    total: data.count ?? results.length,
    serverPaginated: false,
  };
}

async function fetchExplorerItemDetail(resourceKey, { url, index } = {}) {
  if (isExplorerOpen5e()) {
    const fallbackPath =
      index != null && index !== ""
        ? `${OPEN5E_API_PREFIX}/${resourceKey === "monsters" ? "creatures" : resourceKey}/${encodeURIComponent(String(index))}/`
        : "";
    const path = pathnameFromApiRef(url || fallbackPath);
    if (!path.startsWith(`${OPEN5E_API_PREFIX}/`)) throw new Error("open5e-detail-path");
    const res = await open5eFetchWithRetry(path);
    if (!res.ok) throw new Error("open5e-detail");
    const raw = await res.json();
    if (resourceKey === "monsters") {
      return typeof adaptOpen5eCreatureToMonster === "function"
        ? adaptOpen5eCreatureToMonster(raw)
        : raw;
    }
    return raw;
  }
  const path = url || (index ? apiItemPath(resourceKey, index) : "");
  const res = await apiFetch(path);
  if (!res.ok) throw new Error("detail");
  return res.json();
}

function explorerApiDocsUrl() {
  if (isExplorerOpen5e()) return "https://open5e.com/api-docs";
  return apiUrl(apiRootPath());
}

function populateExplorerProviderSelect(selectEl, { onChange } = {}) {
  if (!selectEl) return;
  selectEl.replaceChildren();
  const opts = [
    { value: "dnd5eapi", label: "dnd5eapi (pt-BR)" },
    { value: "open5e", label: "Open5e (inglês)" },
  ];
  for (const o of opts) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    selectEl.appendChild(opt);
  }
  selectEl.value = getExplorerProvider();
  selectEl.addEventListener("change", () => {
    if (!setExplorerProvider(selectEl.value)) return;
    if (typeof onChange === "function") onChange(selectEl.value);
    else window.location.reload();
  });
}

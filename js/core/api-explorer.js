/**
 * Explorador: dual-provider (dnd5eapi default + spike Open5e creatures).
 * Ficha e mesa continuam só dnd5eapi via api-client.js / shared.js.
 */
const STORAGE_EXPLORER_PROVIDER = "dnd5eapi.explorerProvider";
const OPEN5E_API_BASE = "https://api.open5e.com";
const OPEN5E_API_PREFIX = "/v2";

const EXPLORER_PROVIDERS = new Set(["dnd5eapi", "open5e"]);

/** Recursos disponíveis no modo Open5e (spike v5.0). */
const OPEN5E_EXPLORER_RESOURCES = [
  {
    key: "monsters",
    label: "Creatures",
    hint: "Open5e v2 — bestiário em inglês",
    listPath: "/v2/creatures/",
  },
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
function explorerSupportsResource(resourceKey) {
  if (!isExplorerOpen5e()) return true;
  return resourceKey === "monsters";
}

function isExplorerServerPaginated(resourceKey) {
  return isExplorerOpen5e() && resourceKey === "monsters";
}

function isOpen5eDataPath(pathOrUrl) {
  return pathnameFromApiRef(pathOrUrl).startsWith(`${OPEN5E_API_PREFIX}/`);
}

function open5eAbsoluteUrl(pathOrUrl) {
  const path = pathnameFromApiRef(pathOrUrl);
  return `${OPEN5E_API_BASE}${path}`;
}

async function open5eFetch(pathOrUrl, init = {}) {
  return fetch(open5eAbsoluteUrl(pathOrUrl), init);
}

function normalizeOpen5eListItem(row) {
  const key = String(row?.key ?? "");
  return {
    index: key,
    name: row?.name != null ? String(row.name) : key,
    url: `${OPEN5E_API_PREFIX}/creatures/${key}/`,
    _provider: "open5e",
  };
}

/**
 * Entradas da sidebar do explorador.
 * @returns {Promise<Array<{ key: string, path: string, label?: string, hint?: string }>>}
 */
async function fetchExplorerCatalog() {
  if (isExplorerOpen5e()) {
    return OPEN5E_EXPLORER_RESOURCES.map((r) => ({
      key: r.key,
      path: r.listPath,
      label: r.label,
      hint: r.hint,
    }));
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
async function fetchExplorerResourceList(resourceKey, resourcePath, { page = 1, search = "", pageSize = 25 } = {}) {
  if (isExplorerServerPaginated(resourceKey)) {
    const params = new URLSearchParams({
      limit: String(pageSize),
      page: String(Math.max(1, page)),
    });
    const q = String(search || "").trim();
    if (q) params.set("name__icontains", q);
    const res = await open5eFetch(`${OPEN5E_API_PREFIX}/creatures/?${params}`);
    if (!res.ok) throw new Error("open5e-list");
    const data = await res.json();
    const results = (data.results || []).map(normalizeOpen5eListItem);
    return {
      results,
      total: Number(data.count) || results.length,
      serverPaginated: true,
    };
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
  if (isExplorerOpen5e() && resourceKey === "monsters") {
    const key = index || pathnameFromApiRef(url).split("/").filter(Boolean).pop();
    const res = await open5eFetch(`${OPEN5E_API_PREFIX}/creatures/${encodeURIComponent(key)}/`);
    if (!res.ok) throw new Error("open5e-detail");
    const raw = await res.json();
    return typeof adaptOpen5eCreatureToMonster === "function"
      ? adaptOpen5eCreatureToMonster(raw)
      : raw;
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
    { value: "open5e", label: "Open5e (spike)" },
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

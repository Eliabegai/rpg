/**
 * Versão global da API dnd5eapi (2014 | 2024).
 * Carregar antes de shared.js em todas as páginas.
 *
 * Trocar versão:
 * - UI: select #apiVersionSelect (se existir)
 * - localStorage: dnd5eapi.apiVersion
 * - URL: ?api=2024 (prioridade na carga da página)
 */
var API_BASE = "https://www.dnd5eapi.co";

const STORAGE_API_VERSION = "dnd5eapi.apiVersion";
const DEFAULT_API_VERSION = "2014";
const ALLOWED_API_VERSIONS = new Set(["2014", "2024"]);

function getApiVersion() {
  try {
    const stored = localStorage.getItem(STORAGE_API_VERSION);
    if (ALLOWED_API_VERSIONS.has(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_API_VERSION;
}

function setApiVersion(version) {
  const v = String(version || "").trim();
  if (!ALLOWED_API_VERSIONS.has(v)) return false;
  try {
    localStorage.setItem(STORAGE_API_VERSION, v);
  } catch {
    return false;
  }
  return true;
}

function initApiVersionFromUrlOrStorage() {
  try {
    const q = new URLSearchParams(window.location.search).get("api");
    if (ALLOWED_API_VERSIONS.has(q)) {
      setApiVersion(q);
      return q;
    }
  } catch {
    /* ignore */
  }
  return getApiVersion();
}

/** `/api/2014` ou `/api/2024` */
function apiBasePath() {
  return `/api/${getApiVersion()}`;
}

/** `/api/2014/` */
function apiRootPath() {
  return `${apiBasePath()}/`;
}

/** `/api/2014/classes` */
function apiListPath(resourceKey) {
  const key = String(resourceKey || "").replace(/^\/+/, "");
  return key ? `${apiBasePath()}/${key}` : apiBasePath();
}

/** `/api/2014/classes/fighter` */
function apiItemPath(resourceKey, index) {
  const ix = String(index ?? "").replace(/^\/+/, "");
  return ix ? `${apiListPath(resourceKey)}/${ix}` : apiListPath(resourceKey);
}

/**
 * Reescreve `/api/2014/…` ou `/api/2024/…` para a versão ativa (favoritos, URLs guardadas).
 */
function withCurrentApiVersion(pathOrUrl) {
  if (pathOrUrl == null || pathOrUrl === "") return pathOrUrl;
  const s = String(pathOrUrl);
  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      const u = new URL(s);
      if (/^\/api\/(2014|2024)(\/|$)/.test(u.pathname)) {
        u.pathname = u.pathname.replace(/^\/api\/(2014|2024)/, apiBasePath());
        return u.toString();
      }
    } catch {
      return s;
    }
    return s;
  }
  return s.replace(/^\/api\/(2014|2024)(?=\/|$)/, apiBasePath());
}

function isApiVersionSegment(segment) {
  return ALLOWED_API_VERSIONS.has(String(segment));
}

function populateApiVersionSelect(selectEl, { onChange } = {}) {
  if (!selectEl) return;
  initApiVersionFromUrlOrStorage();
  selectEl.replaceChildren();
  for (const v of ["2014", "2024"]) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = `API ${v}`;
    selectEl.appendChild(opt);
  }
  selectEl.value = getApiVersion();
  selectEl.addEventListener("change", () => {
    if (!setApiVersion(selectEl.value)) return;
    if (typeof onChange === "function") onChange(selectEl.value);
    else window.location.reload();
  });
}

initApiVersionFromUrlOrStorage();

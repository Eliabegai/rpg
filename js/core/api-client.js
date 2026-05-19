/**
 * Cliente de paths e origem da API de dados D&D 5e (dnd5eapi.co).
 * Carregar antes de shared.js em todas as páginas.
 *
 * Migração futura: alterar só API_BASE e/ou API_CATALOG_VERSION (e adaptadores
 * de JSON nos módulos de domínio — ficha, explorador, mesa).
 */
var API_BASE = "https://www.dnd5eapi.co";

/** Segmento do catálogo na URL (`/api/{versão}/…`). Hoje: SRD 5e 2014. */
const API_CATALOG_VERSION = "2014";

const API_DATA_PREFIX = `/api/${API_CATALOG_VERSION}`;
const API_IMAGES_PREFIX = "/api/images/";

function apiCatalogVersion() {
  return API_CATALOG_VERSION;
}

/** `/api/2014` */
function apiBasePath() {
  return API_DATA_PREFIX;
}

/** `/api/2014/` */
function apiRootPath() {
  return `${API_DATA_PREFIX}/`;
}

/** `/api/2014/classes` */
function apiListPath(resourceKey) {
  const key = String(resourceKey || "").replace(/^\/+/, "");
  return key ? `${API_DATA_PREFIX}/${key}` : API_DATA_PREFIX;
}

/** `/api/2014/classes/fighter` */
function apiItemPath(resourceKey, index) {
  const ix = String(index ?? "").replace(/^\/+/, "");
  return ix ? `${apiListPath(resourceKey)}/${ix}` : apiListPath(resourceKey);
}

/** `/api/2014/locales` */
function apiLocalesPath() {
  return apiListPath("locales");
}

function isApiCatalogSegment(segment) {
  return String(segment) === API_CATALOG_VERSION;
}

function pathnameFromApiRef(pathOrUrl) {
  if (pathOrUrl == null || pathOrUrl === "") return "";
  const s = String(pathOrUrl);
  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      return new URL(s).pathname;
    } catch {
      return s.split("?")[0];
    }
  }
  const path = s.split("?")[0];
  return path.startsWith("/") ? path : `/${path}`;
}

function isApiImagesPath(pathOrUrl) {
  return pathnameFromApiRef(pathOrUrl).startsWith(API_IMAGES_PREFIX);
}

/** Path relativo sob `/api/{catálogo}/` (exclui imagens). */
function isApiCatalogDataPath(pathOrUrl) {
  if (!pathOrUrl || isApiImagesPath(pathOrUrl)) return false;
  const path = pathnameFromApiRef(pathOrUrl);
  return path === API_DATA_PREFIX || path.startsWith(`${API_DATA_PREFIX}/`);
}

/**
 * Reescreve `/api/{qualquer-segmento}/…` para o catálogo ativo (favoritos, URLs guardadas).
 */
function withActiveApiPath(pathOrUrl) {
  if (pathOrUrl == null || pathOrUrl === "") return pathOrUrl;
  const s = String(pathOrUrl);
  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      const u = new URL(s);
      if (/^\/api\/[^/]+(\/|$)/.test(u.pathname) && !u.pathname.startsWith(API_IMAGES_PREFIX)) {
        u.pathname = u.pathname.replace(/^\/api\/[^/]+/, API_DATA_PREFIX);
        return u.toString();
      }
    } catch {
      return s;
    }
    return s;
  }
  return s.replace(/^\/api\/[^/]+(?=\/|$)/, API_DATA_PREFIX);
}

/**
 * Path de item → path da lista (`/api/2014/monsters/foo` → `/api/2014/monsters`).
 */
function resourcePathFromItemPath(pathOrUrl) {
  const parts = pathnameFromApiRef(withActiveApiPath(pathOrUrl)).split("/").filter(Boolean);
  if (parts.length >= 4 && parts[0] === "api" && isApiCatalogSegment(parts[1])) {
    return apiListPath(parts[2]);
  }
  if (parts.length === 3 && parts[0] === "api" && isApiCatalogSegment(parts[1])) {
    return apiListPath(parts[2]);
  }
  return pathnameFromApiRef(withActiveApiPath(pathOrUrl));
}

/** Path para favorito / item da ficha a partir de campos conhecidos. */
function buildApiEntryPath({ resourceKey, index, path } = {}) {
  if (path) return pathnameFromApiRef(withActiveApiPath(path));
  if (resourceKey && index != null && index !== "") {
    return apiItemPath(resourceKey, index);
  }
  if (resourceKey) return apiListPath(resourceKey);
  return "";
}

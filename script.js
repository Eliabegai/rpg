const API_BASE = "https://www.dnd5eapi.co";
const STORAGE_LOCALE = "dnd5eapi.locale";
const STORAGE_FAVORITES = "dnd5eapi.favorites";
const STORAGE_LIST_SCOPE = "dnd5eapi.listScope";
const STORAGE_SESSION = "dnd5eapi.session";

const DEFAULT_SESSION = {
  resourceKey: "",
  resourcePath: "",
  itemIndex: "",
  itemPath: "",
  filter: "",
  spellLevel: "",
  page: 1,
  listScope: "all",
};
/** BCP 47 — @see https://5e-bits.github.io/docs/reference/multilingual */
let currentLocale = "pt-BR";
let listScopeFilter = "all";
const PAGE_SIZE = 25;

const apiRootNav = document.getElementById("apiRootNav");
const mainTitle = document.getElementById("mainTitle");
const mainSubtitle = document.getElementById("mainSubtitle");
const browsePanel = document.getElementById("browsePanel");
const itemFilterInput = document.getElementById("itemFilterInput");
const itemResultsList = document.getElementById("itemResultsList");
const paginationTop = document.getElementById("paginationTop");
const paginationBottom = document.getElementById("paginationBottom");
const detailPanel = document.getElementById("detailPanel");
const resourceExtraFilters = document.getElementById("resourceExtraFilters");
const spellLevelSelect = document.getElementById("spellLevelSelect");
const localeSelect = document.getElementById("localeSelect");
const listScopeSelect = document.getElementById("listScopeSelect");
const apiRootDocLink = document.getElementById("apiRootDocLink");
const favoritesCountHint = document.getElementById("favoritesCountHint");

let activeSidebarBtn = null;

let currentResourceLabel = "";
let spellLevelFilterValue = "";
let allResults = [];
let currentFilter = "";
let currentPage = 1;
let selectedItemUrl = null;
let selectedItemIndex = "";
let selectedItemPath = "";

let filterDebounceId = 0;

/**
 * URL absoluta com `lang` (recomendado pela API). Só altera pedidos ao host dnd5eapi.co.
 * @see https://5e-bits.github.io/docs/reference/multilingual
 */
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

/**
 * fetch à API com Accept-Language (RFC 5646). Se existir `lang` na query, este cabeçalho é redundante mas alinhado à doc.
 */
function apiFetch(pathOrUrl, init = {}) {
  const url = apiUrl(pathOrUrl);
  const headers = new Headers(init.headers);
  headers.set("Accept-Language", currentLocale);
  return fetch(url, { ...init, headers });
}

function initLocaleFromStorage() {
  const v = localStorage.getItem(STORAGE_LOCALE);
  currentLocale = v && typeof v === "string" && v.length > 0 ? v : "pt-BR";
}

function syncApiRootDocLinkHref() {
  if (apiRootDocLink) apiRootDocLink.href = apiUrl("/api/2014/");
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION);
    if (!raw) return { ...DEFAULT_SESSION };
    return { ...DEFAULT_SESSION, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SESSION };
  }
}

function saveSession(partial) {
  try {
    const next = { ...loadSession(), ...partial };
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(next));
    if (partial.listScope != null) {
      localStorage.setItem(STORAGE_LIST_SCOPE, partial.listScope);
    }
  } catch {
    /* quota / modo privado */
  }
}

function persistUiSession() {
  saveSession({
    resourceKey: currentResourceLabel,
    resourcePath: activeSidebarBtn?.dataset.resourcePath ?? loadSession().resourcePath,
    itemIndex: selectedItemIndex,
    itemPath: selectedItemPath,
    filter: currentFilter,
    spellLevel: spellLevelFilterValue,
    page: currentPage,
    listScope: listScopeFilter,
  });
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
    updateFavoritesCountHint();
    return true;
  } catch {
    return false;
  }
}

function updateFavoritesCountHint() {
  if (!favoritesCountHint) return;
  const total = loadFavorites().length;
  const inResource =
    currentResourceLabel && listScopeFilter === "favorites"
      ? getFilteredResults().length
      : null;
  if (inResource != null && currentResourceLabel) {
    favoritesCountHint.textContent = `${total} favorito(s) guardado(s) · ${inResource} neste recurso com o filtro ativo.`;
  } else {
    favoritesCountHint.textContent =
      total === 0
        ? "Nenhum favorito guardado ainda — usa ★ na lista ou no detalhe."
        : `${total} favorito(s) guardado(s) neste navegador.`;
  }
}

/** Caminho API sem query (para guardar favoritos de forma estável). */
function cleanApiPath(pathOrUrl) {
  if (!pathOrUrl) return "";
  try {
    const u = new URL(pathOrUrl, API_BASE);
    return u.pathname;
  } catch {
    return String(pathOrUrl).split("?")[0];
  }
}

function itemStableIndex(item) {
  if (item.index != null && item.index !== "") return String(item.index);
  if (item.url) {
    const parts = cleanApiPath(item.url).split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  }
  return "";
}

function isFavorite(resourceKey, index) {
  if (!resourceKey || index === "" || index == null) return false;
  const ix = String(index);
  return loadFavorites().some((f) => f.resourceKey === resourceKey && String(f.index) === ix);
}

/** Alterna favorito e grava em localStorage. Devolve true se ficou marcado. */
function toggleFavoriteForItem({ resourceKey, index, name, path }) {
  const ix = String(index ?? "");
  if (!resourceKey || ix === "") return false;
  const favs = loadFavorites();
  const i = favs.findIndex((f) => f.resourceKey === resourceKey && String(f.index) === ix);
  const entry = {
    resourceKey,
    index: ix,
    name: name != null ? String(name) : ix,
    path: cleanApiPath(path || ""),
  };
  if (i >= 0) favs.splice(i, 1);
  else favs.push(entry);
  if (!saveFavorites(favs)) return isFavorite(resourceKey, ix);
  return i < 0;
}

function setFavoriteButtonState(btn, on) {
  if (!btn) return;
  btn.classList.toggle("is-favorite", on);
  btn.setAttribute("aria-pressed", String(on));
  if (btn.classList.contains("result-fav") && !btn.disabled) {
    btn.textContent = on ? "★" : "☆";
    btn.setAttribute("aria-label", on ? "Remover dos favoritos" : "Adicionar aos favoritos");
  }
}

function syncFavoriteStarInList(resourceKey, index) {
  if (!resourceKey || index === "") return;
  const on = isFavorite(resourceKey, index);
  itemResultsList.querySelectorAll(".result-fav").forEach((btn) => {
    if (btn.dataset.resource === resourceKey && btn.dataset.index === String(index)) {
      setFavoriteButtonState(btn, on);
    }
  });
}

function afterFavoriteChange(resourceKey, index) {
  syncFavoriteStarInList(resourceKey, index);
  updateFavoritesCountHint();
  if (listScopeFilter === "favorites" && resourceKey === currentResourceLabel) {
    renderResultsPage();
  }
}

async function initLocalesDropdown() {
  initLocaleFromStorage();
  if (!localeSelect) return;
  localeSelect.replaceChildren();

  const addOpt = (value, label) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    localeSelect.appendChild(o);
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
    /* fallback abaixo */
  }

  if (![...localeSelect.options].some((o) => o.value === "pt-BR")) addOpt("pt-BR", "pt-BR");
  if (![...localeSelect.options].some((o) => o.value === "fr-FR")) addOpt("fr-FR", "fr-FR");

  const saved = localStorage.getItem(STORAGE_LOCALE);
  const pick = saved && [...localeSelect.options].some((o) => o.value === saved) ? saved : "pt-BR";
  localeSelect.value = [...localeSelect.options].some((o) => o.value === pick) ? pick : "en";
  currentLocale = localeSelect.value;
  localStorage.setItem(STORAGE_LOCALE, currentLocale);
}

function onLocaleChange() {
  if (!localeSelect) return;
  currentLocale = localeSelect.value;
  localStorage.setItem(STORAGE_LOCALE, currentLocale);
  syncApiRootDocLinkHref();
  const btn = activeSidebarBtn;
  if (btn?.dataset.resourceKey && btn.dataset.resourcePath) {
    selectResource(btn.dataset.resourceKey, btn.dataset.resourcePath, btn);
  }
}

function onDetailPanelClick(e) {
  const btn = e.target.closest('[data-action="toggle-fav"]');
  if (!btn || !detailPanel.contains(btn)) return;
  const resourceKey = btn.getAttribute("data-resource");
  const index = btn.getAttribute("data-index");
  const name = btn.getAttribute("data-name") || "";
  const path = btn.getAttribute("data-path") || "";
  toggleFavoriteForItem({ resourceKey, index, name, path });
  setDetailFavoriteButtonState(btn, isFavorite(resourceKey, index));
  afterFavoriteChange(resourceKey, index);
}

function setDetailFavoriteButtonState(btn, on) {
  if (!btn) return;
  btn.classList.toggle("is-favorite", on);
  btn.setAttribute("aria-pressed", String(on));
  btn.textContent = on ? "★ Nos favoritos" : "☆ Adicionar aos favoritos";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function formatResourceLabel(key) {
  return key
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function itemSearchText(item) {
  const name = item.name != null ? String(item.name) : "";
  const index = item.index != null ? String(item.index) : "";
  return `${name} ${index}`.trim().toLowerCase();
}

function getFilteredResults() {
  let list = allResults.slice();

  if (listScopeFilter === "favorites" && currentResourceLabel) {
    list = list.filter((item) => isFavorite(currentResourceLabel, itemStableIndex(item)));
  }

  if (currentResourceLabel === "spells" && spellLevelFilterValue !== "") {
    const lv = Number(spellLevelFilterValue);
    list = list.filter((item) => Number(item.level) === lv);
  }

  const q = currentFilter.trim().toLowerCase();
  if (!q) return list;
  return list.filter((item) => itemSearchText(item).includes(q));
}

function getTotalPages(filteredLength) {
  return Math.max(1, Math.ceil(filteredLength / PAGE_SIZE));
}

function setSidebarActive(btn) {
  if (activeSidebarBtn) activeSidebarBtn.classList.remove("is-active");
  activeSidebarBtn = btn;
  if (btn) btn.classList.add("is-active");
}

function renderPagination(totalItems, totalPages) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(totalItems, currentPage * PAGE_SIZE);

  function buildPaginationBar() {
    const wrap = document.createElement("div");
    wrap.className = "pagination";

    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "Anterior";
    prev.disabled = currentPage <= 1;
    prev.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderResultsPage();
        persistUiSession();
      }
    });

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Seguinte";
    next.disabled = currentPage >= totalPages;
    next.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage += 1;
        renderResultsPage();
        persistUiSession();
      }
    });

    const info = document.createElement("span");
    info.textContent =
      totalItems === 0
        ? "0 itens"
        : `${start}–${end} de ${totalItems} · página ${currentPage} / ${totalPages}`;

    wrap.append(prev, info, next);
    return wrap;
  }

  const top = buildPaginationBar();
  const bottom = buildPaginationBar();
  paginationTop.replaceChildren(...top.children);
  paginationBottom.replaceChildren(...bottom.children);
}

function renderResultsPage() {
  const filtered = getFilteredResults();
  const totalItems = filtered.length;
  const totalPages = getTotalPages(totalItems);

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  itemResultsList.replaceChildren();

  if (totalItems === 0) {
    const li = document.createElement("li");
    const empty = document.createElement("p");
    empty.className = "detail-placeholder";
    empty.style.margin = "0.75rem";
    empty.textContent =
      allResults.length === 0
        ? "Lista vazia."
        : listScopeFilter === "favorites"
          ? "Nenhum favorito neste recurso (ou nada coincide com pesquisa / nível)."
          : currentResourceLabel === "spells" && spellLevelFilterValue !== ""
            ? "Nenhum feitiço com este nível (ou combinação com a pesquisa)."
            : "Nenhum resultado com este filtro.";
    li.appendChild(empty);
    itemResultsList.appendChild(li);
  } else {
    const slice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    for (const item of slice) {
      const li = document.createElement("li");
      li.className = "result-row-wrap";

      const idx = itemStableIndex(item);
      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = "result-fav";
      favBtn.setAttribute("aria-label", "Marcar ou desmarcar favorito");
      if (!idx) {
        favBtn.disabled = true;
        favBtn.classList.add("result-fav--disabled");
        favBtn.setAttribute("aria-hidden", "true");
        favBtn.textContent = "·";
      } else {
        favBtn.dataset.resource = currentResourceLabel;
        favBtn.dataset.index = idx;
        setFavoriteButtonState(favBtn, isFavorite(currentResourceLabel, idx));
        favBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          toggleFavoriteForItem({
            resourceKey: currentResourceLabel,
            index: idx,
            name: String(item.name ?? item.index ?? idx),
            path: item.url || "",
          });
          setFavoriteButtonState(favBtn, isFavorite(currentResourceLabel, idx));
          afterFavoriteChange(currentResourceLabel, idx);
        });
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "result-row";
      btn.dataset.index = idx;
      const url = item.url ? apiUrl(item.url) : "";
      if (url && selectedItemUrl === url) btn.classList.add("is-selected");

      const label = document.createElement("span");
      label.textContent = item.name ?? item.index ?? "(sem nome)";

      btn.appendChild(label);

      const metaParts = [];
      if (item.index != null) metaParts.push(String(item.index));
      if (item.level !== undefined && item.level !== null) metaParts.push(`nível ${item.level}`);

      if (metaParts.length) {
        const meta = document.createElement("span");
        meta.className = "result-meta";
        meta.textContent = metaParts.join(" · ");
        btn.appendChild(meta);
      }

      btn.addEventListener("click", () => {
        if (url) loadItemDetail(url, btn);
      });

      li.append(favBtn, btn);
      itemResultsList.appendChild(li);
    }
  }

  renderPagination(totalItems, totalPages);
  updateFavoritesCountHint();
}

function resultsFromPayload(data) {
  if (data && Array.isArray(data.results)) return data.results;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const entries = Object.entries(data).filter(([, v]) => typeof v === "string" && v.startsWith("/api/"));
    if (entries.length > 0) {
      return entries.map(([key, url]) => ({
        index: key,
        name: formatResourceLabel(key),
        url,
      }));
    }
  }
  return null;
}

function setResourceExtraFiltersVisible(show, resetSpellLevel = true) {
  if (resourceExtraFilters) resourceExtraFilters.hidden = !show;
  if (spellLevelSelect && resetSpellLevel) {
    spellLevelSelect.value = "";
    spellLevelFilterValue = "";
  }
}

function applySessionToUi(session) {
  currentFilter = session.filter ?? "";
  if (itemFilterInput) itemFilterInput.value = currentFilter;
  currentPage = Math.max(1, Number(session.page) || 1);
  spellLevelFilterValue = session.spellLevel ?? "";
  if (spellLevelSelect) spellLevelSelect.value = spellLevelFilterValue;
  listScopeFilter = session.listScope === "favorites" ? "favorites" : "all";
  if (listScopeSelect) listScopeSelect.value = listScopeFilter;
}

async function openItemByIndex(index, fallbackPath) {
  const ix = String(index ?? "");
  if (!ix && !fallbackPath) return;

  const filtered = getFilteredResults();
  let item = filtered.find((i) => itemStableIndex(i) === ix);
  if (!item) item = allResults.find((i) => itemStableIndex(i) === ix);

  let url = "";
  if (item?.url) url = apiUrl(item.url);
  else if (fallbackPath) url = apiUrl(fallbackPath);
  if (!url) return;

  const posInFiltered = filtered.findIndex((i) => itemStableIndex(i) === ix);
  if (posInFiltered >= 0) {
    const targetPage = Math.floor(posInFiltered / PAGE_SIZE) + 1;
    if (targetPage !== currentPage) {
      currentPage = targetPage;
      renderResultsPage();
    }
  }

  const rowBtn = itemResultsList.querySelector(`.result-row[data-index="${CSS.escape(ix)}"]`);
  await loadItemDetail(url, rowBtn);
}

async function selectResource(label, path, sidebarBtn, sessionRestore = null) {
  setSidebarActive(sidebarBtn);
  currentResourceLabel = label;
  setResourceExtraFiltersVisible(label === "spells", !sessionRestore);

  if (sessionRestore) {
    applySessionToUi(sessionRestore);
  } else {
    itemFilterInput.value = "";
    currentFilter = "";
    currentPage = 1;
    spellLevelFilterValue = "";
    if (spellLevelSelect) spellLevelSelect.value = "";
    selectedItemUrl = null;
    selectedItemIndex = "";
    selectedItemPath = "";
    saveSession({
      resourceKey: label,
      resourcePath: path,
      itemIndex: "",
      itemPath: "",
      filter: "",
      spellLevel: "",
      page: 1,
      listScope: listScopeFilter,
    });
  }

  mainTitle.textContent = formatResourceLabel(label);
  mainSubtitle.textContent = "A carregar…";
  browsePanel.hidden = false;
  allResults = [];
  if (!sessionRestore?.itemIndex) {
    selectedItemUrl = null;
    selectedItemIndex = "";
    selectedItemPath = "";
    detailPanel.innerHTML = '<p class="detail-placeholder">Clica num item da lista para ver o detalhe.</p>';
  }

  try {
    const res = await apiFetch(path);
    if (!res.ok) throw new Error("fetch");
    const data = await res.json();
    const results = resultsFromPayload(data);

    if (!results) {
      mainSubtitle.textContent = "Este endpoint não devolve uma lista conhecida — mostramos o JSON em formato legível.";
      allResults = [];
      browsePanel.hidden = true;
      renderDetailFallback(data);
      return;
    }

    allResults = results;
    const total = data.count ?? results.length;
    if (label === "spells") {
      mainSubtitle.textContent = `${total} feitiços — filtra por nível e/ou pesquisa; paginação (${PAGE_SIZE} por página).`;
    } else {
      mainSubtitle.textContent = `${total} itens — filtra com a pesquisa; usa a paginação para percorrer (${PAGE_SIZE} por página).`;
    }
    renderResultsPage();

    if (sessionRestore?.itemIndex || sessionRestore?.itemPath) {
      await openItemByIndex(sessionRestore.itemIndex, sessionRestore.itemPath);
    }

    persistUiSession();
  } catch {
    mainSubtitle.textContent = "Erro ao carregar este recurso.";
    browsePanel.hidden = true;
    detailPanel.innerHTML =
      '<p class="detail-placeholder">Não foi possível obter dados. Verifica a rede ou tenta outro recurso.</p>';
  }
}

function formatPrimitive(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  return escapeHtml(String(v));
}

function formatDescField(desc) {
  if (desc == null) return "";
  if (Array.isArray(desc)) return desc.map((d) => `<p>${escapeHtml(String(d))}</p>`).join("");
  return `<p>${escapeHtml(String(desc))}</p>`;
}

function isNamedApiRef(v) {
  return (
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    typeof v.name === "string" &&
    typeof v.url === "string" &&
    Object.keys(v).length <= 5
  );
}

function renderComplexValue(v) {
  if (v === null || v === undefined) return '<p class="detail-muted">—</p>';
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return `<p>${formatPrimitive(v)}</p>`;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return '<p class="detail-muted">vazio</p>';
    if (v.every((x) => typeof x === "string")) {
      return v.map((s) => `<p>${escapeHtml(s)}</p>`).join("");
    }
    if (v.every((x) => x && typeof x === "object" && "name" in x && "desc" in x)) {
      return (
        '<ul class="detail-list">' +
        v
          .map((item) => {
            const desc = formatDescField(item.desc);
            return `<li><strong>${escapeHtml(item.name)}</strong>${desc}</li>`;
          })
          .join("") +
        "</ul>"
      );
    }
    return (
      "<ul class=\"detail-list\">" +
      v.map((item) => `<li>${renderComplexValue(item)}</li>`).join("") +
      "</ul>"
    );
  }
  if (typeof v === "object") {
    if (isNamedApiRef(v)) {
      const idx = v.index != null ? ` <span class="detail-muted">(${escapeHtml(String(v.index))})</span>` : "";
      return `<p>${escapeHtml(v.name)}${idx}</p>`;
    }
    const rows = Object.entries(v)
      .map(([k2, v2]) => `<dt>${escapeHtml(k2)}</dt><dd>${renderComplexValue(v2)}</dd>`)
      .join("");
    return `<dl class="detail-dl">${rows}</dl>`;
  }
  return formatPrimitive(v);
}

function renderDetail(data) {
  const title = data.name ?? data.index ?? "Detalhe";
  const skip = new Set(["url", "updated_at", "image", "name", "index"]);
  const idx = data.index != null ? String(data.index) : "";
  const relPath = cleanApiPath(data.url || "");
  const favOn = currentResourceLabel && idx ? isFavorite(currentResourceLabel, idx) : false;

  let html = "";
  if (currentResourceLabel && idx) {
    html += `<div class="detail-toolbar">
    <button type="button" class="detail-fav-btn${favOn ? " is-favorite" : ""}" data-action="toggle-fav"
      data-resource="${escapeHtml(currentResourceLabel)}"
      data-index="${escapeHtml(idx)}"
      data-name="${escapeHtml(String(data.name ?? ""))}"
      data-path="${escapeHtml(relPath)}"
      aria-pressed="${favOn}">${favOn ? "★ Nos favoritos" : "☆ Adicionar aos favoritos"}</button>
  </div>`;
  }

  if (data.image) {
    html += `<figure class="detail-image"><img src="${escapeHtml(apiUrl(data.image))}" alt="${escapeHtml(
      String(title)
    )}" loading="lazy" /></figure>`;
  }
  html += `<h3 class="detail-title">${escapeHtml(String(title))}</h3>`;

  const keys = Object.keys(data)
    .filter((k) => !skip.has(k))
    .sort();

  const simpleRows = [];
  const blocks = [];
  for (const key of keys) {
    const val = data[key];
    if (val === null || typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      simpleRows.push([key, val]);
    } else {
      blocks.push([key, val]);
    }
  }

  if (simpleRows.length) {
    html +=
      '<dl class="detail-dl">' +
      simpleRows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${formatPrimitive(v)}</dd>`).join("") +
      "</dl>";
  }

  for (const [k, v] of blocks) {
    html += `<h4 class="detail-section-title">${escapeHtml(k)}</h4>`;
    html += renderComplexValue(v);
  }

  detailPanel.innerHTML = html;
}

function renderDetailFallback(data) {
  detailPanel.innerHTML = `<h3 class="detail-title">Resposta</h3>${renderComplexValue(data)}`;
}

async function loadItemDetail(url, rowBtn) {
  detailPanel.innerHTML = '<p class="detail-placeholder">A carregar detalhe…</p>';
  selectedItemUrl = url;
  selectedItemPath = cleanApiPath(url);

  document.querySelectorAll(".result-row.is-selected").forEach((el) => el.classList.remove("is-selected"));
  if (rowBtn) rowBtn.classList.add("is-selected");

  try {
    const res = await apiFetch(url);
    if (!res.ok) throw new Error("detail");
    const data = await res.json();
    selectedItemIndex =
      data.index != null ? String(data.index) : rowBtn?.dataset.index ?? itemStableIndex({ url: selectedItemPath });
    selectedItemPath = cleanApiPath(data.url || url);
    renderDetail(data);
    persistUiSession();
  } catch {
    selectedItemUrl = null;
    selectedItemIndex = "";
    selectedItemPath = "";
    if (rowBtn) rowBtn.classList.remove("is-selected");
    detailPanel.innerHTML =
      '<p class="detail-placeholder">Erro ao carregar o detalhe deste item.</p>';
    persistUiSession();
  }
}

async function populateApi2014Sidebar() {
  if (!apiRootNav) return;

  apiRootNav.replaceChildren();
  const status = document.createElement("p");
  status.className = "sidebar-status";
  status.textContent = "A carregar recursos…";
  apiRootNav.appendChild(status);

  try {
    const res = await apiFetch("/api/2014/");
    if (!res.ok) throw new Error("api-root");
    const data = await res.json();
    apiRootNav.replaceChildren();

    const ul = document.createElement("ul");
    ul.className = "api-root-list";

    const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
    for (const [key, path] of entries) {
      if (typeof path !== "string") continue;
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sidebar-resource-btn";
      btn.dataset.resourceKey = key;
      btn.dataset.resourcePath = path;
      btn.textContent = formatResourceLabel(key);
      btn.addEventListener("click", () => selectResource(key, path, btn));
      li.appendChild(btn);
      ul.appendChild(li);
    }
    apiRootNav.appendChild(ul);

    const session = loadSession();
    if (session.resourceKey && session.resourcePath) {
      const restoreBtn = [...apiRootNav.querySelectorAll(".sidebar-resource-btn")].find(
        (b) => b.dataset.resourceKey === session.resourceKey
      );
      if (restoreBtn) {
        await selectResource(session.resourceKey, session.resourcePath, restoreBtn, session);
      }
    }
  } catch {
    apiRootNav.replaceChildren();
    const err = document.createElement("p");
    err.className = "sidebar-status sidebar-error";
    err.textContent = "Não foi possível carregar a lista da API.";
    apiRootNav.appendChild(err);
  }
}

itemFilterInput.addEventListener("input", () => {
  window.clearTimeout(filterDebounceId);
  filterDebounceId = window.setTimeout(() => {
    currentFilter = itemFilterInput.value;
    currentPage = 1;
    renderResultsPage();
    persistUiSession();
  }, 250);
});

if (spellLevelSelect) {
  spellLevelSelect.addEventListener("change", () => {
    spellLevelFilterValue = spellLevelSelect.value;
    currentPage = 1;
    renderResultsPage();
    persistUiSession();
  });
}

if (listScopeSelect) {
  const session = loadSession();
  const savedScope = session.listScope || localStorage.getItem(STORAGE_LIST_SCOPE);
  listScopeFilter = savedScope === "favorites" ? "favorites" : "all";
  listScopeSelect.value = listScopeFilter;
  listScopeSelect.addEventListener("change", () => {
    listScopeFilter = listScopeSelect.value;
    currentPage = 1;
    renderResultsPage();
    persistUiSession();
  });
}

detailPanel.addEventListener("click", onDetailPanelClick);

async function boot() {
  await initLocalesDropdown();
  if (localeSelect) localeSelect.addEventListener("change", onLocaleChange);
  syncApiRootDocLinkHref();
  updateFavoritesCountHint();
  await populateApi2014Sidebar();
}

boot();

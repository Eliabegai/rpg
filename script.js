const DEFAULT_SESSION = {
  resourceKey: "",
  resourcePath: "",
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

const SPELL_META_CONCURRENCY = 12;
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
const spellSchoolSelect = document.getElementById("spellSchoolSelect");
const spellClassSelect = document.getElementById("spellClassSelect");
const spellSubclassSelect = document.getElementById("spellSubclassSelect");
const localeSelect = document.getElementById("localeSelect");
const listScopeSelect = document.getElementById("listScopeSelect");
const apiRootDocLink = document.getElementById("apiRootDocLink");
const favoritesCountHint = document.getElementById("favoritesCountHint");

let activeSidebarBtn = null;

let currentResourceLabel = "";
let spellLevelFilterValue = "";
let spellSchoolFilterValue = "";
let spellClassFilterValue = "";
let spellSubclassFilterValue = "";
let spellFilterOptionsLoaded = false;
let allResults = [];
let currentFilter = "";
let currentPage = 1;
let selectedItemUrl = null;
let selectedItemIndex = "";
let selectedItemPath = "";
/** JSON do detalhe aberto (para cache ao favoritar). */
let selectedItemData = null;

let filterDebounceId = 0;

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
    spellSchool: spellSchoolFilterValue,
    spellClass: spellClassFilterValue,
    spellSubclass: spellSubclassFilterValue,
    page: currentPage,
    listScope: listScopeFilter,
  });
}

function spellMetaCacheKey() {
  return `dnd5eapi.spellMeta.${currentLocale}`;
}

function resetSpellExtraFilters() {
  spellLevelFilterValue = "";
  spellSchoolFilterValue = "";
  spellClassFilterValue = "";
  spellSubclassFilterValue = "";
  if (spellLevelSelect) spellLevelSelect.value = "";
  if (spellSchoolSelect) spellSchoolSelect.value = "";
  if (spellClassSelect) spellClassSelect.value = "";
  if (spellSubclassSelect) spellSubclassSelect.value = "";
}

function fillSelectFromApiResults(selectEl, results, emptyLabel) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = emptyLabel;
  selectEl.appendChild(empty);
  const sorted = [...(results || [])].sort((a, b) =>
    String(a.name ?? a.index).localeCompare(String(b.name ?? b.index), undefined, { sensitivity: "base" })
  );
  for (const row of sorted) {
    const o = document.createElement("option");
    o.value = row.index;
    o.textContent = row.name ?? formatResourceLabel(row.index);
    selectEl.appendChild(o);
  }
  if ([...selectEl.options].some((o) => o.value === current)) selectEl.value = current;
}

async function populateSpellFilterDropdowns() {
  if (spellFilterOptionsLoaded) return;
  try {
    const [schoolsRes, classesRes, subclassesRes] = await Promise.all([
      apiFetch("/api/2014/magic-schools"),
      apiFetch("/api/2014/classes"),
      apiFetch("/api/2014/subclasses"),
    ]);
    if (schoolsRes.ok) {
      const data = await schoolsRes.json();
      fillSelectFromApiResults(spellSchoolSelect, data.results, "Todas");
    }
    if (classesRes.ok) {
      const data = await classesRes.json();
      fillSelectFromApiResults(spellClassSelect, data.results, "Todas");
    }
    if (subclassesRes.ok) {
      const data = await subclassesRes.json();
      fillSelectFromApiResults(spellSubclassSelect, data.results, "Todas");
    }
    spellFilterOptionsLoaded = true;
  } catch {
    /* dropdowns ficam só com "Todas" */
  }
}

function loadSpellMetaCache() {
  try {
    const raw = sessionStorage.getItem(spellMetaCacheKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveSpellMetaCache(metaByIndex) {
  try {
    sessionStorage.setItem(spellMetaCacheKey(), JSON.stringify(metaByIndex));
  } catch {
    /* quota */
  }
}

async function enrichSpellsWithMeta(spellRefs) {
  const metaByIndex = loadSpellMetaCache();
  const missing = spellRefs.filter((ref) => ref.index && !metaByIndex[ref.index]);

  if (missing.length > 0) {
    mainSubtitle.textContent = `A carregar escolas e classes (${missing.length} feitiços)…`;
    for (let i = 0; i < missing.length; i += SPELL_META_CONCURRENCY) {
      const chunk = missing.slice(i, i + SPELL_META_CONCURRENCY);
      await Promise.all(
        chunk.map(async (ref) => {
          try {
            const res = await apiFetch(ref.url);
            if (!res.ok) return;
            const d = await res.json();
            metaByIndex[ref.index] = {
              school: d.school?.index ?? "",
              classes: (d.classes || []).map((c) => c.index).filter(Boolean),
              subclasses: (d.subclasses || []).map((c) => c.index).filter(Boolean),
            };
          } catch {
            metaByIndex[ref.index] = { school: "", classes: [], subclasses: [] };
          }
        })
      );
    }
    saveSpellMetaCache(metaByIndex);
  }

  return spellRefs.map((ref) => ({
    ...ref,
    spellMeta: metaByIndex[ref.index] || { school: "", classes: [], subclasses: [] },
  }));
}

function spellMatchesExtraFilters(item) {
  if (currentResourceLabel !== "spells") return true;
  const meta = item.spellMeta;
  if (!meta) return true;

  if (spellLevelFilterValue !== "") {
    if (Number(item.level) !== Number(spellLevelFilterValue)) return false;
  }
  if (spellSchoolFilterValue !== "" && meta.school !== spellSchoolFilterValue) return false;
  if (spellClassFilterValue !== "" && !meta.classes.includes(spellClassFilterValue)) return false;
  if (spellSubclassFilterValue !== "" && !meta.subclasses.includes(spellSubclassFilterValue)) return false;
  return true;
}

function hasActiveSpellFilters() {
  return (
    spellLevelFilterValue !== "" ||
    spellSchoolFilterValue !== "" ||
    spellClassFilterValue !== "" ||
    spellSubclassFilterValue !== ""
  );
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

/** Alterna favorito e grava em localStorage. Com `data`, guarda cópia do JSON (sem novo pedido na ficha). */
function toggleFavoriteForItem({ resourceKey, index, name, path, data }) {
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
  if (i >= 0) {
    favs.splice(i, 1);
  } else {
    if (data && typeof data === "object") {
      applyCacheToEntry(entry, data);
    }
    favs.push(entry);
    if (!entry.cachedData && entry.path) {
      fetchAndCacheFavoriteEntry(entry);
    }
  }
  if (!saveFavorites(favs)) return isFavorite(resourceKey, ix);
  updateFavoritesCountHint();
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
  await populateLocalesDropdown(localeSelect, {
    onChange() {
      spellFilterOptionsLoaded = false;
      syncApiRootDocLinkHref();
      const btn = activeSidebarBtn;
      if (btn?.dataset.resourceKey && btn.dataset.resourcePath) {
        selectResource(btn.dataset.resourceKey, btn.dataset.resourcePath, btn);
      }
    },
  });
}

function onSpellFilterChange() {
  if (spellLevelSelect) spellLevelFilterValue = spellLevelSelect.value;
  if (spellSchoolSelect) spellSchoolFilterValue = spellSchoolSelect.value;
  if (spellClassSelect) spellClassFilterValue = spellClassSelect.value;
  if (spellSubclassSelect) spellSubclassFilterValue = spellSubclassSelect.value;
  currentPage = 1;
  renderResultsPage();
  persistUiSession();
}

function updatePickListHint(fieldset) {
  const hint = fieldset.querySelector(".detail-pick-hint");
  if (!hint) return;
  const max = Number(fieldset.dataset.maxChoose);
  if (!max || max <= 0) return;
  const selected = fieldset.querySelectorAll(".detail-pick-input:checked").length;
  hint.textContent = formatPickHint(selected, max);
}

function onDetailPanelPickChange(e) {
  const input = e.target;
  if (!input.classList?.contains("detail-pick-input") || !detailPanel.contains(input)) return;
  const fieldset = input.closest(".detail-pick-list");
  if (!fieldset) return;
  const max = Number(fieldset.dataset.maxChoose);
  if (input.checked && max > 0) {
    const count = fieldset.querySelectorAll(".detail-pick-input:checked").length;
    if (count > max) {
      input.checked = false;
    }
  }
  updatePickListHint(fieldset);
}

function onDetailPanelClick(e) {
  const btn = e.target.closest('[data-action="toggle-fav"]');
  if (!btn || !detailPanel.contains(btn)) return;
  const resourceKey = btn.getAttribute("data-resource");
  const index = btn.getAttribute("data-index");
  const name = btn.getAttribute("data-name") || "";
  const path = btn.getAttribute("data-path") || "";
  const useDetailData =
    selectedItemData &&
    currentResourceLabel === resourceKey &&
    String(selectedItemIndex) === String(index);
  toggleFavoriteForItem({
    resourceKey,
    index,
    name,
    path,
    data: useDetailData ? selectedItemData : undefined,
  });
  setDetailFavoriteButtonState(btn, isFavorite(resourceKey, index));
  afterFavoriteChange(resourceKey, index);
}

function setDetailFavoriteButtonState(btn, on) {
  if (!btn) return;
  btn.classList.toggle("is-favorite", on);
  btn.setAttribute("aria-pressed", String(on));
  btn.textContent = on ? "★ Nos favoritos" : "☆ Adicionar aos favoritos";
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

  if (currentResourceLabel === "spells") {
    list = list.filter((item) => spellMatchesExtraFilters(item));
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
          ? "Nenhum favorito neste recurso (ou nada coincide com os filtros)."
          : currentResourceLabel === "spells" && hasActiveSpellFilters()
            ? "Nenhum feitiço com estes filtros (ou combinação com a pesquisa)."
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
      if (item.spellMeta?.school) metaParts.push(formatResourceLabel(item.spellMeta.school));

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

const PSEUDO_LIST_SKIP_KEYS = new Set([
  "url",
  "image",
  "updated_at",
  "desc",
  "name",
  "index",
  "size",
  "type",
  "subtype",
  "alignment",
]);

function resultsFromPayload(data) {
  if (data && Array.isArray(data.results)) return data.results;
  if (data && typeof data === "object" && data.index != null && data.url) return null;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const entries = Object.entries(data).filter(
      ([key, v]) =>
        !PSEUDO_LIST_SKIP_KEYS.has(key) &&
        typeof v === "string" &&
        v.startsWith("/api/2014/") &&
        !v.includes("/api/images/")
    );
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

function setResourceExtraFiltersVisible(show, resetSpellFilters = true) {
  if (resourceExtraFilters) resourceExtraFilters.hidden = !show;
  if (resetSpellFilters) resetSpellExtraFilters();
}

function applySessionToUi(session) {
  currentFilter = session.filter ?? "";
  if (itemFilterInput) itemFilterInput.value = currentFilter;
  currentPage = Math.max(1, Number(session.page) || 1);
  spellLevelFilterValue = session.spellLevel ?? "";
  spellSchoolFilterValue = session.spellSchool ?? "";
  spellClassFilterValue = session.spellClass ?? "";
  spellSubclassFilterValue = session.spellSubclass ?? "";
  if (spellLevelSelect) spellLevelSelect.value = spellLevelFilterValue;
  if (spellSchoolSelect) spellSchoolSelect.value = spellSchoolFilterValue;
  if (spellClassSelect) spellClassSelect.value = spellClassFilterValue;
  if (spellSubclassSelect) spellSubclassSelect.value = spellSubclassFilterValue;
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

  if (label === "spells") {
    await populateSpellFilterDropdowns();
  }

  if (sessionRestore) {
    applySessionToUi(sessionRestore);
  } else {
    itemFilterInput.value = "";
    currentFilter = "";
    currentPage = 1;
    resetSpellExtraFilters();
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
      spellSchool: "",
      spellClass: "",
      spellSubclass: "",
      page: 1,
      listScope: listScopeFilter,
    });
  }

  mainTitle.textContent = `Grimório 5e — ${formatResourceLabel(label)}`;
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

    if (label === "spells") {
      allResults = await enrichSpellsWithMeta(results);
      const total = allResults.length;
      mainSubtitle.textContent = `${total} feitiços — filtra por nível, escola, classe, subclasse e pesquisa (${PAGE_SIZE} por página).`;
    } else {
      allResults = results;
      const total = data.count ?? results.length;
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
  if (Array.isArray(desc)) return desc.map((d) => `<p class="detail-text">${escapeHtml(String(d))}</p>`).join("");
  return `<p class="detail-text">${escapeHtml(String(desc))}</p>`;
}

function formatFieldLabel(key) {
  return formatResourceLabel(String(key));
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

function isOptionReference(v) {
  return v && typeof v === "object" && v.option_type && v.item && typeof v.item === "object";
}

function isAbilityBonusRow(v) {
  return v && typeof v === "object" && "bonus" in v && v.ability_score && typeof v.ability_score === "object";
}

function isStringChoiceOption(v) {
  return v && typeof v === "object" && v.option_type === "string" && typeof v.string === "string";
}

function isIdealChoiceOption(v) {
  return v && typeof v === "object" && v.option_type === "ideal" && v.desc != null;
}

function formatPickHint(selected, max) {
  if (max == null || max <= 0) return "";
  return max === 1 ? `${selected} / 1 selecionado` : `${selected} / ${max} selecionados`;
}

function renderPickableStringList(options, maxChoose) {
  const maxAttr = maxChoose != null && maxChoose > 0 ? ` data-max-choose="${maxChoose}"` : "";
  const hint =
    maxChoose != null && maxChoose > 0
      ? `<p class="detail-pick-hint">${escapeHtml(formatPickHint(0, maxChoose))}</p>`
      : "";
  const items = options
    .map(
      (opt) =>
        `<li><label class="detail-pick-item"><input type="checkbox" class="detail-pick-input" /><span class="detail-pick-text">${escapeHtml(opt.string)}</span></label></li>`
    )
    .join("");
  return `<fieldset class="detail-pick-list"${maxAttr}><ul class="detail-pick-ul">${items}</ul>${hint}</fieldset>`;
}

function renderPickableIdealList(options, maxChoose) {
  const maxAttr = maxChoose != null && maxChoose > 0 ? ` data-max-choose="${maxChoose}"` : "";
  const hint =
    maxChoose != null && maxChoose > 0
      ? `<p class="detail-pick-hint">${escapeHtml(formatPickHint(0, maxChoose))}</p>`
      : "";
  const items = options
    .map((opt) => {
      const align =
        Array.isArray(opt.alignments) && opt.alignments.length
          ? `<span class="detail-pick-meta">${opt.alignments.map((a) => escapeHtml(a.name ?? a.index)).join(" · ")}</span>`
          : "";
      const desc = Array.isArray(opt.desc) ? opt.desc.join(" ") : String(opt.desc);
      return `<li><label class="detail-pick-item detail-pick-item--ideal"><input type="checkbox" class="detail-pick-input" /><span class="detail-pick-text">${escapeHtml(desc)}</span>${align}</label></li>`;
    })
    .join("");
  return `<fieldset class="detail-pick-list"${maxAttr}><ul class="detail-pick-ul">${items}</ul>${hint}</fieldset>`;
}

function renderOptionsArrayOptions(options, maxChoose) {
  if (!Array.isArray(options) || options.length === 0) {
    return '<span class="detail-muted">vazio</span>';
  }
  if (options.every(isStringChoiceOption)) {
    return renderPickableStringList(options, maxChoose);
  }
  if (options.every(isIdealChoiceOption)) {
    return renderPickableIdealList(options, maxChoose);
  }
  return renderDetailValue(options, 0);
}

let detailNodeId = 0;

function nextDetailId() {
  detailNodeId += 1;
  return `dnode-${detailNodeId}`;
}

function renderPrimitiveInline(v) {
  if (v === null || v === undefined) return '<span class="detail-muted">—</span>';
  if (typeof v === "boolean") return formatPrimitive(v);
  return formatPrimitive(v);
}

function renderNamedRef(v) {
  const idx = v.index != null ? ` <span class="detail-muted">(${escapeHtml(String(v.index))})</span>` : "";
  return `<span class="detail-ref">${escapeHtml(v.name)}${idx}</span>`;
}

/** Opção da API: option_type "reference" = liga a outro recurso (idioma, proficiência, etc.). */
function renderOptionReference(v) {
  const item = v.item;
  if (item && typeof item === "object" && item.name) return renderNamedRef(item);
  if (item && typeof item === "object" && item.index) {
    return `<span class="detail-ref">${escapeHtml(formatResourceLabel(item.index))}</span>`;
  }
  return renderPrimitiveInline(v.option_type ?? "—");
}

/** Desembrulha option_set_type (ex.: options_array) e mostra só o conteúdo útil. */
function renderChoiceFrom(from, depth, maxChoose) {
  if (!from || typeof from !== "object") return renderDetailValue(from, depth);

  if (from.option_set_type === "options_array" && Array.isArray(from.options)) {
    return renderOptionsArrayOptions(from.options, maxChoose);
  }

  if (from.option_set_type === "resource_list" && from.resource_list_url) {
    const path = String(from.resource_list_url);
    return `<p class="detail-text detail-muted-block">Podes escolher qualquer item da lista <span class="detail-ref">${escapeHtml(formatResourceLabel(path.split("/").filter(Boolean).pop() || path))}</span> (lista completa na API).</p>`;
  }

  return renderDetailValue(from, depth);
}

function renderCollapse(summary, body, { open = false } = {}) {
  const openAttr = open ? " open" : "";
  return `<details class="detail-collapse"${openAttr}><summary>${escapeHtml(summary)}</summary><div class="detail-collapse-body">${body}</div></details>`;
}

function formatChoiceHeader(choose, type) {
  const kind = type ? formatFieldLabel(String(type)).toLowerCase() : "opções";
  return `Escolhe ${choose} ${kind}`;
}

/** Corpo de um bloco choose + options_array (referências, textos, ideais, etc.). */
function renderChoiceOptionsBody(v) {
  if (
    v &&
    typeof v === "object" &&
    v.choose != null &&
    v.from?.option_set_type === "options_array" &&
    Array.isArray(v.from.options)
  ) {
    return renderOptionsArrayOptions(v.from.options, v.choose);
  }
  return renderDetailValue(v, 0);
}

/** Secção “escolhe N …” dentro de ability_bonuses / languages. */
function renderChoiceOptionsInline(v) {
  if (!v || typeof v !== "object" || v.choose == null) return "";
  const title = formatChoiceHeader(v.choose, v.type);
  return `<section class="detail-inline-choice"><h4 class="detail-inline-choice-title">${escapeHtml(title)}</h4>${renderChoiceOptionsBody(v)}</section>`;
}

function findParentKeyForOptions(optionsKey, keySet) {
  if (!optionsKey.endsWith("_options")) return null;
  if (optionsKey === "ability_bonus_options" && keySet.has("ability_bonuses")) return "ability_bonuses";
  if (optionsKey === "language_options" && keySet.has("languages")) return "languages";
  const stem = optionsKey.slice(0, -"_options".length);
  if (keySet.has(`${stem}s`)) return `${stem}s`;
  if (keySet.has(`${stem}es`)) return `${stem}es`;
  return null;
}

function findOptionsKeyForParent(parentKey, keySet) {
  if (parentKey === "ability_bonuses" && keySet.has("ability_bonus_options")) return "ability_bonus_options";
  if (parentKey === "languages" && keySet.has("language_options")) return "language_options";
  const candidates = [
    `${parentKey.replace(/s$/, "")}_options`,
    `${parentKey.replace(/_bonuses$/, "_bonus")}_options`,
  ];
  return candidates.find((k) => keySet.has(k)) ?? null;
}

/** choose + from.options_array sozinho no topo (sem par *_options). */
function renderTopLevelChoiceBlock(key, v, { open = false } = {}) {
  const label = formatFieldLabel(key);
  if (v && typeof v === "object" && v.choose != null && v.from?.option_set_type === "options_array") {
    const header = `${label} — ${formatChoiceHeader(v.choose, v.type)}`;
    return renderCollapse(header, renderChoiceOptionsBody(v), { open });
  }
  return renderCollapse(label, renderDetailValue(v, 0, label), { open });
}

function renderTopLevelBlock(key, v, pairedOptions, { open = false } = {}) {
  if (pairedOptions != null) {
    const label = formatFieldLabel(key);
    const base =
      v != null && !(Array.isArray(v) && v.length === 0)
        ? renderDetailValue(v, 0, label)
        : "";
    const body = base + renderChoiceOptionsInline(pairedOptions);
    return renderCollapse(label, body || '<span class="detail-muted">—</span>', { open });
  }
  return renderTopLevelChoiceBlock(key, v, { open });
}

function renderObjectRows(entries, depth) {
  const rows = entries
    .filter(([k]) => k !== "updated_at")
    .map(([k, val]) => {
      const label = formatFieldLabel(k);
      return `<dt>${escapeHtml(label)}</dt><dd>${renderDetailValue(val, depth + 1, label)}</dd>`;
    })
    .join("");
  return `<dl class="detail-kv">${rows}</dl>`;
}

function renderDetailValue(v, depth = 0, fieldLabel = "") {
  if (v === null || v === undefined) return '<span class="detail-muted">—</span>';

  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    if (typeof v === "string" && v.length > 100) {
      return `<p class="detail-text">${escapeHtml(v)}</p>`;
    }
    return renderPrimitiveInline(v);
  }

  if (Array.isArray(v)) {
    if (v.length === 0) return '<span class="detail-muted">vazio</span>';

    if (v.every((x) => typeof x === "string")) {
      return `<ul class="detail-tags">${v.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`;
    }

    if (v.every((x) => isNamedApiRef(x))) {
      return `<ul class="detail-chip-list">${v.map((x) => `<li>${renderNamedRef(x)}</li>`).join("")}</ul>`;
    }

    if (v.every((x) => isAbilityBonusRow(x))) {
      return `<ul class="detail-chip-list">${v
        .map(
          (x) =>
            `<li><span class="detail-ref">${escapeHtml(x.ability_score.name ?? x.ability_score.index)}</span> <strong>+${escapeHtml(String(x.bonus))}</strong></li>`
        )
        .join("")}</ul>`;
    }

    if (v.every((x) => isOptionReference(x))) {
      return `<ul class="detail-option-list">${v.map((x) => `<li>${renderOptionReference(x)}</li>`).join("")}</ul>`;
    }

    if (v.every((x) => isStringChoiceOption(x))) {
      return renderPickableStringList(v, null);
    }

    if (v.every((x) => isIdealChoiceOption(x))) {
      return renderPickableIdealList(v, null);
    }

    if (v.every((x) => x && typeof x === "object" && "name" in x && "desc" in x)) {
      return v
        .map((item, i) =>
          renderCollapse(item.name || `Item ${i + 1}`, formatDescField(item.desc), { open: false })
        )
        .join("");
    }

    const summary = fieldLabel ? `${fieldLabel} (${v.length})` : `Lista (${v.length})`;
    const body = v
      .map((item, i) => {
        if (item === null || typeof item !== "object") {
          return `<div class="detail-array-item">${renderDetailValue(item, depth + 1)}</div>`;
        }
        const itemLabel = item.name || item.option_type || item.index || `#${i + 1}`;
        return renderCollapse(String(itemLabel), renderDetailValue(item, depth + 1), { open: false });
      })
      .join("");
    return renderCollapse(summary, body, { open: depth === 0 && v.length <= 3 });
  }

  if (typeof v === "object") {
    if (isNamedApiRef(v)) return renderNamedRef(v);
    if (isStringChoiceOption(v)) {
      return `<p class="detail-text">${escapeHtml(v.string)}</p>`;
    }
    if (isIdealChoiceOption(v)) {
      const desc = Array.isArray(v.desc) ? v.desc.join(" ") : String(v.desc);
      const align =
        Array.isArray(v.alignments) && v.alignments.length
          ? ` <span class="detail-muted">(${v.alignments.map((a) => a.name ?? a.index).join(", ")})</span>`
          : "";
      return `<p class="detail-text">${escapeHtml(desc)}${align}</p>`;
    }
    if (isOptionReference(v)) return renderOptionReference(v);
    if (isAbilityBonusRow(v)) {
      return `<span class="detail-ref">${escapeHtml(v.ability_score.name ?? v.ability_score.index)}</span> <strong>+${escapeHtml(String(v.bonus))}</strong>`;
    }

    if ("choose" in v && v.from != null) {
      const header = `Escolher ${v.choose} · ${formatFieldLabel(String(v.type || "opções"))}`;
      return renderCollapse(header, renderChoiceFrom(v.from, depth + 1, v.choose), { open: depth <= 1 });
    }

    if ("option_set_type" in v && "options" in v) {
      if (v.option_set_type === "options_array") {
        return renderOptionsArrayOptions(v.options, null);
      }
      const header = formatFieldLabel(String(v.option_set_type));
      return renderCollapse(header, renderDetailValue(v.options, depth + 1), { open: false });
    }

    const entries = Object.entries(v).filter(([k]) => !["url", "updated_at"].includes(k));
    if (entries.length === 0) return '<span class="detail-muted">—</span>';

    if (depth >= 1 || entries.length > 5) {
      const summary =
        fieldLabel ||
        entries
          .slice(0, 3)
          .map(([k]) => formatFieldLabel(k))
          .join(" · ") ||
        "Detalhes";
      return renderCollapse(summary, renderObjectRows(entries, depth), { open: false });
    }

    return renderObjectRows(entries, depth);
  }

  return renderPrimitiveInline(v);
}

/** @deprecated use renderDetailValue */
function renderComplexValue(v) {
  return renderDetailValue(v, 0);
}

function renderDetail(data) {
  detailNodeId = 0;
  const title = data.name ?? data.index ?? "Detalhe";
  const skip = new Set(["url", "updated_at", "image", "name", "index"]);
  const layout = typeof getSpecializedDetailLayout === "function"
    ? getSpecializedDetailLayout(currentResourceLabel, data)
    : null;
  if (layout?.skip) layout.skip.forEach((k) => skip.add(k));
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
    html += `<figure class="detail-image"><img src="${escapeHtml(apiAssetUrl(data.image))}" alt="${escapeHtml(
      String(title)
    )}" loading="lazy" decoding="async" /></figure>`;
  }
  html += `<h3 class="detail-title">${escapeHtml(String(title))}</h3>`;

  if (layout?.html) html += layout.html;

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
      '<dl class="detail-kv detail-kv--top">' +
      simpleRows
        .map(([k, v]) => {
          const label = formatFieldLabel(k);
          const valHtml =
            typeof v === "string" && v.length > 100
              ? `<p class="detail-text">${escapeHtml(v)}</p>`
              : formatPrimitive(v);
          return `<dt>${escapeHtml(label)}</dt><dd>${valHtml}</dd>`;
        })
        .join("") +
      "</dl>";
  }

  const keySet = new Set(blocks.map(([k]) => k));
  const blockMap = new Map(blocks);
  const openFirstBlocks = blocks.length <= 4;
  let blockIndex = 0;
  blocks.forEach(([k, v]) => {
    if (k.endsWith("_options") && findParentKeyForOptions(k, keySet)) return;
    const optionsKey = findOptionsKeyForParent(k, keySet);
    const pairedOptions = optionsKey ? blockMap.get(optionsKey) : null;
    html += renderTopLevelBlock(k, v, pairedOptions, { open: openFirstBlocks && blockIndex < 2 });
    blockIndex += 1;
  });

  detailPanel.innerHTML = html;
}

function renderDetailFallback(data) {
  detailNodeId = 0;
  detailPanel.innerHTML = `<h3 class="detail-title">Resposta</h3>${renderDetailValue(data, 0)}`;
}

async function loadItemDetail(url, rowBtn) {
  detailPanel.innerHTML = '<p class="detail-placeholder">A carregar detalhe…</p>';
  selectedItemData = null;
  selectedItemUrl = url;
  selectedItemPath = cleanApiPath(url);

  document.querySelectorAll(".result-row.is-selected").forEach((el) => el.classList.remove("is-selected"));
  if (rowBtn) rowBtn.classList.add("is-selected");

  try {
    const res = await apiFetch(url);
    if (!res.ok) throw new Error("detail");
    const data = await res.json();
    selectedItemData = data;
    selectedItemIndex =
      data.index != null ? String(data.index) : rowBtn?.dataset.index ?? itemStableIndex({ url: selectedItemPath });
    selectedItemPath = cleanApiPath(data.url || url);
    if (currentResourceLabel && selectedItemIndex && isFavorite(currentResourceLabel, selectedItemIndex)) {
      updateFavoriteCache(currentResourceLabel, selectedItemIndex, data);
    }
    renderDetail(data);
    persistUiSession();
  } catch {
    selectedItemUrl = null;
    selectedItemIndex = "";
    selectedItemPath = "";
    selectedItemData = null;
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

if (spellLevelSelect) spellLevelSelect.addEventListener("change", onSpellFilterChange);
if (spellSchoolSelect) spellSchoolSelect.addEventListener("change", onSpellFilterChange);
if (spellClassSelect) spellClassSelect.addEventListener("change", onSpellFilterChange);
if (spellSubclassSelect) spellSubclassSelect.addEventListener("change", onSpellFilterChange);

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
detailPanel.addEventListener("change", onDetailPanelPickChange);

async function boot() {
  await initLocalesDropdown();
  syncApiRootDocLinkHref();
  updateFavoritesCountHint();
  await populateApi2014Sidebar();
}

boot();

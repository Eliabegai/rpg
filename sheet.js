const favoritesLibrary = document.getElementById("favoritesLibrary");
const libraryEmpty = document.getElementById("libraryEmpty");
const sheetBoard = document.getElementById("sheetBoard");
const sheetEmpty = document.getElementById("sheetEmpty");
const characterNameInput = document.getElementById("characterName");
const localeSelect = document.getElementById("localeSelect");
const abilityScoresGrid = document.getElementById("abilityScoresGrid");
const armorClassInput = document.getElementById("armorClassInput");
const alignmentSelect = document.getElementById("alignmentSelect");
const portraitInput = document.getElementById("portraitInput");
const portraitPreview = document.getElementById("portraitPreview");
const portraitPlaceholder = document.getElementById("portraitPlaceholder");
const portraitClear = document.getElementById("portraitClear");
const portraitError = document.getElementById("portraitError");

const PORTRAIT_MAX_BYTES = 380 * 1024;

const ABILITY_LABELS = {
  str: "FOR",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
};

const detailCache = new Map();
let alignmentsLoaded = false;

function patchSheet(mutator) {
  const sheet = loadSheet();
  mutator(sheet);
  saveSheet(sheet);
  return sheet;
}

function abilityModifier(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "—";
  const mod = Math.floor((n - 10) / 2);
  return mod >= 0 ? `+${mod}` : String(mod);
}

function getClassProficiencyPicks(sheet, entryId, blockIndex) {
  const byEntry = sheet.classProficiencyPicks[entryId];
  if (!byEntry) return [];
  return byEntry[String(blockIndex)] || [];
}

function setClassProficiencyPicks(entryId, blockIndex, picks) {
  patchSheet((sheet) => {
    if (!sheet.classProficiencyPicks[entryId]) sheet.classProficiencyPicks[entryId] = {};
    sheet.classProficiencyPicks[entryId][String(blockIndex)] = picks;
  });
}

function isOnSheet(entry) {
  const sheet = loadSheet();
  return sheet.items.some(
    (i) => i.resourceKey === entry.resourceKey && String(i.index) === String(entry.index)
  );
}

function toggleSheetItem(entry) {
  const sheet = loadSheet();
  const ix = sheet.items.findIndex(
    (i) => i.resourceKey === entry.resourceKey && String(i.index) === String(entry.index)
  );
  if (ix >= 0) {
    sheet.items.splice(ix, 1);
  } else {
    sheet.items.push({
      resourceKey: entry.resourceKey,
      index: String(entry.index),
      name: entry.name != null ? String(entry.name) : String(entry.index),
      path: cleanApiPath(entry.path || ""),
    });
  }
  saveSheet(sheet);
  renderAll();
}

function removeFromSheet(resourceKey, index) {
  const sheet = loadSheet();
  sheet.items = sheet.items.filter(
    (i) => !(i.resourceKey === resourceKey && String(i.index) === String(index))
  );
  saveSheet(sheet);
  renderAll();
}

function groupFavorites(favorites) {
  const groups = new Map();
  for (const f of favorites) {
    const key = f.resourceKey || "outros";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }));
  }
  const keys = [...groups.keys()].sort((a, b) => {
    const ia = SHEET_RESOURCE_ORDER.indexOf(a);
    const ib = SHEET_RESOURCE_ORDER.indexOf(b);
    const ra = ia === -1 ? 999 : ia;
    const rb = ib === -1 ? 999 : ib;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return keys.map((k) => [k, groups.get(k)]);
}

function renderLibrary() {
  const favorites = loadFavorites();
  if (!favoritesLibrary || !libraryEmpty) return;

  if (favorites.length === 0) {
    favoritesLibrary.innerHTML = "";
    libraryEmpty.hidden = false;
    return;
  }

  libraryEmpty.hidden = true;
  const groups = groupFavorites(favorites);
  favoritesLibrary.innerHTML = groups
    .map(([resourceKey, items]) => {
      const title = formatResourceLabel(resourceKey);
      const rows = items
        .map((entry) => {
          const on = isOnSheet(entry);
          const id = favoriteEntryId(entry);
          return `<li class="sheet-library-item">
            <span class="sheet-library-item-name">${escapeHtml(entry.name || entry.index)}</span>
            <button
              type="button"
              class="sheet-toggle-btn${on ? " is-on-sheet" : ""}"
              data-action="toggle-sheet"
              data-resource="${escapeHtml(entry.resourceKey)}"
              data-index="${escapeHtml(String(entry.index))}"
              data-name="${escapeHtml(entry.name || "")}"
              data-path="${escapeHtml(entry.path || "")}"
              aria-pressed="${on}"
            >${on ? "Na ficha ✓" : "+ Na ficha"}</button>
          </li>`;
        })
        .join("");
      return `<section class="sheet-library-group" aria-labelledby="lib-${escapeHtml(resourceKey)}">
        <h2 class="sheet-library-group-title" id="lib-${escapeHtml(resourceKey)}">${escapeHtml(title)} <span class="sheet-count">(${items.length})</span></h2>
        <ul class="sheet-library-list">${rows}</ul>
      </section>`;
    })
    .join("");
}

function openInExplorer(entry) {
  const resourcePath = resourcePathFromItemPath(entry.path);
  try {
    const session = {
      resourceKey: entry.resourceKey,
      resourcePath,
      itemIndex: String(entry.index),
      itemPath: cleanApiPath(entry.path),
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
  window.location.href = "index.html";
}

function renderSheetSummary(resourceKey, data) {
  const rows = [];

  if (resourceKey === "races" || resourceKey === "subraces") {
    if (data.size) rows.push(["Tamanho", data.size]);
    if (data.speed != null) rows.push(["Deslocamento", `${data.speed} pés`]);
    if (Array.isArray(data.ability_bonuses) && data.ability_bonuses.length) {
      const bonuses = data.ability_bonuses
        .map((b) => `${b.ability_score?.name ?? b.ability_score?.index} +${b.bonus}`)
        .join(", ");
      rows.push(["Bónus", bonuses]);
    }
  } else if (resourceKey === "classes") {
    if (data.hit_die) rows.push(["Dado de vida", `d${data.hit_die}`]);
    if (Array.isArray(data.saving_throws) && data.saving_throws.length) {
      rows.push([
        "Salvaguardas",
        data.saving_throws.map((s) => s.name ?? s.index).join(", "),
      ]);
    }
  } else if (resourceKey === "backgrounds") {
    if (Array.isArray(data.feature?.desc)) {
      rows.push(["Característica", data.feature.desc[0].slice(0, 200) + (data.feature.desc[0].length > 200 ? "…" : "")]);
    } else if (data.feature?.name) {
      rows.push(["Característica", data.feature.name]);
    }
  } else if (resourceKey === "spells") {
    if (data.level !== undefined) rows.push(["Nível", data.level === 0 ? "Truque" : String(data.level)]);
    if (data.school?.name) rows.push(["Escola", data.school.name]);
    if (data.casting_time) rows.push(["Conjuração", data.casting_time]);
    if (data.range) rows.push(["Alcance", data.range]);
  } else if (resourceKey === "feats" && Array.isArray(data.desc)) {
    rows.push(["Descrição", data.desc[0].slice(0, 220) + (data.desc[0].length > 220 ? "…" : "")]);
  }

  if (Array.isArray(data.desc) && data.desc[0] && rows.length < 3) {
    const t = String(data.desc[0]);
    rows.push(["Resumo", t.slice(0, 240) + (t.length > 240 ? "…" : "")]);
  }

  if (!rows.length) return "";

  return `<dl class="detail-kv sheet-card-kv">${rows
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd>`)
    .join("")}</dl>`;
}

function proficiencyOptionLabel(opt) {
  const item = opt?.item;
  if (item?.name) return item.name.replace(/^Skill:\s*/i, "");
  if (item?.index) return formatResourceLabel(String(item.index).replace(/^skill-/, ""));
  return "—";
}

function proficiencyOptionId(opt) {
  return opt?.item?.index ? String(opt.item.index) : "";
}

function renderClassProficiencyChoiceBlock(entry, block, blockIndex) {
  const entryId = favoriteEntryId(entry);
  const sheet = loadSheet();
  const max = block.choose != null ? Number(block.choose) : 2;
  const options = block.from?.option_set_type === "options_array" ? block.from.options || [] : [];
  const picks = getClassProficiencyPicks(sheet, entryId, blockIndex);
  const title =
    block.desc ||
    `Escolhe ${max} ${block.type ? formatResourceLabel(String(block.type)).toLowerCase() : "proficiências"}`;

  const items = options
    .map((opt) => {
      const id = proficiencyOptionId(opt);
      if (!id) return "";
      const checked = picks.includes(id);
      return `<li><label class="detail-pick-item">
        <input type="checkbox" class="detail-pick-input sheet-class-prof-pick" value="${escapeHtml(id)}"
          ${checked ? " checked" : ""} />
        <span class="detail-pick-text">${escapeHtml(proficiencyOptionLabel(opt))}</span>
      </label></li>`;
    })
    .filter(Boolean)
    .join("");

  return `<section class="sheet-class-prof-block">
    <h4 class="sheet-card-subtitle">${escapeHtml(title)}</h4>
    <fieldset class="detail-pick-list sheet-class-prof-fieldset"
      data-entry-id="${escapeHtml(entryId)}"
      data-block-index="${blockIndex}"
      data-max-choose="${max}">
      <ul class="detail-pick-ul">${items}</ul>
      <p class="detail-pick-hint">${escapeHtml(formatClassProfHint(picks.length, max))}</p>
    </fieldset>
  </section>`;
}

function formatClassProfHint(selected, max) {
  return max === 1 ? `${selected} / 1 selecionada` : `${selected} / ${max} selecionadas`;
}

function renderClassDetail(entry, data) {
  const rowsHtml = renderSheetSummary("classes", data);
  let html = rowsHtml || "";

  if (Array.isArray(data.proficiencies) && data.proficiencies.length) {
    html += `<h4 class="sheet-card-subtitle">Proficiências fixas</h4>
      <ul class="detail-chip-list">${data.proficiencies
        .map((p) => `<li><span class="detail-ref">${escapeHtml(p.name ?? p.index)}</span></li>`)
        .join("")}</ul>`;
  }

  const choices = Array.isArray(data.proficiency_choices)
    ? data.proficiency_choices
    : data.proficiency_choices
      ? [data.proficiency_choices]
      : [];

  choices.forEach((block, blockIndex) => {
    if (block?.from?.option_set_type === "options_array" && Array.isArray(block.from.options)) {
      html += renderClassProficiencyChoiceBlock(entry, block, blockIndex);
    }
  });

  if (!html) return '<p class="sheet-card-muted">Sem dados de classe.</p>';
  return html;
}

async function fetchSheetDetail(entry) {
  const path = cleanApiPath(entry.path);
  if (!path) return null;
  const cacheKey = `${currentLocale}:${path}`;
  if (detailCache.has(cacheKey)) return detailCache.get(cacheKey);

  const res = await apiFetch(path);
  if (!res.ok) return null;
  const data = await res.json();
  detailCache.set(cacheKey, data);
  return data;
}

function renderSheetCard(entry, { open = false } = {}) {
  const resourceLabel = formatResourceLabel(entry.resourceKey);
  const openAttr = open ? " open" : "";
  return `<article class="sheet-card" data-sheet-id="${escapeHtml(favoriteEntryId(entry))}">
    <details class="sheet-card-details"${openAttr}>
      <summary class="sheet-card-summary">
        <span class="sheet-card-resource">${escapeHtml(resourceLabel)}</span>
        <span class="sheet-card-name">${escapeHtml(entry.name || entry.index)}</span>
      </summary>
      <div class="sheet-card-body" data-path="${escapeHtml(cleanApiPath(entry.path))}">
        <p class="sheet-card-loading">A carregar…</p>
      </div>
    </details>
    <div class="sheet-card-actions">
      <button type="button" class="sheet-card-link" data-action="open-explorer"
        data-resource="${escapeHtml(entry.resourceKey)}"
        data-index="${escapeHtml(String(entry.index))}"
        data-name="${escapeHtml(entry.name || "")}"
        data-path="${escapeHtml(entry.path || "")}">Ver na exploração</button>
      <button type="button" class="sheet-card-remove" data-action="remove-sheet"
        data-resource="${escapeHtml(entry.resourceKey)}"
        data-index="${escapeHtml(String(entry.index))}">Remover da ficha</button>
    </div>
  </article>`;
}

function renderSheetBoard() {
  const sheet = loadSheet();
  if (!sheetBoard || !sheetEmpty) return;

  if (characterNameInput && characterNameInput.value !== sheet.characterName) {
    characterNameInput.value = sheet.characterName;
  }

  if (sheet.items.length === 0) {
    sheetBoard.innerHTML = "";
    sheetEmpty.hidden = false;
    return;
  }

  sheetEmpty.hidden = true;
  const grouped = groupFavorites(sheet.items);

  sheetBoard.innerHTML = grouped
    .map(([resourceKey, items], gi) => {
      const title = formatResourceLabel(resourceKey);
      const cards = items
        .map((entry, i) => renderSheetCard(entry, { open: gi === 0 && i === 0 }))
        .join("");
      return `<section class="sheet-section">
        <h2 class="sheet-section-title">${escapeHtml(title)}</h2>
        <div class="sheet-section-cards">${cards}</div>
      </section>`;
    })
    .join("");

  sheetBoard.querySelectorAll(".sheet-card-details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.open) loadCardBody(details.closest(".sheet-card"));
    });
    if (details.open) loadCardBody(details.closest(".sheet-card"));
  });
}

async function loadCardBody(cardEl) {
  if (!cardEl) return;
  const body = cardEl.querySelector(".sheet-card-body");
  if (!body || body.dataset.loaded === "1") return;

  const path = body.dataset.path;
  const sheetId = cardEl.dataset.sheetId;
  const sheet = loadSheet();
  const entry = sheet.items.find((i) => favoriteEntryId(i) === sheetId);
  if (!entry || !path) {
    body.innerHTML = '<p class="sheet-card-muted">Dados indisponíveis.</p>';
    body.dataset.loaded = "1";
    return;
  }

  try {
    const data = await fetchSheetDetail(entry);
    if (!data) {
      body.innerHTML = '<p class="sheet-card-muted">Não foi possível carregar.</p>';
    } else if (entry.resourceKey === "classes") {
      body.innerHTML = renderClassDetail(entry, data);
    } else {
      body.innerHTML = renderSheetSummary(entry.resourceKey, data);
    }
  } catch {
    body.innerHTML = '<p class="sheet-card-muted">Erro de rede.</p>';
  }
  body.dataset.loaded = "1";
}

function renderAll() {
  syncCharacterCoreFromSheet();
  renderLibrary();
  renderSheetBoard();
}

function onSheetClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const entry = {
    resourceKey: btn.dataset.resource,
    index: btn.dataset.index,
    name: btn.dataset.name,
    path: btn.dataset.path,
  };

  if (action === "toggle-sheet") {
    toggleSheetItem(entry);
    return;
  }
  if (action === "remove-sheet") {
    removeFromSheet(entry.resourceKey, entry.index);
    return;
  }
  if (action === "open-explorer") {
    openInExplorer(entry);
  }
}

function onCharacterNameInput() {
  patchSheet((sheet) => {
    sheet.characterName = characterNameInput ? characterNameInput.value.trim() : "";
  });
}

function buildAbilityScoresGrid() {
  if (!abilityScoresGrid) return;
  abilityScoresGrid.innerHTML = ABILITY_KEYS.map(
    (key) => `<label class="sheet-ability-cell">
      <span class="sheet-ability-abbr">${ABILITY_LABELS[key]}</span>
      <input type="number" class="sheet-ability-input" data-ability="${key}"
        min="1" max="30" inputmode="numeric" placeholder="10" />
      <span class="sheet-ability-mod" data-mod-for="${key}" aria-label="Modificador">—</span>
    </label>`
  ).join("");
}

function syncCharacterCoreFromSheet() {
  const sheet = loadSheet();

  if (characterNameInput && document.activeElement !== characterNameInput) {
    characterNameInput.value = sheet.characterName;
  }
  if (armorClassInput && document.activeElement !== armorClassInput) {
    armorClassInput.value = sheet.armorClass;
  }
  if (alignmentSelect && document.activeElement !== alignmentSelect) {
    alignmentSelect.value = sheet.alignment;
  }

  abilityScoresGrid?.querySelectorAll(".sheet-ability-input").forEach((input) => {
    const key = input.dataset.ability;
    if (!key || document.activeElement === input) return;
    input.value = sheet.abilityScores[key] ?? "";
    const modEl = abilityScoresGrid.querySelector(`[data-mod-for="${key}"]`);
    if (modEl) modEl.textContent = abilityModifier(input.value);
  });

  syncPortraitUi(sheet.portraitImage);
}

function syncPortraitUi(dataUrl) {
  const has = Boolean(dataUrl);
  if (portraitPreview) {
    if (has) {
      portraitPreview.src = dataUrl;
      portraitPreview.hidden = false;
      portraitPreview.alt = characterNameInput?.value?.trim() || "Retrato do personagem";
    } else {
      portraitPreview.removeAttribute("src");
      portraitPreview.hidden = true;
    }
  }
  if (portraitPlaceholder) portraitPlaceholder.hidden = has;
  if (portraitClear) portraitClear.hidden = !has;
}

function showPortraitError(msg) {
  if (!portraitError) return;
  if (msg) {
    portraitError.textContent = msg;
    portraitError.hidden = false;
  } else {
    portraitError.hidden = true;
    portraitError.textContent = "";
  }
}

function onPortraitSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  showPortraitError("");
  if (!file.type.startsWith("image/")) {
    showPortraitError("Escolhe um ficheiro de imagem (JPEG, PNG, WebP ou GIF).");
    e.target.value = "";
    return;
  }
  if (file.size > PORTRAIT_MAX_BYTES) {
    showPortraitError(`Imagem demasiado grande (máx. ${Math.round(PORTRAIT_MAX_BYTES / 1024)} KB).`);
    e.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (typeof dataUrl !== "string") return;
    patchSheet((sheet) => {
      sheet.portraitImage = dataUrl;
    });
    syncPortraitUi(dataUrl);
  };
  reader.onerror = () => showPortraitError("Não foi possível ler a imagem.");
  reader.readAsDataURL(file);
}

function onPortraitClear() {
  patchSheet((sheet) => {
    sheet.portraitImage = "";
  });
  if (portraitInput) portraitInput.value = "";
  showPortraitError("");
  syncPortraitUi("");
}

function onAbilityInput(e) {
  const input = e.target.closest(".sheet-ability-input");
  if (!input) return;
  const key = input.dataset.ability;
  if (!key) return;
  patchSheet((sheet) => {
    sheet.abilityScores[key] = input.value;
  });
  const modEl = abilityScoresGrid?.querySelector(`[data-mod-for="${key}"]`);
  if (modEl) modEl.textContent = abilityModifier(input.value);
}

function onArmorClassInput() {
  patchSheet((sheet) => {
    sheet.armorClass = armorClassInput ? armorClassInput.value : "";
  });
}

function onAlignmentChange() {
  patchSheet((sheet) => {
    sheet.alignment = alignmentSelect ? alignmentSelect.value : "";
  });
}

async function loadAlignmentsDropdown() {
  if (!alignmentSelect || alignmentsLoaded) return;
  try {
    const res = await apiFetch("/api/2014/alignments");
    if (!res.ok) return;
    const data = await res.json();
    const sheet = loadSheet();
    for (const row of data.results || []) {
      const o = document.createElement("option");
      o.value = row.index;
      o.textContent = row.name ?? row.index;
      alignmentSelect.appendChild(o);
    }
    alignmentSelect.value = sheet.alignment;
    alignmentsLoaded = true;
  } catch {
    /* rede */
  }
}

function updateClassProfHint(fieldset) {
  const hint = fieldset.querySelector(".detail-pick-hint");
  if (!hint) return;
  const max = Number(fieldset.dataset.maxChoose) || 2;
  const selected = fieldset.querySelectorAll(".sheet-class-prof-pick:checked").length;
  hint.textContent = formatClassProfHint(selected, max);
}

function onClassProficiencyChange(e) {
  const input = e.target;
  if (!input.classList?.contains("sheet-class-prof-pick")) return;
  const fieldset = input.closest(".sheet-class-prof-fieldset");
  if (!fieldset) return;

  const entryId = fieldset.dataset.entryId;
  const blockIndex = fieldset.dataset.blockIndex ?? "0";
  const max = Number(fieldset.dataset.maxChoose) || 2;

  if (input.checked) {
    const count = fieldset.querySelectorAll(".sheet-class-prof-pick:checked").length;
    if (count > max) {
      input.checked = false;
      updateClassProfHint(fieldset);
      return;
    }
  }

  const picks = [...fieldset.querySelectorAll(".sheet-class-prof-pick:checked")].map((el) => el.value);
  setClassProficiencyPicks(entryId, blockIndex, picks);
  updateClassProfHint(fieldset);
}

function onLocaleReload() {
  detailCache.clear();
  sheetBoard?.querySelectorAll(".sheet-card-body").forEach((body) => {
    body.dataset.loaded = "0";
    body.innerHTML = '<p class="sheet-card-loading">A carregar…</p>';
  });
  renderSheetBoard();
}

async function boot() {
  await populateLocalesDropdown(localeSelect, { onChange: onLocaleReload });
  await loadAlignmentsDropdown();

  buildAbilityScoresGrid();
  syncCharacterCoreFromSheet();

  document.body.addEventListener("click", onSheetClick);
  document.body.addEventListener("change", onClassProficiencyChange);

  if (characterNameInput) {
    characterNameInput.addEventListener("input", onCharacterNameInput);
    characterNameInput.addEventListener("change", onCharacterNameInput);
  }
  if (abilityScoresGrid) {
    abilityScoresGrid.addEventListener("input", onAbilityInput);
    abilityScoresGrid.addEventListener("change", onAbilityInput);
  }
  if (armorClassInput) {
    armorClassInput.addEventListener("input", onArmorClassInput);
    armorClassInput.addEventListener("change", onArmorClassInput);
  }
  if (alignmentSelect) alignmentSelect.addEventListener("change", onAlignmentChange);
  if (portraitInput) portraitInput.addEventListener("change", onPortraitSelected);
  if (portraitClear) portraitClear.addEventListener("click", onPortraitClear);

  renderAll();
}

boot();

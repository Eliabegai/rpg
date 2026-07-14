/**
 * Painéis de detalhe por tipo de recurso (estilo livro).
 * Depende de shared.js (escapeHtml, formatArmorClass, formatResourceLabel).
 */

function layoutRefNames(items) {
  if (!Array.isArray(items)) return "";
  return items
    .map((i) => i?.name || i?.index || "")
    .filter(Boolean)
    .join(", ");
}

function layoutAbilityBonuses(bonuses) {
  if (!Array.isArray(bonuses)) return "";
  return bonuses
    .map((b) => {
      const ab = b?.ability_score?.name || b?.ability_score?.index || "?";
      return `${ab} +${b.bonus}`;
    })
    .join(", ");
}

function layoutFormatDesc(desc) {
  if (desc == null) return "";
  if (Array.isArray(desc)) {
    const joined = desc.map((d) => String(d)).join("\n\n");
    if (looksLikeApiMarkdown(joined)) return renderApiMarkdown(joined);
    return desc.map((d) => `<p class="detail-text">${escapeHtml(String(d))}</p>`).join("");
  }
  const text = String(desc);
  if (looksLikeApiMarkdown(text)) return renderApiMarkdown(text);
  return `<p class="detail-text">${escapeHtml(text)}</p>`;
}

function looksLikeApiMarkdown(text) {
  const s = String(text || "");
  if (!s.trim()) return false;
  return /^#{1,6}\s/m.test(s) || /^\|.+\|/m.test(s) || /\n\s*\n/.test(s);
}

function renderApiMarkdownInline(text) {
  let t = escapeHtml(String(text || ""));
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*\w])\*(.+?)\*(?!\*)/g, "$1<em>$2</em>");
  t = t.replace(/`([^`]+)`/g, '<code class="detail-md-code">$1</code>');
  return t;
}

function isMarkdownTableSeparatorRow(cells) {
  return (
    cells.length > 0 &&
    cells.every((c) => {
      const x = String(c).replace(/\s/g, "");
      return /^:?-{3,}:?$/.test(x) || /^:?-+:?$/.test(x);
    })
  );
}

function renderMarkdownTable(tableLines) {
  const rows = tableLines
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim())
    )
    .filter((cells) => cells.some((c) => c.length > 0));

  if (!rows.length) return "";

  let header = null;
  const body = [];
  for (const row of rows) {
    if (isMarkdownTableSeparatorRow(row)) continue;
    if (!header) {
      header = row;
      continue;
    }
    body.push(row);
  }
  if (!header) return "";

  const headHtml = header.map((c) => `<th scope="col">${renderApiMarkdownInline(c)}</th>`).join("");
  const bodyHtml = body
    .map(
      (row) =>
        `<tr>${header.map((_, i) => `<td>${renderApiMarkdownInline(row[i] ?? "")}</td>`).join("")}</tr>`
    )
    .join("");

  return `<div class="detail-phb-table-wrap detail-md-table-wrap">
    <table class="detail-phb-table detail-md-table">
      <thead><tr>${headHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  </div>`;
}

/**
 * Markdown simples da API (regras): títulos, parágrafos, listas e tabelas.
 */
function renderApiMarkdown(raw, { skipTitle } = {}) {
  const text = String(raw || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!text) return "";

  const lines = text.split("\n");
  const blocks = [];
  let i = 0;
  let skippedTitle = false;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.includes("|")) {
      const tableLines = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t || !(t.startsWith("|") && t.includes("|"))) break;
        tableLines.push(lines[i]);
        i += 1;
      }
      const tableHtml = renderMarkdownTable(tableLines);
      if (tableHtml) blocks.push(tableHtml);
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = heading[2].trim();
      if (
        skipTitle &&
        !skippedTitle &&
        level <= 2 &&
        content.toLowerCase() === String(skipTitle).toLowerCase()
      ) {
        skippedTitle = true;
        i += 1;
        continue;
      }
      const tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
      blocks.push(
        `<${tag} class="detail-md-heading detail-md-h${level}">${renderApiMarkdownInline(content)}</${tag}>`
      );
      i += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push(
        `<ul class="detail-md-list">${items
          .map((item) => `<li>${renderApiMarkdownInline(item)}</li>`)
          .join("")}</ul>`
      );
      continue;
    }

    const paraLines = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) break;
      if (/^(#{1,4})\s+/.test(t)) break;
      if (t.startsWith("|") && t.includes("|")) break;
      if (/^[-*•]\s+/.test(t)) break;
      paraLines.push(t);
      i += 1;
    }
    if (paraLines.length) {
      blocks.push(
        `<p class="detail-text detail-md-p">${renderApiMarkdownInline(paraLines.join(" "))}</p>`
      );
    }
  }

  return `<div class="detail-md">${blocks.join("")}</div>`;
}

function renderRuleSectionDetailLayout(data) {
  const body = renderApiMarkdown(data.desc, { skipTitle: data.name });
  const html = `<div class="detail-rule-prose">${body || `<p class="detail-muted">Sem descrição.</p>`}</div>`;
  return { html, skip: new Set(["url", "updated_at", "image", "name", "index", "desc"]) };
}

function renderRulesDetailLayout(data) {
  let html = "";
  if (data.desc) {
    html += `<div class="detail-rule-prose">${renderApiMarkdown(data.desc, {
      skipTitle: data.name,
    })}</div>`;
  }
  if (Array.isArray(data.subsections) && data.subsections.length) {
    html += layoutSection(
      "Secções",
      `<ul class="detail-chip-list detail-rule-subsections">${data.subsections
        .map((s) => {
          if (typeof renderNamedRef === "function") return `<li>${renderNamedRef(s)}</li>`;
          return `<li><span class="detail-ref">${escapeHtml(s.name || s.index || "")}</span></li>`;
        })
        .join("")}</ul>`
    );
  }
  return {
    html,
    skip: new Set(["url", "updated_at", "image", "name", "index", "desc", "subsections"]),
  };
}

function layoutKvRows(rows) {
  return rows
    .filter(([, v]) => v != null && v !== "")
    .map(
      ([label, val]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${typeof val === "string" ? escapeHtml(val) : val}</td></tr>`
    )
    .join("");
}

function layoutSection(title, bodyHtml) {
  if (!bodyHtml?.trim()) return "";
  return `<section class="detail-layout-section"><h4 class="detail-layout-heading">${escapeHtml(title)}</h4>${bodyHtml}</section>`;
}

function layoutChipList(items) {
  if (!Array.isArray(items) || !items.length) return "";
  const chips = items
    .map((i) => `<li>${escapeHtml(i?.name || i?.index || "")}</li>`)
    .join("");
  return `<ul class="detail-chip-list">${chips}</ul>`;
}

const REF_CARDS_FETCH_BATCH = 8;

function layoutDescPreview(desc, maxLen = 200) {
  let text = "";
  if (Array.isArray(desc)) text = desc.map((d) => String(d)).join(" ");
  else if (desc != null) text = String(desc);
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length > maxLen) return `${text.slice(0, maxLen - 1)}…`;
  return text;
}

function parseApiRefParts(pathOrUrl) {
  const path = cleanApiPath(pathOrUrl || "");
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 4 && parts[0] === "api") {
    return {
      resourceKey: parts[2],
      index: parts[3] || "",
      path,
    };
  }
  if (parts.length >= 3 && parts[0] === "v2") {
    return {
      resourceKey: parts[1] === "creatures" ? "monsters" : parts[1],
      index: (parts[2] || "").replace(/\/$/, ""),
      path,
    };
  }
  return { resourceKey: "", index: "", path };
}

function equipmentCategoryGroupLabel(resourceKey) {
  const labels = {
    "magic-items": "Itens mágicos",
    equipment: "Equipamento",
    weapons: "Armas",
    armor: "Armaduras",
  };
  return labels[resourceKey] || formatResourceLabel(resourceKey);
}

/**
 * Layout de equipment-categories: agrupa por tipo e carrega resumos (desc) + link ao detalhe.
 */
function renderEquipmentCategoryDetailLayout(data) {
  const items = Array.isArray(data.equipment) ? data.equipment : [];
  const groups = new Map();
  for (const ref of items) {
    const { resourceKey } = parseApiRefParts(ref?.url);
    const key = resourceKey || "outros";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ref);
  }

  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const rank = (k) => (k === "magic-items" ? 0 : k === "equipment" ? 1 : 2);
    const d = rank(a) - rank(b);
    return d !== 0 ? d : a.localeCompare(b);
  });

  let html = `<p class="detail-muted detail-category-count">${items.length} item(ns) nesta categoria. Clica em «Ver detalhe» para abrir em Equipment / Magic Items.</p>`;

  for (const key of orderedKeys) {
    const refs = groups.get(key);
    const title = `${equipmentCategoryGroupLabel(key)} (${refs.length})`;
    html += layoutSection(
      title,
      layoutRefCardsMount(refs, {
        loadingLabel: `A carregar ${equipmentCategoryGroupLabel(key).toLowerCase()}…`,
      })
    );
  }

  const skip = new Set(["url", "updated_at", "image", "name", "index", "equipment", "desc"]);
  return { html, skip };
}

function layoutRefCardsMount(refs, { loadingLabel = "A carregar…" } = {}) {
  const refsArr = Array.isArray(refs) ? refs : [];
  const urls = refsArr.map((t) => cleanApiPath(t?.url)).filter(Boolean);
  if (!urls.length) return layoutChipList(refsArr);
  return `<div class="detail-ref-cards-mount detail-trait-mount" data-ref-urls="${escapeHtml(urls.join(","))}" data-trait-urls="${escapeHtml(urls.join(","))}">
    <p class="detail-muted detail-enrich-placeholder">${escapeHtml(loadingLabel)}</p>
  </div>`;
}

function layoutTraitRefs(traits) {
  return layoutRefCardsMount(traits, { loadingLabel: "A carregar traços…" });
}

function layoutPrerequisitesText(prerequisites) {
  if (!Array.isArray(prerequisites) || !prerequisites.length) return "";
  return prerequisites
    .map((p) => {
      if (!p || typeof p !== "object") return "";
      if (p.type === "spell" && p.spell) {
        const idx = String(p.spell).split("/").filter(Boolean).pop() || "";
        return `Magia: ${formatResourceLabel(idx)}`;
      }
      if (p.type === "feature" && p.feature) {
        return `Capacidade: ${p.feature.name || formatResourceLabel(p.feature.index || "")}`;
      }
      if (p.type === "level" && p.level != null) return `Nível de personagem ${p.level}`;
      if (p.level != null) return `Nível ${p.level}`;
      if (p.ability_score) {
        const ab = p.ability_score.name || formatResourceLabel(p.ability_score.index || "");
        const min = p.minimum_score != null ? ` ${p.minimum_score}+` : "";
        return `${ab}${min}`;
      }
      return "";
    })
    .filter(Boolean)
    .join(" · ");
}

function layoutClassLevelsMount(classLevels) {
  const path = typeof classLevels === "string" ? cleanApiPath(classLevels) : "";
  if (!path) return "";
  return `<div class="detail-class-levels-mount" data-levels-path="${escapeHtml(path)}">
    <p class="detail-muted detail-enrich-placeholder">A carregar evolução por nível…</p>
  </div>`;
}

function layoutBackgroundOptionText(opt) {
  if (!opt || typeof opt !== "object") return "";
  if (opt.string) return String(opt.string).trim();
  if (opt.desc) return String(opt.desc).trim();
  if (opt.name) return String(opt.name).trim();
  return "";
}

/** Tabela PHB com checkboxes (referência na mesa; não grava na ficha). */
function layoutBackgroundChoiceTable(tableData, title, { showAlignment = false } = {}) {
  if (!tableData?.from?.options?.length) return "";
  const choose = tableData.choose != null ? Number(tableData.choose) : 1;
  const chooseLabel = choose === 1 ? "escolhe 1" : `escolhe ${choose}`;
  const rows = tableData.from.options
    .map((opt, i) => {
      const text = layoutBackgroundOptionText(opt);
      if (!text) return "";
      const cid = `bg-choice-${layoutNodeId()}`;
      const align =
        showAlignment && Array.isArray(opt.alignments) && opt.alignments.length
          ? opt.alignments.map((a) => a.name || formatResourceLabel(a.index || "")).join(", ")
          : "";
      return `<tr>
        <td class="detail-bg-choice-check">
          <input type="checkbox" class="detail-bg-choice-cb" id="${cid}" aria-label="Marcar opção ${i + 1}" />
        </td>
        <td><label for="${cid}" class="detail-bg-choice-label">${escapeHtml(text)}${
          align ? ` <span class="detail-bg-align">(${escapeHtml(align)})</span>` : ""
        }</label></td>
      </tr>`;
    })
    .filter(Boolean)
    .join("");
  if (!rows) return "";
  return layoutSection(
    title,
    `<p class="detail-muted detail-bg-choose-hint">PHB: ${escapeHtml(chooseLabel)}. Marca na mesa ou copia para a ficha.</p>
    <table class="detail-bg-choices"><thead><tr><th scope="col" class="detail-bg-choice-check"></th><th scope="col">Opção</th></tr></thead><tbody>${rows}</tbody></table>`
  );
}

let _layoutNodeId = 0;
function layoutNodeId() {
  _layoutNodeId += 1;
  return _layoutNodeId;
}

function layoutStartingEquipmentSection(equipment, options) {
  const parts = [];

  if (Array.isArray(equipment) && equipment.length) {
    const items = equipment
      .map((e) => {
        const qty = e.quantity != null && e.quantity !== 1 ? `${e.quantity}× ` : "";
        const name = e.equipment?.name || e.equipment?.index || "—";
        return `${qty}${name}`;
      })
      .join(", ");
    parts.push(`<p class="detail-text">${escapeHtml(items)}</p>`);
  }

  if (Array.isArray(options) && options.length) {
    const opts = options
      .map(
        (opt) =>
          `<article class="detail-action-card">${
            opt.desc ? `<p class="detail-text">${escapeHtml(opt.desc)}</p>` : ""
          }</article>`
      )
      .join("");
    parts.push(`<div class="detail-action-list">${opts}</div>`);
  }

  return parts.join("");
}

function layoutMultiClassingSection(multiClassing) {
  if (!multiClassing || typeof multiClassing !== "object") return "";
  const parts = [];
  const mcProfs = layoutRefNames(multiClassing.proficiencies);
  if (mcProfs) {
    parts.push(
      `<p class="detail-text"><strong>Proficiências ao multiclasse:</strong> ${escapeHtml(mcProfs)}</p>`
    );
  }
  if (multiClassing.prerequisite_options) {
    parts.push(
      `<p class="detail-muted">Requisitos de atributo ou proficiência — consulta o manual ou o detalhe completo na API.</p>`
    );
  }
  return parts.join("");
}

function renderClassBookHtml(data, { proficiencyChoicesHtml = "" } = {}) {
  const rows = [];
  if (data.hit_die != null) rows.push(["Dado de vida", `d${data.hit_die}`]);
  const saves = layoutRefNames(data.saving_throws);
  if (saves) rows.push(["Salvaguardas", saves]);
  const profs = layoutRefNames(data.proficiencies);
  if (profs) rows.push(["Proficiências", profs]);
  if (data.spellcasting) {
    const sc = data.spellcasting;
    const ability = sc.spellcasting_ability?.name || sc.spellcasting_ability?.index || "";
    rows.push(["Conjuração", `A partir do nível ${sc.level ?? 1} · ${ability}`]);
  }

  let html = `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`;

  if (data.spellcasting?.info?.length) {
    const spellBody = data.spellcasting.info
      .map(
        (block) =>
          `<article class="detail-action-card"><h5 class="detail-action-name">${escapeHtml(block.name || "")}</h5>${layoutFormatDesc(block.desc)}</article>`
      )
      .join("");
    html += layoutSection("Magias (resumo)", `<div class="detail-action-list">${spellBody}</div>`);
  }

  if (Array.isArray(data.subclasses) && data.subclasses.length) {
    html += layoutSection("Subclasses", layoutChipList(data.subclasses));
  }

  const equipBody = layoutStartingEquipmentSection(data.starting_equipment, data.starting_equipment_options);
  if (equipBody) html += layoutSection("Equipamento inicial", equipBody);

  const mcBody = layoutMultiClassingSection(data.multi_classing);
  if (mcBody) html += layoutSection("Multiclasse", mcBody);

  if (proficiencyChoicesHtml) html += proficiencyChoicesHtml;

  if (data.class_levels) {
    html += layoutSection("Evolução por nível", layoutClassLevelsMount(data.class_levels));
  }

  return html;
}

async function fetchRefCards(urls) {
  const items = [];
  for (let i = 0; i < urls.length; i += REF_CARDS_FETCH_BATCH) {
    const batch = urls.slice(i, i + REF_CARDS_FETCH_BATCH);
    const batchItems = await Promise.all(
      batch.map(async (path) => {
        const res = await apiFetch(path);
        if (!res.ok) return null;
        return res.json();
      })
    );
    items.push(...batchItems);
  }
  return items;
}

function refCardsHtml(items, emptyMessage) {
  const cards = items
    .filter(Boolean)
    .map((item) => {
      const ref = parseApiRefParts(item.url || "");
      const resourceKey = ref.resourceKey;
      const index = String(item.index || ref.index || "");
      const path = ref.path || cleanApiPath(item.url || "");
      const preview = layoutDescPreview(item.desc);
      const metaParts = [];
      if (item.rarity?.name) metaParts.push(item.rarity.name);
      if (item.equipment_category?.name) metaParts.push(item.equipment_category.name);
      if (item.gear_category?.name) metaParts.push(item.gear_category.name);
      if (item.weapon_category) metaParts.push(String(item.weapon_category));
      if (item.armor_category) metaParts.push(String(item.armor_category));
      if (item.category_range) metaParts.push(String(item.category_range));
      const meta = metaParts.join(" · ");
      const openBtn =
        resourceKey && index
          ? `<button type="button" class="detail-open-ref-btn" data-action="open-api-ref"
              data-resource="${escapeHtml(resourceKey)}"
              data-index="${escapeHtml(index)}"
              data-path="${escapeHtml(path)}"
              data-name="${escapeHtml(String(item.name || index))}">Ver detalhe →</button>`
          : "";
      const kind = resourceKey
        ? `<span class="detail-ref-kind">${escapeHtml(equipmentCategoryGroupLabel(resourceKey))}</span>`
        : "";
      return `<article class="detail-action-card detail-ref-card">
        <div class="detail-ref-card-head">
          <h5 class="detail-action-name">${escapeHtml(item.name || index || "")}</h5>
          ${kind}
        </div>
        ${meta ? `<p class="detail-muted">${escapeHtml(meta)}</p>` : ""}
        ${preview ? `<p class="detail-text detail-ref-preview">${escapeHtml(preview)}</p>` : layoutFormatDesc(item.desc)}
        ${openBtn}
      </article>`;
    })
    .join("");
  return cards
    ? `<div class="detail-action-list detail-ref-card-list">${cards}</div>`
    : `<p class="detail-muted">${escapeHtml(emptyMessage)}</p>`;
}

async function enrichRefCardsMount(mountEl) {
  if (!mountEl || mountEl.dataset.enriched === "1") return;
  const urls = (mountEl.dataset.refUrls || mountEl.dataset.traitUrls || mountEl.dataset.featureUrls || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (!urls.length) return;

  mountEl.dataset.enriched = "1";
  const emptyMsg = mountEl.dataset.emptyMessage || "Sem descrição.";
  const errorMsg = mountEl.dataset.errorMessage || "Não foi possível carregar.";
  try {
    const items = await fetchRefCards(urls);
    mountEl.innerHTML = refCardsHtml(items, emptyMsg);
  } catch {
    mountEl.innerHTML = `<p class="detail-muted">${escapeHtml(errorMsg)}</p>`;
  }
}

async function enrichTraitMount(mountEl) {
  return enrichRefCardsMount(mountEl);
}

function spellSlotCounts(spellcasting) {
  if (!spellcasting || typeof spellcasting !== "object") return [];
  const slots = [];
  for (let i = 1; i <= 9; i++) {
    const n = spellcasting[`spell_slots_level_${i}`];
    if (n > 0) slots.push({ level: i, count: n });
  }
  return slots;
}

function formatSpellSlotOrdinal(level) {
  const n = Number(level);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n}º`;
}

/**
 * Tabela estilo PHB (Fonte de Magia): espaço de magia ↔ pontos de feitiçaria.
 * @returns {string}
 */
function renderCreatingSpellSlotsTable(rows, { changed = false } = {}) {
  if (!Array.isArray(rows) || !rows.length) return "";
  const body = rows
    .map((row) => {
      const lvl = formatSpellSlotOrdinal(row?.spell_slot_level);
      const cost = row?.sorcery_point_cost;
      if (!lvl || cost == null) return "";
      return `<tr>
        <td class="detail-phb-table-cell detail-phb-table-cell--lvl">${escapeHtml(lvl)}</td>
        <td class="detail-phb-table-cell detail-phb-table-cell--cost">${escapeHtml(String(cost))}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join("");
  if (!body) return "";

  return `<div class="detail-phb-table-wrap${changed ? " is-changed" : ""}">
    <p class="detail-phb-table-caption">Criar espaços de magia</p>
    <p class="detail-phb-table-hint">Fonte de Magia — converte pontos de feitiçaria (PF) em espaços.</p>
    <table class="detail-phb-table" aria-label="Custo em pontos de feitiçaria para criar espaços de magia">
      <thead>
        <tr>
          <th scope="col">Espaço de magia</th>
          <th scope="col">Custo (PF)</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function formatClassSpecificDice(val) {
  if (!val || typeof val !== "object") return "";
  const count = Number(val.dice_count);
  const faces = Number(val.dice_value);
  if (!Number.isFinite(count) || !Number.isFinite(faces) || count <= 0 || faces <= 0) return "";
  return `${count}d${faces}`;
}

function classSpecificFieldLabel(key) {
  const labels = {
    sneak_attack: "Ataque furtivo",
    martial_arts: "Artes marciais",
    ki_points: "Pontos de ki",
    unarmored_movement: "Movimento sem armadura",
    rage_count: "Fúrias",
    rage_damage_bonus: "Bónus de dano da fúria",
    brutal_critical_dice: "Dados de crítico brutal",
    bardic_inspiration_die: "Dado de inspiração bárdica",
    song_of_rest_die: "Dado de canção de descanso",
    magical_secrets_max_5: "Segredos mágicos (máx. 5º)",
    magical_secrets_max_7: "Segredos mágicos (máx. 7º)",
    magical_secrets_max_9: "Segredos mágicos (máx. 9º)",
    channel_divinity_charges: "Cargas de canalizar divindade",
    destroy_undead_cr: "Destruir mortos-vivos (ND)",
    wild_shape_max_cr: "Forma selvagem (ND máx.)",
    wild_shape_swim: "Forma selvagem (natação)",
    wild_shape_fly: "Forma selvagem (voo)",
    action_surges: "Surtos de ação",
    indomitable_uses: "Usos de Indomável",
    extra_attacks: "Ataques extra",
    aura_range: "Alcance da aura",
    favored_enemies: "Inimigos privilegiados",
    favored_terrain: "Terrenos privilegiados",
    sorcery_points: "Pontos de feitiçaria",
    metamagic_known: "Metamagias conhecidas",
    creating_spell_slots: "Criar espaços de magia",
    arcane_recovery_levels: "Recuperação arcana (nível de slot)",
    invocations_known: "Invocações conhecidas",
    mystic_arcanum_level_6: "Arcano místico (6º)",
    mystic_arcanum_level_7: "Arcano místico (7º)",
    mystic_arcanum_level_8: "Arcano místico (8º)",
    mystic_arcanum_level_9: "Arcano místico (9º)",
  };
  if (labels[key]) return labels[key];
  const m = String(key).match(/^mystic_arcanum_level_(\d+)$/);
  if (m) return `Arcano místico (${m[1]}º)`;
  const s = String(key).match(/^magical_secrets_max_(\d+)$/);
  if (s) return `Segredos mágicos (máx. ${s[1]}º)`;
  return formatResourceLabel(key);
}

function formatClassSpecificValue(key, val) {
  if (val == null || val === "") return "";

  if (typeof val === "boolean") return val ? "sim" : "não";

  if (typeof val === "number") {
    if (key === "unarmored_movement" || key === "aura_range") return `+${val} pés`;
    if (key.endsWith("_die") || key.includes("inspiration_die") || key.includes("rest_die")) {
      return `d${val}`;
    }
    if (key === "rage_damage_bonus") return `+${val}`;
    if (key === "destroy_undead_cr" || key === "wild_shape_max_cr") {
      return Number.isInteger(val) ? String(val) : String(val);
    }
    return String(val);
  }

  if (Array.isArray(val)) {
    if (!val.length) return "";
    if (key === "creating_spell_slots") {
      /* Tabela dedicada — não usar texto linear. */
      return "";
    }
    return val
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          return String(item);
        }
        if (typeof item === "object") {
          const dice = formatClassSpecificDice(item);
          if (dice) return dice;
          if (item.name) return String(item.name);
          return "";
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof val === "object") {
    const dice = formatClassSpecificDice(val);
    if (dice) return dice;
    if (val.name != null) return String(val.name);
    /* Objeto sem formato conhecido: omitir em vez de "[object Object]". */
    return "";
  }

  return String(val);
}

/**
 * HTML das entradas class_specific de um nível (nunca stringify de objetos).
 * Com nível anterior: só mostra o que mudou (delta estilo livro).
 * @returns {string}
 */
function renderClassSpecificLevelHtml(classSpecific, prevClassSpecific) {
  if (!classSpecific || typeof classSpecific !== "object") return "";

  const parts = [];
  for (const [key, val] of Object.entries(classSpecific)) {
    if (val === 0 || val === false || val === null || val === "") continue;
    if (Array.isArray(val) && !val.length) continue;

    if (key === "creating_spell_slots" && Array.isArray(val)) {
      const prevVal = prevClassSpecific?.creating_spell_slots;
      const signature = (rows) =>
        Array.isArray(rows)
          ? rows.map((r) => `${r?.spell_slot_level}:${r?.sorcery_point_cost}`).join("|")
          : "";
      const changed = prevClassSpecific == null || signature(prevVal) !== signature(val);
      if (!changed) continue;
      const tableHtml = renderCreatingSpellSlotsTable(val, { changed: true });
      if (tableHtml) parts.push(`<li class="detail-class-specific-block">${tableHtml}</li>`);
      continue;
    }

    const display = formatClassSpecificValue(key, val);
    if (!display) continue;

    const prevVal = prevClassSpecific ? prevClassSpecific[key] : undefined;
    const changed =
      prevClassSpecific == null ||
      formatClassSpecificValue(key, prevVal) !== display;
    if (!changed) continue;

    parts.push(
      `<li class="detail-class-specific-item is-changed">
        <span class="detail-class-specific-label">${escapeHtml(classSpecificFieldLabel(key))}</span>
        <span class="detail-class-specific-value">${escapeHtml(display)}</span>
      </li>`
    );
  }

  if (!parts.length) return "";
  return `<ul class="detail-class-specific-list">${parts.join("")}</ul>`;
}

function renderSpellcastingLevelHtml(spellcasting, prevSpellcasting) {
  if (!spellcasting || typeof spellcasting !== "object") return "";

  const slots = spellSlotCounts(spellcasting);
  const prevSlots = prevSpellcasting ? spellSlotCounts(prevSpellcasting) : [];
  const prevMap = new Map(prevSlots.map((s) => [s.level, s.count]));

  const hasCantrips = spellcasting.cantrips_known != null;
  const hasSpellsKnown = spellcasting.spells_known != null;
  if (!hasCantrips && !hasSpellsKnown && !slots.length) return "";

  /* Delta estilo PHB: truques/magias conhecidas só quando o número muda. */
  const cantripsChanged =
    hasCantrips &&
    (!prevSpellcasting || prevSpellcasting.cantrips_known !== spellcasting.cantrips_known);
  const spellsKnownChanged =
    hasSpellsKnown &&
    (!prevSpellcasting || prevSpellcasting.spells_known !== spellcasting.spells_known);

  const slotsChanged = slots.some((s) => {
    const prevCount = prevMap.get(s.level);
    return prevCount === undefined || s.count !== prevCount;
  });
  /* Nível sem comparação (1.º com spellcasting): mostrar grelha completa. */
  const showSlots = !prevSpellcasting || slotsChanged;
  if (!cantripsChanged && !spellsKnownChanged && !showSlots) return "";

  let html = '<div class="detail-level-spellblock">';

  if (cantripsChanged) {
    html += `<span class="detail-level-meta is-changed">${escapeHtml(
      String(spellcasting.cantrips_known)
    )} truques</span>`;
  }
  if (spellsKnownChanged) {
    html += `<span class="detail-level-meta is-changed">${escapeHtml(
      String(spellcasting.spells_known)
    )} magias conhecidas</span>`;
  }

  if (showSlots && slots.length) {
    html += '<div class="detail-slot-chips" aria-label="Espaços de magia por nível">';
    for (const s of slots) {
      const prevCount = prevMap.get(s.level);
      const changed = prevCount === undefined || s.count !== prevCount;
      html += `<span class="detail-slot-chip${changed ? " detail-slot-chip--changed" : ""}" title="Espaços de ${s.level}º nível de magia"><span class="detail-slot-chip-lvl">${s.level}º</span><span class="detail-slot-chip-n">${s.count}</span></span>`;
    }
    html += "</div>";
  }

  html += "</div>";
  return html;
}

function featureNamesAtLevel(lv) {
  return (Array.isArray(lv?.features) ? lv.features : [])
    .map((f) => f.name || f.index || "")
    .filter(Boolean);
}

function featuresNewAtLevel(lv, seenBefore) {
  const names = featureNamesAtLevel(lv);
  if (!seenBefore || seenBefore.size === 0) return names;
  return names.filter((n) => !seenBefore.has(n));
}

function renderClassLevelDescHtml(lv, prevLevel, seenFeaturesBefore) {
  const blocks = [];

  const newFeatures = featuresNewAtLevel(lv, seenFeaturesBefore);
  if (newFeatures.length) {
    const items = newFeatures.map((f) => `<li>${escapeHtml(f)}</li>`).join("");
    blocks.push(`<div class="detail-level-note detail-level-note--features">
      <span class="detail-level-note-label">Capacidades</span>
      <ul class="detail-level-feature-list">${items}</ul>
    </div>`);
  }

  const spellHtml = renderSpellcastingLevelHtml(lv.spellcasting, prevLevel?.spellcasting);
  if (spellHtml) {
    blocks.push(`<div class="detail-level-note detail-level-note--spells">
      <span class="detail-level-note-label">Conjuração</span>
      ${spellHtml}
    </div>`);
  }

  const csHtml = renderClassSpecificLevelHtml(lv.class_specific, prevLevel?.class_specific);
  if (csHtml) {
    blocks.push(`<div class="detail-level-note detail-level-note--class">
      <span class="detail-level-note-label">Classe</span>
      ${csHtml}
    </div>`);
  }

  if (
    prevLevel &&
    lv.prof_bonus != null &&
    prevLevel.prof_bonus != null &&
    lv.prof_bonus !== prevLevel.prof_bonus
  ) {
    blocks.push(`<div class="detail-level-note detail-level-note--prof">
      <span class="detail-level-note-label">Proficiência</span>
      <p class="detail-level-note-text is-changed">Bónus de proficiência +${escapeHtml(String(lv.prof_bonus))}</p>
    </div>`);
  }

  if (!blocks.length) {
    return '<p class="detail-level-empty">Sem alterações registadas neste nível.</p>';
  }

  return `<div class="detail-level-notes">${blocks.join("")}</div>`;
}

function renderClassLevelsListHtml(levels) {
  const sorted = [...levels].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const seenFeatures = new Set();
  const rows = sorted
    .map((lv, i) => {
      const levelNum = lv.level != null ? lv.level : "?";
      const prev = i > 0 ? sorted[i - 1] : null;
      const desc = renderClassLevelDescHtml(lv, prev, seenFeatures);
      for (const n of featureNamesAtLevel(lv)) seenFeatures.add(n);
      return `<tr class="detail-level-row">
        <th scope="row" class="detail-level-table-lvl"><span class="detail-level-badge">${escapeHtml(String(levelNum))}</span></th>
        <td class="detail-level-table-desc">${desc}</td>
      </tr>`;
    })
    .join("");
  return `<table class="detail-level-table"><tbody>${rows}</tbody></table>`;
}

async function enrichClassLevelsMount(mountEl) {
  if (!mountEl || mountEl.dataset.enriched === "1") return;
  const path = mountEl.dataset.levelsPath;
  if (!path) return;

  mountEl.dataset.enriched = "1";
  try {
    const res = await apiFetch(path);
    if (!res.ok) throw new Error("levels");
    const levels = await res.json();
    if (!Array.isArray(levels) || !levels.length) {
      mountEl.innerHTML = '<p class="detail-muted">Sem níveis definidos.</p>';
      return;
    }

    mountEl.innerHTML = renderClassLevelsListHtml(levels);
  } catch {
    mountEl.innerHTML = '<p class="detail-muted">Não foi possível carregar os níveis da classe.</p>';
  }
}

async function enrichDetailMounts(root) {
  if (!root) return;
  const refMounts = [...root.querySelectorAll(".detail-ref-cards-mount, .detail-trait-mount")];
  const levelMounts = [...root.querySelectorAll(".detail-class-levels-mount")];
  await Promise.all([
    ...refMounts.map((el) => enrichRefCardsMount(el)),
    ...levelMounts.map((el) => enrichClassLevelsMount(el)),
  ]);
}

function formatSpeeds(speed) {
  if (!speed || typeof speed !== "object") return "—";
  return Object.entries(speed)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
}

function formatMonsterAction(action) {
  if (!action || typeof action !== "object") return "";
  const name = action.name || "Ação";
  const desc = layoutFormatDesc(action.desc);
  const extras = [];
  if (action.attack_bonus != null) extras.push(`ataque ${action.attack_bonus >= 0 ? "+" : ""}${action.attack_bonus}`);
  if (action.damage?.length) {
    const dmg = action.damage
      .map((d) => `${d.damage_dice || ""} ${d.damage_type?.name || d.damage_type?.index || ""}`.trim())
      .join(", ");
    if (dmg) extras.push(dmg);
  }
  const meta = extras.length ? `<p class="detail-muted">${escapeHtml(extras.join(" · "))}</p>` : "";
  return `<article class="detail-action-card"><h5 class="detail-action-name">${escapeHtml(name)}</h5>${meta}${desc}</article>`;
}

function renderMonsterActionsList(actions) {
  if (!Array.isArray(actions) || !actions.length) return "";
  return `<div class="detail-action-list">${actions.map(formatMonsterAction).join("")}</div>`;
}

function renderMonsterDetailLayout(data) {
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
  rows.push(["Deslocamento", formatSpeeds(data.speed)]);
  if (data.senses?.passive_perception != null) {
    rows.push(["Percepção passiva", String(data.senses.passive_perception)]);
  }
  if (data.languages) rows.push(["Idiomas", data.languages]);

  let html = `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`;

  if (Array.isArray(data.special_abilities) && data.special_abilities.length) {
    html += layoutSection(
      "Capacidades especiais",
      `<div class="detail-action-list">${data.special_abilities.map(formatMonsterAction).join("")}</div>`
    );
  }

  const actions = Array.isArray(data.actions) ? data.actions : [];
  if (actions.length) {
    html += layoutSection("Ações", renderMonsterActionsList(actions));
  }

  const legendary = Array.isArray(data.legendary_actions) ? data.legendary_actions : [];
  if (legendary.length) {
    html += layoutSection("Ações lendárias", renderMonsterActionsList(legendary));
  }

  const skip = new Set([
    "url",
    "updated_at",
    "image",
    "name",
    "index",
    "size",
    "type",
    "subtype",
    "alignment",
    "armor_class",
    "hit_points",
    "hit_dice",
    "challenge_rating",
    "xp",
    "proficiency_bonus",
    "speed",
    "senses",
    "languages",
    "special_abilities",
    "actions",
    "legendary_actions",
    "reactions",
    "forms",
    "desc",
    "_provider",
    "_document",
  ]);

  return { html, skip };
}

function spellLevelLabel(level) {
  if (level === 0 || level === "0") return "Truque";
  return `${level}º nível`;
}

function renderSpellDetailLayout(data) {
  const rows = [];
  if (data.level !== undefined && data.level !== null) rows.push(["Nível", spellLevelLabel(data.level)]);
  if (data.school?.name) rows.push(["Escola", data.school.name]);
  else if (data.school?.index) rows.push(["Escola", formatResourceLabel(data.school.index)]);
  if (data.casting_time) rows.push(["Tempo de conjuração", data.casting_time]);
  if (data.range) rows.push(["Alcance", data.range]);
  if (data.components) rows.push(["Componentes", Array.isArray(data.components) ? data.components.join(", ") : data.components]);
  if (data.material) rows.push(["Material", data.material]);
  if (data.duration) rows.push(["Duração", data.duration]);
  if (data.concentration) rows.push(["Concentração", "Sim"]);
  if (data.ritual) rows.push(["Ritual", "Sim"]);

  let html = `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`;
  html += layoutFormatDesc(data.desc);
  if (data.higher_level?.length) {
    html += layoutSection("Em níveis superiores", layoutFormatDesc(data.higher_level));
  }

  if (Array.isArray(data.classes) && data.classes.length) {
    html += layoutSection("Classes que aprendem", layoutChipList(data.classes));
  }
  if (Array.isArray(data.subclasses) && data.subclasses.length) {
    html += layoutSection("Subclasses que aprendem", layoutChipList(data.subclasses));
  }

  const skip = new Set([
    "url",
    "updated_at",
    "image",
    "name",
    "index",
    "level",
    "school",
    "casting_time",
    "range",
    "components",
    "material",
    "duration",
    "concentration",
    "ritual",
    "desc",
    "higher_level",
    "classes",
    "subclasses",
  ]);

  return { html, skip };
}

function formatDamageDie(damage) {
  if (!damage || typeof damage !== "object") return "—";
  const dice = damage.damage_dice || "";
  const type = damage.damage_type?.name || damage.damage_type?.index || "";
  return `${dice} ${type}`.trim() || "—";
}

function renderEquipmentDetailLayout(data) {
  const rows = [];
  if (data.equipment_category?.name) rows.push(["Categoria", data.equipment_category.name]);
  if (data.weapon_category) rows.push(["Arma", data.weapon_category]);
  if (data.weapon_range) rows.push(["Alcance arma", data.weapon_range]);
  if (data.category_range) rows.push(["Categoria alcance", data.category_range]);
  if (data.damage) rows.push(["Dano", formatDamageDie(data.damage)]);
  if (data.two_handed_damage) rows.push(["Dano (duas mãos)", formatDamageDie(data.two_handed_damage)]);
  if (data.armor_class != null) {
    const ac =
      typeof data.armor_class === "object"
        ? formatArmorClass(data.armor_class)
        : String(data.armor_class);
    rows.push(["CA", ac]);
  }
  if (data.str_minimum != null) rows.push(["Força mín.", String(data.str_minimum)]);
  if (data.stealth) rows.push(["Furtividade", "Desvantagem"]);
  if (data.cost?.quantity != null && data.cost?.unit) {
    rows.push(["Custo", `${data.cost.quantity} ${data.cost.unit}`]);
  }
  if (data.weight != null) rows.push(["Peso", `${data.weight} lb`]);

  let html = `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`;

  if (Array.isArray(data.properties) && data.properties.length) {
    const props = data.properties.map((p) => escapeHtml(p.name || p.index || String(p))).join(", ");
    html += `<p class="detail-text"><strong>Propriedades:</strong> ${props}</p>`;
  }

  html += layoutFormatDesc(data.desc);

  const skip = new Set([
    "url",
    "updated_at",
    "image",
    "name",
    "index",
    "equipment_category",
    "weapon_category",
    "weapon_range",
    "category_range",
    "damage",
    "two_handed_damage",
    "armor_class",
    "str_minimum",
    "stealth",
    "cost",
    "weight",
    "properties",
    "desc",
    "contents",
    "gear_category",
  ]);

  return { html, skip };
}

function renderClassDetailLayout(data) {
  const choices = Array.isArray(data.proficiency_choices) ? data.proficiency_choices : [];
  let proficiencyChoicesHtml = "";
  if (choices.length) {
    const choiceHtml = choices
      .map((c) => `<p class="detail-text">${escapeHtml(c.desc || "")}</p>`)
      .join("");
    proficiencyChoicesHtml = layoutSection("Escolhas de proficiência", choiceHtml);
  }

  const html = renderClassBookHtml(data, { proficiencyChoicesHtml });

  const skip = new Set([
    "url",
    "updated_at",
    "image",
    "name",
    "index",
    "hit_die",
    "saving_throws",
    "proficiencies",
    "proficiency_choices",
    "spellcasting",
    "starting_equipment",
    "starting_equipment_options",
    "class_levels",
    "multi_classing",
    "subclasses",
  ]);

  return { html, skip };
}

function renderRaceDetailLayout(data) {
  const rows = [];
  if (data.size) rows.push(["Tamanho", data.size]);
  if (data.speed != null) rows.push(["Deslocamento", `${data.speed} pés`]);
  const bonuses = layoutAbilityBonuses(data.ability_bonuses);
  if (bonuses) rows.push(["Bónus de atributos", bonuses]);
  const langs = layoutRefNames(data.languages);
  if (langs) rows.push(["Idiomas", langs]);

  let html = `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`;

  if (data.alignment) {
    html += `<p class="detail-text"><strong>Alinhamento típico:</strong> ${escapeHtml(data.alignment)}</p>`;
  }
  if (data.age) html += layoutSection("Idade", layoutFormatDesc(data.age));
  if (data.size_description) html += layoutSection("Tamanho e porte", layoutFormatDesc(data.size_description));
  if (data.language_desc) html += layoutSection("Idiomas", layoutFormatDesc(data.language_desc));

  const traitRefs = data.traits || data.racial_traits;
  if (Array.isArray(traitRefs) && traitRefs.length) {
    html += layoutSection("Traços raciais", layoutTraitRefs(traitRefs));
  }

  if (Array.isArray(data.subraces) && data.subraces.length) {
    html += layoutSection("Sub-raças", layoutChipList(data.subraces));
  }

  if (data.race?.name || data.race?.index) {
    html += `<p class="detail-text"><strong>Raça base:</strong> ${escapeHtml(data.race.name || data.race.index)}</p>`;
  }
  if (data.desc) html += layoutSection("Descrição", layoutFormatDesc(data.desc));

  const skip = new Set([
    "url",
    "updated_at",
    "image",
    "name",
    "index",
    "size",
    "speed",
    "ability_bonuses",
    "age",
    "alignment",
    "size_description",
    "languages",
    "language_desc",
    "traits",
    "racial_traits",
    "subraces",
    "race",
    "desc",
  ]);

  return { html, skip };
}

function renderSubraceDetailLayout(data) {
  return renderRaceDetailLayout(data);
}

function renderBackgroundDetailLayout(data) {
  _layoutNodeId = 0;
  const rows = [];
  if (data.feature?.name) rows.push(["Característica", data.feature.name]);
  const profs = layoutRefNames(data.starting_proficiencies);
  if (profs) rows.push(["Proficiências iniciais", profs]);
  const langs = layoutRefNames(data.languages);
  if (langs) rows.push(["Idiomas", langs]);
  const tools = layoutRefNames(data.tool_proficiencies);
  if (tools) rows.push(["Ferramentas", tools]);

  let html = `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`;

  if (data.feature?.desc) {
    html += layoutSection("Característica", layoutFormatDesc(data.feature.desc));
  }

  html += layoutBackgroundChoiceTable(data.personality_traits, "Traços de personalidade");
  html += layoutBackgroundChoiceTable(data.ideals, "Ideais", { showAlignment: true });
  html += layoutBackgroundChoiceTable(data.bonds, "Vínculos");
  html += layoutBackgroundChoiceTable(data.flaws, "Defeitos");

  const equipBody = layoutStartingEquipmentSection(data.starting_equipment, data.starting_equipment_options);
  if (equipBody) html += layoutSection("Equipamento inicial", equipBody);

  const skip = new Set([
    "url",
    "updated_at",
    "image",
    "name",
    "index",
    "feature",
    "starting_proficiencies",
    "language_proficiencies",
    "languages",
    "tool_proficiencies",
    "skill_proficiencies",
    "personality_traits",
    "ideals",
    "bonds",
    "flaws",
    "starting_equipment",
    "starting_equipment_options",
    "starting_proficiency_options",
    "desc",
  ]);

  return { html, skip };
}

function renderFeatDetailLayout(data) {
  const rows = [];
  const prereq = layoutPrerequisitesText(data.prerequisites);
  if (prereq) rows.push(["Pré-requisitos", prereq]);

  let html = rows.length
    ? `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`
    : "";

  if (data.desc) html += layoutSection("Descrição", layoutFormatDesc(data.desc));
  else if (!html) html = '<p class="detail-muted">Sem descrição na API.</p>';

  const skip = new Set([
    "url",
    "updated_at",
    "image",
    "name",
    "index",
    "prerequisites",
    "desc",
    "reference",
  ]);

  return { html, skip };
}

function renderSubclassDetailLayout(data) {
  const rows = [];
  if (data.class?.name) rows.push(["Classe", data.class.name]);
  else if (data.class?.index) rows.push(["Classe", formatResourceLabel(data.class.index)]);
  if (data.subclass_flavor) rows.push(["Tipo", data.subclass_flavor]);

  let html = `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`;
  html += layoutFormatDesc(data.desc);

  if (data.subclass_levels) {
    html += layoutSection("Evolução por nível", layoutClassLevelsMount(data.subclass_levels));
  }

  if (Array.isArray(data.spells) && data.spells.length) {
    html += layoutSection(
      "Magias da subclasse",
      layoutRefCardsMount(data.spells, { loadingLabel: "A carregar magias…" })
    );
  }

  const skip = new Set([
    "url",
    "updated_at",
    "image",
    "name",
    "index",
    "class",
    "subclass_flavor",
    "desc",
    "subclass_levels",
    "spells",
  ]);

  return { html, skip };
}

function renderTraitDetailLayout(data) {
  const rows = [];
  const profs = layoutRefNames(data.proficiencies);
  if (profs) rows.push(["Proficiências", profs]);

  let html = rows.length
    ? `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`
    : "";

  if (data.desc) html += layoutSection("Descrição", layoutFormatDesc(data.desc));

  if (Array.isArray(data.races) && data.races.length) {
    html += layoutSection("Raças", layoutChipList(data.races));
  }
  if (Array.isArray(data.subraces) && data.subraces.length) {
    html += layoutSection("Sub-raças", layoutChipList(data.subraces));
  }

  const skip = new Set([
    "url",
    "updated_at",
    "image",
    "name",
    "index",
    "desc",
    "proficiencies",
    "races",
    "subraces",
  ]);

  return { html, skip };
}

function renderFeatureDetailLayout(data) {
  const rows = [];
  if (data.level != null) rows.push(["Nível", String(data.level)]);
  if (data.class?.name) rows.push(["Classe", data.class.name]);
  else if (data.class?.index) rows.push(["Classe", formatResourceLabel(data.class.index)]);
  if (data.subclass?.name) rows.push(["Subclasse", data.subclass.name]);
  else if (data.subclass?.index) rows.push(["Subclasse", formatResourceLabel(data.subclass.index)]);
  if (data.parent?.name) rows.push(["Dentro de", data.parent.name]);
  else if (data.parent?.index) rows.push(["Dentro de", formatResourceLabel(data.parent.index)]);
  const prereq = layoutPrerequisitesText(data.prerequisites);
  if (prereq) rows.push(["Pré-requisitos", prereq]);

  let html = `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`;

  if (data.desc) html += layoutSection("Descrição", layoutFormatDesc(data.desc));

  const fs = data.feature_specific;
  if (fs && typeof fs === "object") {
    const subOpts = fs.subfeature_options;
    if (subOpts?.from?.options?.length) {
      const refs = subOpts.from.options.map((o) => o.item).filter(Boolean);
      const choose = subOpts.choose != null ? Number(subOpts.choose) : 1;
      const title = choose === 1 ? "Opções (escolhe 1)" : `Opções (escolhe ${choose})`;
      html += layoutSection(
        title,
        layoutRefCardsMount(refs, { loadingLabel: "A carregar opções…" })
      );
    }
    if (Array.isArray(fs.invocations) && fs.invocations.length) {
      html += layoutSection(
        `Invocações disponíveis (${fs.invocations.length})`,
        layoutRefCardsMount(fs.invocations, { loadingLabel: "A carregar invocações…" })
      );
    }
  }

  const skip = new Set([
    "url",
    "updated_at",
    "image",
    "name",
    "index",
    "level",
    "class",
    "subclass",
    "parent",
    "prerequisites",
    "desc",
    "feature_specific",
  ]);

  return { html, skip };
}

/**
 * @returns {{ html: string, skip: Set<string> } | null}
 */
function getSpecializedDetailLayout(resourceKey, data) {
  if (!data || typeof data !== "object") return null;
  if (resourceKey === "monsters") return renderMonsterDetailLayout(data);
  if (resourceKey === "spells") return renderSpellDetailLayout(data);
  if (resourceKey === "equipment") return renderEquipmentDetailLayout(data);
  if (resourceKey === "classes") return renderClassDetailLayout(data);
  if (resourceKey === "races" || resourceKey === "subraces") return renderRaceDetailLayout(data);
  if (resourceKey === "backgrounds") return renderBackgroundDetailLayout(data);
  if (resourceKey === "subclasses") return renderSubclassDetailLayout(data);
  if (resourceKey === "traits") return renderTraitDetailLayout(data);
  if (resourceKey === "feats") return renderFeatDetailLayout(data);
  if (resourceKey === "features") return renderFeatureDetailLayout(data);
  if (resourceKey === "equipment-categories") return renderEquipmentCategoryDetailLayout(data);
  if (resourceKey === "rule-sections") return renderRuleSectionDetailLayout(data);
  if (resourceKey === "rules") return renderRulesDetailLayout(data);
  return null;
}

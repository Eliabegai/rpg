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
    return desc.map((d) => `<p class="detail-text">${escapeHtml(String(d))}</p>`).join("");
  }
  return `<p class="detail-text">${escapeHtml(String(desc))}</p>`;
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
    .map(
      (item) =>
        `<article class="detail-action-card"><h5 class="detail-action-name">${escapeHtml(item.name || "")}</h5>${layoutFormatDesc(item.desc)}</article>`
    )
    .join("");
  return cards
    ? `<div class="detail-action-list">${cards}</div>`
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

    mountEl.innerHTML = levels
      .map((lv) => {
        const levelNum = lv.level != null ? lv.level : "?";
        const features = Array.isArray(lv.features) ? lv.features : [];
        const featList = features.length
          ? `<ul class="detail-chip-list">${features
              .map((f) => `<li>${escapeHtml(f.name || f.index || "")}</li>`)
              .join("")}</ul>`
          : '<p class="detail-muted">Sem capacidades novas neste nível.</p>';
        const open = levelNum === 1 ? " open" : "";
        return `<details class="detail-level-block"${open}>
          <summary class="detail-level-summary">Nível ${escapeHtml(String(levelNum))}</summary>
          ${featList}
        </details>`;
      })
      .join("");
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
    const chips = data.classes
      .map((c) => `<li>${escapeHtml(c.name || c.index || "")}</li>`)
      .join("");
    html += layoutSection("Classes", `<ul class="detail-chip-list">${chips}</ul>`);
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

function renderSubclassDetailLayout(data) {
  const rows = [];
  if (data.class?.name) rows.push(["Classe", data.class.name]);
  else if (data.class?.index) rows.push(["Classe", formatResourceLabel(data.class.index)]);
  if (data.subclass_flavor) rows.push(["Tipo", data.subclass_flavor]);

  let html = `<table class="detail-info-table"><tbody>${layoutKvRows(rows)}</tbody></table>`;
  html += layoutFormatDesc(data.desc);

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
  if (resourceKey === "subclasses") return renderSubclassDetailLayout(data);
  if (resourceKey === "traits") return renderTraitDetailLayout(data);
  if (resourceKey === "features") return renderFeatureDetailLayout(data);
  return null;
}

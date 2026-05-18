/**
 * Painéis de detalhe por tipo de recurso (Fase A — estilo livro).
 * Depende de shared.js (escapeHtml, formatArmorClass, formatResourceLabel).
 */

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

/**
 * @returns {{ html: string, skip: Set<string> } | null}
 */
function getSpecializedDetailLayout(resourceKey, data) {
  if (!data || typeof data !== "object") return null;
  if (resourceKey === "monsters") return renderMonsterDetailLayout(data);
  if (resourceKey === "spells") return renderSpellDetailLayout(data);
  if (resourceKey === "equipment") return renderEquipmentDetailLayout(data);
  return null;
}

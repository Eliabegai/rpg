/**
 * v3.3 — Várias campanhas: dados isolados por campanha em localStorage.
 */
const STORAGE_CAMPAIGN_REGISTRY = "dnd5eapi.campaignRegistry";
const STORAGE_ACTIVE_CAMPAIGN_ID = "dnd5eapi.activeCampaignId";
const STORAGE_MIGRATED_V33 = "dnd5eapi.migratedCampaignsV33";
const DEFAULT_CAMPAIGN_ID = "default";

const CAMPAIGN_SCOPED_SUFFIXES = ["sheet", "dmBattle", "sessionHistory", "dmSnapshots", "meta"];

const LEGACY_KEY_MAP = {
  sheet: "dnd5eapi.sheet",
  dmBattle: "dnd5eapi.dmBattle",
  sessionHistory: "dnd5eapi.sessionHistory",
  dmSnapshots: "dnd5eapi.dmEncounterSnapshots",
  meta: "dnd5eapi.campaign",
};

function campaignScopedKey(suffix, campaignId) {
  const id = campaignId || getActiveCampaignId();
  return `dnd5eapi.c.${id}.${suffix}`;
}

function loadCampaignRegistry() {
  ensureCampaignMigration();
  try {
    const raw = localStorage.getItem(STORAGE_CAMPAIGN_REGISTRY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((c) => {
        if (!c || typeof c !== "object") return null;
        const id = c.id != null ? String(c.id) : "";
        const name = c.name != null ? String(c.name).trim().slice(0, 120) : "";
        if (!id || !name) return null;
        return {
          id,
          name,
          createdAt: c.createdAt != null ? String(c.createdAt) : new Date().toISOString(),
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveCampaignRegistry(list) {
  try {
    localStorage.setItem(STORAGE_CAMPAIGN_REGISTRY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function getActiveCampaignId() {
  ensureCampaignMigration();
  try {
    const id = localStorage.getItem(STORAGE_ACTIVE_CAMPAIGN_ID);
    if (id && loadCampaignRegistry().some((c) => c.id === id)) return id;
  } catch {
    /* ignore */
  }
  const list = loadCampaignRegistry();
  if (list.length) return list[0].id;
  return DEFAULT_CAMPAIGN_ID;
}

function setActiveCampaignId(id) {
  const list = loadCampaignRegistry();
  if (!list.some((c) => c.id === id)) return false;
  localStorage.setItem(STORAGE_ACTIVE_CAMPAIGN_ID, id);
  window.dispatchEvent(new CustomEvent("grimorio-campaign-changed", { detail: { id } }));
  return true;
}

function getActiveCampaign() {
  const id = getActiveCampaignId();
  return loadCampaignRegistry().find((c) => c.id === id) || { id, name: "Campanha", createdAt: "" };
}

function ensureCampaignMigration() {
  if (localStorage.getItem(STORAGE_MIGRATED_V33) === "1") return;

  let legacyName = "";
  try {
    const raw = localStorage.getItem(LEGACY_KEY_MAP.meta);
    if (raw) legacyName = JSON.parse(raw)?.name || "";
  } catch {
    /* ignore */
  }

  const id = DEFAULT_CAMPAIGN_ID;
  for (const suffix of CAMPAIGN_SCOPED_SUFFIXES) {
    const legacy = LEGACY_KEY_MAP[suffix];
    const scoped = campaignScopedKey(suffix, id);
    if (legacy && localStorage.getItem(legacy) != null && localStorage.getItem(scoped) == null) {
      localStorage.setItem(scoped, localStorage.getItem(legacy));
    }
  }

  const registry = [
    {
      id,
      name: legacyName.trim() || "Campanha principal",
      createdAt: new Date().toISOString(),
    },
  ];
  saveCampaignRegistry(registry);
  localStorage.setItem(STORAGE_ACTIVE_CAMPAIGN_ID, id);
  localStorage.setItem(STORAGE_MIGRATED_V33, "1");
}

function createCampaign(name) {
  const label = String(name || "").trim().slice(0, 120);
  if (!label) return { ok: false, error: "Indica um nome para a campanha." };
  const id = newEntityId("camp");
  const list = loadCampaignRegistry();
  list.push({ id, name: label, createdAt: new Date().toISOString() });
  saveCampaignRegistry(list);

  localStorage.setItem(campaignScopedKey("sheet", id), JSON.stringify(typeof normalizeSheet === "function" ? normalizeSheet(null) : {}));
  localStorage.setItem(
    campaignScopedKey("dmBattle", id),
    JSON.stringify(typeof normalizeDmBattle === "function" ? normalizeDmBattle(null) : { party: [], encounters: [] })
  );
  localStorage.setItem(campaignScopedKey("sessionHistory", id), "[]");
  localStorage.setItem(campaignScopedKey("dmSnapshots", id), "[]");
  localStorage.setItem(campaignScopedKey("meta", id), JSON.stringify({ name: label }));

  setActiveCampaignId(id);
  return { ok: true, campaign: { id, name: label } };
}

function renameActiveCampaign(name) {
  const label = String(name || "").trim().slice(0, 120);
  const id = getActiveCampaignId();
  const list = loadCampaignRegistry();
  const entry = list.find((c) => c.id === id);
  if (!entry) return { ok: false };
  entry.name = label || entry.name;
  saveCampaignRegistry(list);
  try {
    const meta = JSON.parse(localStorage.getItem(campaignScopedKey("meta", id)) || "{}");
    meta.name = entry.name;
    localStorage.setItem(campaignScopedKey("meta", id), JSON.stringify(meta));
  } catch {
    localStorage.setItem(campaignScopedKey("meta", id), JSON.stringify({ name: entry.name }));
  }
  return { ok: true, name: entry.name };
}

function deleteCampaign(campaignId) {
  const list = loadCampaignRegistry();
  if (list.length <= 1) return { ok: false, error: "Precisas de pelo menos uma campanha." };
  const id = String(campaignId);
  if (!list.some((c) => c.id === id)) return { ok: false, error: "Campanha não encontrada." };

  for (const suffix of CAMPAIGN_SCOPED_SUFFIXES) {
    localStorage.removeItem(campaignScopedKey(suffix, id));
  }

  const next = list.filter((c) => c.id !== id);
  saveCampaignRegistry(next);
  if (getActiveCampaignId() === id) setActiveCampaignId(next[0].id);
  return { ok: true };
}

function switchToCampaign(campaignId) {
  if (!loadCampaignRegistry().some((c) => c.id === campaignId)) {
    return { ok: false, error: "Campanha não encontrada." };
  }
  setActiveCampaignId(campaignId);
  return { ok: true };
}

function readCampaignScoped(suffix) {
  return localStorage.getItem(campaignScopedKey(suffix));
}

function writeCampaignScoped(suffix, value) {
  localStorage.setItem(campaignScopedKey(suffix), value);
}

function removeCampaignScoped(suffix) {
  localStorage.removeItem(campaignScopedKey(suffix));
}

/**
 * Referência rápida local (DMG / PHB) — tesouro por ND e regras de mesa.
 */
const DM_TREASURE_CR_OPTIONS = [
  { id: "0-4", label: "ND 0–4" },
  { id: "5-10", label: "ND 5–10" },
  { id: "11-16", label: "ND 11–16" },
  { id: "17+", label: "ND 17+" },
];

/** Tesouro individual (DMG, simplificado). */
const DM_TREASURE_INDIVIDUAL = {
  "0-4": () => {
    const cp = rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6);
    return { text: `${cp} cp (5d6)`, parts: [{ coin: "cp", amount: cp }] };
  },
  "5-10": () => {
    const sp = (rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6)) * 10;
    return { text: `${sp} sp (4d6×10)`, parts: [{ coin: "sp", amount: sp }] };
  },
  "11-16": () => {
    const gp = (rollDie(6) + rollDie(6) + rollDie(6)) * 10;
    return { text: `${gp} gp (3d6×10)`, parts: [{ coin: "gp", amount: gp }] };
  },
  "17+": () => {
    const gp = (rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6)) * 10;
    return { text: `${gp} gp (5d6×10)`, parts: [{ coin: "gp", amount: gp }] };
  },
};

/** Tesouro de acumulação (uma rolagem simplificada por faixa). */
const DM_TREASURE_HOARD = {
  "0-4": () => {
    const sp = (rollDie(6) + rollDie(6)) * 10;
    const gp = rollDie(6) * 10;
    const parts = [{ coin: "sp", amount: sp }];
    let text = `${sp} sp (2d6×10)`;
    if (rollDie(20) >= 15) {
      parts.push({ coin: "gp", amount: gp });
      text += `; ${gp} gp (d6×10, 25%)`;
    }
    return { text, parts };
  },
  "5-10": () => {
    const gp = (rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6)) * 100;
    const pp = rollDie(6) * 10;
    const parts = [{ coin: "gp", amount: gp }];
    let text = `${gp} gp (4d6×100)`;
    if (rollDie(20) >= 13) {
      parts.push({ coin: "pp", amount: pp });
      text += `; ${pp} pp (d6×10, 35%)`;
    }
    return { text, parts };
  },
  "11-16": () => {
    const gp = (rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6)) * 1000;
    const pp = (rollDie(6) + rollDie(6) + rollDie(6)) * 100;
    const parts = [{ coin: "gp", amount: gp }, { coin: "pp", amount: pp }];
    return { text: `${gp} gp (6d6×1000) e ${pp} pp (3d6×100)`, parts };
  },
  "17+": () => {
    const gp = (rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6)) * 10000;
    const pp = (rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6) + rollDie(6)) * 1000;
    return {
      text: `${gp} gp (6d6×10000) e ${pp} pp (5d6×1000) — consulta DMG para gemas/arte`,
      parts: [
        { coin: "gp", amount: gp },
        { coin: "pp", amount: pp },
      ],
    };
  },
};

const DM_QUICK_RULES = [
  {
    id: "cover",
    title: "Cobertura",
    body: `<ul>
      <li><strong>Meia cobertura</strong> (+2 CA, Destreza): obstáculo cobre metade do corpo.</li>
      <li><strong>Três quartos</strong> (+5 CA, Destreza): grade, seteira estreita.</li>
      <li><strong>Cobertura total</strong>: não pode ser alvo direto; magias de área podem ainda atingir.</li>
    </ul>`,
  },
  {
    id: "vision",
    title: "Visão e luz",
    body: `<ul>
      <li><strong>Luz plena</strong>: sem penalidade.</li>
      <li><strong>Penumbra</strong>: desvantagem em Percepção que usa vista.</li>
      <li><strong>Escuridão</strong>: área fortemente obscurecida; visão no escuro ou magia.</li>
      <li><strong>Invisível</strong>: não pode ser visto sem sentidos especiais.</li>
    </ul>`,
  },
  {
    id: "rest",
    title: "Descansos (resumo)",
    body: `<ul>
      <li><strong>Curto</strong> (≥1 h): pode gastar dados de vida para recuperar PV; algumas capacidades recarregam.</li>
      <li><strong>Longo</strong> (≥8 h, sono): repõe todos os PV, metade dos dados de vida (mín. 1), slots de conjurador (exceto pacto no curto também).</li>
      <li>Interrupções pesadas podem impedir benefícios do descanso longo (regra de mesa).</li>
    </ul>`,
  },
  {
    id: "surprise",
    title: "Surpresa e iniciativa",
    body: `<ul>
      <li>Grupo surpreendido não age na 1.ª rodada; recupera normalidade na 2.ª.</li>
      <li>Iniciativa = 1d20 + mod. Destreza (outros bónus aplicam-se).</li>
      <li>Empate: mestre decide ou rola de novo entre empatados.</li>
    </ul>`,
  },
];

function rollDmTreasure(kind, crId) {
  const table = kind === "hoard" ? DM_TREASURE_HOARD : DM_TREASURE_INDIVIDUAL;
  const fn = table[crId] || table["0-4"];
  return fn();
}

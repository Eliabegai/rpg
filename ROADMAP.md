# Grimório 5e — Roadmap

Planeamento de produto alinhado ao PHB/DMG (5e 2014) e ao estado atual do projeto.

## Estado atual

| Área | O que existe |
|------|----------------|
| **Explorador** | Lista + painel de detalhe genérico (`renderDetail` / `renderDetailValue`) — muito JSON em `<details>` aninhados |
| **Monstros (DM)** | PV, dano, iniciativa, XP por criatura, divisão de XP na sessão |
| **Ficha** | Atributos, PV, nível, XP, slots de magia (v1), descanso, favoritos |
| **Personagens na mesa** | Nome, nível, XP, iniciativa; sync com ficha por nome |

---

## Épico 1 — Detalhes “estilo livro” (explorador)

**Problema:** Informação útil enterrada em colapsos genéricos.

**Objetivo:** Resumo visível de imediato; listas longas só onde fizer sentido.

### 1.1 Perfis por tipo de recurso

| Recurso | Sempre no topo | Em lista/colapsos |
|---------|----------------|-------------------|
| **Classe** | DV, salvaguardas, proficiências, resumo de magias | Features por nível |
| **Subclasse** | Nome, descrição curta | Features por nível |
| **Raça** | Bónus, velocidade, idiomas, traços curtos | Escolhas (ideal/personalidade) |
| **Monstro** | ND, XP, CA, PV, deslocamento, ataques principais | Ações extra, lenda, spellcasting |
| **Magia** | Nível, escola, tempo, alcance, componentes, duração, descrição | — |
| **Equipamento** | Categoria, dano, propriedades, custo, peso | — |

### 1.2 Regras de colapso inteligentes

- Abrir por defeito: resumo, `desc` curto
- Fechado: arrays longos, features por nível
- Nunca colapsar: escalares no topo

---

## Épico 2 — Dificuldade de encontro (DMG)

- Nível em `DmPartyMember`
- Calculadora: XP dos monstros × multiplicadores DMG vs orçamento Fácil/Médio/Difícil/Mortal
- Indicador visual na mesa do mestre

---

## Épico 3 — XP e evolução por nível (PHB)

- Tabela `XP_THRESHOLDS` (nível 1–20)
- Por personagem: nível, XP total, barra até próximo nível
- XP da sessão soma ao total persistido

---

## Épico 4 — Contador de magias (PHB)

- Slots por classe/nível (tabelas locais)
- UI na ficha: grelha de slots (v1: pleno, meio-conjurador)
- **Magias por nível (Fase C+):** lista por nível de slot (truques + 1º–9º), estado «preparada», indicador «Posso usar» / «Sem slot», importação dos favoritos ★ e ao marcar magia «Na ficha».
- Multiclasse / pacto / 1/3 — expandir tabelas (Fase D+)

---

## Épico 5 — Descanso e ambiente

- Seletor: taverna, fogueira, masmorra, etc.
- Descanso curto / longo com recuperação guiada (PV, dados de vida, slots)
- Presets DMG opcionais por ambiente

---

## Épico 6 — Retenção

- Sync ficha ↔ mesa
- Campanha / sessão (nome, notas)
- Histórico de combates
- PWA / modo mesa
- Import/export JSON da campanha

---

## Ordem de desenvolvimento

```
Épico 1 (detalhes) → Épico 2 (nível + encontro) → Épico 3 (XP PHB)
  → Épico 4 (magias) → Épico 5 (descanso) → Épico 6 (campanha + sync)
```

### Fase A — Quick wins
- [x] Perfis de detalhe: monstro, magia, equipamento
- [x] Nível no personagem da mesa + tabela XP PHB (leitura)
- [x] Campanha: nome + export/import JSON

### Fase B — Mesa forte
- [x] Perfis classe / raça / subclasse
- [x] Calculadora de dificuldade de encontro
- [x] XP acumulado + barra de progressão

### Fase C — Ficha completa
- [x] Slots de magia (v1)
- [x] Descanso curto/longo + ambientes
- [x] Sync ficha ↔ mesa

### Fase C+ — Slots de magia
- [x] Magias registadas por nível de slot (lista + «posso usar?» vs slots gastos)
- [x] Ligar magias favoritas da API à lista por nível
- [x] Truques separados dos slots de nível

### Fase D — Polimento
- [x] PWA (manifest + service worker offline para assets estáticos)
- [x] Modo mesa (UI amplificada para telemóvel/tablet na ficha e no mestre)
- [x] Histórico de sessões de combate (XP creditado, data, resumo)
- [x] Conjurador pacto (bruxo) e progressão 1/3 (ex.: EK)

---

## Dados: API vs local

| Dado | Fonte |
|------|--------|
| Textos, features, magias, CR, XP monstro | API |
| Orçamento de encontro | DMG — local |
| XP por nível | PHB — local |
| Slots por classe | PHB — local |
| Descanso | PHB — lógica local |

---

## Decisões em aberto

1. Multiclasse — adiar na v1 de magias?
2. Várias campanhas — exige `campaignId` em todo o `localStorage`
3. API 2014 até migração futura
4. Conteúdo SRD / referência legal nas tabelas

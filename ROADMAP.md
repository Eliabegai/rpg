# Grimório 5e — Roadmap

Planeamento de produto alinhado ao PHB/DMG (5e 2014) e ao estado atual do projeto.

## Estado atual (pós v2)

| Área | O que existe |
|------|----------------|
| **Explorador** | Perfis «estilo livro» para monstro, magia, equipamento, classe (evolução por nível), raça/sub-raça, trait, feature, subclasse; favoritos; filtros de magias |
| **Ficha** | v3.0–v3.1 fechados (combate, conjuração, descanso, sync inspiração/condições com mesa); próximo: **v3.2 Mesa** |
| **Mesa (DM)** | Monstros (PV, dano, iniciativa, imagens), iniciativa unificada, dificuldade de encontro DMG, XP por sessão + histórico, personagens (nível, sync, eliminado), modo mesa |
| **Infra** | PWA, `base-path` GitHub Pages, campanha export/import JSON, SEO básico |

---

## Histórico — Épicos 1–6 (v1 / v2)

### Épico 1 — Detalhes «estilo livro» (explorador)

**Objetivo:** Resumo visível de imediato; listas longas só onde fizer sentido.

| Recurso | Estado |
|---------|--------|
| Monstro, magia, equipamento | Feito |
| Classe, raça, sub-raça, trait, feature | Feito |
| Background, feat (mesmo padrão livro) | v3.4 |
| Subclasse com evolução por nível (`subclass_levels`) | v3.4 |
| Magia: classes que aprendem no detalhe | v3.4 |
| Delta só do que mudou por nível (conjuradores) | Feito (v3.1) |

### Épicos 2–6

| Épico | Resumo | Estado |
|-------|--------|--------|
| 2 — Dificuldade de encontro | Nível na mesa, calculadora DMG, indicador visual | Feito |
| 3 — XP PHB | Tabela 1–20, barra, XP de sessão | Feito |
| 4 — Contador de magias | Slots, lista por nível, import favoritos, pacto/1/3 | Feito (multiclasse completa → v3.1) |
| 5 — Descanso e ambiente | Ambientes, curto/longo guiado | Feito (dados de vida na UI → v3.1) |
| 6 — Retenção | Sync, campanha JSON, histórico combate, PWA, modo mesa | Feito (várias campanhas → v3.3) |

### Fases concluídas (v1 / v2)

- [x] Fase A — Perfis monstro/magia/equipamento, nível na mesa, campanha JSON
- [x] Fase B — Perfis classe/raça/subclasse, dificuldade encontro, XP acumulado
- [x] Fase C / C+ — Slots, descanso, sync, magias por nível, truques
- [x] Fase D — PWA, modo mesa, histórico sessões, pacto/1/3
- [x] Pós-D — UI iniciativa, detalhe traits/features, tabela de níveis legível

---

## v3 — Ficha + livro + mesa (PHB / DMG)

Objetivo da v3: o jogador e o mestre conseguem **jogar uma sessão** sem folha de papel, com regras PHB/DMG como referência e a ficha como calculadora — não um VTT completo.

### Princípios

- Dados de texto e regras: **API 2014** + tabelas locais (PHB/DMG).
- Sem backend obrigatório: `localStorage`, export JSON, PWA.
- Priorizar **combate e criação** antes de automações profundas (ataques, CA dinâmica).
- Manter SRD / referência legal em textos locais quando não vier da API.

---

### v3.0 — Ficha «combat-ready»

Foco: o que falta na ficha oficial para rodar combate e social básico.

| Item | Descrição | Fonte |
|------|-----------|--------|
| Perícias | Grelha 18 perícias; proficiência; bónus = mod. atributo + prof. (+ meio prof. se aplicável) | PHB |
| Salvaguardas | Três colunas (For, Des, Con, Int, Sab, Car) com prof. de classe; bónus calculado | PHB |
| Condições | Chips ativas (cego, envenenado, etc.); link ao recurso `conditions` da API | PHB / API |
| Inspiração | Toggle + estado visível na ficha (e opcional na mesa) | PHB |
| Concentração | Campo «magia em concentração»; lembrete de teste de Const. ao sofrer dano | PHB |
| Inventário leve | Lista de equipamento (favoritos / manual); moedas PP/PO/PE/PP/PC; carga (For × 15 lb) | PHB |
| Personalidade (background) | Traços, ideais, vínculos, defeitos quando houver background na ficha | PHB |

**Critério de aceite:** jogador resolve perícia, salvaguarda, PV, condição e inspiração só na ficha, com bónus corretos a partir dos atributos já guardados.

**Progresso v3.0 (implementação):**

- [x] Modelo de dados (`shared.js`: perícias, salvaguardas, condições, inspiração, concentração, moedas, inventário, personalidade)
- [x] UI na ficha (`sheet-v3-combat.js`, secção «Combate (PHB)» em `sheet.html`)
- [x] Bónus calculados (mod. atributo + prof. por nível)
- [x] Nomes de perícias via API (`/api/2014/skills`)
- [x] Meio bónus de proficiência (½) e perícia em dobro (2×) — botão por perícia: — → ½ → ● → 2×
- [x] Importar equipamento dos favoritos para inventário (★ e itens na ficha; peso da API)
- [x] Preencher personalidade a partir do background na ficha (aleatório PHB)
- [x] Inspiração / condições na mesa (sync ficha ↔ iniciativa, `dm-combat-sync.js`)

---

### Futuro — Restauração de vida e ambiente temático

Melhoria planeada (pós v3.0): o bloco de **curação / PV / descanso** passa a refletir visualmente o **ambiente de descanso** selecionado (taverna, masmorra, fogueira, etc.) — fundo, ícone ou ilustração leve, tipografia de «cena», sem alterar as regras PHB.

| Ideia | Descrição |
|-------|-----------|
| Painel temático | `data-rest-theme` no fieldset de PV/descanso; CSS por ambiente (`wilderness`, `campfire`, `tavern`, `dungeon`, `stronghold`) |
| Cura contextual | Mensagens e cores alinhadas ao ambiente (ex.: longo na taverna vs. interrompido na masmorra) |
| Modo mesa | Temas com maior contraste e menos ornamentação |

**Estado:** base implementada — cena visual por ambiente, temas em PV/descanso, animação ao descansar. Ilustrações ou arte por ambiente → evolução futura.

---

### v3.1 — Conjuração PHB

| Item | Descrição | Fonte |
|------|-----------|--------|
| Preparadas vs conhecidas | Clérigo/mago/druida: limite de preparação por nível; lista «preparada hoje» | PHB |
| Multiclasse (slots) | Segunda classe na ficha; tabela de slots multiclasse; DV e prof. mistos | PHB |
| Descanso: dados de vida | UI para gastar HD no descanso curto; aplicar cura; longo recupera metade dos HD | PHB |
| Descanso: slots | Recuperação de slots no longo conforme classe; aviso meio-conjurador / pacto | PHB |
| Evolução por nível (delta) | Na tabela de classe: destacar só truques/slots/capacidades **novas** em cada nível | UX |

**Critério de aceite:** mago multiclasse com bruxo vê slots corretos; descanso longo atualiza slots e HD de forma previsível.

**Progresso v3.1 (implementação):**

- [x] Multiclasse: painel com classes, níveis e contribuição de conjuração; nível combinado PHB
- [x] Slots via `getMulticlassSpellSlotsMap` (incl. pacto do bruxo)
- [x] Preparadas: limite mago/clérigo/druida (nível + atributo); contador na ficha
- [x] Descanso curto: gastar N dados de vida de uma vez
- [x] Aplicar classe na ficha: DV, salvaguardas, perícias fixas (API)
- [x] Sugerir PV máximos (média PHB)
- [x] Recuperação de slots no longo por classe / meio-conjurador (avisos em `describeLongRestSpellRecovery`)
- [x] Delta só do que mudou por nível na tabela de classe (capacidades novas por nível)

---

### v3.2 — Mesa

| Item | Descrição | Fonte |
|------|-----------|--------|
| Turno de iniciativa | Destacar turno atual; botão «próximo»; contador de rodada (opcional) | DMG / mesa |
| Condições na mesa | Aplicar condições a monstro ou personagem na lista de iniciativa | PHB |
| Encontro guardado | Nome + criaturas/PV/iniciativa; reabrir na sessão seguinte | DMG |
| Tesouro rápido | Tabela ou rolagem por ND (referência DMG, texto local) | DMG |
| Regras rápidas | Atalhos: cobertura, visão, atividades de descanso (trechos SRD locais) | DMG / SRD |

**Critério de aceite:** mestre corre um combate completo só em `dm.html` sem perder estado ao recarregar (encontro + iniciativa).

---

### v3.3 — Criação de personagem + campanhas

| Item | Descrição | Fonte |
|------|-----------|--------|
| Assistente PHB | Fluxo: raça → classe → antecedente → equipamento → atributos → magias iniciais | PHB |
| Aplicar bónus de raça | Escrita automática nos atributos (ou sugestão) a partir da raça escolhida | PHB |
| Equipamento inicial | Importar pacotes da classe/background via API | PHB / API |
| Várias campanhas | `campaignId` em ficha, mesa e histórico; troca de campanha na UI | Produto |
| Notas de sessão | Data, resumo, XP, ligação ao registo do histórico de combate | Produto |
| Impressão / PDF | `@media print` — ficha numa ou duas páginas | Produto |
| Partilha leitura | Export JSON + instrução (sem servidor) para jogador consultar | Produto |

**Critério de aceite:** personagem novo criado em &lt; 15 min só no app; duas campanhas não misturam dados.

---

### v3.4 — Explorador e polimento

| Item | Descrição | Fonte |
|------|-----------|--------|
| Background estilo livro | Tabela + descrição + escolhas (traços, ideais, vínculos, defeitos) com checkboxes | PHB / API |
| Feat estilo livro | Pré-requisitos + descrição; sem colapsos genéricos | PHB / API |
| Subclasse: níveis | Tabela «Nív. → o que ganhas» via `subclass_levels` (como classe) | API |
| Magia no detalhe | Lista de classes/subclasses que aprendem a magia | API |
| Acessibilidade / modo mesa | Revisão de contraste, alvos de toque, `prefers-reduced-motion` | UX |

**Critério de aceite:** qualquer recurso principal da sidebar abre painel legível sem JSON cru visível.

---

## Ordem de desenvolvimento v3

```
v3.0 (ficha combate) → v3.1 (conjuração + descanso profundo)
  → v3.2 (mesa) → v3.3 (criação + campanhas) → v3.4 (explorador restante)
```

Dependências sugeridas:

- **v3.1** beneficia de perícias/salvaguardas (v3.0) para testes de conjuração.
- **v3.2** condições alinhadas com v3.0 (mesma lista na ficha e na mesa).
- **v3.3** assistente reutiliza detalhe livro e escolhas já feitas em classe/background.
- **v3.4** pode correr em paralelo após v3.0, à medida que faltar conteúdo no explorador.

---

## Fora de âmbito v3 (explícito)

- Mapas, tokens, linha de visão (VTT).
- Regras de expansões além do 2014/SRD até haver API.
- Automação total de combate (rolagem de ataque vs CA, dano automático por arma).
- Backend com contas e sync na nuvem (opcional futuro; não bloqueia v3).

---

## Dados: API vs local

| Dado | Fonte |
|------|--------|
| Textos, features, magias, traits, CR, XP monstro | API 2014 |
| Orçamento de encontro | DMG — local |
| XP por nível | PHB — local |
| Slots por classe / multiclasse / pacto | PHB — local |
| Descanso, ambientes | PHB — lógica local |
| Perícias, condições (lista), tesouro ND | PHB/DMG — local (+ API onde existir) |
| Campanhas, encontros guardados, notas | `localStorage` |

---

## Importação automática — classe, raça e PV (análise)

Onde o projeto **já pode** (ou deve) puxar dados da API 2014 e da ficha (`sheet.items`):

| Fonte API | Campos úteis | Uso na ficha hoje / proposto |
|-----------|----------------|------------------------------|
| `GET /classes/{id}` | `hit_die`, `saving_throws[]`, `proficiencies[]`, `proficiency_choices[]`, `starting_equipment[]` | **v3.0+:** botão «Aplicar da classe» → DV (`hitDie`), salvaguardas prof., perícias fixas; equipamento inicial → inventário (v3.3) |
| `GET /classes/{id}/levels` | `features`, `class_specific`, spellcasting por nível | Já no explorador; **v3.1:** slots/preparadas; **futuro:** sugerir PV por nível somando `hit_die` + CON |
| `GET /races/{id}` | `ability_bonuses[]`, `traits[]`, `subraces` | **v3.3:** bónus de atributo; traits já em detalhe livro |
| `GET /subraces/{id}` | `ability_bonuses`, `racial_traits` | Idem raça |
| `GET /backgrounds/{id}` | `personality_traits`, `ideals`, `bonds`, `flaws` (tabelas) | **v3.0:** preencher personalidade; **v3.4:** estilo livro |
| `GET /equipment/{id}` | `weight`, `cost` | **v3.0:** peso no inventário ao importar favoritos |

### Cálculo de PV por nível (PHB)

Regra oficial (resumo):

1. **1º nível:** máximo do dado de vida da classe + modificador de Constituição.
2. **Cada nível seguinte:** 1dDV + mod. CON (ou **média fixa** ⌈DV/2⌉+1 + mod. CON, arredondado para cima na média do dado).
3. **Multiclasse:** um dado de vida por nível de **cada** classe (DV da classe em que sobe); PV máximos = soma ao longo da carreira (implementação completa com várias classes → v3.1/v3.3).

**Estado no código:** `hitDiceMaxForSheet` = nível de personagem (simplificado); `hitDie` manual no select; descanso curto rola `hitDie` + CON. **Próximo passo:** `computeSuggestedHpMax(level, hitDie, conMod)` + botão «Sugerir PV»; opcionalmente preencher `hitDie` a partir da primeira classe na ficha.

---

## Decisões em aberto

1. **Multiclasse** — v3.1 (não adiar além disso se conjuração for prioridade).
2. **Várias campanhas** — v3.3; exige `campaignId` em todo o `localStorage` (migração de dados antigos).
3. **API 2014** — manter até migração futura; não bloquear features v3.
4. **SRD** — textos locais para tesouro, cobertura, descanso em masmorra; API para nomes e descrições oficiais em pt-BR quando disponível.
5. **Preparadas vs conhecidas** — só classes preparadoras (mago, clérigo, druida); lista «conhecidas» para bardo/feiticeiro/bruxo.
6. **Assistente de criação** — fluxo linear obrigatório vs. passos opcionais (permitir saltar para jogadores experientes).

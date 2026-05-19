# Estrutura do projeto — Grimório 5e

App estático (HTML + JS + CSS), sem bundler. As páginas ficam na **raiz** para URLs estáveis no GitHub Pages (`/rpg/sheet.html`, etc.).

## Árvore

```
rpg/
├── index.html              # Explorador API
├── sheet.html              # Ficha de personagem
├── dm.html                 # Mesa do mestre
├── manifest.webmanifest
├── service-worker.js       # PWA (só HTML offline; CSS/JS não passam pelo SW)
├── serve.json
├── assets/
│   ├── css/
│   │   └── styles.css      # Estilos globais
│   └── icons/
│       └── icon.svg
├── js/
│   ├── core/               # Partilhado por todas as páginas
│   │   ├── base-path.js    # <base href>, injeta CSS, appPageHref / appAssetHref
│   │   ├── api-client.js   # Origem e paths da API (`apiListPath`, `apiItemPath`, …)
│   │   ├── shared.js       # localStorage, ficha/mesa, favoritos, apiFetch/apiUrl
│   │   └── pwa-init.js     # Service worker + modo mesa
│   ├── data/               # Tabelas e textos locais (sem DOM)
│   │   ├── spellcasting-data.js
│   │   └── dm-quick-ref-data.js
│   ├── explorer/           # index.html
│   │   ├── script.js
│   │   └── detail-layouts.js
│   ├── sheet/              # sheet.html
│   │   ├── sheet.js
│   │   ├── sheet-v3-combat.js
│   │   ├── sheet-v31-spellcasting.js
│   │   ├── sheet-class-sync.js
│   │   ├── sheet-creation-data.js
│   │   └── sheet-creation-wizard.js
│   ├── dm/                 # dm.html
│   │   ├── dm.js
│   │   ├── dm-v32.js
│   │   └── dm-combat-sync.js
│   └── campaign/           # Várias campanhas (ficha + mesa)
│       ├── campaign-store.js
│       └── campaign-ui.js
└── docs/
    └── STRUCTURE.md        # Este ficheiro
```

## Ordem de scripts (importante)

1. `js/core/base-path.js` — sempre primeiro no `<head>`.
2. `js/data/*` e `js/campaign/campaign-store.js` — antes de `shared.js` se usarem constantes globais.
3. `js/core/api-client.js` — **sempre antes de** `shared.js`.
4. `js/core/shared.js` — modelo de dados, `apiFetch` / `apiUrl`.
5. Módulos da página (`explorer/`, `sheet/`, `dm/`).
6. `js/core/pwa-init.js` — por último.

### API de dados

- Configuração única: `js/core/api-client.js` (`API_BASE`, `API_CATALOG_VERSION`).
- Pedidos HTTP com locale: `apiFetch()` / `apiUrl()` em `shared.js` (aplicam `withActiveApiPath` em URLs guardadas).
- Novo código: usar `apiListPath("recurso")`, `apiItemPath("recurso", "index")`, `buildApiEntryPath({ … })` — não hardcodar `/api/2014`.
- Migração futura: alterar `API_CATALOG_VERSION` (e adaptadores JSON por domínio na ficha/explorador/mesa).

## Onde alterar o quê

| Queres… | Pasta / ficheiro |
|--------|-------------------|
| Estilos globais | `assets/css/styles.css` (+ subir `APP_ASSET_VERSION` em `base-path.js`) |
| Nova regra PHB local | `js/data/` |
| Detalhe «estilo livro» no explorador | `js/explorer/detail-layouts.js` |
| Lógica da ficha | `js/sheet/` |
| Mesa / iniciativa / XP | `js/dm/` |
| Campanhas / storage | `js/campaign/` + `shared.js` |
| PWA / cache | `service-worker.js`, `pwa-init.js` |

## Convenções

- **Sem módulos ES6** (`import`/`export`): scripts globais na ordem do HTML.
- **Nomes de ficheiro**: `kebab-case.js`; prefixo `sheet-` / `dm-` para subdomínios da página.
- **Novos ficheiros JS**: colocar na pasta da área; registar o `<script>` na página HTML correspondente.
- **Componentes**: neste projeto = ficheiros JS por domínio (não React). HTML das páginas continua em `*.html` na raiz.

## Deploy

Commit de `assets/`, `js/` e HTML na raiz. O `base-path.js` resolve `/rpg/` no GitHub Pages automaticamente.

# Grimório 5e

App estático (HTML + CSS + JS) para explorar a [D&D 5e API](https://www.dnd5eapi.co), ficha de personagem e mesa do mestre — **Grimório 5e**.

## Desenvolvimento local

```bash
npm install
npm start
```

Abre no browser:

- **http://localhost:3000/** — explorar API (`index.html`)
- **http://localhost:3000/sheet.html** — ficha
- **http://localhost:3000/dm.html** — mesa do mestre

Usa sempre a porta **3000** (definida no script). Se der erro de porta ocupada, fecha o outro processo ou corre `npx serve . -l 3001` e abre essa porta.

> **Nota:** O `serve` pode aceitar URLs curtas (`/dm`, `/sheet`). Com o `js/core/base-path.js`, CSS e JS carregam com paths em `assets/` e `js/`. Se algo falhar, abre o ficheiro `.html` completo na URL.

Ver **[docs/STRUCTURE.md](docs/STRUCTURE.md)** para a árvore de pastas e onde colocar código novo.

## GitHub Pages

O site publica em **`https://eliabegai.github.io/rpg/`** (repositório `rpg`).

### Configuração no GitHub

1. **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `master` (ou `main`) → pasta **`/ (root)`**
4. Guardar e esperar 1–2 minutos

### Estrutura

| Pasta / ficheiro | Função |
|------------------|--------|
| `index.html`, `sheet.html`, `dm.html` | Páginas (raiz — URLs do Pages) |
| `js/core/` | `base-path.js`, `shared.js`, `pwa-init.js` |
| `js/explorer/`, `js/sheet/`, `js/dm/` | Lógica por página |
| `js/campaign/` | Várias campanhas |
| `js/data/` | Tabelas PHB/DMG locais |
| `assets/css/styles.css` | Estilos globais |
| `docs/STRUCTURE.md` | Mapa completo do projeto |

### Se CSS ou JS não carregarem

- Confirma que abres **`…/rpg/`** (com barra final) e não só o domínio sem o nome do repo.
- Em **localhost** o service worker fica desativado de propósito (evita cache antigo durante desenvolvimento).
- O CSS é injetado por `base-path.js` com URL absoluta e `?v=…` (não passa pelo service worker).
- No **GitHub Pages**, após deploy: um refresh normal basta. Se ainda falhar uma vez: DevTools → Application → Service Workers → *Unregister* + limpar *Cache storage*, depois recarregar.
- No DevTools → **Network**, verifica se `assets/css/styles.css` e `js/core/shared.js` respondem **200** (não 404).
- Confirma que **todos** os ficheiros acima estão commitados e pushed para `master`.

### API

As requisições vão para `https://www.dnd5eapi.co` (catálogo SRD **2014**, CORS permitido). Não é preciso backend neste repositório.

Paths e origem estão centralizados em `js/core/api-client.js` (`apiListPath`, `apiItemPath`, `buildApiEntryPath`). Para migrar de API no futuro, altera `API_BASE` e `API_CATALOG_VERSION` nesse ficheiro e adapta os parsers JSON por módulo (explorador, ficha, mesa).

## SEO (aparecer no Google)

O projeto já inclui:

- **Títulos e meta descriptions** em cada página (`index.html`, `sheet.html`, `dm.html`)
- Tags **Open Graph** e **Twitter** para partilhas
- **`robots.txt`** e **`sitemap.xml`** (ajusta o domínio em `sitemap.xml` se o URL do Pages mudar)
- Texto visível no rodapé da página inicial com palavras-chave naturais

### O que podes fazer a seguir

1. **Google Search Console** — adiciona a propriedade `https://eliabenextil.github.io/rpg/` e envia o sitemap (`/rpg/sitemap.xml`).
2. **Conteúdo** — cada página tem um `<h1>` único com “Grimório 5e”; evita títulos duplicados noutros sites.
3. **Links** — partilha o link em redes ou fóruns de RPG; backlinks ajudam.
4. **Tempo** — sites novos podem demorar dias ou semanas a ser indexados.
5. Se mudares o URL do GitHub Pages, atualiza `canonical`, `og:url` e `sitemap.xml` em todas as páginas.

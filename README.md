# Grimório 5e

App estático (HTML + CSS + JS) para explorar a [D&D 5e API](https://www.dnd5eapi.co), ficha de personagem e mesa do mestre — **Grimório 5e**.

## Desenvolvimento local

```bash
npm install
npm start
```

Abre `http://localhost:3000` (ou a porta que o `serve` indicar).

## GitHub Pages

O site publica em **`https://eliabegai.github.io/rpg/`** (repositório `rpg`).

### Configuração no GitHub

1. **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `master` (ou `main`) → pasta **`/ (root)`**
4. Guardar e esperar 1–2 minutos

### Ficheiros importantes na raiz

Não é obrigatório mover ficheiros para subpastas. O GitHub Pages serve bem HTML/CSS/JS na raiz do repositório.

| Ficheiro | Função |
|----------|--------|
| `.nojekyll` | Desativa o Jekyll — evita que o build ignore ou altere ficheiros estáticos |
| `base-path.js` | Ajusta `<base href>` para `/rpg/` no GitHub Pages |
| `index.html`, `sheet.html`, `dm.html` | Páginas da app |
| `shared.js`, `script.js`, … | Lógica e chamadas à API |

### Se CSS ou JS não carregarem

- Confirma que abres **`…/rpg/`** (com barra final) e não só o domínio sem o nome do repo.
- Faz um refresh forçado (Ctrl+Shift+R / Cmd+Shift+R).
- No DevTools → **Network**, verifica se `styles.css`, `shared.js` e `script.js` respondem **200** (não 404).
- Confirma que **todos** os ficheiros acima estão commitados e pushed para `master`.

### API

As requisições vão para `https://www.dnd5eapi.co` (CORS permitido). Não é preciso backend neste repositório.

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

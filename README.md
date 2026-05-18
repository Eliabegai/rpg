# D&D 5e — Mesa e explorador da API

App estático (HTML + CSS + JS) para explorar a [D&D 5e API](https://www.dnd5eapi.co), ficha de personagem e mesa do mestre.

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

# Plano reutilizável: AdSense (+ opcional GA4) em qualquer projeto

Usa o mesmo Publisher ID em todos os sites: `ca-pub-9928851087671550`.

Objetivo: ao abrir um projeto novo (ou existente), seguir este checklist e ficar pronto para verificação/revisão no AdSense.

---

## Decisão rápida (antes de tocar no código)

| Situação do host | O que fazer |
|------------------|-------------|
| `eliabegai.github.io/NOME/` (project page) | Script AdSense apenas em páginas com conteúdo editorial suficiente. `ads.txt` **já** está na raiz (`Eliabegai.github.io`). Não precisas de outro `ads.txt` no repo do projeto. |
| Domínio próprio (`meusite.com`) | Script somente nas páginas monetizadas + `ads.txt` na **raiz do domínio** + adicionar o site no AdSense. |
| `alguma.coisa.vercel.app` | Igual: script nas páginas elegíveis + `ads.txt` na raiz do hostname que o AdSense regista. Preferível domínio próprio depois. |

**Regra de ouro:** o AdSense regista o **domínio de topo** (`eliabegai.github.io`), não o path `/rpg/`. A raiz do domínio deve responder 200, ter conteúdo próprio e disponibilizar o `ads.txt`. Não coloque AdSense em redirecionamentos, páginas de privacidade, telas vazias ou ferramentas sem conteúdo editorial.

Site raiz já existindo: [Eliabegai/Eliabegai.github.io](https://github.com/Eliabegai/Eliabegai.github.io)  
Conteúdo mínimo da raiz: `index.html` editorial + `ads.txt`. O script AdSense pode ficar somente no projeto monetizado.

---

## Fase 0 — Conta AdSense (uma vez; já feito)

1. Conta AdSense ativa com `ca-pub-9928851087671550`.
2. Site `eliabegai.github.io` adicionado (cobre **todos** os projetos em `/qualquer-coisa/`).
3. Raiz publicada e `https://eliabegai.github.io/ads.txt` acessível.

Para um **domínio novo** (não github.io): adicionar o domínio em AdSense → Sites → Novo site e repetir verificação.

---

## Fase 1 — Preparar o projeto (copiar padrão)

Faz isto **em cada** repositório de app.

### 1.1 Script no `<head>` (obrigatório)

Somente em páginas que tenham conteúdo editorial original e suficiente:

```html
<script
  async
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9928851087671550"
  crossorigin="anonymous"
></script>
```

- **HTML estático:** colar no `<head>` apenas das páginas monetizadas.
- **Next.js (App Router):** carregar em um layout restrito às rotas monetizadas, não necessariamente no layout global.
- **Next.js (Pages):** usar um componente comum somente nas páginas elegíveis.
- **Vite/React SPA:** `index.html` no `<head>` (único entry).

### 1.2 Página de privacidade (recomendado / quase obrigatório para aprovação)

Criar `privacy.html` (ou `/privacy` em Next) em português, a mencionar:

- O que o app guarda (localStorage, cookies, contas, etc.)
- Google AdSense + link para [Definições de anúncios](https://adssettings.google.com/) e [políticas Google](https://policies.google.com/technologies/ads)
- Analytics (se usares GA4)
- Contacto / repo

Linkar no footer: “Política de Privacidade”.

### 1.3 Slot de anúncio (opcional na fase de aprovação)

Na 1.ª fase, mantenha Auto Ads desativado ou limitado enquanto revisa quais páginas são elegíveis. Depois da aprovação, prefira unidades manuais em áreas cercadas por conteúdo do editor.

Depois de aprovado, criar unidade Display responsiva e colocar:

```html
<div class="sidebar-ad" aria-label="Publicidade">
  <ins
    class="adsbygoogle"
    style="display: block"
    data-ad-client="ca-pub-9928851087671550"
    data-ad-slot="XXXXXXXX"
    data-ad-format="auto"
    data-full-width-responsive="true"
  ></ins>
  <script>
    (adsbygoogle = window.adsbygoogle || []).push({});
  </script>
</div>
```

Posições seguras: sidebar, rodapé, entre secções de conteúdo. Evitar overlays e áreas de trabalho intensivo (ficha, editor, mesa de jogo).

### 1.4 `ads.txt` no projeto

| Host | Precisa de `ads.txt` no repo do app? |
|------|--------------------------------------|
| Path em `eliabegai.github.io/…` | Não obrigatório (raiz do user site basta). Podes copiar na mesma para redundância. |
| Domínio próprio / Vercel com domínio | **Sim**, ficheiro na **raiz publicada**: `google.com, pub-9928851087671550, DIRECT, f08c47fec0942fa0` |

Nota: no `ads.txt` o ID é `pub-…` (sem o prefixo `ca-`).

### 1.5 GA4 (opcional, mesmo padrão em todos)

No head, placeholder ou ID real:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Uma propriedade GA4 por site (ou streams múltiplos na mesma propriedade). Ligar GA4 ↔ AdSense nas integrações Google quando ambos existirem.

---

## Fase 2 — Checklist por tipo de projeto

### A) HTML estático (como o Grimório)

- [ ] Script AdSense somente em páginas com conteúdo editorial
- [ ] `privacy.html` + link no footer/nav
- [ ] (Opcional) `.sidebar-ad` + CSS
- [ ] (Opcional) `ads.txt` na raiz do repo
- [ ] Commit + push + confirmar no site público (View Source / curl no `<head>`)
- [ ] Auto Ads desativado ou configurado para excluir telas utilitárias

### B) Next.js / React

- [ ] Script em layout restrito às rotas monetizadas
- [ ] Rota `/privacy` + link no footer
- [ ] Se domínio próprio: `public/ads.txt`
- [ ] Confirmar que o HTML servido inclui o script (não só client-only sem SSR/head)
- [ ] Deploy + verificar URL canónica no AdSense

### C) Novo domínio (qualquer stack)

- [ ] DNS / host apontando
- [ ] AdSense → Novo site → esse domínio
- [ ] `ads.txt` em `https://DOMINIO/ads.txt`
- [ ] Script no head
- [ ] Verificar propriedade → Pedir revisão

---

## Fase 3 — Verificar que está “a rodar”

1. `curl -sL https://URL-DO-PROJETO/ | head` → script `ca-pub-9928851087671550` no head.
2. Para domínio registado no AdSense: `curl -sL https://DOMINIO/ads.txt` → linha `google.com, pub-9928851087671550, DIRECT, f08c47fec0942fa0`.
3. Painel AdSense → Sites: status deixa de ser erro de ads.txt (pode demorar 24–48h).
4. Não clicar nos próprios anúncios.

---

## Ordem sugerida ao aplicar noutro projeto (sessão Cursor)

Prompt curto para colar noutro chat/projeto:

```text
Aplica o plano AdSense reutilizável:
- Publisher: ca-pub-9928851087671550
- ads.txt: google.com, pub-9928851087671550, DIRECT, f08c47fec0942fa0
- Script AdSense somente nas páginas com conteúdo editorial suficiente
- Criar política de privacidade + link no footer
- Slot de anúncio opcional comentado até ter data-ad-slot
- GA4 como placeholder comentado
Segue o padrão do Grimório 5e / plano em PLAYBOOK-ADSENSE.md se disponível.
Não faças push sem eu pedir.
```

Passos do agente no outro repo:

1. Identificar stack (HTML vs Next vs outro) e todas as páginas/layouts.
2. Inserir script AdSense.
3. Criar privacidade + links.
4. CSS/`ads.txt` conforme a tabela do host.
5. Resumir URLs a testar após o deploy.

---

## O que NÃO fazer

- Não registar `eliabegai.github.io/pasta/` como site separado (AdSense rejeita path).
- Não apagar o repo `Eliabegai.github.io` enquanto usares project pages.
- Não usar só Auto Ads agressivos em UIs de ferramenta (ficha, combate, editor).
- Não clicar nos teus anúncios.
- Não mudar de host a meio da revisão AdSense sem necessidade.

---

## Evolução (depois de vários projetos a monetizar)

1. Domínio próprio único (ex.: `teusites.com`) com vários paths ou subdomínios.
2. Unificar `ads.txt` nesse domínio.
3. Ligar todos os sites ao mesmo ca-pub; rever Auto Ads por site.
4. Opcional: migrar hosts para Vercel **com** domínio próprio (não só `*.vercel.app`).

---

## Referência rápida de snippets

**ads.txt**

```text
google.com, pub-9928851087671550, DIRECT, f08c47fec0942fa0
```

**Script**

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9928851087671550" crossorigin="anonymous"></script>
```

**URLs da raiz (já devem existir)**

- https://eliabegai.github.io/
- https://eliabegai.github.io/ads.txt

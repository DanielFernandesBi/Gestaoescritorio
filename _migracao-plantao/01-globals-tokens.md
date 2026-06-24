# 01 · `app/globals.css` — diff dos tokens

Substitua **só** os blocos `:root{…}` e `html[data-theme="dark"]{…}` (logo no topo do arquivo,
abaixo do comentário do sistema de design). Todo o resto do `globals.css` fica **idêntico** — as
classes (`.btn.primary`, `.pill.violet`, `.nav-item.active::before`, etc.) já apontam pra essas
variáveis, então o re-skin propaga sozinho.

Mudança-chave: **`--accent` deixa de ser índigo e vira o cobalt-íris `#3f3ae6`** — a cor única da
IA + marca/ação do Plantão. O `--brass` (marrom heritage) é remapeado para **slate frio** (a
direção é "nada de marrom"); sigilo passa a ser sinal slate.

---

## Bloco `:root` — colar no lugar do atual

```css
:root{
  /* Trilho / estrutura escura (navy do Plantão) */
  --rail:#171b25; --rail-2:#1f2433; --rail-3:#2b3450;
  --ink-2:#1f273b; --ink-3:#2b3450;
  /* Títulos / texto forte */
  --ink:#161922;
  /* Superfícies e neutros — base fria */
  --paper:#e9ecf1; --surface:#ffffff; --surface-2:#f4f6f9;
  --line:#e1e6ec; --line-soft:#edf1f5;
  --text:#2d323c; --muted:#616a78; --muted-2:#909aa8;
  /* Accent COBALT-ÍRIS — IA + ações/links/foco/marca */
  --accent:#3f3ae6; --accent-strong:#2e29c4; --accent-soft:#ecebfd; --accent-contrast:#ffffff;
  /* "Brass" remapeado para slate frio — sigilo, detalhes (nada de marrom) */
  --brass:#586173; --brass-soft:#e8ebf1;
  /* Semânticos (semáforo jurídico do Plantão) */
  --red:#c63d31; --red-soft:#fbe7e3;
  --amber:#b07407; --amber-soft:#f7eed5;
  --green:#2f7d57; --green-soft:#e1f0e8;
  --blue:#2f6fc4; --blue-soft:#e7eefa;
  /* Tangerina — evento provisório no Calendar (novo; usado em prazos/audiências) */
  --tang:#d2691e; --tang-soft:#fbeadb;
  /* Nome do cliente em destaque forte (novo opcional) */
  --name:#0e1117;
  /* Raio / elevação / foco — inalterados */
  --radius:12px; --radius-sm:9px; --radius-lg:16px;
  --shadow:0 1px 2px rgba(16,24,40,.06),0 4px 10px rgba(16,24,40,.06),0 14px 26px rgba(16,24,40,.07);
  --shadow-lg:0 2px 4px rgba(16,24,40,.05),0 12px 28px rgba(16,24,40,.12);
  --focus:0 0 0 3px color-mix(in srgb,var(--accent) 32%,transparent);
  /* Grade de 8px — inalterada */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px;
  /* Fontes do Plantão */
  --serif:'Instrument Serif',Georgia,serif;
  --sans:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --mono:'Geist Mono',ui-monospace,'SF Mono',Menlo,monospace;
}
```

## Bloco `html[data-theme="dark"]` — colar no lugar do atual

```css
html[data-theme="dark"]{
  --rail:#0c0f17; --rail-2:#161b27; --rail-3:#222a3c;
  --ink:#eef1f8;
  --paper:#0a0d14; --surface:#141925; --surface-2:#0f1420;
  --line:#242c3c; --line-soft:#1b2230;
  --text:#e7ebf2; --muted:#94a1b3; --muted-2:#6c7889;
  --accent:#8d88ff; --accent-strong:#aaa6ff; --accent-soft:#1d1f3f; --accent-contrast:#0a0d14;
  --brass:#8a94a6; --brass-soft:#1c2230;
  --red:#ef6258; --red-soft:#2a1817;
  --amber:#dca23c; --amber-soft:#281f11;
  --green:#34b483; --green-soft:#11231c;
  --blue:#5f9aea; --blue-soft:#142031;
  --tang:#e08a4a; --tang-soft:#2a1d11;
  --name:#f4f6fb;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 6px 16px rgba(0,0,0,.4);
  --shadow-lg:0 18px 44px rgba(0,0,0,.55);
}
```

---

## Tabela de referência (claro) — o que mudou

| variável | antes (índigo/brass) | depois (Plantão) |
|---|---|---|
| `--rail` | `#10182a` | `#171b25` |
| `--ink` | `#141b2e` | `#161922` |
| `--paper` | `#eceff5` | `#e9ecf1` |
| `--surface-2` | `#f5f7fb` | `#f4f6f9` |
| `--line` / `--line-soft` | `#dce2ec` / `#e8ecf3` | `#e1e6ec` / `#edf1f5` |
| `--text` | `#1b2433` | `#2d323c` |
| `--muted` / `--muted-2` | `#5d6b7e` / `#8a97a8` | `#616a78` / `#909aa8` |
| **`--accent`** | **`#4f46e5`** | **`#3f3ae6`** (cobalt = IA) |
| `--accent-strong` / `-soft` | `#4338ca` / `#eef0fe` | `#2e29c4` / `#ecebfd` |
| `--brass` / `-soft` | `#b08d57` / `#f3ebdd` | `#586173` / `#e8ebf1` (slate) |
| `--red` / `-soft` | `#cf4036` / `#fbeceb` | `#c63d31` / `#fbe7e3` |
| `--amber` / `-soft` | `#bd7708` / `#f8efdb` | `#b07407` / `#f7eed5` |
| `--green` / `-soft` | `#127a54` / `#e3f1ea` | `#2f7d57` / `#e1f0e8` |
| `--blue-soft` | `#e9f0fa` | `#e7eefa` |
| `--serif` | `'Spectral'` | `'Instrument Serif'` |
| `--sans` | `'Inter'` | `'Hanken Grotesk'` |
| `--mono` | `'JetBrains Mono'` | `'Geist Mono'` |
| `--tang` / `--name` | — | novos (`#d2691e` / `#0e1117`) |

---

## 4 ajustes finos opcionais (1 linha cada, "nada de marrom" + nome forte)

No corpo do `globals.css` (fora do `:root`), para fechar a direção:

1. **Wordmark "&" → cobalt** (estava brass):
   `.brand .mark .amp{color:var(--brass)}` → `…{color:var(--accent)}`
2. **Tag de sigilo → slate** (estava marrom hardcoded `#8a6a3a`):
   `.lock{…color:#8a6a3a;background:var(--brass-soft)…}` → `…color:var(--brass);…`
   (e o mesmo em `.pill.brass{…color:#8a6a3a}` → `color:var(--brass)`)
3. **Nome do cliente em destaque mais forte** (opcional):
   `td .name`, `.parte-nome`, `.mini .mt`, `.task .t` usam `var(--ink)`. Para o "bold 800 #0e1117"
   do Plantão, trocar `color:var(--ink)` → `color:var(--name)` e `font-weight:600` → `700/800`
   nesses seletores (puramente estético).
4. **Selo da IA**: onde hoje a automação aparece como `.pill.violet`/`.gate`, ela já fica cobalt
   automaticamente (herdou `--accent`). Sem mudança necessária — a "aura cobalt" passa a valer.

# Tarefa para o Claude Code — re-skin "Plantão"

> Este arquivo é a **instrução de execução**. Os outros `.md` desta pasta (`01`, `02`, `03`) são o
> conteúdo a aplicar; `referencias/` tem os mockups HTML (referência visual, **não** copiar código).

## Contexto
Repo: **DanielFernandesBi/Gestaoescritorio**
Branch base: **`claude/fernandes-advocacia-frontend-b23vud`**
Branch a criar: **`claude/novo-layout`**

É um Next.js (App Router) **token-driven**: `app/globals.css` define `:root` + `[data-theme="dark"]`
e todos os componentes consomem `var(--…)`. O objetivo é um **re-skin visual** ("Plantão": cobalt-íris
como cor única da IA + marca, fontes Instrument Serif / Hanken Grotesk / Geist Mono, semáforo jurídico
frio, nada de marrom) **sem alterar lógica, dados, queries ou estrutura de componentes**.

## Faça exatamente isto

1. `git checkout claude/fernandes-advocacia-frontend-b23vud && git pull`
2. `git checkout -b claude/novo-layout`
3. **`app/globals.css`** — substitua só os blocos `:root{…}` e `html[data-theme="dark"]{…}` pelos
   blocos prontos de **`01-globals-tokens.md`**. Não toque no resto do arquivo (as classes já usam as
   variáveis). Aplique também, se desejado, os 4 ajustes opcionais de 1 linha listados no fim do `01`
   (brass→slate, "&"→cobalt, nome forte) — são puramente estéticos.
4. **`app/layout.tsx`** — troque o `<link>` do Google Fonts pelo de **`02-fonts-layout.md`**. Nada
   mais nesse arquivo muda.
5. `npm install && npm run dev` — valide **tema claro e escuro** (botão de tema). Confira que:
   - acentos/links/foco/selos da IA ficaram **cobalt `#3f3ae6`**;
   - títulos e números grandes em **Instrument Serif**; CNJ/datas em **Geist Mono**; nomes em
     **Hanken Grotesk** (peso 800 onde aplicável);
   - semáforo (red/amber/green/blue) e superfícies frias; nenhum marrom remanescente (se aplicou os
     ajustes opcionais).
6. `git add app/globals.css app/layout.tsx`
7. `git commit -m "feat(ui): re-skin Plantão — cobalt + Instrument/Hanken/Geist"`
8. `git push -u origin claude/novo-layout`
9. Abra PR de `claude/novo-layout` → `claude/fernandes-advocacia-frontend-b23vud`.

## Escopo — limites
- **NÃO** mude estrutura de componentes, rotas, slot `@modal`, queries Supabase ou lógica.
- **NÃO** adote o split master-detail agora — os mockups mostram esse layout, mas ele é um refactor
  estrutural à parte (drawer atual fica como está). Re-skin de tokens **primeiro**, split em **PR
  separado** depois. Ver caveat no `03-mapa-tela-componente.md`.
- Se for criar os corpos ricos faltantes (`PecaDetalhe.tsx` / `AndamentoDetalhe.tsx`), faça em PR
  próprio — fora deste re-skin.

## Verificação final
Diff deve conter **apenas** `app/globals.css` e `app/layout.tsx` (+ ajustes opcionais no mesmo
`globals.css`). Qualquer outro arquivo no diff = fora de escopo.

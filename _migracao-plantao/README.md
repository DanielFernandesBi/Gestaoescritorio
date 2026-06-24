# Pacote de migração — "Plantão" → repo Gestaoescritorio

Re-skin visual **sem tocar em lógica/dados/queries**. O repo já é token-driven
(`app/globals.css` define `:root` + `[data-theme=dark]`; os componentes só consomem
`var(--…)`). Logo, mudar a aparência = **remapear os valores das variáveis** + **trocar as fontes**.
Nenhum componente `.tsx` precisa mudar de estrutura.

## Alcance: 2 arquivos
1. `app/globals.css` — bloco `:root` e `html[data-theme="dark"]` + as 3 linhas de fonte
   (`--serif`/`--sans`/`--mono`).  → ver `01-globals-tokens.md`
2. `app/layout.tsx` — o `<link>` do Google Fonts (Spectral/Inter/JetBrains → Instrument
   Serif/Hanken Grotesk/Geist Mono).  → ver `02-fonts-layout.md`

Mais 4 ajustes finos de 1 linha (wordmark "&" e tag de sigilo passam a cobalt/slate em vez
de brass) estão no fim do `01`. Opcionais, mas fecham a direção "nada de marrom".

## Referências visuais (pasta `referencias/`)
- **`referencias/telas/`** — 22 telas gerais de módulo (Painel, Validação, Agenda, Financeiro,
  listas, etc.).
- **`referencias/detalhe/`** — 12 corpos de detalhe (o que abre no drawer / rota `[id]`).

São **referência visual** (o alvo de cada página/corpo: dados + cruzamento IA + estados vazios +
ações), **não** código pra colar. O `03-mapa-tela-componente.md` liga cada uma ao arquivo real do
repo. **Não foram incluídas** (obsoletas/rascunho): `Ritual Matinal` (substituída pelo Painel),
`Detalhe - 3 propostas` e `Detalhe - tipos` (explorações já resolvidas).

> Importante: o que **sobe de fato neste PR** é só o diff de tokens (2 arquivos). Ele re-skina
> automaticamente **todas** essas telas e corpos que já existem no repo. As referências servem para
> (a) conferir o resultado e (b) guiar o trabalho de componente dos blocos novos (cruzamento IA,
> estados vazios, ações, split) — que é PR à parte.

## Como aplicar e subir (passo a passo)

Você (ou o Claude Code no repo) faz:

```bash
# 1. no clone do repo, partindo da branch atual
git checkout claude/fernandes-advocacia-frontend-b23vud
git pull
git checkout -b claude/novo-layout

# 2. editar os 2 arquivos conforme 01 e 02 (copiar/colar os blocos prontos)
#    app/globals.css  e  app/layout.tsx

# 3. conferir local
npm install
npm run dev        # abrir e validar claro + escuro (botão de tema)

# 4. subir
git add app/globals.css app/layout.tsx
git commit -m "feat(ui): re-skin Plantão — tokens cobalt + Instrument/Hanken/Geist"
git push -u origin claude/novo-layout
```

Depois é só abrir o PR de `claude/novo-layout` → branch atual no GitHub e revisar o preview.

> Não tenho acesso de escrita ao GitHub (só leitura), por isso entrego o pacote pronto em vez de
> commitar direto. Se preferir, dá pra acionar o **Handoff to Claude Code** apontando para este
> `_migracao-plantao/` — ele aplica os 2 arquivos no clone e abre a branch por você.

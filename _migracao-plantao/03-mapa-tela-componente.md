# 03 · Mapa tela → componente real

As referências estão em duas pastas:
- **`referencias/telas/`** — 22 telas gerais de módulo (Painel, Validação, Financeiro, listas, etc.).
- **`referencias/detalhe/`** — 12 corpos de detalhe (o que abre no drawer/rota `[id]`).

## A. Telas gerais → rota / componentes

Cada `referencias/telas/<Nome>.dc.html` é o alvo visual da página do módulo. Rotas seguem a convenção
Next.js `app/(app)/<modulo>/page.tsx`, que compõe os componentes de `components/modules/*` +
`components/AppShell.tsx` (nav navy compartilhado) + `Topbar`/cards. Nomes de componente específicos:
confira no repo — abaixo vão a rota (alta confiança) e os componentes que vi na árvore.

| Tela geral (referência) | Rota | Componentes-chave |
|---|---|---|
| Painel (dashboard / ritual matinal) | `app/(app)/page.tsx` ou `app/(app)/painel/page.tsx` | `components/modules/*` (KPIs, filas do dia), `AppShell` |
| Validação | `app/(app)/validacao/page.tsx` | fila de validação + `Acao.tsx` |
| Agenda | `app/(app)/agenda/page.tsx` | `vw_agenda_semana` |
| Varredura (lista/ciclos) | `app/(app)/varredura/page.tsx` | `VarreduraItens.tsx`, `AnomaliaRow.tsx` |
| Intimações (lista) | `app/(app)/intimacoes/page.tsx` | módulo de intimações |
| Andamentos | `app/(app)/andamentos/page.tsx` | `AndamentosTimeline/Modulo/OrfaosList.tsx` |
| Triagem · órfãos | `app/(app)/triagem/page.tsx` | listas de órfãos |
| Alertas | `app/(app)/alertas/page.tsx` | — |
| Processos (lista) | `app/(app)/processos/page.tsx` | tabela de processos |
| Clientes (lista) | `app/(app)/clientes/page.tsx` | tabela de clientes |
| Execução penal | `app/(app)/execucao/page.tsx` | `ExecucaoCliente.tsx` |
| Estudos de caso (lista) | `app/(app)/estudos/page.tsx` | `EstudoDetalhe.tsx`, `AtestadoForm.tsx` |
| Documentos & Modelos | `app/(app)/documentos/page.tsx` | — |
| Duplicados | `app/(app)/duplicados/page.tsx` | mesclagem / tombstone |
| Prazos | `app/(app)/prazos/page.tsx` | tabela de prazos |
| Audiências (lista) | `app/(app)/audiencias/page.tsx` | tabela de audiências |
| Tarefas | `app/(app)/tarefas/page.tsx` | kanban/lista de tarefas |
| Produção · peças | `app/(app)/producao/page.tsx` | kanban de peças |
| Financeiro | `app/(app)/financeiro/page.tsx` | `vw_financeiro_pendente` |
| Contratos (lista) | `app/(app)/contratos/page.tsx` | tabela de contratos |
| Auditoria | `app/(app)/auditoria/page.tsx` | log append-only |
| Sistema · evolução | `app/(app)/sistema/page.tsx` | — |

> **Não migrar** (ficaram fora do bundle de propósito): `Ritual Matinal.dc.html` (obsoleta —
> substituída pelo Painel), `Detalhe - 3 propostas.dc.html` e `Detalhe - tipos.dc.html` (explorações
> de layout já resolvidas). Se aparecerem rotas obsoletas no repo (ex.: `/ritual-matinal`), apontar
> para o Painel.

## B. Corpos de detalhe → componente real

Cada mockup `referencias/detalhe/Detalhe <Tipo> (completo).dc.html` ↔ os arquivos reais do repo
que renderizam aquele detalhe. Use como **checklist de conteúdo** (o corpo do componente já tem a
maior parte; o que os mockups acrescentam é o **bloco de cruzamento IA**, os **estados vazios** e a
barra de **ações de 1 clique** — ver coluna "o que o mockup acrescenta").

| Mockup (referência) | Componente de detalhe | Página / rota | Modal interceptado |
|---|---|---|---|
| Detalhe Cliente | `components/detalhe/ClienteDetalhe.tsx` (+ `ExecucaoCliente.tsx`) | `app/(app)/clientes/[id]/page.tsx` | `@modal/(.)clientes/[id]/page.tsx` |
| Detalhe Intimação | `components/detalhe/IntimacaoDetalhe.tsx` | `app/(app)/intimacoes/[id]/page.tsx` | `@modal/(.)intimacoes/[id]/page.tsx` |
| Detalhe Prazo | `components/detalhe/PrazoDetalhe.tsx` | `app/(app)/prazos/[id]/page.tsx` | `@modal/(.)prazos/[id]/page.tsx` |
| Detalhe Audiência | `components/detalhe/AudienciaDetalhe.tsx` | `app/(app)/audiencias/[id]/page.tsx` | `@modal/(.)audiencias/[id]/page.tsx` |
| Detalhe Peça | *(kanban; sem `PecaDetalhe.tsx` próprio)* | `app/(app)/producao/page.tsx` | — |
| Detalhe Contrato | `components/detalhe/ContratoDetalhe.tsx` | `app/(app)/contratos/[id]/page.tsx` | `@modal/(.)contratos/[id]/page.tsx` |
| Detalhe Andamento | `components/modules/AndamentosTimeline.tsx` · `AndamentosModulo.tsx` · `AndamentosOrfaosList.tsx` | `app/(app)/andamentos/page.tsx` | — |
| Detalhe Varredura | `components/detalhe/VarreduraItens.tsx` · `AnomaliaRow.tsx` | `app/(app)/varredura/[tipo]/page.tsx` | `@modal/(.)varredura/[tipo]/page.tsx` |
| Detalhe Compromisso | `components/detalhe/CompromissoDetalhe.tsx` | `app/(app)/compromissos/[id]/page.tsx` | `@modal/(.)compromissos/[id]/page.tsx` |
| Detalhe Estudo de caso | `components/detalhe/EstudoDetalhe.tsx` (+ `AtestadoForm.tsx`) | `app/(app)/estudos/page.tsx` | — |
| *(ref.)* Tarefa | `components/detalhe/TarefaDetalhe.tsx` | `app/(app)/tarefas/[id]/page.tsx` | `@modal/(.)tarefas/[id]/page.tsx` |
| *(ref.)* Processo | `components/detalhe/ProcessoDetalhe.tsx` | `app/(app)/processos/[id]/page.tsx` | `@modal/(.)processos/[id]/page.tsx` |

> "Peça" e "Andamento" não têm um `…Detalhe.tsx` dedicado hoje — vivem no kanban (`producao`) e nos
> módulos de andamentos. Se quiser o corpo de detalhe rico como nos mockups, é criar
> `PecaDetalhe.tsx` / `AndamentoDetalhe.tsx` no mesmo padrão dos demais (refactor pequeno, opcional —
> fora do escopo do re-skin de tokens).

## ⚠ Caveat importante: layout do detalhe
O repo hoje abre detalhe num **drawer** (painel à direita, via `@modal` interceptando a rota +
`components/Drawer.tsx`/`RouteModal.tsx`). Os mockups usam o **split master-detail** (lista colapsa
à esquerda, detalhe ocupa o resto). São coisas independentes:

- **O diff de tokens (este pacote) re-skina o que já existe** — drawer incluso — sem mexer na
  estrutura. É seguro subir primeiro e já entrega o visual Plantão (cobalt + fontes + semáforo).
- **Adotar o split master-detail é um refactor estrutural à parte** (mexe em `layout.tsx` do grupo
  `(app)`, no slot `@modal` e no `Drawer`). Recomendo fazer depois, em PR separado, usando os
  mockups como alvo visual. Não misturar com o re-skin pra manter o diff revisável.

## O que cada mockup acrescenta (além do que o componente já mostra)
- **Bloco de cruzamento IA** (aura cobalt + selo): providência→peça, escalonamento, diagnóstico_oab,
  identidade resolvida, gate da minuta, objetivos×instrumento, etc.
- **Estados vazios** explícitos em cada seção vinculada (ex.: "Sem audiências designadas · Nova").
- **Barra de ações de 1 clique** ao pé (Validar / Calendar / Criar peça / Promover órfã / Dar baixa).
- **Regra "nunca DELETE"** como nota de status em cada corpo.
- **Faixa Assistente cobalt** acima das ações (Claude sempre acessível no contexto do registro).

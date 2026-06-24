# HANDOFF — Redesign estrutural (chat novo)

> Leia este arquivo **inteiro** antes de tocar em qualquer código. Ele é a fonte de
> verdade do trabalho. Os outros `.md` desta pasta (`01`, `02`, `03`, `README`,
> `CLAUDE_CODE_TASK`) e a pasta `referencias/` são **insumo**, não ordem de execução.

---

## 1. O objetivo (o que ESTE trabalho é)

**Redesign estrutural do app, uma tela por vez**, levando cada tela real para o alvo
visual e de conteúdo dos mockups "Plantão" — com validação do usuário **entre cada tela**.

Estrutural = não é só cor. É: o **bloco de cruzamento IA** (providência→peça,
escalonamento, identidade resolvida, gate da minuta…), os **estados vazios** explícitos,
a **barra de ações de 1 clique**, a faixa **Assistente**, e — onde o usuário aprovar — o
layout **master-detail split**. Tudo isso plugado nos dados, queries e segurança REAIS
do repo.

## 2. O que ESTE trabalho NÃO é

- **Não é** o re-skin de 2 arquivos descrito em `CLAUDE_CODE_TASK.md` / `README.md`.
  Aquele é o **re-skin de tokens cobalt** (Plano A), e ele **já existe** na branch
  `claude/novo-layout`. Não refazer. Use os arquivos `01`/`02` apenas como **tabela de
  valores de cor/fonte** se e quando o usuário decidir aplicar a pele cobalt.
- **Não é** colar HTML dos mockups. Os `.dc.html` são **referência visual**, gerados por
  um Claude Design que **não conhece o codebase real**. Nenhuma linha deles vai pro app
  literalmente.
- **Não é** um PR gigante. É **uma tela por commit/validação**.

## 3. Estado do git (confira com `git log`/`git branch -a` antes de começar)

| Ref | O que é | Regra |
|---|---|---|
| `release/v1.0` | Volta absoluta, intacta | **Nunca** sobrescrever |
| `v1.0` (`2f31bea`) | Visual antigo, **no ar em produção** | Base do estado atual |
| `claude/novo-layout` (`4248817`) | Pele cobalt (Plano A) guardada | Opcional; não é o foco |
| `claude/funny-fermat-tdbaqv` | Branch de trabalho atual (espelha v1.0) | Onde está este handoff |

**Crie uma branch nova por frente de trabalho** a partir do estado de produção atual
(`git checkout claude/funny-fermat-tdbaqv && git pull && git checkout -b claude/redesign-<tela>`).
Não trabalhe direto em `release/v1.0` nem force-push em produção.

## 4. Princípios invioláveis

1. **Uma tela por vez.** Implementa → roda local (`npm run dev`) → valida **claro e
   escuro** → mostra ao usuário → só então a próxima. Nunca emende várias telas num
   commit.
2. **Mockup = alvo de intenção, não código.** Leia o `.dc.html` para entender *o que a
   tela deve mostrar e fazer*. Depois implemente **lendo os arquivos reais** do repo.
3. **Manual primeiro.** Antes de editar uma tela, leia o componente real, a página, o
   slot `@modal`, e a(s) query(ies)/view(s) Supabase que a alimentam. Confirme os campos
   que existem de verdade.
4. **Cruzamentos IA usam dados reais.** Os blocos de cruzamento dos mockups só entram se
   houver dado/relacionamento real por trás. Se não houver, é estado vazio honesto — não
   invente campo.
5. **Nunca DELETE.** Toda baixa é status/tombstone, como já é a regra do sistema. Os
   mockups repetem isso de propósito.
6. **Segurança e sigilo.** Respeite RLS, o selo de sigilo e os papéis. Não exponha dado
   sensível para fechar um layout.
7. **Diff revisável.** Só os arquivos da tela em questão. Refactor estrutural grande
   (ex.: adotar master-detail no grupo `(app)`) é **PR separado** — não misture com
   conteúdo de uma tela.

## 5. Como usar as referências (`referencias/`)

- `referencias/telas/` — 22 telas de módulo (alvo da página inteira).
- `referencias/detalhe/` — 12 corpos de detalhe (o que abre no drawer / rota `[id]`).
- `03-mapa-tela-componente.md` liga cada mockup ao **arquivo real** do repo. O mapa foi
  **conferido contra o repo**: as rotas e os `components/detalhe/*Detalhe.tsx` batem.
  Exceções reais: **Peça** e **Andamento** não têm `…Detalhe.tsx` dedicado hoje (vivem no
  kanban `producao` e nos módulos de `andamentos`) — criar corpo rico é opcional, PR à
  parte.
- **Não migrar** (obsoletos): `Ritual Matinal` (substituído pelo **Painel**), `Detalhe -
  3 propostas`, `Detalhe - tipos`. Se aparecer rota `/ritual-matinal`, apontar pro Painel.

O que cada mockup **acrescenta** sobre o que o componente já mostra: bloco de cruzamento
IA, estados vazios por seção, barra de ações de 1 clique, nota "nunca DELETE", faixa
Assistente cobalt. Use isso como **checklist de conteúdo** por tela.

## 6. A regra de ouro do "spec por componente"

Claude Design ofereceu gerar uma **spec de inserção por componente**. Use assim:

- **APROVEITE o "O QUÊ"** — o contrato de intenção por componente: quais campos, qual
  cruzamento IA, quais estados vazios, quais ações, regra de sigilo. Isso é ótimo: vira
  um checklist verificável contra os dados reais.
- **DESCARTE o "COMO"** — caminhos de arquivo, nomes de prop, trechos de código, "cole
  aqui". Claude Design **chuta** isso (não vê o repo). Seguir ao pé da letra = props
  inexistentes, API alucinada, quebra silenciosa.

Regra prática: a spec dele descreve o **destino**; quem dirige até lá, lendo os arquivos
reais, é o Claude Code **com acesso ao repo**. Trate cada item da spec como "isto a tela
precisa ter" e então **encontre no código real** onde e como isso se liga.

## 7. Processo por tela (o loop)

1. Escolher a tela com o usuário (ou seguir a ordem que ele der).
2. Ler o mockup correspondente → extrair o checklist de conteúdo/ações.
3. Ler os arquivos reais (página, componente, `@modal`, query/view). Mapear o checklist
   para o que existe de verdade.
4. Listar ao usuário: o que dá pra fazer com dado real / o que vira estado vazio / o que
   exige nova query (e perguntar antes de criar query nova).
5. Implementar **só aquela tela**. Rodar local, validar claro+escuro.
6. Commit pequeno e descritivo. Mostrar ao usuário. Esperar OK.
7. Próxima tela.

## 8. Decisões em aberto — confirmar com o usuário ANTES, não assumir

- **Pele cobalt (Plano A) entra junto?** Produção hoje é o visual v1.0. O redesign
  estrutural é **independente** da troca de cor. Default: manter tokens atuais e tratar a
  pele cobalt como decisão separada (`claude/novo-layout` já a tem pronta).
- **Master-detail split agora?** É refactor estrutural do grupo `(app)` + `@modal` +
  `Drawer`. Os mockups mostram o split, mas o drawer atual funciona. Default: manter
  drawer; adotar split só se o usuário pedir, em PR próprio.

Quando em dúvida em qualquer um desses, **pergunte** — não decida sozinho.

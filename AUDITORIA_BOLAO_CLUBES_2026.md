# Auditoria — Bolão Mata‑Mata de Clubes 2026

**Data:** 2026‑07‑28
**Escopo:** repositório `DanielFernandesBi/bolaomundial` (commit `9c067ef`) + projeto Supabase **BolaoMundial** (`gdkndouervhxmjlwxdft`, PostgreSQL 17.6, `ACTIVE_HEALTHY`).
**Método:** leitura do código, extração do schema/funções/triggers/policies em produção, recálculo independente de toda a base de pontos em SQL e **testes empíricos executados no banco dentro de blocos com rollback automático** (nada foi alterado em produção — verificado ao final).

---

## 0. Veredito em uma linha

> A pontuação **histórica está íntegra** (o último bolão real bate 100%), mas o **fluxo novo de pênaltis tem um furo comprovado que zera os pontos de pênaltis** e os **jogos "data a definir" ficam com palpites abertos sem transparência**. Nada do bolão de clubes está no ar ainda — o seed nunca foi rodado —, então dá para corrigir tudo antes de abrir para os jogadores.

### Placar da auditoria

| | Item |
|---|---|
| 🔴 **3** | Bloqueadores — corrigir **antes** de abrir o bolão |
| 🟠 **3** | Regressões / riscos reais |
| 🟡 **4** | Higiene e dívidas pré‑existentes |
| ✅ **7** | Verificações que passaram |

---

## 1. Estado real do sistema (vs. o que o relatório dizia)

O relatório de alterações trazia duas informações desatualizadas:

| Relatório dizia | Realidade em produção |
|---|---|
| §10 — "as 4 migrations e o seed ainda precisam ser executados" | ✅ **As 4 migrations JÁ ESTÃO aplicadas** (colunas `competition`, `has_extra_time`, `leg`, `tie_id`; tabelas `ties` e `tournament_competition_results`; `has_simulator`; funções `calc_podium_points_cv` e `recompute_competition_podium`; trigger `trigger_recompute_competition_podium`). |
| — | ❌ **O seed NÃO foi rodado.** O torneio `mata-mata-clubes-2026` **não existe**. Contagens: `ties` = 0, jogos com `competition` = 0, com `leg` = 0, com `tie_id` = 0, `tournament_competition_results` = 0. |

Torneios em produção (todos com `active = false` — nada aberto no momento):

| id | slug | formato | jogos | palpites | ranking | simulador |
|---|---|---|---|---|---|---|
| 1 | `copa-2026` | groups | 72 | 1798 | 25 | não |
| 2 | `paulistao-2026` | groups | 72 | 730 | 11 | não |
| 4 | `copa-brasil-libertadores-sul-americana` | groups | 1 | **0** | 12 | não |
| 8 | `mundial` | groups | 1 | **0** | 11 | não |
| 9 | `mundial-mata-mata` | groups | 1 | **0** | 11 | não |
| 12 | `mundial-mata-mata-2026` | knockout | 32 | 610 | 20 | **sim** |

---

## 2. 🔴 Bloqueadores

### 🔴 B1 — Os pontos de pênaltis somem quando o admin preenche os pênaltis num segundo salvamento

**Este é o problema mais grave, e ele atinge exatamente o fluxo que o bolão de clubes criou.**

**Causa raiz.** O trigger que recalcula os pontos, em produção, é:

```sql
CREATE TRIGGER trigger_process_match_finished
AFTER UPDATE OF status, score_home, score_away ON public.matches   -- ← pen_home/pen_away FORA da lista
FOR EACH ROW
WHEN ( (new.status='FINISHED' AND old.status<>'FINISHED')
    OR (new.status='FINISHED' AND old.status='FINISHED'
        AND (old.score_home IS DISTINCT FROM new.score_home
          OR old.score_away IS DISTINCT FROM new.score_away)) )   -- ← mudança só nos pênaltis não satisfaz nada
EXECUTE FUNCTION process_match_finished();
```

Um UPDATE que mexe **apenas nos pênaltis** de um jogo já `FINISHED` (placar do tempo normal inalterado) **não satisfaz nenhum dos dois ramos do `WHEN`**. O trigger não dispara e `points_pen` nunca é creditado.

**Por que isso é quase inevitável no bolão de clubes.** O próprio `lib/bracket.ts:90‑96` devolve ao admin o aviso:

> *"Agregado empatado: preencha o placar dos pênaltis da volta (com um vencedor) para definir o classificado."*

Esse aviso, por construção, só aparece **depois** de um salvamento feito sem pênaltis. O admin então volta na linha, digita os pênaltis e salva de novo — e é exatamente esse segundo salvamento que o trigger ignora. O chaveamento avança normalmente (a auto‑progressão roda no server action, fora do banco), o campeão é gravado e o pódio é recalculado — **então parece que deu tudo certo**, enquanto os pontos de pênaltis de todo mundo ficaram zerados.

**Prova empírica** (executada no banco, com rollback). Mesmo palpite, mesmo estado final do jogo, só muda a ordem dos salvamentos:

| Cenário | Resultado |
|---|---|
| **A** — finaliza 1×1; depois volta e preenche pênaltis 4×3 | `points_earned = 0` ❌ |
| **B** — salva placar 1×1 **e** pênaltis 4×3 de uma vez | `points_earned = 10` ✅ |

*(palpite 2×0 no tempo normal — 0 pt — + 4×3 nos pênaltis = placar exato dos pênaltis = 10 pts)*

**Também atinge:** qualquer **correção** de um placar de pênaltis já lançado, e qualquer correção de `extra_time_result` no Mundial. Em ambos os casos os pontos ficam congelados no valor errado.

**Correção (testada — leva o cenário A de `0` para `10`):**

```sql
DROP TRIGGER IF EXISTS trigger_process_match_finished ON public.matches;

CREATE TRIGGER trigger_process_match_finished
AFTER UPDATE OF status, score_home, score_away, pen_home, pen_away, extra_time_result
ON public.matches
FOR EACH ROW
WHEN (NEW.status = 'FINISHED' AND (
     OLD.status            IS DISTINCT FROM NEW.status
  OR OLD.score_home        IS DISTINCT FROM NEW.score_home
  OR OLD.score_away        IS DISTINCT FROM NEW.score_away
  OR OLD.pen_home          IS DISTINCT FROM NEW.pen_home
  OR OLD.pen_away          IS DISTINCT FROM NEW.pen_away
  OR OLD.extra_time_result IS DISTINCT FROM NEW.extra_time_result))
EXECUTE FUNCTION process_match_finished();
```

`process_match_finished` já é idempotente (desconta `old_total` antes de somar `new_total`), então disparar mais vezes é seguro.

---

### 🔴 B2 — Jogos "data a definir" ficam com palpites abertos indefinidamente e **fora da transparência**

A auto‑progressão cria os jogos de quartas/semi/final com `match_date = NULL` (`lib/bracket.ts:176`). E `NULL` desliga **todas** as travas de uma vez:

| Camada | Código | Comportamento com `match_date` NULL |
|---|---|---|
| Server action | `matches/actions.ts:115` | `if (match.match_date && now > ...)` → **não bloqueia** |
| Trigger do banco | `check_prediction_window` | `IF match_start_time IS NULL THEN RETURN NEW` → **não bloqueia** |
| Card do jogo | `match-card.tsx:149` | `isLocked = matchDate ? ... : false` → **aberto** |
| Aba Transparência | `matches/actions.ts:169` | `.lte('match_date', now)` → `NULL` **nunca entra no filtro** |

**Consequência:** entre o fim de uma fase e o momento em que o admin publica a data da fase seguinte, um jogador pode **assistir ao jogo e palpitar depois**, e esse palpite **nunca aparece na aba Transparência** — que é justamente a garantia anti‑fraude do produto ("Garante que nenhum palpite foi alterado depois do início", `matches/page.tsx:216`). O jogo só fecha quando o admin finaliza o placar.

Isso não é um caso de borda: pelo desenho da auto‑progressão, **todo jogo das quartas em diante nasce nesse estado**.

**Correções recomendadas** (as três, em ordem de importância):
1. **Alerta no painel do admin** listando os jogos sem data — a fase seguinte não deve ficar jogável sem data publicada.
2. Em `savePrediction`, **recusar palpite quando `match_date IS NULL` e o jogo já tem placar lançado** (defesa em profundidade), e espelhar a regra no `check_prediction_window`.
3. Incluir os jogos sem data na aba Transparência assim que qualquer jogo da mesma fase/competição tiver começado, para não abrir buraco na auditoria pública.

---

### 🔴 B3 — Corrigir um resultado depois que a fase seguinte já foi criada **trava o chaveamento**

O relatório lista isso como "ajuste manual" (§10), mas o efeito real é pior do que jogos com o time antigo.

Em `lib/bracket.ts`, ao recalcular um confronto já decidido:
- a linha 147 **sempre** atualiza `ties.team_a/team_b` do confronto seguinte com o novo vencedor;
- mas `maybeCreateNextMatches` (linha 167) **desiste** se `ida_match_id`/`volta_match_id` já existem.

Resultado: a tabela `ties` passa a dizer "Time X" enquanto os jogos em `matches` continuam com "Time Y". Quando as pernas dessa fase seguinte terminarem, `goalsFor()` (linha 26) não casa o nome e devolve `null` → o código cai no aviso *"Não consegui casar os times do confronto com as pernas cadastradas"* (linha 73) e **para de avançar para sempre**. Na prática, o chaveamento daquela competição trava e o campeão/vice nunca é gravado automaticamente — ou seja, o **pódio daquela competição não pontua**.

**Correção:** ao detectar divergência entre `ties.team_a/team_b` e os times dos jogos já criados, ou reescrever os times dos jogos seguintes (se ainda não tiverem placar nem palpites), ou retornar um erro explícito dizendo exatamente quais jogos o admin precisa ajustar — nunca seguir em silêncio.

---

## 3. 🟠 Regressões e riscos

### 🟠 R1 — O pódio do jogador sumiu dos torneios mata‑mata sem competição (o Mundial)

`getPodiumData` só monta blocos a partir de jogos com `competition` preenchido. O Mundial (torneio 12) tem `competition = NULL` em todos os 32 jogos → `competitions = []` → em `matches/page.tsx:163` **nenhum card de pódio é renderizado**, e a aba Pódio mostra o vazio *"aparece quando cada competição começar"*.

- Os **20 palpites de pódio** do Mundial continuam no banco e continuam pontuando corretamente (verificado: 0 divergências), mas **os jogadores não conseguem mais vê‑los**.
- `savePodiumPrediction` foi reescrita só para campeão+vice por competição: **não existe mais nenhum caminho no app para um jogador palpitar um pódio com 3º lugar**. Um futuro bolão nos moldes do Mundial nasceria sem a funcionalidade.
- O lado do admin (`PodiumEntry`) continua funcionando — a regressão é só na visão do jogador.

### 🟠 R2 — A unicidade do pódio ficou furada para `competition NULL`

A migration `...000003` derrubou `UNIQUE (user_id, tournament_id)` e colocou `UNIQUE (user_id, tournament_id, competition)`. Como `competition` é anulável e **no Postgres NULLs são distintos entre si**, a nova constraint **não impede múltiplas linhas** de pódio por usuário quando `competition IS NULL`. E `process_tournament_podium` faz `FOR ... IN SELECT ... FROM podium_predictions WHERE tournament_id = NEW.id` — ou seja, **somaria todas as linhas duplicadas**.

Hoje é uma arma carregada e não disparada (nenhum código escreve mais com `competition NULL`), mas o guarda‑corpo que existia foi removido. Correção (PG 15+, o banco é 17):

```sql
ALTER TABLE public.podium_predictions
  DROP CONSTRAINT podium_predictions_user_tournament_competition_key;
ALTER TABLE public.podium_predictions
  ADD  CONSTRAINT podium_predictions_user_tournament_competition_key
  UNIQUE NULLS NOT DISTINCT (user_id, tournament_id, competition);
```

### 🟠 R3 — Erros de escrita do chaveamento são engolidos em silêncio

Em `lib/bracket.ts`, **nenhuma** das escritas checa o erro retornado: o `update` de `ties` (114), o `upsert` de `tournament_competition_results` (126), o `update` do próximo confronto (147) e os dois `insert` de `matches` (180, 195). Se qualquer uma falhar, o admin ainda recebe o toast verde *"avançou — próxima fase gerada"*.

As policies de RLS estão corretas hoje (admin tem INSERT/UPDATE em `ties` e `matches` — verificado), então na prática funciona. Mas uma falha futura (constraint, RLS, rede) seria invisível justamente na operação mais crítica do bolão.

---

## 4. 🟡 Dívidas e higiene (pré‑existentes, não causadas pelas alterações)

### 🟡 H1 — Rankings órfãos inflando o ranking geral

| torneio | linhas de ranking | pontos somados | palpites reais |
|---|---|---|---|
| 4 — `copa-brasil-libertadores-sul-americana` | 12 | **6.956** | 0 |
| 8 — `mundial` | 11 | **4.175** | 0 |
| 9 — `mundial-mata-mata` | 11 | **1.080** | 0 |

São **12.211 pontos** em `tournament_rankings` sem nenhum palpite por trás. Como `/ranking-geral`, `profiles.total_points` e o hall‑of‑fame agregam por soma, esses números aparecem para os jogadores. Provavelmente resíduo de testes — vale limpar ou marcar esses torneios como ocultos.

### 🟡 H2 — Torneios 1 e 2 congelados na escala de pontos antiga

Recalculando todos os palpites com as funções atuais:

| torneio | gravado → recalculado | ocorrências |
|---|---|---|
| 1 | 9 → 10 | 231 |
| 1 | 12 → 15 | 36 |
| 2 | 9 → 10 | 33 |
| 2 | 12 → 15 | 17 |
| 2 | 25 → 30 | 79 |

Isso é **esperado e correto**: são os valores antigos (vitória seca 9, empate seco 12, placar exato 25), congelados antes da migration `...000006`. **Mas é uma armadilha**: se alguém rodar `recalculate_user_points` ou reeditar o placar de um jogo desses torneios, os pontos mudam sozinhos e o histórico/hall‑of‑fame se altera retroativamente. (O `exact_matches` divergente nas 11 linhas do torneio 2 tem a mesma origem: lá o placar exato valia 25.)

### 🟡 H3 — Pontos de pódio invisíveis no ranking

`tournament_rankings.podium_points` não é lido em lugar nenhum do frontend (`grep` em `app/`, `components/`, `lib/`). O jogador vê o total, mas não consegue separar quanto veio dos jogos e quanto veio do pódio — num bolão em que o pódio vale até **195 pts** (3 × 65), isso pesa na percepção de transparência.

### 🟡 H4 — Seed com dados de exemplo

`supabase_seed_mata_mata_clubes_2026.sql` está com os times de exemplo (`Time L1`…`Time L16`) e só a Libertadores descomentada; Sul‑Americana e Copa do Brasil estão comentadas. Precisa dos sorteios reais antes de rodar. O arquivo tem guarda de idempotência (`IF EXISTS ... RAISE NOTICE`), o que é bom.

---

## 5. ✅ O que foi verificado e está correto

1. **Integridade do último bolão real (torneio 12 — Mundial Mata‑Mata 2026): 100%.** Recalculei os 610 palpites com as funções atuais — **0 divergências** em `points_regular`, `points_extra`, `points_pen` e na soma `points_earned`. As 20 linhas de ranking batem exatamente com `soma dos palpites + podium_points`, `exact_matches` bate, e os 20 pódios batem com `calc_podium_points`. **As alterações não corromperam nada do que já estava pontuado.**
2. **`calc_podium_points_cv` implementa a regra combinada corretamente:** campeão exato 40, vice exato 25, consolação 10 por posição trocada; o acerto exato tem prioridade sobre a consolação; e o `IS DISTINCT FROM c` impede que o mesmo time pontue duas vezes.
3. **`recompute_competition_podium` é idempotente de verdade:** `total_points = total_points - podium_points + novo` com `podium_points` guardado à parte. Rodar duas vezes não duplica.
4. **A fiação do chaveamento no seed está certa** — testei o padrão de indexação de array do plpgsql (`ARRAY[]::INT[]` com atribuição em índice 0): o array nasce com bounds `[0:1]` e `semi_id[j/2]` mapeia 0,0,1,1 como esperado. Oitavas → quartas → semi → final ligam corretamente pelos lados `a`/`b`.
5. **RLS está correta** em `ties`, `matches`, `tournament_competition_results` e `podium_predictions`: leitura pública, escrita restrita a admin (`profiles.is_admin`), e cada usuário só escreve o próprio palpite de pódio.
6. **O wizard do card de jogo foi adaptado corretamente:** `has_extra_time !== false` (`match-card.tsx:87`) derruba o passo de prorrogação nos jogos de clubes, deixando 2 passos (normal → pênaltis); a ida (`is_knockout = false`) fica com placar simples; a trava é null‑safe.
7. **A separação Mundial × clubes no admin está correta:** `admin/page.tsx:50` mostra `CompetitionResultsEntry` quando há competições e mantém o `PodiumEntry` antigo (com 3º lugar) para o Mundial. O simulador está corretamente opt‑in — só `mundial-mata-mata-2026` tem `has_simulator = true`.

---

## 6. Plano de ação sugerido

**Antes de abrir o bolão de clubes:**

| # | Ação | Onde |
|---|---|---|
| 1 | Aplicar o trigger corrigido de B1 | migration nova no Supabase |
| 2 | Aplicar o `UNIQUE NULLS NOT DISTINCT` de R2 | mesma migration |
| 3 | Fechar o furo dos jogos sem data (B2) | `matches/actions.ts`, `check_prediction_window`, painel admin |
| 4 | Tratar a divergência de times na correção do chaveamento (B3) | `lib/bracket.ts` |
| 5 | Checar os erros dos `insert`/`update`/`upsert` (R3) | `lib/bracket.ts` |
| 6 | Substituir os times de exemplo pelos sorteios reais e rodar o seed | `supabase_seed_mata_mata_clubes_2026.sql` |

**Quando der:** restaurar o pódio do jogador para torneios sem competição (R1), limpar os rankings órfãos (H1), e exibir `podium_points` no ranking (H3).

**Regra de operação enquanto B1 não for corrigido:** o admin deve digitar **placar e pênaltis juntos, num único salvamento**. Se precisar corrigir um pênalti já lançado, alterar também o placar do tempo normal (salvar, e salvar de volta) para forçar o recálculo — ou rodar `SELECT recalculate_user_points(user_id, tournament_id)` para cada jogador afetado.

---

## 7. Nota sobre o método

Todos os testes de comportamento foram executados **dentro de blocos `DO` encerrados com `RAISE EXCEPTION`**, o que aborta a transação e desfaz tudo — inclusive o DDL do trigger de teste. Confirmado ao final da auditoria: o trigger em produção continua sendo o original, há **0 torneios de teste residuais**, 6 torneios e 3.138 palpites — os mesmos números do início. **Nenhuma alteração foi feita no banco de produção nem no repositório do bolão.**

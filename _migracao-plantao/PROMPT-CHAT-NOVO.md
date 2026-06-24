# Prompt de abertura — colar no primeiro turno do chat novo

---

Vamos fazer o **redesign estrutural do app, uma tela por vez**. Toda a orientação está
versionada no próprio repo.

**Primeiro passo — antes de qualquer código:**
1. Leia `_migracao-plantao/HANDOFF.md` por inteiro. É a fonte de verdade deste trabalho.
2. Confira `git branch -a` e `git log --oneline -5` para entender o estado (produção é o
   visual v1.0; a pele cobalt já está guardada em `claude/novo-layout`; `release/v1.0` é a
   volta absoluta).
3. Folheie `_migracao-plantao/03-mapa-tela-componente.md` e a pasta
   `_migracao-plantao/referencias/` para ver os alvos visuais.

**Regras que não se negociam** (estão detalhadas no HANDOFF, mas resumindo):
- **Uma tela por vez**, validando comigo (claro + escuro) entre cada uma.
- Os mockups `.dc.html` são **alvo de intenção, não código pra colar** — foram gerados por
  um Claude Design que **não conhece o codebase**. Implemente sempre lendo os arquivos
  reais do repo.
- Da spec por componente: **aproveite o "o quê"** (campos, cruzamento IA, estados vazios,
  ações) e **descarte o "como"** (paths/props/código que ele chuta).
- **Nunca DELETE**, respeite RLS/sigilo, e mantenha o diff revisável (só a tela da vez).
- Decisões em aberto (aplicar pele cobalt? adotar master-detail split?): **me pergunte**,
  não assuma.

**Não comece a editar ainda.** Depois de ler o HANDOFF, me responda com:
(a) o estado do git como você o entendeu, (b) qual tela você sugere como a primeira e por
quê, e (c) o checklist de conteúdo que você extraiu do mockup dessa tela versus o que o
componente real já mostra. Aí eu aprovo e aí sim você implementa.

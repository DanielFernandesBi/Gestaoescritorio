"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/ui";
import { linkPara } from "@/lib/links";
import { fmtDate, fmtNum, humano } from "@/lib/format";
import type { ProcessoInercia } from "@/lib/queries";
import { FormModal } from "@/components/FormModal";
import { suprimirInercia } from "@/app/actions";

/* Sug. 128 — "Conferi, está andando". Em vez de calar o alarme escondendo o
 * processo, registra quem disse que está tudo bem, por quê e por quanto tempo.
 * Irmão do gesto de apuração humana. */
function ConferiEstaAndando({ p }: { p: ProcessoInercia }) {
  return (
    <FormModal
      label="Conferi — está andando"
      titulo="Tirar da sentinela por um tempo"
      descricao="Você abriu e viu que o processo tramita. Diga por quê e por quanto tempo — fica registrado em consultas_tribunal, e o alarme volta sozinho no fim do prazo."
      acao={suprimirInercia.bind(null, p.id)}
      enviarLabel="Suprimir alarme"
      variant="default"
    >
      <div>
        <label>Por que está andando</label>
        <textarea name="motivo" rows={2} required placeholder="Ex.: parecer do MPF juntado em 15/07 e conclusão ao relator; aguardando decisão." />
      </div>
      <div>
        <label>Silenciar por</label>
        <select name="dias" defaultValue="30">
          <option value="30">30 dias</option>
          <option value="60">60 dias</option>
          <option value="90">90 dias</option>
        </select>
      </div>
      <p className="sub" style={{ margin: 0 }}>
        Não apaga nada e não muda o status do processo. Passado o prazo, se o silêncio
        continuar, ele volta a aparecer aqui.
      </p>
    </FormModal>
  );
}

const procNum = (p: ProcessoInercia) => p.numero_cnj ?? (p.numero_registro ? `reg ${p.numero_registro}` : "sem nº");

/* Um processo em silêncio anômalo — relógio sobre o último movimento real. */
function InerciaCard({ p }: { p: ProcessoInercia }) {
  const alta = p.prioridade === "alta";
  return (
    <article className={`inc-card pri-${p.prioridade}`}>
      <span className="inc-bar" />
      <div className="inc-body">
        <div className="inc-top">
          <div className="inc-id">
            <Link className="inc-num mono" href={linkPara("processo", p.id)}>{procNum(p)} ↗</Link>
            <div className="inc-ctx">
              {[p.area ? humano(p.area) : null, p.instancia ? p.instancia.toUpperCase() : null, p.fase ? humano(p.fase) : null]
                .filter(Boolean)
                .join(" · ") || "—"}
              {p.responsavel ? ` · ${p.responsavel}` : ""}
            </div>
          </div>
          <Pill tone={alta ? "amber" : "gray"} dot={false}>{alta ? "ALTA" : "MÉDIA"}</Pill>
        </div>

        <div className="inc-cli">
          {p.clientes ? <><Icon name="users" size={12} /> {p.clientes}</> : <span className="muted">sem cliente vinculado</span>}
        </div>

        <div className="inc-flags">
          {p.execucao && <span className="inc-tag exec">execução penal</span>}
          {p.preso && <span className="inc-tag preso">réu preso</span>}
          {p.segredo && <span className="inc-tag segredo">🔒 segredo</span>}
          {/* Sug. 128 — episódio já tratado: a T3 não recria tarefa e a T2 não
              redige minuta, mas o processo continua visível aqui. */}
          {p.ja_conferido_neste_episodio && (
            <span className="inc-tag conferido" title={p.conferido_em ? `Conferência concluída em ${fmtDate(p.conferido_em)}, depois da base do relógio.` : undefined}>
              ✓ já conferido neste episódio
            </span>
          )}
        </div>

        <div className="inc-metrics">
          <div className="inc-metric big">
            <b>{fmtNum(p.dias_silencio)}</b>
            <span>dias em silêncio</span>
          </div>
          <div className="inc-metric">
            <b>{fmtNum(p.limiar_dias)}d</b>
            <span>limiar da cadência</span>
          </div>
          <div className="inc-metric">
            <b className="over">+{fmtNum(Math.max(0, p.excedente))}d</b>
            <span>além do limiar</span>
          </div>
          {/* Sug. 127 — DUAS datas, não uma. Chamar a base do relógio de "último
              movimento" era falso: quando só chegou ruído de captura, o movimento
              bruto é posterior e o cartão mentia. */}
          <div className="inc-metric">
            <b className="date">{p.ultima_atividade ? fmtDate(p.ultima_atividade) : "—"}</b>
            <span title={p.base_do_relogio ?? undefined}>base do relógio</span>
          </div>
          {p.ultimo_movimento_bruto && p.ultimo_movimento_bruto !== p.ultima_atividade && (
            <div className="inc-metric">
              <b className="date">{fmtDate(p.ultimo_movimento_bruto)}</b>
              <span title="Último movimento capturado, inclusive o que não zera o relógio por ser eco da nossa própria captura.">
                movimento bruto
                {p.dias_desde_movimento_bruto != null ? ` · há ${fmtNum(p.dias_desde_movimento_bruto)}d` : ""}
              </span>
            </div>
          )}
        </div>

        <div className="inc-acoes">
          <ConferiEstaAndando p={p} />
          <Link className="btn sm abrir" href={linkPara("processo", p.id)}>Abrir processo</Link>
        </div>
      </div>
    </article>
  );
}

export function InerciaView({ processos }: { processos: ProcessoInercia[] }) {
  const [f, setF] = useState<"todos" | "alta" | "execucao">("todos");

  const nAlta = processos.filter((p) => p.prioridade === "alta").length;
  const nExec = processos.filter((p) => p.execucao).length;
  const maxDias = processos.reduce((m, p) => Math.max(m, p.dias_silencio), 0);

  const filtrados = processos.filter((p) =>
    f === "alta" ? p.prioridade === "alta" : f === "execucao" ? p.execucao : true,
  );

  const chips = [
    { id: "todos" as const, label: `Todos (${processos.length})` },
    { id: "alta" as const, label: `Alta · execução/preso (${nAlta})` },
    { id: "execucao" as const, label: `Execução penal (${nExec})` },
  ];

  return (
    <div className="inercia-page">
      <PageHeader
        breadcrumb={["Entrada · IA", "Inércia · silêncio"]}
        eyebrow="Automação · sentinela de ausência"
        titulo="Inércia · silêncio anômalo"
        descricao={
          <>
            Todo o pipeline (DJEN/push/Radar) reage à <b>presença</b> de movimento; esta é a única peça que vigia a{" "}
            <b>ausência</b>. <b>Todo movimento zera o relógio</b>, salvo o que é eco da nossa própria captura —
            disponibilização em diário, decurso de prazo, ato ordinatório, juntada de certidão. Entram os processos{" "}
            <b>ativos com vida</b> cujo silêncio passou do limiar da área/instância. Stub sem vida não entra (é legado da{" "}
            <Link className="link" href="/duplicados">reconciliação de CNJ</Link>). Quando a T4 ou você apuram do que se
            trata um movimento, a sentinela aprende junto — o relógio lê o tipo apurado.
          </>
        }
        acoes={
          <div className="inc-cta" title="Limiar por área/instância vem de config_sistema/mapa_cadencia_inercia, editável pelo Daniel">
            <Icon name="clock" size={14} /> Cadência: HC STJ/STF 45d · STJ/STF 60d · execução 180d · 2º grau 120d · default 90d
          </div>
        }
        kpis={[
          { valor: fmtNum(processos.length), label: "em silêncio", tone: "accent" },
          { valor: fmtNum(nAlta), label: "alta · execução/preso", tone: "red" },
          { valor: fmtNum(nExec), label: "execução penal", tone: "neutral" },
          { valor: maxDias ? fmtNum(maxDias) : "—", label: "maior silêncio (dias)", tone: "neutral" },
        ]}
      />

      <div className="inc-note">
        <span className="ico"><Icon name="shield" size={14} /></span>
        <div>
          No encerramento da varredura, o Cowork abre <b>uma tarefa de conferência</b> por processo daqui
          (motivo <code>inércia</code>, prioridade alta em execução/réu preso) — sem nunca duplicar.
          Elas aparecem em <Link className="link" href="/tarefas">Tarefas</Link> e nas conferências escaladas do{" "}
          <Link className="link" href="/painel">ritual matinal</Link>. Conferida a tarefa, o processo pode voltar a
          alarmar se o silêncio recomeçar.
        </div>
      </div>

      {processos.length > 0 && (
        <div className="inc-filters">
          {chips.map((c) => (
            <button key={c.id} type="button" className={`tk-chip${f === c.id ? " on" : ""}`} onClick={() => setF(c.id)}>
              {c.label}
            </button>
          ))}
          <span className="tk-filter-count mono">{filtrados.length} no filtro</span>
        </div>
      )}

      {processos.length === 0 ? (
        <div className="inc-empty">
          <div className="inc-empty-ico"><Icon name="clock" size={26} /></div>
          <h3>Nenhum processo em silêncio anômalo hoje. 🎉</h3>
          <p>
            Nenhum processo <b>com vida</b> ultrapassou o limiar da sua área/instância. É o esperado enquanto a base
            ainda acumula histórico: a sentinela <b>instala-se antes de precisar</b> e seu valor se compõe à medida
            que os movimentos se acumulam. Stubs sem nenhum movimento ficam de fora por desenho — são{" "}
            <Link className="link" href="/duplicados">legado a reconciliar</Link>, não inércia.
          </p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="inc-empty sm">Nenhum processo neste filtro.</div>
      ) : (
        <div className="inc-list">
          {filtrados.map((p) => <InerciaCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}

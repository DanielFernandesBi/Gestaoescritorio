"use client";

import { useMemo, useState } from "react";
import { Acao } from "@/components/Acao";
import { atualizarSugestao } from "@/app/actions";
import { fmtNum, fmtDate } from "@/lib/format";
import type { Sugestao } from "@/lib/data";

const Spark = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>
);
const Gear = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
);

function StatusBadge({ s }: { s: Sugestao }) {
  if (s.status === "executada") return <span className="sis-badge green">✓ executada{s.decidida_em ? ` · ${fmtDate(s.decidida_em)}` : ""}</span>;
  if (s.status === "aprovada") return <span className="sis-badge blue">APROVADA</span>;
  if (s.status === "rejeitada") return <span className="sis-badge red">rejeitada</span>;
  return <span className="sis-badge amber">PENDENTE</span>;
}

/* Considera "grande" quando o texto + SQL passam de um limiar — aí o corpo nasce
 * recolhido (altura padrão) com botão Expandir. */
function ehGrande(s: Sugestao): boolean {
  const sql = s.sql_proposto ?? "";
  const linhasSql = sql ? sql.split("\n").length : 0;
  return (s.sugestao?.length ?? 0) > 240 || sql.length > 220 || linhasSql > 5;
}

function SugestaoCard({ s }: { s: Sugestao }) {
  const grande = ehGrande(s);
  const [aberto, setAberto] = useState(false);
  const recolhido = grande && !aberto;
  return (
    <article className={`sis-card${s.status === "pendente" ? " pend" : ""}`}>
      <div className="sis-card-h">
        <span className="num">#{s.id}</span>
        <span className="ctx">{s.contexto}</span>
        <span className="sis-ia"><Spark />sugerida pela IA</span>
        <span className="end"><StatusBadge s={s} /></span>
      </div>

      <div className={`sis-body${recolhido ? " recolhido" : ""}`}>
        <div className="sis-desc">{s.sugestao}</div>
        {s.sql_proposto && <pre className="sis-sql">{s.sql_proposto}</pre>}
        {recolhido && <div className="sis-fade" aria-hidden />}
      </div>
      {grande && (
        <button type="button" className="sis-expand" onClick={() => setAberto((v) => !v)}>
          {aberto ? "Recolher ▲" : "Expandir ▼"}
        </button>
      )}

      <div className="sis-foot">
        <span className="note">
          {s.status === "pendente" && "Decisão só registra o status — não executa DDL."}
          {s.status === "aprovada" && "Aprovada por Daniel · aguarda execução autorizada."}
          {s.status === "executada" && <span className="ok">✓ Implementada{s.decidida_em ? ` em ${fmtDate(s.decidida_em)}` : ""}</span>}
          {s.status === "rejeitada" && <>Rejeitada{s.decidida_em ? ` em ${fmtDate(s.decidida_em)}` : ""}</>}
        </span>
        <span className="acts">
          {s.status === "pendente" && (
            <Acao label="Aprovar" size="sm" titulo="Aprovar sugestão"
              resumo={<>Marcar a sugestão #{s.id} como <b>aprovada</b>? (não executa DDL — só registra a decisão)</>}
              acao={atualizarSugestao.bind(null, s.id, "aprovada")} />
          )}
          {(s.status === "pendente" || s.status === "aprovada") && (
            <Acao label="Marcar executada" variant="ok" size="sm" titulo="Marcar executada"
              resumo={<>Confirmar que a sugestão #{s.id} já foi <b>executada</b> no banco (DDL registrada em migracoes)?</>}
              acao={atualizarSugestao.bind(null, s.id, "executada")} />
          )}
          {(s.status === "pendente" || s.status === "aprovada") && (
            <Acao label="Rejeitar" variant="danger" size="sm" titulo="Rejeitar sugestão"
              resumo={<>Marcar a sugestão #{s.id} como <b>rejeitada</b>?</>}
              acao={atualizarSugestao.bind(null, s.id, "rejeitada")} />
          )}
          {s.status === "rejeitada" && (
            <Acao label="Reconsiderar" variant="ghost" size="sm" titulo="Reconsiderar sugestão"
              resumo={<>Voltar a sugestão #{s.id} para <b>pendente</b>?</>}
              acao={atualizarSugestao.bind(null, s.id, "pendente")} />
          )}
        </span>
      </div>
    </article>
  );
}

export function SistemaView({
  sugestoes,
  estrutura,
  migracoesCount,
}: {
  sugestoes: Sugestao[];
  estrutura: { tabela: string; registros: number }[];
  migracoesCount: number;
}) {
  const [f, setF] = useState("todas");

  const nPend = sugestoes.filter((s) => s.status === "pendente").length;
  const nAprov = sugestoes.filter((s) => s.status === "aprovada").length;
  const nExec = sugestoes.filter((s) => s.status === "executada").length;

  const filtradas = useMemo(() => sugestoes.filter((s) => f === "todas" ? true : s.status === f), [sugestoes, f]);

  const tabs = [
    { id: "todas", label: `Todas` },
    { id: "pendente", label: `Pendentes (${nPend})` },
    { id: "aprovada", label: `Aprovadas (${nAprov})` },
    { id: "executada", label: `Executadas (${nExec})` },
  ];

  return (
    <div className="sis-page">
      {/* cabeçalho */}
      <div className="sis-head">
        <div className="lhs">
          <div className="eyebrow">Manual vivo · só leitura · DDL com autorização</div>
          <h1>Sistema &amp; evolução</h1>
          <p>
            Quando o sistema precisa de campo, tabela ou view nova, a IA registra a melhoria em <code>sugestoes_sistema</code>{" "}
            com o SQL pronto. Nada é executado aqui: a DDL só roda com autorização do Daniel, registrada em <code>migracoes</code>.
          </p>
        </div>
      </div>

      {/* aviso só-leitura */}
      <div className="sis-banner">
        <span className="ico"><Gear /></span>
        <div><b>Tela só de leitura.</b> Aprovar / executada / rejeitar apenas registra a decisão — nenhuma DDL é executada pela interface.</div>
      </div>

      {/* KPIs */}
      <div className="sis-kpis">
        <div className="sis-kpi accent"><div className="big">{nPend}</div><div className="lbl">pendentes</div></div>
        <div className="sis-kpi"><div className="big">{nAprov}</div><div className="lbl">aprovadas</div></div>
        <div className="sis-kpi"><div className="big">{migracoesCount}</div><div className="lbl">executadas · migrações</div></div>
        <div className="sis-kpi"><div className="big">{estrutura.length}</div><div className="lbl">tabelas no banco</div></div>
      </div>

      {/* tabs */}
      <div className="sis-tabs">
        <div className="tk-chips">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={`tk-chip${f === t.id ? " on" : ""}`} onClick={() => setF(t.id)}>{t.label}</button>
          ))}
        </div>
        <code className="sis-src">sugestoes_sistema</code>
      </div>

      {/* sugestões */}
      {filtradas.length
        ? filtradas.map((s) => <SugestaoCard key={s.id} s={s} />)
        : <div className="sis-empty">Nenhuma sugestão neste filtro.</div>}

      {/* estrutura do banco */}
      <div className="sis-estrutura">
        <div className="sis-est-h">
          <span className="t">Estrutura do banco</span>
          <span className="end mono">{estrutura.length} tabelas · fonte da verdade</span>
        </div>
        <div className="sis-est-grid">
          {estrutura.map((t) => (
            <div className="sis-est-row" key={t.tabela}>
              <span className="tb mono">{t.tabela}</span>
              <span className="n mono">{fmtNum(t.registros)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

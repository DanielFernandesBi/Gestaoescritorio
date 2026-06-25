"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtNum } from "@/lib/format";
import { tipoDeTabela, linkNavegavel } from "@/lib/links";
import type { EventoAuditoriaRico } from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Shield = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6z" /></svg>
);
const Export = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 16V4M7 9l5 5 5-5M5 20h14" /></svg>
);
const Person = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
);
const Spark = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>
);

const opTone = (op: string) => (op === "INSERT" ? "green" : op === "UPDATE" ? "blue" : "red");

function quando(iso: string) {
  const d = new Date(iso), now = new Date();
  const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return hm;
  if (sameDay(d, yest)) return `ontem ${hm}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hm}`;
}

/* origem: cowork (IA) · frontend/chat (humano) · merge/sistema */
function Origem({ o }: { o: string | null }) {
  if (o === "cowork") return <span className="aud-orig ia"><Spark />cowork</span>;
  if (!o || o === "merge" || o === "sistema") return <span className="aud-orig sys">{o ?? "sistema"}</span>;
  return <span className="aud-orig hum"><span className="av"><Person /></span>{o}</span>;
}

function Referencia({ e }: { e: EventoAuditoriaRico }) {
  const tipo = tipoDeTabela(e.tabela);
  const href = tipo && e.registro_id ? linkNavegavel(tipo, e.registro_id) : null;
  const txt = e.referencia ?? "—";
  return href
    ? <Link className="aud-ref" href={href} onClick={(ev) => ev.stopPropagation()}>{txt}</Link>
    : <span className="aud-ref plain">{txt}</span>;
}

const PASSO = 30;

export function AuditoriaView({
  eventos,
  contadores,
  total,
}: {
  eventos: EventoAuditoriaRico[];
  contadores: { eventos24h: number; insert: number; update: number; delete: number };
  total: number;
}) {
  const [tab, setTab] = useState("todas");
  const [op, setOp] = useState("todas");
  const [orig, setOrig] = useState("todas");
  const [visiveis, setVisiveis] = useState(PASSO);

  const tabelas = useMemo(() => [...new Set(eventos.map((e) => e.tabela))].sort(), [eventos]);

  const filtrados = useMemo(() => eventos.filter((e) => {
    if (tab !== "todas" && e.tabela !== tab) return false;
    if (op !== "todas" && e.operacao !== op) return false;
    if (orig === "cowork") return e.origem === "cowork";
    if (orig === "humano") return e.origem === "frontend" || e.origem === "chat";
    if (orig === "sistema") return !e.origem || e.origem === "merge" || e.origem === "sistema";
    return true;
  }), [eventos, tab, op, orig]);

  const resetFiltro = (set: (v: string) => void) => (v: string) => { set(v); setVisiveis(PASSO); };
  const mostrados = filtrados.slice(0, visiveis);

  return (
    <div className="aud-page">
      {/* cabeçalho */}
      <div className="aud-head">
        <div className="lhs">
          <div className="eyebrow">Log imutável · a prova</div>
          <h1>Auditoria</h1>
          <p>
            Toda operação fica registrada por <code>fn_auditar</code> com os dados antes/depois e a origem.{" "}
            <b>Relatório de agente não é prova — a auditoria é.</b> {fmtNum(total)} eventos no total.
          </p>
        </div>
        <button type="button" className="btn"><Export />Exportar período</button>
      </div>

      {/* KPIs */}
      <div className="aud-kpis">
        <div className="aud-kpi"><div className="lbl">Eventos · 24h</div><div className="big">{contadores.eventos24h}</div><div className="cap mono">vw_relatorio_diario</div></div>
        <div className="aud-kpi"><div className="lbl green"><span className="d" />INSERT</div><div className="big">{contadores.insert}</div><div className="cap mono">capturas + cadastros</div></div>
        <div className="aud-kpi"><div className="lbl blue"><span className="d" />UPDATE</div><div className="big">{contadores.update}</div><div className="cap mono">validações + baixas</div></div>
        <div className="aud-kpi"><div className="lbl red"><span className="d" />DELETE</div><div className="big">{contadores.delete}</div><div className="cap mono">bloqueado por fn_bloquear</div></div>
      </div>

      {/* toolbar */}
      <div className="aud-toolbar">
        <label className="pz-select">
          Tabela:
          <select value={tab} onChange={(e) => resetFiltro(setTab)(e.target.value)}>
            <option value="todas">todas</option>
            {tabelas.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="pz-select">
          Operação:
          <select value={op} onChange={(e) => resetFiltro(setOp)(e.target.value)}>
            <option value="todas">todas</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </label>
        <label className={`pz-select${orig === "cowork" ? " on-accent" : ""}`}>
          Origem:
          <select value={orig} onChange={(e) => resetFiltro(setOrig)(e.target.value)}>
            <option value="todas">todas</option>
            <option value="cowork">cowork (IA)</option>
            <option value="humano">humano</option>
            <option value="sistema">sistema</option>
          </select>
        </label>
        <span className="aud-cross">conferência cruzada do ritual matinal · <span className="ok">sem divergência</span></span>
      </div>

      {/* timeline */}
      <article className="aud-log">
        <div className="aud-log-h">
          <Shield /><span className="t">Últimas 24h</span>
          <span className="end mono">append-only · imutável</span>
        </div>
        {mostrados.length ? (
          <table className="aud-table">
            <colgroup><col style={{ width: "12%" }} /><col style={{ width: "15%" }} /><col style={{ width: "12%" }} /><col style={{ width: "39%" }} /><col style={{ width: "22%" }} /></colgroup>
            <thead>
              <tr>
                <th>Quando</th><th>Tabela</th><th>Operação</th><th>Referência</th><th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {mostrados.map((e) => (
                <tr key={e.id}>
                  <td className="aud-when mono">{quando(e.ocorrido_em)}</td>
                  <td><span className="aud-tab mono">{e.tabela}</span></td>
                  <td><span className={`aud-op ${opTone(e.operacao)}`}>{e.operacao}</span></td>
                  <td>
                    <div className="aud-ref-row">
                      <Referencia e={e} />
                      {e.segredo && <span className="aud-lock">🔒</span>}
                    </div>
                    {e.mudancas.length > 0 ? (
                      <div className="aud-diff mono">
                        {e.mudancas.map((m, i) => (
                          <span key={m.campo}>
                            {i > 0 && " · "}
                            {m.campo}: {m.antes} <span className="to">→ {m.depois}</span>
                          </span>
                        ))}
                      </div>
                    ) : e.detalhe ? (
                      <div className="aud-diff mono">{e.detalhe}</div>
                    ) : null}
                  </td>
                  <td><Origem o={e.origem} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="aud-empty">Nenhum evento neste filtro.</div>
        )}
        {filtrados.length > visiveis && (
          <button type="button" className="aud-vermais" onClick={() => setVisiveis((v) => v + PASSO)}>
            ver mais eventos ({filtrados.length - visiveis}) →
          </button>
        )}
      </article>
    </div>
  );
}

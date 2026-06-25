"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Chips } from "@/components/Chips";
import { linkPara } from "@/lib/links";
import { fmtDate, humano } from "@/lib/format";
import type { ProcAcervo, Tombstone } from "@/lib/data";

const PASSO = 20;

// Barra/saúde: fatal≤5 vermelho · parado≥30 mostarda · recurso cobalt · resto slate.
function barra(p: ProcAcervo): string {
  if (p.saude.prox_fatal_dias != null && p.saude.prox_fatal_dias <= 5) return "b-red";
  if (p.saude.dias_parado != null && p.saude.dias_parado >= 30) return "b-amber";
  if (p.processo_origem) return "b-blue";
  return "b-slate";
}
const areaTone = (a: string | null) =>
  a === "criminal" ? "t-red" : a === "execucao_penal" ? "t-amber" : "t-slate";

type Cel = { label: string; value: ReactNode; tone?: "red" | "green" };

function celulas(p: ProcAcervo): Cel[] {
  const s = p.saude;
  const peca = s.pecas_revisao > 0 ? "minuta IA · revisão" : s.pecas_afazer > 0 ? `${s.pecas_afazer} a fazer` : "—";
  if (p.area === "execucao_penal" || s.beneficio_dias != null) {
    return [
      { label: "Benefício", value: s.beneficio_dias != null ? `progressão ${s.beneficio_dias}d` : "—", tone: s.beneficio_dias != null && s.beneficio_dias < 0 ? "red" : undefined },
      { label: "Inércia", value: s.dias_parado != null ? `${s.dias_parado} dias` : "—" },
      { label: "Atestado", value: s.tem_atestado ? "lançado" : "a cadastrar" },
      { label: "Estudo", value: s.estudo_tipo ? humano(s.estudo_tipo) : "—" },
    ];
  }
  if (p.processo_origem) {
    return [
      { label: "Peça", value: peca, tone: s.pecas_revisao > 0 ? "green" : undefined },
      { label: "Sessão", value: s.audiencia ? `${fmtDate(s.audiencia)} · ${s.audiencia_modalidade ?? "—"}` : "—" },
      { label: "Último ato", value: s.ultima_mov ? fmtDate(s.ultima_mov) : "—" },
    ];
  }
  return [
    { label: "Próx. fatal", value: s.prox_fatal ? `${fmtDate(s.prox_fatal)} · ${s.prox_fatal_dias}d` : "—", tone: s.prox_fatal_dias != null && s.prox_fatal_dias <= 2 ? "red" : undefined },
    { label: "Prazos abertos", value: s.prazos_abertos || "—" },
    { label: "Peças", value: peca },
    { label: "Audiência", value: s.audiencia ? `${fmtDate(s.audiencia)} · ${s.audiencia_modalidade === "virtual" ? "virtual" : humano(s.audiencia_tipo ?? "—")}` : "—" },
  ];
}

function acoes(p: ProcAcervo): { label: string; href: string; primary?: boolean }[] {
  const abrir = linkPara("processo", p.id);
  if (p.segredo && !p.numero_cnj) return [{ label: "Abrir processo", href: abrir }];
  if (p.area === "execucao_penal" || p.saude.beneficio_dias != null)
    return [{ label: "Abrir execução", href: abrir, primary: true }, { label: "Requerer progressão", href: abrir }, { label: "Provocar andamento", href: abrir }];
  if (p.processo_origem)
    return [{ label: "Abrir processo", href: abrir, primary: true }, { label: "Ver minuta", href: "/producao" }, { label: "Processo de origem", href: linkPara("processo", p.processo_origem) }];
  return [{ label: "Abrir processo", href: abrir, primary: true }, { label: "Ver prazos", href: "/prazos" }, { label: "Criar peça", href: "/producao" }];
}

function ProcessoCard({ p }: { p: ProcAcervo }) {
  const parado = p.saude.dias_parado != null && p.saude.dias_parado >= 30;
  const ident = p.numero_cnj ?? (p.numero_registro ? `reg ${p.numero_registro} · sem CNJ` : "sem CNJ");
  const minimal = p.segredo && !p.numero_cnj;
  return (
    <article className={`pc-card ${barra(p)}`}>
      <span className="pc-bar" />
      <div className="pc-body">
        <div className="pc-top">
          <span className="pc-status"><span className="pc-dot" /> {humano(p.status)}</span>
          {(p.tribunal || p.vara_comarca) && <span className="pc-trib">{[p.tribunal, p.vara_comarca].filter(Boolean).join(" · ")}</span>}
          {p.area && <span className={`pc-area ${areaTone(p.area)}`}>{humano(p.area)}</span>}
          {parado && <span className="pc-flag amber">parado {p.saude.dias_parado}d</span>}
          {p.processo_origem && <span className="pc-flag cobalt">recurso · origem vinculada</span>}
          {p.segredo && <span className="pc-flag lock">🔒 segredo de justiça</span>}
          <span className={`pc-ident mono${p.numero_cnj ? "" : " reg"}`}>{ident}</span>
        </div>

        <div className="pc-name">
          {minimal && !p.clientes ? "Cliente (sigiloso)" : p.clientes || "Sem cliente vinculado"}
          {p.papel && <span className="pc-papel">{humano(p.papel)}</span>}
          {p.preso && <span className="pc-preso">PRESO</span>}
        </div>
        <div className="pc-caso">{[p.assunto, p.classe, p.instancia ? humano(p.instancia) : null, [p.vara_comarca, p.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "—"}</div>

        {!minimal && (
          <div className="pc-grid">
            {celulas(p).map((c, i) => (
              <div className="pc-cel" key={i}>
                <div className="pc-cel-l">{c.label}</div>
                <div className={`pc-cel-v${c.tone ? " " + c.tone : ""}`}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="pc-foot">
          {acoes(p).map((a, i) => (
            <Link key={i} className={`btn sm${a.primary ? " primary" : ""}`} href={a.href}>{a.label}</Link>
          ))}
        </div>
      </div>
    </article>
  );
}

const CHIPS = [
  { id: "todos", label: "Todos" },
  { id: "criminal", label: "Criminal" },
  { id: "execucao", label: "Execução" },
  { id: "parados", label: "Parados ≥30d" },
  { id: "sigilosos", label: "Sigilosos" },
  { id: "semcnj", label: "Sem CNJ" },
  { id: "arquivados", label: "Arquivados · tombstone" },
];

export function ProcessosList({
  processos,
  tombstones,
  stats,
}: {
  processos: ProcAcervo[];
  tombstones: Tombstone[];
  stats: { ativos: number; parados: number; sigilosos: number; semcnj: number };
}) {
  const [aba, setAba] = useState("todos");
  const [visiveis, setVisiveis] = useState(PASSO);

  const filtradas = useMemo(
    () =>
      processos.filter((p) => {
        switch (aba) {
          case "criminal": return p.area === "criminal";
          case "execucao": return p.area === "execucao_penal" || p.saude.beneficio_dias != null;
          case "parados": return p.saude.dias_parado != null && p.saude.dias_parado >= 30;
          case "sigilosos": return p.segredo;
          case "semcnj": return !p.numero_cnj;
          default: return true;
        }
      }),
    [processos, aba],
  );
  const mostradas = filtradas.slice(0, visiveis);

  const cards = [
    { id: "todos", n: stats.ativos, label: "Ativos · acervo vivo" },
    { id: "parados", n: stats.parados, label: "Parados ≥30d · radar" },
    { id: "sigilosos", n: stats.sigilosos, label: "Sigilosos · segredo" },
    { id: "semcnj", n: stats.semcnj, label: "Sem CNJ · só registro" },
  ];

  return (
    <>
      <div className="stat-row">
        {cards.map((c) => (
          <button key={c.id} type="button" className={`stat${aba === c.id ? " on" : ""}`} onClick={() => { setAba(c.id); setVisiveis(PASSO); }}>
            <b>{c.n.toLocaleString("pt-BR")}</b><span>{c.label}</span>
          </button>
        ))}
      </div>

      <Chips options={CHIPS} value={aba} onChange={(v) => { setAba(v); setVisiveis(PASSO); }} />

      {aba === "arquivados" ? (
        <div className="pc-list">
          {tombstones.length ? tombstones.map((t) => (
            <article className="pc-card tomb" key={t.id}>
              <div className="pc-body">
                <div className="pc-top"><span className="pc-flag gray">arquivado · tombstone</span></div>
                <div className="pc-name"><span className="mono">{t.identificador}</span> <span className="pc-papel">consolidado por mesclagem</span></div>
                <div className="pc-caso"><code>merged_into</code> → processo canônico vivo · intimações que citam este registro recaem no canônico (<code>fn_resolver_processo</code>)</div>
                <div className="pc-foot"><Link className="btn sm" href={linkPara("processo", t.merged_into)}>Ir ao canônico</Link></div>
              </div>
            </article>
          )) : <div className="empty">Nenhum tombstone no acervo.</div>}
        </div>
      ) : (
        <>
          <div className="pc-list">
            {mostradas.length ? mostradas.map((p) => <ProcessoCard key={p.id} p={p} />) : <div className="empty">Nenhum processo neste filtro.</div>}
          </div>
          {visiveis < filtradas.length && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <button className="btn" onClick={() => setVisiveis((v) => v + PASSO)}>Carregar mais {filtradas.length - visiveis} processos →</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

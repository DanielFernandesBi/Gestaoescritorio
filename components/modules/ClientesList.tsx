"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Chips } from "@/components/Chips";
import { linkPara } from "@/lib/links";
import { fmtBRL, fmtDate, humano } from "@/lib/format";
import type { ClienteAcervo } from "@/lib/data";

const PASSO = 20;
const PRESO = new Set(["preso_provisorio", "preso_definitivo"]);
const AMBER_SIT = new Set(["regime_semiaberto", "regime_aberto", "monitoramento"]);

// Bolinha/barra por situação: preso vermelho · regime mostarda · solto verde · resto slate.
function sitTone(s: string | null): string {
  if (s && PRESO.has(s)) return "red";
  if (s && AMBER_SIT.has(s)) return "amber";
  if (s === "solto") return "green";
  if (s === "foragido") return "red";
  return "slate";
}

type Cel = { label: string; value: ReactNode; tone?: "red" | "green" | "amber" };

function celulas(c: ClienteAcervo): Cel[] {
  const fin: Cel = c.inadimplente
    ? { label: "Financeiro", value: c.fin_parcela != null ? `parcela ${c.fin_parcela} · ${c.fin_dias_atraso}d · ${fmtBRL(c.fin_valor ?? 0)}` : "inadimplente", tone: "red" }
    : { label: "Financeiro", value: "em dia", tone: "green" };
  if (c.em_execucao) {
    const benef = c.beneficio_dias != null ? `progressão ${c.beneficio_dias}d` : c.livramento_dias != null ? `livramento ${c.livramento_dias}d` : "—";
    return [
      { label: "Benefício", value: benef, tone: (c.beneficio_dias != null && c.beneficio_dias < 0) || (c.livramento_dias != null && c.livramento_dias < 0) ? "red" : undefined },
      { label: "Atestado", value: c.tem_atestado ? "lançado" : "a cadastrar", tone: c.tem_atestado ? undefined : "amber" },
      { label: "Processos", value: `${c.processos_ativos} execução` },
      fin,
    ];
  }
  return [
    { label: "Processos", value: c.processos_ativos ? `${c.processos_ativos} ativo${c.processos_ativos === 1 ? "" : "s"}` : "—" },
    { label: "Próx. fatal", value: c.prox_fatal ? `${fmtDate(c.prox_fatal)} · ${c.prox_fatal_dias}d` : "—", tone: c.prox_fatal_dias != null && c.prox_fatal_dias <= 2 ? "red" : undefined },
    { label: "Audiência", value: c.audiencia ? fmtDate(c.audiencia) : "—" },
    fin,
  ];
}

function acoes(c: ClienteAcervo): { label: string; href: string; primary?: boolean }[] {
  const ficha = linkPara("cliente", c.id);
  if (c.inadimplente) return [{ label: "Cobrar", href: "/financeiro", primary: true }, { label: "Abrir ficha", href: ficha }];
  if (c.em_execucao) return [{ label: "Abrir ficha", href: ficha, primary: true }, { label: "Aba Execução", href: ficha }];
  return [{ label: "Abrir ficha", href: ficha, primary: true }, { label: "Situação consolidada", href: ficha }];
}

function ClienteCard({ c }: { c: ClienteAcervo }) {
  const tone = sitTone(c.situacao_prisional);
  const ident = c.cpf ? `${(c.cpf || "").length > 14 ? "CNPJ" : "CPF"} ${c.cpf}` : "";
  return (
    <article className={`pc-card b-${tone}`}>
      <span className="pc-bar" />
      <div className="pc-body">
        <div className="pc-top">
          {c.situacao_prisional && <span className={`pc-status s-${tone}`}><span className="pc-dot" /> {humano(c.situacao_prisional)}</span>}
          {c.unidade_prisional && <span className="pc-trib">{c.unidade_prisional}</span>}
          {c.em_execucao && <span className="pc-area t-amber">execução penal</span>}
          {c.segredo && <span className="pc-flag lock">🔒 segredo de justiça</span>}
          {ident && <span className="pc-ident mono">{ident}</span>}
        </div>

        <div className="pc-name">
          {c.nome}
          {c.papel && <span className="pc-papel">{humano(c.papel)}</span>}
        </div>
        {c.contato_familia && <div className="cl-contato">Contato família: <b>{c.contato_familia}</b></div>}

        <div className="pc-grid">
          {celulas(c).map((cel, i) => (
            <div className="pc-cel" key={i}>
              <div className="pc-cel-l">{cel.label}</div>
              <div className={`pc-cel-v${cel.tone ? " " + cel.tone : ""}`}>{cel.value}</div>
            </div>
          ))}
        </div>

        <div className="pc-foot">
          {acoes(c).map((a, i) => (
            <Link key={i} className={`btn sm${a.primary ? " primary" : ""}`} href={a.href}>{a.label}</Link>
          ))}
        </div>
      </div>
    </article>
  );
}

const CHIPS = [
  { id: "todos", label: "Todos" },
  { id: "presos", label: "Presos" },
  { id: "execucao", label: "Em execução" },
  { id: "inadimplentes", label: "Inadimplentes" },
  { id: "favoritos", label: "Favoritos" },
];

export function ClientesList({ clientes }: { clientes: ClienteAcervo[] }) {
  const [aba, setAba] = useState("todos");
  const [visiveis, setVisiveis] = useState(PASSO);

  const nPresos = clientes.filter((c) => c.situacao_prisional && PRESO.has(c.situacao_prisional)).length;
  const nExec = clientes.filter((c) => c.em_execucao).length;
  const nInad = clientes.filter((c) => c.inadimplente).length;

  const filtradas = useMemo(
    () =>
      clientes.filter((c) => {
        switch (aba) {
          case "presos": return Boolean(c.situacao_prisional && PRESO.has(c.situacao_prisional));
          case "execucao": return c.em_execucao;
          case "inadimplentes": return c.inadimplente;
          case "favoritos": return c.favorito;
          default: return true;
        }
      }),
    [clientes, aba],
  );
  const mostradas = filtradas.slice(0, visiveis);

  const cards = [
    { id: "todos", n: clientes.length, label: "Clientes · ativos", cls: "" },
    { id: "presos", n: nPresos, label: "Presos · liberdade", cls: "n-red" },
    { id: "execucao", n: nExec, label: "Em execução penal", cls: "n-amber" },
    { id: "inadimplentes", n: nInad, label: "Inadimplentes · cobrança", cls: "n-amber" },
  ];

  return (
    <>
      <div className="stat-row">
        {cards.map((c) => (
          <button key={c.id} type="button" className={`stat${aba === c.id ? " on" : ""}`} onClick={() => { setAba(c.id); setVisiveis(PASSO); }}>
            <b className={c.cls}>{c.n.toLocaleString("pt-BR")}</b><span>{c.label}</span>
          </button>
        ))}
      </div>

      <Chips options={CHIPS} value={aba} onChange={(v) => { setAba(v); setVisiveis(PASSO); }} />

      <div className="pc-list">
        {mostradas.length ? mostradas.map((c) => <ClienteCard key={c.id} c={c} />) : <div className="empty">Nenhum cliente neste filtro.</div>}
      </div>
      {visiveis < filtradas.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button className="btn" onClick={() => setVisiveis((v) => v + PASSO)}>Carregar mais {filtradas.length - visiveis} clientes →</button>
        </div>
      )}
    </>
  );
}

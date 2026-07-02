"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ProcRef, SegredoTag } from "@/components/ui";
import { linkPara } from "@/lib/links";
import { fmtNum, humano } from "@/lib/format";
import type { CaixaProcesso } from "@/lib/data";

const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const diasTone = (d: number | null) => (d == null ? "tang" : d < 0 || d <= 2 ? "red" : d <= 5 ? "amber" : "tang");
const curto = (s: string | null, n = 64) => {
  const t = (s ?? "").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : (t || "—");
};

const CARD_ITENS = 3; // itens visíveis por card antes de expandir
const CARDS_INICIAIS = 18; // cards visíveis antes de "mostrar mais"

/* Uma "linha de trabalho" achatada (prazo, intimação, peça ou tarefa) — para o
 * card mostrar sempre os N primeiros e esconder o resto atrás de "expandir". */
type Linha = { key: string; href: string; tag: string; tone: string; texto: string; dias?: number | null; right?: string };

function linhasDe(p: CaixaProcesso): Linha[] {
  const L: Linha[] = [];
  // Ordem dentro do card: prazos (mais urgentes) → intimações → peças → tarefas.
  for (const pr of p.prazos)
    L.push({ key: `pz${pr.id}`, href: linkPara("prazo", pr.id), tag: pr.validado ? "prazo" : "prazo prov.", tone: pr.validado ? "val" : "tang", texto: pr.ato.split(/\s*[—–[]/)[0].trim(), dias: pr.dias, right: `fatal ${ddmm(pr.data_fatal)}` });
  for (const i of p.intimacoes)
    L.push({ key: `in${i.id}`, href: linkPara("intimacao", i.id), tag: humano(i.status), tone: "cat-blue", texto: curto(i.resumo, 60), right: ddmm(i.data) });
  for (const pc of p.pecas)
    L.push({ key: `pc${pc.id}`, href: linkPara("peca", pc.id), tag: humano(pc.status), tone: pc.status === "aguardando_insumo" ? "tang" : "cat-neutral", texto: [humano(pc.tipo), pc.subtipo ? humano(pc.subtipo) : null].filter(Boolean).join(" · ") || curto(pc.titulo, 60) });
  for (const t of p.tarefas)
    L.push({ key: `ta${t.id}`, href: linkPara("tarefa", t.id), tag: humano(t.status), tone: "cat-slate", texto: curto(t.titulo, 60), right: t.data_limite ? `limite ${ddmm(t.data_limite)}` : undefined });
  return L;
}

function LinhaItem({ l }: { l: Linha }) {
  return (
    <Link className="cx-item" href={l.href}>
      <span className={`pz-tag ${l.tone}`}>{l.tag}</span>
      <span className="cx-item-t">{l.texto}</span>
      {l.dias != null && <span className={`cx-item-dias ${diasTone(l.dias)}`}>{l.dias < 0 ? `−${Math.abs(l.dias)}d` : `${l.dias}d`}</span>}
      {l.right && <span className="cx-item-d mono">{l.right}</span>}
    </Link>
  );
}

/* Card de tamanho fixo por processo: mostra até CARD_ITENS linhas; o excedente
 * fica atrás de "expandir". Cards com menos itens mantêm a altura padrão. */
function CaixaCard({ p }: { p: CaixaProcesso }) {
  const [aberto, setAberto] = useState(false);
  const linhas = linhasDe(p);
  const visiveis = aberto ? linhas : linhas.slice(0, CARD_ITENS);
  const extra = linhas.length - visiveis.length;
  const contexto = p.classe ? humano(p.classe) : p.area ? humano(p.area) : null;
  return (
    <article className={`cx-card${p.prox_fatal != null && p.prox_fatal <= 2 ? " urg" : ""}`}>
      <div className="cx-card-h">
        <div className="cx-card-id">
          <div className="cx-num">
            {p.segredo ? <SegredoTag on /> : <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} id={p.processo_id} />}
            {p.numero_classe && <span className="cx-nclasse mono">· {p.numero_classe}</span>}
          </div>
          <div className="cx-cli">{p.segredo ? "🔒 segredo de justiça" : (p.clientes || "sem cliente vinculado")}{contexto ? ` · ${contexto}` : ""}</div>
        </div>
        <div className="cx-card-badges">
          {p.prox_fatal != null && (
            <span className={`cx-fatal ${diasTone(p.prox_fatal)}`}>{p.prox_fatal < 0 ? `−${Math.abs(p.prox_fatal)}d` : `${p.prox_fatal}d`}</span>
          )}
          <span className="cx-total" title="itens em aberto neste processo">{p.total}</span>
        </div>
      </div>

      <div className="cx-card-body">
        {visiveis.map((l) => <LinhaItem key={l.key} l={l} />)}
        {extra > 0 && (
          <button type="button" className="cx-expand" onClick={() => setAberto(true)}>+{extra} {extra === 1 ? "item" : "itens"} · expandir</button>
        )}
        {aberto && linhas.length > CARD_ITENS && (
          <button type="button" className="cx-expand" onClick={() => setAberto(false)}>mostrar menos</button>
        )}
      </div>

      <div className="cx-card-foot">
        <Link className="btn sm abrir" href={linkPara("processo", p.processo_id)}>Abrir processo ↗</Link>
      </div>
    </article>
  );
}

export function CaixaView({ processos }: { processos: CaixaProcesso[] }) {
  const [f, setF] = useState<"todos" | "prazo" | "pecas">("todos");
  const [limite, setLimite] = useState(CARDS_INICIAIS);

  const totIntim = processos.reduce((s, p) => s + p.intimacoes.length, 0);
  const totPrazo = processos.reduce((s, p) => s + p.prazos.length, 0);
  const totPeca = processos.reduce((s, p) => s + p.pecas.length, 0);
  const totTar = processos.reduce((s, p) => s + p.tarefas.length, 0);

  const filtrados = processos.filter((p) =>
    f === "prazo" ? p.prazos.length > 0 : f === "pecas" ? p.pecas.length > 0 : true,
  );
  const visiveis = filtrados.slice(0, limite);
  const restam = filtrados.length - visiveis.length;

  const chip = (id: typeof f, label: string) => (
    <button key={id} type="button" className={`tk-chip${f === id ? " on" : ""}`} onClick={() => { setF(id); setLimite(CARDS_INICIAIS); }}>{label}</button>
  );

  const counters: [ReactNode, string, string][] = [
    [fmtNum(processos.length), "processos com trabalho", "accent"],
    [fmtNum(totIntim), "intimações em aberto", ""],
    [fmtNum(totPrazo), "prazos abertos", "red"],
    [fmtNum(totPeca), "peças na produção", ""],
    [fmtNum(totTar), "tarefas pendentes", ""],
  ];

  return (
    <div className="caixa-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Trabalho · o que pede providência</div>
          <h1>Caixa de trabalho</h1>
          <p>
            Um card por <b>processo</b> com trabalho em aberto: intimações, prazos, peças na produção e tarefas
            pendentes. Cada card mostra os <b>{CARD_ITENS} itens mais urgentes</b> — o restante fica em “expandir”.
            Ordenado pelo <b>fatal mais próximo</b>.
          </p>
        </div>
      </div>

      <div className="cx-counters">
        {counters.map(([n, lbl, tone], i) => (
          <div className={`cx-counter ${tone}`} key={i}><div className="big">{n}</div><div className="lbl">{lbl}</div></div>
        ))}
      </div>

      {processos.length > 0 && (
        <div className="cx-filters">
          {chip("todos", `Todos (${processos.length})`)}
          {chip("prazo", `Com prazo aberto (${processos.filter((p) => p.prazos.length > 0).length})`)}
          {chip("pecas", `Com peça a fazer (${processos.filter((p) => p.pecas.length > 0).length})`)}
          <span className="tk-filter-count mono">{filtrados.length} no filtro</span>
        </div>
      )}

      {processos.length === 0 ? (
        <div className="cx-empty">
          <div className="cx-empty-ico"><Icon name="inbox" size={26} /></div>
          <h3>Nenhum processo com trabalho em aberto. 🎉</h3>
          <p>Sem intimações pendentes, prazos abertos, peças na fila ou tarefas em andamento agora.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="cx-empty sm">Nenhum processo neste filtro.</div>
      ) : (
        <>
          <div className="cx-grid">
            {visiveis.map((p) => <CaixaCard key={p.processo_id} p={p} />)}
          </div>
          {restam > 0 && (
            <button type="button" className="cx-more" onClick={() => setLimite((n) => n + CARDS_INICIAIS)}>
              Mostrar mais {Math.min(restam, CARDS_INICIAIS)} de {restam} processos restantes
            </button>
          )}
        </>
      )}

      <div className="cx-note">
        <span className="ico"><Icon name="shield" size={14} /></span>
        <div>
          Só leitura — a Caixa espelha o estado das tabelas (intimações, prazos, peças, tarefas). Número do processo
          sempre por extenso; processos sob <b>segredo de justiça</b> aparecem com o selo e sem dados sensíveis.
        </div>
      </div>
    </div>
  );
}

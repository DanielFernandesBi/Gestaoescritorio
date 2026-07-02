"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ProcRef, SegredoTag } from "@/components/ui";
import { linkPara } from "@/lib/links";
import { fmtDate, fmtNum, humano } from "@/lib/format";
import type { CaixaProcesso } from "@/lib/data";

const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const diasTone = (d: number | null) => (d == null ? "tang" : d < 0 || d <= 2 ? "red" : d <= 5 ? "amber" : "tang");
const curto = (s: string | null, n = 80) => {
  const t = (s ?? "").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : (t || "—");
};

/* Uma linha por processo com trabalho em aberto — expande para os itens. */
function CaixaRow({ p, aberto: inicial }: { p: CaixaProcesso; aberto: boolean }) {
  const [aberto, setAberto] = useState(inicial);
  const partes = [
    p.pecas.length ? `${p.pecas.length} peça${p.pecas.length === 1 ? "" : "s"}` : null,
    p.intimacoes.length ? `${p.intimacoes.length} intimação${p.intimacoes.length === 1 ? "" : "ões"}` : null,
    p.prazos.length ? `${p.prazos.length} prazo${p.prazos.length === 1 ? "" : "s"}` : null,
    p.tarefas.length ? `${p.tarefas.length} tarefa${p.tarefas.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  const contexto = [p.classe ? humano(p.classe) : p.area ? humano(p.area) : null].filter(Boolean).join(" · ");
  return (
    <article className={`cx-row${p.prox_fatal != null && p.prox_fatal <= 2 ? " urg" : ""}`}>
      <button type="button" className="cx-head" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
        <span className={`cx-caret${aberto ? " on" : ""}`} aria-hidden>▸</span>
        <span className="cx-id">
          <span className="cx-num">
            {p.segredo ? <SegredoTag on /> : <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} id={p.processo_id} />}
            {p.numero_classe && <span className="cx-nclasse mono"> · {p.numero_classe}</span>}
          </span>
          <span className="cx-cli">{p.segredo ? "🔒 segredo de justiça" : (p.clientes || "sem cliente vinculado")}{contexto ? ` · ${contexto}` : ""}</span>
        </span>
        <span className="cx-chips">
          {p.prox_fatal != null && (
            <span className={`cx-fatal ${diasTone(p.prox_fatal)}`}>{p.prox_fatal < 0 ? `−${Math.abs(p.prox_fatal)}d` : `${p.prox_fatal}d`}</span>
          )}
          <span className="cx-resumo">{partes.join(" · ")}</span>
          <span className="cx-total">{p.total}</span>
        </span>
      </button>

      {aberto && (
        <div className="cx-body">
          {p.intimacoes.length > 0 && (
            <div className="cx-grp">
              <div className="cx-grp-h">Intimações em aberto <span className="cx-grp-n">{p.intimacoes.length}</span></div>
              {p.intimacoes.map((i) => (
                <Link className="cx-item" key={i.id} href={linkPara("intimacao", i.id)}>
                  <span className="pz-tag cat-blue">{humano(i.status)}</span>
                  <span className="cx-item-t">{curto(i.resumo, 90)}</span>
                  <span className="cx-item-d mono">{ddmm(i.data)}</span>
                </Link>
              ))}
            </div>
          )}
          {p.prazos.length > 0 && (
            <div className="cx-grp">
              <div className="cx-grp-h">Prazos abertos <span className="cx-grp-n">{p.prazos.length}</span></div>
              {p.prazos.map((pr) => (
                <Link className="cx-item" key={pr.id} href={linkPara("prazo", pr.id)}>
                  <span className={`pz-tag ${pr.validado ? "val" : "tang"}`}>{pr.validado ? "validado" : "provisório"}</span>
                  <span className="cx-item-t">{pr.ato.split(/\s*[—–[]/)[0].trim()}</span>
                  <span className={`cx-item-dias ${diasTone(pr.dias)}`}>{pr.dias < 0 ? `−${Math.abs(pr.dias)}d` : `${pr.dias}d`}</span>
                  <span className="cx-item-d mono">fatal {ddmm(pr.data_fatal)}</span>
                </Link>
              ))}
            </div>
          )}
          {p.pecas.length > 0 && (
            <div className="cx-grp">
              <div className="cx-grp-h">Peças na produção <span className="cx-grp-n">{p.pecas.length}</span></div>
              {p.pecas.map((pc) => (
                <Link className="cx-item" key={pc.id} href={linkPara("peca", pc.id)}>
                  <span className={`pz-tag ${pc.status === "aguardando_insumo" ? "tang" : "cat-neutral"}`}>{humano(pc.status)}</span>
                  <span className="cx-item-t">{[humano(pc.tipo), pc.subtipo ? humano(pc.subtipo) : null].filter(Boolean).join(" · ") || curto(pc.titulo)}</span>
                </Link>
              ))}
            </div>
          )}
          {p.tarefas.length > 0 && (
            <div className="cx-grp">
              <div className="cx-grp-h">Tarefas pendentes <span className="cx-grp-n">{p.tarefas.length}</span></div>
              {p.tarefas.map((t) => (
                <Link className="cx-item" key={t.id} href={linkPara("tarefa", t.id)}>
                  <span className="pz-tag cat-slate">{humano(t.status)}</span>
                  <span className="cx-item-t">{curto(t.titulo, 90)}</span>
                  <span className="cx-item-d">{[humano(t.prioridade) || null, t.responsavel, t.data_limite ? `limite ${ddmm(t.data_limite)}` : null].filter(Boolean).join(" · ")}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="cx-foot">
            <Link className="btn sm abrir" href={linkPara("processo", p.processo_id)}>Abrir processo ↗</Link>
          </div>
        </div>
      )}
    </article>
  );
}

export function CaixaView({ processos }: { processos: CaixaProcesso[] }) {
  const [f, setF] = useState<"todos" | "prazo" | "pecas">("todos");

  const totIntim = processos.reduce((s, p) => s + p.intimacoes.length, 0);
  const totPrazo = processos.reduce((s, p) => s + p.prazos.length, 0);
  const totPeca = processos.reduce((s, p) => s + p.pecas.length, 0);
  const totTar = processos.reduce((s, p) => s + p.tarefas.length, 0);

  const filtrados = processos.filter((p) =>
    f === "prazo" ? p.prazos.length > 0 : f === "pecas" ? p.pecas.length > 0 : true,
  );

  const chips = [
    { id: "todos" as const, label: `Todos (${processos.length})` },
    { id: "prazo" as const, label: `Com prazo aberto (${processos.filter((p) => p.prazos.length > 0).length})` },
    { id: "pecas" as const, label: `Com peça a fazer (${processos.filter((p) => p.pecas.length > 0).length})` },
  ];

  // Abre por padrão os processos com fatal iminente (≤ 2 dias) para leitura rápida.
  const abrePadrao = (p: CaixaProcesso) => p.prox_fatal != null && p.prox_fatal <= 2;

  return (
    <div className="caixa-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Trabalho · o que pede providência</div>
          <h1>Caixa de trabalho</h1>
          <p>
            Uma linha por <b>processo</b> com trabalho em aberto, agrupando o que ainda pede uma providência:
            intimações em aberto, prazos, peças na produção e tarefas pendentes. Expanda cada processo para ver
            os itens. Ordenado pelo <b>fatal mais próximo</b>.
          </p>
        </div>
      </div>

      <div className="cx-counters">
        <div className="cx-counter accent"><div className="big">{fmtNum(processos.length)}</div><div className="lbl">processos com trabalho</div></div>
        <div className="cx-counter"><div className="big">{fmtNum(totIntim)}</div><div className="lbl">intimações em aberto</div></div>
        <div className="cx-counter red"><div className="big">{fmtNum(totPrazo)}</div><div className="lbl">prazos abertos</div></div>
        <div className="cx-counter"><div className="big">{fmtNum(totPeca)}</div><div className="lbl">peças na produção</div></div>
        <div className="cx-counter"><div className="big">{fmtNum(totTar)}</div><div className="lbl">tarefas pendentes</div></div>
      </div>

      {processos.length > 0 && (
        <div className="cx-filters">
          {chips.map((c) => (
            <button key={c.id} type="button" className={`tk-chip${f === c.id ? " on" : ""}`} onClick={() => setF(c.id)}>
              {c.label}
            </button>
          ))}
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
        <div className="cx-list">
          {filtrados.map((p) => <CaixaRow key={p.processo_id} p={p} aberto={abrePadrao(p)} />)}
        </div>
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { Chips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { ContextoCaso } from "@/components/ui";
import { PrazosOrfaosList } from "@/components/modules/PrazosOrfaosList";
import { AndamentosOrfaosList } from "@/components/modules/AndamentosOrfaosList";
import { linkPara } from "@/lib/links";
import { fmtDate } from "@/lib/format";
import type { PrazoOrfao, AndamentoOrfao, Intimacao } from "@/lib/data";

export function TriagemView({
  prazos,
  intimacoes,
  andamentos,
}: {
  prazos: PrazoOrfao[];
  intimacoes: Intimacao[];
  andamentos: AndamentoOrfao[];
}) {
  const [aba, setAba] = useState("tudo");

  // Homônimos não têm fonte estruturada hoje (a triagem só gera tarefa de alta prioridade);
  // sem inventar a comparação, o bloco fica como estado vazio honesto.
  const homonimos = 0;
  const total = prazos.length + intimacoes.length + andamentos.length + homonimos;

  const abas = [
    { id: "tudo", label: `Tudo (${total})` },
    { id: "prazos", label: `Prazos órfãos (${prazos.length})` },
    { id: "intimacoes", label: `Intimações órfãs (${intimacoes.length})` },
    { id: "andamentos", label: `Andamentos órfãos (${andamentos.length})` },
    { id: "homonimos", label: `Homônimos (${homonimos})` },
  ];
  const ver = (s: string) => aba === "tudo" || aba === s;

  return (
    <>
      <div className="card op-card" style={{ marginBottom: 16 }}>
        <div className="card-h"><h3><Icon name="inbox" /> Filtros</h3></div>
        <div className="card-b"><Chips options={abas} value={aba} onChange={setAba} /></div>
      </div>

      <div className="banner" style={{ marginBottom: 16 }}>
        <span className="ia-seal">IA</span>
        <div>
          A triagem grava órfãos quando não casa o identificador (CNJ ou registro do tribunal).{" "}
          <b>Promover</b> resolve por nome normalizado e <code>fn_resolver_processo</code> (mesclagem/tombstone)
          antes de vincular. <b>Prazos órfãos são fatais vivas</b> — não se perdem mesmo sem o processo.
        </div>
      </div>

      {ver("prazos") && (
        <section className="tri-sec">
          <div className="tri-h">Prazos órfãos · fatais vivas <code>vw_prazos_orfaos</code></div>
          {prazos.length ? <PrazosOrfaosList orfaos={prazos} /> : <div className="empty">Nenhuma fatal sem processo. 🎉</div>}
        </section>
      )}

      {ver("intimacoes") && (
        <section className="tri-sec">
          <div className="tri-h">Intimações órfãs <code>vw_intimacoes_orfas</code></div>
          {intimacoes.length ? (
            <div className="int-list">
              {intimacoes.map((i) => (
                <div className="int-card" key={i.id}>
                  <div className="int-top">
                    <span className="int-orig">{(i.origem ?? "—").toUpperCase()}</span>
                    <span className="int-date mono">{fmtDate(i.data_publicacao)}</span>
                  </div>
                  <div className="int-cliente"><span className="int-orfa">⚠ Sem processo identificado · triagem humana</span></div>
                  <ContextoCaso ctx={i.contexto} />
                  {i.resumo && <div className="int-prov"><span className="int-k">teor</span> {i.resumo}</div>}
                  <div className="int-foot">
                    <div className="int-enc"><span className="sub">sem CNJ · fila de órfãos</span></div>
                    <div className="int-acoes">
                      <Link className="btn sm primary" href={linkPara("intimacao", i.id)}>Promover · vincular</Link>
                      <Link className="btn sm" href={linkPara("intimacao", i.id)}>Abrir</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Nenhuma intimação órfã. 🎉</div>
          )}
        </section>
      )}

      {ver("andamentos") && (
        <section className="tri-sec">
          <div className="tri-h">Andamentos órfãos <code>vw_andamentos_orfaos</code></div>
          {andamentos.length ? <AndamentosOrfaosList orfaos={andamentos} /> : <div className="empty">Nenhum andamento órfão. 🎉</div>}
        </section>
      )}

      {ver("homonimos") && (
        <section className="tri-sec">
          <div className="tri-h">Homônimos · conferência humana</div>
          <div className="banner" style={{ marginTop: 0 }}>
            <span className="ico">⚠</span>
            <div>
              <b>Possível homônimo</b> — a triagem NÃO cadastra nem vincula; pede sua decisão. Nomes muito
              parecidos viram tarefa de triagem de alta prioridade.
            </div>
          </div>
          <div className="empty">
            Sem homônimos pendentes no momento.
            <div className="sub" style={{ marginTop: 6 }}>
              A comparação lado a lado (nome novo × acervo · CPF) depende de uma fonte dedicada de homônimos
              ainda não disponível no banco.
            </div>
          </div>
        </section>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useDrawer } from "@/components/Drawer";
import { ProcRef, SegredoTag, ContextoCaso, PartesCliente } from "@/components/ui";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
import { linkPara } from "@/lib/links";
import { fmtDate, humano } from "@/lib/format";
import type { Movimentacao } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

// Cor do tipo (semáforo): sentença vermelho; decisão/despacho/acórdão azul; petição verde.
const cor = (tipo: string) => {
  if (tipo.includes("sentenca")) return "red";
  if (tipo.includes("decisao") || tipo.includes("despacho") || tipo.includes("acordao")) return "blue";
  if (tipo.includes("peticao") || tipo.includes("protocol")) return "green";
  return "";
};

// Motivo do escalonamento derivado da prioridade (mapa determinístico da Sug. 30).
const motivo = (p: string | null | undefined) =>
  p === "urgente" ? "medida que afeta a liberdade/patrimônio"
    : p === "alta" ? "resultado de mérito / decisão / sessão"
      : "conferência humana";

export function AndamentosTimeline({
  movimentacoes,
  mapa = null,
}: {
  movimentacoes: Movimentacao[];
  mapa?: MapaProvidencia | null;
}) {
  const { open } = useDrawer();

  if (!movimentacoes.length) {
    return <div className="empty">Nenhuma movimentação neste filtro.</div>;
  }

  const abrir = (m: Movimentacao) =>
    open({
      title: (
        <>
          <h2>{humano(m.tipo)}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ProcRef cnj={m.numero_cnj} registro={m.numero_registro} />
            <SegredoTag on={m.segredo} />
          </div>
          <ContextoCaso ctx={m.contexto} />
        </>
      ),
      body: (
        <>
          <div className="dsec">
            <h4>Movimentação</h4>
            <div className="field"><div className="v">{m.descricao}</div></div>
          </div>
          <div className="dsec">
            <h4>Dados</h4>
            <div className="dgrid">
              <div className="field"><div className="k">Data</div><div className="v mono">{fmtDate(m.data)}</div></div>
              <div className="field"><div className="k">Origem</div><div className="v">{(m.origem ?? "—").toUpperCase()}</div></div>
              <div className="field"><div className="k">Tribunal</div><div className="v">{m.tribunal ?? "—"}</div></div>
              <div className="field"><div className="k">Autor</div><div className="v">{m.autor ?? "—"}</div></div>
              <div className="field"><div className="k">Cliente</div><div className="v">{m.segredo ? "— (sigiloso)" : m.clientes ?? "—"}</div></div>
            </div>
          </div>
          <div className="dsec">
            <h4>Produção</h4>
            <div className="acoes">
              <CriarPecaPendente tipoOrigem="andamento" origemId={m.id} texto={m.descricao} mapa={mapa} />
            </div>
          </div>
        </>
      ),
    });

  return (
    <div className="and-list">
      {movimentacoes.map((m) => (
        <div className={`and-card ${cor(m.tipo)}${m.escalado ? " escalado" : ""}`} key={m.id}>
          <span className="and-bar" />
          <div className="and-main">
            <div className="and-top">
              <span className="and-tipo">{humano(m.tipo)}</span>
              <span className="and-orig">{(m.tribunal ?? m.origem ?? "").toString().toUpperCase()}</span>
              <span className="and-date mono">{fmtDate(m.data)}</span>
            </div>
            <div className="and-t">{m.descricao}</div>
            <div className="and-cli">
              {m.segredo ? <SegredoTag on /> : m.partes?.length ? <PartesCliente partes={m.partes} /> : <span className="dl-cli">{m.clientes ?? "—"}</span>}
              {m.numero_cnj && <> · <span className="cnj">{m.numero_cnj}</span></>}
            </div>
            <ContextoCaso ctx={m.contexto} />

            {m.escalado ? (
              <div className={`and-esc ${m.prioridade === "urgente" ? "urg" : "alta"}`}>
                <span className="and-esc-pill">{(m.prioridade ?? "alta").toUpperCase()}</span>
                Escalado para conferência — {motivo(m.prioridade)}
              </div>
            ) : (
              <div className="and-esc info">só histórico · informativo — sem ação</div>
            )}

            <div className="and-foot">
              <span className="and-cap">capturado pela triagem · origem {(m.origem ?? "—").toUpperCase()}</span>
              <div className="and-acoes">
                {m.escalado && (
                  <Link className="btn sm primary" href={m.tarefa_id ? linkPara("tarefa", m.tarefa_id) : "/tarefas"}>Ver conferência</Link>
                )}
                <CriarPecaPendente tipoOrigem="andamento" origemId={m.id} texto={m.descricao} mapa={mapa} />
                {m.processo_id && <Link className="btn sm" href={linkPara("processo", m.processo_id)}>Abrir processo</Link>}
                <button type="button" className="btn sm ghost" onClick={() => abrir(m)}>Abrir</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

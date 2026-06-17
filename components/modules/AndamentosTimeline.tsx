"use client";

import { useDrawer } from "@/components/Drawer";
import { ProcRef, SegredoTag } from "@/components/ui";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
import { fmtDate, humano } from "@/lib/format";
import type { Movimentacao } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

const cor = (tipo: string) => {
  if (tipo.includes("sentenca")) return "red";
  if (tipo.includes("decisao") || tipo.includes("despacho") || tipo.includes("acordao")) return "blue";
  if (tipo.includes("peticao") || tipo.includes("protocol")) return "green";
  return "";
};

export function AndamentosTimeline({
  movimentacoes,
  mapa = null,
}: {
  movimentacoes: Movimentacao[];
  mapa?: MapaProvidencia | null;
}) {
  const { open } = useDrawer();

  if (!movimentacoes.length) {
    return <div className="empty">Nenhuma movimentação nos últimos dias.</div>;
  }

  return (
    <div className="tl">
      {movimentacoes.map((m) => (
        <div
          key={m.id}
          className={`tl-item ${cor(m.tipo)}`}
          style={{ cursor: "pointer" }}
          onClick={() =>
            open({
              title: (
                <>
                  <h2>{humano(m.tipo)}</h2>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <ProcRef cnj={m.numero_cnj} registro={m.numero_registro} />
                    <SegredoTag on={m.segredo} />
                  </div>
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
            })
          }
        >
          <div className="d">{fmtDate(m.data)} · {humano(m.tipo)} · {(m.origem ?? "").toUpperCase()}</div>
          <div className="t">{m.descricao}</div>
          <div className="x">
            {m.segredo ? "🔒 segredo de justiça" : m.clientes ?? ""}
            {m.numero_cnj ? ` · ${m.numero_cnj}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

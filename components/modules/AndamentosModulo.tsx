"use client";

import { useMemo, useState } from "react";
import { Chips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { AndamentosTimeline } from "@/components/modules/AndamentosTimeline";
import { AndamentosOrfaosList } from "@/components/modules/AndamentosOrfaosList";
import type { Movimentacao, AndamentoOrfao } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

const DECISAO = ["decisao", "sentenca", "acordao", "despacho"];
const ehDecisao = (t: string) => DECISAO.some((d) => t.includes(d));

const ORIGENS = [
  { id: "todas", label: "Todas origens" },
  { id: "tribunal", label: "Tribunal" },
  { id: "djen", label: "DJEN" },
  { id: "push", label: "Push" },
  { id: "email", label: "E-mail" },
];

export function AndamentosModulo({
  movimentacoes,
  orfaos,
  mapa = null,
}: {
  movimentacoes: Movimentacao[];
  orfaos: AndamentoOrfao[];
  mapa?: MapaProvidencia | null;
}) {
  const [aba, setAba] = useState("recentes");
  const [orig, setOrig] = useState("todas");

  const nEscalados = movimentacoes.filter((m) => m.escalado).length;
  const nDecisoes = movimentacoes.filter((m) => ehDecisao(m.tipo)).length;

  const abas = [
    { id: "recentes", label: `Recentes · 7d (${movimentacoes.length})` },
    { id: "escalados", label: `Escalados (${nEscalados})` },
    { id: "decisoes", label: `Decisões (${nDecisoes})` },
    { id: "orfaos", label: `Órfãos (${orfaos.length})` },
  ];

  const filtradas = useMemo(
    () =>
      movimentacoes.filter((m) => {
        const okAba =
          aba === "escalados" ? m.escalado : aba === "decisoes" ? ehDecisao(m.tipo) : true;
        const okOrig = orig === "todas" ? true : (m.origem ?? "") === orig;
        return okAba && okOrig;
      }),
    [movimentacoes, aba, orig],
  );

  return (
    <>
      <div className="card op-card" style={{ marginBottom: 16 }}>
        <div className="card-h"><h3><Icon name="list" /> Filtros</h3></div>
        <div className="card-b">
          <Chips options={abas} value={aba} onChange={setAba} />
          {aba !== "orfaos" && <Chips options={ORIGENS} value={orig} onChange={setOrig} />}
        </div>
      </div>

      <div className="scan">
        <div className="scan-h"><h3><Icon name="activity" /> Panorama dos andamentos</h3></div>
        <div className="scan-metrics">
          <button type="button" className={`metric${aba === "recentes" ? " metric-on" : ""}`} onClick={() => setAba("recentes")}><b>{movimentacoes.length}</b><span>Recentes · últimos 7 dias</span></button>
          <button type="button" className={`metric${aba === "escalados" ? " metric-on" : ""}`} onClick={() => setAba("escalados")}><b>{nEscalados}</b><span>Escalados · conferência</span></button>
          <button type="button" className={`metric${aba === "orfaos" ? " metric-on" : ""}`} onClick={() => setAba("orfaos")}><b>{orfaos.length}</b><span>Órfãos · sem processo</span></button>
          <button type="button" className={`metric${aba === "decisoes" ? " metric-on" : ""}`} onClick={() => setAba("decisoes")}><b>{nDecisoes}</b><span>Decisões · mérito/despacho</span></button>
        </div>
      </div>

      {aba === "orfaos" ? (
        <AndamentosOrfaosList orfaos={orfaos} />
      ) : (
        <AndamentosTimeline movimentacoes={filtradas} mapa={mapa} />
      )}
    </>
  );
}

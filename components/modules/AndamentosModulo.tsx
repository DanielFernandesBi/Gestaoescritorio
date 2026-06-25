"use client";

import { useMemo, useState } from "react";
import { Chips } from "@/components/Chips";
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
        const okAba = aba === "escalados" ? m.escalado : aba === "decisoes" ? ehDecisao(m.tipo) : true;
        const okOrig = orig === "todas" ? true : (m.origem ?? "") === orig;
        return okAba && okOrig;
      }),
    [movimentacoes, aba, orig],
  );

  const stats = [
    { id: "recentes", n: movimentacoes.length, label: "Recentes · últimos 7 dias" },
    { id: "escalados", n: nEscalados, label: "Escalados · conferência" },
    { id: "orfaos", n: orfaos.length, label: "Órfãos · sem processo" },
    { id: "decisoes", n: nDecisoes, label: "Decisões · mérito/despacho" },
  ];

  return (
    <>
      <Chips options={abas} value={aba} onChange={setAba} />
      {aba !== "orfaos" && <Chips options={ORIGENS} value={orig} onChange={setOrig} />}

      <div className="stat-row">
        {stats.map((s) => (
          <button key={s.id} type="button" className={`stat${aba === s.id ? " on" : ""}`} onClick={() => setAba(s.id)}>
            <b>{s.n}</b>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {aba === "orfaos" ? (
        <AndamentosOrfaosList orfaos={orfaos} />
      ) : (
        <AndamentosTimeline movimentacoes={filtradas} mapa={mapa} />
      )}
    </>
  );
}

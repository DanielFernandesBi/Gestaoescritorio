"use client";

import { useState } from "react";
import { Chips } from "@/components/Chips";
import { AndamentosTimeline } from "@/components/modules/AndamentosTimeline";
import { AndamentosOrfaosList } from "@/components/modules/AndamentosOrfaosList";
import type { Movimentacao, AndamentoOrfao } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

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
  const abas = [
    { id: "recentes", label: `Recentes (${movimentacoes.length})` },
    { id: "orfaos", label: `Órfãos / triagem (${orfaos.length})` },
  ];
  return (
    <>
      <Chips options={abas} value={aba} onChange={setAba} />
      {aba === "orfaos" ? (
        <AndamentosOrfaosList orfaos={orfaos} />
      ) : (
        <div className="card">
          <div className="card-b">
            <AndamentosTimeline movimentacoes={movimentacoes} mapa={mapa} />
          </div>
        </div>
      )}
    </>
  );
}

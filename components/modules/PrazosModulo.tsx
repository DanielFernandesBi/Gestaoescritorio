"use client";

import { useState } from "react";
import { Chips } from "@/components/Chips";
import { FiltrosCard } from "@/components/FiltrosCard";
import { PrazosList } from "@/components/modules/PrazosList";
import { PrazosOrfaosList } from "@/components/modules/PrazosOrfaosList";
import type { Prazo, PrazoOrfao } from "@/lib/data";

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "crit", label: "Críticos (≤2d)" },
  { id: "semana", label: "Esta semana" },
  { id: "Daniel", label: "Daniel" },
  { id: "Rodolfo", label: "Rodolfo" },
];

export function PrazosModulo({ prazos, orfaos }: { prazos: Prazo[]; orfaos: PrazoOrfao[] }) {
  const [aba, setAba] = useState("acervo");
  const [f, setF] = useState("todos");
  const abas = [
    { id: "acervo", label: `Acervo (${prazos.length})` },
    { id: "orfaos", label: `Órfãos / triagem (${orfaos.length})` },
  ];
  const opcoes = FILTROS.map((o) => (o.id === "todos" ? { ...o, label: `Todos (${prazos.length})` } : o));
  return (
    <>
      <FiltrosCard>
        <Chips options={abas} value={aba} onChange={setAba} />
        {aba === "acervo" && <Chips options={opcoes} value={f} onChange={setF} />}
      </FiltrosCard>
      {aba === "orfaos" ? <PrazosOrfaosList orfaos={orfaos} /> : <PrazosList prazos={prazos} filtro={f} />}
    </>
  );
}

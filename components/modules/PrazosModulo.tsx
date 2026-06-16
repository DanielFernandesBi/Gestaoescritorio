"use client";

import { useState } from "react";
import { Chips } from "@/components/Chips";
import { PrazosList } from "@/components/modules/PrazosList";
import { PrazosOrfaosList } from "@/components/modules/PrazosOrfaosList";
import type { Prazo, PrazoOrfao } from "@/lib/data";

export function PrazosModulo({ prazos, orfaos }: { prazos: Prazo[]; orfaos: PrazoOrfao[] }) {
  const [aba, setAba] = useState("acervo");
  const abas = [
    { id: "acervo", label: `Acervo (${prazos.length})` },
    { id: "orfaos", label: `Órfãos / triagem (${orfaos.length})` },
  ];
  return (
    <>
      <Chips options={abas} value={aba} onChange={setAba} />
      {aba === "orfaos" ? <PrazosOrfaosList orfaos={orfaos} /> : <PrazosList prazos={prazos} />}
    </>
  );
}

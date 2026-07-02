"use client";

import { useState } from "react";
import Link from "next/link";
import { estado, chipTexto } from "@/lib/agenda";
import { linkPara } from "@/lib/links";
import type { AgendaEvento } from "@/lib/data";

const ATZ = "T12:00:00Z";
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + ATZ);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX = 5; // eventos visíveis por célula antes do "+N mais" (célula é fixa)

function Chip({ e }: { e: AgendaEvento }) {
  return (
    <Link className={`ag-chip ev-${estado(e).tone}`} href={linkPara(e.tipo, e.id)} title={e.titulo}>
      {chipTexto(e)}
    </Link>
  );
}

/* Grade do mês com células de ALTURA FIXA; o excedente vira "+N mais", que abre
 * um popover com o dia inteiro (sem esticar a linha). */
export function AgendaMes({
  eventos,
  gridStart,
  mesRef,
  hojeISO,
}: {
  eventos: AgendaEvento[];
  gridStart: string;
  mesRef: string;
  hojeISO: string;
}) {
  const [dia, setDia] = useState<string | null>(null);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const doDia = (iso: string) =>
    eventos.filter((e) => e.data.slice(0, 10) === iso).sort((a, b) => a.data.localeCompare(b.data));

  const abertos = dia ? doDia(dia) : [];
  const diaLongo = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" })
      .format(new Date(iso + ATZ));

  return (
    <>
      <div className="ag-grid">
        {DOW.map((d) => <div key={d} className="ag-grid-dow">{d}</div>)}
        {cells.map((iso) => {
          const evs = doDia(iso);
          const foraDoMes = iso.slice(0, 7) !== mesRef;
          const extra = evs.length - MAX;
          return (
            <div key={iso} className={`ag-cell${foraDoMes ? " fora" : ""}${iso === hojeISO ? " ag-hoje" : ""}`}>
              <div className="ag-cell-n">{Number(iso.slice(8, 10))}</div>
              <div className="ag-cell-evs">
                {evs.slice(0, MAX).map((e, i) => <Chip key={`${e.id}-${e.marcador ?? ""}-${i}`} e={e} />)}
                {extra > 0 && (
                  <button type="button" className="ag-chip-mais" onClick={() => setDia(iso)}>+{extra} mais</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {dia && (
        <div className="ag-daypop-ov" role="dialog" aria-modal="true" onClick={() => setDia(null)}>
          <div className="ag-daypop" onClick={(e) => e.stopPropagation()}>
            <div className="ag-daypop-h">
              <span className="t">{diaLongo(dia)}</span>
              <button type="button" className="x" onClick={() => setDia(null)} aria-label="Fechar">×</button>
            </div>
            <div className="ag-daypop-list">
              {abertos.map((e, i) => <Chip key={`${e.id}-${e.marcador ?? ""}-${i}`} e={e} />)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

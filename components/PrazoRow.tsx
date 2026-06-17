"use client";

import { RowLink } from "./RowLink";
import { DiasBox, ProcRef } from "./ui";
import { linkPara } from "@/lib/links";
import { fmtDate } from "@/lib/format";
import type { PrazoAberto } from "@/lib/queries";

export function PrazoRow({ p }: { p: PrazoAberto }) {
  return (
    <RowLink href={linkPara("prazo", p.prazo_id)} ariaLabel={`Abrir prazo: ${p.ato}`}>
      <td style={{ width: 64 }}>
        <DiasBox dias={p.dias_restantes} />
      </td>
      <td>
        <div className="name">{p.ato}</div>
        <div className="sub">
          {(p.clientes ?? "—")} · {p.tribunal ?? "—"}
        </div>
      </td>
      <td className="right">
        <div className="mono" style={{ fontWeight: 600 }}>
          {fmtDate(p.data_fatal)}
        </div>
        <div className="sub">interna {fmtDate(p.data_interna)}</div>
      </td>
    </RowLink>
  );
}

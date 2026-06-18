import Link from "next/link";
import { Pill } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import type { VarreduraItem } from "@/lib/data";

/** Lista os itens reconstruídos de uma varredura (drill-down dos tiles). */
export function VarreduraItens({ itens }: { itens: VarreduraItem[] }) {
  if (!itens.length) {
    return <div className="empty">Nenhum item encontrado na janela desta varredura.</div>;
  }
  return (
    <div>
      {itens.map((it) => (
        <Link className="op-row" key={it.id} href={it.href}>
          <div>
            <div className="ot">{it.titulo}</div>
            <div className="os">{[it.cliente, it.numero_cnj].filter(Boolean).join(" · ") || "—"}</div>
          </div>
          <div className="dl-r">
            {it.tag && <Pill tone="gray" dot={false}>{it.tag}</Pill>}
            {it.data && <div className="os mono" style={{ marginTop: 4 }}>{fmtDate(it.data)}</div>}
          </div>
        </Link>
      ))}
    </div>
  );
}

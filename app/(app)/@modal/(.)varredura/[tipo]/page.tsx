import { notFound } from "next/navigation";
import { getVarreduraItens, type VarreduraTipo } from "@/lib/data";
import { RouteModal } from "@/components/RouteModal";
import { VarreduraItens } from "@/components/detalhe/VarreduraItens";
import { fmtDate, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const TIPOS: VarreduraTipo[] = ["intimacoes", "andamentos", "prazos"];

export default async function VarreduraModal({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!TIPOS.includes(tipo as VarreduraTipo)) notFound();
  const { titulo, quando, itens } = await getVarreduraItens(tipo as VarreduraTipo);

  return (
    <RouteModal
      title={
        <>
          <h2>{titulo}</h2>
          <div className="sub" style={{ marginTop: 6 }}>
            {itens.length} {itens.length === 1 ? "item" : "itens"} desta varredura
            {quando ? ` · ${fmtDate(quando)} ${fmtTime(quando)}` : ""}
          </div>
        </>
      }
    >
      <div className="dsec">
        <VarreduraItens itens={itens} />
      </div>
    </RouteModal>
  );
}

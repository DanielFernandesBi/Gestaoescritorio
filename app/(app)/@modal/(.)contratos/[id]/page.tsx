import { notFound } from "next/navigation";
import { getContratoPorId, getDocumentosContrato } from "@/lib/data";
import { RouteModal } from "@/components/RouteModal";
import { ContratoDetalhe } from "@/components/detalhe/ContratoDetalhe";
import { Pill } from "@/components/ui";
import { fmtBRL, humano } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONE: Record<string, "green" | "amber" | "red" | "gray"> = {
  vigente: "green", quitado: "gray", rescindido: "red", inadimplente: "red",
};

export default async function ContratoModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getContratoPorId(id);
  if (!c) notFound();
  const documentos = await getDocumentosContrato(id);

  return (
    <RouteModal
      title={
        <>
          <h2>{c.cliente}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Pill tone={TONE[c.status] ?? "gray"}>{humano(c.status)}</Pill>
            <span className="sub">{fmtBRL(c.valor_total)}</span>
          </div>
        </>
      }
    >
      <ContratoDetalhe contrato={c} documentos={documentos} />
    </RouteModal>
  );
}

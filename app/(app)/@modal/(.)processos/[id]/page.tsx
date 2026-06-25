import { notFound } from "next/navigation";
import { getProcessoPorId } from "@/lib/data";
import { RouteModal } from "@/components/RouteModal";
import { ProcessoDetalhe } from "@/components/detalhe/ProcessoDetalhe";
import { ProcRef, SegredoTag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProcessoModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proc = await getProcessoPorId(id);
  if (!proc) notFound();

  return (
    <RouteModal
      title={
        <>
          <h2 className="nome-cliente">{proc.segredo ? "Processo em segredo de justiça" : proc.clientes || "Processo"}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ProcRef cnj={proc.numero_cnj} registro={proc.numero_registro} />
            <SegredoTag on={proc.segredo} />
          </div>
        </>
      }
    >
      <ProcessoDetalhe proc={proc} />
    </RouteModal>
  );
}

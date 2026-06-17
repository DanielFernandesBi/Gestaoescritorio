import { notFound } from "next/navigation";
import { getPrazoPorId } from "@/lib/data";
import { RouteModal } from "@/components/RouteModal";
import { PrazoDetalhe } from "@/components/detalhe/PrazoDetalhe";
import { DiasBox, SegredoTag, Gate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PrazoModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getPrazoPorId(id);
  if (!p) notFound();

  return (
    <RouteModal
      title={
        <>
          <h2>{p.ato}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <DiasBox dias={p.dias_restantes} />
            <SegredoTag on={p.segredo} />
            <Gate validado={p.validado} />
          </div>
        </>
      }
    >
      <PrazoDetalhe p={p} />
    </RouteModal>
  );
}

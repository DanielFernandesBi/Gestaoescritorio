import { notFound } from "next/navigation";
import { getAudienciaPorId } from "@/lib/data";
import { RouteModal } from "@/components/RouteModal";
import { AudienciaDetalhe } from "@/components/detalhe/AudienciaDetalhe";
import { Pill, SegredoTag, Gate } from "@/components/ui";
import { humano } from "@/lib/format";

export const dynamic = "force-dynamic";

const modTone = (m: string | null) =>
  m === "presencial" ? "gray" : m === "videoconferencia" ? "blue" : "amber";

export default async function AudienciaModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const aud = await getAudienciaPorId(id);
  if (!aud) notFound();

  return (
    <RouteModal
      title={
        <>
          <h2>{humano(aud.tipo)}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill tone={modTone(aud.modalidade)}>{humano(aud.modalidade)}</Pill>
            <SegredoTag on={aud.segredo} />
            <Gate validado={aud.validado} />
          </div>
        </>
      }
    >
      <AudienciaDetalhe aud={aud} />
    </RouteModal>
  );
}

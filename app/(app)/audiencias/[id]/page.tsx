import Link from "next/link";
import { notFound } from "next/navigation";
import { getAudienciaPorId } from "@/lib/data";
import { AudienciaDetalhe } from "@/components/detalhe/AudienciaDetalhe";
import { Pill, SegredoTag, Gate } from "@/components/ui";
import { fmtDate, fmtTime, humano } from "@/lib/format";

export const dynamic = "force-dynamic";

const modTone = (m: string | null) =>
  m === "presencial" ? "gray" : m === "videoconferencia" ? "blue" : "amber";

export default async function AudienciaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const aud = await getAudienciaPorId(id);
  if (!aud) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link className="link" href="/audiencias">← Audiências</Link>
            {" · "}{fmtDate(aud.data_hora)} {fmtTime(aud.data_hora)}
          </div>
          <h1>{humano(aud.tipo)}</h1>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Pill tone={modTone(aud.modalidade)}>{humano(aud.modalidade)}</Pill>
            <SegredoTag on={aud.segredo} />
            <Gate validado={aud.validado} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          <AudienciaDetalhe aud={aud} />
        </div>
      </div>
    </>
  );
}

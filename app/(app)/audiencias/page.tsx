import { getAudiencias } from "@/lib/data";
import { AudienciasList } from "@/components/modules/AudienciasList";

export const dynamic = "force-dynamic";

export default async function AudienciasPage() {
  const audiencias = await getAudiencias();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Designações</div>
          <h1>Audiências</h1>
          <p>Instrução, custódia, júri e sessões de julgamento — presencial, vídeo ou híbrida.</p>
        </div>
      </div>

      <AudienciasList audiencias={audiencias} />
    </>
  );
}

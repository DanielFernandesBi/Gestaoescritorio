import { getAudienciasPainel } from "@/lib/data";
import { AudienciasView } from "@/components/modules/AudienciasView";

export const dynamic = "force-dynamic";

export default async function AudienciasPage() {
  const audiencias = await getAudienciasPainel();
  return <AudienciasView audiencias={audiencias} />;
}

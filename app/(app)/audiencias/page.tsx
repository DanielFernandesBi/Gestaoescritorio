import { getAudienciasPainel } from "@/lib/data";
import { AudienciasView } from "@/components/modules/AudienciasView";
import { AudienciaMaster } from "@/components/detalhe/AudienciaPainel";
import { ListaRaiz } from "@/components/ListaRaiz";

export const dynamic = "force-dynamic";

export default async function AudienciasPage() {
  const audiencias = await getAudienciasPainel();
  return (
    <ListaRaiz indice={<AudienciaMaster lista={audiencias} />}>
      <AudienciasView audiencias={audiencias} />
    </ListaRaiz>
  );
}

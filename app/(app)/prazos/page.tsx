import { getPrazosPainel, getPrazosOrfaos } from "@/lib/data";
import { PrazosView } from "@/components/modules/PrazosView";
import { PrazoMaster } from "@/components/detalhe/PrazoPainel";
import { ListaRaiz } from "@/components/ListaRaiz";

export const dynamic = "force-dynamic";

export default async function PrazosPage() {
  const [prazos, orfaos] = await Promise.all([getPrazosPainel(), getPrazosOrfaos()]);
  return (
    <ListaRaiz indice={<PrazoMaster lista={prazos} />}>
      <PrazosView prazos={prazos} orfaos={orfaos} />
    </ListaRaiz>
  );
}

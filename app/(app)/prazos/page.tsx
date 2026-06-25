import { getPrazosPainel, getPrazosOrfaos } from "@/lib/data";
import { PrazosView } from "@/components/modules/PrazosView";

export const dynamic = "force-dynamic";

export default async function PrazosPage() {
  const [prazos, orfaos] = await Promise.all([getPrazosPainel(), getPrazosOrfaos()]);
  return <PrazosView prazos={prazos} orfaos={orfaos} />;
}

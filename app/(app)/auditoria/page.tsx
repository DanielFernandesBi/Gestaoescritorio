import { getAuditoriaPainel } from "@/lib/data";
import { AuditoriaView } from "@/components/modules/AuditoriaView";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const { eventos, contadores, total } = await getAuditoriaPainel();
  return <AuditoriaView eventos={eventos} contadores={contadores} total={total} />;
}

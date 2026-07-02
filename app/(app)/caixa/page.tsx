import { getCaixaTrabalho } from "@/lib/data";
import { CaixaView } from "@/components/modules/CaixaView";

export const dynamic = "force-dynamic";

export default async function CaixaPage() {
  const processos = await getCaixaTrabalho();
  return <CaixaView processos={processos} />;
}

import { getCaixaTrabalho } from "@/lib/data";
import { CaixaView } from "@/components/modules/CaixaView";

export const dynamic = "force-dynamic";

export default async function CaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ foco?: string }>;
}) {
  const { foco } = await searchParams;
  const processos = await getCaixaTrabalho();
  return <CaixaView processos={processos} foco={foco ?? null} />;
}

import { notFound } from "next/navigation";
import { getPrazoFull, getPrazosPainel, getAnotacoes } from "@/lib/data";
import { PrazoPainel } from "@/components/detalhe/PrazoPainel";

export const dynamic = "force-dynamic";

export default async function PrazoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [p, lista, anotacoes] = await Promise.all([
    getPrazoFull(id),
    getPrazosPainel(),
    getAnotacoes("prazo", id),
  ]);
  if (!p) notFound();

  return <PrazoPainel p={p} lista={lista} anotacoes={anotacoes} />;
}

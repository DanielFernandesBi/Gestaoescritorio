import { notFound } from "next/navigation";
import { getProcessoFull, getProcessos, getAnotacoes } from "@/lib/data";
import { ProcessoPainel } from "@/components/detalhe/ProcessoPainel";

export const dynamic = "force-dynamic";

export default async function ProcessoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [p, lista, anotacoes] = await Promise.all([
    getProcessoFull(id),
    getProcessos(),
    getAnotacoes("processo", id),
  ]);
  if (!p) notFound();

  return <ProcessoPainel p={p} lista={lista} anotacoes={anotacoes} />;
}

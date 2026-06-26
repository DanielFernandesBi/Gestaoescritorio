import { notFound } from "next/navigation";
import { getIntimacaoFull, getIntimacoes, getMapaProvidenciaPeca, getAnotacoes } from "@/lib/data";
import { IntimacaoPainel } from "@/components/detalhe/IntimacaoPainel";

export const dynamic = "force-dynamic";

export default async function IntimacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [i, lista, mapa, anotacoes] = await Promise.all([
    getIntimacaoFull(id),
    getIntimacoes(),
    getMapaProvidenciaPeca(),
    getAnotacoes("intimacao", id),
  ]);
  if (!i) notFound();

  return <IntimacaoPainel i={i} lista={lista} mapa={mapa} anotacoes={anotacoes} />;
}

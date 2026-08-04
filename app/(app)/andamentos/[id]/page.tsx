import { notFound } from "next/navigation";
import { getAndamentoFull, getAndamentos, getMapaProvidenciaPeca, getAnotacoes } from "@/lib/data";
import { AndamentoPainel } from "@/components/detalhe/AndamentoPainel";

export const dynamic = "force-dynamic";

export default async function AndamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { id } = await params;
  const { f } = await searchParams;
  const [a, lista, mapa, anotacoes] = await Promise.all([
    getAndamentoFull(id),
    getAndamentos(),
    getMapaProvidenciaPeca(),
    getAnotacoes("andamento", id),
  ]);
  if (!a) notFound();

  return (
    <AndamentoPainel
      a={a}
      lista={lista}
      mapa={mapa}
      anotacoes={anotacoes}
      filtroInicial={f === "escalados" ? "escalados" : f === "conferir" ? "conferir" : "recentes"}
    />
  );
}

import { notFound } from "next/navigation";
import { getEstudoFull, getAnotacoes } from "@/lib/data";
import { EstudoPainel } from "@/components/detalhe/EstudoPainel";

export const dynamic = "force-dynamic";

export default async function EstudoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [e, anotacoes] = await Promise.all([
    getEstudoFull(id),
    getAnotacoes("estudo", id),
  ]);
  if (!e) notFound();

  return <EstudoPainel e={e} anotacoes={anotacoes} />;
}

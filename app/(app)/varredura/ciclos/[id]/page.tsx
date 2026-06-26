import { notFound } from "next/navigation";
import { getVarreduraPorId, getVarreduras } from "@/lib/queries";
import { getAnotacoes } from "@/lib/data";
import { VarreduraCicloPainel } from "@/components/detalhe/VarreduraCicloPainel";

export const dynamic = "force-dynamic";

export default async function VarreduraCicloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ciclo, lista, anotacoes] = await Promise.all([
    getVarreduraPorId(id),
    getVarreduras(30),
    getAnotacoes("varredura", id),
  ]);
  if (!ciclo) notFound();

  return <VarreduraCicloPainel ciclo={ciclo} lista={lista} anotacoes={anotacoes} />;
}

import { notFound } from "next/navigation";
import { getVarreduraItens, type VarreduraTipo } from "@/lib/data";
import { VarreduraPainel } from "@/components/detalhe/VarreduraPainel";

export const dynamic = "force-dynamic";

const TIPOS: VarreduraTipo[] = ["intimacoes", "andamentos", "prazos", "minutas"];

export default async function VarreduraPage({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!TIPOS.includes(tipo as VarreduraTipo)) notFound();
  const { titulo, quando, itens } = await getVarreduraItens(tipo as VarreduraTipo);

  return <VarreduraPainel tipo={tipo as VarreduraTipo} titulo={titulo} quando={quando} itens={itens} />;
}

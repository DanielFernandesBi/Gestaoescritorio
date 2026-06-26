import { notFound } from "next/navigation";
import { getContratoPorId, getContratos, getDocumentosContrato, getAnotacoes } from "@/lib/data";
import { ContratoPainel } from "@/components/detalhe/ContratoPainel";

export const dynamic = "force-dynamic";

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, lista, documentos, anotacoes] = await Promise.all([
    getContratoPorId(id),
    getContratos(),
    getDocumentosContrato(id),
    getAnotacoes("contrato", id),
  ]);
  if (!c) notFound();

  return <ContratoPainel c={c} lista={lista} documentos={documentos} anotacoes={anotacoes} />;
}

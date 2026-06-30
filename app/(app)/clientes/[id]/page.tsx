import { notFound } from "next/navigation";
import { getClienteFull, getClientes, getAnotacoes, getExecucaoCliente, getDocumentosCliente, getClienteFicha } from "@/lib/data";
import { ClientePainel } from "@/components/detalhe/ClientePainel";

export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [p, lista, anotacoes, exec, documentos, ficha] = await Promise.all([
    getClienteFull(id),
    getClientes(),
    getAnotacoes("cliente", id),
    getExecucaoCliente(id),
    getDocumentosCliente(id),
    getClienteFicha(id),
  ]);
  if (!p) notFound();

  return <ClientePainel p={p} lista={lista} anotacoes={anotacoes} exec={exec} documentos={documentos} ficha={ficha} />;
}

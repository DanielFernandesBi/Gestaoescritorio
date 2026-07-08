import { notFound } from "next/navigation";
import { getClienteFull, getClientes, getAnotacoesDoCliente, getExecucaoCliente, getDocumentosCliente, getClienteFicha } from "@/lib/data";
import { getUserId } from "@/lib/queries";
import { ClientePainel } from "@/components/detalhe/ClientePainel";

export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [p, lista, anotacoes, exec, documentos, ficha, meuId] = await Promise.all([
    getClienteFull(id),
    getClientes(),
    getAnotacoesDoCliente(id),
    getExecucaoCliente(id),
    getDocumentosCliente(id),
    getClienteFicha(id),
    getUserId(),
  ]);
  if (!p) notFound();

  return <ClientePainel p={p} lista={lista} anotacoes={anotacoes} exec={exec} documentos={documentos} ficha={ficha} meuId={meuId} />;
}

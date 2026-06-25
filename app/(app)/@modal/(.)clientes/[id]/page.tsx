import { notFound } from "next/navigation";
import { getClientePorId } from "@/lib/data";
import { RouteModal } from "@/components/RouteModal";
import { ClienteDetalhe } from "@/components/detalhe/ClienteDetalhe";
import { Pill } from "@/components/ui";
import { humano } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClienteModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cliente = await getClientePorId(id);
  if (!cliente) notFound();

  return (
    <RouteModal
      title={
        <>
          <h2 className="nome-cliente">{cliente.nome}</h2>
          <div style={{ marginTop: 8 }}><Pill tone="gray">{humano(cliente.situacao_prisional)}</Pill></div>
        </>
      }
    >
      <ClienteDetalhe cliente={cliente} />
    </RouteModal>
  );
}

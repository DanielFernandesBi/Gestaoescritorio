import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientePorId } from "@/lib/data";
import { ClienteDetalhe } from "@/components/detalhe/ClienteDetalhe";
import { Pill } from "@/components/ui";
import { humano } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cliente = await getClientePorId(id);
  if (!cliente) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link className="link" href="/clientes">← Clientes</Link>
            {cliente.cadastro_automatico ? " · cadastro automático" : ""}
          </div>
          <h1 className="nome-cliente">{cliente.nome}</h1>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Pill tone="gray">{humano(cliente.situacao_prisional)}</Pill>
            {cliente.favorito && <Pill tone="brass" dot={false}>★ favorito</Pill>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          <ClienteDetalhe cliente={cliente} />
        </div>
      </div>
    </>
  );
}

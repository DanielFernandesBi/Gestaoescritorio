import { getClientes } from "@/lib/data";
import { ClientesList } from "@/components/modules/ClientesList";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clientes = await getClientes();
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{clientes.length} ativos</div>
          <h1>Clientes</h1>
          <p>Dados pessoais, situação prisional e contato da família. Dedup por nome normalizado / CPF.</p>
        </div>
      </div>
      <ClientesList clientes={clientes} />
    </>
  );
}

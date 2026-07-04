import { getPecas, getPecasProtocoladas } from "@/lib/data";
import { getUserEmail } from "@/lib/queries";
import { socioDoEmail } from "@/lib/allowlist";
import { ProducaoBoard, NovaPeca, ReanalisarFila } from "@/components/modules/ProducaoBoard";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function ProducaoPage() {
  const [pecas, protocoladas, email] = await Promise.all([getPecas(), getPecasProtocoladas(), getUserEmail()]);
  const socio = socioDoEmail(email);
  return (
    <>
      <PageHeader
        breadcrumb={["Trabalho", "Produção · peças"]}
        eyebrow="Operação · backlog de escrita"
        titulo="Produção de peças"
        descricao={
          <>
            Iniciais, recursos e manifestações a produzir. Fecha o ciclo
            intimação → prazo → PEÇA → andamento. Arraste entre as colunas para mover.
          </>
        }
        acoes={
          <>
            <ReanalisarFila />
            <NovaPeca />
          </>
        }
      />
      <ProducaoBoard pecas={pecas} protocoladas={protocoladas} socio={socio} />
    </>
  );
}

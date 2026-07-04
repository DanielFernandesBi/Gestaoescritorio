import { getPecas, getPecasProtocoladas } from "@/lib/data";
import { getUserEmail } from "@/lib/queries";
import { socioDoEmail } from "@/lib/allowlist";
import { ProducaoBoard, NovaPeca, ReanalisarFila } from "@/components/modules/ProducaoBoard";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function ProducaoPage() {
  const [pecas, protocoladas, email] = await Promise.all([getPecas(), getPecasProtocoladas(), getUserEmail()]);
  const socio = socioDoEmail(email);
  const nAFazer = pecas.filter((p) => p.status === "a_fazer").length;
  const nAguardando = pecas.filter((p) => p.status === "aguardando_insumo").length;
  const nRevisao = pecas.filter((p) => p.status === "em_revisao").length;
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
        kpis={[
          { valor: nAFazer, label: "a fazer · backlog", tone: "neutral" },
          { valor: nAguardando, label: "aguardando insumo", tone: "amber" },
          { valor: nRevisao, label: "em revisão · minutas IA", tone: "accent" },
          { valor: pecas.length, label: "peças ativas · total", tone: "neutral" },
        ]}
      />
      <ProducaoBoard pecas={pecas} protocoladas={protocoladas} socio={socio} />
    </>
  );
}

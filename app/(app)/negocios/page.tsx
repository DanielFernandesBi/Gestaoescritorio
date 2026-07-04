import { getFunilNegocios } from "@/lib/data";
import { FunilNegocios, NovoNegocio } from "@/components/modules/FunilNegocios";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function NegociosPage() {
  const oportunidades = await getFunilNegocios();
  const ativas = oportunidades.filter((o) => !o.encerrado);
  const emTratativa = ativas.filter((o) => o.estagio === "tratativa").length;
  const emNegociacao = ativas.filter((o) => o.estagio === "negociacao").length;
  const fechados = ativas.filter((o) => o.estagio === "fechado").length;
  return (
    <>
      <PageHeader
        breadcrumb={["Gestão", "Novos negócios"]}
        eyebrow="Captação · pré-contrato"
        titulo="Novos negócios"
        descricao={
          <>
            Funil da primeira tratativa ao fechamento. Ao fechar, converta em cliente — cria o cadastro
            (sem duplicar), o contrato e as parcelas, mantendo a oportunidade como origem rastreável.
          </>
        }
        acoes={<NovoNegocio />}
        kpis={[
          { valor: emTratativa, label: "em tratativa", tone: "neutral" },
          { valor: emNegociacao, label: "em negociação", tone: "amber" },
          { valor: fechados, label: "fechados · a converter", tone: "green" },
          { valor: ativas.length, label: "ativas no funil", tone: "accent" },
        ]}
      />
      <FunilNegocios oportunidades={oportunidades} />
    </>
  );
}

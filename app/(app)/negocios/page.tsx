import { getFunilNegocios } from "@/lib/data";
import { FunilNegocios, NovoNegocio } from "@/components/modules/FunilNegocios";

export const dynamic = "force-dynamic";

export default async function NegociosPage() {
  const oportunidades = await getFunilNegocios();
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Captação · pré-contrato</div>
          <h1>Novos negócios</h1>
          <p>
            Funil da primeira tratativa ao fechamento. Ao fechar, converta em cliente — cria o cadastro
            (sem duplicar), o contrato e as parcelas, mantendo a oportunidade como origem rastreável.
          </p>
        </div>
        <NovoNegocio />
      </div>
      <FunilNegocios oportunidades={oportunidades} />
    </>
  );
}

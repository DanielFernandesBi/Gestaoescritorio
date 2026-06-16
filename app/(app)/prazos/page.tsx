import { getPrazos, getPrazosOrfaos } from "@/lib/data";
import { PrazosModulo } from "@/components/modules/PrazosModulo";

export const dynamic = "force-dynamic";

export default async function PrazosPage() {
  const [prazos, orfaos] = await Promise.all([getPrazos(), getPrazosOrfaos()]);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">CPP art. 798 · dias corridos · peremptórios</div>
          <h1>Prazos penais</h1>
          <p>
            Exclui-se o dia do começo, inclui-se o do vencimento. Fatal em fim de
            semana/feriado prorroga para o 1º dia útil — conferir feriado local.
          </p>
        </div>
      </div>
      <PrazosModulo prazos={prazos} orfaos={orfaos} />
    </>
  );
}

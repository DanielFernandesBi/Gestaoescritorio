import { getPrazos } from "@/lib/data";
import { PrazosList } from "@/components/modules/PrazosList";

export const dynamic = "force-dynamic";

export default async function PrazosPage() {
  const prazos = await getPrazos();
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
      <PrazosList prazos={prazos} />
    </>
  );
}

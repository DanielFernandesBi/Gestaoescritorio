import { getPrazosOrfaos, getAndamentosOrfaos, getIntimacoes } from "@/lib/data";
import { TriagemView } from "@/components/modules/TriagemView";

export const dynamic = "force-dynamic";

export default async function TriagemPage() {
  const [prazos, andamentos, intimacoes] = await Promise.all([
    getPrazosOrfaos(),
    getAndamentosOrfaos(),
    getIntimacoes(),
  ]);
  const intimacoesOrfas = intimacoes.filter((i) => i.orfa);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Fila de triagem · captura sem processo</div>
          <h1>Triagem · órfãos</h1>
          <p>
            Itens capturados sem processo identificado — <b>nunca descartados</b>. Promover vincula ao
            processo (dedup + resolução de mesclagem) e libera o item.
          </p>
        </div>
      </div>
      <TriagemView prazos={prazos} intimacoes={intimacoesOrfas} andamentos={andamentos} />
    </>
  );
}

import { getPrazosOrfaos, getAndamentosOrfaos, getIntimacoes } from "@/lib/data";
import { TriagemView } from "@/components/modules/TriagemView";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function TriagemPage() {
  const [prazos, andamentos, intimacoes] = await Promise.all([
    getPrazosOrfaos(),
    getAndamentosOrfaos(),
    getIntimacoes(),
  ]);
  const intimacoesOrfas = intimacoes.filter((i) => i.orfa);
  const totalOrfaos = prazos.length + intimacoesOrfas.length + andamentos.length;

  return (
    <>
      <PageHeader
        breadcrumb={["Entrada · IA", "Triagem · órfãos"]}
        eyebrow="Fila de triagem · captura sem processo"
        titulo="Triagem · órfãos"
        descricao={
          <>
            Itens capturados sem processo identificado — <b>nunca descartados</b>. Promover vincula ao
            processo (dedup + resolução de mesclagem) e libera o item.
          </>
        }
        kpis={[
          { valor: prazos.length, label: "prazos órfãos · fatais vivas", tone: "amber" },
          { valor: intimacoesOrfas.length, label: "intimações órfãs", tone: "amber" },
          { valor: andamentos.length, label: "andamentos órfãos", tone: "neutral" },
          { valor: totalOrfaos, label: "na fila · total", tone: "accent" },
        ]}
      />
      <TriagemView prazos={prazos} intimacoes={intimacoesOrfas} andamentos={andamentos} />
    </>
  );
}

import { notFound } from "next/navigation";
import { getIntimacaoPorId, getMapaProvidenciaPeca } from "@/lib/data";
import { RouteModal } from "@/components/RouteModal";
import { IntimacaoDetalhe } from "@/components/detalhe/IntimacaoDetalhe";
import { Pill, SegredoTag } from "@/components/ui";
import { humano } from "@/lib/format";

export const dynamic = "force-dynamic";

const tone = (s: string) =>
  s === "pendente" ? "amber" : s === "providencia_tomada" ? "green" : s === "em_analise" ? "blue" : "gray";

export default async function IntimacaoModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [i, mapa] = await Promise.all([getIntimacaoPorId(id), getMapaProvidenciaPeca()]);
  if (!i) notFound();

  return (
    <RouteModal
      title={
        <>
          <h2>{i.resumo ?? "Intimação"}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill tone={tone(i.status)}>{humano(i.status)}</Pill>
            <SegredoTag on={i.segredo} />
            {i.orfa && <Pill tone="amber">órfã</Pill>}
          </div>
        </>
      }
    >
      <IntimacaoDetalhe i={i} mapa={mapa} />
    </RouteModal>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getIntimacaoPorId, getMapaProvidenciaPeca } from "@/lib/data";
import { IntimacaoDetalhe } from "@/components/detalhe/IntimacaoDetalhe";
import { Pill, SegredoTag } from "@/components/ui";
import { humano } from "@/lib/format";

export const dynamic = "force-dynamic";

const tone = (s: string) =>
  s === "pendente" ? "amber" : s === "providencia_tomada" ? "green" : s === "em_analise" ? "blue" : "gray";

export default async function IntimacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [i, mapa] = await Promise.all([getIntimacaoPorId(id), getMapaProvidenciaPeca()]);
  if (!i) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link className="link" href="/intimacoes">← Intimações</Link>
            {" · "}{(i.origem ?? "—").toUpperCase()}
          </div>
          <h1>{i.resumo ?? "Intimação"}</h1>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Pill tone={tone(i.status)}>{humano(i.status)}</Pill>
            <SegredoTag on={i.segredo} />
            {i.orfa && <Pill tone="amber">órfã</Pill>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          <IntimacaoDetalhe i={i} mapa={mapa} />
        </div>
      </div>
    </>
  );
}

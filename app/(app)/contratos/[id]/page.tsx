import Link from "next/link";
import { notFound } from "next/navigation";
import { getContratoPorId } from "@/lib/data";
import { ContratoDetalhe } from "@/components/detalhe/ContratoDetalhe";
import { Pill } from "@/components/ui";
import { fmtBRL, humano } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONE: Record<string, "green" | "amber" | "red" | "gray"> = {
  vigente: "green", quitado: "gray", rescindido: "red", inadimplente: "red",
};

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getContratoPorId(id);
  if (!c) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link className="link" href="/financeiro">← Financeiro</Link></div>
          <h1>{c.cliente}</h1>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Pill tone={TONE[c.status] ?? "gray"}>{humano(c.status)}</Pill>
            <span className="sub">{fmtBRL(c.valor_total)}</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-b">
          <ContratoDetalhe contrato={c} />
        </div>
      </div>
    </>
  );
}

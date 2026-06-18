import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompromissoPorId } from "@/lib/data";
import { CompromissoDetalhe } from "@/components/detalhe/CompromissoDetalhe";
import { Pill } from "@/components/ui";
import { fmtDate, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONE: Record<string, "green" | "amber" | "red" | "gray"> = {
  agendado: "green", realizado: "gray", cancelado: "red",
};

export default async function CompromissoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCompromissoPorId(id);
  if (!c) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link className="link" href="/painel">← Painel</Link></div>
          <h1>{c.titulo}</h1>
          {c.cliente && <div className="sub" style={{ marginTop: 4 }}>{c.cliente}</div>}
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Pill tone={TONE[c.status] ?? "gray"}>{c.status}</Pill>
            <span className="sub mono">{fmtDate(c.data_hora)} {fmtTime(c.data_hora)}</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-b">
          <CompromissoDetalhe c={c} />
        </div>
      </div>
    </>
  );
}

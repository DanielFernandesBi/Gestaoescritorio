import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrazoPorId } from "@/lib/data";
import { PrazoDetalhe } from "@/components/detalhe/PrazoDetalhe";
import { DiasBox, SegredoTag, Gate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PrazoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getPrazoPorId(id);
  if (!p) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link className="link" href="/prazos">← Prazos</Link>
            {p.orfao ? " · órfão" : ""}
          </div>
          <h1>{p.ato}</h1>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <DiasBox dias={p.dias_restantes} />
            <SegredoTag on={p.segredo} />
            <Gate validado={p.validado} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          <PrazoDetalhe p={p} />
        </div>
      </div>
    </>
  );
}

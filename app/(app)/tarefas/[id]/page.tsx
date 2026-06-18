import Link from "next/link";
import { notFound } from "next/navigation";
import { getTarefaPorId, getMapaProvidenciaPeca } from "@/lib/data";
import { getUserEmail } from "@/lib/queries";
import { socioDoEmail } from "@/lib/allowlist";
import { TarefaDetalhe } from "@/components/detalhe/TarefaDetalhe";
import { Pill } from "@/components/ui";
import { humano } from "@/lib/format";

export const dynamic = "force-dynamic";

const priTone = (p: string | null): "red" | "amber" | "gray" =>
  p === "urgente" ? "red" : p === "alta" ? "amber" : "gray";

export default async function TarefaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, mapa, email] = await Promise.all([
    getTarefaPorId(id),
    getMapaProvidenciaPeca(),
    getUserEmail(),
  ]);
  if (!t) notFound();
  const socio = socioDoEmail(email);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link className="link" href="/tarefas">← Tarefas</Link></div>
          <h1>{t.titulo}</h1>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Pill tone={priTone(t.prioridade)}>{humano(t.prioridade)}</Pill>
            <Pill tone="gray" dot={false}>{humano(t.status)}</Pill>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-b">
          <TarefaDetalhe t={t} mapa={mapa} socio={socio} />
        </div>
      </div>
    </>
  );
}

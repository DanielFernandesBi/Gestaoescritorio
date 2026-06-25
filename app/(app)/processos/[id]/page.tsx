import Link from "next/link";
import { notFound } from "next/navigation";
import { getProcessoPorId } from "@/lib/data";
import { ProcessoDetalhe } from "@/components/detalhe/ProcessoDetalhe";
import { ProcRef, SegredoTag, Pill } from "@/components/ui";
import { humano } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProcessoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proc = await getProcessoPorId(id);
  if (!proc) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link className="link" href="/processos">← Processos</Link>
            {proc.cadastro_automatico ? " · cadastro automático" : ""}
          </div>
          <h1 className="nome-cliente">{proc.segredo ? "Processo em segredo de justiça" : proc.clientes || "Processo"}</h1>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <ProcRef cnj={proc.numero_cnj} registro={proc.numero_registro} />
            <SegredoTag on={proc.segredo} />
            <Pill tone={proc.status === "ativo" ? "green" : "gray"} dot={false}>{humano(proc.status)}</Pill>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          <ProcessoDetalhe proc={proc} />
        </div>
      </div>
    </>
  );
}

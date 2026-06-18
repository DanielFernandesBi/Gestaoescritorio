import Link from "next/link";
import { notFound } from "next/navigation";
import { getVarreduraItens, type VarreduraTipo } from "@/lib/data";
import { VarreduraItens } from "@/components/detalhe/VarreduraItens";
import { fmtDate, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const TIPOS: VarreduraTipo[] = ["intimacoes", "andamentos", "prazos"];

export default async function VarreduraPage({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!TIPOS.includes(tipo as VarreduraTipo)) notFound();
  const { titulo, quando, itens } = await getVarreduraItens(tipo as VarreduraTipo);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link className="link" href="/painel">← Painel</Link></div>
          <h1>{titulo}</h1>
          <p>
            {itens.length} {itens.length === 1 ? "item" : "itens"} desta varredura
            {quando ? ` · ${fmtDate(quando)} ${fmtTime(quando)}` : ""}.
          </p>
        </div>
      </div>
      <div className="card">
        <div className="card-b flush">
          <VarreduraItens itens={itens} />
        </div>
      </div>
    </>
  );
}

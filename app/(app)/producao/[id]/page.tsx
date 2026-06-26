import { notFound } from "next/navigation";
import { getPecaFull, getPecas, getAnotacoes, getRadarRecente } from "@/lib/data";
import { PecaPainel } from "@/components/detalhe/PecaPainel";

export const dynamic = "force-dynamic";

export default async function PecaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, lista, anotacoes, acervo] = await Promise.all([
    getPecaFull(id),
    getPecas(),
    getAnotacoes("peca", id),
    getRadarRecente(),
  ]);
  if (!p) notFound();

  return <PecaPainel p={p} lista={lista} anotacoes={anotacoes} acervo={acervo.filter((r) => r.candidato_acervo)} />;
}

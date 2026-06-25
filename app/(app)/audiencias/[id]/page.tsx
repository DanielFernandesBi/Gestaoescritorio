import { notFound } from "next/navigation";
import { getAudienciaPorId, getAudienciasPainel, getAnotacoes } from "@/lib/data";
import { AudienciaPainel } from "@/components/detalhe/AudienciaPainel";

export const dynamic = "force-dynamic";

export default async function AudienciaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [aud, lista, anotacoes] = await Promise.all([
    getAudienciaPorId(id),
    getAudienciasPainel(),
    getAnotacoes("audiencia", id),
  ]);
  if (!aud) notFound();

  return <AudienciaPainel aud={aud} lista={lista} anotacoes={anotacoes} />;
}

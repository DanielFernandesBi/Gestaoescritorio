import { notFound } from "next/navigation";
import { getTarefaFull, getTarefasPainel, getMapaProvidenciaPeca, getAnotacoes } from "@/lib/data";
import { getUserEmail } from "@/lib/queries";
import { socioDoEmail } from "@/lib/allowlist";
import { TarefaPainel } from "@/components/detalhe/TarefaPainel";

export const dynamic = "force-dynamic";

export default async function TarefaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, lista, mapa, anotacoes, email] = await Promise.all([
    getTarefaFull(id),
    getTarefasPainel(),
    getMapaProvidenciaPeca(),
    getAnotacoes("tarefa", id),
    getUserEmail(),
  ]);
  if (!t) notFound();
  const socio = socioDoEmail(email);

  return <TarefaPainel t={t} lista={lista} anotacoes={anotacoes} mapa={mapa} socio={socio} />;
}

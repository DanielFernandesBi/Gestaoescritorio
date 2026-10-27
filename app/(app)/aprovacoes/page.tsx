import { getAprovacoesPendentes, getAprovacoesResumo, getUltimaVarreduraCatalogo } from "@/lib/data";
import { AprovacoesView } from "@/components/modules/AprovacoesView";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  const [itens, resumo, varredura] = await Promise.all([
    getAprovacoesPendentes(),
    getAprovacoesResumo(),
    getUltimaVarreduraCatalogo(),
  ]);
  return <AprovacoesView itens={itens} resumo={resumo} varredura={varredura} />;
}

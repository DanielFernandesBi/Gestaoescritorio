import { getSugestoes, getEstruturaBanco, getMigracoesCount } from "@/lib/data";
import { SistemaView } from "@/components/modules/SistemaView";

export const dynamic = "force-dynamic";

export default async function SistemaPage() {
  const [sugestoes, estrutura, migracoesCount] = await Promise.all([
    getSugestoes(),
    getEstruturaBanco(),
    getMigracoesCount(),
  ]);
  return <SistemaView sugestoes={sugestoes} estrutura={estrutura} migracoesCount={migracoesCount} />;
}

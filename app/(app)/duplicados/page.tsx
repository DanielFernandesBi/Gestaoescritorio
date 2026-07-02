import {
  getClientesDuplicados,
  getClientesSimilares,
  getProcessosReconciliacao,
  getProcessosPossiveisDuplicatas,
  getDuplicadosContadores,
  getTombstonesResolvidos,
} from "@/lib/data";
import { DuplicadosView } from "@/components/modules/DuplicadosView";

export const dynamic = "force-dynamic";

export default async function DuplicadosPage() {
  const [contadores, clusters, similares, possiveis, processos, tombstones] = await Promise.all([
    getDuplicadosContadores(),
    getClientesDuplicados(),
    getClientesSimilares(),
    getProcessosPossiveisDuplicatas(),
    getProcessosReconciliacao(),
    getTombstonesResolvidos(),
  ]);

  return (
    <DuplicadosView
      contadores={contadores}
      clusters={clusters}
      similares={similares}
      possiveis={possiveis}
      processos={processos}
      tombstones={tombstones}
    />
  );
}

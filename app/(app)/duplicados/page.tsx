import {
  getClientesDuplicados,
  getProcessosReconciliacao,
  getProcessosPossiveisDuplicatas,
  getDuplicadosContadores,
  getTombstonesResolvidos,
} from "@/lib/data";
import { DuplicadosView } from "@/components/modules/DuplicadosView";

export const dynamic = "force-dynamic";

export default async function DuplicadosPage() {
  const [contadores, clusters, possiveis, processos, tombstones] = await Promise.all([
    getDuplicadosContadores(),
    getClientesDuplicados(),
    getProcessosPossiveisDuplicatas(),
    getProcessosReconciliacao(),
    getTombstonesResolvidos(),
  ]);

  return (
    <DuplicadosView
      contadores={contadores}
      clusters={clusters}
      possiveis={possiveis}
      processos={processos}
      tombstones={tombstones}
    />
  );
}

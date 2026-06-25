import {
  getClientesDuplicados,
  getProcessosReconciliacao,
  getDuplicadosContadores,
  getTombstonesResolvidos,
} from "@/lib/data";
import { DuplicadosView } from "@/components/modules/DuplicadosView";

export const dynamic = "force-dynamic";

export default async function DuplicadosPage() {
  const [contadores, clusters, processos, tombstones] = await Promise.all([
    getDuplicadosContadores(),
    getClientesDuplicados(),
    getProcessosReconciliacao(),
    getTombstonesResolvidos(),
  ]);

  return (
    <DuplicadosView
      contadores={contadores}
      clusters={clusters}
      processos={processos}
      tombstones={tombstones}
    />
  );
}

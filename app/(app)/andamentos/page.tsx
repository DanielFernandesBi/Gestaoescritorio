import { getAndamentos, getAndamentosOrfaos, getConferenciasPendentes, getMapaProvidenciaPeca } from "@/lib/data";
import { AndamentosModulo } from "@/components/modules/AndamentosModulo";
import { RegistrarAndamento } from "@/components/modules/RegistrarAndamento";

export const dynamic = "force-dynamic";

export default async function AndamentosPage() {
  const [movimentacoes, orfaos, conferencias, mapa] = await Promise.all([
    getAndamentos(),
    getAndamentosOrfaos(),
    // Fila de conferência SEM janela de data — o badge não tem recorte temporal,
    // e a tela precisa enxergar o mesmo conjunto (ver getConferenciasPendentes).
    getConferenciasPendentes(),
    getMapaProvidenciaPeca(),
  ]);
  return (
    <AndamentosModulo
      movimentacoes={movimentacoes}
      orfaos={orfaos}
      conferencias={conferencias}
      mapa={mapa}
      acoes={<RegistrarAndamento />}
    />
  );
}

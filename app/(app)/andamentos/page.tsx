import { getAndamentos, getAndamentosOrfaos, getMapaProvidenciaPeca } from "@/lib/data";
import { AndamentosModulo } from "@/components/modules/AndamentosModulo";
import { RegistrarAndamento } from "@/components/modules/RegistrarAndamento";

export const dynamic = "force-dynamic";

export default async function AndamentosPage() {
  const [movimentacoes, orfaos, mapa] = await Promise.all([
    getAndamentos(),
    getAndamentosOrfaos(),
    getMapaProvidenciaPeca(),
  ]);
  return (
    <AndamentosModulo
      movimentacoes={movimentacoes}
      orfaos={orfaos}
      mapa={mapa}
      acoes={<RegistrarAndamento />}
    />
  );
}

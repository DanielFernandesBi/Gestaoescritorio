import { getAndamentos, getAndamentosOrfaos, getMapaProvidenciaPeca } from "@/lib/data";
import { AndamentosModulo } from "@/components/modules/AndamentosModulo";

export const dynamic = "force-dynamic";

export default async function AndamentosPage() {
  const [movimentacoes, orfaos, mapa] = await Promise.all([
    getAndamentos(),
    getAndamentosOrfaos(),
    getMapaProvidenciaPeca(),
  ]);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Movimentações recentes (7 dias)</div>
          <h1>Andamentos</h1>
          <p>
            Petições, decisões, HC, diligências, visitas e movimentações de tribunal.
            Dedup por código de movimentação. Órfãos (sem processo) entram na triagem.
          </p>
        </div>
      </div>
      <AndamentosModulo movimentacoes={movimentacoes} orfaos={orfaos} mapa={mapa} />
    </>
  );
}

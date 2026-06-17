import { getAndamentos, getMapaProvidenciaPeca } from "@/lib/data";
import { AndamentosTimeline } from "@/components/modules/AndamentosTimeline";

export const dynamic = "force-dynamic";

export default async function AndamentosPage() {
  const [movimentacoes, mapa] = await Promise.all([getAndamentos(), getMapaProvidenciaPeca()]);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Movimentações recentes (7 dias)</div>
          <h1>Andamentos</h1>
          <p>
            Petições, decisões, HC, diligências, visitas e movimentações de tribunal.
            Dedup por código de movimentação.
          </p>
        </div>
      </div>
      <div className="card">
        <div className="card-b">
          <AndamentosTimeline movimentacoes={movimentacoes} mapa={mapa} />
        </div>
      </div>
    </>
  );
}

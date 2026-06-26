import { getAndamentos, getAndamentosOrfaos, getMapaProvidenciaPeca } from "@/lib/data";
import { AndamentosModulo } from "@/components/modules/AndamentosModulo";
import { AndamentoMaster } from "@/components/detalhe/AndamentoPainel";
import { ListaRaiz } from "@/components/ListaRaiz";
import { RegistrarAndamento } from "@/components/modules/RegistrarAndamento";

export const dynamic = "force-dynamic";

export default async function AndamentosPage() {
  const [movimentacoes, orfaos, mapa] = await Promise.all([
    getAndamentos(),
    getAndamentosOrfaos(),
    getMapaProvidenciaPeca(),
  ]);
  return (
    <ListaRaiz indice={<AndamentoMaster lista={movimentacoes} />}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Histórico processual · captura automática</div>
          <h1>Andamentos</h1>
          <p>
            Toda movimentação útil — decisões, despachos, juntadas, pautas — capturada e deduplicada.
            São informativos; o que tem consequência é escalado para conferência.
          </p>
        </div>
        <RegistrarAndamento />
      </div>
      <AndamentosModulo movimentacoes={movimentacoes} orfaos={orfaos} mapa={mapa} />
    </ListaRaiz>
  );
}

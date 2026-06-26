import { getPecas, getPecasProtocoladas } from "@/lib/data";
import { getUserEmail } from "@/lib/queries";
import { socioDoEmail } from "@/lib/allowlist";
import { ProducaoBoard, NovaPeca, ReanalisarFila } from "@/components/modules/ProducaoBoard";
import { PecaMaster } from "@/components/detalhe/PecaPainel";
import { ListaRaiz } from "@/components/ListaRaiz";

export const dynamic = "force-dynamic";

export default async function ProducaoPage() {
  const [pecas, protocoladas, email] = await Promise.all([getPecas(), getPecasProtocoladas(), getUserEmail()]);
  const socio = socioDoEmail(email);
  return (
    <ListaRaiz indice={<PecaMaster lista={pecas} />}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operação · backlog de escrita</div>
          <h1>Produção de peças</h1>
          <p>
            Iniciais, recursos e manifestações a produzir. Fecha o ciclo
            intimação → prazo → PEÇA → andamento. Arraste entre as colunas para mover.
          </p>
        </div>
        <div className="acoes">
          <ReanalisarFila />
          <NovaPeca />
        </div>
      </div>
      <ProducaoBoard pecas={pecas} protocoladas={protocoladas} socio={socio} />
    </ListaRaiz>
  );
}

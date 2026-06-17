import { getPecas } from "@/lib/data";
import { getUserEmail } from "@/lib/queries";
import { socioDoEmail } from "@/lib/allowlist";
import { ProducaoBoard, NovaPeca } from "@/components/modules/ProducaoBoard";

export const dynamic = "force-dynamic";

export default async function ProducaoPage() {
  const [pecas, email] = await Promise.all([getPecas(), getUserEmail()]);
  const socio = socioDoEmail(email);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operação · backlog de escrita</div>
          <h1>Produção de peças</h1>
          <p>
            Iniciais, recursos e manifestações a produzir. Fecha o ciclo
            intimação → prazo → PEÇA → andamento. Arraste entre as colunas para mover.
          </p>
        </div>
        <NovaPeca />
      </div>
      <ProducaoBoard pecas={pecas} socio={socio} />
    </>
  );
}

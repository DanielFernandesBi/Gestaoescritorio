import { getPecas } from "@/lib/data";
import { ProducaoBoard, NovaPeca } from "@/components/modules/ProducaoBoard";

export const dynamic = "force-dynamic";

export default async function ProducaoPage() {
  const pecas = await getPecas();
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
      <ProducaoBoard pecas={pecas} />
    </>
  );
}

import { getTarefas } from "@/lib/data";
import { TarefasBoard } from "@/components/modules/TarefasBoard";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const tarefas = await getTarefas();
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Fluxo de trabalho</div>
          <h1>Tarefas</h1>
          <p>Vinculáveis a processo e/ou cliente. Prioridade de baixa a urgente.</p>
        </div>
      </div>
      <TarefasBoard tarefas={tarefas} />
    </>
  );
}

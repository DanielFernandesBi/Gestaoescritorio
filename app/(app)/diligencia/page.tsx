import { getConsultas, getDiligenciaFila, getSaudeApuracao } from "@/lib/data";
import { DiligenciaView } from "@/components/modules/DiligenciaView";

export const dynamic = "force-dynamic";

export default async function DiligenciaPage() {
  const [saude, pendentes, fila, todas] = await Promise.all([
    getSaudeApuracao(),
    getConsultas("pendente"),
    getDiligenciaFila(),
    getConsultas(),
  ]);
  // O livro é a mesma tabela da fila; "respondidas" é tudo que já saiu de pendente.
  const respondidas = todas.filter((c) => c.resultado && c.resultado !== "pendente").reverse();

  return <DiligenciaView saude={saude} pendentes={pendentes} fila={fila} respondidas={respondidas} />;
}

import {
  getConsultas,
  getDiligenciaFila,
  getMapaAprendizado,
  getSaudeApuracao,
  getSaudeRubrica,
} from "@/lib/data";
import { DiligenciaView } from "@/components/modules/DiligenciaView";

export const dynamic = "force-dynamic";

export default async function DiligenciaPage() {
  // O livro é a mesma tabela da fila, mas as duas metades não são a mesma coisa:
  // resposta de tribunal é visita aos autos, dispensa é curadoria (Sug. 129) e
  // chamá-las igualmente de "respondidas" seria mentir na tela. Vêm separadas do
  // banco também por volume — as dispensas são a maioria e sozinhas estourariam
  // o teto, escondendo as respostas de verdade.
  const [saude, pendentes, fila, respondidas, dispensadas, regras, rubrica] = await Promise.all([
    getSaudeApuracao(),
    getConsultas("pendente"),
    getDiligenciaFila(),
    getConsultas(["encontrado", "sem_registro", "nao_respondeu", "erro"], 200, true),
    getConsultas("dispensada", 200, true),
    getMapaAprendizado(),
    getSaudeRubrica(),
  ]);

  return (
    <DiligenciaView
      saude={saude}
      pendentes={pendentes}
      fila={fila}
      respondidas={respondidas}
      dispensadas={dispensadas}
      regras={regras}
      rubrica={rubrica}
    />
  );
}

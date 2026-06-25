import { getTarefasPainel, getMapaProvidenciaPeca } from "@/lib/data";
import { getUserEmail } from "@/lib/queries";
import { socioDoEmail } from "@/lib/allowlist";
import { TarefasView } from "@/components/modules/TarefasView";
import { FormModal } from "@/components/FormModal";
import { Icon } from "@/components/Icon";
import { criarTarefa } from "@/app/actions";
import { PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const [tarefas, mapa, email] = await Promise.all([getTarefasPainel(), getMapaProvidenciaPeca(), getUserEmail()]);
  const socio = socioDoEmail(email);

  const novaTarefa = (
    <FormModal label={<><Icon name="list" size={15} /> Nova tarefa</>} titulo="Nova tarefa" acao={criarTarefa} enviarLabel="Criar tarefa">
      <div><label>Título</label><input name="titulo" required placeholder="Ex.: Conferir feriado local em São Luís/MA" /></div>
      <div><label>Descrição</label><textarea name="descricao" placeholder="Detalhes da tarefa…" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>Prioridade</label>
          <select name="prioridade" defaultValue="media">
            {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label>Responsável</label>
          <select name="responsavel" defaultValue="Daniel">
            {RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div><label>Data limite (opcional)</label><input type="date" name="data_limite" /></div>
    </FormModal>
  );

  return <TarefasView tarefas={tarefas} mapa={mapa} socio={socio} novaTarefa={novaTarefa} />;
}

"use client";

import { FormModal } from "@/components/FormModal";
import { Icon } from "@/components/Icon";
import { criarTarefa } from "@/app/actions";
import { PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";
import { humano } from "@/lib/format";

/**
 * Cria um alerta manual. Para não introduzir uma entidade nova, o alerta é
 * registrado como uma TAREFA (prioridade alta por padrão): aparece em Tarefas,
 * nos contadores e pode virar compromisso na agenda.
 */
export function CriarAlerta() {
  return (
    <FormModal
      label={<><Icon name="shield" size={15} /> Criar alerta</>}
      titulo="Novo alerta"
      descricao="Registrado como tarefa de prioridade alta (aparece em Tarefas e nos contadores). Vincule a um processo/cliente depois, se quiser."
      acao={criarTarefa}
      enviarLabel="Criar alerta"
    >
      <div><label>Alerta</label><input name="titulo" required placeholder="Ex.: Conferir excesso de prazo do réu X" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Prioridade</label><select name="prioridade" defaultValue="alta">{PRIORIDADES.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue="Daniel">{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div><label>Prazo (data limite)</label><input type="date" name="data_limite" /></div>
      <div><label>Descrição</label><textarea name="descricao" placeholder="Detalhes do alerta." /></div>
    </FormModal>
  );
}

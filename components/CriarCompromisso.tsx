"use client";

import { Icon } from "@/components/Icon";
import { FormModal } from "@/components/FormModal";
import { criarCompromisso } from "@/app/actions";
import { RESPONSAVEIS } from "@/lib/enums";

/**
 * Botão + modal para criar um compromisso na agenda (grava no banco e espelha
 * no Google Calendar). Reaproveitado nos drawers de tarefa, intimação,
 * processo e cliente — os vínculos vêm por props.
 */
export function CriarCompromisso({
  tituloPadrao = "",
  descricaoPadrao = "",
  dataPadrao = null,
  responsavelPadrao = "Daniel",
  tarefaId = null,
  processoId = null,
  clienteId = null,
}: {
  tituloPadrao?: string;
  descricaoPadrao?: string;
  dataPadrao?: string | null;
  responsavelPadrao?: string | null;
  tarefaId?: string | null;
  processoId?: string | null;
  clienteId?: string | null;
}) {
  const dt = dataPadrao ? `${dataPadrao.slice(0, 10)}T09:00` : "";
  return (
    <FormModal
      label={<><Icon name="clock" size={14} /> Criar compromisso</>}
      titulo="Novo compromisso na agenda"
      descricao="Cria um compromisso (reunião, diligência, lembrete) na agenda do escritório e no Google Calendar."
      acao={criarCompromisso}
      enviarLabel="Criar compromisso"
      variant="default"
    >
      {tarefaId && <input type="hidden" name="tarefa_id" defaultValue={tarefaId} />}
      {processoId && <input type="hidden" name="processo_id" defaultValue={processoId} />}
      {clienteId && <input type="hidden" name="cliente_id" defaultValue={clienteId} />}
      <div><label>Título</label><input name="titulo" required defaultValue={tituloPadrao} /></div>
      <div><label>Data e hora</label><input type="datetime-local" name="data_hora" required defaultValue={dt} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Responsável</label><select name="responsavel" defaultValue={responsavelPadrao ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
        <div><label>Local</label><input name="local" placeholder="Sala, endereço ou link" /></div>
      </div>
      <div><label>Descrição</label><textarea name="descricao" defaultValue={descricaoPadrao} placeholder="Detalhes do compromisso." /></div>
    </FormModal>
  );
}

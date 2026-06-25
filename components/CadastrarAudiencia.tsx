"use client";

import { useEffect, useState } from "react";
import { FormModal } from "@/components/FormModal";
import { Icon } from "@/components/Icon";
import { criarAudiencia } from "@/app/actions";
import { AUDIENCIA_TIPO, AUDIENCIA_MODALIDADE, RESPONSAVEIS } from "@/lib/enums";
import { humano } from "@/lib/format";

/** Botão + modal para cadastrar uma audiência (exige processo; nasce provisória,
 * validado=false — o evento do Calendar é criado na validação). */
export function CadastrarAudiencia() {
  const [procs, setProcs] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    let vivo = true;
    fetch("/api/processos-lite")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => vivo && setProcs(d.processos ?? []))
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  return (
    <FormModal
      label={<><Icon name="gavel" size={15} /> Nova audiência</>}
      titulo="Nova audiência"
      descricao="Nasce provisória (validado=false): aparece em “A validar”. A validação fixa data/local e cria o evento no Google Calendar."
      acao={criarAudiencia}
      enviarLabel="Cadastrar"
    >
      <div>
        <label>Processo</label>
        <select name="processo_id" required defaultValue="">
          <option value="" disabled>Selecione…</option>
          {procs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Tipo</label><select name="tipo" required defaultValue="instrucao">{AUDIENCIA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Modalidade</label><select name="modalidade" defaultValue="presencial">{AUDIENCIA_MODALIDADE.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Início {/* início da sessão / janela */}</label><input type="datetime-local" name="data_hora" required /></div>
        <div><label>Fim da janela (sessão virtual)</label><input type="datetime-local" name="data_fim" /></div>
      </div>
      <p className="sub" style={{ margin: "-4px 0 0" }}>Na <b>sessão de julgamento virtual</b> a janela dura dias: preencha início e fim. Nas demais modalidades deixe o fim em branco (evento pontual).</p>
      <div><label>Local / link</label><input name="local_link" placeholder="Sala, endereço ou link da videoconferência" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Responsável</label><select name="responsavel" defaultValue="Daniel">{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div><label>Observações</label><input name="observacoes" placeholder="Ex.: Oitiva de testemunhas de defesa" /></div>
    </FormModal>
  );
}

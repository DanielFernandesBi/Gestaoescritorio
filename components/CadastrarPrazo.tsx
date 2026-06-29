"use client";

import { useEffect, useState } from "react";
import { FormModal } from "@/components/FormModal";
import { BuscaSelect } from "@/components/BuscaSelect";
import { Icon } from "@/components/Icon";
import { criarPrazo } from "@/app/actions";
import { TIPO_CONTAGEM, RESPONSAVEIS } from "@/lib/enums";

/** Botão + modal para cadastrar um prazo (exige processo; nasce validado=false). */
export function CadastrarPrazo() {
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
      label={<><Icon name="clock" size={15} /> Cadastrar prazo</>}
      titulo="Novo prazo"
      descricao="Nasce validado=false; evento provisório (Tangerina) é criado no Calendar. A fatal vermelha entra na validação de Daniel."
      acao={criarPrazo}
      enviarLabel="Cadastrar"
    >
      <div>
        <label>Processo</label>
        <BuscaSelect name="processo_id" options={procs} placeholder="Buscar por CNJ, registro ou cliente…" />
      </div>
      <div><label>Ato</label><input name="ato" required placeholder="Ex.: Razões de apelação (CPP art. 600)" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Data fatal</label><input type="date" name="data_fatal" required /></div>
        <div><label>Data interna</label><input type="date" name="data_interna" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Contagem</label><select name="tipo_contagem" defaultValue="corridos">{TIPO_CONTAGEM.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue="Daniel">{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
    </FormModal>
  );
}

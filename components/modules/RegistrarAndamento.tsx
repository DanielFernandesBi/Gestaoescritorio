"use client";

import { useEffect, useState } from "react";
import { FormModal } from "@/components/FormModal";
import { BuscaSelect } from "@/components/BuscaSelect";
import { Icon } from "@/components/Icon";
import { criarAndamento } from "@/app/actions";
import { ANDAMENTO_TIPO } from "@/lib/enums";
import { humano } from "@/lib/format";

type ProcLite = { id: string; label: string };

/** CTA "Registrar andamento" — movimentação manual vinculada a um processo. */
export function RegistrarAndamento() {
  const [procs, setProcs] = useState<ProcLite[]>([]);
  useEffect(() => {
    let vivo = true;
    fetch("/api/processos-lite").then((r) => r.json()).then((d) => vivo && setProcs(d.processos ?? [])).catch(() => {});
    return () => { vivo = false; };
  }, []);

  return (
    <FormModal
      label={<><Icon name="activity" size={15} /> Registrar andamento</>}
      titulo="Registrar andamento"
      descricao="Movimentação informativa, vinculada a um processo. Nada é deletado; tudo é auditado."
      acao={criarAndamento}
      enviarLabel="Registrar"
    >
      <div>
        <label>Processo</label>
        <BuscaSelect name="processo_id" options={procs} placeholder="Buscar por CNJ, registro ou cliente…" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Tipo</label><select name="tipo" defaultValue="movimentacao_tribunal">{ANDAMENTO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Data</label><input type="date" name="data" /></div>
      </div>
      <div><label>Descrição</label><textarea name="descricao" required placeholder="Descreva a movimentação." /></div>
      <div><label>Origem</label><input name="origem" placeholder="tribunal, djen, e-mail…" /></div>
    </FormModal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Pill, ProcRef, SegredoTag } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { atualizarAudiencia, vincularClienteProcesso } from "@/app/actions";
import { AUDIENCIA_TIPO, AUDIENCIA_MODALIDADE, PAPEL, RESPONSAVEIS } from "@/lib/enums";
import { fmtDate, fmtTime, humano } from "@/lib/format";
import type { Audiencia } from "@/lib/data";

export function AudienciaDetalhe({ aud }: { aud: Audiencia }) {
  const [clientesLite, setClientesLite] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/clientes-lite")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => vivo && setClientesLite(d.clientes ?? []))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const semCliente = !aud.clientes;

  return (
    <>
      <div className="dsec">
        <h4>Sessão</h4>
        <div className="dgrid">
          <div className="field"><div className="k">Data</div><div className="v mono">{fmtDate(aud.data_hora)}</div></div>
          <div className="field"><div className="k">Hora</div><div className="v mono">{fmtTime(aud.data_hora)}</div></div>
          <div className="field"><div className="k">Modalidade</div><div className="v">{humano(aud.modalidade)}</div></div>
          <div className="field"><div className="k">Responsável</div><div className="v">{aud.responsavel ?? "—"}</div></div>
        </div>
      </div>

      <div className="dsec">
        <h4>Local / link</h4>
        <div className="field"><div className="v">{aud.local_link ?? "—"}</div></div>
      </div>

      {aud.observacoes && (
        <div className="dsec">
          <h4>Observações</h4>
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
            {aud.observacoes}
          </p>
        </div>
      )}

      <div className="dsec">
        <h4>Processo</h4>
        <div className="mini">
          <div>
            <div className="mt">
              <ProcRef cnj={aud.numero_cnj} registro={aud.numero_registro} /> <SegredoTag on={aud.segredo} />
            </div>
            <div className="ms">{aud.clientes || "Sem cliente identificado"}</div>
          </div>
          {aud.clientes ? <Pill tone="green" dot={false}>cliente vinculado</Pill> : <Pill tone="amber" dot={false}>revisar</Pill>}
        </div>
        {semCliente && (
          <p className="ms" style={{ marginTop: 8 }}>
            {aud.segredo
              ? "Processo em segredo de justiça: a inclusão automática não consegue identificar as partes. Vincule o cliente manualmente abaixo."
              : "Nenhum cliente vinculado a este processo. Identifique-o manualmente abaixo."}
          </p>
        )}
      </div>

      <div className="dsec">
        <h4>Ações</h4>
        <div className="acoes">
          <FormModal
            label="Editar audiência"
            titulo="Editar audiência"
            descricao="Ajuste os dados da audiência. Se já validada, o evento no Google Calendar é re-sincronizado."
            acao={atualizarAudiencia.bind(null, aud.id)}
            enviarLabel="Salvar"
            variant="default"
          >
            <div><label>Tipo</label><select name="tipo" defaultValue={aud.tipo}>{AUDIENCIA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
            <div><label>Data e hora</label><input type="datetime-local" name="data_hora" required defaultValue={aud.data_hora?.slice(0, 16)} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Modalidade</label><select name="modalidade" defaultValue={aud.modalidade ?? "presencial"}>{AUDIENCIA_MODALIDADE.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
              <div><label>Responsável</label><select name="responsavel" defaultValue={aud.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
            <div><label>Local / link</label><input name="local_link" defaultValue={aud.local_link ?? ""} placeholder="Sala, endereço ou link da videoconferência" /></div>
            <div><label>Observações</label><textarea name="observacoes" defaultValue={aud.observacoes ?? ""} placeholder="Anotações sobre a sessão." /></div>
          </FormModal>

          <FormModal
            label={semCliente ? "Identificar cliente" : "Vincular outro cliente"}
            titulo="Identificar cliente do processo"
            descricao="Vincula um cliente ao processo desta audiência — útil para inclusões automáticas de processos sigilosos, que chegam sem partes."
            acao={vincularClienteProcesso.bind(null, aud.processo_id)}
            enviarLabel="Vincular"
            variant="default"
          >
            <div>
              <label>Cliente</label>
              <select name="cliente_id" required defaultValue="">
                <option value="" disabled>Selecione…</option>
                {clientesLite.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div><label>Papel</label><select name="papel" defaultValue="reu">{PAPEL.map((p) => <option key={p} value={p}>{humano(p)}</option>)}</select></div>
          </FormModal>
        </div>
      </div>
    </>
  );
}

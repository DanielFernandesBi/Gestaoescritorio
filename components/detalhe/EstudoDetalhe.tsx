"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { BuscaSelect } from "@/components/BuscaSelect";
import {
  atualizarEstudo, vincularProcessoEstudo, criarObjetivo, atualizarObjetivo,
} from "@/app/actions";
import { ESTUDO_STATUS, ESTUDO_TIPO, OBJETIVO_STATUS, PRIORIDADES } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import type { EstudoDetalhe as TEstudo } from "@/lib/data";

type ProcLite = { id: string; label: string };

const objTone = (s: string) =>
  s === "atingido" ? "green" : s === "em_curso" ? "blue" : s === "frustrado" ? "red" : s === "prejudicado" ? "gray" : "amber";
const priTone = (p: string | null) => (p === "urgente" ? "red" : p === "alta" ? "amber" : "gray");

function ProcSelect({ name, processos, defaultValue = "", placeholder = "Buscar processo…" }: {
  name: string; processos: ProcLite[]; defaultValue?: string; placeholder?: string; required?: boolean;
}) {
  return <BuscaSelect name={name} options={processos} defaultValue={defaultValue} placeholder={placeholder} />;
}

export function EstudoDetalhe({ estudoId }: { estudoId: string }) {
  const [e, setE] = useState<TEstudo | null>(null);
  const [erro, setErro] = useState(false);
  const [procs, setProcs] = useState<ProcLite[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/estudos/${estudoId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => vivo && (d?.id ? setE(d) : setErro(true)))
      .catch(() => vivo && setErro(true));
    fetch("/api/processos-lite")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => vivo && setProcs(d.processos ?? []))
      .catch(() => {});
    return () => { vivo = false; };
  }, [estudoId]);

  if (erro) return <div className="empty">Não foi possível carregar o estudo.</div>;
  if (!e) return <div className="empty">Carregando…</div>;

  return (
    <>
      <div className="dsec">
        <h4>Estudo</h4>
        <div className="dgrid">
          <div className="field"><div className="k">Cliente</div><div className="v">{e.cliente ?? "—"}</div></div>
          <div className="field"><div className="k">Tipo</div><div className="v">{humano(e.tipo)}</div></div>
          <div className="field"><div className="k">Status</div><div className="v">{humano(e.status)}</div></div>
          <div className="field"><div className="k">Atualizado</div><div className="v mono">{fmtDate(e.atualizado_em)}</div></div>
        </div>
        <div className="acoes" style={{ marginTop: 10 }}>
          <FormModal label="Editar estudo" titulo="Editar estudo" acao={atualizarEstudo.bind(null, e.id)} enviarLabel="Salvar" variant="default">
            <div><label>Título</label><input name="titulo" defaultValue={e.titulo} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Tipo</label><select name="tipo" defaultValue={e.tipo ?? "geral"}>{ESTUDO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
              <div><label>Status</label><select name="status" defaultValue={e.status}>{ESTUDO_STATUS.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
            </div>
            <div><label>Conteúdo / diagnóstico geral</label><textarea name="conteudo" defaultValue={e.conteudo ?? ""} placeholder="Visão geral da execução / estratégia global" /></div>
            <div><label>Teses</label><textarea name="teses" defaultValue={e.teses ?? ""} /></div>
            <div><label>Jurisprudência</label><textarea name="jurisprudencia" defaultValue={e.jurisprudencia ?? ""} placeholder="Precedentes que sustentam as teses" /></div>
            <div><label>Drive (id do documento)</label><input name="drive_file_id" defaultValue={e.drive_file_id ?? ""} placeholder="id do .docx/PDF no Drive (opcional)" /></div>
            <p className="sub" style={{ margin: 0 }}>Só grava os campos preenchidos — não sobrescreve com vazio.</p>
          </FormModal>
        </div>
      </div>

      {(e.conteudo || e.teses || e.jurisprudencia) && (
        <div className="dsec">
          <h4>Estratégia</h4>
          {e.conteudo && <div className="field"><div className="k">Diagnóstico geral</div><div className="v" style={{ whiteSpace: "pre-wrap" }}>{e.conteudo}</div></div>}
          {e.teses && <div className="field"><div className="k">Teses</div><div className="v" style={{ whiteSpace: "pre-wrap" }}>{e.teses}</div></div>}
          {e.jurisprudencia && <div className="field"><div className="k">Jurisprudência</div><div className="v" style={{ whiteSpace: "pre-wrap" }}>{e.jurisprudencia}</div></div>}
        </div>
      )}

      <div className="dsec">
        <h4>Processos no estudo ({e.vinculos.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {e.vinculos.length ? e.vinculos.map((v) => (
            <div className="mini" key={v.id}>
              <div>
                <div className="mt mono">{v.processo} {v.segredo && <Pill tone="amber">sigiloso</Pill>}</div>
                <div className="ms">{humano(v.area)} · {(v.instancia ?? "").toUpperCase()}{v.diagnostico ? ` · ${v.diagnostico}` : ""}</div>
                {v.estrategia && <div className="ms">→ {v.estrategia}</div>}
              </div>
              <Pill tone={priTone(v.prioridade)}>{humano(v.prioridade)}</Pill>
            </div>
          )) : <div className="empty">Nenhum processo vinculado ainda.</div>}
        </div>
        <div className="acoes" style={{ marginTop: 10 }}>
          <FormModal label="Vincular processo" titulo="Vincular processo ao estudo" acao={vincularProcessoEstudo.bind(null, e.id)} enviarLabel="Vincular" variant="default">
            <div><label>Processo</label><ProcSelect name="processo_id" processos={procs} placeholder="Selecione…" required /></div>
            <div><label>Diagnóstico (situação deste processo)</label><textarea name="diagnostico" placeholder="Ex.: já fez RVC e ganhou o possível; pena no mínimo legal." /></div>
            <div><label>Estratégia (o que fazer)</label><textarea name="estrategia" placeholder="Ex.: aguardar lapso para progressão; impetrar HC no STJ." /></div>
            <div><label>Prioridade</label><select name="prioridade" defaultValue="media">{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <p className="sub" style={{ margin: 0 }}>Vincular um processo já existente reaproveita o diagnóstico (atualiza, não duplica).</p>
          </FormModal>
        </div>
      </div>

      <div className="dsec">
        <h4>Objetivos ({e.objetivos.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {e.objetivos.length ? e.objetivos.map((o) => (
            <div className="mini" key={o.id} style={{ alignItems: "flex-start" }}>
              <div>
                <div className="mt">{o.objetivo} {o.beneficio_alvo && <span className="ms">· {o.beneficio_alvo}</span>}</div>
                <div className="ms">
                  {o.alvo ? <>alvo <b className="mono">{o.alvo}</b></> : "sem alvo"}
                  {o.instrumento && <> · via <b className="mono">{o.instrumento}</b></>}
                  {o.data_alvo && <> · meta {fmtDate(o.data_alvo)}</>}
                </div>
                {o.resultado && <div className="ms">resultado: {o.resultado}{o.resultado_em ? ` (${fmtDate(o.resultado_em)})` : ""}</div>}
                <div className="acoes" style={{ marginTop: 6 }}>
                  <FormModal label="Atualizar" titulo="Atualizar objetivo" acao={atualizarObjetivo.bind(null, o.id)} enviarLabel="Salvar" variant="default">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div><label>Status</label><select name="status" defaultValue={o.status}>{OBJETIVO_STATUS.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
                      <div><label>Meta (data-alvo)</label><input type="date" name="data_alvo" defaultValue={o.data_alvo?.slice(0, 10) ?? ""} /></div>
                    </div>
                    <div><label>Instrumento (ação ajuizada)</label><ProcSelect name="processo_instrumento_id" processos={procs} defaultValue={o.processo_instrumento_id ?? ""} placeholder="— ainda não ajuizada —" /></div>
                    <div><label>Resultado</label><textarea name="resultado" defaultValue={o.resultado ?? ""} placeholder="O que saiu na decisão" /></div>
                    <div><label>Data do resultado</label><input type="date" name="resultado_em" defaultValue={o.resultado_em?.slice(0, 10) ?? ""} /></div>
                    <p className="sub" style={{ margin: 0 }}>Atingido/frustrado sem data registra hoje. Histórico preservado.</p>
                  </FormModal>
                </div>
              </div>
              <Pill tone={objTone(o.status)}>{humano(o.status)}</Pill>
            </div>
          )) : <div className="empty">Nenhum objetivo definido.</div>}
        </div>
        <div className="acoes" style={{ marginTop: 10 }}>
          <FormModal label="Novo objetivo" titulo="Novo objetivo" acao={criarObjetivo.bind(null, e.id)} enviarLabel="Criar" variant="default">
            <div><label>Objetivo</label><input name="objetivo" required placeholder="Ex.: progressão ao semiaberto" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Benefício-alvo</label><input name="beneficio_alvo" placeholder="Ex.: semiaberto / livramento" /></div>
              <div><label>Meta (data-alvo)</label><input type="date" name="data_alvo" /></div>
            </div>
            <div><label>Processo-alvo (condenação a mexer)</label><ProcSelect name="processo_id" processos={procs} placeholder="— selecione o alvo —" /></div>
            <div><label>Instrumento (RVC/HC ajuizada, se já houver)</label><ProcSelect name="processo_instrumento_id" processos={procs} placeholder="— ainda não ajuizada —" /></div>
            <div><label>Status</label><select name="status" defaultValue="planejado">{OBJETIVO_STATUS.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
            <div><label>Observações</label><textarea name="observacoes" /></div>
          </FormModal>
        </div>
      </div>
    </>
  );
}

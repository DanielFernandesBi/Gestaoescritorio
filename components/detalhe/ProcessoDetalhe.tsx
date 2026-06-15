"use client";

import { useEffect, useState } from "react";
import { DiasBox, Pill, Gate } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { HistoricoRegistro } from "@/components/detalhe/HistoricoRegistro";
import { criarAndamento, criarPrazo, atualizarProcesso, arquivarProcesso, vincularClienteProcesso } from "@/app/actions";
import {
  ANDAMENTO_TIPO, ANDAMENTO_ORIGEM, TIPO_CONTAGEM, RESPONSAVEIS,
  PROCESSO_INSTANCIA, PROCESSO_AREA, PROCESSO_STATUS, PAPEL,
} from "@/lib/enums";
import { fmtDate, fmtTime, humano, diasAte } from "@/lib/format";
import type { Processo } from "@/lib/data";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ProcRecord = Record<string, any>;

type Rel = {
  processo: ProcRecord | null;
  prazos: { id: string; ato: string; data_fatal: string; data_interna: string | null; status: string; validado: boolean }[];
  audiencias: { id: string; tipo: string; data_hora: string; modalidade: string | null; status: string; validado: boolean }[];
  intimacoes: { id: string; resumo: string | null; origem: string | null; status: string; data_publicacao: string | null }[];
  andamentos: { id: string; data: string; tipo: string; descricao: string; origem: string | null }[];
};

export function ProcessoDetalhe({ proc }: { proc: Processo }) {
  const [rel, setRel] = useState<Rel | null>(null);
  const [erro, setErro] = useState(false);
  const [clientesLite, setClientesLite] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/processos/${proc.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => vivo && setRel(d))
      .catch(() => vivo && setErro(true));
    fetch("/api/clientes-lite")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => vivo && setClientesLite(d.clientes ?? []))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [proc.id]);

  return (
    <>
      <div className="dsec">
        <h4>Dados</h4>
        <div className="dgrid">
          <div className="field"><div className="k">Tribunal</div><div className="v">{proc.tribunal ?? "—"}</div></div>
          <div className="field"><div className="k">Vara / comarca</div><div className="v">{proc.vara_comarca ?? "—"}</div></div>
          <div className="field"><div className="k">Instância</div><div className="v">{(proc.instancia ?? "—").toUpperCase()} · {proc.uf ?? "—"}</div></div>
          <div className="field"><div className="k">Área</div><div className="v">{humano(proc.area)}</div></div>
          <div className="field"><div className="k">Classe</div><div className="v">{proc.classe ?? "—"}</div></div>
          <div className="field"><div className="k">Responsável</div><div className="v">{proc.responsavel ?? "—"}</div></div>
        </div>
      </div>

      <div className="dsec">
        <h4>Partes</h4>
        <div className="mini">
          <div>
            <div className="mt">{proc.segredo ? "— (sigiloso)" : proc.clientes || "—"}</div>
            <div className="ms">papel: {proc.papel ?? "—"}</div>
          </div>
        </div>
        <div className="acoes" style={{ marginTop: 10 }}>
          <FormModal label="Vincular cliente" titulo="Vincular cliente ao processo" acao={vincularClienteProcesso.bind(null, proc.id)} enviarLabel="Vincular" variant="default">
            <div><label>Cliente</label>
              <select name="cliente_id" required defaultValue="">
                <option value="" disabled>Selecione…</option>
                {clientesLite.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div><label>Papel</label><select name="papel" defaultValue="reu">{PAPEL.map((p) => <option key={p} value={p}>{humano(p)}</option>)}</select></div>
          </FormModal>
        </div>
      </div>

      <div className="dsec">
        <h4>Ações no processo</h4>
        <div className="acoes">
          <FormModal label="Registrar andamento" titulo="Novo andamento" acao={criarAndamento} enviarLabel="Registrar" variant="default">
            <input type="hidden" name="processo_id" defaultValue={proc.id} />
            <div><label>Tipo</label><select name="tipo" defaultValue="movimentacao_tribunal">{ANDAMENTO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Data</label><input type="date" name="data" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div><label>Origem (opcional)</label><select name="origem" defaultValue=""><option value="">—</option>{ANDAMENTO_ORIGEM.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}</select></div>
            </div>
            <div><label>Descrição</label><textarea name="descricao" required placeholder="Descreva a movimentação / ato." /></div>
          </FormModal>

          <FormModal label="Novo prazo" titulo="Novo prazo (nasce validado=false)" descricao="Evento provisório (Tangerina) é criado no Calendar; validação confirma a fatal." acao={criarPrazo} enviarLabel="Criar prazo" variant="default">
            <input type="hidden" name="processo_id" defaultValue={proc.id} />
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
        </div>
      </div>

      {erro && (
        <div className="banner" style={{ margin: "0 0 24px" }}>
          <span className="ico">⚠</span>
          <div>Não consegui carregar os itens vinculados agora.</div>
        </div>
      )}

      {!rel && !erro && <div className="empty">Carregando itens vinculados…</div>}

      {rel?.processo && (
        <div className="dsec">
          <h4>Editar / arquivar</h4>
          <div className="acoes">
            <FormModal label="Editar processo" titulo="Editar processo" acao={atualizarProcesso.bind(null, proc.id)} enviarLabel="Salvar" variant="default">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label>Nº CNJ</label><input name="numero_cnj" defaultValue={rel.processo.numero_cnj ?? ""} placeholder="0000000-00.0000.0.00.0000" /></div>
                <div><label>Nº registro</label><input name="numero_registro_tribunal" defaultValue={rel.processo.numero_registro_tribunal ?? ""} /></div>
              </div>
              <div><label>Tribunal</label><input name="tribunal" defaultValue={rel.processo.tribunal ?? ""} /></div>
              <div><label>Vara / comarca</label><input name="vara_comarca" defaultValue={rel.processo.vara_comarca ?? ""} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div><label>UF</label><input name="uf" maxLength={2} defaultValue={rel.processo.uf ?? ""} /></div>
                <div><label>Instância</label><select name="instancia" defaultValue={rel.processo.instancia ?? "1grau"}>{PROCESSO_INSTANCIA.map((i) => <option key={i} value={i}>{i.toUpperCase()}</option>)}</select></div>
                <div><label>Status</label><select name="status" defaultValue={rel.processo.status ?? "ativo"}>{PROCESSO_STATUS.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label>Área</label><select name="area" defaultValue={rel.processo.area ?? "criminal"}>{PROCESSO_AREA.map((a) => <option key={a} value={a}>{humano(a)}</option>)}</select></div>
                <div><label>Responsável</label><select name="responsavel" defaultValue={rel.processo.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
              </div>
              <div><label>Classe</label><input name="classe" defaultValue={rel.processo.classe ?? ""} /></div>
              <div><label>Assunto</label><input name="assunto" defaultValue={rel.processo.assunto ?? ""} /></div>
              <div><label>Observações</label><textarea name="observacoes" defaultValue={rel.processo.observacoes ?? ""} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" name="segredo_justica" defaultChecked={Boolean(rel.processo.segredo_justica)} style={{ width: "auto" }} /> Segredo de justiça
              </label>
            </FormModal>
            <Acao
              label="Arquivar"
              variant="danger"
              titulo="Arquivar processo"
              confirmarLabel="Arquivar"
              resumo={<>O processo <b>não é apagado</b> — muda para status <b>arquivado</b> (reversível, auditado). Confirmar?</>}
              campoTexto={{ label: "Motivo (opcional)", placeholder: "Ex.: baixado / encerrado." }}
              acao={(t) => arquivarProcesso(proc.id, t)}
            />
          </div>
        </div>
      )}

      {rel && (
        <>
          <div className="dsec">
            <h4>Prazos abertos ({rel.prazos.length})</h4>
            <div className="mini-list">
              {rel.prazos.length ? (
                rel.prazos.map((p) => (
                  <div className="mini" key={p.id}>
                    <div>
                      <div className="mt">{p.ato}</div>
                      <div className="ms">fatal {fmtDate(p.data_fatal)} · <Gate validado={p.validado} /></div>
                    </div>
                    <DiasBox dias={diasAte(p.data_fatal)} />
                  </div>
                ))
              ) : (
                <div className="empty">Sem prazos abertos.</div>
              )}
            </div>
          </div>

          <div className="dsec">
            <h4>Audiências ({rel.audiencias.length})</h4>
            <div className="mini-list">
              {rel.audiencias.length ? (
                rel.audiencias.map((a) => (
                  <div className="mini" key={a.id}>
                    <div>
                      <div className="mt">{humano(a.tipo)}</div>
                      <div className="ms">{humano(a.modalidade)} · {a.status}</div>
                    </div>
                    <div className="mono" style={{ textAlign: "right" }}>
                      {fmtDate(a.data_hora)}<div className="ms">{fmtTime(a.data_hora)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">Sem audiências.</div>
              )}
            </div>
          </div>

          <div className="dsec">
            <h4>Intimações ({rel.intimacoes.length})</h4>
            <div className="mini-list">
              {rel.intimacoes.length ? (
                rel.intimacoes.map((i) => (
                  <div className="mini" key={i.id}>
                    <div>
                      <div className="mt">{i.resumo ?? "—"}</div>
                      <div className="ms">{(i.origem ?? "").toUpperCase()} · {fmtDate(i.data_publicacao)}</div>
                    </div>
                    <Pill tone={i.status === "pendente" ? "amber" : "gray"} dot={false}>{humano(i.status)}</Pill>
                  </div>
                ))
              ) : (
                <div className="empty">Sem intimações.</div>
              )}
            </div>
          </div>

          {rel.andamentos.length > 0 && (
            <div className="dsec">
              <h4>Andamentos recentes</h4>
              <div className="tl">
                {rel.andamentos.map((m) => (
                  <div className="tl-item" key={m.id}>
                    <div className="d">{fmtDate(m.data)} · {humano(m.tipo)}</div>
                    <div className="t" style={{ fontSize: 12.5 }}>{m.descricao}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dsec">
            <h4>Histórico (auditoria)</h4>
            <HistoricoRegistro id={proc.id} />
          </div>
        </>
      )}
    </>
  );
}

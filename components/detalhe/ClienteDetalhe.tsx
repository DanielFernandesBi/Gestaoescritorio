"use client";

import { useEffect, useState } from "react";
import { DiasBox, ProcRef, SegredoTag, Pill } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { HistoricoRegistro } from "@/components/detalhe/HistoricoRegistro";
import { ExecucaoCliente } from "@/components/detalhe/ExecucaoCliente";
import { DocumentosCaso } from "@/components/detalhe/DocumentosCaso";
import { atualizarCliente, desativarCliente } from "@/app/actions";
import { SITUACAO_PRISIONAL } from "@/lib/enums";
import { fmtDate, fmtTime, humano, diasAte } from "@/lib/format";
import type { Cliente, ExecucaoCliente as TExec, Documento } from "@/lib/data";

/* eslint-disable @typescript-eslint/no-explicit-any */

type ProcRow = {
  id: string;
  numero_cnj: string | null;
  numero_registro_tribunal: string | null;
  tribunal: string | null;
  area: string | null;
  instancia: string | null;
  status: string;
  segredo_justica: boolean | null;
  papel: string | null;
};
type Rel = {
  cliente: Record<string, any> | null;
  processos: ProcRow[];
  prazos: { id: string; ato: string; data_fatal: string; validado: boolean }[];
  audiencias: { id: string; tipo: string; data_hora: string; modalidade: string | null }[];
  execucao?: TExec;
  documentos?: Documento[];
};

// Situações em que a aba de execução penal é relevante (mesmo sem atestado ainda).
const CUSTODIA = new Set([
  "preso_provisorio", "preso_definitivo", "regime_semiaberto", "regime_aberto", "monitoramento", "foragido",
]);

const SIT_LBL: Record<string, string> = {
  solto: "Solto",
  preso_provisorio: "Preso provisório",
  preso_definitivo: "Preso definitivo",
  regime_semiaberto: "Semiaberto",
  regime_aberto: "Aberto",
  monitoramento: "Tornozeleira",
  foragido: "Foragido",
  falecido: "Falecido",
};

// Cor por urgência do marco (faltam X dias): vermelho perto, âmbar no horizonte, verde já atingível.
function marcoTone(dias: number | null): string {
  if (dias == null) return "";
  if (dias <= 0) return "t-green";
  if (dias < 90) return "t-red";
  if (dias <= 365) return "t-amber";
  return "";
}

function MarcoItem({ label, dias, data }: { label: string; dias: number | null; data: string | null }) {
  return (
    <div className={`item ${marcoTone(dias)}`}>
      <div className="lbl">{label}</div>
      <div className="data">{data ? fmtDate(data) : "a calcular"}</div>
      <div className={`dias${dias == null ? " muted" : ""}`}>
        {dias == null ? "sem data prevista" : dias <= 0 ? "✓ já atingível" : `faltam ${dias} dias`}
      </div>
    </div>
  );
}

export function ClienteDetalhe({ cliente }: { cliente: Cliente }) {
  const [rel, setRel] = useState<Rel | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/clientes/${cliente.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => vivo && setRel(d))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [cliente.id]);

  const sit = rel?.execucao?.situacao;

  return (
    <>
      {sit && (
        <div className="exec-destaque">
          <MarcoItem label="Progressão de regime" dias={sit.dias_para_progressao} data={sit.data_prevista_progressao} />
          <MarcoItem label="Livramento condicional" dias={sit.dias_para_livramento} data={sit.data_prevista_livramento} />
        </div>
      )}

      <div className="dsec">
        <h4>Ficha</h4>
        <div className="dgrid">
          <div className="field"><div className="k">CPF</div><div className="v mono">{cliente.cpf ?? "—"}</div></div>
          <div className="field"><div className="k">UF</div><div className="v">{cliente.uf ?? "—"}</div></div>
          <div className="field"><div className="k">Situação prisional</div><div className="v">{SIT_LBL[cliente.situacao_prisional ?? ""] ?? "—"}</div></div>
          <div className="field"><div className="k">Unidade prisional</div><div className="v">{cliente.unidade_prisional ?? "—"}</div></div>
        </div>
      </div>

      {rel?.cliente?.observacoes && (
        <div className="dsec">
          <h4>Observações</h4>
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
            {rel.cliente.observacoes}
          </p>
        </div>
      )}

      {rel?.execucao && (rel.execucao.temDados || CUSTODIA.has(cliente.situacao_prisional ?? "")) && (
        <ExecucaoCliente exec={rel.execucao} clienteId={cliente.id} situacaoAtual={cliente.situacao_prisional} />
      )}

      {rel?.cliente && (
        <div className="dsec">
          <h4>Editar / desativar</h4>
          <div className="acoes">
            <FormModal label="Editar cliente" titulo="Editar cliente" acao={atualizarCliente.bind(null, cliente.id)} enviarLabel="Salvar" variant="default">
              <div><label>Nome</label><input name="nome" required defaultValue={rel.cliente.nome ?? ""} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label>CPF</label><input name="cpf" defaultValue={rel.cliente.cpf ?? ""} /></div>
                <div><label>RG</label><input name="rg" defaultValue={rel.cliente.rg ?? ""} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div><label>Situação prisional</label><select name="situacao_prisional" defaultValue={rel.cliente.situacao_prisional ?? "solto"}>{SITUACAO_PRISIONAL.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
                <div><label>UF</label><input name="uf" maxLength={2} defaultValue={rel.cliente.uf ?? ""} /></div>
              </div>
              <div><label>Unidade prisional</label><input name="unidade_prisional" defaultValue={rel.cliente.unidade_prisional ?? ""} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label>Telefone</label><input name="telefone" defaultValue={rel.cliente.telefone ?? ""} /></div>
                <div><label>E-mail</label><input name="email" defaultValue={rel.cliente.email ?? ""} /></div>
              </div>
              <div><label>Contato da família</label><input name="contato_familia" defaultValue={rel.cliente.contato_familia ?? ""} /></div>
              <div><label>Observações</label><textarea name="observacoes" defaultValue={rel.cliente.observacoes ?? ""} /></div>
            </FormModal>
            <Acao
              label="Desativar"
              variant="danger"
              titulo="Desativar cliente"
              confirmarLabel="Desativar"
              resumo={<>O cliente <b>não é apagado</b> — fica inativo (some das listas, mantido no banco e auditado). Confirmar?</>}
              acao={() => desativarCliente(cliente.id)}
            />
          </div>
        </div>
      )}

      {erro && (
        <div className="banner" style={{ margin: "0 0 24px" }}>
          <span className="ico">⚠</span>
          <div>Não consegui carregar os processos vinculados agora.</div>
        </div>
      )}
      {!rel && !erro && <div className="empty">Carregando processos vinculados…</div>}

      {rel && (
        <>
          <div className="dsec">
            <h4>Processos ({rel.processos.length})</h4>
            <div className="mini-list">
              {rel.processos.length ? (
                rel.processos.map((p) => (
                  <div className="mini" key={p.id}>
                    <div>
                      <div className="mt">
                        <ProcRef cnj={p.numero_cnj} registro={p.numero_registro_tribunal} id={p.id} />{" "}
                        <SegredoTag on={p.segredo_justica} />
                      </div>
                      <div className="ms">{p.tribunal ?? "—"} · {humano(p.area)} · papel: {p.papel ?? "—"}</div>
                    </div>
                    <Pill tone={p.status === "ativo" ? "green" : "gray"} dot={false}>{p.status}</Pill>
                  </div>
                ))
              ) : (
                <div className="empty">Sem processos vinculados.</div>
              )}
            </div>
          </div>

          <div className="dsec">
            <h4>Prazos abertos ({rel.prazos.length})</h4>
            <div className="mini-list">
              {rel.prazos.length ? (
                rel.prazos.map((p) => (
                  <div className="mini" key={p.id}>
                    <div>
                      <div className="mt">{p.ato}</div>
                      <div className="ms">fatal {fmtDate(p.data_fatal)}</div>
                    </div>
                    <DiasBox dias={diasAte(p.data_fatal)} />
                  </div>
                ))
              ) : (
                <div className="empty">Sem prazos abertos.</div>
              )}
            </div>
          </div>

          {rel.audiencias.length > 0 && (
            <div className="dsec">
              <h4>Audiências futuras ({rel.audiencias.length})</h4>
              <div className="mini-list">
                {rel.audiencias.map((a) => (
                  <div className="mini" key={a.id}>
                    <div>
                      <div className="mt">{humano(a.tipo)}</div>
                      <div className="ms">{humano(a.modalidade)}</div>
                    </div>
                    <div className="mono" style={{ textAlign: "right" }}>
                      {fmtDate(a.data_hora)}<div className="ms">{fmtTime(a.data_hora)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DocumentosCaso
            documentos={rel.documentos ?? []}
            vinculo={{ campo: "cliente_id", id: cliente.id }}
          />

          <div className="dsec">
            <h4>Histórico (auditoria)</h4>
            <HistoricoRegistro id={cliente.id} />
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ProcRef } from "@/components/ui";
import { Acao } from "@/components/Acao";
import { FormModal } from "@/components/FormModal";
import { atualizarIntimacao, atualizarIntimacaoCampos, promoverOrfa, vincularClienteProcesso } from "@/app/actions";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
import { PromoverProcessoForm } from "@/components/modules/PromoverProcessoForm";
import { PAPEL } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import type { Intimacao } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

/**
 * Corpo de detalhe de uma intimação — usado tanto no drawer (IntimacoesList)
 * quanto na página canônica /intimacoes/[id]. Busca processos/clientes para o
 * formulário de promoção de órfã.
 */
export function IntimacaoDetalhe({
  i,
  mapa = null,
}: {
  i: Intimacao;
  mapa?: MapaProvidencia | null;
}) {
  const [procs, setProcs] = useState<{ id: string; label: string }[]>([]);
  const [clis, setClis] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/processos-lite").then((r) => r.json()).then((d) => vivo && setProcs(d.processos ?? [])).catch(() => {});
    fetch("/api/clientes-lite").then((r) => r.json()).then((d) => vivo && setClis(d.clientes ?? [])).catch(() => {});
    return () => { vivo = false; };
  }, []);

  return (
    <>
      <div className="dsec">
        <h4>Dados</h4>
        <div className="dgrid">
          <div className="field"><div className="k">Origem</div><div className="v">{(i.origem ?? "—").toUpperCase()}</div></div>
          <div className="field"><div className="k">Processo</div><div className="v">{i.orfa ? <span className="sub">—</span> : <ProcRef cnj={i.numero_cnj} registro={i.numero_registro} id={i.processo_id} />}</div></div>
          <div className="field"><div className="k">Cliente</div><div className="v">{i.orfa ? <span className="sub">—</span> : (i.cliente ?? <span className="sub" style={{ color: "var(--amber)" }}>Sem cliente vinculado</span>)}</div></div>
          <div className="field"><div className="k">Publicação</div><div className="v mono">{fmtDate(i.data_publicacao)}</div></div>
          <div className="field"><div className="k">Ciência</div><div className="v mono">{fmtDate(i.data_ciencia)}</div></div>
          <div className="field"><div className="k">Código publicação</div><div className="v mono" style={{ fontSize: 11 }}>{i.codigo_publicacao ?? "—"}</div></div>
        </div>
      </div>
      {i.providencia && (
        <div className="dsec"><h4>Providência</h4><div className="field"><div className="v">{i.providencia}</div></div></div>
      )}
      {i.orfa && (
        <>
          <div className="banner" style={{ margin: "0 0 16px" }}>
            <span className="ico">⚠</span>
            <div><b>Intimação órfã.</b> Processo não identificado — triagem humana antes de vincular.</div>
          </div>
          <div className="dsec">
            <h4>Promover órfã</h4>
            <div className="acoes">
              <PromoverProcessoForm
                titulo="Promover intimação órfã"
                descricao="Identifica/cadastra o processo (dedup + resolução de mesclagem) e vincula a intimação. Auditado; nada é apagado."
                acao={promoverOrfa.bind(null, "intimacao", i.id)}
                procs={procs}
                clis={clis}
                enviarLabel="Vincular intimação"
                header={<p className="sub" style={{ marginTop: 0 }}>{i.resumo ?? "—"}</p>}
              />
            </div>
          </div>
        </>
      )}
      <div className="dsec">
        <h4>Ações</h4>
        <div className="acoes">
          <FormModal label="Editar dados" titulo="Editar intimação" acao={atualizarIntimacaoCampos.bind(null, i.id)} enviarLabel="Salvar" variant="default">
            <div><label>Resumo</label><input name="resumo" defaultValue={i.resumo ?? ""} placeholder="Resumo da intimação" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Publicação</label><input type="date" name="data_publicacao" defaultValue={i.data_publicacao?.slice(0, 10) ?? ""} /></div>
              <div><label>Ciência</label><input type="date" name="data_ciencia" defaultValue={i.data_ciencia?.slice(0, 10) ?? ""} /></div>
            </div>
            <div><label>Providência</label><textarea name="providencia" defaultValue={i.providencia ?? ""} placeholder="Providência a tomar / tomada" /></div>
            <div><label>Teor (preencher se faltar)</label><textarea name="teor" placeholder="Cole o teor integral se ainda não houver" /></div>
            <p className="sub" style={{ margin: 0 }}>Só grava os campos preenchidos. Datas em dias corridos — confira ciência e feriados locais antes de gerar prazo.</p>
          </FormModal>
          {!i.orfa && i.processo_id && (
            <FormModal
              label="Vincular cliente"
              titulo="Vincular cliente ao processo"
              descricao="Atribui (ou corrige) o cliente do processo desta intimação — útil quando a captação automática veio sem partes ou errada."
              acao={vincularClienteProcesso.bind(null, i.processo_id)}
              enviarLabel="Vincular"
              variant="default"
            >
              <div>
                <label>Cliente</label>
                <select name="cliente_id" required defaultValue="">
                  <option value="" disabled>Selecione…</option>
                  {clis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div><label>Papel</label><select name="papel" defaultValue="reu">{PAPEL.map((p) => <option key={p} value={p}>{humano(p)}</option>)}</select></div>
            </FormModal>
          )}
          <CriarPecaPendente
            tipoOrigem="intimacao"
            origemId={i.id}
            texto={i.providencia || i.resumo}
            baseTitulo={i.resumo}
            mapa={mapa}
          />
          <Acao
            label="Em análise"
            titulo="Marcar em análise"
            resumo={<>Mover esta intimação para <b>em análise</b>?</>}
            acao={() => atualizarIntimacao(i.id, "em_analise")}
          />
          <Acao
            label="Providência tomada"
            variant="ok"
            titulo="Registrar providência"
            confirmarLabel="Registrar"
            resumo={<>Marcar como <b>providência tomada</b>?</>}
            campoTexto={{ label: "Providência (opcional)", placeholder: "Ex.: protocolada manifestação.", multiline: true }}
            acao={(t) => atualizarIntimacao(i.id, "providencia_tomada", t)}
          />
          <Acao
            label="Sem providência"
            titulo="Sem providência"
            resumo={<>Marcar como <b>sem providência</b> (ciência apenas)?</>}
            acao={() => atualizarIntimacao(i.id, "sem_providencia")}
          />
          <Acao
            label="Arquivar"
            variant="danger"
            titulo="Arquivar intimação"
            confirmarLabel="Arquivar"
            resumo={<>Arquivar esta intimação? (muda o status para <b>arquivada</b>, auditado)</>}
            acao={() => atualizarIntimacao(i.id, "arquivada")}
          />
        </div>
      </div>
    </>
  );
}

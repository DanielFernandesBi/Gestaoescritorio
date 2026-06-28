"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { SegredoTag } from "@/components/ui";
import { HistoricoRegistro } from "@/components/detalhe/HistoricoRegistro";
import { CamposOportunidade, ConverterBtn } from "@/components/modules/FunilNegocios";
import { atualizarOportunidade, moverOportunidade } from "@/app/actions";
import { fmtBRL, fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { Oportunidade, OportunidadeFull } from "@/lib/data";

const ESTAGIOS = ["tratativa", "estudo_preliminar", "proposta", "negociacao", "fechado"];
const estTone = (e: string) =>
  e === "fechado" ? "val" : e === "negociacao" ? "cat-blue" : e === "proposta" ? "cat-amber"
    : e === "recusado" ? "cat-red" : e === "perdido" ? "cat-slate" : "cat-slate";
const driveHref = (id: string | null) =>
  id && /^[A-Za-z0-9_-]{20,}$/.test(id) ? `https://drive.google.com/file/d/${id}/view` : null;

function MasterRow({ o, ativo }: { o: Oportunidade; ativo: boolean }) {
  return (
    <Link className={`audp-mcard${ativo ? " on" : ""}`} href={`/negocios/${o.id}`}>
      {ativo && <span className="audp-mstripe" />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="vc-mtags"><span className={`pz-tag ${estTone(o.estagio)}`}>{humano(o.estagio)}</span></span>
        <span className="vc-mnome">{o.titulo}</span>
        <span className="vc-mmeta">{o.contato_nome}{o.valor_proposto != null ? ` · ${fmtBRL(o.valor_proposto)}` : ""}</span>
      </span>
    </Link>
  );
}

export function OportunidadePainel({ o, lista }: { o: OportunidadeFull; lista: Oportunidade[] }) {
  const router = useRouter();
  const [mvPend, setMvPend] = useState(false);
  const mover = async (estagio: string) => {
    setMvPend(true);
    const r = await moverOportunidade(o.id, estagio);
    setMvPend(false);
    if (r.ok) router.refresh();
  };
  const dHref = driveHref(o.drive_file_id);

  return (
    <div className="audp">
      {/* MASTER */}
      <aside className="audp-master">
        <div className="audp-master-h"><h1>Novos negócios</h1></div>
        <div className="audp-master-list">
          {lista.length === 0
            ? <div className="audp-empty">Nenhuma oportunidade.</div>
            : lista.map((x) => <MasterRow key={x.id} o={x} ativo={x.id === o.id} />)}
        </div>
      </aside>

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/negocios">← Novos negócios</Link>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner">
            <div className="audp-tags">
              <span className={`pz-tag ${estTone(o.estagio)}`}>{humano(o.estagio)}</span>
              {o.area && <span className="pz-tag cat-slate">{humano(o.area)}</span>}
              {o.probabilidade && <span className="pz-tag cat-blue">prob. {humano(o.probabilidade)}</span>}
              {o.origem_lead && <span className="pz-tag cat-neutral">{humano(o.origem_lead)}</span>}
              {o.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
            </div>
            <h2 className="audp-h2">{o.titulo}</h2>
            <div className="audp-cliline">
              <span className="audp-cli">{o.contato_nome}</span>
              {o.valor_proposto != null && <span className="cli-sep">· {fmtBRL(o.valor_proposto)}</span>}
              {o.responsavel && <span className="cli-sep">· {o.responsavel}</span>}
            </div>

            {/* contato / lead */}
            <div className="audp-sec">
              <div className="audp-sech">Contato &amp; lead</div>
              <div className="audp-dados">
                <div className="fld"><div className="k">Contato</div><div className="v">{o.contato_nome}</div></div>
                <div className="fld"><div className="k">Telefone</div><div className="v">{o.contato_telefone ?? "—"}</div></div>
                <div className="fld"><div className="k">E-mail</div><div className="v">{o.contato_email ?? "—"}</div></div>
                <div className="fld"><div className="k">Origem</div><div className="v">{o.origem_lead ? humano(o.origem_lead) : "—"}</div></div>
                <div className="fld"><div className="k">Área</div><div className="v">{o.area ? humano(o.area) : "—"}</div></div>
                <div className="fld"><div className="k">Responsável</div><div className="v">{o.responsavel ?? "—"}</div></div>
              </div>
            </div>

            {/* proposta */}
            <div className="audp-sec">
              <div className="audp-sech">Proposta</div>
              <div className="audp-dados">
                <div className="fld"><div className="k">Valor proposto</div><div className="v">{o.valor_proposto != null ? fmtBRL(o.valor_proposto) : "—"}</div></div>
                <div className="fld"><div className="k">Forma de pagamento</div><div className="v">{o.forma_pagamento ?? "—"}</div></div>
                <div className="fld"><div className="k">Probabilidade</div><div className="v">{o.probabilidade ? humano(o.probabilidade) : "—"}</div></div>
                <div className="fld"><div className="k">Contato em</div><div className="v">{o.data_contato ? fmtDate(o.data_contato) : "—"}</div></div>
                <div className="fld"><div className="k">Proposta em</div><div className="v">{o.data_proposta ? fmtDate(o.data_proposta) : "—"}</div></div>
                <div className="fld"><div className="k">Decisão em</div><div className="v">{o.data_decisao ? fmtDate(o.data_decisao) : "—"}</div></div>
              </div>
            </div>

            {/* resumo / estudo */}
            {(o.resumo || o.estudo_preliminar) && (
              <div className="audp-sec">
                <div className="audp-sech">Resumo &amp; estudo preliminar</div>
                {o.resumo && <p className="vp-teor" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{o.resumo}</p>}
                {o.estudo_preliminar && <p className="vp-teor" style={{ whiteSpace: "pre-wrap", marginTop: o.resumo ? 10 : 0 }}>{o.estudo_preliminar}</p>}
              </div>
            )}

            {/* anexo Drive */}
            <div className="audp-sec">
              <div className="audp-sech">Anexo · Drive</div>
              {o.drive_file_id
                ? (dHref
                    ? <a className="btn sm abrir" href={dHref} target="_blank" rel="noreferrer">Abrir proposta no Drive ↗</a>
                    : <div className="audp-empty">Arquivo: <span className="mono">{o.drive_file_id}</span></div>)
                : <div className="audp-empty">Sem anexo. Adicione o id do Drive em “Editar”.</div>}
            </div>

            {/* conversão */}
            {(o.cliente_id || o.contrato_id || o.estagio === "fechado") && (
              <div className="audp-sec">
                <div className="audp-sech">Conversão</div>
                {o.cliente_id ? (
                  <div className="przp-stack">
                    <div className="przp-origem">
                      <span className="pz-tag val">cliente</span>
                      <div className="mid"><div className="t">{o.clienteNome ?? "Cliente vinculado"}</div><div className="s">origem rastreável deste negócio</div></div>
                      <Link className="btn sm abrir" href={linkPara("cliente", o.cliente_id)}>Abrir</Link>
                    </div>
                    {o.contrato_id && (
                      <div className="przp-origem">
                        <span className="pz-tag cat-slate">contrato</span>
                        <div className="mid"><div className="t">{o.contratoObjeto ?? "Contrato"}</div><div className="s">+ parcelas no financeiro</div></div>
                        <Link className="btn sm abrir" href={linkPara("contrato", o.contrato_id)}>Abrir</Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="przp-empty-row">
                    <span>Fechado, ainda sem cliente. Converta para criar cliente + contrato + parcelas.</span>
                    <ConverterBtn o={o} />
                  </div>
                )}
              </div>
            )}

            {/* motivo de encerramento */}
            {o.encerrado && (
              <div className="audp-sec">
                <div className="audp-sech">Motivo do encerramento</div>
                <div className="vc-ok" style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}>{o.motivo_recusa ?? "—"}</div>
              </div>
            )}

            {/* histórico (auditoria) */}
            <div className="audp-sec">
              <div className="audp-sech">Histórico</div>
              <HistoricoRegistro id={o.id} />
            </div>

            {/* controle */}
            <div className="audp-status">
              <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Controle</div>
              <FormModal label="Editar" titulo="Editar oportunidade" acao={atualizarOportunidade.bind(null, o.id)} enviarLabel="Salvar" variant="default">
                <CamposOportunidade o={o} />
              </FormModal>
              {!o.encerrado && (
                <Acao label="Recusar" variant="danger" titulo="Recusar oportunidade" confirmarLabel="Recusar"
                  resumo={<>Encerrar <b>{o.titulo}</b> como <b>recusada</b>? Informe o motivo.</>}
                  campoTexto={{ label: "Motivo da recusa", obrigatorio: true, multiline: true }}
                  acao={(t) => moverOportunidade(o.id, "recusado", t)} />
              )}
              {!o.encerrado && (
                <Acao label="Perdido" titulo="Marcar como perdido" confirmarLabel="Marcar perdido"
                  resumo={<>Encerrar <b>{o.titulo}</b> como <b>perdido</b>? Informe o motivo.</>}
                  campoTexto={{ label: "Motivo", obrigatorio: true, multiline: true }}
                  acao={(t) => moverOportunidade(o.id, "perdido", t)} />
              )}
            </div>
            <div className="audp-status-note">Captação é ato humano (sessão/RLS). Nunca apagamos — correção é estágio (recusado/perdido), tudo auditado.</div>
          </div>
        </div>

        {/* mover (estágios) */}
        <div className="audp-actionbar">
          {ESTAGIOS.filter((e) => e !== o.estagio).map((e) => (
            <button key={e} type="button" className="btn default" disabled={mvPend} onClick={() => mover(e)}>→ {humano(e)}</button>
          ))}
        </div>
      </section>
    </div>
  );
}

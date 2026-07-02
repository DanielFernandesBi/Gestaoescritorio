"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { AnomaliaRow } from "@/components/AnomaliaRow";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { atualizarVarredura } from "@/app/actions";
import { fmtTime, fmtNum } from "@/lib/format";
import type { VarreduraCiclo, VarreduraHist } from "@/lib/queries";
import type { Anotacao } from "@/lib/data";

const Check = ({ s = 14, c = "var(--green)" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);
const NoteIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);
const PenIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);

const ddmm = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const statusLabel = (s: string) => (s === "concluida" ? "concluída" : s === "parcial" ? "parcial" : "falha");
const statusTone = (s: string): "green" | "amber" | "red" => (s === "concluida" ? "green" : s === "parcial" ? "amber" : "red");
const fonteLabel = (f: string) =>
  f === "ambas" ? "DJEN + push" : f === "djen" ? "DJEN" : f === "push" ? "push"
    : f === "redacao" ? "Redação" : f === "manutencao" ? "Manutenção" : f;
const janelaDias = (a: string | null, b: string | null) => {
  if (!a || !b) return null;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
  return d >= 0 ? d : null;
};

function MasterCard({ h, ativo }: { h: VarreduraHist; ativo: boolean }) {
  const anom = h.anomalias?.length ?? 0;
  return (
    <Link className={`audp-mcard vc-mcard${ativo ? " on" : ""}`} href={`/varredura/ciclos/${h.id}`}>
      {ativo && <span className="audp-mstripe" />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="vc-mtags">
          <span className={`pz-tag ${statusTone(h.status) === "green" ? "val" : statusTone(h.status) === "amber" ? "cat-amber" : "cat-red"}`}>{statusLabel(h.status)}</span>
          <span className="pz-tag cat-blue">{fonteLabel(h.fonte)}</span>
        </span>
        <span className="vc-mnome">Ciclo de {ddmm(h.criado_em)} · {fmtTime(h.criado_em)}</span>
        <span className={`vc-mmeta${anom ? " alerta" : ""}`}>
          {anom && h.anomalias?.[0] ? h.anomalias[0].tipo.replace(/_/g, " ") : `${fmtNum(h.itens_processados)} itens · ${anom} anomalias`}
        </span>
      </span>
    </Link>
  );
}

export function VarreduraCicloPainel({
  ciclo,
  lista,
  anotacoes,
}: {
  ciclo: VarreduraCiclo;
  lista: VarreduraHist[];
  anotacoes: Anotacao[];
}) {
  const [filtro, setFiltro] = useState<"todos" | "limpos">("todos");
  const [verNotas, setVerNotas] = useState(false);

  const limpos = lista.filter((h) => !(h.anomalias?.length));
  const visiveis = filtro === "limpos" ? limpos : lista;
  const anom = ciclo.anomalias ?? [];
  const dias = janelaDias(ciclo.janela_inicio, ciclo.janela_fim);
  const oab = ciclo.diagnostico_oab ?? [];
  const driveHref = ciclo.arquivo_drive_id && /^[A-Za-z0-9_-]{20,}$/.test(ciclo.arquivo_drive_id)
    ? `https://drive.google.com/file/d/${ciclo.arquivo_drive_id}/view`
    : null;

  return (
    <div className="audp">
      {/* MASTER */}
      <aside className="audp-master">
        <div className="audp-master-h">
          <h1>Varredura</h1>
          <div className="audp-filtros">
            <button type="button" className={`audp-chip ink${filtro === "todos" ? " on" : ""}`} onClick={() => setFiltro("todos")}>Ciclos ({lista.length})</button>
            <button type="button" className={`audp-chip tang${filtro === "limpos" ? " on" : ""}`} onClick={() => setFiltro("limpos")}>sem anomalia ({limpos.length})</button>
          </div>
        </div>
        <div className="audp-master-list">
          {visiveis.length === 0
            ? <div className="audp-empty">Nenhum ciclo.</div>
            : visiveis.map((h) => <MasterCard key={h.id} h={h} ativo={h.id === ciclo.id} />)}
        </div>
      </aside>

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/varredura">← Varredura</Link>
          <span className="vc-crumb">Varredura / Diagnóstico</span>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* cabeçalho */}
            <div className="vc-head">
              <div className="vc-head-l">
                <div className="audp-tags">
                  <span className={`pz-tag ${statusTone(ciclo.status) === "green" ? "val" : statusTone(ciclo.status) === "amber" ? "cat-amber" : "cat-red"}`}>{statusLabel(ciclo.status)}</span>
                  <span className="pz-tag cat-blue">{fonteLabel(ciclo.fonte)}</span>
                  {ciclo.cadastrado_por && <span className="pz-tag cowork">+ {ciclo.cadastrado_por}</span>}
                </div>
                <h2 className="audp-h2">Ciclo de {ddmm(ciclo.criado_em)} · {fmtTime(ciclo.criado_em)}</h2>
                <div className="vc-sub">
                  janela {ddmm(ciclo.janela_inicio)} → {ddmm(ciclo.janela_fim)}{dias != null ? ` (${dias} dia${dias === 1 ? "" : "s"})` : ""} · triagem agendada
                </div>
              </div>
              <div className={`vc-anomcard${anom.length ? " alerta" : ""}`}>
                <span className="n">{anom.length ? "⚠" : <Check s={18} c="var(--green)" />} {anom.length}</span>
                <span className="l">anomalias</span>
              </div>
            </div>

            {/* CONTADORES */}
            <div className="audp-sec">
              <div className="audp-sech">Contadores</div>
              <div className="vc-cont">
                <div className="vc-cont-c"><b>{fmtNum(ciclo.itens_processados)}</b><span>itens processados</span></div>
                <div className="vc-cont-c"><b>{fmtNum(ciclo.intimacoes_novas)}</b><span>intimações novas</span></div>
                <div className="vc-cont-c"><b>{fmtNum(ciclo.andamentos_novos)}</b><span>andamentos novos</span></div>
                <div className="vc-cont-c"><b>{fmtNum(ciclo.prazos_criados)}</b><span>prazos criados</span></div>
              </div>
            </div>

            {/* DIAGNÓSTICO OAB */}
            <div className="audp-sec">
              <div className="audp-sech">diagnostico_oab · cobertura por OAB</div>
              {oab.length ? (
                <div className="vc-oabwrap">
                  <div className="scan-grid">
                    {oab.map((d) => (
                      <div className="oab" key={d.oab}>
                        <div className="lbl">{d.oab} <Check s={12} /></div>
                        <div className="metrics">
                          <div className="metric"><b>{fmtNum(d.acervo_total)}</b><span>no acervo</span></div>
                          <div className="metric"><b>{fmtNum(d.itens_janela)}</b><span>na janela</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="vc-oabnote">
                    OABs com acervo e itens na janela → sem DJEN vazio/quebrado, mesmo sem erro explícito.
                    Cruzado com o Recorte Digital (mesmas OABs): casou em conteúdo, não há buraco de cobertura.
                  </div>
                </div>
              ) : (
                <div className="audp-empty">Sem diagnóstico por OAB neste ciclo.</div>
              )}
            </div>

            {/* ANOMALIAS */}
            <div className="audp-sec">
              <div className="audp-sech">anomalias · DJEN / Drive <span className="audp-count">{anom.length}</span></div>
              {anom.length ? (
                <div className="anom-list">
                  {anom.map((a, i) => <AnomaliaRow key={i} a={a} critico={ciclo.status !== "concluida"} />)}
                </div>
              ) : (
                <div className="vc-ok"><Check s={15} /> Nenhuma falha degradada nesta execução. DJEN e Drive responderam — as gravações no banco persistiram normalmente.</div>
              )}
            </div>

            {/* WATERMARK */}
            <div className="audp-sec">
              <div className="audp-sech">watermark · degradação segura</div>
              <div className="vc-wm">
                <div className="vc-wm-h">
                  <Check s={14} /> {ciclo.status === "concluida" ? "0 falhas, 0 divergências de auditoria" : "ciclo gravou status de degradação"}
                  <span className="vc-wm-mv mono">{ciclo.status === "concluida" ? "ultima_varredura movida" : "watermark NÃO movido"}</span>
                </div>
                <div className="vc-wm-note">
                  Em falha ou degradação, o ciclo grava <span className="mono">status='falha'/'parcial'</span> + anomalias e <b>não move</b> o
                  watermark — a próxima execução reprocessa a mesma janela. Snapshot append-only, nunca editado.
                </div>
              </div>
            </div>

            {/* DADOS DO CICLO */}
            <div className="audp-sec">
              <div className="audp-sech">Dados do ciclo</div>
              <div className="audp-dados">
                <div className="fld"><div className="k">Fonte</div><div className="v">{fonteLabel(ciclo.fonte)}</div></div>
                <div className="fld"><div className="k">Status</div><div className="v" style={{ color: `var(--${statusTone(ciclo.status)})` }}>{statusLabel(ciclo.status)}</div></div>
                <div className="fld"><div className="k">Janela</div><div className="v">{ddmm(ciclo.janela_inicio)} → {ddmm(ciclo.janela_fim)}</div></div>
                <div className="fld"><div className="k">Arquivo de origem</div><div className="v mono" style={{ fontSize: 12 }}>{ciclo.arquivo_drive_id ?? "—"}</div></div>
                <div className="fld"><div className="k">Cadastrado por</div><div className="v">{ciclo.cadastrado_por ?? "—"}</div></div>
                <div className="fld"><div className="k">Alimenta</div><div className="v mono" style={{ fontSize: 12 }}>vw_ultima_varredura → <Link className="proc-link" href="/painel">Painel</Link></div></div>
              </div>
            </div>

            {/* NOTAS */}
            {verNotas && (
              <div className="audp-sec">
                <div className="audp-sech">Anotações <span className="audp-count">{anotacoes.length}</span></div>
                <Anotacoes entidadeTipo="varredura" entidadeId={ciclo.id} notas={anotacoes} />
              </div>
            )}

            {/* CONTROLE */}
            <div className="audp-status">
              <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Controle</div>
              <FormModal
                label={<><PenIco /> Editar varredura</>}
                titulo="Editar varredura"
                descricao="Correção pontual de fonte, status ou janela do ciclo. O snapshot é append-only; ajustes ficam auditados."
                acao={atualizarVarredura.bind(null, ciclo.id)}
                enviarLabel="Salvar"
                variant="default"
              >
                <div><label>Fonte</label><select name="fonte" defaultValue={ciclo.fonte}><option value="djen">DJEN</option><option value="push">push</option><option value="ambas">ambas</option><option value="redacao">redação</option><option value="manutencao">manutenção</option></select></div>
                <div><label>Status</label><select name="status" defaultValue={ciclo.status}><option value="concluida">concluída</option><option value="parcial">parcial</option><option value="falha">falha</option></select></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label>Janela início</label><input type="date" name="janela_inicio" defaultValue={ciclo.janela_inicio?.slice(0, 10) ?? ""} /></div>
                  <div><label>Janela fim</label><input type="date" name="janela_fim" defaultValue={ciclo.janela_fim?.slice(0, 10) ?? ""} /></div>
                </div>
              </FormModal>
              <button type="button" className={`btn default${verNotas ? " on" : ""}`} onClick={() => setVerNotas((v) => !v)}>
                <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
              </button>
            </div>
            <div className="audp-status-note">A tabela <span className="mono">varreduras</span> é append-only — cada execução é um snapshot. Anotações são notas de mesa, não alteram o ciclo.</div>
          </div>
        </div>

        {/* RODAPÉ DE COMANDO */}
        <div className="vc-cmd">
          <Link className="vc-prompt" href="/busca">
            <span className="vc-prompt-spark">✦</span>
            <span>Pergunte sobre esta varredura — “o DJEN veio completo hoje?”</span>
            <span className="vc-prompt-go">→</span>
          </Link>
          <Link className="btn primary vc-veritens" href="/varredura/intimacoes">≡ Ver itens da varredura</Link>
          {driveHref
            ? <a className="btn default" href={driveHref} target="_blank" rel="noreferrer">Abrir JSON ↗</a>
            : <button type="button" className="btn default" disabled title="Sem arquivo de origem rastreável neste ciclo">Abrir JSON</button>}
          <Link className="btn default" href="/busca" title="A triagem roda às 22h; sob demanda, peça “rode a triagem” no chat">↻ Rodar agora</Link>
        </div>
      </section>
    </div>
  );
}

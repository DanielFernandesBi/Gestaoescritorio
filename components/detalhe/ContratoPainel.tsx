"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ProcRef } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { DocumentosCaso } from "@/components/detalhe/DocumentosCaso";
import { marcarPago, atualizarContrato, criarParcela, mudarStatusContrato } from "@/app/actions";
import { CONTRATO_STATUS } from "@/lib/enums";
import { fmtBRL, fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { Contrato, Documento, Anotacao, ParcelaContrato } from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Check = ({ s = 14, c = "#fff" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);
const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const NoteIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);
const PlusIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const kbrl = (n: number) => (n >= 1000 ? `R$ ${Math.round(n / 1000)}k` : `R$ ${n.toFixed(0)}`);
const statusTone = (s: string) => s === "vigente" ? "val" : s === "quitado" ? "cat-neutral" : "preso";
const parcelaTone = (s: string) => s === "pago" ? "val" : s === "atrasado" ? "preso" : s === "a_vencer" ? "tone-amber" : "cat-neutral";

/* ── seção rotulada ──────────────────────────────────────────────────────── */
function Sec({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="audp-sec">
      <div className="audp-sech">{titulo}{sub && <span className="cli-sech-sub">{sub}</span>}{extra}</div>
      {children}
    </div>
  );
}

/* ── master: card de contrato ────────────────────────────────────────────── */
function MasterCard({ c, ativo }: { c: Contrato; ativo: boolean }) {
  return (
    <Link className={`audp-mcard cli-mcard${ativo ? " on" : ""}`} href={linkPara("contrato", c.id)}>
      <div className="int-mtags"><span className={`pz-tag ${statusTone(c.status)}`}>{humano(c.status)}</span></div>
      <div className="cli-mnome">{c.cliente}</div>
      <div className="cli-mmeta">
        {c.total_aberto > 0 ? <span style={{ color: "var(--amber)", fontWeight: 600 }}>{kbrl(c.total_aberto)} aberto</span> : <span style={{ color: "var(--green)", fontWeight: 600 }}>quitado</span>}
        {" · "}{kbrl(c.valor_total)} total
      </div>
    </Link>
  );
}

/* ── editar contrato ─────────────────────────────────────────────────────── */
function EditarContrato({ c, label = <><PenIco /> Editar contrato</> }: { c: Contrato; label?: ReactNode }) {
  return (
    <FormModal label={label} titulo="Editar contrato" descricao="Altere objeto, valor, parcelas, contratante ou status. Nada é apagado — tudo auditado." acao={atualizarContrato.bind(null, c.id)} enviarLabel="Salvar" variant="default">
      <div><label>Objeto</label><textarea name="objeto" required defaultValue={c.objeto} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Valor total (R$)</label><input name="valor_total" defaultValue={String(c.valor_total)} /></div>
        <div><label>Status</label><select name="status" defaultValue={c.status}>{CONTRATO_STATUS.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Contratante</label><input name="contratante" defaultValue={c.contratante ?? ""} /></div>
        <div><label>Forma de pagamento</label><input name="forma_pagamento" defaultValue={c.forma_pagamento ?? ""} /></div>
      </div>
      <div><label>Observações</label><textarea name="observacoes" defaultValue={c.observacoes ?? ""} /></div>
    </FormModal>
  );
}

/* ── nova parcela ────────────────────────────────────────────────────────── */
function NovaParcela({ c, label }: { c: Contrato; label: ReactNode }) {
  return (
    <FormModal label={label} titulo="Nova parcela" descricao="Adiciona uma parcela ao cronograma de pagamento." acao={criarParcela.bind(null, c.id)} enviarLabel="Adicionar" variant="default">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Nº parcela</label><input type="number" name="numero_parcela" min={0} defaultValue={c.qtd_parcelas + 1} /></div>
        <div><label>Valor (R$)</label><input name="valor" required /></div>
      </div>
      <div><label>Vencimento</label><input type="date" name="vencimento" required /></div>
      <div><label>Forma</label><input name="forma" placeholder="pix, transferência…" /></div>
    </FormModal>
  );
}

/* ── componente principal ────────────────────────────────────────────────── */
export function ContratoPainel({ c, lista, documentos, anotacoes }: { c: Contrato; lista: Contrato[]; documentos: Documento[]; anotacoes: Anotacao[] }) {
  const [filtro, setFiltro] = useState<"vigentes" | "aberto">("vigentes");
  const [verNotas, setVerNotas] = useState(false);

  const vigentes = lista.filter((x) => x.status === "vigente");
  const aberto = lista.filter((x) => x.total_aberto > 0 && x.status !== "quitado" && x.status !== "rescindido");
  const visiveis = filtro === "aberto" ? aberto : vigentes;

  const socio = c.valor_total / 2;
  const pagas = c.parcelas.filter((p) => p.status === "pago").length;
  const abertasN = c.parcelas.filter((p) => p.status === "a_vencer" || p.status === "atrasado").length;
  const proxima: ParcelaContrato | undefined = c.parcelas.find((p) => p.status === "atrasado") ?? c.parcelas.find((p) => p.status === "a_vencer");
  const ativo = c.status !== "rescindido" && c.status !== "quitado";

  return (
    <div className="audp">
      {/* MASTER */}
      <aside className="audp-master">
        <div className="audp-master-h">
          <h1>Contratos</h1>
          <div className="audp-filtros">
            <button type="button" className={`audp-chip ink${filtro === "vigentes" ? " on" : ""}`} onClick={() => setFiltro("vigentes")}>Vigentes ({vigentes.length})</button>
            <button type="button" className={`audp-chip tang${filtro === "aberto" ? " on" : ""}`} onClick={() => setFiltro("aberto")}>em aberto ({aberto.length})</button>
          </div>
        </div>
        <div className="audp-master-list">
          {visiveis.length === 0
            ? <div className="audp-empty">Nada por aqui.</div>
            : visiveis.map((x) => <MasterCard key={x.id} c={x} ativo={x.id === c.id} />)}
        </div>
      </aside>

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/financeiro">← Financeiro</Link>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* cabeçalho */}
            <div className="audp-title-row">
              <div className="audp-title-l">
                <div className="audp-tags">
                  <span className={`pz-tag ${statusTone(c.status)}`}>{humano(c.status)}</span>
                  <span className="pz-tag cat-neutral">{c.qtd_parcelas} parcela{c.qtd_parcelas === 1 ? "" : "s"}</span>
                </div>
                <h2 className="audp-h2">{c.objeto}</h2>
                <div className="audp-cliline">
                  <Link className="proc-link audp-cli" href={linkPara("cliente", c.cliente_id)}>{c.cliente}</Link>
                  {c.contratante && <span className="ctr-contratante">contratante: {c.contratante}</span>}
                </div>
              </div>
              <div className="przp-datecard tone-amber">
                <div className="d">{kbrl(c.total_aberto)}</div>
                <div className="s">a receber · de {kbrl(c.valor_total)}</div>
              </div>
            </div>

            {/* BLOCO 1 · DADOS */}
            <Sec titulo="Dados do contrato">
              <div className="audp-dados">
                <div className="fld"><div className="k">Objeto</div><div className="v">{c.objeto}</div></div>
                <div className="fld"><div className="k">Valor total</div><div className="v mono">{fmtBRL(c.valor_total)}</div></div>
                <div className="fld"><div className="k">Forma de pagamento</div><div className="v">{c.forma_pagamento ?? "—"}</div></div>
                <div className="fld"><div className="k">Data do contrato</div><div className="v mono">{fmtDate(c.data_contrato)}</div></div>
                <div className="fld"><div className="k">Contratante</div><div className="v">{c.contratante ?? "—"}</div></div>
                <div className="fld"><div className="k">Status</div><div className="v" style={{ color: c.status === "vigente" ? "var(--green)" : c.status === "rescindido" || c.status === "inadimplente" ? "var(--red)" : "var(--text)", fontWeight: 600 }}>{humano(c.status)}</div></div>
              </div>
            </Sec>

            {/* BLOCO 2 · RESUMO */}
            <Sec titulo="Resumo" sub="rateio do sócio 50%">
              <div className="cli-kpis">
                <div className="cli-kpi"><div className="n">{kbrl(c.valor_total)}</div><div className="l">total contratado</div></div>
                <div className="cli-kpi"><div className="n" style={{ color: "var(--green)" }}>{kbrl(c.total_pago)}</div><div className="l">recebido · {pagas} parcela{pagas === 1 ? "" : "s"}</div></div>
                <div className="cli-kpi"><div className="n" style={{ color: "var(--amber)" }}>{kbrl(c.total_aberto)}</div><div className="l">em aberto · {abertasN} parcela{abertasN === 1 ? "" : "s"}</div></div>
                <div className="cli-kpi"><div className="n">{kbrl(socio)}</div><div className="l">cota do sócio (50%)</div></div>
              </div>
            </Sec>

            {/* BLOCO 3 · PARCELAS */}
            <Sec titulo="Parcelas · pagamentos" extra={<><span className="audp-count">{c.parcelas.length}</span><span className="cli-sech-acao"><NovaParcela c={c} label={<><PlusIco /> Parcela</>} /></span></>}>
              {c.parcelas.length === 0 ? (
                <div className="audp-empty">Sem parcelas — use “+ Parcela”.</div>
              ) : (
                <div className="ctr-table">
                  <div className="ctr-tr ctr-th"><div>#</div><div>Valor</div><div>Vencimento</div><div>Pago em</div><div>Status</div><div /></div>
                  {c.parcelas.map((p) => {
                    const corrente = proxima?.id === p.id;
                    return (
                      <div className={`ctr-tr${corrente ? " corrente" : ""}`} key={p.id}>
                        <div className="mono">{p.numero_parcela}</div>
                        <div className={`mono${corrente ? " b" : ""}`}>{fmtBRL(p.valor)}</div>
                        <div className={`mono${corrente ? " b" : ""}`} style={p.status === "atrasado" ? { color: "var(--red)" } : corrente ? { color: "var(--amber)" } : undefined}>{ddmm(p.vencimento)}{p.dias_atraso > 0 && <span className="ctr-atraso"> · {p.dias_atraso}d</span>}</div>
                        <div className="mono">{p.pago_em ? <span style={{ color: "var(--green)" }}>{ddmm(p.pago_em)}</span> : "—"}</div>
                        <div><span className={`pz-tag ${parcelaTone(p.status)}`}>{humano(p.status)}</span></div>
                        <div className="ctr-acao">
                          {(p.status === "a_vencer" || p.status === "atrasado") && (
                            <Acao label="Marcar paga" variant="ok" size="sm" titulo="Registrar pagamento" confirmarLabel="Marcar paga" resumo={<>Registrar a parcela {p.numero_parcela} ({fmtBRL(p.valor)}) como <b>paga</b> hoje?</>} acao={marcarPago.bind(null, p.id)} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Sec>

            {/* BLOCO 4 · PRÓXIMA PARCELA */}
            {proxima && (
              <Sec titulo="Próxima parcela" sub="vw_financeiro_pendente">
                <div className={`est-marco${proxima.status === "atrasado" ? " venc" : ""}`}>
                  <div className="l">
                    <div className="t">Parcela {proxima.numero_parcela} de {c.qtd_parcelas} · {fmtBRL(proxima.valor)}</div>
                    <div className="ctr-prox-sub">vence {ddmm(proxima.vencimento)} — <b>{humano(proxima.status)}</b>. Rode <span className="mono">fn_marcar_atrasados()</span> antes do fechamento para reclassificar vencidas.</div>
                  </div>
                  <Acao label={<><Check s={13} c="var(--green)" /> Marcar paga</>} variant="ok" titulo="Registrar pagamento" confirmarLabel="Marcar paga" resumo={<>Registrar a parcela {proxima.numero_parcela} ({fmtBRL(proxima.valor)}) como <b>paga</b> hoje?</>} acao={marcarPago.bind(null, proxima.id)} />
                </div>
              </Sec>
            )}

            {/* BLOCO 5 · VÍNCULO + DOCUMENTOS */}
            <Sec titulo="Vínculo e documentos financeiros">
              {c.processo_id && (
                <div className="przp-origem" style={{ marginBottom: 8 }}>
                  <span className="pz-tag cat-slate">processo</span>
                  <div className="mid"><div className="t">{c.objeto.split(/\s*[—–]/)[0].trim()}</div><div className="s mono"><ProcRef cnj={c.processo_cnj} id={c.processo_id} /></div></div>
                  <Link className="btn sm abrir" href={linkPara("processo", c.processo_id)}>Abrir</Link>
                </div>
              )}
              <DocumentosCaso documentos={documentos} vinculo={{ campo: "contrato_id", id: c.id }} titulo="Documentos financeiros" tipoPadrao="outro" />
            </Sec>

            {/* NOTAS */}
            {verNotas && (
              <Sec titulo="Anotações" extra={<span className="audp-count">{anotacoes.length}</span>}>
                <Anotacoes entidadeTipo="contrato" entidadeId={c.id} notas={anotacoes} />
              </Sec>
            )}

            {/* STATUS */}
            <div className="audp-status">
              <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Status do contrato</div>
              <EditarContrato c={c} />
              <button type="button" className={`btn default${verNotas ? " on" : ""}`} onClick={() => setVerNotas((v) => !v)}>
                <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
              </button>
              <EditarContrato c={c} label="Renegociar" />
              {ativo && (
                <Acao label="Rescindir" variant="danger" titulo="Rescindir contrato" confirmarLabel="Rescindir" resumo={<>Rescindir o contrato de <b>{c.cliente}</b>? Não é apagado — muda para <b>rescindido</b> (auditado).</>} campoTexto={{ label: "Motivo (opcional)", placeholder: "Ex.: acordo / desistência." }} acao={(t) => mudarStatusContrato(c.id, "rescindido", t)} />
              )}
            </div>
            <div className="audp-status-note">Rescindir / quitar é troca de status (vigente / quitado / rescindido / inadimplente) — nunca DELETE. Tudo auditado.</div>
          </div>
        </div>

        {/* action bar */}
        <div className="audp-actionbar">
          <NovaParcela c={c} label={<><PlusIco /> Nova parcela</>} />
          {proxima && <Acao label={<><Check c="var(--green)" /> Marcar parcela paga</>} variant="ok" size="md" titulo="Registrar pagamento" confirmarLabel="Marcar paga" resumo={<>Registrar a parcela {proxima.numero_parcela} ({fmtBRL(proxima.valor)}) como <b>paga</b> hoje?</>} acao={marcarPago.bind(null, proxima.id)} />}
          <EditarContrato c={c} />
        </div>
      </section>
    </div>
  );
}

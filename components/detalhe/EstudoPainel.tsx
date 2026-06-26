"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ProcLink } from "@/components/ProcLink";
import { SegredoTag } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { atualizarEstudo, concluirEstudo, criarPeca } from "@/app/actions";
import { ESTUDO_TIPO, ESTUDO_STATUS, PECA_TIPO, PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";
import { linkPara } from "@/lib/links";
import { humano } from "@/lib/format";
import type { EstudoFull, EstudoObjetivo, EstudoVinculo, EstudoCondenacao, Anotacao } from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Spark = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>
);
const Check = ({ s = 14, c = "#fff" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);
const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const NoteIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);
const FileIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h11l5 5v11H4z" /><path d="M8 13h8" /></svg>
);
const Scale = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v18M5 8l7-5 7 5M5 8v8l7 5 7-5V8" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const objTone = (s: string) =>
  s === "atingido" ? "val" : s === "em_curso" ? "tone-amber" : s === "frustrado" ? "tone-red" : "cat-neutral";
const poloVinculo = (v: EstudoVinculo) => v.area ? humano(v.area) : "processo";

/* Texto longo com expandir/recolher por clique. */
function Expandivel({ texto, limite = 220 }: { texto: string; limite?: number }) {
  const [aberto, setAberto] = useState(false);
  const longo = texto.length > limite;
  const mostra = aberto || !longo ? texto : texto.slice(0, limite).trimEnd() + "…";
  return (
    <div className="est-long">
      <p>{mostra}</p>
      {longo && (
        <button type="button" className="est-mais" onClick={() => setAberto((v) => !v)}>
          {aberto ? "ver menos" : "ver mais"}
        </button>
      )}
    </div>
  );
}

/* ── seção rotulada ──────────────────────────────────────────────────────── */
function Sec({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="audp-sec">
      <div className="audp-sech">{titulo}{sub && <span className="cli-sech-sub">{sub}</span>}{extra}</div>
      {children}
    </div>
  );
}

/* ── editar estudo ───────────────────────────────────────────────────────── */
function EditarEstudo({ e }: { e: EstudoFull }) {
  return (
    <FormModal
      label={<><PenIco /> Editar estudo</>}
      titulo="Editar estudo"
      descricao="Altere objetivos, teses e diagnóstico geral. Snapshots versionados — nada é sobrescrito de forma destrutiva."
      acao={atualizarEstudo.bind(null, e.id)}
      enviarLabel="Salvar"
      variant="default"
    >
      <div><label>Título</label><input name="titulo" required defaultValue={e.titulo} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Tipo</label><select name="tipo" defaultValue={e.tipo ?? "geral"}>{ESTUDO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Status</label><select name="status" defaultValue={e.status}>{ESTUDO_STATUS.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
      </div>
      <div><label>Diagnóstico · estratégia geral</label><textarea name="conteudo" defaultValue={e.conteudo ?? ""} placeholder="Visão geral da estratégia de execução." /></div>
      <div><label>Teses</label><textarea name="teses" defaultValue={e.teses ?? ""} placeholder="Teses de direito material invocadas." /></div>
      <div><label>Jurisprudência</label><textarea name="jurisprudencia" defaultValue={e.jurisprudencia ?? ""} placeholder="Súmulas, precedentes, decisões." /></div>
    </FormModal>
  );
}

/* ── criar peça a partir do estudo ───────────────────────────────────────── */
function CriarPecaBtn({ e, label }: { e: EstudoFull; label: ReactNode }) {
  const proc = e.vinculos[0]?.processo_id ?? "";
  return (
    <FormModal label={label} titulo="Nova peça (a partir do estudo)" descricao="Abre uma peça no backlog ligada ao processo do estudo." acao={criarPeca} enviarLabel="Criar peça" variant="default">
      <input type="hidden" name="processo_id" defaultValue={proc} />
      <div><label>Título</label><input name="titulo" required defaultValue={e.titulo} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Tipo</label><select name="tipo" defaultValue="incidente">{PECA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Prioridade</label><select name="prioridade" defaultValue="alta">{PRIORIDADES.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
      </div>
      <div><label>Responsável</label><select name="responsavel" defaultValue="Daniel">{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      <div><label>Descrição</label><textarea name="descricao" placeholder="Tese / pedido." /></div>
    </FormModal>
  );
}

/* ── componente principal ────────────────────────────────────────────────── */
export function EstudoPainel({ e, anotacoes }: { e: EstudoFull; anotacoes: Anotacao[] }) {
  const [verNotas, setVerNotas] = useState(false);
  const marcoVencido = e.marco_dias != null && e.marco_dias < 0;
  const ativo = e.status !== "concluido" && e.status !== "superado";

  return (
    <div className="audp">
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/estudos">← Estudos</Link>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* cabeçalho */}
            <div className="audp-tags">
              <span className="pz-tag cowork"><Spark s={9} />{e.tipo ? humano(e.tipo) : "estudo"}</span>
              <span className="pz-tag cat-neutral">{humano(e.status)}</span>
            </div>
            <h2 className="audp-h2">{e.titulo}</h2>
            <div className="audp-cliline">
              {e.cliente_id
                ? <Link className="proc-link audp-cli" href={linkPara("cliente", e.cliente_id)}>{e.cliente ?? "Cliente"}</Link>
                : <b className="audp-cli">{e.cliente ?? "Sem cliente"}</b>}
              <span className="cli-sep">· {e.vinculos.length} processo{e.vinculos.length === 1 ? "" : "s"}</span>
              {e.pena_unificada && <span className="cli-sep">· pena unificada {e.pena_unificada}</span>}
            </div>

            {/* BLOCO 1 · PRÓXIMO MARCO */}
            {(e.proximo_marco || e.marco_dias != null) && (
              <div className={`est-marco${marcoVencido ? " venc" : ""}`}>
                <div className="l">
                  <div className="k">Próximo marco · vw_estrategia_cliente</div>
                  <div className="t">{e.proximo_marco ?? "Marco de execução"}</div>
                </div>
                {e.marco_dias != null && (
                  <div className="r">
                    <div className="d">{e.marco_dias < 0 ? `−${Math.abs(e.marco_dias)} d` : `${e.marco_dias} d`}</div>
                    <div className="u">{e.marco_dias < 0 ? "vencida" : "a cumprir"}</div>
                  </div>
                )}
              </div>
            )}

            {/* Diagnóstico · estratégia geral (campo do estudo, fora do print) */}
            {e.conteudo && (
              <Sec titulo="Diagnóstico · estratégia geral">
                <div className="est-box"><Expandivel texto={e.conteudo} /></div>
              </Sec>
            )}

            {/* BLOCO 2 · OBJETIVOS × INSTRUMENTO */}
            {e.objetivos.length > 0 && (
              <Sec titulo="Objetivos · instrumento" sub="estudo_objetivos · vw_objetivos_instrumento">
                <div className="est-table">
                  <div className="est-tr est-th">
                    <div>Benefício-alvo</div><div>Alvo · ação-meio</div><div>Data-alvo</div><div>Status</div>
                  </div>
                  {e.objetivos.map((o: EstudoObjetivo) => (
                    <div className="est-tr" key={o.id}>
                      <div className="est-ba">{o.beneficio_alvo ?? "—"}</div>
                      <div className="est-am">
                        {o.alvo && o.processo_id
                          ? <ProcLink id={o.processo_id}><span className="mono">{o.alvo}</span></ProcLink>
                          : null}
                        {o.alvo && o.objetivo ? " × " : null}
                        <span>{o.objetivo}</span>
                      </div>
                      <div className={`est-da mono${o.status === "em_curso" ? " amber" : ""}`}>{ddmm(o.data_alvo)}</div>
                      <div><span className={`pz-tag ${objTone(o.status)}`}>{humano(o.status)}</span></div>
                    </div>
                  ))}
                </div>
                <div className="est-foot">Cada objetivo casa a condenação-<b>ALVO</b> (<span className="mono">processo_id</span>) com a ação-<b>MEIO</b> (<span className="mono">processo_instrumento_id</span>) — o instrumento que conquista o benefício.</div>
              </Sec>
            )}

            {/* BLOCO 3 · TESES SEMEADAS PELA IA */}
            {(e.teses || e.jurisprudencia) && (
              <div className="audp-ia">
                <div className="audp-ia-h"><Spark /><span>Teses semeadas pela IA · acervo curado</span></div>
                {e.teses && <div className="est-tese"><Expandivel texto={e.teses} /></div>}
                {e.jurisprudencia && <div className="est-tese"><div className="est-tese-k">Jurisprudência</div><Expandivel texto={e.jurisprudencia} /></div>}
                <div className="audp-ia-note">
                  Sementes da IA do acervo curado — <b>aura cobalt até validar</b>. Só súmula / vinculante / acervo do escritório;
                  jurisprudência não verificada não entra. Validadas por Daniel, perdem a aura e entram no estudo.
                </div>
              </div>
            )}

            {/* BLOCO 4 · DIAGNÓSTICO × ESTRATÉGIA POR PROCESSO */}
            {e.vinculos.length > 0 && (
              <Sec titulo="Diagnóstico · estratégia por processo" sub="estudo_processo" extra={<span className="audp-count">{e.vinculos.length}</span>}>
                <div className="przp-stack">
                  {e.vinculos.map((v) => (
                    <div className="est-proc" key={v.id}>
                      <div className="est-proc-h">
                        <span className="pz-tag cat-slate">{poloVinculo(v)}</span>
                        <b>{v.area ? humano(v.area) : "Processo"}</b>
                        {v.segredo ? <SegredoTag on /> : <ProcLink id={v.processo_id}><span className="mono est-proc-cnj">{v.processo}</span></ProcLink>}
                      </div>
                      {v.diagnostico && <div className="est-proc-l"><span className="est-proc-k">Diagnóstico:</span> {v.diagnostico}</div>}
                      {v.estrategia && <div className="est-proc-l"><span className="est-proc-k">Estratégia:</span> {v.estrategia}</div>}
                    </div>
                  ))}
                </div>
              </Sec>
            )}

            {/* BLOCO 5 · CONDENAÇÕES */}
            {e.condenacoes.length > 0 && (
              <Sec titulo="Condenações que compõem a pena" sub="vw_condenacoes_cliente" extra={<span className="audp-count">{e.condenacoes.length}</span>}>
                <div className="est-cond">
                  {e.condenacoes.map((c: EstudoCondenacao, i) => {
                    const nat = c.hediondo ? { t: "hediondo", c: "var(--red)" } : c.reincidente ? { t: "reincidente", c: "var(--amber)" } : { t: "comum", c: "var(--muted)" };
                    return (
                      <div className="est-cond-card" key={i}>
                        <div className="t mono">{c.artigo ? `Art. ${c.artigo}` : "—"}{c.pena_texto ? ` · ${c.pena_texto}` : ""}</div>
                        <div className="s" style={{ color: nat.c }}>{c.descricao_crime || nat.t}</div>
                      </div>
                    );
                  })}
                </div>
              </Sec>
            )}

            {/* NOTAS (toggle) */}
            {verNotas && (
              <Sec titulo="Anotações" extra={<span className="audp-count">{anotacoes.length}</span>}>
                <Anotacoes entidadeTipo="estudo" entidadeId={e.id} notas={anotacoes} />
              </Sec>
            )}

            {/* CONTROLE · DESFECHO */}
            <div className="audp-status">
              <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Estudo</div>
              <EditarEstudo e={e} />
              <button type="button" className={`btn default${verNotas ? " on" : ""}`} onClick={() => setVerNotas((v) => !v)}>
                <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
              </button>
              {ativo && (
                <Acao
                  label={<><Check s={13} c="var(--green)" /> Marcar concluído</>}
                  variant="ok"
                  titulo="Marcar estudo como concluído"
                  confirmarLabel="Concluir"
                  resumo={<>Marcar <b>{e.titulo}</b> como <b>concluído</b>? Troca de status — nunca DELETE, tudo auditado.</>}
                  acao={() => concluirEstudo(e.id)}
                />
              )}
            </div>
            <div className="audp-status-note">Atestados e condenações são snapshots versionados — novo sempre acrescenta, nunca sobrescreve. Status (em elaboração / concluído / arquivado) — nunca DELETE. Tudo auditado.</div>
          </div>
        </div>

        {/* action bar */}
        <div className="audp-actionbar">
          {e.cliente_id && <Link className="btn primary" href={linkPara("cliente", e.cliente_id)}><Scale /> Abrir na execução penal</Link>}
          <CriarPecaBtn e={e} label={<><FileIco /> Criar peça</>} />
          <EditarEstudo e={e} />
        </div>
      </section>
    </div>
  );
}

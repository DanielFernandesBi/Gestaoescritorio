"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ProcRef } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
import { CriarCompromisso } from "@/components/CriarCompromisso";
import { moverTarefa, atualizarTarefa, assumirTarefa, reatribuirTarefa } from "@/app/actions";
import { PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { TarefaFull, TarefaCard, Anotacao } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

type Socio = "Daniel" | "Rodolfo";
const oUtroSocio = (s: Socio): Socio => (s === "Daniel" ? "Rodolfo" : "Daniel");

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Spark = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>
);
const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const NoteIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const curto = (s: string) => { const t = (s ?? "").split(/\s*[—–[]| · |\. /)[0].trim(); return t.length > 64 ? t.slice(0, 62) + "…" : t; };
const prioTone = (p: string | null) => p === "urgente" ? "preso" : p === "alta" ? "tone-amber" : "cat-neutral";
const statusTone = (s: string) => s === "concluida" ? "val" : s === "cancelada" ? "cat-neutral" : s === "em_andamento" ? "tone-blue" : "tang";
const aberta = (s: string) => s !== "concluida" && s !== "cancelada";

/* ── seção rotulada ──────────────────────────────────────────────────────── */
function Sec({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="audp-sec">
      <div className="audp-sech">{titulo}{sub && <span className="cli-sech-sub">{sub}</span>}{extra}</div>
      {children}
    </div>
  );
}
/** Card de vínculo genérico (lista). */
function Item({ tag, tagTone = "cat-slate", titulo, sub, href, dias }: { tag: string; tagTone?: string; titulo: ReactNode; sub?: ReactNode; href: string; dias?: number | null }) {
  return (
    <div className="przp-origem">
      <span className={`pz-tag ${tagTone}`}>{tag}</span>
      <div className="mid"><div className="t">{titulo}</div>{sub && <div className="s">{sub}</div>}</div>
      {dias != null && <span className={`proc-dias ${dias <= 2 ? "red" : dias <= 5 ? "amber" : "tang"}`}>{dias < 0 ? `−${Math.abs(dias)}d` : `${dias}d`}</span>}
      <Link className="btn sm abrir" href={href}>Abrir</Link>
    </div>
  );
}

/* ── master: card da lista ───────────────────────────────────────────────── */
function MasterCard({ t, ativo }: { t: TarefaCard; ativo: boolean }) {
  return (
    <Link className={`audp-mcard cli-mcard${ativo ? " on" : ""}`} href={linkPara("tarefa", t.id)}>
      <div className="int-mtags">
        <span className={`pz-tag ${prioTone(t.prioridade)}`}>{humano(t.prioridade) || "média"}</span>
        <span className={`pz-tag ${statusTone(t.status)}`}>{humano(t.status)}</span>
      </div>
      <div className="cli-mnome">{curto(t.titulo)}</div>
      <div className="cli-mmeta">{(t.segredo ? "Segredo de justiça" : t.cliente) || "Sem cliente"}{t.data_limite ? ` · ${ddmm(t.data_limite)}` : ""}</div>
    </Link>
  );
}

/* ── índice (lista compacta) — reusado no drawer e na tela raiz /tarefas ── */
export function TarefaMaster({ lista, activeId }: { lista: TarefaCard[]; activeId?: string }) {
  const [filtro, setFiltro] = useState<"abertas" | "todas">("abertas");
  const abertas = lista.filter((t) => aberta(t.status));
  const visiveis = filtro === "todas" ? lista : abertas;
  return (
    <aside className="audp-master">
      <div className="audp-master-h">
        <h1>Tarefas</h1>
        <div className="audp-filtros">
          <button type="button" className={`audp-chip ink${filtro === "abertas" ? " on" : ""}`} onClick={() => setFiltro("abertas")}>Abertas ({abertas.length})</button>
          <button type="button" className={`audp-chip tang${filtro === "todas" ? " on" : ""}`} onClick={() => setFiltro("todas")}>Todas ({lista.length})</button>
        </div>
      </div>
      <div className="audp-master-list">
        {visiveis.length === 0
          ? <div className="audp-empty">Nada por aqui.</div>
          : visiveis.map((t) => <MasterCard key={t.id} t={t} ativo={t.id === activeId} />)}
      </div>
    </aside>
  );
}

/* ── clientes clicáveis ──────────────────────────────────────────────────── */
function ClientesLink({ t }: { t: TarefaFull }) {
  if (t.segredo) return <b className="audp-cli">Processo em segredo de justiça</b>;
  if (!t.partes.length) return <b className="audp-cli">{t.clientes || "Sem cliente vinculado"}</b>;
  return (
    <span className="audp-cli">
      {t.partes.map((c, i) => (
        <span key={c.id}>{i > 0 && ", "}<Link className="proc-link" href={linkPara("cliente", c.id)}>{c.nome}</Link></span>
      ))}
    </span>
  );
}

/* ── editar tarefa ───────────────────────────────────────────────────────── */
function EditarTarefa({ t }: { t: TarefaFull }) {
  return (
    <FormModal label={<><PenIco /> Editar tarefa</>} titulo="Editar tarefa" descricao="Ajuste título, prioridade, responsável ou a data limite. Só grava o que for preenchido." acao={atualizarTarefa.bind(null, t.id)} enviarLabel="Salvar" variant="default">
      <div><label>Título</label><input name="titulo" required defaultValue={t.titulo} /></div>
      <div><label>Descrição</label><textarea name="descricao" defaultValue={t.descricao ?? ""} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Prioridade</label><select name="prioridade" defaultValue={t.prioridade ?? "media"}>{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={t.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div><label>Data limite</label><input type="date" name="data_limite" defaultValue={t.data_limite?.slice(0, 10) ?? ""} /></div>
    </FormModal>
  );
}

/* ── componente principal ────────────────────────────────────────────────── */
export function TarefaPainel({ t, lista, anotacoes, mapa = null, socio = null }: { t: TarefaFull; lista: TarefaCard[]; anotacoes: Anotacao[]; mapa?: MapaProvidencia | null; socio?: Socio | null }) {
  const [verNotas, setVerNotas] = useState(true);
  const outro = socio ? oUtroSocio(socio) : null;
  const conferencia = Boolean(t.cadastro_automatico) && t.cadastrado_por === "cowork";
  // Sug. 62 — distingue a sentinela de inércia da conferência de escalonamento.
  const sentinela = conferencia && t.motivo_auto === "inercia";

  return (
    <div className="audp">
      {/* MASTER — índice compartilhado (mesma row da tela raiz /tarefas) */}
      <TarefaMaster lista={lista} activeId={t.id} />

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top"><Link className="audp-back" href="/tarefas">← Tarefas</Link></div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* cabeçalho */}
            <div className="audp-tags">
              <span className={`pz-tag ${prioTone(t.prioridade)}`}>{humano(t.prioridade) || "média"}</span>
              <span className={`pz-tag ${statusTone(t.status)}`}>{humano(t.status)}</span>
              {conferencia && !sentinela && <span className="pz-tag cowork"><Spark s={9} />conferência da triagem</span>}
              {sentinela && <span className="pz-tag cowork"><Spark s={9} />sentinela de inércia</span>}
              {t.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
            </div>
            <h2 className="audp-h2">{t.titulo}</h2>
            <div className="audp-cliline">
              <ClientesLink t={t} />
              {(t.numero_cnj || t.numero_registro) && <ProcRef cnj={t.numero_cnj} registro={t.numero_registro} id={t.processo_id} />}
              {t.data_limite && <span className="and-sub mono">limite {ddmm(t.data_limite)}</span>}
            </div>

            {/* PROCESSO — referência clara e clicável (abre o histórico de movimentações) */}
            {t.processo_id ? (
              <Link className="and-procref" href={linkPara("processo", t.processo_id)}>
                <div className="and-procref-l">
                  <span className="and-procref-k">Processo</span>
                  <span className="and-procref-num mono">{t.numero_cnj ?? (t.numero_registro ? `reg ${t.numero_registro}` : "sem CNJ")}</span>
                  {([t.classe ? humano(t.classe) : t.area ? humano(t.area) : null, t.vara_comarca ?? t.tribunal].filter(Boolean).join(" · ")) && (
                    <span className="and-procref-meta">{[t.classe ? humano(t.classe) : t.area ? humano(t.area) : null, t.vara_comarca ?? t.tribunal].filter(Boolean).join(" · ")}</span>
                  )}
                </div>
                <span className="and-procref-cta">ver processo e movimentações →</span>
              </Link>
            ) : (
              <div className="and-procref orfao">
                <div className="and-procref-l"><span className="and-procref-k">Processo</span><span className="and-procref-meta">Tarefa sem processo vinculado{t.partes.length ? " — ligada direto ao cliente." : "."}</span></div>
              </div>
            )}

            {/* ORIGEM · movimentação que escalou */}
            <div className="audp-ia" style={{ marginTop: 18 }}>
              <div className="audp-ia-h"><Spark /><span>Origem · {sentinela ? "sentinela de inércia" : "mapa_andamento_tarefa"}</span></div>
              {sentinela ? (
                <div className="and-semescal">
                  Aberta pela <b>Sentinela de Inércia</b>: o processo ficou em silêncio além do limiar da sua área/instância
                  (sem andamento nem intimação). Não nasce de uma movimentação, e sim da <b>ausência</b> dela.{" "}
                  <Link className="proc-link" href="/inercia">ver no radar de inércia →</Link>
                </div>
              ) : t.origem ? (
                <>
                  <div className="int-teor" style={{ marginTop: 4 }}>
                    <p>“{t.origem.descricao || "Movimentação de origem"}”</p>
                    <div className="int-teor-meta mono">{humano(t.origem.tipo)} · {fmtDate(t.origem.data)}</div>
                  </div>
                  <div className="przp-origem" style={{ marginTop: 10 }}>
                    <span className="pz-tag cat-neutral">{humano(t.origem.tipo)}</span>
                    <div className="mid"><div className="t">{curto(t.origem.descricao || "Movimentação")}</div><div className="s mono">{ddmm(t.origem.data)}</div></div>
                    <Link className="btn sm abrir" href={linkPara("andamento", t.origem.id)}>Abrir</Link>
                  </div>
                </>
              ) : (
                <div className="and-semescal">Tarefa criada manualmente — sem movimentação de origem. {conferencia ? "" : "Não nasceu de escalonamento automático."}</div>
              )}
            </div>

            {/* DESCRIÇÃO */}
            <Sec titulo="Descrição">
              <div className="int-teor"><p className={t.descricao ? "" : "dim"}>{t.descricao || "Sem descrição."}</p></div>
            </Sec>

            {/* DADOS */}
            <Sec titulo="Dados da tarefa">
              <div className="audp-dados">
                <div className="fld"><div className="k">Status</div><div className="v">{humano(t.status)}</div></div>
                <div className="fld"><div className="k">Prioridade</div><div className="v">{humano(t.prioridade) || "—"}</div></div>
                <div className="fld"><div className="k">Responsável</div><div className="v">{t.responsavel ?? "—"}</div></div>
                <div className="fld"><div className="k">Data limite</div><div className="v mono">{fmtDate(t.data_limite)}</div></div>
                <div className="fld"><div className="k">Criada em</div><div className="v mono">{fmtDate(t.criado_em)}</div></div>
                <div className="fld"><div className="k">Cadastrado por</div><div className="v">{t.cadastrado_por ?? "—"}{t.cadastro_automatico ? " (automático)" : ""}</div></div>
              </div>
            </Sec>

            {/* PEÇAS geradas */}
            <Sec titulo="Peças" sub="produção a partir desta tarefa" extra={<span className="audp-count">{t.pecas.length}</span>}>
              {t.pecas.length === 0 ? (
                <div className="przp-empty-row">
                  <span>Nenhuma peça criada a partir desta tarefa.</span>
                  <CriarPecaPendente tipoOrigem="tarefa" origemId={t.id} texto={[t.titulo, t.descricao].filter(Boolean).join(" — ")} baseTitulo={t.titulo} mapa={mapa} />
                </div>
              ) : (
                <div className="przp-stack">{t.pecas.map((pc) => (
                  <Item key={pc.id} tag={humano(pc.tipo)} tagTone="cowork" titulo={curto(pc.titulo)} sub={humano(pc.status)} href={linkPara("peca", pc.id)} />
                ))}</div>
              )}
            </Sec>

            {/* COMPROMISSOS / agenda */}
            <Sec titulo="Agenda" sub="compromissos desta tarefa" extra={<span className="audp-count">{t.compromissos.length}</span>}>
              {t.compromissos.length === 0 ? (
                <div className="przp-empty-row">
                  <span>Nenhum compromisso agendado.</span>
                  <CriarCompromisso tituloPadrao={t.titulo} descricaoPadrao={t.descricao ?? ""} dataPadrao={t.data_limite} responsavelPadrao={t.responsavel} tarefaId={t.id} processoId={t.processo_id} clienteId={t.cliente_id} />
                </div>
              ) : (
                <div className="przp-stack">{t.compromissos.map((c) => (
                  <Item key={c.id} tag="compromisso" tagTone="cat-neutral" titulo={curto(c.titulo)} sub={<span className="mono">{ddmm(c.data_hora)} · {humano(c.status)}</span>} href={linkPara("compromisso", c.id)} />
                ))}</div>
              )}
            </Sec>

            {/* PRAZOS do processo — contexto */}
            {t.prazos.length > 0 && (
              <Sec titulo="Prazos abertos" sub="do processo vinculado" extra={<span className="audp-count">{t.prazos.length}</span>}>
                <div className="przp-stack">{t.prazos.map((pr) => (
                  <Item key={pr.id} tag={pr.validado ? "prazo" : "provisório"} tagTone={pr.validado ? "cat-slate" : "tang"} titulo={curto(pr.ato)} sub={<span className="mono">fatal {ddmm(pr.data_fatal)}</span>} dias={pr.dias} href={linkPara("prazo", pr.id)} />
                ))}</div>
              </Sec>
            )}

            {/* AUDIÊNCIAS do processo — contexto */}
            {t.audiencias.length > 0 && (
              <Sec titulo="Audiências" sub="do processo vinculado" extra={<span className="audp-count">{t.audiencias.length}</span>}>
                <div className="przp-stack">{t.audiencias.map((a) => (
                  <Item key={a.id} tag="audiência" tagTone="cat-blue" titulo={a.nome?.trim() || humano(a.tipo)} sub={<span className="mono">{ddmm(a.data_hora)} · {humano(a.status)}</span>} href={linkPara("audiencia", a.id)} />
                ))}</div>
              </Sec>
            )}

            {/* NOTAS */}
            {verNotas && (
              <Sec titulo="Anotações" extra={<span className="audp-count">{anotacoes.length}</span>}>
                <Anotacoes entidadeTipo="tarefa" entidadeId={t.id} notas={anotacoes} />
              </Sec>
            )}

            {/* EDITAR + ANOTAÇÕES */}
            <div className="audp-sec">
              <div className="audp-toolrow">
                <EditarTarefa t={t} />
                <button type="button" className={`btn default${verNotas ? " on" : ""}`} onClick={() => setVerNotas((v) => !v)}>
                  <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
                </button>
              </div>
            </div>

            {/* MOVER / ATRIBUIÇÃO */}
            <div className="audp-status">
              <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Mover / atribuir</div>
              {t.status !== "em_andamento" && aberta(t.status) && (
                <Acao label="Em andamento" titulo="Mover tarefa" resumo={<>Mover <b>{t.titulo}</b> para <b>em andamento</b>?</>} acao={() => moverTarefa(t.id, "em_andamento")} />
              )}
              {t.status !== "pendente" && aberta(t.status) && (
                <Acao label="Voltar p/ pendente" titulo="Reabrir tarefa" resumo={<>Voltar <b>{t.titulo}</b> para <b>pendente</b>?</>} acao={() => moverTarefa(t.id, "pendente")} />
              )}
              {socio && t.responsavel !== socio && aberta(t.status) && (
                <Acao label="Assumir" titulo="Assumir tarefa" resumo={<>Assumir <b>{t.titulo}</b> como <b>{socio}</b>?{t.status === "pendente" ? <> Será movida para <b>Em andamento</b>.</> : null}</>} acao={() => assumirTarefa(t.id)} />
              )}
              {outro && t.responsavel !== outro && aberta(t.status) && (
                <Acao label={`Reatribuir a ${outro}`} titulo="Reatribuir tarefa" resumo={<>Reatribuir <b>{t.titulo}</b> a <b>{outro}</b>?</>} acao={() => reatribuirTarefa(t.id)} />
              )}
            </div>
            <div className="audp-status-note">Correção é troca de status — nunca DELETE. Cancelar/concluir mantém o registro auditado.</div>
          </div>
        </div>

        {/* action bar */}
        <div className="audp-actionbar">
          {t.status !== "concluida" && (
            <Acao label="✓ Concluir" variant="primary" size="md" titulo="Concluir tarefa" confirmarLabel="Concluir" resumo={<>Marcar <b>{t.titulo}</b> como <b>concluída</b>?</>} acao={() => moverTarefa(t.id, "concluida")} />
          )}
          <CriarPecaPendente tipoOrigem="tarefa" origemId={t.id} texto={[t.titulo, t.descricao].filter(Boolean).join(" — ")} baseTitulo={t.titulo} mapa={mapa} />
          <CriarCompromisso tituloPadrao={t.titulo} descricaoPadrao={t.descricao ?? ""} dataPadrao={t.data_limite} responsavelPadrao={t.responsavel} tarefaId={t.id} processoId={t.processo_id} clienteId={t.cliente_id} />
          {aberta(t.status) && (
            <Acao label="Cancelar" variant="danger" titulo="Cancelar tarefa" confirmarLabel="Cancelar tarefa" resumo={<>Cancelar <b>{t.titulo}</b>? Não é apagada — troca de status (auditado).</>} acao={() => moverTarefa(t.id, "cancelada")} />
          )}
        </div>
      </section>
    </div>
  );
}

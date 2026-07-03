"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ProcRef, SegredoTag } from "@/components/ui";
import { ClienteMaster, mascararCpf, sitTone } from "@/components/detalhe/ClienteMaster";
import { FavoritoStar } from "@/components/FavoritoStar";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { ExecucaoCliente } from "@/components/detalhe/ExecucaoCliente";
import { DocumentosCaso } from "@/components/detalhe/DocumentosCaso";
import {
  IntimacoesTab, MovimentacoesTab, PrazosAudienciasTab, TarefasTab, ProducaoTab,
  CenariosBloco, DespesasBloco, OrigemLeadSelo,
} from "@/components/detalhe/ClienteFicha";
import { atualizarCliente, desativarCliente, criarTarefa, criarEstudo } from "@/app/actions";
import { SITUACAO_PRISIONAL, PRIORIDADES, RESPONSAVEIS, ESTUDO_TIPO } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type {
  ClienteFull, Cliente, Anotacao, ClienteProcMini,
  ExecucaoCliente as TExec, Documento, ClienteFicha,
} from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const NoteIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);
const PlusIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
);
const Scale = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v18M5 8l7-5 7 5M5 8v8l7 5 7-5V8" /></svg>
);
const Spark = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const idadeDe = (iso: string | null): number | null => {
  if (!iso) return null;
  const b = new Date(iso + "T12:00:00Z"), hoje = new Date();
  let a = hoje.getUTCFullYear() - b.getUTCFullYear();
  const m = hoje.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getUTCDate() < b.getUTCDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};
const mesAno = (iso: string | null): string | null =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "") : null;
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const reais = (n: number) => `R$ ${n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n.toFixed(0)}`;

// Linkifica o 1º telefone "discável" (≥8 dígitos, sem máscara) num texto livre.
function Telefonavel({ texto }: { texto: string }) {
  const m = texto.match(/(\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4})/);
  if (!m || m.index === undefined) return <>{texto}</>;
  const tel = m[1].replace(/\D/g, "");
  return (
    <>
      {texto.slice(0, m.index)}
      <a className="proc-link" href={`tel:${tel}`}>{m[1]}</a>
      {texto.slice(m.index + m[1].length)}
    </>
  );
}

const polo = (p: ClienteProcMini) => p.papel ? humano(p.papel) : "parte";
const classeObjeto = (p: ClienteProcMini) =>
  [p.classe ? humano(p.classe) : (p.area ? humano(p.area) : "Processo"), p.area && p.classe ? humano(p.area) : null]
    .filter(Boolean).join(" · ");
const numLabel = (p: ClienteProcMini) => p.numero_cnj ?? (p.numero_registro ? `reg ${p.numero_registro}` : "processo de origem");

/* Aninha os processos vinculados (recurso/derivado) logo abaixo da sua AÇÃO DE
 * ORIGEM, com profundidade — para o recuo + corrente/elo na tela. O vínculo vem
 * de processos.processo_origem (self-FK). Processo cuja origem não está entre os
 * do cliente entra como raiz. Prefixo garante que o pai precede sempre o filho. */
type ProcNo = { proc: ClienteProcMini; depth: number; origem: string | null };
function aninharProcessos(procs: ClienteProcMini[]): ProcNo[] {
  const ids = new Set(procs.map((p) => p.id));
  const filhos = new Map<string, ClienteProcMini[]>();
  const raizes: ClienteProcMini[] = [];
  for (const p of procs) {
    const pai = p.processo_origem && ids.has(p.processo_origem) ? p.processo_origem : null;
    if (pai) { const arr = filhos.get(pai) ?? []; arr.push(p); filhos.set(pai, arr); }
    else raizes.push(p);
  }
  const out: ProcNo[] = [];
  const visto = new Set<string>();
  const walk = (p: ClienteProcMini, depth: number, origem: string | null) => {
    if (visto.has(p.id)) return; // guarda contra ciclo de origem
    visto.add(p.id);
    out.push({ proc: p, depth, origem });
    for (const f of filhos.get(p.id) ?? []) walk(f, depth + 1, numLabel(p));
  };
  for (const r of raizes) walk(r, 0, null);
  for (const p of procs) if (!visto.has(p.id)) out.push({ proc: p, depth: 0, origem: null });
  return out;
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

/* ── editar cliente ──────────────────────────────────────────────────────── */
function EditarCliente({ p }: { p: ClienteFull }) {
  return (
    <FormModal
      label={<><PenIco /> Editar cliente</>}
      titulo="Editar cliente"
      descricao="Altere os dados cadastrais. Nada é apagado — tudo auditado."
      acao={atualizarCliente.bind(null, p.id)}
      enviarLabel="Salvar"
      variant="default"
    >
      <div><label>Nome</label><input name="nome" required defaultValue={p.nome} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>CPF</label><input name="cpf" defaultValue={p.cpf ?? ""} /></div>
        <div><label>RG</label><input name="rg" defaultValue={p.rg ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div><label>Situação prisional</label><select name="situacao_prisional" defaultValue={p.situacao_prisional ?? "solto"}>{SITUACAO_PRISIONAL.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
        <div><label>UF</label><input name="uf" maxLength={2} defaultValue={p.uf ?? ""} /></div>
      </div>
      <div><label>Unidade prisional</label><input name="unidade_prisional" defaultValue={p.unidade_prisional ?? ""} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Telefone</label><input name="telefone" defaultValue={p.telefone ?? ""} /></div>
        <div><label>E-mail</label><input name="email" defaultValue={p.email ?? ""} /></div>
      </div>
      <div><label>Contato da família</label><input name="contato_familia" defaultValue={p.contato_familia ?? ""} /></div>
      <div><label>Observações</label><textarea name="observacoes" defaultValue={p.observacoes ?? ""} /></div>
    </FormModal>
  );
}

/* ── nova tarefa (cabeçalho) ─────────────────────────────────────────────── */
function NovaTarefa({ p }: { p: ClienteFull }) {
  return (
    <FormModal
      label={<><PlusIco /> Nova tarefa</>}
      titulo="Nova tarefa do cliente"
      descricao="Cria uma tarefa já vinculada a este cliente."
      acao={criarTarefa}
      enviarLabel="Criar tarefa"
      variant="default"
    >
      <input type="hidden" name="cliente_id" defaultValue={p.id} />
      <input type="hidden" name="processo_id" defaultValue={p.processos[0]?.id ?? ""} />
      <div><label>Título</label><input name="titulo" required placeholder={`Ex.: Diligência — ${p.nome}`} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Prioridade</label><select name="prioridade" defaultValue="media">{PRIORIDADES.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div><label>Prazo (data limite)</label><input type="date" name="data_limite" /></div>
      <div><label>Descrição</label><textarea name="descricao" placeholder="Detalhes da tarefa." /></div>
    </FormModal>
  );
}

type Tab = "consolidado" | "processos" | "intimacoes" | "movimentacoes" | "prazos" | "tarefas" | "producao" | "execucao" | "estudos" | "financeiro" | "documentos" | "notas";
const TABS: { id: Tab; label: string }[] = [
  { id: "consolidado", label: "Consolidado" },
  { id: "processos", label: "Processos" },
  { id: "intimacoes", label: "Intimações" },
  { id: "movimentacoes", label: "Movimentações" },
  { id: "prazos", label: "Prazos & Audiências" },
  { id: "tarefas", label: "Tarefas" },
  { id: "producao", label: "Produção" },
  { id: "execucao", label: "Execução" },
  { id: "estudos", label: "Estudo de execução" },
  { id: "financeiro", label: "Financeiro" },
  { id: "documentos", label: "Documentos" },
  { id: "notas", label: "Notas" },
];

/* Criar estudo de caso já vinculado ao cliente. */
function CriarEstudo({ p }: { p: ClienteFull }) {
  return (
    <FormModal
      label={<><PlusIco /> Criar estudo de caso</>}
      titulo="Novo estudo de caso"
      descricao="Cria um estudo de execução/estratégia já vinculado a este cliente."
      acao={criarEstudo}
      enviarLabel="Criar estudo"
      variant="default"
    >
      <input type="hidden" name="cliente_id" defaultValue={p.id} />
      <div><label>Título</label><input name="titulo" required placeholder="Ex.: Progressão e livramento na pena unificada" /></div>
      <div><label>Tipo</label><select name="tipo" defaultValue="execucao_global">{ESTUDO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
      <div><label>Diagnóstico · estratégia geral</label><textarea name="conteudo" placeholder="Visão geral da estratégia." /></div>
    </FormModal>
  );
}

/* ── blocos reutilizados ─────────────────────────────────────────────────── */
function ProcessosBloco({ p, tab, setTab }: { p: ClienteFull; tab: Tab; setTab: (t: Tab) => void }) {
  const ordenados = aninharProcessos(p.processos);
  const lista = tab === "processos" ? ordenados : ordenados.slice(0, 2);
  const resto = p.processos.length - lista.length;
  const temVinculo = ordenados.some((n) => n.depth > 0);
  return (
    <Sec titulo="Processos vinculados" extra={<span className="audp-count">{p.processos.length}</span>}>
      {p.processos.length === 0 ? (
        <div className="audp-empty">Sem processos vinculados.</div>
      ) : (
        <div className="przp-stack">
          {lista.map(({ proc: pr, depth, origem }) => {
            const filho = depth > 0;
            const ncl = pr.numero_classe_tribunal; // Sug. 76 — numeração da classe (com sigla)
            return (
              <div className={`przp-origem${filho ? " proc-filho" : ""}`} key={pr.id} style={filho ? { marginLeft: depth * 30 } : undefined}>
                {filho && <span className="proc-elo" aria-hidden />}
                <span className={`pz-tag ${filho ? "cowork" : "cat-slate"}`}>{polo(pr)}</span>
                <div className="mid">
                  <div className="t">{classeObjeto(pr)}{pr.segredo && <> <SegredoTag on /></>}</div>
                  <div className="s mono">
                    {ncl && <><Link className="proc-nclasse" href={linkPara("processo", pr.id)}>{ncl}</Link>{(pr.numero_cnj || pr.numero_registro) ? " · " : ""}</>}
                    {(pr.numero_cnj || pr.numero_registro)
                      ? <ProcRef cnj={pr.numero_cnj} registro={pr.numero_registro} id={pr.id} />
                      : (ncl ? null : "sem CNJ")}
                    {pr.vara_comarca ? ` · ${pr.vara_comarca}` : pr.tribunal ? ` · ${pr.tribunal}` : ""}
                  </div>
                  {filho && origem && <div className="proc-vinc">⛓ vinculado à ação de origem · <span className="mono">{origem}</span></div>}
                </div>
                <Link className="btn sm abrir" href={linkPara("processo", pr.id)}>Abrir</Link>
              </div>
            );
          })}
          {resto > 0 && (
            <button type="button" className="cli-vertodos" onClick={() => setTab("processos")}>
              + {resto} processo{resto === 1 ? "" : "s"} · ver todos na aba Processos
            </button>
          )}
          {temVinculo && (tab === "processos" || lista.some((n) => n.depth > 0)) && (
            <div className="proc-vinc-nota">⛓ Recuo e corrente indicam processo vinculado à ação de origem (ex.: recurso e sua ação penal) — pelo campo <code>processo_origem</code>, não por texto de observação.</div>
          )}
        </div>
      )}
    </Sec>
  );
}

function ExecBloco({ p }: { p: ClienteFull }) {
  const e = p.exec;
  if (!e) return null;
  const prog = e.dias_para_progressao;
  const livr = e.dias_para_livramento;
  const txt = (d: number | null) => d == null ? "—" : d < 0 ? `vencida ${d} d` : `em ${d} d`;
  return (
    <Sec titulo="Execução penal" sub="vw_situacao_executoria_atual">
      <div className="cli-exec">
        <div className="cli-exec-grid">
          <div className="fld"><div className="k">Regime atual</div><div className="v">{humano(e.regime_atual)}</div></div>
          <div className="fld"><div className="k">Pena unificada</div><div className="v mono">{e.pena_total_texto ?? "—"}</div></div>
          <div className="fld"><div className="k">Progressão</div><div className="v mono" style={{ color: prog != null && prog < 0 ? "var(--red)" : "var(--text)", fontWeight: 600 }}>{txt(prog)}</div></div>
          <div className="fld"><div className="k">Livramento</div><div className="v mono">{txt(livr)}</div></div>
        </div>
        <div className="cli-exec-foot">Snapshot mais recente · atestado de {fmtDate(e.data_atestado)} (SEEU). Cada atestado é uma linha datada — nunca sobrescrita.</div>
      </div>
    </Sec>
  );
}

function EstudosBloco({ p }: { p: ClienteFull }) {
  return (
    <Sec titulo="Estudo de execução" extra={<><span className="audp-count">{p.estudos.length}</span><span className="cli-sech-acao"><CriarEstudo p={p} /></span></>}>
      {p.estudos.length === 0 ? (
        <div className="przp-empty-row">
          <span>Nenhum estudo de execução para este cliente.</span>
          <CriarEstudo p={p} />
        </div>
      ) : (
        <div className="przp-stack">
          {p.estudos.map((e) => (
            <div className="przp-origem" key={e.id}>
              <span className="pz-tag cowork"><Spark s={9} />{e.tipo ? humano(e.tipo) : "estudo"}</span>
              <div className="mid">
                <div className="t">{e.titulo}</div>
                <div className="s">{e.status ? humano(e.status) : "—"}</div>
              </div>
              <Link className="btn sm abrir" href={linkPara("estudo", e.id)}>Abrir</Link>
            </div>
          ))}
        </div>
      )}
    </Sec>
  );
}

function FinanceiroBloco({ p }: { p: ClienteFull }) {
  return (
    <Sec titulo="Financeiro" sub="contratos · pagamentos">
      {p.contratos.length === 0 ? (
        <div className="audp-empty">Sem contratos vinculados.</div>
      ) : (
        <div className="przp-stack">
          {p.contratos.map((c) => (
            <div className="przp-origem" key={c.id}>
              <span className={`pz-tag ${c.status === "vigente" ? "val" : c.status === "inadimplente" ? "preso" : "cat-neutral"}`}>{humano(c.status)}</span>
              <div className="mid">
                <div className="t">{c.objeto || "Contrato"}</div>
                <div className="s">{c.contratante ? `contratante: ${c.contratante}` : "—"}{c.valor_total ? ` · total ${reais(c.valor_total)}` : ""}</div>
              </div>
              {c.valor_aberto > 0 && (
                <div className="cli-fin-valor">
                  <div className="v">{reais(c.valor_aberto)} aberto</div>
                  {c.prox_venc && <div className="s">próx. {ddmm(c.prox_venc)}</div>}
                </div>
              )}
              <Link className="btn sm abrir" href={linkPara("contrato", c.id)}>Abrir</Link>
            </div>
          ))}
        </div>
      )}
    </Sec>
  );
}

/* ── componente principal ────────────────────────────────────────────────── */
export function ClientePainel({
  p, lista, anotacoes, exec, documentos, ficha,
}: {
  p: ClienteFull; lista: Cliente[]; anotacoes: Anotacao[]; exec: TExec; documentos: Documento[]; ficha: ClienteFicha;
}) {
  const [tab, setTab] = useState<Tab>("consolidado");
  const [verNotas, setVerNotas] = useState(false);

  const idade = idadeDe(p.data_nascimento);
  const desde = mesAno(p.criado_em);

  const ver = (t: Tab) => tab === "consolidado" || tab === t;
  const abrirNotas = () => { setTab("notas"); setVerNotas(true); };

  // Cadastro obsoleto: foi unificado em outro (ativo=false + ponteiro do canônico).
  const obsoleto = !p.ativo;

  return (
    <div className="audp">
      {/* MASTER — índice compartilhado (mesma row da tela raiz /clientes) */}
      <ClienteMaster lista={lista} activeId={p.id} />

      {/* DETALHE */}
      <section className={`audp-detail${obsoleto ? " audp-obsoleto" : ""}`}>
        <div className="audp-detail-top">
          <Link className="audp-back" href="/clientes">← Clientes</Link>
          <nav className="cli-tabs">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={`cli-tab${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </nav>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner proc-fichas">
            {/* Aviso de cadastro obsoleto (unificado em outro) */}
            {obsoleto && (
              <div className="cli-obsoleto">
                <span className="cli-obsoleto-ico" aria-hidden>⚠</span>
                <div className="cli-obsoleto-txt">
                  <b>Cadastro obsoleto.</b> Este registro foi <b>unificado</b>
                  {p.mescladoEm ? <> em {p.mescladoEm}</> : null} e mantido apenas como histórico — não delete.
                  {" "}Use o cadastro atual.
                </div>
                {p.canonicoId && (
                  <Link className="btn sm abrir cli-obsoleto-btn" href={linkPara("cliente", p.canonicoId)}>
                    {p.canonicoNome ? `Abrir ${p.canonicoNome}` : "Abrir cadastro atual"}
                  </Link>
                )}
              </div>
            )}
            {/* CARD 1 · cabeçalho do perfil + ações de gestão */}
            <div className="proc-card proc-card-head">
            <div className="audp-title-row">
              <div className="audp-title-l">
                <div className="audp-tags">
                  {obsoleto && <span className="pz-tag obsoleto">obsoleto · mesclado</span>}
                  {!obsoleto && p.unificouEm && <span className="pz-tag unificado">⛓ unificado</span>}
                  <span className={`pz-tag ${sitTone(p.situacao_prisional) === "green" ? "val" : sitTone(p.situacao_prisional) === "red" ? "preso" : "tang"}`}>{humano(p.situacao_prisional)}</span>
                  {p.exec && <span className="pz-tag cat-neutral">execução penal ativa</span>}
                </div>
                <div className="cli-nome-line">
                  <FavoritoStar id={p.id} favorito={p.favorito} />
                  <h2 className="audp-h2 nome-cliente">{p.nome}</h2>
                </div>
                <div className="audp-cliline">
                  <span className="mono">CPF {mascararCpf(p.cpf)}</span>
                  {idade != null && <span className="cli-sep">· {idade} anos</span>}
                  {desde && <span className="cli-sep">· cliente desde {desde}</span>}
                  <OrigemLeadSelo origem={ficha.origem} />
                </div>
              </div>
              <div className="proc-head-actions">
                <div className="proc-head-row">
                  <NovaTarefa p={p} />
                  <button type="button" className="btn default" onClick={abrirNotas}><NoteIco /> Nota datada</button>
                </div>
                <div className="proc-head-row proc-head-manage">
                  <EditarCliente p={p} />
                  <button type="button" className={`btn default${verNotas || tab === "notas" ? " on" : ""}`} onClick={abrirNotas}>
                    <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
                  </button>
                  {p.ativo && (
                    <Acao label="Inativar" variant="danger" titulo="Inativar cliente" confirmarLabel="Inativar" resumo={<>O cliente <b>não é apagado</b> — fica inativo (some das listas, mantido no banco e auditado). Confirmar?</>} acao={() => desativarCliente(p.id)} />
                  )}
                </div>
              </div>
            </div>
            <div className="audp-status-note">Editar e inativar não apagam nada — inativar é troca de status, tudo auditado.</div>
            </div>
            {/* /CARD 1 */}

            {/* ABAS DO CICLO intimação → prazo → peça → andamento (recorte do cliente) */}
            {tab === "intimacoes" && <div className="proc-card"><IntimacoesTab itens={ficha.intimacoes} /></div>}
            {tab === "movimentacoes" && <div className="proc-card"><MovimentacoesTab itens={ficha.andamentos} procMeta={ficha.procMeta} /></div>}
            {tab === "prazos" && <div className="proc-card"><PrazosAudienciasTab prazos={p.prazos} audiencias={ficha.audiencias} pendentes={ficha.pendentesValidacao} /></div>}
            {tab === "tarefas" && <div className="proc-card"><TarefasTab itens={ficha.tarefas} setTab={(t) => setTab(t as Tab)} /></div>}
            {tab === "producao" && <div className="proc-card"><ProducaoTab itens={ficha.pecas} /></div>}

            {/* BLOCO 1 · CONSOLIDADO */}
            {ver("consolidado") && (
              <div className="proc-card">
              <Sec titulo="Consolidado" sub="vw_situacao_cliente">
                <div className="cli-kpis">
                  <div className="cli-kpi"><div className="n">{p.processos_ativos}</div><div className="l">processos ativos</div></div>
                  <div className="cli-kpi"><div className={`n${p.prazos_vencidos > 0 ? " red" : ""}`}>{p.prazos_abertos}</div><div className="l">prazos abertos{p.prazos_vencidos > 0 && <> · <span className="red">{p.prazos_vencidos} vencido{p.prazos_vencidos === 1 ? "" : "s"}</span></>}</div></div>
                  <div className="cli-kpi"><div className="n">{p.tarefas_pendentes}</div><div className="l">tarefas pendentes</div></div>
                  <div className="cli-kpi"><div className="n">{p.audiencias_futuras}</div><div className="l">audiência{p.audiencias_futuras === 1 ? "" : "s"} designada{p.audiencias_futuras === 1 ? "" : "s"}</div></div>
                </div>
              </Sec>
              </div>
            )}

            {/* BLOCO 2 · DADOS PESSOAIS */}
            {ver("consolidado") && (
              <div className="proc-card">
              <Sec titulo="Dados pessoais">
                <div className="audp-dados">
                  <div className="fld"><div className="k">CPF</div><div className="v mono">{mascararCpf(p.cpf)}</div></div>
                  <div className="fld"><div className="k">Nascimento</div><div className="v">{p.data_nascimento ? `${fmtDate(p.data_nascimento)}${idade != null ? ` · ${idade} anos` : ""}` : "—"}</div></div>
                  <div className="fld"><div className="k">Situação prisional</div><div className="v" style={{ color: `var(--${sitTone(p.situacao_prisional) === "green" ? "green" : sitTone(p.situacao_prisional) === "red" ? "red" : "amber"})`, fontWeight: 600 }}>{humano(p.situacao_prisional)}</div></div>
                  <div className="fld"><div className="k">Unidade prisional</div><div className="v">{p.unidade_prisional ?? "—"}</div></div>
                  <div className="fld"><div className="k">Contato da família</div><div className="v">{p.contato_familia ? <Telefonavel texto={p.contato_familia} /> : "—"}</div></div>
                  <div className="fld"><div className="k">Responsável</div><div className="v">{p.responsavel ?? "—"}</div></div>
                </div>
                {p.observacoes && (
                  <div className="cli-obs">
                    <div className="k">Observações</div>
                    <p>{p.observacoes}</p>
                  </div>
                )}
              </Sec>
              </div>
            )}

            {/* BLOCO 3 · IDENTIDADE ÚNICA (IA) */}
            {ver("consolidado") && (
              <div className="audp-ia">
                <div className="audp-ia-h"><Spark /><span>Identidade única · resolvida pela IA</span></div>
                <div className="cli-ia-grid">
                  <div className="fld"><div className="k">Nome normalizado</div><div className="v mono" style={{ color: "var(--accent-strong)" }}>{p.nome_normalizado ?? "—"}</div></div>
                  <div className="fld"><div className="k">Chave de dedução</div><div className="v">nome_normalizado + CPF</div></div>
                </div>
                <div className="audp-ia-note">
                  Casado por <span className="mono">nome_normalizado</span> (sem acento · maiúsculas · espaços colapsados) + CPF — <b>sem duplicata</b>.
                  O índice é não-único de propósito: homônimos legítimos são permitidos só após triagem humana. <b>Nome sempre visível</b>,
                  inclusive em processos sob segredo de justiça — é sistema interno.
                </div>
                {p.unificouEm && (
                  <div className="cli-unif-box">
                    <span className="cli-unif-ico" aria-hidden>⛓</span>
                    <div>
                      <div className="cli-unif-t">Cadastro unificado · este é o registro atual (canônico)</div>
                      <div className="cli-unif-s">
                        Absorveu {p.unificadosNomes.length || "outro(s)"} cadastro{p.unificadosNomes.length === 1 ? "" : "s"} duplicado{p.unificadosNomes.length === 1 ? "" : "s"} em {fmtDate(p.unificouEm)}
                        {p.unificadosNomes.length > 0 && <> · {p.unificadosNomes.join(", ")}</>}. Os vínculos foram reassociados aqui; o duplicado ficou inativo (nunca apagado).
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BLOCO 4 · EXECUÇÃO PENAL (resumo) */}
            {ver("consolidado") && p.exec && <div className="proc-card"><ExecBloco p={p} /></div>}

            {/* BLOCO 5 · PROCESSOS VINCULADOS */}
            {(tab === "consolidado" || tab === "processos") && <div className="proc-card"><ProcessosBloco p={p} tab={tab} setTab={setTab} /></div>}

            {/* BLOCO 6 · PRAZOS ABERTOS */}
            {ver("consolidado") && p.prazos.length > 0 && (
              <div className="proc-card">
              <Sec titulo="Prazos abertos" extra={<span className="audp-count">{p.prazos.length}</span>}>
                <div className="przp-stack">
                  {p.prazos.map((pr) => (
                    <div className={`cli-prazo${pr.dias < 0 ? " venc" : pr.dias <= 2 ? " crit" : ""}`} key={pr.id}>
                      <div className="mid">
                        <div className="t">{pr.ato.split(/\s*[—–[]/)[0].trim()}</div>
                        <div className="s">{pr.validado ? "validado" : "interna provisória"}{pr.data_interna ? ` · interna ${ddmm(pr.data_interna)}` : ""}</div>
                      </div>
                      <div className={`cli-prazo-dias ${pr.dias < 0 ? "red" : pr.dias <= 2 ? "red" : "amber"}`}>
                        <div className="d">{pr.dias < 0 ? `−${Math.abs(pr.dias)} d` : `${pr.dias} d`}</div>
                        <div className="f">fatal {ddmm(pr.data_fatal)}</div>
                      </div>
                      <Link className="btn sm abrir" href={linkPara("prazo", pr.id)}>Abrir</Link>
                    </div>
                  ))}
                </div>
              </Sec>
              </div>
            )}

            {/* BLOCO 7 · FINANCEIRO */}
            {(tab === "consolidado" || tab === "financeiro") && <div className="proc-card"><FinanceiroBloco p={p} /></div>}
            {tab === "financeiro" && <div className="proc-card"><DespesasBloco itens={ficha.despesas} /></div>}

            {/* BLOCO 8 · ESTUDO DE EXECUÇÃO */}
            {(tab === "consolidado" || tab === "execucao" || tab === "estudos") && <div className="proc-card"><EstudosBloco p={p} /></div>}

            {/* EXECUÇÃO — visão completa (aba) */}
            {tab === "execucao" && (
              <div className="proc-card cli-exec-full">
                <ExecucaoCliente exec={exec} clienteId={p.id} situacaoAtual={p.situacao_prisional} />
              </div>
            )}

            {/* REFLEXOS NA EXECUÇÃO (cenários) — dentro de Execução / Estudo */}
            {(tab === "execucao" || tab === "estudos") && <div className="proc-card"><CenariosBloco itens={ficha.cenarios} /></div>}

            {/* DOCUMENTOS (aba) */}
            {tab === "documentos" && (
              <div className="proc-card">
                <DocumentosCaso documentos={documentos} vinculo={{ campo: "cliente_id", id: p.id }} />
              </div>
            )}

            {/* BLOCO 9 · AUDIÊNCIAS FUTURAS */}
            {ver("consolidado") && (
              <div className="proc-card">
              <Sec titulo="Audiências futuras" extra={<span className="audp-count">{p.audiencias.length}</span>}>
                {p.audiencias.length === 0 ? (
                  <div className="przp-empty-row">
                    <span>Sem audiências futuras designadas.</span>
                    <Link className="btn sm" href="/audiencias">Nova audiência</Link>
                  </div>
                ) : (
                  <div className="przp-stack">
                    {p.audiencias.map((a) => (
                      <div className="przp-origem" key={a.id}>
                        <span className="pz-tag cat-blue">{humano(a.tipo)}</span>
                        <div className="mid">
                          <div className="t">{a.nome?.trim() || humano(a.tipo)}</div>
                          <div className="s">{humano(a.modalidade)}</div>
                        </div>
                        <div className="cli-aud-when mono">{ddmm(a.data_hora)}</div>
                        <Link className="btn sm abrir" href={linkPara("audiencia", a.id)}>Abrir</Link>
                      </div>
                    ))}
                  </div>
                )}
              </Sec>
              </div>
            )}

            {/* NOTAS (aba dedicada ou bloco no consolidado via botão) */}
            {(tab === "notas" || (verNotas && tab === "consolidado")) && (
              <div className="proc-card">
              <Sec titulo="Anotações" extra={<span className="audp-count">{anotacoes.length}</span>}>
                <Anotacoes entidadeTipo="cliente" entidadeId={p.id} notas={anotacoes} />
              </Sec>
              </div>
            )}
          </div>
        </div>

        {/* action bar */}
        <div className="audp-actionbar">
          <button type="button" className="btn primary" onClick={() => setTab("execucao")}><Scale /> Abrir execução penal</button>
          <button type="button" className="btn default" onClick={() => setTab("execucao")}>Lançar atestado de pena</button>
          <button type="button" className="btn default" onClick={() => setTab("financeiro")}>Contratos</button>
          <button type="button" className="btn default" onClick={abrirNotas}><NoteIco /> Nota datada</button>
        </div>
      </section>
    </div>
  );
}

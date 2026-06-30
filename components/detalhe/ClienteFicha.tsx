"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ProcRef, SegredoTag } from "@/components/ui";
import { fmtDate, fmtBRL, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type {
  ClienteFicha, FichaIntimacao, FichaAndamento, FichaAudiencia, FichaPendente,
  FichaTarefa, FichaPeca, FichaCenario, FichaDespesa, FichaOrigem, ClientePrazoMini,
} from "@/lib/data";

/* ── helpers comuns ──────────────────────────────────────────────────────── */
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const diasTone = (d: number | null) => (d == null ? "tang" : d < 0 || d <= 2 ? "red" : d <= 5 ? "amber" : "tang");
const AVISO_DIAS = "Contagem em dias corridos (CPP art. 798) — a fatal é estimativa sujeita a feriados locais e à validação de Daniel.";

function Sec({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="audp-sec">
      <div className="audp-sech">{titulo}{sub && <span className="cli-sech-sub">{sub}</span>}{extra}</div>
      {children}
    </div>
  );
}
/** nº de processo por extenso (CNJ 20 dígitos, ou registro íntegro), clicável + selo de sigilo. */
function Proc({ cnj, registro, id, segredo }: { cnj: string | null; registro: string | null; id: string | null; segredo: boolean }) {
  return (
    <span className="cli-fi-proc">
      {(cnj || registro) ? <ProcRef cnj={cnj} registro={registro} id={id} /> : <span className="sub">sem CNJ</span>}
      {segredo && <> <SegredoTag on /></>}
    </span>
  );
}

/* ════════════════ ABA 1 · INTIMAÇÕES ════════════════════════════════════ */
const intimTone = (s: string) =>
  s === "pendente" ? "tang" : s === "providencia_tomada" ? "val" : s === "em_analise" ? "tone-blue" : s === "sem_providencia" ? "cat-neutral" : "cat-slate";

function IntimacaoCard({ i }: { i: FichaIntimacao }) {
  const [aberto, setAberto] = useState(false);
  const naoLida = i.revisado_em == null;
  return (
    <div className={`cli-fi-card${i.na_caixa ? " na-caixa" : ""}`}>
      <div className="cli-fi-top">
        {naoLida && <span className="dot-nova" aria-hidden title="Não revisada" />}
        <span className="cli-fi-data mono">{fmtDate(i.criado_em)}</span>
        <span className={`pz-tag ${intimTone(i.status)}`}>{humano(i.status)}</span>
        {i.na_caixa && <span className="pz-tag tang">na caixa</span>}
        {naoLida ? <span className="cli-fi-flag">não revisada</span> : <span className="cli-fi-flag lida">revisada{i.revisado_por ? ` · ${i.revisado_por}` : ""}</span>}
        {i.tem_prazo && <span className="pz-tag cat-slate">prazo ✓</span>}
        {i.tem_peca && <span className="pz-tag cowork">peça ✓</span>}
        {i.tem_providencia && <span className="pz-tag val">providência ✓</span>}
      </div>
      <div className="cli-fi-nome">{[i.classe, i.area ? humano(i.area) : null].filter(Boolean).join(" · ") || "Intimação"}</div>
      <div className="cli-fi-meta">{[i.tribunal, i.orgao].filter(Boolean).join(" · ") || "—"}</div>
      <div className="cli-fi-foot">
        <Proc cnj={i.numero_cnj} registro={i.numero_registro} id={i.processo_id} segredo={i.segredo} />
        <div className="cli-fi-acoes">
          <button type="button" className="btn sm" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar teor" : "Ver teor"}</button>
          <Link className="btn sm abrir" href={linkPara("intimacao", i.id)}>Abrir</Link>
        </div>
      </div>
      {aberto && (
        <div className="int-teor" style={{ marginTop: 10 }}>
          {i.segredo
            ? <p className="dim">🔒 Processo em segredo de justiça — teor não exibido.</p>
            : (i.teor?.trim() || i.resumo?.trim())
              ? <p>“{i.teor?.trim() || i.resumo?.trim()}”</p>
              : <p className="dim">Sem teor capturado.</p>}
        </div>
      )}
    </div>
  );
}

export function IntimacoesTab({ itens }: { itens: FichaIntimacao[] }) {
  const [filtro, setFiltro] = useState<"para_revisar" | "todas">("para_revisar");
  const paraRevisar = itens.filter((i) => i.revisado_em == null);
  const visiveis = filtro === "para_revisar" ? paraRevisar : itens;
  return (
    <Sec titulo="Intimações" sub="vw_intimacoes_contexto · fluxo × leitura" extra={<span className="audp-count">{itens.length}</span>}>
      <div className="audp-filtros" style={{ marginBottom: 12 }}>
        <button type="button" className={`audp-chip ink${filtro === "para_revisar" ? " on" : ""}`} onClick={() => setFiltro("para_revisar")}>Para revisar ({paraRevisar.length})</button>
        <button type="button" className={`audp-chip tang${filtro === "todas" ? " on" : ""}`} onClick={() => setFiltro("todas")}>Todas ({itens.length})</button>
      </div>
      {visiveis.length === 0
        ? <div className="audp-empty">{filtro === "para_revisar" ? "Nada para revisar." : "Sem intimações para este cliente."}</div>
        : <div className="cli-fi-stack">{visiveis.map((i) => <IntimacaoCard key={i.id} i={i} />)}</div>}
    </Sec>
  );
}

/* ════════════════ ABA 2 · MOVIMENTAÇÕES (linha do tempo) ════════════════ */
const andTone = (t: string) =>
  t.includes("sentenca") || t.includes("decisao") || t.includes("despacho") ? "tone-red"
    : t.includes("acordao") ? "val"
      : t.includes("peticao") || t.includes("protocol") || t.includes("recurso") || t.includes("hc") ? "tone-blue" : "cat-slate";

export function MovimentacoesTab({ itens, procMeta }: { itens: FichaAndamento[]; procMeta: ClienteFicha["procMeta"] }) {
  const [proc, setProc] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const tipos = useMemo(() => [...new Set(itens.map((a) => a.tipo))].sort(), [itens]);
  const visiveis = itens.filter((a) => (proc === "todos" || a.processo_id === proc) && (tipo === "todos" || a.tipo === tipo));
  return (
    <Sec titulo="Movimentações" sub="andamentos · histórico completo do caso" extra={<span className="audp-count">{itens.length}</span>}>
      {itens.length === 0 ? (
        <div className="audp-empty">Sem movimentações para este cliente.</div>
      ) : (
        <>
          <div className="cli-fi-filtros">
            {procMeta.length > 1 && (
              <select value={proc} onChange={(e) => setProc(e.target.value)}>
                <option value="todos">Todos os processos</option>
                {procMeta.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            )}
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="todos">Todos os tipos</option>
              {tipos.map((t) => <option key={t} value={t}>{humano(t)}</option>)}
            </select>
            <span className="cli-fi-count mono">{visiveis.length} no filtro</span>
          </div>
          <div className="cli-tl">
            {visiveis.map((a) => {
              const m = procMeta.find((x) => x.id === a.processo_id);
              return (
                <div className="cli-tl-item" key={a.id}>
                  <div className="cli-tl-dot" aria-hidden />
                  <div className="cli-tl-body">
                    <div className="cli-tl-h">
                      <span className="cli-fi-data mono">{fmtDate(a.data)}</span>
                      <span className={`pz-tag ${andTone(a.tipo)}`}>{humano(a.tipo)}</span>
                      {a.origem && <span className="cli-tl-origem mono">{a.origem.toLowerCase()}</span>}
                      {a.segredo && <SegredoTag on />}
                    </div>
                    {a.descricao && <p className="cli-tl-desc">{a.descricao}</p>}
                    <div className="cli-tl-foot">
                      {(a.numero_cnj || a.numero_registro) && <ProcRef cnj={a.numero_cnj} registro={a.numero_registro} id={a.processo_id} />}
                      {m && procMeta.length > 1 && <span className="sub"> · {m.label}</span>}
                      <Link className="btn sm abrir" href={linkPara("andamento", a.id)}>Abrir</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Sec>
  );
}

/* ════════════════ ABA 3 · PRAZOS & AUDIÊNCIAS ═══════════════════════════ */
export function PrazosAudienciasTab({ prazos, audiencias, pendentes }: { prazos: ClientePrazoMini[]; audiencias: FichaAudiencia[]; pendentes: FichaPendente[] }) {
  return (
    <>
      {pendentes.length > 0 && (
        <Sec titulo="Aguardando validação de Daniel" sub="vw_pendentes_validacao" extra={<span className="audp-count">{pendentes.length}</span>}>
          <div className="przp-stack">
            {pendentes.map((p) => (
              <div className="przp-origem cli-fi-pend" key={`${p.tipo}-${p.id}`}>
                <span className="pz-tag tang">{humano(p.tipo)} · provisório</span>
                <div className="mid"><div className="t">{p.descricao || humano(p.tipo)}</div><div className="s mono">{p.numero_cnj || "—"} · {fmtDate(p.data_relevante)}</div></div>
              </div>
            ))}
          </div>
        </Sec>
      )}

      <Sec titulo="Prazos abertos" extra={<span className="audp-count">{prazos.length}</span>}>
        {prazos.length === 0 ? (
          <div className="audp-empty">Sem prazos abertos para este cliente.</div>
        ) : (
          <>
            <div className="przp-stack">
              {[...prazos].sort((a, b) => (a.data_fatal ?? "").localeCompare(b.data_fatal ?? "")).map((pr) => (
                <div className="przp-origem" key={pr.id}>
                  <span className={`pz-tag ${pr.validado ? "val" : "tang"}`}>{pr.validado ? "validado" : "provisório · conferir"}</span>
                  <div className="mid">
                    <div className="t">{pr.ato.split(/\s*[—–[]/)[0].trim()}</div>
                    <div className="s mono">fatal {pr.validado ? "" : "(provisória) "}{ddmm(pr.data_fatal)}{pr.data_interna ? ` · interna ${ddmm(pr.data_interna)}` : ""}</div>
                  </div>
                  <span className={`proc-dias ${diasTone(pr.dias)}`}>{pr.dias < 0 ? `−${Math.abs(pr.dias)}d` : `${pr.dias}d`}</span>
                  <Link className="btn sm abrir" href={linkPara("prazo", pr.id)}>Abrir</Link>
                </div>
              ))}
            </div>
            <div className="cli-fi-aviso">{AVISO_DIAS}</div>
          </>
        )}
      </Sec>

      <Sec titulo="Audiências" extra={<span className="audp-count">{audiencias.length}</span>}>
        {audiencias.length === 0 ? (
          <div className="audp-empty">Sem audiências designadas para este cliente.</div>
        ) : (
          <div className="przp-stack">
            {audiencias.map((a) => {
              const virtual = a.modalidade === "virtual";
              const quando = virtual && a.data_fim
                ? `Sessão virtual (janela ${ddmm(a.data_hora)} a ${ddmm(a.data_fim)})`
                : `${fmtDate(a.data_hora)}`;
              return (
                <div className="przp-origem" key={a.id}>
                  <span className={`pz-tag ${a.validado ? "cat-blue" : "tang"}`}>{a.validado ? humano(a.status) : "provisória"}</span>
                  <div className="mid">
                    <div className="t">{a.nome?.trim() || humano(a.tipo)}{a.segredo && <> <SegredoTag on /></>}</div>
                    <div className="s mono">{quando}{a.modalidade ? ` · ${humano(a.modalidade)}` : ""}</div>
                  </div>
                  {a.local_link && <a className="btn sm" href={a.local_link} target="_blank" rel="noreferrer">Link</a>}
                  <Link className="btn sm abrir" href={linkPara("audiencia", a.id)}>Abrir</Link>
                </div>
              );
            })}
          </div>
        )}
      </Sec>
    </>
  );
}

/* ════════════════ ABA 4 · TAREFAS ═══════════════════════════════════════ */
const PRIO_ORD: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
const prioTag = (p: string | null) => p === "urgente" ? "preso" : p === "alta" ? "tone-amber" : "cat-neutral";

export function TarefasTab({ itens, setTab }: { itens: FichaTarefa[]; setTab: (t: string) => void }) {
  const [verConcluidas, setVerConcluidas] = useState(false);
  const abertas = itens.filter((t) => t.status !== "concluida" && t.status !== "cancelada");
  const base = verConcluidas ? itens : abertas;
  const ordenadas = [...base].sort((a, b) => {
    const pa = PRIO_ORD[a.prioridade ?? "media"] ?? 2, pb = PRIO_ORD[b.prioridade ?? "media"] ?? 2;
    if (pa !== pb) return pa - pb;
    return (a.data_limite ?? "9999").localeCompare(b.data_limite ?? "9999");
  });
  return (
    <Sec titulo="Tarefas" extra={<><span className="audp-count">{abertas.length}</span><label className="cli-fi-toggle"><input type="checkbox" checked={verConcluidas} onChange={(e) => setVerConcluidas(e.target.checked)} /> mostrar concluídas</label></>}>
      {ordenadas.length === 0 ? (
        <div className="audp-empty">Nenhuma tarefa {verConcluidas ? "" : "aberta "}para este cliente.</div>
      ) : (
        <div className="przp-stack">
          {ordenadas.map((t) => {
            const conf = t.cadastro_automatico && t.cadastrado_por === "cowork";
            const fim = t.status === "concluida" || t.status === "cancelada";
            return (
              <div className="przp-origem" key={t.id}>
                <span className={`pz-tag ${fim ? "cat-neutral" : prioTag(t.prioridade)}`}>{fim ? humano(t.status) : (humano(t.prioridade) || "média")}</span>
                <div className="mid">
                  <div className="t">{t.titulo}{conf && <> <span className="pz-tag cowork">conferência</span></>}</div>
                  <div className="s">
                    {[t.responsavel ?? "—", t.data_limite ? `limite ${ddmm(t.data_limite)}` : null, t.concluida_em ? `concluída ${ddmm(t.concluida_em)}` : null].filter(Boolean).join(" · ")}
                    {conf && t.andamento_id && <> · <button type="button" className="cli-fi-link" onClick={() => setTab("movimentacoes")}>nasceu de uma movimentação →</button></>}
                  </div>
                </div>
                <Link className="btn sm abrir" href={linkPara("tarefa", t.id)}>Abrir</Link>
              </div>
            );
          })}
        </div>
      )}
    </Sec>
  );
}

/* ════════════════ ABA 5 · PRODUÇÃO / PEÇAS ══════════════════════════════ */
const STATUS_ORD: Record<string, number> = { a_fazer: 0, em_elaboracao: 1, em_revisao: 2, aguardando_insumo: 3, pronta: 4, protocolada: 5 };

export function ProducaoTab({ itens }: { itens: FichaPeca[] }) {
  const ordenadas = [...itens].sort((a, b) => {
    const sa = STATUS_ORD[a.status] ?? 9, sb = STATUS_ORD[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return (a.dias_restantes ?? 9999) - (b.dias_restantes ?? 9999);
  });
  return (
    <Sec titulo="Produção · peças" sub="vw_pecas_pendentes" extra={<span className="audp-count">{itens.length}</span>}>
      {ordenadas.length === 0 ? (
        <div className="audp-empty">Sem peças na fila de produção.</div>
      ) : (
        <div className="przp-stack">
          {ordenadas.map((pc) => {
            const triagem = pc.cadastro_automatico && !pc.validado;
            return (
              <div className="przp-origem" key={pc.id}>
                <span className={`pz-tag ${pc.status === "em_revisao" ? "cowork" : pc.status === "aguardando_insumo" ? "tang" : "cat-neutral"}`}>{humano(pc.status)}</span>
                <div className="mid">
                  <div className="t">
                    {[humano(pc.tipo), pc.subtipo ? humano(pc.subtipo) : null].filter(Boolean).join(" · ")}
                    {triagem && <> <span className="pz-tag tang">triagem · provisória</span></>}
                    {pc.status === "em_revisao" && <> <span className="pz-tag cowork">minuta p/ revisão</span></>}
                  </div>
                  <div className="s mono">
                    <Proc cnj={pc.numero_cnj} registro={pc.numero_registro} id={pc.processo_id} segredo={pc.segredo} />
                    {pc.data_fatal ? ` · fatal ${pc.prazo_validado ? "" : "(prov.) "}${ddmm(pc.data_fatal)}` : ""}
                    {pc.status === "aguardando_insumo" && pc.descricao ? ` · ${pc.descricao}` : ""}
                  </div>
                </div>
                {pc.dias_restantes != null && <span className={`proc-dias ${diasTone(pc.dias_restantes)}`}>{pc.dias_restantes < 0 ? `−${Math.abs(pc.dias_restantes)}d` : `${pc.dias_restantes}d`}</span>}
                {pc.drive_file_id && <a className="btn sm" href={`https://drive.google.com/file/d/${pc.drive_file_id}/view`} target="_blank" rel="noreferrer">Minuta</a>}
                <Link className="btn sm abrir" href={linkPara("peca", pc.id)}>Abrir</Link>
              </div>
            );
          })}
        </div>
      )}
    </Sec>
  );
}

/* ════════════════ PAINEL 6 · CENÁRIOS (dentro de Execução) ══════════════ */
const anos = (d: number | null) => d == null ? "—" : `${(d / 365).toFixed(1)} anos`;

export function CenariosBloco({ itens }: { itens: FichaCenario[] }) {
  return (
    <Sec titulo="Reflexos na execução" sub="execucao_cenarios · baseline × projetado" extra={<span className="audp-count">{itens.length}</span>}>
      {itens.length === 0 ? (
        <div className="audp-empty">Sem cenários de reflexo projetados.</div>
      ) : (
        <div className="przp-stack">
          {itens.map((c) => (
            <div className="cli-cen" key={c.id}>
              <div className="cli-cen-h">
                <span className={`pz-tag ${c.status === "confirmado" || c.status === "superado" ? "val" : c.status === "frustrado" ? "preso" : "cowork"}`}>{c.status ? humano(c.status) : "projetado"}</span>
                <b className="cli-cen-t">{c.titulo || "Cenário"}</b>
                {c.peca_id && <Link className="btn sm abrir" href={linkPara("peca", c.peca_id)}>Peça-gatilho</Link>}
              </div>
              <div className="cli-cen-grid">
                <div className="cli-cen-col"><div className="k">Progressão</div><div className="b">base {fmtDate(c.data_progressao_baseline)}</div><div className="p">→ proj. {fmtDate(c.data_progressao_projetada)}</div></div>
                <div className="cli-cen-col"><div className="k">Livramento</div><div className="b">base {fmtDate(c.data_livramento_baseline)}</div><div className="p">→ proj. {fmtDate(c.data_livramento_projetada)}</div></div>
                <div className="cli-cen-col"><div className="k">Pena total</div><div className="b">base {anos(c.pena_total_baseline_dias)}</div><div className="p">→ proj. {anos(c.pena_total_projetada_dias)}</div></div>
              </div>
              {c.observacoes && <div className="cli-cen-obs">{c.observacoes}</div>}
              <div className="cli-fi-aviso">APROXIMAÇÃO — confirmar no SEEU.{c.metodo ? ` Método: ${humano(c.metodo)}.` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </Sec>
  );
}

/* ════════════════ DESPESAS (dentro de Financeiro) ═══════════════════════ */
export function DespesasBloco({ itens }: { itens: FichaDespesa[] }) {
  const aberto = itens.filter((d) => d.reembolsavel && !d.reembolsada).reduce((s, d) => s + d.valor, 0);
  return (
    <Sec titulo="Despesas do caso" sub="despesas" extra={aberto > 0 ? <span className="cli-fi-tot">{fmtBRL(aberto)} reembolsável em aberto</span> : <span className="audp-count">{itens.length}</span>}>
      {itens.length === 0 ? (
        <div className="audp-empty">Sem despesas lançadas.</div>
      ) : (
        <div className="przp-stack">
          {itens.map((d) => (
            <div className="przp-origem" key={d.id}>
              <span className="pz-tag cat-slate">{d.categoria ? humano(d.categoria) : "despesa"}</span>
              <div className="mid"><div className="t">{d.descricao || "Despesa"}</div><div className="s">{fmtDate(d.data)}{d.reembolsavel ? (d.reembolsada ? " · reembolsada" : " · reembolsável (em aberto)") : ""}</div></div>
              <div className="cli-fin-valor"><div className="v">{fmtBRL(d.valor)}</div></div>
            </div>
          ))}
        </div>
      )}
    </Sec>
  );
}

/* ════════════════ SELO DE ORIGEM (cabeçalho) ════════════════════════════ */
export function OrigemLeadSelo({ origem }: { origem: FichaOrigem | null }) {
  if (!origem) return null;
  const partes = [
    origem.origem_lead ? `Origem: ${humano(origem.origem_lead)}` : "Origem: lead",
    origem.valor_proposto != null ? `proposta ${fmtBRL(origem.valor_proposto)}` : null,
    origem.data_decisao ? fmtDate(origem.data_decisao) : null,
  ].filter(Boolean);
  return <span className="cli-fi-origem" title={origem.titulo ?? undefined}>{partes.join(" · ")}</span>;
}

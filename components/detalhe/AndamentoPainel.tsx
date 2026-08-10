"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { FormModal } from "@/components/FormModal";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
import { CriarPrazoDeAndamento } from "@/components/modules/CriarPrazoDeAndamento";
import { PromoverIntimacao } from "@/components/modules/PromoverIntimacao";
import { conferenciaAberta } from "@/components/modules/AndamentosTimeline";
import { ApuracaoBloco, EstadoApuracao, TextoCapturado, TrilhaConsulta } from "@/components/Apuracao";
import { RegistrarApuracao } from "@/components/modules/RegistrarApuracao";
import { atualizarAndamento } from "@/app/actions";
import { ANDAMENTO_TIPO, ANDAMENTO_ORIGEM } from "@/lib/enums";
import { type MapaProvidencia } from "@/lib/pecas";
import { fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { Movimentacao, AndamentoFull, Anotacao } from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Spark = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>
);
const Info = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>
);
const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const NoteIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);
const CheckSq = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
// Headline curta = primeira oração do texto longo (evita H1 gigante).
function headline(desc: string): string {
  const cut = (desc ?? "").split(/ — | · |\. |; |\n/)[0].trim();
  return cut.length > 80 ? cut.slice(0, 80).trim() + "…" : cut || "Movimentação";
}
function tipoTone(t: string): string {
  if (t.includes("sentenca") || t.includes("decisao") || t.includes("despacho")) return "red";
  if (t.includes("acordao")) return "green";
  if (t.includes("peticao") || t.includes("protocol") || t.includes("recurso") || t.includes("hc")) return "blue";
  return "slate";
}
const ehIA = (c: string | null | undefined) => !c || /cowork|chat|robo|auto|push|seeu|tribunal/i.test(c);
// ID interno curto do código de movimentação (ex.: "seeu:mov-4471" → "#4471").
const idCurto = (cod: string | null) => { const m = (cod ?? "").match(/(\d{2,})\s*$/); return m ? `#${m[1]}` : null; };
const gatilho = (p: string | null) => p === "urgente" ? "afeta a liberdade" : p === "alta" ? "resultado de mérito" : "conferência humana";
const prioTone = (p: string | null) => p === "urgente" ? "preso" : p === "alta" ? "tone-amber" : "cat-neutral";

/* ── seção rotulada ──────────────────────────────────────────────────────── */
function Sec({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="audp-sec">
      <div className="audp-sech">{titulo}{sub && <span className="cli-sech-sub">{sub}</span>}{extra}</div>
      {children}
    </div>
  );
}

/** Filtros do trilho: 7 dias · a conferir (aberta) · escalados (histórico). */
export type FiltroMaster = "recentes" | "conferir" | "escalados";

/* ── master: card de andamento ───────────────────────────────────────────── */
function MasterCard({ m, ativo, filtro }: { m: Movimentacao; ativo: boolean; filtro: string }) {
  const orfao = !m.processo_id;
  const href = `${linkPara("andamento", m.id)}${filtro === "recentes" ? "" : `?f=${filtro}`}`;
  // No índice também vale a regra: quando há apuração, é ela que nomeia o item.
  const tipoChip = m.apuracao?.tipo_efetivo ?? m.tipo;
  return (
    <Link className={`audp-mcard cli-mcard${ativo ? " on" : ""}`} href={href}>
      <div className="int-mtags">
        <span className={`pz-tag cat-${tipoTone(tipoChip) === "red" ? "neutral" : tipoTone(tipoChip)}`}>{humano(tipoChip)}</span>
        <EstadoApuracao status={m.apuracao?.status} />
        {/* "escalou" dizia o mesmo para a conferência viva e a já fechada. */}
        {conferenciaAberta(m)
          ? <span className="pz-tag tang">a conferir</span>
          : m.escalado && <span className="pz-tag cowork">conferido</span>}
        {orfao && <span className="pz-tag orfa">órfão</span>}
      </div>
      <div className="cli-mnome">{headline(m.apuracao?.texto || m.descricao)}</div>
      <div className="cli-mmeta">{orfao ? "sem processo" : (m.clientes || "—")} · {ddmm(m.data)}</div>
    </Link>
  );
}

/* ── índice (lista compacta) — reusado no drawer e na tela raiz /andamentos ── */
export function AndamentoMaster({ lista, activeId, filtroInicial = "recentes" }: { lista: Movimentacao[]; activeId?: string; filtroInicial?: FiltroMaster }) {
  const [filtro, setFiltro] = useState<FiltroMaster>(filtroInicial);
  const aConferir = lista.filter(conferenciaAberta);
  const escalados = lista.filter((m) => m.escalado);
  const visiveis = filtro === "conferir" ? aConferir : filtro === "escalados" ? escalados : lista;
  return (
    <aside className="audp-master">
      <div className="audp-master-h">
        <h1>Andamentos</h1>
        <div className="audp-filtros">
          <button type="button" className={`audp-chip ink${filtro === "recentes" ? " on" : ""}`} onClick={() => setFiltro("recentes")}>7 dias</button>
          <button type="button" className={`audp-chip tang${filtro === "conferir" ? " on" : ""}`} onClick={() => setFiltro("conferir")}>a conferir ({aConferir.length})</button>
          <button type="button" className={`audp-chip ink${filtro === "escalados" ? " on" : ""}`} onClick={() => setFiltro("escalados")}>escalados ({escalados.length})</button>
        </div>
      </div>
      <div className="audp-master-list">
        {visiveis.length === 0
          ? <div className="audp-empty">Nada por aqui.</div>
          : visiveis.map((m) => <MasterCard key={m.id} m={m} ativo={m.id === activeId} filtro={filtro} />)}
      </div>
    </aside>
  );
}

/* ── editar andamento ────────────────────────────────────────────────────── */
function EditarAndamento({ a }: { a: AndamentoFull }) {
  return (
    <FormModal label={<><PenIco /> Editar andamento</>} titulo="Editar andamento" descricao="Reclassifique o ato, ajuste o código de movimentação ou a data. Só grava o que for preenchido." acao={atualizarAndamento.bind(null, a.id)} enviarLabel="Salvar" variant="default">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Tipo</label><select name="tipo" defaultValue={a.tipo}>{ANDAMENTO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Data</label><input type="date" name="data" defaultValue={a.data?.slice(0, 10)} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Autor / juízo</label><input name="autor" defaultValue={a.autor ?? ""} placeholder="Ex.: Juízo da VEP · São Luís/MA" /></div>
        <div><label>Origem</label><select name="origem" defaultValue={a.origem ?? ""}><option value="">—</option>{ANDAMENTO_ORIGEM.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}</select></div>
      </div>
      <div><label>Código de movimentação</label><input name="codigo_movimentacao" defaultValue={a.codigo_movimentacao ?? ""} placeholder="Ex.: djen-1837465  ·  seeu-4471  (vazio p/ cadastro manual)" /></div>
      <div><label>Teor / descrição</label><textarea name="descricao" rows={5} defaultValue={a.descricao} /></div>
      <p className="sub" style={{ margin: 0 }}>Chave natural (Sug. 90): identificador <b>CRU</b> da fonte com prefixo fixo em hífen — <span className="mono">djen-</span>, <span className="mono">push-</span>, <span className="mono">seeu-</span>, <span className="mono">datajud-</span>. Nunca embuta CNJ, data ou tipo, nem re-envelope um código já gravado. Sem identificador de origem (cadastro manual)? Deixe <b>vazio</b> — o dedup por conteúdo cobre. Andamento é informativo, nasce sem validação.</p>
    </FormModal>
  );
}

/* ── componente principal ────────────────────────────────────────────────── */
export function AndamentoPainel({ a, lista, mapa, anotacoes, filtroInicial = "recentes" }: { a: AndamentoFull; lista: Movimentacao[]; mapa: MapaProvidencia | null; anotacoes: Anotacao[]; filtroInicial?: FiltroMaster }) {
  const [verNotas, setVerNotas] = useState(true);
  const idc = idCurto(a.codigo_movimentacao);
  const tipoEfetivo = a.apuracao?.tipo_efetivo ?? a.tipo;

  return (
    <div className="audp">
      {/* MASTER — índice compartilhado (mesma row da tela raiz /andamentos) */}
      <AndamentoMaster lista={lista} activeId={a.id} filtroInicial={filtroInicial} />

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/andamentos">← Andamentos</Link>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* cabeçalho */}
            <div className="audp-tags">
              <span className={`pz-tag ${tipoTone(tipoEfetivo) === "red" ? "tone-red" : tipoTone(tipoEfetivo) === "green" ? "val" : tipoTone(tipoEfetivo) === "blue" ? "tone-blue" : "cat-slate"}`}>{humano(tipoEfetivo)}</span>
              <EstadoApuracao status={a.apuracao?.status} />
              <span className="pz-tag cat-blue">origem · {(a.origem ?? "—").toLowerCase()}</span>
              {a.movimento_nome && <span className="apur-rubrica" title="Rubrica do ato, separada da narrativa pela T1 (prompt fase14).">{a.movimento_nome}</span>}
              {ehIA(a.cadastrado_por) && <span className="pz-tag cowork"><Spark s={9} />capturado pela IA</span>}
              {a.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
            </div>
            {/* A apuração é a manchete quando existe — é ela que diz o que aconteceu. */}
            <h2 className="audp-h2">{headline(a.apuracao?.texto || a.descricao)}</h2>
            <div className="audp-cliline">
              {a.segredo ? (
                <b className="audp-cli">Cliente sob segredo</b>
              ) : a.clienteRefs.length ? (
                <b className="audp-cli">{a.clienteRefs.map((c, n) => <span key={c.id}>{n > 0 && ", "}<Link className="proc-link" href={linkPara("cliente", c.id)}>{c.nome}</Link></span>)}</b>
              ) : (
                <b className="audp-cli">{a.clientes || "Sem processo"}</b>
              )}
              <span className="and-sub mono">
                {idc ? `${idc} · ` : ""}{ddmm(a.data)}{a.vara_comarca ? ` · ${a.vara_comarca}` : a.tribunal ? ` · ${a.tribunal}` : ""}
              </span>
            </div>

            {/* PROCESSO — referência clara e clicável (abre o histórico de movimentações) */}
            {a.processo_id ? (
              <Link className="and-procref" href={linkPara("processo", a.processo_id)}>
                <div className="and-procref-l">
                  <span className="and-procref-k">Processo</span>
                  <span className="and-procref-num mono">{a.numero_cnj ?? (a.numero_registro ? `reg ${a.numero_registro}` : "sem CNJ")}</span>
                  {([a.classe ? humano(a.classe) : a.area ? humano(a.area) : null, a.vara_comarca ?? a.tribunal].filter(Boolean).join(" · ")) && (
                    <span className="and-procref-meta">{[a.classe ? humano(a.classe) : a.area ? humano(a.area) : null, a.vara_comarca ?? a.tribunal].filter(Boolean).join(" · ")}</span>
                  )}
                </div>
                <span className="and-procref-cta">ver histórico de movimentações →</span>
              </Link>
            ) : (
              <div className="and-procref orfao">
                <div className="and-procref-l">
                  <span className="and-procref-k">Processo</span>
                  <span className="and-procref-meta">Andamento órfão — sem processo vinculado. Vai à triagem; nunca se perde.</span>
                </div>
              </div>
            )}

            {/* BLOCO 0 · DO QUE SE TRATA — a razão de existir da tela. Vem antes de
                tudo porque é a pergunta que fazia Daniel abrir o processo. */}
            <div style={{ marginTop: 16 }}>
              <ApuracaoBloco
                a={a.apuracao}
                bruto={{ tipo: a.tipo, descricao: a.descricao }}
                segredo={a.segredo}
                semOriginal
              />
            </div>

            {/* BLOCO 0b · TRILHA DA VISITA (só quando a apuração veio de diligência) */}
            {a.consulta && (
              <Sec titulo="Trilha da diligência" sub="consultas_tribunal — a fila e o livro são a mesma tabela">
                <TrilhaConsulta c={a.consulta} />
              </Sec>
            )}

            {/* BLOCO 1 · regra de dedup */}
            <div className="and-dedup">
              <Info />
              <div>Andamento é <b>informativo</b> e nasce <b>sem validação</b>. Dedup pela chave natural <span className="mono">codigo_movimentacao</span> — índice único rejeita duplicada.</div>
            </div>

            {/* BLOCO 2 · ESCALONAMENTO */}
            <div className="audp-ia" style={{ marginTop: 18 }}>
              <div className="audp-ia-h"><Spark /><span>Escalonamento · mapa_andamento_tarefa</span></div>
              {a.tarefa ? (
                <div className="int-fluxo">
                  <span className="int-kw">{gatilho(a.tarefa.prioridade)}</span>
                  <span className="int-arr">→</span>
                  <span className="int-peca">tarefa de conferência · {humano(a.tarefa.prioridade) || "alta"}</span>
                </div>
              ) : (
                <div className="and-semescal">Nenhum gatilho de consequência detectado — movimentação <b>informativa</b>, sem tarefa gerada.</div>
              )}
              <div className="audp-ia-note">Prioridade absoluta de temas que afetam a <b>liberdade/patrimônio</b>. No máximo 1 tarefa automática por movimentação (dedup <span className="mono">ux_tarefas_andamento_auto</span>). <b>Não cria prazo nem fundamento</b> — apenas o gatilho de atenção humana. <span style={{ color: "var(--red)", fontWeight: 600 }}>Alerta em texto livre na descrição não contaria</span> — ficaria invisível ao sistema.</div>
            </div>

            {/* BLOCO 3 · TEOR BRUTO — o que o tribunal escreveu, jamais alterado.
                A continuação escrita pela triagem sai na cor e no glifo da IA, para
                que não se confunda com a fala da fonte. */}
            <Sec titulo="Original do tribunal" sub="texto bruto do push — a apuração acrescenta, nunca substitui">
              <div className="int-teor">
                <p><TextoCapturado texto={a.descricao} aspas /></p>
                <div className="int-teor-meta mono">descricao · origem {(a.origem ?? "—").toLowerCase()} · {fmtDate(a.data)}</div>
              </div>
            </Sec>

            {/* BLOCO 4 · DADOS */}
            <Sec titulo="Dados do andamento">
              <div className="audp-dados">
                <div className="fld"><div className="k">Tipo (original)</div><div className="v">{humano(a.tipo)}</div></div>
                <div className="fld">
                  <div className="k">Tipo apurado</div>
                  <div className="v">{a.apuracao?.tipo_apurado ? humano(a.apuracao.tipo_apurado) : "— não reclassificado"}</div>
                </div>
                <div className="fld"><div className="k">Rubrica do movimento</div><div className="v">{a.movimento_nome ?? "— não informada"}</div></div>
                <div className="fld"><div className="k">Data</div><div className="v mono">{fmtDate(a.data)}</div></div>
                <div className="fld"><div className="k">Autor</div><div className="v">{a.autor ?? "—"}</div></div>
                <div className="fld"><div className="k">Origem</div><div className="v">{a.origem ? a.origem.toUpperCase() : "—"}</div></div>
                <div className="fld"><div className="k">Código movimentação</div><div className="v mono" style={{ fontSize: 12 }}>{a.codigo_movimentacao ?? "—"}</div></div>
                <div className="fld"><div className="k">Cadastrado por</div><div className="v">{a.cadastrado_por ?? "—"}{a.cadastro_automatico ? " (automático)" : ""}</div></div>
                <div className="fld">
                  <div className="k">Apurado por</div>
                  <div className="v">
                    {a.apuracao?.apurado_por
                      ? `${a.apuracao.apurado_por === "mapa" ? "mapa (padrão reconhecido)" : `${a.apuracao.apurado_por} (nos autos)`}${a.apuracao.apurado_em ? ` · ${fmtDate(a.apuracao.apurado_em)}` : ""}`
                      : "— ainda não apurado"}
                  </div>
                </div>
              </div>
            </Sec>

            {/* BLOCO 5 · ENCADEIA */}
            <Sec titulo="Encadeia">
              {a.tarefa ? (
                <div className="przp-origem and-tarefa">
                  <span className={`pz-tag ${prioTone(a.tarefa.prioridade)}`}>tarefa · {humano(a.tarefa.prioridade) || "alta"}</span>
                  <div className="mid"><div className="t">{a.tarefa.titulo}</div><div className="s">{humano(a.tarefa.status)}{a.tarefa.responsavel ? ` · responsável ${a.tarefa.responsavel}` : ""}</div></div>
                  <Link className="btn sm abrir" href={linkPara("tarefa", a.tarefa.id)}>Abrir</Link>
                </div>
              ) : (
                <div className="audp-empty">Sem tarefa de conferência vinculada — movimentação informativa.</div>
              )}
              <div className="przp-note" style={{ marginTop: 8 }}>
                Pode <b>originar peça</b> (ex.: agravo em execução com pedido de efeito suspensivo). Se fosse <b>órfão</b> (sem processo), iria à <b>triagem</b> — nunca se perde.
              </div>
            </Sec>

            {/* BLOCO 6 · PEÇA ORIGINADA */}
            <Sec titulo="Peça originada" extra={<span className="audp-count">{a.pecas.length}</span>}>
              {a.pecas.length === 0 ? (
                <div className="przp-empty-row">
                  <span>Nenhuma peça criada a partir deste andamento.</span>
                  <CriarPecaPendente tipoOrigem="andamento" origemId={a.id} texto={a.descricao} mapa={mapa} />
                </div>
              ) : (
                <div className="przp-stack">
                  {a.pecas.map((p) => (
                    <div className="przp-origem" key={p.id}>
                      <span className="pz-tag cowork">peça</span>
                      <div className="mid"><div className="t">{p.titulo}</div><div className="s">{humano(p.status)}</div></div>
                      <Link className="btn sm abrir" href="/producao">Abrir</Link>
                    </div>
                  ))}
                </div>
              )}
            </Sec>

            {/* NOTAS */}
            {verNotas && (
              <Sec titulo="Anotações" extra={<span className="audp-count">{anotacoes.length}</span>}>
                <Anotacoes entidadeTipo="andamento" entidadeId={a.id} notas={anotacoes} />
              </Sec>
            )}

            {/* CONTROLE */}
            <div className="audp-status">
              <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Andamento</div>
              <EditarAndamento a={a} />
              <button type="button" className={`btn default${verNotas ? " on" : ""}`} onClick={() => setVerNotas((v) => !v)}>
                <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
              </button>
            </div>
            <div className="audp-status-note">Andamento é porta de entrada informativa — dedup por <span className="mono">codigo_movimentacao</span>, nunca DELETE. A consequência vive na tarefa/peça encadeada. Tudo auditado.</div>
          </div>
        </div>

        {/* action bar */}
        <div className="audp-actionbar">
          {/* Primeiro gesto da barra quando ainda não se sabe o que o ato é —
              é ele que tira o processo da fila da T4 e ensina o mapa. */}
          {!a.apuracao?.texto && <RegistrarApuracao andamentoId={a.id} tipoAtual={a.tipo} />}
          {a.tarefa && <Link className={`btn ${a.apuracao?.texto ? "primary" : "default"}`} href={linkPara("tarefa", a.tarefa.id)}><CheckSq /> Abrir conferência</Link>}
          <CriarPecaPendente tipoOrigem="andamento" origemId={a.id} texto={a.descricao} mapa={mapa} />
          {a.processo_id && <PromoverIntimacao andamentoId={a.id} className="btn default" label="→ Transformar em intimação" />}
          {a.processo_id && <CriarPrazoDeAndamento andamentoId={a.id} atoSugerido={a.descricao.split(/ — | · |\. |; |\n/)[0].trim().slice(0, 72)} className="btn default" label="⏱ Transformar em prazo" />}
          {a.processo_id && <Link className="btn default" href={linkPara("processo", a.processo_id)}>Ver processo</Link>}
        </div>
      </section>
    </div>
  );
}

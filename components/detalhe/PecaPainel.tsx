"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProcRef, Observacoes } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { BaixaAtoModal } from "@/components/modules/BaixaAtoModal";
import { useBaixaCascata } from "@/components/modules/BaixaCascata";
import { AnexarArquivamento } from "@/components/modules/AnexarArquivamento";
import { pendenteArquivamento } from "@/lib/arquivamento";
import { atualizarPeca, moverPeca, validarMinuta, anexarInsumoPeca } from "@/app/actions";
import { PECA_TIPO, PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { Peca, PecaFull, Anotacao, RadarItem } from "@/lib/data";

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
const DocIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h11l5 5v11H4z" /><path d="M8 13h8M8 17h5" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const FASES = ["a_fazer", "em_elaboracao", "em_revisao", "pronta", "protocolada"] as const;
const urg = (d: number | null) => d == null ? "" : d < 0 ? "red" : d <= 2 ? "red" : d <= 5 ? "amber" : "tang";
// Link do Drive a partir do drive_file_id (id puro → URL; caminho → sem link).
const driveUrl = (f: string | null) => (f && !/[/\s]/.test(f) ? `https://drive.google.com/open?id=${encodeURIComponent(f)}` : null);
const temMinuta = (p: PecaFull) => Boolean(p.drive_file_id) || ["em_revisao", "pronta", "protocolada"].includes(p.status);

/* ── seção rotulada ──────────────────────────────────────────────────────── */
function Sec({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="audp-sec">
      <div className="audp-sech">{titulo}{sub && <span className="cli-sech-sub">{sub}</span>}{extra}</div>
      {children}
    </div>
  );
}

/* ── master: card de peça ────────────────────────────────────────────────── */
function MasterCard({ p, ativo }: { p: Peca; ativo: boolean }) {
  return (
    <Link className={`audp-mcard cli-mcard${ativo ? " on" : ""}`} href={linkPara("peca", p.id)}>
      <div className="int-mtags">
        <span className="pz-tag cat-neutral">{humano(p.status)}</span>
        {p.cadastro_automatico && <span className="pz-tag cowork"><Spark s={8} />minuta IA</span>}
      </div>
      <div className="cli-mnome">{p.titulo}</div>
      <div className="cli-mmeta">{p.cliente || "—"}{p.dias_restantes != null ? ` · ${p.dias_restantes < 0 ? `${Math.abs(p.dias_restantes)}d atrás` : `${p.dias_restantes}d`}` : ""}</div>
    </Link>
  );
}

/* ── kanban ruler (clicável: move a peça de etapa) ───────────────────────── */
function KanbanRuler({ status, pecaId }: { status: string; pecaId: string }) {
  const router = useRouter();
  const [pend, start] = useTransition();
  const { raise, node } = useBaixaCascata();
  const idx = FASES.indexOf(status as (typeof FASES)[number]);
  const excecao = status === "aguardando_insumo";
  const terminal = status === "cancelada" || status === "prejudicada";
  const mover = (f: string) => {
    if (f === status || pend) return;
    start(async () => { const r = await moverPeca(pecaId, f); if (r.ok) { router.refresh(); raise(pecaId, r.cascata); } });
  };
  return (
    <div className="pkb">
      {node}
      {FASES.map((f, i) => (
        <button type="button" key={f} disabled={pend} onClick={() => mover(f)}
          className={`pkb-step${i === idx ? " on" : ""}${idx >= 0 && i < idx ? " done" : ""}`}>
          {humano(f)}{i < FASES.length - 1 && <span className="pkb-arr">→</span>}
        </button>
      ))}
      <button type="button" disabled={pend} onClick={() => mover("aguardando_insumo")}
        className={`pkb-exc${excecao ? " on" : ""}`}>aguardando insumo</button>
      {terminal && <span className="pkb-term">{humano(status)}</span>}
    </div>
  );
}

/* ── anexar insumo (aguardando_insumo) ───────────────────────────────────── */
function AnexarInsumo({ p, label }: { p: PecaFull; label: ReactNode }) {
  return (
    <FormModal label={label} titulo="Anexar insumo" descricao="Registre o insumo que faltava (link no Drive e/ou nota). A peça volta para reanálise do redator agendado." acao={anexarInsumoPeca.bind(null, p.id)} enviarLabel="Registrar insumo" variant="primary">
      <div><label>Link do insumo (Drive)</label><input name="link" placeholder="https://drive.google.com/…" /></div>
      <div><label>Nota</label><textarea name="nota" placeholder="Ex.: decisão integral juntada; certidão de trânsito do corréu." /></div>
    </FormModal>
  );
}

/* ── editar peça ─────────────────────────────────────────────────────────── */
function EditarPeca({ p }: { p: PecaFull }) {
  return (
    <FormModal label={<><PenIco /> Editar peça</>} titulo="Editar peça" descricao="Altere classificação, responsável, status e o arquivo da minuta no Drive." acao={atualizarPeca.bind(null, p.id)} enviarLabel="Salvar" variant="default">
      <div><label>Título</label><input name="titulo" required defaultValue={p.titulo} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Tipo</label><select name="tipo" defaultValue={p.tipo}>{PECA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Subtipo</label><input name="subtipo" defaultValue={p.subtipo ?? ""} placeholder="apelação, RESE, HC…" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Prioridade</label><select name="prioridade" defaultValue={p.prioridade ?? "media"}>{PRIORIDADES.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div><label>Arquivo da minuta (Drive)</label><input name="drive_file_id" defaultValue={p.drive_file_id ?? ""} placeholder="id ou caminho .docx no Drive" /></div>
      <div><label>Descrição</label><textarea name="descricao" defaultValue={p.descricao ?? ""} placeholder="Resumo / instruções da peça." /></div>
      <p className="sub" style={{ margin: 0 }}>A etapa (status) é alterada na régua do topo do detalhe ou no botão “Mover” do card.</p>
    </FormModal>
  );
}

/* ── card de inteligência por etapa (gate da redação) ────────────────────── */
function GateCard({ p }: { p: PecaFull }) {
  const baixa = p.gate_resultado === "baixa" || p.status === "aguardando_insumo";
  const alta = !baixa && (p.gate_resultado === "alta" || p.status === "em_revisao");

  if (baixa) {
    return (
      <div className="audp-ia tone-amber">
        <div className="audp-ia-h" style={{ color: "var(--amber)" }}><Spark /><span>Gate da redação · baixa — aguardando insumo</span></div>
        <div className="pk-gate-pend">{p.gate_pendencia || "Falta um insumo base para o redator agendado redigir com segurança."}</div>
        <div style={{ marginTop: 11 }}><AnexarInsumo p={p} label="Anexar insumo" /></div>
        <div className="audp-ia-note">O redator agendado só redige com insumo suficiente (decisão integral, certidões, peça-base). Anexe o que falta → a peça volta para reanálise. Nada é redigido “no escuro”.</div>
      </div>
    );
  }
  if (alta) {
    return (
      <div className="audp-ia">
        <div className="audp-ia-h"><Spark /><span>Gate da redação · alta — redigida pelo redator agendado</span></div>
        <div className="pk-gate-checks">
          <div className="pk-chk"><Check s={13} c="var(--green)" /><div><div className="t">Subtipo {p.subtipo ? "unívoco" : "a confirmar"}</div><div className="s">{p.subtipo ? humano(p.subtipo) : "definir subtipo"}</div></div></div>
          <div className="pk-chk"><Check s={13} c="var(--green)" /><div><div className="t">Insumo base</div><div className="s">{p.intimacao ? `${(p.intimacao.origem ?? "origem").toUpperCase()} em mãos` : p.andamentoOrigem ? "movimentação de origem" : "insumo em mãos"}</div></div></div>
          <div className="pk-chk"><Check s={13} c="var(--green)" /><div><div className="t">Acervo cobre</div><div className="s">acervo curado disponível</div></div></div>
        </div>
        <div className="audp-ia-note">Minuta pré-gravada em <span className="mono">em_revisao</span>, <span className="mono">validado=false</span> — nasce visível, perde a aura ao validar. Se fosse BAIXA → <span className="mono">aguardando_insumo</span> + tarefa para Daniel.</div>
      </div>
    );
  }
  // demais etapas
  const porEtapa: Record<string, { h: string; b: string }> = {
    a_fazer: { h: "Na fila de redação", b: "Peça no backlog — ainda sem minuta. Atribua um responsável e comece a elaboração, ou deixe o redator agendado redigir na próxima passada." },
    em_elaboracao: { h: "Em elaboração", b: `Redação em curso${p.responsavel ? ` por ${p.responsavel}` : ""}. Ao concluir, mova para revisão.` },
    pronta: { h: "Pronta para protocolo", b: "Minuta validada. O sistema nunca protocola sozinho — protocola na baixa do prazo (gera o andamento)." },
    protocolada: { h: "Protocolada", b: `Protocolada${p.protocolada_em ? ` em ${fmtDate(p.protocolada_em)}` : ""} — gerou o andamento de petição protocolada.` },
    cancelada: { h: "Cancelada", b: "Peça cancelada (correção de status, auditada) — nunca DELETE." },
    prejudicada: { h: "Prejudicada", b: "Peça prejudicada (perdeu o objeto) — troca de status, auditada." },
  };
  const e = porEtapa[p.status] ?? { h: humano(p.status), b: "" };
  return (
    <div className="audp-ia" style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}>
      <div className="audp-ia-h" style={{ color: "var(--muted)" }}><DocIco /><span>{e.h}</span></div>
      <div className="audp-ia-note" style={{ borderTop: "none", paddingTop: 4, marginTop: 6 }}>{e.b}</div>
    </div>
  );
}

/* ── card de vínculo ─────────────────────────────────────────────────────── */
function Vinc({ tag, tagTone = "cat-slate", titulo, sub, href, vazio }: { tag: string; tagTone?: string; titulo?: ReactNode; sub?: ReactNode; href?: string | null; vazio?: string }) {
  return (
    <div className={`pk-vinc${vazio ? " vazio" : ""}`}>
      <span className={`pz-tag ${tagTone}`}>{tag}</span>
      {vazio ? <span className="pk-vinc-vazio">{vazio}</span> : (
        <>
          <div className="mid"><div className="t">{titulo}</div>{sub && <div className="s">{sub}</div>}</div>
          {href && <Link className="btn sm abrir" href={href}>Abrir</Link>}
        </>
      )}
    </div>
  );
}

/* ── componente principal ────────────────────────────────────────────────── */
/* ── índice (lista compacta) — reusado no drawer e na tela raiz /producao ── */
export function PecaMaster({ lista, activeId }: { lista: Peca[]; activeId?: string }) {
  const [filtro, setFiltro] = useState<"backlog" | "ia">("backlog");
  const backlog = lista;
  const ia = lista.filter((x) => x.cadastro_automatico);
  const visiveis = filtro === "ia" ? ia : backlog;
  return (
    <aside className="audp-master">
      <div className="audp-master-h">
        <h1>Produção</h1>
        <div className="audp-filtros">
          <button type="button" className={`audp-chip ink${filtro === "backlog" ? " on" : ""}`} onClick={() => setFiltro("backlog")}>Backlog ({backlog.length})</button>
          <button type="button" className={`audp-chip tang${filtro === "ia" ? " on" : ""}`} onClick={() => setFiltro("ia")}>minutas IA ({ia.length})</button>
        </div>
      </div>
      <div className="audp-master-list">
        {visiveis.length === 0
          ? <div className="audp-empty">Nada por aqui.</div>
          : visiveis.map((x) => <MasterCard key={x.id} p={x} ativo={x.id === activeId} />)}
      </div>
    </aside>
  );
}

export function PecaPainel({ p, lista, anotacoes, acervo }: { p: PecaFull; lista: Peca[]; anotacoes: Anotacao[]; acervo: RadarItem[] }) {
  const [verNotas, setVerNotas] = useState(true);

  const tone = urg(p.dias_restantes);
  const ativa = !["protocolada", "cancelada", "prejudicada"].includes(p.status);
  const minuta = temMinuta(p);
  const dvUrl = driveUrl(p.drive_file_id);
  const arqPend = pendenteArquivamento(p.descricao);

  return (
    <div className="audp">
      {/* MASTER — índice compartilhado (mesma row da tela raiz /producao) */}
      <PecaMaster lista={lista} activeId={p.id} />

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/producao">← Produção</Link>
        </div>

        {/* régua kanban — clicável para mover de etapa */}
        <KanbanRuler status={p.status} pecaId={p.id} />

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* cabeçalho */}
            <div className="audp-title-row">
              <div className="audp-title-l">
                <div className="audp-tags">
                  <span className="pz-tag cat-slate">{humano(p.tipo)}{p.subtipo ? ` · ${humano(p.subtipo)}` : ""}</span>
                  {p.cadastro_automatico && !p.validado && <span className="pz-tag cowork"><Spark s={9} />minuta IA · revisar</span>}
                  {p.validado && <span className="pz-tag val"><Check s={9} c="var(--green)" />validada</span>}
                  {p.reflexo_execucao && <span className="pz-tag reflexo">⚖ reflexo na execução{p.reflexo_execucao_tipo ? ` · ${humano(p.reflexo_execucao_tipo)}` : ""}</span>}
                  {arqPend && <span className="pz-tag arq-pend" title="Protocolada sem PDF salvo — anexe o arquivo para arquivar">arquivamento pendente</span>}
                </div>
                <h2 className="audp-h2">{p.titulo}</h2>
                <div className="audp-cliline">
                  {p.segredo ? <b className="audp-cli">Cliente sob segredo</b>
                    : p.clienteRefs.length ? <b className="audp-cli">{p.clienteRefs.map((c, n) => <span key={c.id}>{n > 0 && ", "}<Link className="proc-link" href={linkPara("cliente", c.id)}>{c.nome}</Link></span>)}</b>
                    : <b className="audp-cli">{p.cliente || "Inicial · sem processo"}</b>}
                  {(p.numero_cnj || p.numero_registro) && <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} id={p.processo_id} />}
                  {p.tribunal && <span className="pk-trib">{p.tribunal}</span>}
                </div>
                {p.reflexo_execucao && p.cliente_id && (
                  <div className="pk-reflexo">
                    ⚖ Esta peça reflete na execução penal{p.reflexo_execucao_tipo ? ` (${humano(p.reflexo_execucao_tipo)})` : ""}.{" "}
                    <Link className="proc-link" href={linkPara("cliente", p.cliente_id)}>Ver cenário projetado na execução do cliente →</Link>
                  </div>
                )}
              </div>
              {p.dias_restantes != null && (
                <div className={`przp-datecard tone-${tone}`}>
                  <div className="d">{p.dias_restantes < 0 ? `${Math.abs(p.dias_restantes)} d` : `${p.dias_restantes} d`}</div>
                  <div className="s">{p.prazo ? "prazo herdado" : "data-alvo"}{p.data_fatal ? ` · fatal ${ddmm(p.data_fatal)}` : ""}</div>
                </div>
              )}
            </div>

            {/* BLOCO 1 · GATE (por etapa) */}
            <div style={{ marginTop: 18 }}><GateCard p={p} /></div>

            {/* BLOCO 2 · MINUTA */}
            <Sec titulo="Minuta · redator penal" extra={dvUrl ? <a className="cli-sech-acao proc-link" href={dvUrl} target="_blank" rel="noreferrer">Abrir no Drive ↗</a> : undefined}>
              <div className="pk-minuta">
                {minuta ? (
                  <>
                    <div className="pk-minuta-txt">{p.descricao?.trim() || "Minuta redigida — o texto completo vive no arquivo .docx do Drive."}</div>
                    <div className="pk-minuta-meta mono">{p.drive_file_id ? p.drive_file_id : "sem arquivo vinculado"}{p.observacoes ? " · nota interna" : ""}</div>
                  </>
                ) : (
                  <div className="pk-minuta-vazio">Minuta ainda não redigida{p.status === "aguardando_insumo" ? " — aguardando insumo." : p.status === "a_fazer" ? " — peça no backlog." : "."}</div>
                )}
              </div>
            </Sec>

            {/* BLOCO 3 · DADOS */}
            <Sec titulo="Dados da peça">
              <div className="audp-dados">
                <div className="fld"><div className="k">Tipo</div><div className="v">{humano(p.tipo)}</div></div>
                <div className="fld"><div className="k">Subtipo</div><div className="v">{p.subtipo ? humano(p.subtipo) : "—"}</div></div>
                <div className="fld"><div className="k">Status</div><div className="v" style={{ color: "var(--accent-strong)", fontWeight: 600 }}>{humano(p.status)}</div></div>
                <div className="fld"><div className="k">Validado</div><div className="v" style={{ color: p.validado ? "var(--green)" : "var(--tang)", fontWeight: 600 }}>{p.validado ? "validada" : "false · minuta IA"}</div></div>
                <div className="fld"><div className="k">Cadastrado por</div><div className="v">{p.cadastrado_por ?? "—"}{p.cadastro_automatico ? " (automático)" : ""}</div></div>
                <div className="fld"><div className="k">Drive file</div><div className="v mono" style={{ fontSize: 11.5 }}>{p.drive_file_id ?? "—"}</div></div>
              </div>
              {/* A nota interna traz instrução operacional sobre a peça (ex.: "não dar
                  baixa em cascata antes de confirmar o protocolo"). O bloco da minuta
                  apenas sinalizava que ela existia, sem nunca mostrar o texto. */}
              <Observacoes texto={p.observacoes} rotulo="Nota interna" />
            </Sec>

            {/* BLOCO 4 · VÍNCULOS */}
            <Sec titulo="Vínculos" sub="todos opcionais">
              <div className="pk-vincs">
                {p.prazo
                  ? <Vinc tag="prazo" titulo={p.prazo.ato.split(/\s*[—–[]/)[0].trim()} sub={<span className="mono">{p.prazo.dias != null ? `${p.prazo.dias} d` : ""} · herda contagem</span>} href={linkPara("prazo", p.prazo.id)} />
                  : <Vinc tag="prazo" vazio="sem prazo vinculado" />}
                {p.intimacao
                  ? <Vinc tag="intimação" tagTone="cat-blue" titulo={p.intimacao.resumo?.split(/\s*[—–[]/)[0].trim() || "Intimação de origem"} sub={<>origem {(p.intimacao.origem ?? "—").toUpperCase()} ✓</>} href={linkPara("intimacao", p.intimacao.id)} />
                  : <Vinc tag="intimação" tagTone="cat-blue" vazio="sem intimação de origem" />}
                {p.processo_id
                  ? <Vinc tag="processo" titulo={<ProcRef cnj={p.numero_cnj} registro={p.numero_registro} id={p.processo_id} />} sub={p.tribunal ?? undefined} href={linkPara("processo", p.processo_id)} />
                  : <Vinc tag="processo" vazio="inicial · caso novo" />}
                {p.andamentoProtocolo
                  ? <Vinc tag="andamento" titulo={humano(p.andamentoProtocolo.tipo)} sub={<span className="mono">{ddmm(p.andamentoProtocolo.data)} · protocolo</span>} href={linkPara("andamento", p.andamentoProtocolo.id)} />
                  : p.andamentoOrigem
                    ? <Vinc tag="andamento" titulo={humano(p.andamentoOrigem.tipo)} sub={<span className="mono">{ddmm(p.andamentoOrigem.data)} · origem</span>} href={linkPara("andamento", p.andamentoOrigem.id)} />
                    : <Vinc tag="andamento" vazio="grava no protocolo (baixa)" />}
                {p.tarefa && (
                  <Vinc tag="tarefa" tagTone="cat-neutral" titulo={p.tarefa.titulo} sub={humano(p.tarefa.status)} href={linkPara("tarefa", p.tarefa.id)} />
                )}
              </div>
              <div className="pk-vinc-nota">+ Dedup: índice único garante no máximo 1 peça automática por intimação.</div>
            </Sec>

            {/* BLOCO 5 · ACERVO DE TESES */}
            <Sec titulo="Acervo de teses · ancoragem" extra={<span className="audp-count">{acervo.length}</span>}>
              {acervo.length ? (
                <div className="przp-stack">
                  {acervo.map((t) => (
                    <div className="przp-origem" key={t.id}>
                      <span className="pz-tag val">{t.tipo ? humano(t.tipo) : "precedente"}{t.tribunal ? ` ${t.tribunal}` : ""}</span>
                      <div className="mid"><div className="t">{t.titulo}</div><div className="s">curado · acervo do escritório</div></div>
                      {(t.link_inteiro_teor || t.url) && <a className="btn sm abrir" href={(t.link_inteiro_teor || t.url)!} target="_blank" rel="noreferrer">Abrir</a>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="audp-empty">Sem teses curadas ancoradas. O acervo curado (radar de jurisprudência) alimenta esta ancoragem.</div>
              )}
              <div className="pk-vinc-nota">Jurisprudência não verificada não entra. Validadas perdem a aura e entram no estudo.</div>
            </Sec>

            {/* NOTAS */}
            {verNotas && (
              <Sec titulo="Anotações" extra={<span className="audp-count">{anotacoes.length}</span>}>
                <Anotacoes entidadeTipo="peca" entidadeId={p.id} notas={anotacoes} />
              </Sec>
            )}

            {/* CONTROLE */}
            <div className="audp-status">
              <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Peça</div>
              <EditarPeca p={p} />
              <button type="button" className={`btn default${verNotas ? " on" : ""}`} onClick={() => setVerNotas((v) => !v)}>
                <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
              </button>
            </div>

            {/* BAIXA */}
            {ativa && (
              <div className="audp-status" style={{ borderTop: "none", paddingTop: 0 }}>
                <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Baixa</div>
                <BaixaAtoModal pecaId={p.id} titulo={p.titulo} className="btn ok" label={<><Check s={13} c="#fff" /> Protocolei / dar baixa</>} />
                <Acao label="Cancelar / prejudicar" variant="danger" titulo="Cancelar ou prejudicar peça" confirmarLabel="Cancelar" resumo={<>Encerrar <b>{p.titulo}</b> sem protocolo? Troca de status (cancelada) — nunca DELETE, auditado.</>} acao={() => moverPeca(p.id, "cancelada")} />
              </div>
            )}
            <div className="audp-status-note">O sistema nunca protocola — a baixa do prazo move a peça para protocolada (e vice-versa). Correção é troca de status (cancelada / prejudicada) — nunca DELETE.</div>
          </div>
        </div>

        {/* action bar */}
        <div className="audp-actionbar">
          {dvUrl
            ? <a className="btn primary" href={dvUrl} target="_blank" rel="noreferrer"><DocIco /> Abrir minuta</a>
            : p.status === "a_fazer"
              ? <Acao label={<><PenIco c="#fff" /> Começar redação</>} variant="primary" size="md" titulo="Começar redação" confirmarLabel="Mover p/ elaboração" resumo={<>Mover <b>{p.titulo}</b> para <b>em elaboração</b>?</>} acao={() => moverPeca(p.id, "em_elaboracao")} />
              : <span className="pk-bar-info">Minuta ainda não redigida</span>}
          {!p.validado && ["em_revisao", "pronta"].includes(p.status) && (
            <Acao label={<><Check /> Validar</>} variant="ok" size="md" titulo="Validar minuta" confirmarLabel="Validar" resumo={<>Validar <b>{p.titulo}</b> e mover para <b>pronta</b>? O sistema nunca protocola sozinho.</>} acao={() => validarMinuta(p.id)} />
          )}
          {p.status === "aguardando_insumo" && <AnexarInsumo p={p} label="Anexar insumo" />}
          {arqPend && p.processo_id && <AnexarArquivamento pecaId={p.id} segredo={p.segredo} className="btn default" label="📎 Anexar PDF protocolado" />}
          {p.cliente_id && <Link className="btn default" href={`/estudos?cliente=${p.cliente_id}`}>Acervo de teses</Link>}
        </div>
      </section>
    </div>
  );
}

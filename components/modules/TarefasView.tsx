"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
import { moverTarefa, assumirTarefa, reatribuirTarefa, type Resultado } from "@/app/actions";
import { linkPara } from "@/lib/links";
import { fmtDate, humano } from "@/lib/format";
import type { TarefaCard } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

type Socio = "Daniel" | "Rodolfo";
const outroSocio = (s: Socio): Socio => (s === "Daniel" ? "Rodolfo" : "Daniel");

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Person = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="1.9" strokeLinecap="round" aria-hidden><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
);
const Spark = ({ c = "var(--accent)" }: { c?: string }) => (
  <svg width="9" height="9" viewBox="0 0 24 24" style={{ fill: c }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>
);
const Doc = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h11l5 5v11H4z" /><path d="M8 13h8" /></svg>
);
const Check = ({ c = "var(--green)" }: { c?: string }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);
const Arrow = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const PRI = new Set(["urgente", "alta", "media", "baixa"]);
const priKey = (p: string | null) => (p && PRI.has(p) ? p : "media");
const ehConferencia = (t: TarefaCard) => Boolean(t.cadastro_automatico) && t.cadastrado_por === "cowork" && t.andamento_id != null;
// Significado do nível de escalonamento (mesma doutrina da /andamentos e do trilho).
const motivo = (p: string | null) =>
  p === "urgente" ? "liberdade ou patrimônio (prisão, bloqueio, regressão)."
    : p === "alta" ? "mérito, decisão ou audiência designada."
      : "conferência humana.";
const procNum = (t: TarefaCard) => t.numero_cnj ?? (t.numero_registro ? `reg ${t.numero_registro}` : null);

/* Corta do título os segmentos finais que só repetem o que o card já mostra em
 * campo próprio: nº/identificador de processo e o nome do cliente. Só age sobre
 * segmentos separados por travessão (— / –) — o padrão dos títulos automáticos
 * "[CONFERIR] … — CLIENTE — 0000000-00.0000…". Texto descritivo é preservado. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
const CNJ_RE = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;
const PROC_PREFIX = /^(hc|rhc|ap|re|are|resp|aresp|agrg|rvcr|ms|ed|edcl|rese|ac|apn)\b/i;

function tituloLimpo(t: TarefaCard): string {
  const bruto = (t.titulo ?? "").trim();
  const partes = bruto.split(/\s*[—–]\s*/);
  if (partes.length < 2) return bruto;

  const cli = t.cliente ? norm(t.cliente) : [];
  const ehProc = (seg: string) =>
    CNJ_RE.test(seg) || PROC_PREFIX.test(seg.trim()) || /\d{6,}/.test(seg) || (!!t.numero_cnj && seg.includes(t.numero_cnj));
  const ehCliente = (seg: string) => {
    if (!cli.length) return false;
    const s = norm(seg);
    return s.length > 0 && s[0] === cli[0] && s[s.length - 1] === cli[cli.length - 1];
  };

  while (partes.length > 1) {
    const ult = partes[partes.length - 1].trim();
    if (ehProc(ult) || ehCliente(ult)) partes.pop();
    else break;
  }
  return partes.join(" — ").trim() || bruto;
}

/* botão de ação simples (move status / assume / reatribui) */
function AcaoBtn({ run, children, className = "tk-fbtn" }: { run: () => Promise<Resultado>; children: ReactNode; className?: string }) {
  const router = useRouter();
  const [pend, setPend] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={pend}
      onClick={async (e) => { e.stopPropagation(); setPend(true); const r = await run(); setPend(false); if (r.ok) router.refresh(); }}
    >
      {pend ? "…" : children}
    </button>
  );
}

/* ── card PENDENTE (mostra como entrou: prioridade + escalonamento) ──────── */
function PendenteCard({ t, mapa }: { t: TarefaCard; mapa: MapaProvidencia | null }) {
  const conf = ehConferencia(t);
  const pk = priKey(t.prioridade);
  return (
    <article className={`tk-card p-${pk}${conf ? " conf" : ""}`}>
      <span className="tk-bar" />
      <div className="tk-in">
        <div className="tk-body">
          <div className="tk-tags">
            <span className={`tk-pri ${pk}`}>{humano(t.prioridade)}</span>
            {conf && <span className="tk-conf"><Spark c="#fff" />conferência · IA</span>}
            {!conf && t.responsavel === "Ambos" && <span className="tk-dist">a distribuir · Ambos</span>}
            {t.segredo && <span className="pz-tag segredo">🔒 segredo</span>}
          </div>
          <Link className="tk-title" href={linkPara("tarefa", t.id)} title={t.titulo}>{tituloLimpo(t)}</Link>
          {t.descricao && <div className="tk-desc">{t.descricao}</div>}
          {conf && (
            <div className="and-banner">
              <span className="and-banner-ico">⚠</span>
              <div><b>Escalado para conferência · {(t.prioridade ?? "alta").toUpperCase()}</b> — {motivo(t.prioridade)}</div>
            </div>
          )}
          {t.cliente && <div className="tk-cli"><Person /><b>{t.cliente}</b></div>}
          {procNum(t) && <div className="tk-num mono">{procNum(t)}</div>}
          {conf && t.andamento_id && (
            <Link className="tk-link" href="/andamentos">ver movimentação de origem <Arrow /></Link>
          )}
        </div>
        <div className="tk-foot">
          {t.responsavel === "Ambos"
            ? <>
                <AcaoBtn run={() => assumirTarefa(t.id)}>Assumir</AcaoBtn>
                <AcaoBtn run={() => reatribuirTarefa(t.id)} className="tk-fbtn sec">Reatribuir</AcaoBtn>
              </>
            : <AcaoBtn run={() => moverTarefa(t.id, "em_andamento")}>Em andamento</AcaoBtn>}
          {conf && (
            <CriarPecaPendente
              tipoOrigem="tarefa"
              origemId={t.id}
              texto={t.descricao || t.titulo}
              mapa={mapa}
              label={<><Doc />Criar peça</>}
              className="tk-fbtn sec peca"
            />
          )}
        </div>
      </div>
    </article>
  );
}

/* ── card EM ANDAMENTO (já lido/atribuído: evento, cliente, resp., data) ─── */
function AndamentoCard({ t }: { t: TarefaCard }) {
  const pk = priKey(t.prioridade);
  return (
    <article className={`tk-card p-${pk}`}>
      <span className="tk-bar" />
      <div className="tk-in">
        <div className="tk-body">
          <div className="tk-tags">
            <span className={`tk-pri ${pk}`}>{humano(t.prioridade)}</span>
            {t.responsavel && t.responsavel !== "Ambos" && <span className="tk-resp">{t.responsavel}</span>}
            {t.segredo && <span className="pz-tag segredo">🔒 segredo</span>}
          </div>
          <Link className="tk-title" href={linkPara("tarefa", t.id)} title={t.titulo}>{tituloLimpo(t)}</Link>
          {t.descricao && <div className="tk-desc">{t.descricao}</div>}
          {t.cliente && <div className="tk-cli"><Person /><b>{t.cliente}</b></div>}
          <div className="tk-num mono">{[t.responsavel ?? "—", t.data_limite ? `limite ${fmtDate(t.data_limite)}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="tk-foot">
          <AcaoBtn run={() => moverTarefa(t.id, "concluida")} className="tk-fbtn concluir"><Check />Concluir</AcaoBtn>
          <AcaoBtn run={() => moverTarefa(t.id, "pendente")} className="tk-fbtn sec">Voltar</AcaoBtn>
        </div>
      </div>
    </article>
  );
}

/* ── card CONCLUÍDA (minimalista) ───────────────────────────────────────── */
function ConcluidaCard({ t }: { t: TarefaCard }) {
  const conf = ehConferencia(t);
  return (
    <article className="tk-card done">
      <div className="tk-body">
        <div className="tk-tags">
          <span className="tk-done"><Check />concluída</span>
          {conf && <span className="tk-conf soft"><Spark />era conferência</span>}
        </div>
        <Link className="tk-title sm" href={linkPara("tarefa", t.id)} title={t.titulo}>{tituloLimpo(t)}</Link>
        {t.cliente && <div className="tk-cli done"><b>{t.cliente}</b></div>}
        <div className="tk-when mono">
          {t.concluida_em ? <><Check />{fmtDate(t.concluida_em)}</> : (t.data_limite ? fmtDate(t.data_limite) : "concluída")}
          {t.responsavel ? ` · ${t.responsavel}` : ""}
        </div>
      </div>
    </article>
  );
}

/* ── tela ────────────────────────────────────────────────────────────────── */
export function TarefasView({
  tarefas,
  mapa = null,
  socio = null,
  novaTarefa,
}: {
  tarefas: TarefaCard[];
  mapa?: MapaProvidencia | null;
  socio?: Socio | null;
  novaTarefa?: ReactNode;
}) {
  const [atr, setAtr] = useState("todas");
  const [pri, setPri] = useState("todas");
  const outro = socio ? outroSocio(socio) : null;

  // contadores (sobre o conjunto bruto)
  const abertas = tarefas.filter((t) => t.status !== "concluida" && t.status !== "cancelada");
  const cPend = tarefas.filter((t) => t.status === "pendente").length;
  const cConf = tarefas.filter(ehConferencia).length;
  const cUrgente = abertas.filter((t) => t.prioridade === "urgente").length;
  const cDistribuir = abertas.filter((t) => t.responsavel === "Ambos").length;

  const filtradas = useMemo(() => tarefas.filter((t) => {
    const okAtr =
      atr === "minhas" ? socio != null && t.responsavel === socio
        : atr === "socio" ? outro != null && t.responsavel === outro
          : atr === "distribuir" ? t.responsavel === "Ambos"
            : atr === "conferencias" ? ehConferencia(t)
              : true;
    const okPri = pri === "todas" ? true : t.prioridade === pri;
    return okAtr && okPri;
  }), [tarefas, atr, pri, socio, outro]);

  const nMinhas = socio ? tarefas.filter((t) => t.responsavel === socio).length : 0;
  const nSocio = outro ? tarefas.filter((t) => t.responsavel === outro).length : 0;

  const atribuicao = [
    { id: "todas", label: `Todas (${tarefas.length})` },
    ...(socio ? [{ id: "minhas", label: `Minhas · ${socio} (${nMinhas})` }] : []),
    ...(outro ? [{ id: "socio", label: `${outro} (${nSocio})` }] : []),
    { id: "distribuir", label: `A distribuir (${cDistribuir})` },
    ...(cConf > 0 ? [{ id: "conferencias", label: `Conferências Cowork (${cConf})`, conf: true }] : []),
  ];
  const prioridades = [
    { id: "todas", label: "Toda prioridade", tone: "" },
    { id: "urgente", label: "Urgente", tone: "red" },
    { id: "alta", label: "Alta", tone: "amber" },
    { id: "media", label: "Média", tone: "" },
  ];

  const pendentes = filtradas.filter((t) => t.status === "pendente");
  const andamento = filtradas.filter((t) => t.status === "em_andamento");
  const concluidas = filtradas
    .filter((t) => t.status === "concluida")
    .sort((a, b) => (b.concluida_em ?? "").localeCompare(a.concluida_em ?? ""));

  const cols: { key: string; label: string; dot: string; itens: TarefaCard[]; render: (t: TarefaCard) => ReactNode; extra?: ReactNode }[] = [
    { key: "pendente", label: "Pendente", dot: "slate", itens: pendentes, render: (t) => <PendenteCard key={t.id} t={t} mapa={mapa} /> },
    { key: "andamento", label: "Em andamento", dot: "blue", itens: andamento, render: (t) => <AndamentoCard key={t.id} t={t} /> },
    { key: "concluida", label: "Concluída", dot: "green", itens: concluidas, render: (t) => <ConcluidaCard key={t.id} t={t} />, extra: <span className="tk-col-hint">recentes</span> },
  ];

  return (
    <div className="pz-page">
      {/* cabeçalho */}
      <div className="pz-head">
        <div className="lhs">
          <div className="eyebrow">Fluxo de trabalho · conferências da triagem</div>
          <h1>Tarefas</h1>
          <p>
            Vinculáveis a processo e/ou cliente, com prioridade de baixa a urgente. Boa parte nasce sozinha: o
            <b> escalonamento</b> transforma movimentações com consequência em <b>conferências</b> para o Daniel — e cada
            tarefa puxa a peça, o compromisso ou a movimentação de origem.
          </p>
        </div>
        {novaTarefa}
      </div>

      {/* contadores */}
      <div className="pz-counters">
        <div className="pz-counter"><div className="big">{cPend}</div><div className="lbl">pendentes</div></div>
        <div className="pz-counter accent"><div className="big">{cConf}</div><div className="lbl">conferências Cowork</div></div>
        <div className="pz-counter red"><div className="big">{cUrgente}</div><div className="lbl">urgente · liberdade</div></div>
        <div className="pz-counter"><div className="big amber">{cDistribuir}</div><div className="lbl">a distribuir</div></div>
      </div>

      {/* filtros */}
      <div className="tk-filters">
        <div className="tk-chips">
          {atribuicao.map((o) => (
            <button key={o.id} type="button" className={`tk-chip${atr === o.id ? " on" : ""}${"conf" in o && o.conf ? " conf" : ""}`} onClick={() => setAtr(o.id)}>
              {"conf" in o && o.conf && <Spark />}{o.label}
            </button>
          ))}
        </div>
        <div className="tk-chips">
          {prioridades.map((o) => (
            <button key={o.id} type="button" className={`tk-chip sm${pri === o.id ? " on" : ""}${o.tone ? ` tone-${o.tone}` : ""}`} onClick={() => setPri(o.id)}>
              {o.label}
            </button>
          ))}
          <span className="tk-filter-count mono">{filtradas.length} no filtro</span>
        </div>
      </div>

      {/* kanban */}
      <div className="tk-board">
        {cols.map((c) => (
          <section className="tk-col" key={c.key}>
            <div className="tk-col-h">
              <span className={`tk-dot ${c.dot}`} />
              <span className="tk-col-t">{c.label}</span>
              <span className="tk-col-n mono">{c.itens.length}</span>
              {c.extra && <span className="tk-col-end">{c.extra}</span>}
            </div>
            <div className="tk-col-b">
              {c.itens.length ? c.itens.map(c.render) : <div className="tk-col-empty">—</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

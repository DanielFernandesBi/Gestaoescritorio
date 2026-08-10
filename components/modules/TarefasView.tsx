"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
import { CaixaBtn } from "@/components/CaixaBtn";
import { PageHeader } from "@/components/PageHeader";
import { moverTarefa, assumirTarefa, reatribuirTarefa, type Resultado } from "@/app/actions";
import { ConcluirConferencia } from "@/components/modules/RegistrarApuracao";
import { linkPara } from "@/lib/links";
import { fmtDate, humano, diasAte } from "@/lib/format";
import type { TarefaCard } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

type Socio = "Daniel" | "Rodolfo";
const outroSocio = (s: Socio): Socio => (s === "Daniel" ? "Rodolfo" : "Daniel");

/* ── glifos ──────────────────────────────────────────────────────────────── */
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
const X = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
);
const Clock = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const PRI = new Set(["urgente", "alta", "media", "baixa"]);
const priKey = (p: string | null) => (p && PRI.has(p) ? p : "media");
const ehConferencia = (t: TarefaCard) => Boolean(t.cadastro_automatico) && t.cadastrado_por === "cowork" && t.andamento_id != null;
// Sug. 62 — sentinela de inércia: tarefa automática do Cowork SEM andamento de
// origem, etiquetada por motivo_auto (vigia ausência de movimento, não presença).
const ehSentinela = (t: TarefaCard) => Boolean(t.cadastro_automatico) && t.cadastrado_por === "cowork" && t.motivo_auto === "inercia";
// Conferência automática do Cowork (escalonamento de andamento OU sentinela).
const ehAutoCowork = (t: TarefaCard) => ehConferencia(t) || ehSentinela(t);
// Significado do nível de escalonamento (mesma doutrina da /andamentos e do trilho).
const motivo = (p: string | null) =>
  p === "urgente" ? "liberdade ou patrimônio (prisão, bloqueio, regressão)."
    : p === "alta" ? "mérito, decisão ou audiência designada."
      : "conferência humana.";
const procNum = (t: TarefaCard) => t.numero_cnj ?? (t.numero_registro ? `reg ${t.numero_registro}` : null);

/* ── prazo (semáforo por data limite) ───────────────────────────────────────
 * Reaproveita a doutrina dos prazos: negativo = vencido; hoje; ≤2 crítico;
 * ≤5 atenção; senão no prazo. `sem prazo` fica neutro e discreto. */
type PrazoClasse = "atras" | "hoje" | "crit" | "warn" | "ok" | "none";
function prazoClasse(data: string | null): PrazoClasse {
  if (!data) return "none";
  const d = diasAte(data);
  return d < 0 ? "atras" : d === 0 ? "hoje" : d <= 2 ? "crit" : d <= 5 ? "warn" : "ok";
}
function prazoTexto(data: string | null): string {
  if (!data) return "sem prazo";
  const d = diasAte(data);
  if (d < 0) return `atrasada · ${Math.abs(d)}d`;
  if (d === 0) return "vence hoje";
  if (d === 1) return "vence amanhã";
  return `em ${d} dias`;
}
const atrasada = (t: TarefaCard) => prazoClasse(t.data_limite) === "atras";

function PrazoChip({ data }: { data: string | null }) {
  const cls = prazoClasse(data);
  return (
    <span className={`tk-prazo ${cls}`} title={data ? `Data limite: ${fmtDate(data)}` : "Sem data limite definida"}>
      <Clock />
      <span className="tk-prazo-t">{prazoTexto(data)}</span>
      {data && <span className="tk-prazo-dt">{fmtDate(data)}</span>}
    </span>
  );
}

/* ── responsável como avatar (iniciais, cor por sócio) ─────────────────────── */
const iniciais = (n: string) => {
  const p = n.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
};
function RespAvatar({ nome }: { nome: string | null }) {
  if (!nome) return <span className="tk-av vazio" title="Sem responsável">?</span>;
  if (nome === "Ambos") return <span className="tk-av ambos" title="A distribuir entre os sócios">AD</span>;
  const tone = nome === "Daniel" ? "d" : nome === "Rodolfo" ? "r" : "x";
  return <span className={`tk-av ${tone}`} title={nome}>{iniciais(nome)}</span>;
}

/* Corta do título os segmentos finais que só repetem o que o card já mostra em
 * campo próprio: nº/identificador de processo e o nome do cliente. Só age sobre
 * segmentos separados por travessão (— / –) — o padrão dos títulos automáticos
 * "[CONFERIR] … — CLIENTE — 0000000-00.0000…". Texto descritivo é preservado. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
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

/* ── card PENDENTE (mostra como entrou: prioridade + escalonamento + prazo) ── */
function PendenteCard({ t, mapa, outro }: { t: TarefaCard; mapa: MapaProvidencia | null; outro: Socio | null }) {
  const conf = ehConferencia(t);
  const sent = ehSentinela(t);
  const pk = priKey(t.prioridade);
  return (
    <article className={`tk-card p-${pk}${conf ? " conf" : ""}${sent ? " sent" : ""}${atrasada(t) ? " atrasada" : ""}`}>
      <span className="tk-bar" />
      <div className="tk-in">
        <div className="tk-body">
          <div className="tk-tags">
            <span className={`tk-pri ${pk}`}>{humano(t.prioridade)}</span>
            <PrazoChip data={t.data_limite} />
            {conf && <span className="tk-conf"><Spark c="#fff" />conferência · IA</span>}
            {sent && <span className="tk-conf sentinela"><Spark c="#fff" />silêncio · IA</span>}
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
          {sent && (
            <div className="and-banner sentinela">
              <span className="and-banner-ico">🕒</span>
              <div><b>Sentinela de inércia · {(t.prioridade ?? "media").toUpperCase()}</b> — silêncio anômalo: peticionar andamento ou avaliar status.</div>
            </div>
          )}
          {t.cliente && <div className="tk-cli"><RespAvatar nome={t.responsavel} /><b>{t.cliente}</b></div>}
          {!t.cliente && <div className="tk-cli"><RespAvatar nome={t.responsavel} /><span className="tk-resp-nome">{t.responsavel === "Ambos" ? "A distribuir" : (t.responsavel ?? "sem responsável")}</span></div>}
          {procNum(t) && <div className="tk-num mono">{procNum(t)}</div>}
          {t.processo_id && <div className="tk-caixa-row"><CaixaBtn processoId={t.processo_id} /></div>}
          {conf && t.andamento_id && (
            <Link className="tk-link" href="/andamentos">ver movimentação de origem <Arrow /></Link>
          )}
          {sent && (
            <Link className="tk-link" href="/inercia">ver no radar de inércia <Arrow /></Link>
          )}
        </div>
        <div className="tk-foot">
          {t.responsavel === "Ambos"
            ? <>
                <AcaoBtn run={() => assumirTarefa(t.id)}>Assumir</AcaoBtn>
                <AcaoBtn run={() => reatribuirTarefa(t.id)} className="tk-fbtn sec">Reatribuir</AcaoBtn>
              </>
            : <>
                {outro && t.responsavel !== outro && (
                  <AcaoBtn run={() => reatribuirTarefa(t.id)} className="tk-fbtn sec">Atribuir a {outro}</AcaoBtn>
                )}
                <AcaoBtn run={() => moverTarefa(t.id, "em_andamento")}>Em andamento</AcaoBtn>
              </>}
          {/* Conferência amarrada a movimentação fecha pela porta que também
              registra o que era — dispensa a visita da T4 e ensina o mapa. */}
          {t.andamento_id
            ? <ConcluirConferencia tarefaId={t.id} titulo={t.titulo} temAndamento label={<><Check />Concluir</>} variant="default" />
            : <AcaoBtn run={() => moverTarefa(t.id, "concluida")} className="tk-fbtn concluir"><Check />Concluir</AcaoBtn>}
          <AcaoBtn run={() => moverTarefa(t.id, "cancelada")} className="tk-fbtn cancelar"><X />Cancelar</AcaoBtn>
          {(conf || sent) && (
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

/* ── card EM ANDAMENTO (já atribuído: responsável, prazo, cliente) ────────── */
function AndamentoCard({ t }: { t: TarefaCard }) {
  const pk = priKey(t.prioridade);
  return (
    <article className={`tk-card p-${pk}${atrasada(t) ? " atrasada" : ""}`}>
      <span className="tk-bar" />
      <div className="tk-in">
        <div className="tk-body">
          <div className="tk-tags">
            <span className={`tk-pri ${pk}`}>{humano(t.prioridade)}</span>
            <PrazoChip data={t.data_limite} />
            {t.segredo && <span className="pz-tag segredo">🔒 segredo</span>}
          </div>
          <Link className="tk-title" href={linkPara("tarefa", t.id)} title={t.titulo}>{tituloLimpo(t)}</Link>
          {t.descricao && <div className="tk-desc">{t.descricao}</div>}
          <div className="tk-cli">
            <RespAvatar nome={t.responsavel} />
            {t.cliente ? <b>{t.cliente}</b> : <span className="tk-resp-nome">{t.responsavel ?? "sem responsável"}</span>}
          </div>
          {procNum(t) && <div className="tk-num mono">{procNum(t)}</div>}
          {t.processo_id && <div className="tk-caixa-row"><CaixaBtn processoId={t.processo_id} /></div>}
        </div>
        <div className="tk-foot">
          {t.andamento_id
            ? <ConcluirConferencia tarefaId={t.id} titulo={t.titulo} temAndamento label={<><Check />Concluir</>} variant="default" />
            : <AcaoBtn run={() => moverTarefa(t.id, "concluida")} className="tk-fbtn concluir"><Check />Concluir</AcaoBtn>}
          <AcaoBtn run={() => moverTarefa(t.id, "pendente")} className="tk-fbtn sec">Voltar</AcaoBtn>
          <AcaoBtn run={() => moverTarefa(t.id, "cancelada")} className="tk-fbtn cancelar"><X />Cancelar</AcaoBtn>
        </div>
      </div>
    </article>
  );
}

/* ── card CONCLUÍDA (minimalista) ───────────────────────────────────────── */
function ConcluidaCard({ t }: { t: TarefaCard }) {
  const conf = ehConferencia(t);
  const sent = ehSentinela(t);
  return (
    <article className="tk-card done">
      <div className="tk-body">
        <div className="tk-tags">
          <span className="tk-done"><Check />concluída</span>
          {conf && <span className="tk-conf soft"><Spark />era conferência</span>}
          {sent && <span className="tk-conf soft"><Spark />era inércia</span>}
        </div>
        <Link className="tk-title sm" href={linkPara("tarefa", t.id)} title={t.titulo}>{tituloLimpo(t)}</Link>
        {t.cliente && <div className="tk-cli done"><RespAvatar nome={t.responsavel} /><b>{t.cliente}</b></div>}
        <div className="tk-when mono">
          {t.concluida_em ? <><Check />{fmtDate(t.concluida_em)}</> : (t.data_limite ? fmtDate(t.data_limite) : "concluída")}
        </div>
      </div>
    </article>
  );
}

/* ── faixas por data limite (organização dentro da coluna) ─────────────────── */
type BucketKey = "atras" | "hoje" | "semana" | "depois" | "sem";
const BUCKETS: { key: BucketKey; label: string; tone: string }[] = [
  { key: "atras", label: "Atrasadas", tone: "atras" },
  { key: "hoje", label: "Hoje", tone: "hoje" },
  { key: "semana", label: "Esta semana", tone: "warn" },
  { key: "depois", label: "Depois", tone: "ok" },
  { key: "sem", label: "Sem prazo", tone: "none" },
];
function bucketDe(t: TarefaCard): BucketKey {
  if (!t.data_limite) return "sem";
  const d = diasAte(t.data_limite);
  return d < 0 ? "atras" : d === 0 ? "hoje" : d <= 7 ? "semana" : "depois";
}
function agrupaPorPrazo(itens: TarefaCard[]) {
  const map = new Map<BucketKey, TarefaCard[]>();
  for (const t of itens) {
    const b = bucketDe(t);
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push(t);
  }
  return BUCKETS.filter((b) => map.get(b.key)?.length).map((b) => ({ ...b, itens: map.get(b.key)! }));
}

/* ── coluna do kanban (teto de 10 cards; opcionalmente agrupada por prazo) ── */
const TETO_COLUNA = 10;
function Coluna({ c }: {
  c: { key: string; label: string; dot: string; itens: TarefaCard[]; render: (t: TarefaCard) => ReactNode; extra?: ReactNode; buckets?: boolean };
}) {
  const [aberta, setAberta] = useState(false);
  const total = c.itens.length;
  const excedente = Math.max(0, total - TETO_COLUNA);
  const visiveis = aberta ? c.itens : c.itens.slice(0, TETO_COLUNA);
  const grupos = c.buckets ? agrupaPorPrazo(visiveis) : null;
  return (
    <section className="tk-col" key={c.key}>
      <div className="tk-col-h">
        <span className={`tk-dot ${c.dot}`} />
        <span className="tk-col-t">{c.label}</span>
        <span className="tk-col-n mono">{total}</span>
        {c.extra && <span className="tk-col-end">{c.extra}</span>}
      </div>
      <div className="tk-col-b">
        {total === 0 ? (
          <div className="tk-col-empty">—</div>
        ) : grupos ? (
          grupos.map((g) => (
            <div className="tk-bucket" key={g.key}>
              <div className={`tk-bucket-h ${g.tone}`}>
                <span className="tk-bucket-dot" />{g.label}<span className="tk-bucket-n">{g.itens.length}</span>
              </div>
              {g.itens.map(c.render)}
            </div>
          ))
        ) : (
          visiveis.map(c.render)
        )}
      </div>
      {excedente > 0 && (
        <button type="button" className="tk-col-more" onClick={() => setAberta((v) => !v)}>
          {aberta ? "Ver menos" : `Ver mais (${excedente})`}
        </button>
      )}
    </section>
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
  const [prz, setPrz] = useState("todas");
  const outro = socio ? outroSocio(socio) : null;

  // contadores (sobre o conjunto bruto)
  const abertas = tarefas.filter((t) => t.status !== "concluida" && t.status !== "cancelada");
  const cPend = tarefas.filter((t) => t.status === "pendente").length;
  const cConf = tarefas.filter(ehAutoCowork).length;
  const cDistribuir = abertas.filter((t) => t.responsavel === "Ambos").length;
  // Prazo (sobre tarefas abertas): atrasadas e "no limite" ≤5 dias.
  const cAtrasadas = abertas.filter((t) => prazoClasse(t.data_limite) === "atras").length;
  const cLimite = abertas.filter((t) => {
    const c = prazoClasse(t.data_limite);
    return c === "hoje" || c === "crit" || c === "warn";
  }).length;

  const filtradas = useMemo(() => tarefas.filter((t) => {
    const okAtr =
      atr === "minhas" ? socio != null && t.responsavel === socio
        : atr === "socio" ? outro != null && t.responsavel === outro
          : atr === "distribuir" ? t.responsavel === "Ambos"
            : atr === "conferencias" ? ehAutoCowork(t)
              : true;
    const okPri = pri === "todas" ? true : t.prioridade === pri;
    const cp = prazoClasse(t.data_limite);
    const okPrz =
      prz === "atrasadas" ? cp === "atras"
        : prz === "limite" ? (cp === "hoje" || cp === "crit" || cp === "warn")
          : true;
    return okAtr && okPri && okPrz;
  }), [tarefas, atr, pri, prz, socio, outro]);

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
  const prazosFiltro = [
    { id: "todas", label: "Todo prazo", tone: "" },
    { id: "atrasadas", label: `Atrasadas (${cAtrasadas})`, tone: "red" },
    { id: "limite", label: `No limite · ≤5d (${cLimite})`, tone: "amber" },
  ];

  const pendentes = filtradas.filter((t) => t.status === "pendente");
  const andamento = filtradas.filter((t) => t.status === "em_andamento");
  const concluidas = filtradas
    .filter((t) => t.status === "concluida")
    .sort((a, b) => (b.concluida_em ?? "").localeCompare(a.concluida_em ?? ""));

  const cols: { key: string; label: string; dot: string; itens: TarefaCard[]; render: (t: TarefaCard) => ReactNode; extra?: ReactNode; buckets?: boolean }[] = [
    { key: "pendente", label: "Pendente", dot: "slate", itens: pendentes, buckets: true, render: (t) => <PendenteCard key={t.id} t={t} mapa={mapa} outro={outro} /> },
    { key: "andamento", label: "Em andamento", dot: "blue", itens: andamento, buckets: true, render: (t) => <AndamentoCard key={t.id} t={t} /> },
    { key: "concluida", label: "Concluída", dot: "green", itens: concluidas, render: (t) => <ConcluidaCard key={t.id} t={t} />, extra: <span className="tk-col-hint">recentes</span> },
  ];

  return (
    <div className="pz-page">
      {/* cabeçalho heritage + KPIs (prazo em destaque) */}
      <PageHeader
        breadcrumb={["Trabalho", "Tarefas"]}
        eyebrow="Fluxo de trabalho · conferências da triagem"
        titulo="Tarefas"
        descricao={
          <>
            Vinculáveis a processo e/ou cliente, com prioridade de baixa a urgente. Boa parte nasce sozinha: o
            <b> escalonamento</b> transforma movimentações com consequência em <b>conferências</b> para o Daniel — e cada
            tarefa puxa a peça, o compromisso ou a movimentação de origem.
          </>
        }
        acoes={novaTarefa}
        kpis={[
          { valor: cAtrasadas, label: "atrasadas · fora do prazo", tone: "red" },
          { valor: cLimite, label: "no limite · ≤5 dias", tone: "amber" },
          { valor: cConf, label: "conferências Cowork", tone: "accent" },
          { valor: cPend, label: "pendentes", tone: "neutral" },
        ]}
      />

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
          <span className="tk-chip-sep" aria-hidden />
          {prazosFiltro.map((o) => (
            <button key={o.id} type="button" className={`tk-chip sm${prz === o.id ? " on" : ""}${o.tone ? ` tone-${o.tone}` : ""}`} onClick={() => setPrz(o.id)}>
              {o.label}
            </button>
          ))}
          <span className="tk-filter-count mono">{filtradas.length} no filtro</span>
        </div>
      </div>

      {/* kanban */}
      <div className="tk-board">
        {cols.map((c) => (
          <Coluna key={c.key} c={c} />
        ))}
      </div>
    </div>
  );
}

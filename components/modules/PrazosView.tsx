"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Acao } from "@/components/Acao";
import { CadastrarPrazo } from "@/components/CadastrarPrazo";
import { PageHeader } from "@/components/PageHeader";
import { PromoverOrfao, type ProcLite, type CliLite } from "@/components/PromoverOrfao";
import { validarPrazo, baixarPrazo } from "@/app/actions";
import { linkPara } from "@/lib/links";
import { fmtDate, ddClass, dividirAto, categoriaAto } from "@/lib/format";
import type { PrazoCard, PrazoOrfao } from "@/lib/data";

/* ── glifos (fora do set do Icon.tsx, no estilo da /duplicados) ──────────── */
const Person = ({ c = "var(--muted-2)" }: { c?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
  </svg>
);
const Spark = ({ s = 9 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);
const Check = ({ s = 13, c = "#fff" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);
const CalIco = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
  </svg>
);
const Doc = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h11l5 5v11H4z" /><path d="M8 13h8" /></svg>
);
const Alert = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);
const Chevron = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
);
const Rows = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="1.9" strokeLinecap="round" aria-hidden><path d="M3 7h18M3 12h18M3 17h10" /></svg>
);


const num = (p: { numero_cnj: string | null; numero_registro: string | null }) =>
  p.numero_cnj ?? (p.numero_registro ? `reg ${p.numero_registro}` : null);

/* ── card de prazo provisório (a validar) ───────────────────────────────── */
function ProvisorioCard({ p }: { p: PrazoCard }) {
  const cat = categoriaAto(p.ato);
  const tone = ddClass(p.dias_restantes);
  const { curto, resto } = dividirAto(p.ato);
  return (
    <article className="pz-card prov">
      <span className="pz-stripe accent" />
      <div className="pz-body">
        <div className="pz-tags">
          {cat && <span className={`pz-tag cat-${cat.tone}`}>{cat.label}</span>}
          <span className="pz-tag tang"><span className="d" />provisório · conferir</span>
          <span className="pz-tag cowork"><Spark />cowork</span>
          {p.preso && <span className="pz-tag preso">preso</span>}
          {p.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
        </div>
        <div className="pz-main">
          <div className="pz-lhs">
            <Link className="pz-title" href={linkPara("prazo", p.id)}>{curto}</Link>
            {resto && <div className="pz-detalhe" title={p.ato}>{resto}</div>}
            <div className="pz-cli">
              <Person /><b>{p.clientes || "—"}</b>
              {num(p) && <span className="pz-num mono">{num(p)}</span>}
            </div>
            {p.fundamento && <div className="pz-fund">Fundamento: {p.fundamento}</div>}
          </div>
          <div className="pz-dias">
            <div className={`big ${tone}`}>{p.dias_restantes}<span> dias</span></div>
            <div className="lbl">fatal provisória</div>
          </div>
        </div>
        <div className="pz-dates">
          <div className="d"><span className="k">Disponibilização</span><span className="v mono">{fmtDate(p.data_disponibilizacao)}</span></div>
          <div className="d"><span className="k">Ciência</span><span className="v mono">{fmtDate(p.data_ciencia)}</span></div>
          <div className="d"><span className="k">Data interna</span><span className="v mono">{fmtDate(p.data_interna)}</span></div>
          <div className="d fatal tang"><span className="k">Fatal (provisória)</span><span className="v mono">{fmtDate(p.data_fatal)}</span></div>
        </div>
      </div>
      <div className="pz-foot">
        <div className="grow">
          <Acao
            label={<><Check /> Validar prazo</>}
            titulo="Validar prazo"
            resumo={<>Confirmar a ciência e fixar a fatal de <b>{p.ato}</b> em <b>{fmtDate(p.data_fatal)}</b>. Fica vermelha na /agenda — confira feriados locais e suspensão de expediente.</>}
            acao={validarPrazo.bind(null, p.id)}
            confirmarLabel="Validar fatal"
            variant="primary"
            size="sm"
          />
        </div>
        <Link className="pz-foot-link" href="/agenda"><CalIco />Agenda</Link>
        <Link className="pz-foot-link" href="/producao"><Doc />Criar peça</Link>
      </div>
    </article>
  );
}

/* ── ação de baixa (compartilhada entre layout rico e compacto) ─────────── */
function DarBaixa({ p, label }: { p: PrazoCard; label: React.ReactNode }) {
  return (
    <Acao
      label={label}
      titulo="Dar baixa no prazo"
      resumo={<>Marcar <b>{p.ato}</b> como cumprido (protocolado). Troca de status — nunca apagado. Se houver peça vinculada, ela passa a “protocolada”.</>}
      acao={baixarPrazo.bind(null, p.id)}
      confirmarLabel="Dar baixa"
      variant="default"
      size="sm"
      campoTexto={{ label: "Observação da baixa (opcional)", placeholder: "Ex.: protocolada via PJe em 25/06", multiline: true }}
    />
  );
}

/* ── card validado · layout rico (fatal crítica ≤2d) ────────────────────── */
function ValidadoRico({ p }: { p: PrazoCard }) {
  const cat = categoriaAto(p.ato);
  const tone = ddClass(p.dias_restantes);
  const { curto, resto } = dividirAto(p.ato);
  return (
    <article className={`pz-card val ${tone}`}>
      <span className={`pz-stripe ${tone}`} />
      <div className="pz-body">
        <div className="pz-tags">
          {cat && <span className={`pz-tag cat-${cat.tone}`}>{cat.label}</span>}
          <span className="pz-tag val"><Check s={9} c="var(--green)" />validado{p.responsavel ? ` · ${p.responsavel}` : ""}</span>
          <span className="pz-tag fatal-red"><span className="d" />fatal vermelha</span>
          {p.preso && <span className="pz-tag preso">preso</span>}
          {p.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
        </div>
        <div className="pz-main">
          <div className="pz-lhs">
            <Link className="pz-title" href={linkPara("prazo", p.id)}>{curto}</Link>
            {resto && <div className="pz-detalhe" title={p.ato}>{resto}</div>}
            <div className="pz-cli">
              <Person /><b>{p.clientes || "—"}</b>
              {num(p) && <span className="pz-num mono">{num(p)}</span>}
            </div>
            {p.fundamento && <div className="pz-fund">Fundamento: {p.fundamento}</div>}
          </div>
          <div className="pz-dias">
            <div className={`big ${tone}`}>{p.dias_restantes}<span> dias</span></div>
            <div className="lbl">fatal {fmtDate(p.data_fatal)}</div>
          </div>
        </div>
        <div className="pz-dates">
          <div className="d"><span className="k">Disponibilização</span><span className="v mono">{fmtDate(p.data_disponibilizacao)}</span></div>
          <div className="d"><span className="k">Ciência</span><span className="v mono">{fmtDate(p.data_ciencia)}</span></div>
          <div className="d"><span className="k">Data interna</span><span className="v mono">{fmtDate(p.data_interna)}</span></div>
          <div className="d fatal red"><span className="k">Fatal</span><span className="v mono">{fmtDate(p.data_fatal)}</span></div>
        </div>
      </div>
      <div className="pz-foot">
        <div className="grow"><DarBaixa p={p} label={<><Check c="var(--text)" /> Dar baixa (protocolada)</>} /></div>
        <Link className="pz-foot-link" href="/producao"><Doc />Abrir peça</Link>
        <Link className="pz-foot-link" href="/agenda"><CalIco />Agenda</Link>
      </div>
    </article>
  );
}

/* ── card validado · layout compacto (folga > 2d) ───────────────────────── */
function ValidadoCompacto({ p }: { p: PrazoCard }) {
  const cat = categoriaAto(p.ato);
  const tone = ddClass(p.dias_restantes);
  const { curto, resto } = dividirAto(p.ato);
  return (
    <article className={`pz-card val compact ${tone}`}>
      <span className={`pz-stripe ${tone}`} />
      <div className="pz-row">
        <div className="pz-lhs">
          <div className="pz-tags sm">
            {cat && <span className={`pz-tag cat-${cat.tone}`}>{cat.label}</span>}
            <span className="pz-tag val"><Check s={9} c="var(--green)" />validado</span>
            {p.segredo && <span className="pz-tag segredo">🔒</span>}
          </div>
          <Link className="pz-title sm" href={linkPara("prazo", p.id)}>{curto}</Link>
          {resto && <div className="pz-detalhe" title={p.ato}>{resto}</div>}
          <div className="pz-cli sm">
            <b>{p.clientes || "—"}</b>
            {num(p) && <span className="pz-num mono">{num(p)}</span>}
            {p.fundamento && <span className="dim">· {p.fundamento}</span>}
          </div>
        </div>
        <div className="pz-dias sm">
          <div className={`big ${tone}`}>{p.dias_restantes}<span> dias</span></div>
          <div className="lbl">fatal {fmtDate(p.data_fatal)}{p.data_interna ? ` · interno ${fmtDate(p.data_interna)}` : ""}</div>
        </div>
        <div className="pz-actions">
          <DarBaixa p={p} label="Dar baixa" />
          <Link className="btn sm" href="/agenda"><CalIco />Agenda</Link>
        </div>
      </div>
    </article>
  );
}

/* ── card de prazo órfão (sem processo) ─────────────────────────────────── */
function OrfaoCard({ o, procs, clis }: { o: PrazoOrfao; procs: ProcLite[]; clis: CliLite[] }) {
  const tone = ddClass(o.dias_restantes);
  const { curto, resto } = dividirAto(o.ato);
  return (
    <article className="pz-card orfa">
      <span className="pz-stripe amber" />
      <div className="pz-body">
        <div className="pz-tags">
          <span className="pz-tag orfa"><Alert />órfão · sem processo</span>
          <span className="pz-tag cowork"><Spark />cowork</span>
          <span className="pz-tag tang2">provisório · a validar</span>
        </div>
        <div className="pz-main">
          <div className="pz-lhs">
            <div className="pz-title">{curto}</div>
            {resto && <div className="pz-detalhe" title={o.ato}>{resto}</div>}
            <div className="pz-cli muted">
              <Rows />
              {o.intimacao_id ? <>origem: intimação{o.intimacao_resumo ? <> · {o.intimacao_resumo}</> : null}</> : <>cadastro manual{o.cadastrado_por ? ` · ${o.cadastrado_por}` : ""}</>}
            </div>
            <div className="pz-fund">Fatal preservada mesmo sem processo cadastrado — nenhuma urgência fica invisível.</div>
          </div>
          <div className="pz-dias">
            <div className={`big ${tone}`}>{o.dias_restantes}<span> dias</span></div>
            <div className="lbl">fatal provisória {fmtDate(o.data_fatal)}</div>
          </div>
        </div>
      </div>
      <div className="pz-foot">
        <div className="grow">
          <PromoverOrfao
            p={o}
            procs={procs}
            clis={clis}
            label={<><Chevron /> Promover órfã · vincular processo</>}
            variant="primary"
          />
        </div>
        <Link className="pz-foot-link" href="/triagem">Abrir triagem</Link>
      </div>
    </article>
  );
}

/* ── tela ────────────────────────────────────────────────────────────────── */
type Escopo = "abertos" | "semana";

export function PrazosView({ prazos, orfaos }: { prazos: PrazoCard[]; orfaos: PrazoOrfao[] }) {
  const [procs, setProcs] = useState<ProcLite[]>([]);
  const [clis, setClis] = useState<CliLite[]>([]);
  const [escopo, setEscopo] = useState<Escopo>("abertos");
  const [resp, setResp] = useState("Todos");
  const [soValidar, setSoValidar] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/processos-lite").then((r) => r.json()).then((d) => vivo && setProcs(d.processos ?? [])).catch(() => {});
    fetch("/api/clientes-lite").then((r) => r.json()).then((d) => vivo && setClis(d.clientes ?? [])).catch(() => {});
    return () => { vivo = false; };
  }, []);

  // contadores (sobre o conjunto bruto, antes dos filtros de visualização)
  const fatal2 = prazos.filter((p) => !p.orfao && p.dias_restantes <= 2).length;
  const aValidar = prazos.filter((p) => !p.validado && !p.orfao).length;
  const totalAbertos = prazos.length;

  const passaFiltro = useCallback(
    (dias: number, responsavel: string | null) => {
      if (escopo === "semana" && dias > 7) return false;
      if (resp !== "Todos" && responsavel !== resp) return false;
      return true;
    },
    [escopo, resp],
  );

  const provisorios = useMemo(
    () => prazos.filter((p) => !p.validado && !p.orfao && passaFiltro(p.dias_restantes, p.responsavel)),
    [prazos, passaFiltro],
  );
  const validados = useMemo(
    () => prazos.filter((p) => p.validado && passaFiltro(p.dias_restantes, p.responsavel)),
    [prazos, passaFiltro],
  );
  const orfaosView = useMemo(
    () => orfaos.filter((o) => passaFiltro(o.dias_restantes, o.responsavel)),
    [orfaos, passaFiltro],
  );

  return (
    <div className="pz-page">
      {/* cabeçalho heritage + KPIs */}
      <PageHeader
        breadcrumb={["Trabalho", "Prazos"]}
        eyebrow="Penais · dias corridos · CPP art. 798"
        titulo="Prazos"
        descricao={
          <>
            Contínuos e peremptórios; fatal em fim de semana/feriado prorroga para o próximo dia útil. O prazo da
            automação nasce <b>provisório</b> mas <b>visível na /agenda</b>; vira fatal vermelha só com a validação do Daniel.
          </>
        }
        acoes={<CadastrarPrazo />}
        kpis={[
          { valor: fatal2, label: "fatal em ≤2 dias", tone: "red" },
          { valor: aValidar, label: "a validar · provisórios", tone: "accent" },
          { valor: totalAbertos, label: "abertos no total", tone: "neutral" },
          { valor: orfaos.length, label: "órfãos · sem processo", tone: "amber" },
        ]}
      />

      {/* toolbar */}
      <div className="pz-toolbar">
        <div className="pz-seg">
          <button type="button" className={escopo === "abertos" ? "on" : ""} onClick={() => setEscopo("abertos")}>Abertos</button>
          <button type="button" className={escopo === "semana" ? "on" : ""} onClick={() => setEscopo("semana")}>Esta semana</button>
        </div>
        <label className="pz-select">
          Responsável:
          <select value={resp} onChange={(e) => setResp(e.target.value)}>
            <option value="Todos">Todos</option>
            <option value="Daniel">Daniel</option>
            <option value="Rodolfo">Rodolfo</option>
          </select>
        </label>
        <button type="button" className={`pz-only${soValidar ? " on" : ""}`} onClick={() => setSoValidar((v) => !v)}>
          <Spark />Só a validar
        </button>
        <span className="pz-feriados"><Alert />feriados locais e suspensões: conferir</span>
      </div>

      {/* A VALIDAR · PROVISÓRIOS */}
      <div className="pz-seclabel">
        <span className="t accent">A validar · provisórios</span>
        <span className="pz-pill tang"><span className="d" />provisório · a validar</span>
        <code>vw_pendentes_validacao</code>
      </div>
      {provisorios.length ? (
        provisorios.map((p) => <ProvisorioCard key={p.id} p={p} />)
      ) : (
        <div className="pz-empty">Nenhum provisório aguardando validação neste filtro. 🎉</div>
      )}

      {/* ABERTOS · VALIDADOS */}
      {!soValidar && (
        <>
          <div className="pz-seclabel">
            <span className="t">Abertos · validados</span>
            <span className="pz-pill red"><span className="d" />fatal confirmada</span>
            <code>vw_prazos_abertos</code>
          </div>
          {validados.length ? (
            validados.map((p) =>
              ddClass(p.dias_restantes) === "crit"
                ? <ValidadoRico key={p.id} p={p} />
                : <ValidadoCompacto key={p.id} p={p} />,
            )
          ) : (
            <div className="pz-empty">Nenhum prazo validado neste filtro.</div>
          )}
        </>
      )}

      {/* ÓRFÃOS · SEM PROCESSO */}
      {orfaosView.length > 0 && (
        <>
          <div className="pz-seclabel">
            <span className="t">Órfãos · sem processo</span>
            <span className="dim">validar exige vincular o processo · <code>vw_prazos_orfaos</code></span>
          </div>
          {orfaosView.map((o) => <OrfaoCard key={o.prazo_id} o={o} procs={procs} clis={clis} />)}
        </>
      )}
    </div>
  );
}

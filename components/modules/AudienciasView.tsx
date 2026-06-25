"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Acao } from "@/components/Acao";
import { FormModal } from "@/components/FormModal";
import { CadastrarAudiencia } from "@/components/CadastrarAudiencia";
import { validarAudiencia, redesignarAudiencia, cancelarAudiencia, baixarAudiencia, atualizarAudiencia } from "@/app/actions";
import { AUDIENCIA_TIPO, AUDIENCIA_MODALIDADE, RESPONSAVEIS } from "@/lib/enums";
import { linkPara } from "@/lib/links";
import { fmtTime, humano } from "@/lib/format";
import type { AudienciaCard } from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Person = ({ c = "var(--muted-2)" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" aria-hidden>
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
    <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18" />
  </svg>
);
const Refresh = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8" /><path d="M3 4v4h4" /></svg>
);
const XIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
);
const Pin = ({ c = "var(--muted-2)" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
const Video = ({ c = "var(--blue)" }: { c?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 10l4.5-2.5v9L15 14M3 6h12v12H3z" /></svg>
);
const Building = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /></svg>
);
const Monitor = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 20h8M12 18v2" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
function partesData(iso: string) {
  const d = new Date(iso);
  const dow = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const dia = String(d.getDate()).padStart(2, "0");
  const my = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
  return { dow, dia, my, hora: fmtTime(iso) };
}
const quando = (d: number) => (d < 0 ? "realizada" : d === 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`);

/* Janela de votação (Sugestão 66): início (data_hora) → fim (data_fim).
 * Ex.: "24 – 28 jun" no mesmo mês; "28 jun – 02 jul" cruzando o mês. */
function faixaJanela(ini: string, fim: string) {
  const di = new Date(ini), df = new Date(fim);
  const dia = (d: Date) => String(d.getDate()).padStart(2, "0");
  const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return di.getMonth() === df.getMonth()
    ? `${dia(di)} – ${dia(df)} ${mes(df)}`
    : `${dia(di)} ${mes(di)} – ${dia(df)} ${mes(df)}`;
}

function tipoTone(t: string) {
  if (t === "juri") return "tone-red";
  if (t === "custodia") return "tone-amber";
  if (t === "sessao_julgamento") return "tone-neutral";
  if (t === "instrucao" || t === "interrogatorio") return "tone-blue";
  return "tone-slate";
}

function ModalidadeTag({ m }: { m: string | null }) {
  if (!m) return null;
  if (m === "videoconferencia") return <span className="pz-tag tone-blue"><Video c="var(--blue)" />videoconferência · ao vivo</span>;
  if (m === "virtual") return <span className="pz-tag tone-slate"><Monitor c="var(--brass)" />modalidade virtual</span>;
  if (m === "hibrida") return <span className="pz-tag tone-amber"><Building c="var(--amber)" />híbrida</span>;
  return <span className="pz-tag tone-slate"><Building c="var(--brass)" />presencial</span>;
}

const procNum = (a: AudienciaCard) => a.numero_cnj ?? (a.numero_registro ? `reg ${a.numero_registro}` : null);

function LocalLinha({ a }: { a: AudienciaCard }) {
  const isUrl = a.local_link != null && /^https?:\/\//i.test(a.local_link);
  if ((a.modalidade === "videoconferencia" || a.modalidade === "virtual") && isUrl) {
    return (
      <div className="aud-loc">
        <Video />
        <a className="aud-link" href={a.local_link!} target="_blank" rel="noreferrer">link da sala virtual</a>
      </div>
    );
  }
  return (
    <div className="aud-loc">
      <Pin />
      {a.local_link ? <span>{a.local_link}</span> : <span className="dim">local a confirmar</span>}
    </div>
  );
}

/* ── formulários de ação reutilizados ───────────────────────────────────── */
function Redesignar({ a }: { a: AudienciaCard }) {
  return (
    <FormModal
      label={<><Refresh /> Redesignar</>}
      titulo="Redesignar audiência"
      descricao="Cria uma nova data e marca esta como redesignada — a data anterior fica no histórico. A nova nasce provisória (aguardando validação)."
      acao={redesignarAudiencia.bind(null, a.id)}
      enviarLabel="Redesignar"
      variant="default"
    >
      <div><label>Tipo</label><select name="tipo" defaultValue={a.tipo}>{AUDIENCIA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
      <div><label>Nova data e hora</label><input type="datetime-local" name="data_hora" required /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Modalidade</label><select name="modalidade" defaultValue={a.modalidade ?? "presencial"}>{AUDIENCIA_MODALIDADE.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={a.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div><label>Local / link</label><input name="local_link" placeholder="Sala, endereço ou link da videoconferência" /></div>
      <div><label>Observações</label><textarea name="observacoes" placeholder="Motivo / detalhes da redesignação." /></div>
    </FormModal>
  );
}

function ValidarBtn({ a }: { a: AudienciaCard }) {
  return (
    <Acao
      label={<><Check /> Validar audiência</>}
      variant="primary"
      size="sm"
      titulo="Validar audiência"
      confirmarLabel="Validar"
      resumo={<>Confirmar a audiência de <b>{humano(a.tipo)}</b> e fixar data/local? Cria o evento (cor calma) no Google Calendar — confira a data capturada da pauta.</>}
      acao={validarAudiencia.bind(null, a.id)}
    />
  );
}
function RealizadaBtn({ a }: { a: AudienciaCard }) {
  return (
    <Acao
      label={<><Check c="var(--green)" /> Realizada</>}
      variant="ok"
      size="sm"
      titulo="Dar baixa na audiência"
      confirmarLabel="Marcar realizada"
      resumo={<>Marcar a audiência de <b>{humano(a.tipo)}</b> como <b>realizada</b>? O evento no Calendar é baixado (grafite + ✅) e a realização vira andamento — nunca apagado.</>}
      acao={() => baixarAudiencia(a.id)}
    />
  );
}
function CancelarBtn({ a }: { a: AudienciaCard }) {
  return (
    <Acao
      label={<><XIco /> Cancelar</>}
      variant="danger"
      size="sm"
      titulo="Cancelar audiência"
      confirmarLabel="Cancelar"
      resumo={<>Cancelar a audiência? Não é apagada — muda para <b>cancelada</b> (auditado) e o evento do Calendar é encerrado.</>}
      campoTexto={{ label: "Motivo (opcional)", placeholder: "Ex.: acordo / redesignada." }}
      acao={cancelarAudiencia.bind(null, a.id)}
    />
  );
}

/* ── card de audiência (próxima/confirmada e provisória) ─────────────────── */
function AudienciaCardView({ a, variant, hero = false }: { a: AudienciaCard; variant: "conf" | "prov"; hero?: boolean }) {
  const { dow, dia, my, hora } = partesData(a.data_hora);
  const titulo = a.observacoes?.trim() || humano(a.tipo);
  const mostrarTipoTag = Boolean(a.observacoes?.trim());
  return (
    <article className={`aud-card ${variant}`}>
      <span className={`aud-stripe ${variant === "prov" ? "accent" : "blue"}`} />
      <div className="aud-grid">
        <div className={`aud-date ${variant}`}>
          <div className="dow">{dow}</div>
          <div className={`day${hero ? " hero" : ""}`}>{dia}</div>
          <div className="my">{my}</div>
          <div className={`time ${variant}`}>{hora}</div>
          <div className={`when ${variant}`}>{variant === "prov" ? "provisória" : quando(a.dias_ate)}</div>
        </div>
        <div className="aud-body">
          <div className="pz-tags">
            {mostrarTipoTag && <span className={`pz-tag ${tipoTone(a.tipo)}`}>{humano(a.tipo)}</span>}
            <ModalidadeTag m={a.modalidade} />
            {variant === "conf"
              ? <span className="pz-tag val"><Check s={9} c="var(--green)" />validado · designada</span>
              : <><span className="pz-tag tang"><span className="d" />provisória · conferir</span><span className="pz-tag cowork"><Spark />cowork</span></>}
            {a.preso && <span className="pz-tag preso">preso</span>}
            {a.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
          </div>

          <Link className="aud-title" href={linkPara("audiencia", a.id)}>{titulo}</Link>

          <div className="pz-cli">
            <Person /><b>{a.clientes || "Sem cliente identificado"}</b>
            {procNum(a) && <span className="pz-num mono">{procNum(a)}</span>}
          </div>

          <LocalLinha a={a} />

          <div className="aud-foot">
            {variant === "conf"
              ? <span className="aud-resp">Responsável <b>{a.responsavel ?? "—"}</b> · lembrete no Calendar</span>
              : <span className="aud-resp dim">Confira data e local antes de validar</span>}
            {variant === "prov" && <ValidarBtn a={a} />}
            {variant === "conf" && <RealizadaBtn a={a} />}
            <Redesignar a={a} />
            {variant === "conf" && <CancelarBtn a={a} />}
            <Link className="btn sm" href="/agenda"><CalIco />Calendar</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── card de sessão de julgamento virtual (sem placar — não factível) ────── */
function VirtualCard({ a }: { a: AudienciaCard }) {
  const { dia, my, hora } = partesData(a.data_hora);
  const titulo = a.observacoes?.trim() || humano(a.tipo);
  return (
    <article className="aud-card virtual">
      <span className="aud-stripe slate" />
      <div className="aud-vbody">
        <div className="pz-tags">
          <span className="pz-tag tone-neutral">sessão de julgamento</span>
          <span className="pz-tag tone-slate"><Monitor c="var(--brass)" />modalidade virtual</span>
          {a.validado
            ? <span className="pz-tag val"><Check s={9} c="var(--green)" />validado</span>
            : <span className="pz-tag tang"><span className="d" />provisória · conferir</span>}
          <span className="aud-vnote">sem sessão ao vivo · sem sustentação oral</span>
        </div>
        <div className="aud-vmain">
          <div className="aud-vlhs">
            <Link className="aud-title" href={linkPara("audiencia", a.id)}>{titulo}</Link>
            <div className="pz-cli">
              <Person /><b>{a.clientes || "Sem cliente identificado"}</b>
              {procNum(a) && <span className="pz-num mono">{procNum(a)}</span>}
            </div>
          </div>
          <div className="aud-vwhen">
            {a.data_fim
              ? <><div className="d mono">{faixaJanela(a.data_hora, a.data_fim)}</div><div className="k">janela de votação</div></>
              : <><div className="d mono">{dia} {my} · {hora}</div><div className="k">pauta virtual</div></>}
          </div>
        </div>
        <div className="aud-foot">
          <span className="aud-resp">Acompanhar o placar pelo portal — não há comparecimento. O resultado vira <span className="mono">andamento</span> ao fim da janela.</span>
          <AlterarModalidade a={a} />
          <Link className="btn sm" href={linkPara("audiencia", a.id)}>Acompanhar pauta</Link>
          <Link className="btn sm" href="/agenda"><CalIco />Calendar</Link>
        </div>
      </div>
    </article>
  );
}

/* Alterar modalidade/status — frequentemente a sessão "virtual" passa a
 * presencial/videoconferência. Usa atualizarAudiencia (tipo+data obrigatórios). */
function AlterarModalidade({ a }: { a: AudienciaCard }) {
  return (
    <FormModal
      label={<><Monitor c="currentColor" /> Alterar modalidade</>}
      titulo="Alterar modalidade / tipo"
      descricao="Reclassifica a sessão — ex.: de pauta virtual para presencial ou videoconferência (com sustentação ao vivo). Se validada, o evento do Calendar é re-sincronizado."
      acao={atualizarAudiencia.bind(null, a.id)}
      enviarLabel="Salvar"
      variant="default"
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Modalidade</label><select name="modalidade" defaultValue={a.modalidade ?? "virtual"}>{AUDIENCIA_MODALIDADE.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
        <div><label>Tipo</label><select name="tipo" defaultValue={a.tipo}>{AUDIENCIA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Início {/* início da sessão / janela */}</label><input type="datetime-local" name="data_hora" required defaultValue={a.data_hora?.slice(0, 16)} /></div>
        <div><label>Fim da janela (virtual)</label><input type="datetime-local" name="data_fim" defaultValue={a.data_fim?.slice(0, 16) ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Responsável</label><select name="responsavel" defaultValue={a.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
        <div><label>Local / link</label><input name="local_link" defaultValue={a.local_link ?? ""} placeholder="Sala, endereço ou link" /></div>
      </div>
      <div><label>Observações</label><textarea name="observacoes" defaultValue={a.observacoes ?? ""} placeholder="Anotações sobre a sessão." /></div>
      <p className="sub" style={{ margin: 0 }}>Virtual = votos eletrônicos numa janela, sem sustentação. Videoconferência = sessão ao vivo, com sustentação oral.</p>
    </FormModal>
  );
}

/* ── linha de realizada/redesignada/cancelada ───────────────────────────── */
function RealizadaRow({ a }: { a: AudienciaCard }) {
  const { dia, my } = partesData(a.data_hora);
  const ico = a.status === "realizada"
    ? <span className="ic green"><Check s={15} c="var(--green)" /></span>
    : a.status === "cancelada"
      ? <span className="ic red"><XIco c="var(--red)" /></span>
      : <span className="ic amber"><Refresh c="var(--amber)" /></span>;
  const tagTone = a.status === "realizada" ? "tone-green" : a.status === "cancelada" ? "tone-red" : "tone-amber";
  return (
    <div className="aud-rz-row">
      {ico}
      <div className="mid">
        <div className="top">
          <b>{a.observacoes?.trim() || humano(a.tipo)}</b>
          <span className={`pz-tag ${tagTone}`}>{humano(a.status)}</span>
          {a.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
        </div>
        <div className="sub"><b>{a.clientes || "—"}</b>{procNum(a) ? <span className="mono"> · {procNum(a)}</span> : null}</div>
      </div>
      <span className="when mono">{dia} {my} · {fmtTime(a.data_hora)}</span>
    </div>
  );
}

/* ── tela ────────────────────────────────────────────────────────────────── */
type Escopo = "designadas" | "realizadas" | "semana";
const REALIZADAS_LOTE = 5;

export function AudienciasView({ audiencias }: { audiencias: AudienciaCard[] }) {
  const [escopo, setEscopo] = useState<Escopo>("designadas");
  const [resp, setResp] = useState("Todos");
  const [soValidar, setSoValidar] = useState(false);
  const [verRealizadas, setVerRealizadas] = useState(false);

  const passaResp = useCallback((r: string | null) => resp === "Todos" || r === resp, [resp]);

  // contadores (sobre o conjunto bruto)
  const desig = audiencias.filter((a) => a.status === "designada");
  const cAmanha = desig.filter((a) => a.dias_ate === 1).length;
  const cValidar = desig.filter((a) => !a.validado && a.dias_ate >= 0).length;
  const cProx7 = desig.filter((a) => a.validado && a.dias_ate >= 0 && a.dias_ate <= 7).length;
  const cVirtual = desig.filter((a) => a.modalidade === "virtual").length;

  const upcoming = useMemo(
    () => audiencias.filter((a) => a.status === "designada" && a.dias_ate >= 0 && passaResp(a.responsavel) && (escopo !== "semana" || a.dias_ate <= 7)),
    [audiencias, escopo, passaResp],
  );
  const virtuais = upcoming.filter((a) => a.modalidade === "virtual");
  const naoVirtual = upcoming.filter((a) => a.modalidade !== "virtual");
  const provisorias = naoVirtual.filter((a) => !a.validado);
  const confirmadas = naoVirtual.filter((a) => a.validado);
  const hero = confirmadas[0] ?? null;
  const outras = confirmadas.slice(1);

  const realizadas = useMemo(
    () => audiencias.filter((a) => ["realizada", "redesignada", "cancelada"].includes(a.status) && passaResp(a.responsavel)),
    [audiencias, passaResp],
  );
  const realizadasView = verRealizadas || escopo === "realizadas" ? realizadas : realizadas.slice(0, REALIZADAS_LOTE);

  const verRealizadasMode = escopo === "realizadas";
  const verDesignadas = !verRealizadasMode && !soValidar;

  return (
    <div className="pz-page">
      {/* cabeçalho */}
      <div className="pz-head">
        <div className="lhs">
          <div className="eyebrow">Designadas no Calendar · provisórias até validar</div>
          <h1>Audiências</h1>
          <p>
            Instrução, custódia, júri e sessões de julgamento. A captura cria a audiência <b>provisória</b> e visível no
            Calendar; a validação do Daniel confirma data e local. Sessão <b>virtual</b> dos tribunais superiores ≠ videoconferência.
          </p>
        </div>
        <CadastrarAudiencia />
      </div>

      {/* contadores */}
      <div className="pz-counters">
        <div className="pz-counter blue"><div className="big">{cAmanha}</div><div className="lbl">amanhã</div></div>
        <div className="pz-counter accent"><div className="big">{cValidar}</div><div className="lbl">a validar · provisórias</div></div>
        <div className="pz-counter"><div className="big">{cProx7}</div><div className="lbl">designadas · próx. 7 dias</div></div>
        <div className="pz-counter"><div className="big slate">{cVirtual}</div><div className="lbl">sessão virtual em curso</div></div>
      </div>

      {/* toolbar */}
      <div className="pz-toolbar">
        <div className="pz-seg">
          <button type="button" className={escopo === "designadas" ? "on" : ""} onClick={() => setEscopo("designadas")}>Designadas</button>
          <button type="button" className={escopo === "realizadas" ? "on" : ""} onClick={() => setEscopo("realizadas")}>Realizadas</button>
          <button type="button" className={escopo === "semana" ? "on" : ""} onClick={() => setEscopo("semana")}>Esta semana</button>
        </div>
        <label className="pz-select">
          Responsável:
          <select value={resp} onChange={(e) => setResp(e.target.value)}>
            <option value="Todos">Todos</option>
            {RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <button type="button" className={`pz-only${soValidar ? " on" : ""}`} onClick={() => setSoValidar((v) => !v)}>
          <Spark />Só a validar
        </button>
        <span className="pz-feriados" style={{ fontFamily: "var(--mono)" }}>vw_agenda_semana</span>
      </div>

      {/* PRÓXIMA AUDIÊNCIA (hero) */}
      {verDesignadas && hero && (
        <>
          <div className="pz-seclabel"><span className="t">Próxima audiência</span></div>
          <AudienciaCardView a={hero} variant="conf" hero />
          {outras.map((a) => <AudienciaCardView key={a.id} a={a} variant="conf" />)}
        </>
      )}

      {/* A VALIDAR · PROVISÓRIAS */}
      {!verRealizadasMode && (
        <>
          <div className="pz-seclabel">
            <span className="t accent">A validar · provisórias</span>
            <span className="pz-pill tang"><span className="d" />Tangerina no Calendar</span>
            <code>vw_pendentes_validacao</code>
          </div>
          {provisorias.length ? (
            provisorias.map((a) => <AudienciaCardView key={a.id} a={a} variant="prov" />)
          ) : (
            <div className="pz-empty">Nenhuma audiência provisória aguardando validação. 🎉</div>
          )}
        </>
      )}

      {/* SESSÃO DE JULGAMENTO VIRTUAL */}
      {verDesignadas && virtuais.length > 0 && (
        <>
          <div className="pz-seclabel">
            <span className="t">Sessão de julgamento virtual</span>
            <span className="dim">tribunais superiores · votos eletrônicos numa janela de dias</span>
          </div>
          {virtuais.map((a) => <VirtualCard key={a.id} a={a} />)}
        </>
      )}

      {/* REALIZADAS RECENTES */}
      {!soValidar && realizadas.length > 0 && (
        <>
          <div className="pz-seclabel">
            <span className="t">{verRealizadasMode ? "Realizadas · redesignadas · canceladas" : "Realizadas recentes"}</span>
          </div>
          <article className="aud-card aud-rz">
            {realizadasView.map((a) => <RealizadaRow key={a.id} a={a} />)}
          </article>
          {!verRealizadasMode && !verRealizadas && realizadas.length > REALIZADAS_LOTE && (
            <button type="button" className="pz-empty" style={{ cursor: "pointer" }} onClick={() => setVerRealizadas(true)}>
              Ver todas as {realizadas.length} encerradas
            </button>
          )}
        </>
      )}
    </div>
  );
}

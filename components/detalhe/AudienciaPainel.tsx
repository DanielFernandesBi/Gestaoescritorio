"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProcRef } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import {
  atualizarAudiencia,
  redesignarAudiencia,
  baixarAudiencia,
  cancelarAudiencia,
  validarAudiencia,
  definirModalidadeAudiencia,
  criarAnotacao,
  editarAnotacao,
  excluirAnotacao,
} from "@/app/actions";
import { AUDIENCIA_TIPO, AUDIENCIA_MODALIDADE, RESPONSAVEIS } from "@/lib/enums";
import { linkPara } from "@/lib/links";
import { fmtDate, humano } from "@/lib/format";
import type { Audiencia, AudienciaCard, Anotacao } from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Spark = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);
const Check = ({ s = 14, c = "#fff" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);
const Pin = ({ c = "var(--slate)" }: { c?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>
);
const CalIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
);
const Bolt = ({ c = "var(--slate)" }: { c?: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
);
const CheckBox = ({ c = "var(--slate)" }: { c?: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
);
const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const NoteIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);

/* ── helpers de data ─────────────────────────────────────────────────────── */
const horaBr = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
};
const diaMes = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const semanaLonga = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "long" });

function tipoTone(t: string) {
  if (t === "juri") return "tone-red";
  if (t === "custodia") return "tone-amber";
  if (t === "sessao_julgamento") return "tone-neutral";
  if (t === "instrucao" || t === "interrogatorio") return "tone-blue";
  return "tone-slate";
}
const tituloDe = (a: { nome?: string | null; observacoes: string | null; tipo: string }) =>
  a.nome?.trim() || a.observacoes?.trim() || humano(a.tipo);
const procNum = (a: { numero_cnj: string | null; numero_registro: string | null }) =>
  a.numero_cnj ?? (a.numero_registro ? `reg ${a.numero_registro}` : null);

/* ── master: card da lista ───────────────────────────────────────────────── */
function MasterCard({ a, ativo }: { a: AudienciaCard; ativo: boolean }) {
  const provis = a.status === "designada" && !a.validado;
  return (
    <Link className={`audp-mcard${ativo ? " on" : ""}`} href={linkPara("audiencia", a.id)}>
      {ativo && <span className="audp-mstripe" />}
      <span className={`audp-mdot ${tipoTone(a.tipo)}${provis ? " prov" : ""}`} />
      <span className="audp-mtitle" title={tituloDe(a)}>{tituloDe(a)}</span>
      <span className="audp-mwhen">{diaMes(a.data_hora)}</span>
    </Link>
  );
}

/* ── detalhe: card de modalidade (identificada pela IA) ──────────────────── */
function ModalidadeIA({ aud }: { aud: Audiencia }) {
  const router = useRouter();
  const [pend, start] = useTransition();
  const atual = aud.modalidade ?? "presencial";
  const trocar = (m: string) => {
    if (m === atual || pend) return;
    start(async () => {
      await definirModalidadeAudiencia(aud.id, m);
      router.refresh();
    });
  };
  return (
    <div className="audp-ia">
      <div className="audp-ia-h"><Spark /><span>Modalidade · identificada pela IA</span></div>
      <div className="audp-ia-btns">
        {AUDIENCIA_MODALIDADE.map((m) => (
          <button key={m} type="button" disabled={pend} onClick={() => trocar(m)} className={`audp-modbtn${m === atual ? " on" : ""}`}>
            {humano(m)}{m === atual ? " ✓" : ""}
          </button>
        ))}
      </div>
      <div className="audp-ia-note">
        <b>Atenção à distinção (Sug. 39):</b> <b className="accent">virtual</b> = julgamento dos tribunais
        superiores por lista de votos eletrônicos ao longo de uma janela de dias, <b>sem sessão ao vivo e sem
        sustentação</b>. Não confundir com <b>videoconferência</b> — sessão telepresencial ao vivo, com sustentação oral.
      </div>
    </div>
  );
}

/* ── detalhe: vínculo de local ───────────────────────────────────────────── */
function LocalCard({ aud }: { aud: Audiencia }) {
  const isUrl = aud.local_link != null && /^https?:\/\//i.test(aud.local_link);
  return (
    <div className="audp-local">
      <Pin />
      <div>
        <div className="t">
          {aud.local_link
            ? (isUrl
              ? <a className="proc-link" href={aud.local_link} target="_blank" rel="noreferrer">link da sala virtual</a>
              : aud.local_link)
            : "Local a confirmar"}
        </div>
        {!aud.validado && <div className="w">⚠ Data capturada da pauta — conferir designação oficial</div>}
      </div>
    </div>
  );
}

/* ── detalhe: clientes clicáveis ─────────────────────────────────────────── */
function ClientesLink({ aud }: { aud: Audiencia }) {
  if (aud.segredo) return <b className="audp-cli">Processo em segredo de justiça</b>;
  if (!aud.partes.length) return <b className="audp-cli">Sem cliente identificado</b>;
  return (
    <span className="audp-cli">
      {aud.partes.map((p, i) => (
        <span key={p.id}>
          {i > 0 && ", "}
          <Link className="proc-link" href={linkPara("cliente", p.id)}>{p.nome}</Link>
        </span>
      ))}
    </span>
  );
}

/* ── formulário "Editar audiência" (tema da tela) ────────────────────────── */
function EditarAudiencia({ aud }: { aud: Audiencia }) {
  return (
    <FormModal
      label={<><PenIco /> Editar audiência</>}
      titulo="Editar audiência"
      descricao="Ajuste qualquer dado da audiência. Se já validada, o evento no Google Calendar é re-sincronizado."
      acao={atualizarAudiencia.bind(null, aud.id)}
      enviarLabel="Salvar"
      variant="default"
    >
      <div><label>Nome da sessão</label><input name="nome" defaultValue={aud.nome ?? ""} placeholder="Ex.: Sessão plenária do júri" /></div>
      <div><label>Tipo</label><select name="tipo" defaultValue={aud.tipo}>{AUDIENCIA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Data e hora</label><input type="datetime-local" name="data_hora" required defaultValue={aud.data_hora?.slice(0, 16)} /></div>
        <div><label>Fim da janela (virtual)</label><input type="datetime-local" name="data_fim" defaultValue={aud.data_fim?.slice(0, 16) ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Modalidade</label><select name="modalidade" defaultValue={aud.modalidade ?? "presencial"}>{AUDIENCIA_MODALIDADE.map((m) => <option key={m} value={m}>{humano(m)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={aud.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div><label>Local / link</label><input name="local_link" defaultValue={aud.local_link ?? ""} placeholder="Sala, endereço ou link da videoconferência" /></div>
      <div><label>Observações</label><textarea name="observacoes" defaultValue={aud.observacoes ?? ""} placeholder="Anotações sobre a sessão." /></div>
    </FormModal>
  );
}

/* ── anotações: card individual (editar / apagar) ────────────────────────── */
function AnotacaoCard({ nota }: { nota: Anotacao }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota.texto);
  const [pend, start] = useTransition();

  const salvar = () => {
    const t = texto.trim();
    if (!t) return;
    const fd = new FormData();
    fd.set("texto", t);
    start(async () => {
      const r = await editarAnotacao(nota.id, fd);
      if (r.ok) { setEditando(false); router.refresh(); }
    });
  };
  const apagar = () => {
    start(async () => {
      const r = await excluirAnotacao(nota.id);
      if (r.ok) router.refresh();
    });
  };

  const quando = fmtDate(nota.criado_em);
  const editado = nota.atualizado_em && nota.atualizado_em !== nota.criado_em;

  return (
    <div className="audp-nota">
      {editando ? (
        <>
          <textarea className="audp-nota-ta" value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} />
          <div className="audp-nota-actions">
            <button type="button" className="btn ghost sm" onClick={() => { setEditando(false); setTexto(nota.texto); }} disabled={pend}>Cancelar</button>
            <button type="button" className="btn primary sm" onClick={salvar} disabled={pend || !texto.trim()}>{pend ? "Salvando…" : "Salvar"}</button>
          </div>
        </>
      ) : (
        <>
          <div className="audp-nota-txt">{nota.texto}</div>
          <div className="audp-nota-foot">
            <span className="audp-nota-meta">{nota.autor} · {quando}{editado ? " · editada" : ""}</span>
            <span className="audp-nota-btns">
              <button type="button" className="audp-iconbtn" onClick={() => setEditando(true)} disabled={pend} title="Editar"><PenIco /></button>
              <button type="button" className="audp-iconbtn danger" onClick={apagar} disabled={pend} title="Apagar">✕</button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* ── anotações: seção (adicionar + lista) ────────────────────────────────── */
function Anotacoes({ aud, notas }: { aud: Audiencia; notas: Anotacao[] }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [pend, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const adicionar = () => {
    const t = texto.trim();
    if (!t) return;
    const fd = new FormData();
    fd.set("texto", t);
    start(async () => {
      const r = await criarAnotacao("audiencia", aud.id, fd);
      if (r.ok) { setTexto(""); setErro(null); router.refresh(); }
      else setErro(r.message);
    });
  };

  return (
    <div className="audp-notas">
      <div className="audp-novanota">
        <textarea
          className="audp-nota-ta"
          placeholder="Escreva uma anotação para controle próprio…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
        />
        <div className="audp-nota-actions">
          {erro && <span className="audp-nota-err">{erro}</span>}
          <button type="button" className="btn primary sm" onClick={adicionar} disabled={pend || !texto.trim()}>
            {pend ? "Salvando…" : "Salvar anotação"}
          </button>
        </div>
      </div>
      {notas.length === 0
        ? <div className="audp-empty">Nenhuma anotação ainda. Cada anotação salva vira um card independente.</div>
        : notas.map((n) => <AnotacaoCard key={n.id} nota={n} />)}
    </div>
  );
}

/* ── seção rotulada ──────────────────────────────────────────────────────── */
function Sec({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="audp-sec">
      <div className="audp-sech">{titulo}{extra}</div>
      {children}
    </div>
  );
}

/* ── componente principal ────────────────────────────────────────────────── */
export function AudienciaPainel({ aud, lista, anotacoes }: { aud: Audiencia; lista: AudienciaCard[]; anotacoes: Anotacao[] }) {
  const [filtro, setFiltro] = useState<"designadas" | "validar">("designadas");
  const [verNotas, setVerNotas] = useState(false);

  const designadas = lista.filter((a) => a.status === "designada");
  const aValidar = designadas.filter((a) => !a.validado);
  const visiveis = filtro === "validar" ? aValidar : designadas;

  const provis = !aud.validado && aud.status === "designada";
  const ativa = aud.status === "designada";

  return (
    <div className="audp">
      {/* MASTER */}
      <aside className="audp-master">
        <div className="audp-master-h">
          <h1>Audiências</h1>
          <div className="audp-filtros">
            <button type="button" className={`audp-chip ink${filtro === "designadas" ? " on" : ""}`} onClick={() => setFiltro("designadas")}>
              Designadas ({designadas.length})
            </button>
            <button type="button" className={`audp-chip tang${filtro === "validar" ? " on" : ""}`} onClick={() => setFiltro("validar")}>
              a validar ({aValidar.length})
            </button>
          </div>
        </div>
        <div className="audp-master-list">
          {visiveis.length === 0
            ? <div className="audp-empty">Nada por aqui.</div>
            : visiveis.map((a) => <MasterCard key={a.id} a={a} ativo={a.id === aud.id} />)}
        </div>
      </aside>

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/audiencias">← Audiências</Link>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* título */}
            <div className="audp-title-row">
              <div className="audp-title-l">
                <div className="audp-tags">
                  <span className={`pz-tag ${tipoTone(aud.tipo)}`}>{humano(aud.tipo)}</span>
                  <span className="pz-tag tone-slate">{humano(aud.modalidade)}</span>
                  {provis
                    ? <span className="pz-tag tang"><span className="d" />provisória · conferir</span>
                    : aud.validado
                      ? <span className="pz-tag val"><Check s={9} c="var(--green)" />validada</span>
                      : <span className="pz-tag tone-neutral">{humano(aud.status)}</span>}
                  {aud.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
                </div>
                <h2 className="audp-h2">{tituloDe(aud)}</h2>
                <div className="audp-cliline">
                  <ClientesLink aud={aud} />
                  {procNum(aud) && <ProcRef cnj={aud.numero_cnj} registro={aud.numero_registro} id={aud.processo_id} />}
                </div>
              </div>
              <div className="audp-datecard">
                <div className="d">{diaMes(aud.data_hora)}</div>
                <div className="s">{semanaLonga(aud.data_hora)} · {horaBr(aud.data_hora)}</div>
              </div>
            </div>

            {aud.data_anterior && (
              <div className="audp-redes">
                Audiência <b>redesignada</b>. Data anterior: <b>{fmtDate(aud.data_anterior)}</b>.
              </div>
            )}

            <ModalidadeIA aud={aud} />

            {/* dados */}
            <Sec titulo="Dados da audiência">
              <div className="audp-dados">
                <div className="fld"><div className="k">Tipo</div><div className="v">{humano(aud.tipo)}</div></div>
                <div className="fld"><div className="k">Modalidade</div><div className="v">{humano(aud.modalidade)}</div></div>
                <div className="fld"><div className="k">Data e hora</div><div className="v mono">{diaMes(aud.data_hora)} · {horaBr(aud.data_hora)}</div></div>
                <div className="fld"><div className="k">Status</div><div className="v">{humano(aud.status)}</div></div>
                <div className="fld"><div className="k">Validado</div><div className="v" style={{ color: aud.validado ? "var(--green)" : "var(--tang)", fontWeight: 600 }}>{aud.validado ? "validada" : "false · provisória"}</div></div>
                <div className="fld"><div className="k">Responsável</div><div className="v">{aud.responsavel ?? "—"}</div></div>
              </div>
            </Sec>

            {/* local */}
            <Sec titulo="Local · vínculo">
              <LocalCard aud={aud} />
            </Sec>

            {/* ao realizar */}
            <Sec titulo="Ao realizar">
              <div className="audp-realizar">
                <div className="row"><Bolt /><div>Gera <b>andamento</b> no processo (registro do ato realizado)</div></div>
                <div className="row"><CheckBox /><div>Pode abrir <b>tarefa</b> de acompanhamento (ex.: prazo de memoriais)</div></div>
                <div className="note">Aparece em <span className="mono">vw_agenda_semana</span> (próximos 7 dias). Calendar tangerina → cor calma ao validar.</div>
              </div>
            </Sec>

            {/* calendar */}
            <Sec titulo="Google Calendar">
              <div className="audp-cal">
                <div className="audp-cal-row">
                  <span className="audp-cal-chip"><span className="sw tang" /><b style={{ color: "var(--tang)" }}>Tangerina</b> — provisória</span>
                  <span className="audp-cal-arrow">→</span>
                  <span className="audp-cal-chip"><span className="sw green" /><b style={{ color: "var(--green)" }}>Cor calma</b> — após validar</span>
                </div>
                <div className="audp-cal-note">Evento na data e hora da sessão. Validar recolore para cor calma e remove o prefixo provisório — eventos são reescritos, nunca apagados nem movidos.</div>
              </div>
            </Sec>

            {/* andamento gerado */}
            <Sec titulo="Andamento gerado" extra={<span className="audp-count">0</span>}>
              <div className="audp-empty">A sessão ainda não foi realizada — nenhum andamento gerado.</div>
            </Sec>

            {/* EDITAR + ANOTAÇÕES (antes do status) */}
            <div className="audp-sec">
              <div className="audp-toolrow">
                <EditarAudiencia aud={aud} />
                <button type="button" className={`btn default${verNotas ? " on" : ""}`} onClick={() => setVerNotas((v) => !v)}>
                  <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
                </button>
              </div>
              {verNotas && <Anotacoes aud={aud} notas={anotacoes} />}
            </div>

            {/* STATUS */}
            <div className="audp-status">
              <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Status</div>
              {ativa && (
                <FormModal
                  label="Redesignar"
                  titulo="Redesignar audiência"
                  descricao="Cria uma nova data e marca esta como redesignada — a data anterior fica no histórico. A nova nasce provisória."
                  acao={redesignarAudiencia.bind(null, aud.id)}
                  enviarLabel="Redesignar"
                  variant="default"
                >
                  <div><label>Tipo</label><select name="tipo" defaultValue={aud.tipo}>{AUDIENCIA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
                  <div><label>Nova data e hora</label><input type="datetime-local" name="data_hora" required /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label>Modalidade</label><select name="modalidade" defaultValue={aud.modalidade ?? "presencial"}>{AUDIENCIA_MODALIDADE.map((m) => <option key={m} value={m}>{humano(m)}</option>)}</select></div>
                    <div><label>Responsável</label><select name="responsavel" defaultValue={aud.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                  </div>
                  <div><label>Local / link</label><input name="local_link" placeholder="Sala, endereço ou link da videoconferência" /></div>
                  <div><label>Observações</label><textarea name="observacoes" placeholder="Motivo / detalhes da redesignação." /></div>
                </FormModal>
              )}
              {ativa && (
                <Acao
                  label="Cancelar"
                  variant="danger"
                  titulo="Cancelar audiência"
                  confirmarLabel="Cancelar"
                  resumo={<>Cancelar a audiência? Não é apagada — muda para <b>cancelada</b> (auditado) e o evento do Calendar é encerrado.</>}
                  campoTexto={{ label: "Motivo (opcional)", placeholder: "Ex.: acordo / redesignada." }}
                  acao={cancelarAudiencia.bind(null, aud.id)}
                />
              )}
            </div>
            <div className="audp-status-note">Redesignar / cancelar é troca de status (designada / realizada / redesignada / cancelada) — nunca DELETE. Tudo auditado.</div>
          </div>
        </div>

        {/* action bar */}
        <div className="audp-actionbar">
          {provis && (
            <Acao
              label={<><Check /> Validar audiência</>}
              variant="primary"
              size="md"
              titulo="Validar audiência"
              confirmarLabel="Validar"
              resumo={<>Confirmar a audiência de <b>{humano(aud.tipo)}</b> e fixar data/local? Cria o evento (cor calma) no Google Calendar — confira a data capturada da pauta.</>}
              acao={validarAudiencia.bind(null, aud.id)}
            />
          )}
          {ativa && (
            <Acao
              label={<><Check c="var(--green)" /> Marcar realizada</>}
              variant="ok"
              size="md"
              titulo="Dar baixa na audiência"
              confirmarLabel="Marcar realizada"
              resumo={<>Marcar a audiência de <b>{humano(aud.tipo)}</b> como <b>realizada</b>? O evento no Calendar é baixado (grafite + ✅) e a realização vira andamento — nunca apagado.</>}
              acao={() => baixarAudiencia(aud.id)}
            />
          )}
          <Link className="btn default" href="/agenda"><CalIco /> Calendar</Link>
        </div>
      </section>
    </div>
  );
}

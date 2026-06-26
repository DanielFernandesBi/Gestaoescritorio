"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ProcRef } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { atualizarPrazo, validarPrazo, baixarPrazo, prejudicarPrazo, criarPeca } from "@/app/actions";
import { TIPO_CONTAGEM, RESPONSAVEIS, PECA_TIPO, PRIORIDADES } from "@/lib/enums";
import { linkPara } from "@/lib/links";
import { fmtDate, humano, dividirAto, categoriaAto } from "@/lib/format";
import type { PrazoFull, PrazoCard, Anotacao } from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Spark = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);
const Check = ({ s = 14, c = "#fff" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);
const CalIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
);
const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const NoteIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);
const FileIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h11l5 5v11H4z" /><path d="M8 13h8" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const emNd = (d: number) => (d < 0 ? `−${Math.abs(d)} d` : d === 0 ? "hoje" : `em ${d} d`);
// Tom por urgência: vencido/≤2 → vermelho, ≤5 → âmbar, senão tangerina (atenção calma).
const urg = (d: number): "red" | "amber" | "tang" => (d <= 2 ? "red" : d <= 5 ? "amber" : "tang");
const ehCowork = (s: string | null) => s != null && /cowork|chat/i.test(s);
const contagemLabel = (t: string | null) => (t === "uteis" ? "úteis" : "corridos");

/* ── master: card da lista ───────────────────────────────────────────────── */
function MasterCard({ p, ativo }: { p: PrazoCard; ativo: boolean }) {
  const provis = !p.validado;
  const tone = urg(p.dias_restantes);
  return (
    <Link className={`przp-mcard tone-${tone}${ativo ? " on" : ""}`} href={linkPara("prazo", p.id)}>
      <div className="przp-mtop">
        <span className="przp-mtitle" title={p.ato}>{dividirAto(p.ato).curto}</span>
        {provis && <span className="przp-mconf">conferir</span>}
      </div>
      <div className={`przp-mwhen tone-${tone}`}>fatal {ddmm(p.data_fatal)} · {emNd(p.dias_restantes)}</div>
    </Link>
  );
}

/* ── clientes clicáveis ──────────────────────────────────────────────────── */
function ClientesLink({ p }: { p: PrazoFull }) {
  if (p.segredo) return <b className="audp-cli">Processo em segredo de justiça</b>;
  if (p.orfao) return <b className="audp-cli">Prazo órfão · sem processo</b>;
  if (!p.partes.length) return <b className="audp-cli">{p.clientes || "Sem cliente identificado"}</b>;
  return (
    <span className="audp-cli">
      {p.partes.map((c, i) => (
        <span key={c.id}>
          {i > 0 && ", "}
          <Link className="proc-link" href={linkPara("cliente", c.id)}>{c.nome}</Link>
        </span>
      ))}
    </span>
  );
}

/* ── editar prazo (tema da tela) ─────────────────────────────────────────── */
function EditarPrazo({ p }: { p: PrazoFull }) {
  return (
    <FormModal
      label={<><PenIco /> Editar prazo</>}
      titulo="Editar prazo"
      descricao="Recalcule a contagem, ajuste a data interna ou troque o responsável. Se já validado, o marcador fatal no Calendar é re-sincronizado."
      acao={atualizarPrazo.bind(null, p.id)}
      enviarLabel="Salvar"
      variant="default"
    >
      <div><label>Ato</label><input name="ato" required defaultValue={p.ato} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div><label>Data início</label><input type="date" name="data_inicio" defaultValue={p.data_inicio?.slice(0, 10) ?? ""} /></div>
        <div><label>Dias</label><input type="number" name="dias" min={0} defaultValue={p.dias ?? ""} /></div>
        <div><label>Contagem</label><select name="tipo_contagem" defaultValue={p.tipo_contagem ?? "corridos"}>{TIPO_CONTAGEM.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Data interna</label><input type="date" name="data_interna" defaultValue={p.data_interna?.slice(0, 10) ?? ""} /></div>
        <div><label>Data fatal</label><input type="date" name="data_fatal" required defaultValue={p.data_fatal?.slice(0, 10)} /></div>
      </div>
      <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
    </FormModal>
  );
}

/* ── criar peça herdeira (herda a contagem) ──────────────────────────────── */
function CriarPecaBtn({ p, label, variant = "default" }: { p: PrazoFull; label: ReactNode; variant?: "default" | "primary" }) {
  const dataAlvo = (p.data_interna ?? p.data_fatal)?.slice(0, 10);
  return (
    <FormModal
      label={label}
      titulo="Nova peça (herda a contagem)"
      descricao="Abre uma peça no backlog já ligada a este prazo e processo — herda data interna/fatal e o semáforo de dias corridos."
      acao={criarPeca}
      enviarLabel="Criar peça"
      variant={variant}
    >
      <input type="hidden" name="processo_id" defaultValue={p.processo_id ?? ""} />
      <input type="hidden" name="prazo_id" defaultValue={p.id} />
      <div><label>Título</label><input name="titulo" required defaultValue={p.ato} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Tipo</label><select name="tipo" defaultValue="recurso">{PECA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Prioridade</label><select name="prioridade" defaultValue="alta">{PRIORIDADES.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
        <div><label>Data alvo</label><input type="date" name="data_alvo" defaultValue={dataAlvo} /></div>
      </div>
      <div><label>Descrição</label><textarea name="descricao" placeholder="Tese / observações." /></div>
    </FormModal>
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
/* ── índice (lista compacta) — reusado no drawer e na tela raiz /prazos ── */
export function PrazoMaster({ lista, activeId }: { lista: PrazoCard[]; activeId?: string }) {
  const [filtro, setFiltro] = useState<"abertos" | "conferir">("abertos");
  const abertos = lista; // getPrazosPainel já traz só status='aberto'
  const aConferir = abertos.filter((x) => !x.validado);
  const visiveis = filtro === "conferir" ? aConferir : abertos;
  return (
    <aside className="audp-master">
      <div className="audp-master-h">
        <h1>Prazos</h1>
        <div className="audp-filtros">
          <button type="button" className={`audp-chip ink${filtro === "abertos" ? " on" : ""}`} onClick={() => setFiltro("abertos")}>Abertos ({abertos.length})</button>
          <button type="button" className={`audp-chip tang${filtro === "conferir" ? " on" : ""}`} onClick={() => setFiltro("conferir")}>a conferir ({aConferir.length})</button>
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

export function PrazoPainel({ p, lista, anotacoes }: { p: PrazoFull; lista: PrazoCard[]; anotacoes: Anotacao[] }) {
  const [verNotas, setVerNotas] = useState(false);

  const tone = urg(p.dias_restantes);
  const ativo = p.status === "aberto";

  return (
    <div className="audp">
      {/* MASTER — índice compartilhado (mesma row da tela raiz /prazos) */}
      <PrazoMaster lista={lista} activeId={p.id} />

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/prazos">← Prazos</Link>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* título */}
            <div className="audp-title-row">
              <div className="audp-title-l">
                <div className="audp-tags">
                  {(() => { const c = categoriaAto(p.ato); return c
                    ? <span className={`pz-tag cat-${c.tone}`}>{c.label}</span>
                    : p.area ? <span className="pz-tag tone-blue">{humano(p.area)}</span> : null; })()}
                  {p.validado
                    ? <span className="pz-tag val"><Check s={9} c="var(--green)" />validado</span>
                    : <span className="pz-tag tang"><span className="d" />provisório · conferir</span>}
                  {ehCowork(p.cadastrado_por) && <span className="pz-tag cowork"><Spark s={9} />cowork</span>}
                  {p.orfao && <span className="pz-tag orfa">órfão</span>}
                  {p.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
                </div>
                <h2 className="audp-h2">{dividirAto(p.ato).curto}</h2>
                <div className="audp-cliline">
                  <ClientesLink p={p} />
                  {(p.numero_cnj || p.numero_registro) && <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} id={p.processo_id} />}
                </div>
              </div>
              <div className={`przp-datecard tone-${tone}`}>
                <div className="d">{p.dias_restantes < 0 ? `${Math.abs(p.dias_restantes)} d` : `${p.dias_restantes} d`}</div>
                <div className="s">fatal {ddmm(p.data_fatal)}</div>
              </div>
            </div>

            {/* CONTAGEM · IA */}
            <div className="audp-ia">
              <div className="audp-ia-h"><Spark /><span>Contagem · penal · CPP art. 798</span></div>
              <div className="przp-timeline">
                <div className="step"><div className="dt mono">{ddmm(p.data_inicio)}</div><div className="lb">início · ciência</div></div>
                <div className="arr mono">+{p.dias ?? "—"} {contagemLabel(p.tipo_contagem)} →</div>
                <div className="step"><div className="dt mono amber">{ddmm(p.data_interna)}</div><div className="lb">interna</div></div>
                <div className="arr mono">→</div>
                <div className="step"><div className="dt mono tang">{ddmm(p.data_fatal)}</div><div className="lb tang">FATAL</div></div>
              </div>
              <div className="audp-ia-note">
                Dias <b>{contagemLabel(p.tipo_contagem)}</b> (contínuos e peremptórios): exclui o dia do começo, inclui o do
                vencimento. Se a fatal cair em sábado, domingo ou feriado, <b>prorroga</b> para o próximo dia útil.{" "}
                <span className="amber" style={{ fontWeight: 600 }}>⚠ Conferir feriado local e suspensão de expediente</span> — pode mover a fatal.
              </div>
            </div>

            {/* DADOS */}
            <Sec titulo="Dados do prazo">
              <div className="audp-dados">
                <div className="fld"><div className="k">Ato</div><div className="v" style={{ fontWeight: 600 }}>{p.ato}</div></div>
                <div className="fld"><div className="k">Tipo de contagem</div><div className="v">{humano(p.tipo_contagem)}</div></div>
                <div className="fld"><div className="k">Data início</div><div className="v mono">{fmtDate(p.data_inicio)}</div></div>
                <div className="fld"><div className="k">Dias</div><div className="v mono">{p.dias ?? "—"}</div></div>
                <div className="fld"><div className="k">Data interna</div><div className="v mono" style={{ color: "var(--amber)" }}>{fmtDate(p.data_interna)}</div></div>
                <div className="fld"><div className="k">Data fatal</div><div className="v mono" style={{ color: "var(--tang)", fontWeight: 600 }}>{fmtDate(p.data_fatal)}</div></div>
                <div className="fld"><div className="k">Status</div><div className="v">{humano(p.status)}</div></div>
                <div className="fld"><div className="k">Validado</div><div className="v" style={{ color: p.validado ? "var(--green)" : "var(--tang)", fontWeight: 600 }}>{p.validado ? "validado" : "false · provisório"}</div></div>
                <div className="fld"><div className="k">Responsável</div><div className="v">{p.responsavel ?? "—"}{p.cadastrado_por ? ` · cadastrado por ${p.cadastrado_por}` : ""}</div></div>
              </div>
            </Sec>

            {/* ORIGEM E HERANÇA */}
            <Sec titulo="Origem e herança">
              <div className="przp-stack">
                {p.intimacao_id ? (
                  <div className="przp-origem">
                    <span className="pz-tag tone-blue">intimação</span>
                    <div className="mid">
                      <div className="t">{p.intimacao_resumo?.trim() || "Intimação de origem"}</div>
                      <div className="s">ciência {ddmm(p.intimacao_ciencia)}{p.intimacao_origem ? ` · ${p.intimacao_origem.toUpperCase()}` : ""}</div>
                    </div>
                    <Link className="btn sm abrir" href={linkPara("intimacao", p.intimacao_id)}>Abrir</Link>
                  </div>
                ) : (
                  <div className="audp-empty">Prazo sem intimação de origem vinculada.</div>
                )}
                <div className="przp-note">
                  <b className="accent">Herança →</b> a <b>peça</b> vinculada herda a <span className="mono">data_interna</span>/<span className="mono">data_fatal</span> e o
                  semáforo de dias corridos. Na <b>baixa</b> (protocolo), o prazo vira <span className="mono">cumprido</span> + registra <span className="mono">peticao_protocolada</span> como andamento.
                </div>
              </div>
            </Sec>

            {/* GOOGLE CALENDAR */}
            <Sec titulo="Google Calendar">
              <div className="audp-cal">
                <div className="audp-cal-row">
                  <span className="audp-cal-chip"><span className="sw tang" /><b style={{ color: "var(--tang)" }}>Tangerina</b> — provisório</span>
                  <span className="audp-cal-arrow">→</span>
                  <span className="audp-cal-chip"><span className="sw red" /><b style={{ color: "var(--red)" }}>Vermelho</b> — fatal, após validar</span>
                </div>
                <div className="audp-cal-note">Evento de dia inteiro na data interna, título <span className="mono">[PROVISÓRIO – CONFERIR]</span>. Validar recolore para cor calma, remove o prefixo e cria o marcador vermelho da fatal. Na baixa, vira grafite — eventos são reescritos, nunca apagados.</div>
              </div>
            </Sec>

            {/* PEÇA HERDEIRA */}
            <Sec titulo="Peça herdeira" extra={<span className="audp-count">{p.pecas_count}</span>}>
              {p.pecas_count > 0 ? (
                <div className="przp-origem">
                  <span className="pz-tag cowork"><FileIco c="var(--accent)" /></span>
                  <div className="mid"><div className="t">{p.pecas_count} peça(s) criada(s) a partir deste prazo</div><div className="s">acompanhe no kanban de produção</div></div>
                  <Link className="btn sm" href="/producao">Ver na Produção</Link>
                </div>
              ) : (
                <div className="przp-empty-row">
                  <span>Nenhuma peça criada a partir deste prazo.</span>
                  {p.processo_id && <CriarPecaBtn p={p} label={<><FileIco /> Criar peça · herda a contagem</>} />}
                </div>
              )}
            </Sec>

            {/* EDITAR + ANOTAÇÕES */}
            <div className="audp-sec">
              <div className="audp-toolrow">
                <EditarPrazo p={p} />
                <button type="button" className={`btn default${verNotas ? " on" : ""}`} onClick={() => setVerNotas((v) => !v)}>
                  <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
                </button>
              </div>
              {verNotas && <Anotacoes entidadeTipo="prazo" entidadeId={p.id} notas={anotacoes} />}
            </div>

            {/* BAIXA */}
            <div className="audp-status">
              <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Baixa</div>
              {ativo && (
                <Acao
                  label={<><Check s={13} c="var(--green)" /> Dar baixa · protocolado</>}
                  variant="ok"
                  titulo="Dar baixa no prazo"
                  confirmarLabel="Dar baixa"
                  resumo={<>Marcar <b>{p.ato}</b> como <b>cumprido</b> (hoje) e registrar <span className="mono">peticao_protocolada</span> como andamento? Peças vinculadas são movidas para protocolada.</>}
                  campoTexto={{ label: "Andamento (opcional)", placeholder: "Ex.: Protocoladas as razões de apelação.", multiline: true }}
                  acao={(t) => baixarPrazo(p.id, t)}
                />
              )}
              {ativo && (
                <Acao
                  label="Prejudicado"
                  variant="danger"
                  titulo="Marcar prazo como prejudicado"
                  confirmarLabel="Prejudicado"
                  resumo={<>Marcar <b>{p.ato}</b> como <b>prejudicado</b> (perdeu o objeto)? Não é apagado — troca de status, auditado.</>}
                  campoTexto={{ label: "Motivo (opcional)", placeholder: "Ex.: recurso da parte contrária inadmitido." }}
                  acao={(t) => prejudicarPrazo(p.id, t)}
                />
              )}
            </div>
            <div className="audp-status-note">Baixa é troca de status (cumprido / prejudicado / cancelado) — nunca DELETE. O sistema nunca protocola: a baixa reflete o que Daniel já fez.</div>
          </div>
        </div>

        {/* action bar */}
        <div className="audp-actionbar">
          {!p.validado && !p.orfao && (
            <Acao
              label={<><Check /> Validar prazo</>}
              variant="primary"
              size="md"
              titulo="Validar prazo"
              confirmarLabel="Validar"
              resumo={<>Marcar <b>{p.ato}</b> como validado e criar o marcador fatal (vermelho) no Google Calendar? Confira a contagem e o feriado local antes.</>}
              acao={() => validarPrazo(p.id)}
            />
          )}
          {p.orfao && <span className="przp-orfa-aviso">⚠ Prazo órfão — promova na <Link className="proc-link" href="/triagem">triagem</Link> antes de validar.</span>}
          {p.processo_id && <CriarPecaBtn p={p} label={<><FileIco /> Criar peça</>} />}
          <Link className="btn default" href="/agenda"><CalIco /> Calendar</Link>
        </div>
      </section>
    </div>
  );
}

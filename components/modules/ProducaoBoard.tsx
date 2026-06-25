"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDrawer } from "@/components/Drawer";
import { Pill, SegredoTag } from "@/components/ui";
import { Acao } from "@/components/Acao";
import { FormModal } from "@/components/FormModal";
import {
  criarPeca,
  moverPeca,
  atualizarPeca,
  validarPeca,
  validarMinuta,
  atribuirPeca,
  anexarInsumoPeca,
  vincularPrazoIntimacao,
  assumirPeca,
  reatribuirPeca,
  reanalisarPecas,
} from "@/app/actions";
import { PECA_TIPO, PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";
import { fmtDate, ddClass, humano } from "@/lib/format";
import type { Peca } from "@/lib/data";

type Socio = "Daniel" | "Rodolfo";
const oUtroSocio = (s: Socio): Socio => (s === "Daniel" ? "Rodolfo" : "Daniel");

type ProcLite = { id: string; label: string };
type CliLite = { id: string; nome: string };
type Lite = { id: string; label: string };

// Ordem natural do pipeline: aguardar insumos → redigir → revisar → pronta.
// (Em revisão a peça já está pronta para conferência; faltando insumo ainda não.)
const COLS: { key: string; label: string; dot: string }[] = [
  { key: "a_fazer", label: "A fazer", dot: "slate" },
  { key: "em_elaboracao", label: "Em elaboração", dot: "blue" },
  { key: "aguardando_insumo", label: "Aguardando insumo", dot: "amber" },
  { key: "em_revisao", label: "Em revisão", dot: "accent" },
  { key: "pronta", label: "Pronta", dot: "green" },
];

const priTone = (p: string | null): "red" | "amber" | "gray" =>
  p === "urgente" ? "red" : p === "alta" ? "amber" : "gray";

const ehIA = (p: Peca) => p.cadastro_automatico;
// Tom da etiqueta de categoria pelo tipo da peça.
function tipoTone(t: string): string {
  if (t === "recurso") return "tone-blue";
  if (t === "defesa" || t === "memorial") return "tone-slate";
  return "tone-neutral";
}
function catLabel(p: Peca): string {
  return p.subtipo ? `${humano(p.tipo)} · ${p.subtipo}` : humano(p.tipo);
}
const procNumPeca = (p: Peca) => p.numero_cnj ?? (p.numero_registro ? `reg ${p.numero_registro}` : (p.processo_id ? null : "sem processo · caso novo"));
// Link de download .docx do Drive (Google Docs export; cai no download direto).
const docxHref = (id: string) => `https://docs.google.com/document/d/${id}/export?format=docx`;

/* ── glifos ──────────────────────────────────────────────────────────────── */
const SPARK = <svg width="11" height="11" viewBox="0 0 24 24" style={{ fill: "currentColor" }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>;
const Person = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="1.9" strokeLinecap="round" aria-hidden><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>;
const Clock = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>;
const Check = ({ c = "var(--green)" }: { c?: string }) => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>;
const FileGlyph = ({ c = "#fff" }: { c?: string }) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
const Alert = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>;

/* Semáforo de dias da peça (chip colorido). */
function PrazoChip({ p }: { p: Peca }) {
  if (p.dias_restantes == null) {
    if (p.prioridade === "urgente") return <span className="pc-chip red">⚡ urgente</span>;
    return null;
  }
  return <span className={`pc-chip ${ddClass(p.dias_restantes)}`}><Clock />{p.dias_restantes} dias</span>;
}
// Texto do prazo: interno (do prazo) / alvo (data própria), indicando a natureza.
function prazoMeta(p: Peca): string {
  if (p.prazo_id) return `interno ${fmtDate(p.data_interna)} · do prazo`;
  if (p.data_efetiva) return `alvo ${fmtDate(p.data_efetiva)}`;
  return p.responsavel ?? "";
}

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as const;

/** Rótulo do processo da peça (CNJ, registro do tribunal, ou inicial sem processo). */
function pecaProcLabel(p: Peca): string {
  if (p.numero_cnj) return p.numero_cnj;
  if (p.numero_registro) return "reg " + p.numero_registro;
  return p.processo_id ? "—" : "inicial — sem processo";
}

/**
 * Link clicável para a minuta no Drive (Sugestão 46 — fiação do redator
 * agendado/Sug. 42). `stop` evita abrir o drawer do card ao clicar no link.
 */
function MinutaLink({ id, stop = false }: { id: string; stop?: boolean }) {
  return (
    <a
      className="link"
      href={`https://drive.google.com/file/d/${id}/view`}
      target="_blank"
      rel="noreferrer"
      onClick={stop ? (e) => e.stopPropagation() : undefined}
    >
      📄 abrir minuta
    </a>
  );
}

/* ---- Lite lists (seletores) ------------------------------------------- */

function useLites() {
  const [procs, setProcs] = useState<ProcLite[]>([]);
  const [clis, setClis] = useState<CliLite[]>([]);
  const [prazos, setPrazos] = useState<Lite[]>([]);
  const [intims, setIntims] = useState<Lite[]>([]);
  useEffect(() => {
    let vivo = true;
    fetch("/api/processos-lite").then((r) => r.json()).then((d) => vivo && setProcs(d.processos ?? [])).catch(() => {});
    fetch("/api/clientes-lite").then((r) => r.json()).then((d) => vivo && setClis(d.clientes ?? [])).catch(() => {});
    fetch("/api/prazos-lite").then((r) => r.json()).then((d) => vivo && setPrazos(d.prazos ?? [])).catch(() => {});
    fetch("/api/intimacoes-lite").then((r) => r.json()).then((d) => vivo && setIntims(d.intimacoes ?? [])).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return { procs, clis, prazos, intims };
}

/* ---- Campos do formulário (criar/editar) ------------------------------ */

function CamposBasicos({ p }: { p?: Peca }) {
  const editar = Boolean(p);
  return (
    <>
      <div><label>Título</label><input name="titulo" required defaultValue={p?.titulo ?? ""} placeholder="Ex.: Apelação — Fulano de Tal" /></div>
      <div style={grid2}>
        <div><label>Tipo</label><select name="tipo" defaultValue={p?.tipo ?? "manifestacao"}>{PECA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Subtipo</label><input name="subtipo" defaultValue={p?.subtipo ?? ""} placeholder="apelação, RESE, HC, alegações finais…" /></div>
      </div>
      <div style={grid2}>
        <div><label>Prioridade</label><select name="prioridade" defaultValue={p?.prioridade ?? "media"}>{PRIORIDADES.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={p?.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div style={grid2}>
        <div><label>Data alvo (opcional)</label><input type="date" name="data_alvo" />{editar && <span className="sub">Em branco mantém a atual.</span>}</div>
        <div><label>Drive (id da minuta)</label><input name="drive_file_id" defaultValue={p?.drive_file_id ?? ""} placeholder="opcional" /></div>
      </div>
      <div><label>Descrição</label><textarea name="descricao" defaultValue={p?.descricao ?? ""} placeholder="Detalhes da peça…" /></div>
      <div>
        <label>Anotações (o que observar ao redigir)</label>
        <textarea name="observacoes" defaultValue={p?.observacoes ?? ""} placeholder="Teses, pontos de atenção, instruções para quem for fazer a peça…" />
      </div>
    </>
  );
}

/* ---- Botão "Nova peça" (page-head) ------------------------------------ */

export function NovaPeca() {
  const { procs, clis, prazos, intims } = useLites();
  return (
    <FormModal
      label={<>+ Nova peça</>}
      titulo="Nova peça"
      descricao="Pode nascer SEM processo (inicial de caso novo). Criada manualmente nasce validada."
      acao={criarPeca}
      enviarLabel="Criar peça"
    >
      <CamposBasicos />
      <h4 style={{ margin: "12px 0 2px", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--brass)" }}>Vínculos (todos opcionais)</h4>
      <div style={grid2}>
        <div>
          <label>Cliente</label>
          <select name="cliente_id" defaultValue="">
            <option value="">— nenhum —</option>
            {clis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label>Processo</label>
          <select name="processo_id" defaultValue="">
            <option value="">— nenhum (inicial de caso novo) —</option>
            {procs.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label>Prazo vinculado</label>
        <select name="prazo_id" defaultValue="">
          <option value="">— nenhum —</option>
          {prazos.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <div>
        <label>Intimação de origem</label>
        <select name="intimacao_id" defaultValue="">
          <option value="">— nenhuma —</option>
          {intims.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <p className="sub" style={{ margin: 0 }}>O prazo vinculado herda o semáforo de dias corridos; na baixa do prazo a peça vai para “protocolada” automaticamente.</p>
    </FormModal>
  );
}

/**
 * Sugestão 48 — botão "Reanalisar insumos da fila". Marca as peças pendentes
 * (a_fazer/aguardando_insumo) para o gate v2 reavaliar no próximo ciclo do
 * redator agendado. O frontend não roda as skills; só dispara o reexame.
 * `processoId` opcional restringe o escopo a um processo (atalho contextual).
 */
export function ReanalisarFila({ processoId, label }: { processoId?: string; label?: ReactNode }) {
  return (
    <Acao
      label={label ?? <>↻ Reanalisar insumos da fila</>}
      variant="default"
      titulo="Reanalisar insumos da fila"
      confirmarLabel="Marcar para reanálise"
      resumo={
        <>
          Marcar as peças pendentes {processoId ? "deste processo " : ""}(a fazer / aguardando insumo)
          para o <b>redator agendado</b> reavaliar os insumos no próximo ciclo. Quem chegou íntegro
          vira <b>minuta</b> (alta); o que faltar volta para <b>aguardando insumo</b> com a pendência
          atualizada. O sistema <b>nunca</b> redige às cegas nem protocola — a minuta nasce para revisão.
        </>
      }
      acao={() => reanalisarPecas(processoId ?? null)}
    />
  );
}

/* ---- Botões do rodapé do cartão -------------------------------------- */

// Botão de uma ação (move/valida) com refresh. O rodapé já bloqueia a abertura
// do drawer (stopPropagation no contêiner), então aqui não precisa.
function OneClick({ run, children, className = "pc-fbtn" }: { run: () => Promise<{ ok: boolean }>; children: ReactNode; className?: string }) {
  const router = useRouter();
  const [pend, setPend] = useState(false);
  return (
    <button type="button" className={className} disabled={pend} onClick={async () => { setPend(true); const r = await run(); setPend(false); if (r.ok) router.refresh(); }}>
      {pend ? "…" : children}
    </button>
  );
}

// "Atribuir advogado" (coluna A fazer) — escolhe o responsável, sem mover de coluna.
function AtribuirAdvogado({ p }: { p: Peca }) {
  return (
    <FormModal label="Atribuir advogado" titulo="Atribuir advogado" descricao="Define quem vai redigir a peça (não move de coluna)." acao={atribuirPeca.bind(null, p.id)} enviarLabel="Atribuir" variant="default">
      <div>
        <label>Responsável</label>
        <select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
      </div>
    </FormModal>
  );
}

// "Anexar insumo" (coluna Aguardando insumo) — registra o link do Drive + nota e
// marca para reanálise. O arquivo é salvo no Drive pelo usuário, na pasta do caso.
function AnexarInsumo({ p }: { p: Peca }) {
  return (
    <FormModal label="Anexar insumo" titulo="Anexar insumo da peça" descricao="Registra o insumo que faltava e marca a peça para o redator agendado reavaliar." acao={anexarInsumoPeca.bind(null, p.id)} enviarLabel="Anexar e reanalisar" variant="default">
      {p.gate_pendencia && (
        <div className="banner" style={{ margin: "0 0 12px" }}><span className="ico">⏳</span><div><b>Falta:</b> {p.gate_pendencia}</div></div>
      )}
      <div><label>Link do insumo no Drive</label><input name="link" placeholder="https://drive.google.com/…" /></div>
      <div><label>Nota (opcional)</label><textarea name="nota" placeholder="Ex.: acórdão condenatório (inteiro teor) anexado." /></div>
      <p className="sub" style={{ margin: 0 }}>Salve o documento no Drive em <span className="mono">/sistema/clientes/{p.cliente ?? "<cliente>"}/peças</span>. (Um seletor visual do Drive entra numa próxima etapa.)</p>
    </FormModal>
  );
}

/* ---- Board ------------------------------------------------------------ */

export function ProducaoBoard({
  pecas,
  protocoladas = [],
  socio = null,
}: {
  pecas: Peca[];
  protocoladas?: Peca[];
  socio?: Socio | null;
}) {
  const { open } = useDrawer();
  const router = useRouter();
  const params = useSearchParams();
  const { prazos, intims } = useLites();
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("todas");
  const [soIA, setSoIA] = useState(false);
  const [verProto, setVerProto] = useState(4);
  const autoAbertoRef = useRef(false);

  // Filtro por responsável (atribuição entre os sócios) + "Só minutas IA".
  const outro = socio ? oUtroSocio(socio) : null;
  const pecasFiltradas = pecas.filter((p) => {
    const okAtr =
      filtro === "minhas" ? socio != null && p.responsavel === socio
        : filtro === "socio" ? outro != null && p.responsavel === outro
          : filtro === "distribuir" ? p.responsavel === "Ambos"
            : true;
    return okAtr && (!soIA || ehIA(p));
  });
  const nMinhas = socio ? pecas.filter((p) => p.responsavel === socio).length : 0;
  const nSocio = outro ? pecas.filter((p) => p.responsavel === outro).length : 0;
  const nDistribuir = pecas.filter((p) => p.responsavel === "Ambos").length;
  const nIA = pecas.filter(ehIA).length;
  const filtros = [
    { id: "todas", label: `Todas (${pecas.length})` },
    ...(socio ? [{ id: "minhas", label: `Minhas (${nMinhas})` }] : []),
    ...(outro ? [{ id: "socio", label: `${outro} (${nSocio})` }] : []),
    { id: "distribuir", label: `A distribuir (${nDistribuir})` },
  ];

  // Deep-link ?peca=<id> (vindo do dedup de "Criar petição pendente"): destaca/abre a peça.
  useEffect(() => {
    if (autoAbertoRef.current) return;
    const id = params.get("peca");
    if (!id) return;
    const p = pecas.find((x) => x.id === id) ?? protocoladas.find((x) => x.id === id);
    if (p) {
      autoAbertoRef.current = true;
      abrir(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pecas, protocoladas]);

  function onDragStart(e: DragEvent, p: Peca) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: p.id, status: p.status }));
    e.dataTransfer.effectAllowed = "move";
  }
  async function onDrop(e: DragEvent, colKey: string) {
    e.preventDefault();
    setDragCol(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const { id, status } = JSON.parse(raw) as { id: string; status: string };
      if (!id || status === colKey) return;
      const r = await moverPeca(id, colKey);
      if (r.ok) router.refresh();
    } catch {
      /* payload inválido — ignora */
    }
  }

  function abrir(p: Peca) {
    const provisorio = p.cadastro_automatico && !p.validado;
    open({
      title: (
        <>
          <h2>{p.titulo}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill tone="blue" dot={false}>{humano(p.tipo)}{p.subtipo ? ` · ${p.subtipo}` : ""}</Pill>
            <Pill tone={priTone(p.prioridade)}>{humano(p.prioridade)}</Pill>
            <SegredoTag on={p.segredo} />
            {provisorio && <span className="gate wait">⏳ PROVISÓRIO – conferir</span>}
          </div>
        </>
      ),
      body: (
        <>
          {provisorio && (
            <div className="banner" style={{ margin: "0 0 18px" }}>
              <span className="ico">⚠</span>
              <div><b>Peça provisória (cadastro automático).</b> Nasceu da triagem (validado=false). Confira e valide — mesma doutrina do gate dos prazos.</div>
            </div>
          )}
          <div className="dsec">
            <h4>Dados</h4>
            <div className="dgrid">
              <div className="field"><div className="k">Status</div><div className="v">{humano(p.status)}</div></div>
              <div className="field"><div className="k">Responsável</div><div className="v">{p.responsavel ?? "—"}</div></div>
              <div className="field"><div className="k">Cliente</div><div className="v">{p.cliente ?? "—"}</div></div>
              <div className="field"><div className="k">Processo</div><div className="v mono">{pecaProcLabel(p)}</div></div>
              {p.status === "protocolada" ? (
                <div className="field"><div className="k">Protocolada em</div><div className="v mono">{fmtDate(p.protocolada_em)}</div></div>
              ) : (
                <div className="field"><div className="k">Data efetiva</div><div className="v mono">{fmtDate(p.data_efetiva)}</div></div>
              )}
              <div className="field"><div className="k">Minuta (Drive)</div><div className="v">{p.drive_file_id ? <MinutaLink id={p.drive_file_id} /> : "—"}</div></div>
            </div>
          </div>

          {(p.gate_resultado || p.gate_pendencia || p.gate_analisado_em || p.status === "aguardando_insumo") && (
            <div className="dsec">
              <h4>Análise do redator (gate)</h4>
              {(p.status === "aguardando_insumo" || p.gate_resultado === "baixa") && p.gate_pendencia && (
                <div className="banner" style={{ margin: "0 0 12px" }}>
                  <span className="ico">⏳</span>
                  <div><b>Aguardando insumo.</b> {p.gate_pendencia}</div>
                </div>
              )}
              <div className="dgrid">
                <div className="field">
                  <div className="k">Resultado</div>
                  <div className="v">
                    {p.gate_resultado
                      ? <Pill tone={p.gate_resultado === "alta" ? "green" : "amber"} dot={false}>{p.gate_resultado === "alta" ? "alta — redigir" : "baixa — aguardando insumo"}</Pill>
                      : "ainda não analisada"}
                  </div>
                </div>
                <div className="field"><div className="k">Analisado em</div><div className="v mono">{p.gate_analisado_em ? fmtDate(p.gate_analisado_em) : "—"}</div></div>
              </div>
              {p.processo_id && (
                <div className="acoes" style={{ marginTop: 10 }}>
                  <ReanalisarFila processoId={p.processo_id} label={<>↻ Reanalisar peças deste processo</>} />
                </div>
              )}
            </div>
          )}

          {(p.descricao || p.observacoes) && (
            <div className="dsec">
              {p.descricao && (
                <>
                  <h4>Descrição</h4>
                  <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap" }}>{p.descricao}</p>
                </>
              )}
              {p.observacoes && (
                <div className="banner" style={{ margin: p.descricao ? "12px 0 0" : 0 }}>
                  <span className="ico">📝</span>
                  <div><b>Anotações — observar ao redigir:</b><br /><span style={{ whiteSpace: "pre-wrap" }}>{p.observacoes}</span></div>
                </div>
              )}
            </div>
          )}

          {socio && (
            <div className="dsec">
              <h4>Atribuição</h4>
              <div className="acoes">
                {p.responsavel !== socio && (
                  <Acao label="Assumir" titulo="Assumir peça"
                    resumo={<>Assumir <b>{p.titulo}</b> como <b>{socio}</b>?{p.status === "a_fazer" ? <> Será movida para <b>Em elaboração</b>.</> : null}</>}
                    acao={() => assumirPeca(p.id)} />
                )}
                {outro && p.responsavel !== outro && (
                  <Acao label={`Reatribuir a ${outro}`} titulo="Reatribuir peça"
                    resumo={<>Reatribuir <b>{p.titulo}</b> a <b>{outro}</b>?</>}
                    acao={() => reatribuirPeca(p.id)} />
                )}
              </div>
            </div>
          )}

          <div className="dsec">
            <h4>Prazo vinculado</h4>
            {p.prazo_id ? (
              <div className="dgrid">
                <div className="field"><div className="k">Data fatal</div><div className="v mono" style={{ color: "var(--red)" }}>{fmtDate(p.data_fatal)}</div></div>
                <div className="field"><div className="k">Data interna</div><div className="v mono">{fmtDate(p.data_interna)}</div></div>
                <div className="field"><div className="k">Dias restantes</div><div className="v mono">{p.dias_restantes ?? "—"}</div></div>
                <div className="field"><div className="k">Prazo</div><div className="v">{p.prazo_validado ? "validado" : "provisório"}</div></div>
              </div>
            ) : (
              <div className="empty">Sem prazo vinculado{p.data_efetiva ? ` · semáforo pela data alvo (${fmtDate(p.data_efetiva)})` : ""}.</div>
            )}
          </div>

          {provisorio && (
            <div className="dsec">
              <h4>Conferência</h4>
              <div className="acoes">
                <Acao
                  label="Validar peça"
                  variant="ok"
                  titulo="Validar peça provisória"
                  resumo={<>Confirmar <b>{p.titulo}</b> como conferida (validado=true)?</>}
                  acao={() => validarPeca(p.id)}
                />
              </div>
            </div>
          )}

          <div className="dsec">
            <h4>Editar</h4>
            <div className="acoes">
              <FormModal label="Editar peça" titulo="Editar peça" acao={atualizarPeca.bind(null, p.id)} enviarLabel="Salvar" variant="default">
                <CamposBasicos p={p} />
              </FormModal>
              <FormModal label="Vincular prazo/intimação" titulo="Vínculos de origem" acao={vincularPrazoIntimacao.bind(null, p.id)} enviarLabel="Salvar vínculos" variant="default">
                <div>
                  <label>Prazo vinculado</label>
                  <select name="prazo_id" defaultValue={p.prazo_id ?? ""}>
                    <option value="">— nenhum —</option>
                    {prazos.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Intimação de origem</label>
                  <select name="intimacao_id" defaultValue={p.intimacao_id ?? ""}>
                    <option value="">— nenhuma —</option>
                    {intims.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </div>
                <p className="sub" style={{ margin: 0 }}>Deixe em branco para desfazer o vínculo. O prazo vinculado fecha o loop na baixa (peça → protocolada).</p>
              </FormModal>
            </div>
          </div>

          <div className="dsec">
            <h4>Mover</h4>
            <div className="acoes">
              {COLS.filter((c) => c.key !== p.status).map((c) => (
                <Acao key={c.key} label={c.label} titulo="Mover peça"
                  resumo={<>Mover <b>{p.titulo}</b> para <b>{c.label}</b>?</>}
                  acao={() => moverPeca(p.id, c.key)} />
              ))}
              {p.status !== "protocolada" && (
                <Acao label="Protocolada" variant="ok" titulo="Marcar protocolada"
                  resumo={<>Protocolar <b>{p.titulo}</b> (hoje)? Dá baixa completa: prazo vinculado → <b>cumprido</b>, registra o andamento, resolve a intimação e move a peça para <b>protocolada</b>. Sai do board.</>}
                  campoTexto={{ label: "Andamento (opcional)", placeholder: "Ex.: Protocolada a petição de razões de apelação.", multiline: true }}
                  acao={(texto) => moverPeca(p.id, "protocolada", texto)} />
              )}
            </div>
          </div>

          <div className="dsec">
            <h4>Encerrar (nunca apaga — troca de status)</h4>
            <div className="acoes">
              <Acao label="Cancelar peça" variant="danger" titulo="Cancelar peça"
                resumo={<>Cancelar <b>{p.titulo}</b>? (status → cancelada, auditado)</>}
                acao={() => moverPeca(p.id, "cancelada")} />
              <Acao label="Prejudicar" variant="danger" titulo="Prejudicar peça"
                resumo={<>Marcar <b>{p.titulo}</b> como <b>prejudicada</b>? (auditado)</>}
                acao={() => moverPeca(p.id, "prejudicada")} />
            </div>
          </div>
        </>
      ),
    });
  }

  /* cartão de peça (colunas ativas) — topo comum + meio/rodapé por coluna */
  function cartao(p: Peca) {
    const cat = catLabel(p);
    const proc = procNumPeca(p);
    const status = p.status;
    return (
      <article
        key={p.id}
        className={`pc-card ${status}`}
        draggable
        onDragStart={(e) => onDragStart(e, p)}
        onClick={() => abrir(p)}
      >
        <span className={`pc-strip ${status === "em_revisao" ? "accent" : status === "pronta" ? "green" : status === "aguardando_insumo" ? "amber" : status === "em_elaboracao" ? "blue" : "slate"}`} />
        <div className="pc-body">
          <div className="pc-tags">
            <span className={`pc-tag ${tipoTone(p.tipo)}`}>{cat}</span>
            {status === "a_fazer" && ehIA(p) && <span className="pc-tag ia soft">{SPARK}criada pela IA</span>}
            {status === "em_revisao" && <span className="pc-tag ia solid">{SPARK}minuta IA · revisar</span>}
            {status === "aguardando_insumo" && <span className="pc-tag ia soft">{SPARK}gate BAIXA</span>}
            {status === "pronta" && p.validado && <span className="pc-tag tone-green"><Check />validada{p.responsavel ? ` · ${p.responsavel}` : ""}</span>}
            {status === "em_elaboracao" && p.responsavel && <span className="pc-tag tone-blue">{p.responsavel}</span>}
            {p.segredo && <span className="pc-tag segredo">🔒 segredo de justiça</span>}
          </div>

          <div className="pc-title">{p.titulo}</div>
          <div className="pc-cli"><Person /><b>{p.cliente ?? "—"}</b></div>
          {proc && <div className="pc-num mono">{proc}</div>}

          {/* meio por coluna */}
          {status === "em_revisao" && (
            <div className="pc-gate">
              <div className="h">{SPARK}{p.gate_resultado === "alta" ? "gate ALTA · tese coberta pelo acervo" : "minuta do redator agendado"}</div>
              {p.gate_pendencia && <div className="s">{p.gate_pendencia}</div>}
            </div>
          )}
          {status === "aguardando_insumo" && (
            <div className="pc-falta">
              <div className="h"><Alert />{p.gate_pendencia ? `falta: ${p.gate_pendencia}` : "aguardando insumo"}</div>
              <div className="s">não redigir às cegas — o redator só minuta com o acervo íntegro</div>
            </div>
          )}

          {(status === "a_fazer" || status === "em_elaboracao" || status === "em_revisao" || status === "pronta") && (
            <div className="pc-foot-meta">
              <PrazoChip p={p} />
              <span className="pc-meta mono">
                {status === "em_revisao" && p.drive_file_id ? ".docx · Drive"
                  : status === "pronta" ? (p.data_efetiva ? `revisada ${fmtDate(p.data_efetiva)}` : "revisada")
                    : prazoMeta(p)}
              </span>
            </div>
          )}

          {status === "pronta" && (
            <div className="pc-note">O sistema nunca protocola — a baixa do prazo move para <b>protocolada</b> e grava o andamento.</div>
          )}
        </div>

        {/* rodapé de ações por coluna */}
        <div className="pc-foot" onClick={(e) => e.stopPropagation()}>
          {status === "a_fazer" && <><span className="pc-fwrap"><AtribuirAdvogado p={p} /></span><button type="button" className="pc-fbtn sec" onClick={() => abrir(p)}>Abrir</button></>}
          {status === "em_elaboracao" && <>
            {p.drive_file_id
              ? <a className="pc-fbtn" href={`https://drive.google.com/file/d/${p.drive_file_id}/view`} target="_blank" rel="noreferrer">Continuar no editor</a>
              : <button type="button" className="pc-fbtn" onClick={() => abrir(p)}>Continuar no editor</button>}
            <button type="button" className="pc-fbtn sec" onClick={() => abrir(p)}>Abrir</button>
          </>}
          {status === "aguardando_insumo" && <><span className="pc-fwrap"><AnexarInsumo p={p} /></span><Link className="pc-fbtn sec" href="/tarefas">Tarefa</Link></>}
          {status === "em_revisao" && <>
            {p.drive_file_id
              ? <a className="pc-fbtn primary" href={`https://drive.google.com/file/d/${p.drive_file_id}/view`} target="_blank" rel="noreferrer"><FileGlyph />Abrir minuta</a>
              : <button type="button" className="pc-fbtn primary" onClick={() => abrir(p)}><FileGlyph />Abrir minuta</button>}
            <OneClick run={() => validarMinuta(p.id)} className="pc-fbtn sec ok">Validar</OneClick>
          </>}
          {status === "pronta" && <>
            {p.drive_file_id
              ? <a className="pc-fbtn" href={docxHref(p.drive_file_id)} target="_blank" rel="noreferrer">Baixar .docx</a>
              : <button type="button" className="pc-fbtn" onClick={() => abrir(p)}>Baixar .docx</button>}
            <button type="button" className="pc-fbtn sec" onClick={() => abrir(p)}>Abrir</button>
          </>}
        </div>
      </article>
    );
  }

  function cartaoProto(p: Peca) {
    return (
      <article key={p.id} className="pc-card proto" onClick={() => abrir(p)}>
        <div className="pc-body">
          <div className="pc-tags"><span className={`pc-tag ${tipoTone(p.tipo)}`}>{catLabel(p)}</span></div>
          <div className="pc-title sm">{p.titulo}</div>
          <div className="pc-cli sm"><b>{p.cliente ?? "—"}</b></div>
          <div className="pc-proto-when mono"><Check />protocolada {fmtDate(p.protocolada_em)}</div>
        </div>
      </article>
    );
  }

  return (
    <div className="pc-shell">
      {/* toolbar: atribuição + só minutas IA + contador */}
      <div className="pc-toolbar">
        <div className="pc-chips">
          {filtros.map((o) => (
            <button key={o.id} type="button" className={`tk-chip${filtro === o.id ? " on" : ""}`} onClick={() => setFiltro(o.id)}>{o.label}</button>
          ))}
        </div>
        <button type="button" className={`tk-chip conf${soIA ? " on" : ""}`} onClick={() => setSoIA((v) => !v)}>{SPARK}Só minutas IA</button>
        <span className="pc-count mono">{pecasFiltradas.length} peças ativas · <b className="accent">{nIA} geradas pela IA</b></span>
      </div>

      <div className="pc-board">
        {COLS.map((col) => {
          const itens = pecasFiltradas.filter((p) => p.status === col.key);
          return (
            <section
              className={`pc-col${dragCol === col.key ? " drop-on" : ""}${col.key === "em_revisao" ? " revisao" : ""}`}
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragCol(col.key); }}
              onDragLeave={() => setDragCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => onDrop(e, col.key)}
            >
              <div className="pc-col-h">
                <span className={`pc-dot ${col.dot}`} />
                <span className="pc-col-t">{col.label}</span>
                <span className="pc-col-n mono">{itens.length}</span>
                {col.key === "em_revisao" && <span className="pc-col-end accent">minutas IA</span>}
                {col.key === "pronta" && <span className="pc-col-end">aguarda protocolo</span>}
              </div>
              <div className="pc-col-b">
                {itens.length ? itens.map(cartao) : <div className="pc-col-empty">—</div>}
              </div>
            </section>
          );
        })}

        {/* coluna Protocolada (somente leitura, recentes) */}
        <section className="pc-col proto-col">
          <div className="pc-col-h">
            <span className="pc-dot ink" />
            <span className="pc-col-t">Protocolada</span>
            <span className="pc-col-n mono">{protocoladas.length}</span>
            <span className="pc-col-end">30d</span>
          </div>
          <div className="pc-col-b">
            {protocoladas.length ? (
              <>
                {protocoladas.slice(0, verProto).map(cartaoProto)}
                {protocoladas.length > verProto && (
                  <button type="button" className="pc-vertodas" onClick={() => setVerProto(protocoladas.length)}>
                    ver todas as {protocoladas.length} →
                  </button>
                )}
              </>
            ) : (
              <div className="pc-col-empty">—</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

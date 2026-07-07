"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { linkPara } from "@/lib/links";
import { Acao } from "@/components/Acao";
import { FormModal } from "@/components/FormModal";
import { BuscaSelect } from "@/components/BuscaSelect";
import { BaixaAtoModal } from "@/components/modules/BaixaAtoModal";
import {
  criarPeca,
  moverPeca,
  validarMinuta,
  atribuirPeca,
  anexarInsumoPeca,
  reanalisarPecas,
} from "@/app/actions";
import { PECA_TIPO, PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";
import { fmtDate, ddClass, humano, encurtarTitulo } from "@/lib/format";
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
  { key: "aguardando_insumo", label: "Aguardando insumo", dot: "amber" },
  { key: "em_elaboracao", label: "Em elaboração", dot: "blue" },
  { key: "em_revisao", label: "Em revisão", dot: "accent" },
  { key: "pronta", label: "Pronta", dot: "green" },
];

// Opções de movimentação de etapa (kanban + desfechos). moverPeca valida no servidor;
// 'protocolada' roteia para a baixa (gera andamento).
const MOVE_OPTS: { k: string; l: string }[] = [
  { k: "a_fazer", l: "A fazer" },
  { k: "aguardando_insumo", l: "Aguardando insumo" },
  { k: "em_elaboracao", l: "Em elaboração" },
  { k: "em_revisao", l: "Em revisão" },
  { k: "pronta", l: "Pronta" },
  { k: "protocolada", l: "Protocolada" },
  { k: "cancelada", l: "Cancelar" },
  { k: "prejudicada", l: "Prejudicar" },
];

/** Seletor explícito de etapa no card — alternativa acessível ao arrastar. */
function MoverEtapa({ p }: { p: Peca }) {
  const router = useRouter();
  const [pend, setPend] = useState(false);
  return (
    <select
      className="prd-mover"
      value=""
      disabled={pend}
      title="Mover de etapa"
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        const v = e.target.value;
        if (!v) return;
        setPend(true);
        const r = await moverPeca(p.id, v);
        setPend(false);
        if (r.ok) router.refresh();
      }}
    >
      <option value="">{pend ? "Movendo…" : "Mover ▾"}</option>
      {MOVE_OPTS.filter((o) => o.k !== p.status).map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}
    </select>
  );
}

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
    if (p.prioridade === "urgente") return <span className="prd-chip red">⚡ urgente</span>;
    return null;
  }
  return <span className={`prd-chip ${ddClass(p.dias_restantes)}`}><Clock />{p.dias_restantes} dias</span>;
}
// Texto do prazo: interno (do prazo) / alvo (data própria), indicando a natureza.
// Sug. 80 — peça de prosseguimento nasce SEM prazo legal: rotula explicitamente.
function prazoMeta(p: Peca): string {
  if (p.prazo_id) return `interno ${fmtDate(p.data_interna)} · do prazo`;
  if (p.data_efetiva) return `alvo ${fmtDate(p.data_efetiva)}`;
  return p.responsavel ? `sem prazo legal · ${p.responsavel}` : "sem prazo legal";
}

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as const;

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

function CamposBasicos({ p, textos = true }: { p?: Peca; textos?: boolean }) {
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
      {textos && <CamposTexto p={p} />}
    </>
  );
}

/* Áreas livres de texto — separadas p/ posicioná-las DEPOIS dos vínculos na criação. */
function CamposTexto({ p }: { p?: Peca }) {
  return (
    <>
      <div><label>Descrição</label><textarea name="descricao" defaultValue={p?.descricao ?? ""} placeholder="Detalhes da peça…" /></div>
      <div>
        <label>Anotações (o que observar ao redigir)</label>
        <textarea name="observacoes" defaultValue={p?.observacoes ?? ""} placeholder="Teses, pontos de atenção, instruções para quem for fazer a peça…" />
      </div>
    </>
  );
}

/* ---- Botão "Criar peça neste processo" (drawer do processo) ------------
 * Já nasce vinculada ao processo (processo_id escondido) — logo entra na Caixa
 * de trabalho e a baixa em cascata a alcança. Cliente único é preenchido pelo
 * servidor. */
export function CriarPecaNoProcesso({
  processoId,
  prazos,
  label,
}: {
  processoId: string;
  prazos?: { id: string; ato: string; data_fatal: string; validado?: boolean }[];
  label?: React.ReactNode;
}) {
  // Com um único prazo aberto, já sugere o vínculo — assim a baixa em cascata
  // fecha o prazo junto ao protocolar. Vários/nenhum → escolha (ou nenhum).
  const prazoPadrao = prazos && prazos.length === 1 ? prazos[0].id : "";
  return (
    <FormModal
      label={label ?? <>+ Criar peça</>}
      titulo="Criar peça neste processo"
      descricao="Nasce na produção, já vinculada a este processo — entra na Caixa de trabalho. Amarre o prazo aberto para a baixa em cascata fechá-lo junto ao protocolar. Cliente único é preenchido sozinho."
      acao={criarPeca}
      enviarLabel="Criar peça"
    >
      <input type="hidden" name="processo_id" value={processoId} />
      <CamposBasicos textos={false} />
      {prazos && prazos.length > 0 && (
        <div>
          <label>Prazo vinculado <span className="sub">(para a baixa em cascata)</span></label>
          <select name="prazo_id" defaultValue={prazoPadrao}>
            <option value="">— nenhum —</option>
            {prazos.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {(pr.ato.length > 48 ? pr.ato.slice(0, 47) + "…" : pr.ato)} · fatal {fmtDate(pr.data_fatal)}{pr.validado === false ? " (provisório)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </FormModal>
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
      <CamposBasicos textos={false} />
      <h4 style={{ margin: "12px 0 2px", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--brass)" }}>Vínculos · informe ao menos processo ou cliente</h4>
      <p className="sub" style={{ margin: "0 0 2px" }}>Sem nenhum vínculo a peça fica órfã e a baixa em cascata não a alcança. Com um único cliente no processo, o cliente é preenchido sozinho.</p>
      <div style={grid2}>
        <div>
          <label>Cliente</label>
          <BuscaSelect name="cliente_id" options={clis.map((c) => ({ id: c.id, label: c.nome }))} placeholder="Buscar cliente… (opcional)" />
        </div>
        <div>
          <label>Processo</label>
          <BuscaSelect name="processo_id" options={procs.map((x) => ({ id: x.id, label: x.label }))} placeholder="Buscar processo… (opcional)" />
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
      <h4 style={{ margin: "12px 0 2px", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--brass)" }}>Descrição e anotações</h4>
      <CamposTexto />
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
function OneClick({ run, children, className = "prd-fbtn" }: { run: () => Promise<{ ok: boolean }>; children: ReactNode; className?: string }) {
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
  const router = useRouter();
  const params = useSearchParams();
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
    router.push(linkPara("peca", p.id));
  }

  /* cartão de peça (colunas ativas) — topo comum + meio/rodapé por coluna */
  function cartao(p: Peca) {
    const cat = catLabel(p);
    const proc = procNumPeca(p);
    const status = p.status;
    return (
      <article
        key={p.id}
        className={`prd-card ${status}`}
        draggable
        onDragStart={(e) => onDragStart(e, p)}
        onClick={() => abrir(p)}
      >
        <span className={`prd-strip ${status === "em_revisao" ? "accent" : status === "pronta" ? "green" : status === "aguardando_insumo" ? "amber" : status === "em_elaboracao" ? "blue" : "slate"}`} />
        <div className="prd-body">
          <div className="prd-tags">
            <span className={`prd-tag ${tipoTone(p.tipo)}`}>{cat}</span>
            {status === "a_fazer" && ehIA(p) && <span className="prd-tag ia soft">{SPARK}criada pela IA</span>}
            {status === "em_revisao" && <span className="prd-tag ia solid">{SPARK}minuta IA · revisar</span>}
            {status === "aguardando_insumo" && <span className="prd-tag ia soft">{SPARK}gate BAIXA</span>}
            {status === "pronta" && p.validado && <span className="prd-tag tone-green"><Check />validada{p.responsavel ? ` · ${p.responsavel}` : ""}</span>}
            {status === "em_elaboracao" && p.responsavel && <span className="prd-tag tone-blue">{p.responsavel}</span>}
            {p.segredo && <span className="prd-tag segredo">🔒 segredo de justiça</span>}
          </div>

          <div className="prd-title" title={p.titulo}>{encurtarTitulo(p.titulo, p.cliente, p.numero_cnj, p.numero_registro)}</div>
          <div className="prd-cli"><Person /><b>{p.cliente ?? "—"}</b></div>
          {proc && <div className="prd-num mono">{proc}</div>}

          {/* meio por coluna */}
          {status === "em_revisao" && (
            <div className="prd-gate">
              <div className="h">{SPARK}{p.gate_resultado === "alta" ? "gate ALTA · tese coberta pelo acervo" : "minuta do redator agendado"}</div>
              {p.gate_pendencia && <div className="s">{p.gate_pendencia}</div>}
            </div>
          )}
          {status === "aguardando_insumo" && (
            <div className="prd-falta">
              <div className="h"><Alert />{p.gate_pendencia ? `falta: ${p.gate_pendencia}` : "aguardando insumo"}</div>
              <div className="s">não redigir às cegas — o redator só minuta com o acervo íntegro</div>
            </div>
          )}

          {(status === "a_fazer" || status === "em_elaboracao" || status === "em_revisao" || status === "pronta") && (
            <div className="prd-foot-meta">
              <PrazoChip p={p} />
              <span className="prd-meta mono">
                {status === "em_revisao" && p.drive_file_id ? ".docx · Drive"
                  : status === "pronta" ? (p.data_efetiva ? `revisada ${fmtDate(p.data_efetiva)}` : "revisada")
                    : prazoMeta(p)}
              </span>
            </div>
          )}

          {status === "pronta" && (
            <div className="prd-note">O sistema nunca protocola — a baixa do prazo move para <b>protocolada</b> e grava o andamento.</div>
          )}
        </div>

        {/* rodapé de ações por coluna */}
        <div className="prd-foot" onClick={(e) => e.stopPropagation()}>
          <MoverEtapa p={p} />
          {status === "a_fazer" && <><span className="prd-fwrap"><AtribuirAdvogado p={p} /></span><button type="button" className="prd-fbtn sec" onClick={() => abrir(p)}>Abrir</button></>}
          {status === "em_elaboracao" && <>
            {p.drive_file_id
              ? <a className="prd-fbtn" href={`https://drive.google.com/file/d/${p.drive_file_id}/view`} target="_blank" rel="noreferrer">Continuar no editor</a>
              : <button type="button" className="prd-fbtn" onClick={() => abrir(p)}>Continuar no editor</button>}
            <button type="button" className="prd-fbtn sec" onClick={() => abrir(p)}>Abrir</button>
          </>}
          {status === "aguardando_insumo" && <><span className="prd-fwrap"><AnexarInsumo p={p} /></span><Link className="prd-fbtn sec" href="/tarefas">Tarefa</Link></>}
          {status === "em_revisao" && <>
            {p.drive_file_id
              ? <a className="prd-fbtn primary" href={`https://drive.google.com/file/d/${p.drive_file_id}/view`} target="_blank" rel="noreferrer"><FileGlyph />Abrir minuta</a>
              : <button type="button" className="prd-fbtn primary" onClick={() => abrir(p)}><FileGlyph />Abrir minuta</button>}
            <OneClick run={() => validarMinuta(p.id)} className="prd-fbtn sec ok">Validar</OneClick>
          </>}
          {status === "pronta" && <>
            {p.drive_file_id
              ? <a className="prd-fbtn" href={docxHref(p.drive_file_id)} target="_blank" rel="noreferrer">Baixar .docx</a>
              : <button type="button" className="prd-fbtn" onClick={() => abrir(p)}>Baixar .docx</button>}
            <span className="prd-fwrap"><BaixaAtoModal pecaId={p.id} titulo={p.titulo} className="prd-fbtn primary" label="Protocolei / dar baixa" /></span>
          </>}
        </div>
      </article>
    );
  }

  function cartaoProto(p: Peca) {
    return (
      <article key={p.id} className="prd-card proto" onClick={() => abrir(p)}>
        <div className="prd-body">
          <div className="prd-tags"><span className={`prd-tag ${tipoTone(p.tipo)}`}>{catLabel(p)}</span></div>
          <div className="prd-title sm" title={p.titulo}>{encurtarTitulo(p.titulo, p.cliente, p.numero_cnj, p.numero_registro)}</div>
          <div className="prd-cli sm"><b>{p.cliente ?? "—"}</b></div>
          <div className="prd-proto-when mono"><Check />protocolada {fmtDate(p.protocolada_em)}</div>
        </div>
      </article>
    );
  }

  return (
    <div className="prd-shell">
      {/* toolbar: atribuição + só minutas IA + contador */}
      <div className="prd-toolbar">
        <div className="prd-chips">
          {filtros.map((o) => (
            <button key={o.id} type="button" className={`tk-chip${filtro === o.id ? " on" : ""}`} onClick={() => setFiltro(o.id)}>{o.label}</button>
          ))}
        </div>
        <button type="button" className={`tk-chip conf${soIA ? " on" : ""}`} onClick={() => setSoIA((v) => !v)}>{SPARK}Só minutas IA</button>
        <span className="prd-count mono">{pecasFiltradas.length} peças ativas · <b className="accent">{nIA} geradas pela IA</b></span>
      </div>

      <div className="prd-board">
        {COLS.map((col) => {
          const itens = pecasFiltradas.filter((p) => p.status === col.key);
          return (
            <section
              className={`prd-col${dragCol === col.key ? " drop-on" : ""}${col.key === "em_revisao" ? " revisao" : ""}`}
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragCol(col.key); }}
              onDragLeave={() => setDragCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => onDrop(e, col.key)}
            >
              <div className="prd-col-h">
                <span className={`prd-dot ${col.dot}`} />
                <span className="prd-col-t">{col.label}</span>
                <span className="prd-col-n mono">{itens.length}</span>
                {col.key === "em_revisao" && <span className="prd-col-end accent">minutas IA</span>}
                {col.key === "pronta" && <span className="prd-col-end">aguarda protocolo</span>}
              </div>
              <div className="prd-col-b">
                {itens.length ? itens.map(cartao) : <div className="prd-col-empty">—</div>}
              </div>
            </section>
          );
        })}

        {/* coluna Protocolada (somente leitura, recentes) */}
        <section className="prd-col proto-col">
          <div className="prd-col-h">
            <span className="prd-dot ink" />
            <span className="prd-col-t">Protocolada</span>
            <span className="prd-col-n mono">{protocoladas.length}</span>
            <span className="prd-col-end">30d</span>
          </div>
          <div className="prd-col-b">
            {protocoladas.length ? (
              <>
                {protocoladas.slice(0, verProto).map(cartaoProto)}
                {protocoladas.length > verProto && (
                  <button type="button" className="prd-vertodas" onClick={() => setVerProto(protocoladas.length)}>
                    ver todas as {protocoladas.length} →
                  </button>
                )}
              </>
            ) : (
              <div className="prd-col-empty">—</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

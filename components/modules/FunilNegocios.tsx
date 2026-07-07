"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormModal } from "@/components/FormModal";
import { SegredoTag } from "@/components/ui";
import { criarOportunidade, atualizarOportunidade, moverOportunidade, converterOportunidade } from "@/app/actions";
import { PROCESSO_AREA, RESPONSAVEIS, ORIGEM_LEAD, PROBABILIDADE, SITUACAO_PRISIONAL } from "@/lib/enums";
import { fmtBRL, fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { Oportunidade } from "@/lib/data";

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as const;

// Pipeline arrastável (os encerramentos recusado/perdido ficam fora do board).
const COLS: { key: string; label: string; dot: string }[] = [
  { key: "tratativa", label: "Tratativa", dot: "slate" },
  { key: "estudo_preliminar", label: "Estudo preliminar", dot: "blue" },
  { key: "proposta", label: "Proposta", dot: "amber" },
  { key: "negociacao", label: "Negociação", dot: "accent" },
  { key: "fechado", label: "Fechado", dot: "green" },
];
const MOVE_OPTS = COLS.map((c) => ({ k: c.key, l: c.label }));
const probTone = (p: string | null) => (p === "alta" ? "tone-green" : p === "media" ? "tone-amber" : "tone-slate");

/* glifos (mesma família do board de Produção) */
const Person = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="1.9" strokeLinecap="round" aria-hidden><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>;
const Check = ({ c = "var(--green)" }: { c?: string }) => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>;

/* ── campos do formulário (criar/editar) — reusado no kanban e no drawer ─── */
export function CamposOportunidade({ o }: { o?: Oportunidade }) {
  return (
    <>
      <div><label>Título</label><input name="titulo" required defaultValue={o?.titulo ?? ""} placeholder="Ex.: Defesa criminal — Fulano" /></div>
      <div style={grid2}>
        <div><label>Contato</label><input name="contato_nome" required defaultValue={o?.contato_nome ?? ""} placeholder="Nome do prospect" /></div>
        <div><label>Telefone</label><input name="contato_telefone" defaultValue={o?.contato_telefone ?? ""} /></div>
      </div>
      <div style={grid2}>
        <div><label>E-mail</label><input name="contato_email" defaultValue={o?.contato_email ?? ""} /></div>
        <div><label>Origem do lead</label><select name="origem_lead" defaultValue={o?.origem_lead ?? ""}><option value="">—</option>{ORIGEM_LEAD.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
      </div>
      <div style={grid2}>
        <div><label>Área</label><select name="area" defaultValue={o?.area ?? ""}><option value="">—</option>{PROCESSO_AREA.map((a) => <option key={a} value={a}>{humano(a)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={o?.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div style={grid2}>
        <div><label>Valor proposto (R$)</label><input name="valor_proposto" defaultValue={o?.valor_proposto != null ? String(o.valor_proposto) : ""} placeholder="ex.: 15000" /></div>
        <div><label>Probabilidade</label><select name="probabilidade" defaultValue={o?.probabilidade ?? ""}><option value="">—</option>{PROBABILIDADE.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
      </div>
      <div><label>Forma de pagamento</label><input name="forma_pagamento" defaultValue={o?.forma_pagamento ?? ""} placeholder="ex.: 10x no cartão / entrada + parcelas" /></div>
      <div><label>Resumo da demanda</label><textarea name="resumo" defaultValue={o?.resumo ?? ""} placeholder="Síntese do caso/tratativa." /></div>
      <div><label>Estudo preliminar (viabilidade)</label><textarea name="estudo_preliminar" defaultValue={o?.estudo_preliminar ?? ""} placeholder="Análise pré-contrato." /></div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
        <input type="checkbox" name="segredo_justica" defaultChecked={o?.segredo} style={{ width: "auto" }} /> Segredo de justiça
      </label>
    </>
  );
}

export function NovoNegocio() {
  return (
    <FormModal label={<>+ Nova oportunidade</>} titulo="Nova oportunidade" descricao="Pré-contrato — captação manual. Nasce em ‘tratativa’." acao={criarOportunidade} enviarLabel="Criar">
      <CamposOportunidade />
    </FormModal>
  );
}

/* ── conversão (estágio fechado) ─────────────────────────────────────────── */
export function ConverterBtn({ o }: { o: Oportunidade }) {
  return (
    <FormModal
      label="Converter em cliente"
      titulo="Converter em cliente"
      descricao="Cria/vincula o cliente (dedup por nome), o contrato e as parcelas. A oportunidade vira a origem rastreável."
      acao={converterOportunidade.bind(null, o.id)}
      enviarLabel="Converter"
    >
      <div><label>Objeto do contrato</label><input name="objeto" required defaultValue={o.titulo} /></div>
      <div style={grid2}>
        <div><label>Valor total (R$)</label><input name="valor_total" defaultValue={o.valor_proposto != null ? String(o.valor_proposto) : ""} required /></div>
        <div><label>Forma de pagamento</label><input name="forma_pagamento" defaultValue={o.forma_pagamento ?? ""} /></div>
      </div>
      <div style={grid2}>
        <div><label>Nº de parcelas</label><input type="number" name="parcelas" min={1} max={60} defaultValue={1} /></div>
        <div><label>1º vencimento</label><input type="date" name="primeiro_vencimento" /></div>
      </div>
      <div><label>Situação prisional (se novo cliente)</label><select name="situacao_prisional" defaultValue="solto">{SITUACAO_PRISIONAL.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
      <p className="sub" style={{ margin: 0 }}>Se já existir cliente com o mesmo nome, ele é <b>vinculado</b> (não duplica). As parcelas dividem o valor total em meses a partir do 1º vencimento.</p>
    </FormModal>
  );
}

/* ── card ────────────────────────────────────────────────────────────────── */
function Cartao({ o, onDragStart }: { o: Oportunidade; onDragStart: (e: DragEvent, o: Oportunidade) => void }) {
  const router = useRouter();
  const [mvPend, setMvPend] = useState(false);
  const mover = async (estagio: string) => {
    setMvPend(true);
    const r = await moverOportunidade(o.id, estagio);
    setMvPend(false);
    if (r.ok) router.refresh();
  };
  const dot = COLS.find((c) => c.key === o.estagio)?.dot ?? "slate";
  const meta = [o.responsavel, o.origem_lead ? humano(o.origem_lead) : null].filter(Boolean).join(" · ");
  return (
    <article className={`prd-card ${o.estagio}`} draggable onDragStart={(e) => onDragStart(e, o)} onClick={() => router.push(`/negocios/${o.id}`)}>
      <span className={`prd-strip ${dot}`} />
      <div className="prd-body">
        <div className="prd-tags">
          {o.area && <span className="prd-tag tone-slate">{humano(o.area)}</span>}
          {o.probabilidade && <span className={`prd-tag ${probTone(o.probabilidade)}`}>prob. {humano(o.probabilidade)}</span>}
          {o.segredo && <span className="prd-tag segredo"><SegredoTag on /></span>}
        </div>
        <div className="prd-title" title={o.titulo}>{o.titulo}</div>
        <div className="prd-cli"><Person /><b>{o.contato_nome}</b></div>
        {o.contato_telefone && <div className="prd-num mono">{o.contato_telefone}</div>}
        <div className="prd-foot-meta">
          {o.valor_proposto != null && <span className="fn-valor">{fmtBRL(o.valor_proposto)}</span>}
          <span className="prd-meta">{meta || "—"}</span>
        </div>
        {o.estagio === "fechado" && !o.cliente_id && (
          <div className="prd-note">Fechado — <b>converta</b> para criar cliente, contrato e parcelas.</div>
        )}
      </div>

      <div className="prd-foot" onClick={(e) => e.stopPropagation()}>
        {o.estagio === "fechado" ? (
          o.cliente_id
            ? <Link className="prd-fbtn ok" href={linkPara("cliente", o.cliente_id)}><Check />cliente vinculado</Link>
            : <span className="prd-fwrap fn-conv"><ConverterBtn o={o} /></span>
        ) : (
          <select className="prd-mover" value="" disabled={mvPend} title="Mover de estágio"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { if (e.target.value) mover(e.target.value); }}>
            <option value="">{mvPend ? "Movendo…" : "Mover ▾"}</option>
            {MOVE_OPTS.filter((m) => m.k !== o.estagio).map((m) => <option key={m.k} value={m.k}>{m.l}</option>)}
          </select>
        )}
        <span className="prd-fwrap">
          <FormModal label="Editar" titulo="Editar oportunidade" acao={atualizarOportunidade.bind(null, o.id)} enviarLabel="Salvar" variant="default">
            <CamposOportunidade o={o} />
          </FormModal>
        </span>
      </div>
    </article>
  );
}

/* ── board ───────────────────────────────────────────────────────────────── */
export function FunilNegocios({ oportunidades }: { oportunidades: Oportunidade[] }) {
  const router = useRouter();
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [verEncerradas, setVerEncerradas] = useState(false);

  const q = busca.trim().toLowerCase();
  const casa = (o: Oportunidade) => !q || [o.titulo, o.contato_nome, o.responsavel].filter(Boolean).some((x) => x!.toLowerCase().includes(q));
  const ativas = oportunidades.filter((o) => !o.encerrado && casa(o));
  const encerradas = oportunidades.filter((o) => o.encerrado && casa(o));

  function onDragStart(e: DragEvent, o: Oportunidade) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: o.id, estagio: o.estagio }));
    e.dataTransfer.effectAllowed = "move";
  }
  async function onDrop(e: DragEvent, colKey: string) {
    e.preventDefault();
    setDragCol(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const { id, estagio } = JSON.parse(raw) as { id: string; estagio: string };
      if (!id || estagio === colKey) return;
      const r = await moverOportunidade(id, colKey);
      if (r.ok) router.refresh();
    } catch { /* payload inválido */ }
  }

  return (
    <div className="prd-shell">
      <div className="prd-toolbar">
        <input className="cli-busca" style={{ maxWidth: 320, marginTop: 0 }} placeholder="Buscar contato, título, responsável…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="prd-count mono">{ativas.length} ativas no funil</span>
      </div>

      <div className="prd-board">
        {COLS.map((col) => {
          const itens = ativas.filter((o) => o.estagio === col.key);
          return (
            <section key={col.key} className={`prd-col${dragCol === col.key ? " drop-on" : ""}${col.key === "fechado" ? " fechado" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragCol(col.key); }}
              onDragLeave={() => setDragCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => onDrop(e, col.key)}>
              <div className="prd-col-h">
                <span className={`prd-dot ${col.dot}`} />
                <span className="prd-col-t">{col.label}</span>
                <span className="prd-col-n mono">{itens.length}</span>
                {col.key === "fechado" && <span className="prd-col-end green">converter →</span>}
              </div>
              <div className="prd-col-b">
                {itens.length ? itens.map((o) => <Cartao key={o.id} o={o} onDragStart={onDragStart} />) : <div className="prd-col-empty">—</div>}
              </div>
            </section>
          );
        })}
      </div>

      {/* encerradas (recusado/perdido) — histórico, nunca apagado */}
      {encerradas.length > 0 && (
        <div className="fn-encerradas">
          {!verEncerradas ? (
            <button type="button" className="dup-vertodos" onClick={() => setVerEncerradas(true)}>
              Ver encerradas — recusadas/perdidas ({encerradas.length})
            </button>
          ) : (
            <>
              <div className="dup-seclabel"><span className="t">Encerradas · recusadas / perdidas</span><code>histórico — nunca apagado</code></div>
              <div className="fn-enc-list">
                {encerradas.map((o) => (
                  <div className="fn-enc-row" key={o.id}>
                    <span className={`prd-tag ${o.estagio === "recusado" ? "tone-red" : "tone-slate"}`}>{humano(o.estagio)}</span>
                    <span className="fn-enc-t">{o.titulo}</span>
                    <span className="fn-enc-c">{o.contato_nome}</span>
                    <span className="fn-enc-m">{o.motivo_recusa ?? "—"}</span>
                    <span className="fn-enc-d mono">{o.data_decisao ? fmtDate(o.data_decisao) : ""}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

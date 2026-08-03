"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarAnotacao, editarAnotacao, excluirAnotacao } from "@/app/actions";
import { fmtDate } from "@/lib/format";
import Link from "next/link";
import type { Anotacao, NotaUnificada } from "@/lib/data";

const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);

/* ── card individual (editar / apagar) ───────────────────────────────────── */
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
            <span className="audp-nota-meta">{nota.autor} · {fmtDate(nota.criado_em)}{editado ? " · editada" : ""}</span>
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

/* ── campo de escrever (compartilhado) ───────────────────────────────────── */
function NovaAnotacao({ entidadeTipo, entidadeId }: { entidadeTipo: string; entidadeId: string }) {
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
      const r = await criarAnotacao(entidadeTipo, entidadeId, fd);
      if (r.ok) { setTexto(""); setErro(null); router.refresh(); }
      else setErro(r.message);
    });
  };

  return (
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
          {pend ? "Salvando…" : "Nova anotação"}
        </button>
      </div>
    </div>
  );
}

/* ── esteira: lista de cards independentes + campo de escrever (abaixo) ────── */
export function Anotacoes({ entidadeTipo, entidadeId, notas }: { entidadeTipo: string; entidadeId: string; notas: Anotacao[] }) {
  return (
    <div className="audp-notas">
      {/* Lista primeiro (leitura sem clique); o campo de escrita fica ABAIXO —
          logo sob o título já se vê o que foi anotado, e escreve-se por último. */}
      {notas.length === 0
        ? <div className="audp-empty">Nenhuma anotação ainda. Cada anotação salva vira um card independente.</div>
        : notas.map((n) => <AnotacaoCard key={n.id} nota={n} />)}
      <NovaAnotacao entidadeTipo={entidadeTipo} entidadeId={entidadeId} />
    </div>
  );
}

/* ── aba Notas do drawer do cliente: unifica TODA anotação do cliente ──────────
 * Notas escritas em qualquer registro do cliente (intimação, prazo, andamento,
 * peça…) aparecem aqui com etiqueta da ORIGEM + link. As escritas no próprio
 * cliente ficam editáveis; as de outros registros são leitura, com "abrir". */

type Tone = "red" | "amber" | "green" | "blue" | "gray" | "brass" | "violet";
const ETIQUETA: Record<string, { label: string; tone: Tone }> = {
  intimacao: { label: "intimação", tone: "blue" },
  providencia: { label: "providência", tone: "amber" },
  processo: { label: "processo", tone: "brass" },
  andamento: { label: "movimentação", tone: "blue" },
  prazo: { label: "prazo", tone: "amber" },
  tarefa: { label: "tarefa", tone: "violet" },
  cliente: { label: "cliente", tone: "green" },
  audiencia: { label: "audiência", tone: "brass" },
  peca: { label: "peça", tone: "blue" },
  contrato: { label: "contrato", tone: "green" },
  estudo: { label: "estudo", tone: "violet" },
  varredura: { label: "varredura", tone: "gray" },
};

function Etiqueta({ tipo }: { tipo: string }) {
  const et = ETIQUETA[tipo] ?? { label: tipo, tone: "gray" as Tone };
  return <span className={`pill ${et.tone}`}>{et.label}</span>;
}

/* Nota vinda de outro registro do cliente — leitura + link para a origem. */
function NotaExterna({ nota }: { nota: NotaUnificada }) {
  const editado = nota.atualizado_em && nota.atualizado_em !== nota.criado_em;
  return (
    <div className="audp-nota">
      <div className="nota-orig">
        <Etiqueta tipo={nota.entidade_tipo} />
        {nota.href ? (
          <Link className="link" href={nota.href}>{nota.contexto ?? "abrir origem"}</Link>
        ) : (
          <span className="sub">{nota.contexto ?? "—"}</span>
        )}
      </div>
      <div className="audp-nota-txt">{nota.texto}</div>
      <div className="audp-nota-foot">
        <span className="audp-nota-meta">{nota.autor} · {fmtDate(nota.criado_em)}{editado ? " · editada" : ""}</span>
      </div>
    </div>
  );
}

/**
 * Duas naturezas convivem nesta aba e NÃO podem somar no mesmo número.
 *
 * - ANOTAÇÃO (tabela `anotacoes`): texto que um humano escreveu de propósito.
 * - PROVIDÊNCIA (`intimacoes.providencia`, espelhada aqui em leitura): texto que
 *   a triagem automática gravou ao encaminhar a intimação.
 *
 * Somadas, davam "Anotações (3)" para um cliente com ZERO anotações e 3
 * providências — e "Anotações (70)" no caso extremo, onde nenhuma era nota
 * humana. O contador dizia que havia registro pessoal onde não havia nenhum.
 */
export const ehProvidencia = (n: NotaUnificada) => n.entidade_tipo === "providencia";
export const contarNotas = (notas: NotaUnificada[]) => {
  const providencias = notas.filter(ehProvidencia).length;
  return { humanas: notas.length - providencias, providencias };
};

export function NotasCliente({ clienteId, notas }: { clienteId: string; notas: NotaUnificada[] }) {
  const humanas = notas.filter((n) => !ehProvidencia(n));
  const providencias = notas.filter(ehProvidencia);

  return (
    <div className="audp-notas">
      {/* 1 · escritas por gente — o que a aba promete */}
      {humanas.length === 0
        ? <div className="audp-empty">Nenhuma anotação escrita ainda. Toda nota feita neste cliente ou em suas intimações, prazos, peças… aparece aqui.</div>
        : humanas.map((n) =>
            n.entidade_tipo === "cliente"
              ? <AnotacaoCard key={n.id} nota={n} />
              : <NotaExterna key={n.id} nota={n} />,
          )}

      <NovaAnotacao entidadeTipo="cliente" entidadeId={clienteId} />

      {/* 2 · providências da triagem — leitura, abaixo e rotuladas como o que são */}
      {providencias.length > 0 && (
        <>
          <div className="audp-sech" style={{ marginTop: 18 }}>
            Providências das intimações <span className="audp-count">{providencias.length}</span>
          </div>
          <div className="audp-ia-note" style={{ marginTop: 0, marginBottom: 4 }}>
            Texto gravado pela <b>triagem</b> ao encaminhar cada intimação, espelhado aqui em leitura.
            Não é anotação sua — para anotar, use o campo acima.
          </div>
          {providencias.map((n) => <NotaExterna key={n.id} nota={n} />)}
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarAnotacao, editarAnotacao, excluirAnotacao } from "@/app/actions";
import { fmtDate } from "@/lib/format";
import type { Anotacao } from "@/lib/data";

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

/* ── esteira: nova anotação + lista de cards independentes ────────────────── */
export function Anotacoes({ entidadeTipo, entidadeId, notas }: { entidadeTipo: string; entidadeId: string; notas: Anotacao[] }) {
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
            {pend ? "Salvando…" : "Nova anotação"}
          </button>
        </div>
      </div>
      {notas.length === 0
        ? <div className="audp-empty">Nenhuma anotação ainda. Cada anotação salva vira um card independente.</div>
        : notas.map((n) => <AnotacaoCard key={n.id} nota={n} />)}
    </div>
  );
}

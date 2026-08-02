"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { arquivarProtocoloPeca, type Resultado } from "@/app/actions";

/**
 * Sugestão 96 — completa o arquivamento de uma peça já protocolada que ficou com a
 * tag "arquivamento pendente" (baixa sem PDF). Sobe o PDF ao Drive e registra em
 * documentos (mesma server action da baixa). Fecha a pendência sem tocar na baixa.
 */
export function AnexarArquivamento({
  pecaId,
  segredo = false,
  className = "btn sm",
  label = "📎 Anexar PDF",
}: {
  pecaId: string;
  segredo?: boolean;
  className?: string;
  label?: React.ReactNode;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  async function enviar() {
    if (!arquivo) return;
    setPend(true);
    const fd = new FormData();
    fd.append("arquivo", arquivo);
    const r = await arquivarProtocoloPeca(pecaId, fd);
    setPend(false);
    setRes(r);
    if (r.ok) {
      router.refresh();
      setTimeout(() => setAberto(false), 1200);
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={(e) => { e.stopPropagation(); setAberto(true); setRes(null); setArquivo(null); }}>
        {label}
      </button>
      {aberto && (
        <div className="modal-scrim" onClick={() => setAberto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>Anexar PDF protocolado</h3>
              <p>Completa o arquivamento desta peça (que ficou pendente na baixa). O PDF vai para a subpasta do processo no Drive e é registrado no acervo.</p>
            </div>
            <div className="modal-b">
              <div className="bx-anexo">
                <label>PDF protocolado</label>
                <input type="file" accept="application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              </div>
              {segredo && (
                <div className="bx-info amber">🔒 Processo em <b>segredo de justiça</b> — confira a pasta e as permissões no Drive.</div>
              )}
              {res && <div className={`modal-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
            </div>
            <div className="modal-f">
              <button className="btn ghost" type="button" onClick={() => setAberto(false)} disabled={pend}>{res?.ok ? "Fechar" : "Cancelar"}</button>
              {!res?.ok && (
                <button className="btn primary" type="button" onClick={enviar} disabled={pend || !arquivo}>
                  {pend ? "Arquivando…" : "Arquivar PDF"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

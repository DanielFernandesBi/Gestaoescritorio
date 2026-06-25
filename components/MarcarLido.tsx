"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { marcarIntimacaoLida } from "@/app/actions";

/** Olho (Lucide-style) — fora do set do Icon.tsx. */
const Olho = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * Sugestão 53 — botão "Marcar lido" na linha da lista e no detalhe. A leitura
 * só acontece por este clique explícito (não mais ao abrir/clicar na intimação),
 * evitando miss-clicks. Some quando a intimação já foi lida (o pai só o renderiza
 * enquanto revisado_em é null). Dentro de uma RowLink o clique não navega.
 */
export function MarcarLido({ id }: { id: string }) {
  const router = useRouter();
  const [pend, setPend] = useState(false);

  async function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPend(true);
    const r = await marcarIntimacaoLida(id);
    setPend(false);
    if (r.ok) router.refresh();
  }

  return (
    <button type="button" className="btn sm marcar-lido" onClick={onClick} disabled={pend} title="Marcar como lida">
      <Olho />
      {pend ? "…" : "Marcar lido"}
    </button>
  );
}

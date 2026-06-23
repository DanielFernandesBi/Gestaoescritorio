"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { marcarIntimacaoLida } from "@/app/actions";

/**
 * Sugestão 53 — botão "Marcar lido" na linha da lista. Some quando a intimação já
 * foi lida (o pai só o renderiza enquanto revisado_em é null). Para dentro de uma
 * RowLink: o clique não navega (RowLink ignora cliques em <button>).
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
    <button type="button" className="btn sm ghost" onClick={onClick} disabled={pend} title="Marcar como lida">
      {pend ? "…" : "Marcar lido"}
    </button>
  );
}

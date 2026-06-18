"use client";

import { Children, useState, type ReactNode } from "react";

/**
 * Mostra no máximo `max` itens e revela o restante com "ver mais (N)".
 * Recebe os itens já renderizados como children (linhas div/Link, não <tr>).
 */
export function VerMais({ children, max = 6 }: { children: ReactNode; max?: number }) {
  const [aberto, setAberto] = useState(false);
  const itens = Children.toArray(children);
  const extra = itens.length - max;
  const visiveis = aberto ? itens : itens.slice(0, max);

  return (
    <>
      {visiveis}
      {extra > 0 && (
        <button type="button" className="ver-mais" onClick={() => setAberto((a) => !a)}>
          {aberto ? "ver menos" : `ver mais (${extra})`}
        </button>
      )}
    </>
  );
}

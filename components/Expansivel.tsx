"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Conteúdo que nasce recolhido numa altura fixa com a borda inferior esmaecida
 * (o texto "vai ficando mais claro"), revelado por clique — o mesmo efeito de
 * evolução usado em Sistema e Evolução, reaproveitável em qualquer expansível.
 */
export function Expansivel({
  children,
  altura = 140,
  mais = "expandir",
  menos = "recolher",
}: {
  children: ReactNode;
  altura?: number;
  mais?: string;
  menos?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [transborda, setTransborda] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setTransborda(el.scrollHeight > altura + 4);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [altura, children]);

  const recolhido = transborda && !aberto;

  return (
    <div className="exp">
      <div
        ref={ref}
        className={`exp-body${recolhido ? " recolhido" : ""}`}
        style={recolhido ? { maxHeight: altura } : undefined}
      >
        {children}
        {recolhido && <div className="exp-fade" />}
      </div>
      {transborda && (
        <button type="button" className="exp-btn" onClick={() => setAberto((v) => !v)}>
          {aberto ? menos : mais}
        </button>
      )}
    </div>
  );
}

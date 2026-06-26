"use client";

import { useRouter } from "next/navigation";
import type { ReactNode, KeyboardEvent } from "react";

/**
 * Linha de tabela clicável que NAVEGA para a página de detalhe (drawer novo,
 * mestre-detalhe), em vez de abrir o drawer antigo em memória. Mantém a
 * semântica de <tr>; suporta teclado. Cliques em seleção de texto são tratados
 * pela captura global do AppShell.
 */
export function LinkRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  const ir = () => router.push(href);
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter") { e.preventDefault(); ir(); }
  };
  return (
    <tr className="clickable" role="link" tabIndex={0} onClick={ir} onKeyDown={onKey}>
      {children}
    </tr>
  );
}

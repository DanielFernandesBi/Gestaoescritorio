"use client";

import { useRouter } from "next/navigation";
import type { ReactNode, KeyboardEvent, MouseEvent } from "react";

/**
 * Linha de tabela que navega por ROTA (URL real) para o detalhe — interceptada
 * como drawer pelo slot @modal, mas deep-linkável, com botão voltar e acessível
 * por teclado. Cliques em elementos interativos aninhados (links, botões, a ★,
 * ações) são ignorados via `closest`, sem precisar de stopPropagation manual.
 */
const INTERATIVO = "a,button,input,select,textarea,label,[role='button']";

export function RowLink({
  href,
  children,
  className = "",
  ariaLabel,
  prefetch = true,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  prefetch?: boolean;
}) {
  const router = useRouter();

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    if ((e.target as HTMLElement).closest(INTERATIVO)) return;
    router.push(href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter") {
      e.preventDefault();
      router.push(href);
    }
  }

  return (
    <tr
      className={`clickable${className ? ` ${className}` : ""}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onMouseEnter={prefetch ? () => router.prefetch(href) : undefined}
      tabIndex={0}
      role="link"
      aria-label={ariaLabel}
    >
      {children}
    </tr>
  );
}

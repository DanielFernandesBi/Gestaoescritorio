"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Modal dirigido por rota (intercepting + parallel routes). Reaproveita o visual
 * do drawer em memória (.scrim/.drawer) para manter a UX idêntica, mas com URL
 * própria: deep-link, botão voltar, refresh abre a página inteira.
 * Fecha com Esc, clique no scrim ou no ×, sempre via router.back().
 */
export function RouteModal({ title, children }: { title?: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const fechar = () => router.back();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      <div className="scrim open" onClick={fechar} aria-hidden />
      <aside className="drawer open" role="dialog" aria-modal="true">
        <div className="drawer-h">
          <div>{title}</div>
          <button className="x" onClick={fechar} aria-label="Fechar">×</button>
        </div>
        <div className="drawer-b">{children}</div>
      </aside>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { Badges } from "@/lib/nav";

/**
 * Casca do app: segura o estado do menu lateral no mobile (off-canvas).
 * No desktop a sidebar é coluna fixa e o estado é ignorado.
 */
export function AppShell({
  badges,
  iniciais,
  children,
  rail,
}: {
  badges: Badges;
  iniciais: string;
  children: React.ReactNode;
  rail?: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Fecha o menu ao navegar para outra rota.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Esc fecha e o scroll do corpo trava enquanto o menu mobile está aberto.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("nav-locked");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("nav-locked");
    };
  }, [navOpen]);

  return (
    <div className="app">
      <Sidebar
        badges={badges}
        mobileOpen={navOpen}
        onClose={() => setNavOpen(false)}
      />
      <div
        className={`nav-scrim${navOpen ? " open" : ""}`}
        onClick={() => setNavOpen(false)}
        aria-hidden
      />
      <div className="main">
        <Topbar iniciais={iniciais} onMenu={() => setNavOpen(true)} navOpen={navOpen} />
        <main className="content">{children}</main>
      </div>
      {rail}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, type Badges } from "@/lib/nav";
import { Icon } from "./Icon";

export function Sidebar({
  badges,
  mobileOpen = false,
  onClose,
}: {
  badges: Badges;
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  // Sugestão 53 (c) — badge ao vivo. O SSR (layout force-dynamic + revalidate
  // layout nas ações) entrega a contagem fresca; entre atualizações, um polling leve
  // reflete mudanças externas (Cowork/chat). Quando o valor do SSR muda, resseta o
  // estado durante o render (padrão React; sem effect de sincronização).
  const [live, setLive] = useState<Badges>(badges);
  const chaveSsr = JSON.stringify(badges);
  const [chavePrev, setChavePrev] = useState(chaveSsr);
  if (chaveSsr !== chavePrev) {
    setChavePrev(chaveSsr);
    setLive(badges);
  }
  useEffect(() => {
    let vivo = true;
    const puxar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/badges", { cache: "no-store" });
        if (!r.ok) return;
        const b = (await r.json()) as Badges;
        if (vivo) setLive(b);
      } catch {
        /* offline/erro de rede: mantém o último valor, sem quebrar a UI */
      }
    };
    const t = setInterval(puxar, 60_000);
    document.addEventListener("visibilitychange", puxar);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", puxar);
    };
  }, []);
  const contagens = live;

  return (
    <aside
      id="app-nav"
      className={`sidebar${mobileOpen ? " mobile-open" : ""}`}
      aria-label="Navegação principal"
    >
      <div className="brand">
        <div className="mark">
          Fernandes <span className="amp">&amp;</span> Fernandes
        </div>
        <div className="sub">Advocacia Criminal · 20+ UFs</div>
        <button
          type="button"
          className="nav-close"
          onClick={onClose}
          aria-label="Fechar menu"
        >
          <Icon name="x" className="" />
        </button>
      </div>

      <nav className="nav">
        {NAV.map((g) => (
          <div className="nav-group" key={g.grp}>
            <h4>{g.grp}{g.ia && <span className="nav-ia-dot" aria-hidden />}</h4>
            {g.items.map((it) => {
              const active =
                pathname === it.href || pathname.startsWith(it.href + "/");
              const count = it.badgeKey ? contagens[it.badgeKey] : undefined;
              return (
                <Link
                  key={it.id}
                  href={it.href}
                  className={`nav-item${active ? " active" : ""}`}
                >
                  <Icon name={it.ico} />
                  <span>{it.label}</span>
                  {count != null && count > 0 && (
                    <span className={`badge ${it.kind ?? ""}`}>{count}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="side-foot">
        Banco: <b>fonte da verdade</b>
        <br />
        Prazos penais · dias corridos
        <br />
        <span style={{ color: "#717a92" }}>v2 · operação conforme manual</span>
      </div>
    </aside>
  );
}

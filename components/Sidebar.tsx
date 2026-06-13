"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, type Badges } from "@/lib/nav";
import { Icon } from "./Icon";

export function Sidebar({ badges }: { badges: Badges }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">
          Fernandes <span className="amp">&amp;</span> Fernandes
        </div>
        <div className="sub">Advocacia Criminal</div>
      </div>

      <nav className="nav">
        {NAV.map((g) => (
          <div className="nav-group" key={g.grp}>
            <h4>{g.grp}</h4>
            {g.items.map((it) => {
              const active =
                pathname === it.href || pathname.startsWith(it.href + "/");
              const count = it.badgeKey ? badges[it.badgeKey] : undefined;
              return (
                <Link
                  key={it.id}
                  href={it.href}
                  className={`nav-item${active ? " active" : ""}`}
                >
                  <Icon name={it.ico} />
                  <span>{it.label}</span>
                  {count != null && (
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

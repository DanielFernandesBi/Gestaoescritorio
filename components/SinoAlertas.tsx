"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { rotuloAlerta, toneAlerta, alvoAlerta, prazoAlerta } from "@/lib/alertas";
import type { AlertaVw } from "@/lib/queries";

/* Sino do topbar (Sug. 79): badge + dropdown lendo vw_alertas (via /api/alertas,
 * polling leve) e toast no canto para novos alertas críticos (prioridade 1).
 * "Ver todos" leva à /alertas. */
export function SinoAlertas() {
  const [alertas, setAlertas] = useState<AlertaVw[]>([]);
  const [aberto, setAberto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const vistos = useRef<Set<string>>(new Set());
  const primeira = useRef(true);

  useEffect(() => {
    let vivo = true;
    const chave = (a: AlertaVw) => `${a.tipo_alerta}-${a.id}`;
    const puxar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/alertas", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as AlertaVw[];
        if (!vivo) return;
        setAlertas(data);
        const criticosNovos = data.filter((a) => a.prioridade <= 1 && !vistos.current.has(chave(a)));
        data.forEach((a) => vistos.current.add(chave(a)));
        if (criticosNovos.length) {
          const n = criticosNovos.length;
          setToast(primeira.current
            ? `${n} ${n === 1 ? "alerta crítico" : "alertas críticos"} · fatal no limite`
            : `${n} ${n === 1 ? "novo prazo fatal" : "novos prazos fatais"} no limite`);
        }
        primeira.current = false;
      } catch { /* offline: mantém o último valor */ }
    };
    puxar();
    const t = setInterval(puxar, 60_000);
    document.addEventListener("visibilitychange", puxar);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", puxar); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  const total = alertas.length;
  const criticos = alertas.filter((a) => a.prioridade <= 1).length;
  const badge = criticos || total;

  return (
    <div className="sino-wrap">
      <button type="button" className="sino" aria-label={`Alertas (${total})`} onClick={() => setAberto((v) => !v)}>
        <Icon name="bell" className="" />
        {badge > 0 && <span className={`sino-badge${criticos ? " crit" : ""}`}>{badge > 99 ? "99+" : badge}</span>}
      </button>

      {aberto && (
        <>
          <div className="sino-scrim" onClick={() => setAberto(false)} aria-hidden />
          <div className="sino-pop" role="dialog" aria-label="Alertas">
            <div className="sino-pop-h">
              <span className="t">Alertas</span>
              <span className="n">{total}</span>
              <Link className="lk" href="/alertas" onClick={() => setAberto(false)}>ver todos →</Link>
            </div>
            <div className="sino-list">
              {alertas.length ? alertas.slice(0, 8).map((a) => (
                <Link key={`${a.tipo_alerta}-${a.id}`} className={`sino-item t-${toneAlerta(a.prioridade)}`} href={alvoAlerta(a)} onClick={() => setAberto(false)}>
                  <span className="sino-tag">{rotuloAlerta(a.tipo_alerta)}</span>
                  <span className="sino-mid">
                    <span className="ti">{a.segredo ? "🔒 Sigiloso" : a.titulo}</span>
                    {a.numero_cnj && !a.segredo && <span className="sub mono">{a.numero_cnj}</span>}
                  </span>
                  {prazoAlerta(a) && <span className="sino-dias">{prazoAlerta(a)}</span>}
                </Link>
              )) : <div className="sino-vazio">Sem alertas no radar. 🎉</div>}
            </div>
            {alertas.length > 8 && <Link className="sino-mais" href="/alertas" onClick={() => setAberto(false)}>+{alertas.length - 8} · ver todos na /alertas</Link>}
          </div>
        </>
      )}

      {toast && (
        <Link className="sino-toast" href="/alertas" onClick={() => setToast(null)}>
          <span className="ic"><Icon name="bell" className="" /></span>
          <span className="tx">{toast}</span>
          <span className="cta">ver →</span>
        </Link>
      )}
    </div>
  );
}

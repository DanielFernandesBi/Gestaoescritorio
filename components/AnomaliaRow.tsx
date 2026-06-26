"use client";

import { useState } from "react";
import Link from "next/link";
import { humano } from "@/lib/format";
import type { Anomalia } from "@/lib/queries";

/**
 * Linha de anomalia da varredura. Como anomalia é só um item JSON (sem id/rota
 * própria), o detalhe abre inline com o mesmo efeito de evolução do sistema
 * (teor que vai clareando) e os atalhos de apuração — sem o drawer antigo.
 */
export function AnomaliaRow({ a, critico }: { a: Anomalia; critico?: boolean }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className={`anom-row${aberto ? " aberto" : ""}`}>
      <button
        type="button"
        className="anom-trigger"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <span className={`anom-dot ${critico ? "crit" : "warn"}`} />
        <span className="anom-main">
          <span className="anom-h">
            <span className={`anom-tipo ${critico ? "crit" : ""}`}>{humano(a.tipo)}</span>
            <span className="anom-fonte">{humano(a.fonte)}</span>
          </span>
          <span className="anom-det">{a.detalhe}</span>
        </span>
        <span className={`anom-caret${aberto ? " on" : ""}`}>⌄</span>
      </button>

      {aberto && (
        <div className="anom-painel">
          <div className="anom-detalhe">{a.detalhe}</div>
          <div className="anom-apurar">
            <Link className="anom-link" href="/auditoria">
              <span className="t">Abrir auditoria</span>
              <span className="s">Registro completo da varredura e eventos.</span>
            </Link>
            <Link className="anom-link" href="/intimacoes">
              <span className="t">Triagem de intimações</span>
              <span className="s">Se for falha de captação, confira as órfãs.</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

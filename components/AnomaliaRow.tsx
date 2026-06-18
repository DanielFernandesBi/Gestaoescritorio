"use client";

import Link from "next/link";
import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import type { Anomalia } from "@/lib/queries";

/**
 * Linha de anomalia da varredura. Como anomalia é só um item JSON (sem id/rota),
 * abre o drawer em memória do sistema com o detalhe completo e atalhos de
 * apuração — mantendo o mesmo padrão visual do restante.
 */
export function AnomaliaRow({ a, critico }: { a: Anomalia; critico?: boolean }) {
  const { open } = useDrawer();

  function abrir() {
    open({
      title: (
        <>
          <h2>Anomalia da varredura</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill tone="red">{a.fonte.toUpperCase()}</Pill>
            <Pill tone="amber" dot={false}>{a.tipo}</Pill>
          </div>
        </>
      ),
      body: (
        <>
          <div className="dsec">
            <h4>Detalhe</h4>
            <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>
              {a.detalhe}
            </p>
          </div>
          <div className="dsec">
            <h4>Apurar</h4>
            <div className="mini-list">
              <Link className="mini" href="/auditoria">
                <div>
                  <div className="mt">Abrir auditoria</div>
                  <div className="ms">Registro completo da varredura e eventos.</div>
                </div>
                <span className="link">abrir</span>
              </Link>
              <Link className="mini" href="/intimacoes">
                <div>
                  <div className="mt">Triagem de intimações</div>
                  <div className="ms">Se for falha de captação, confira as órfãs.</div>
                </div>
                <span className="link">abrir</span>
              </Link>
            </div>
          </div>
        </>
      ),
    });
  }

  return (
    <div
      className="op-row op-click"
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          abrir();
        }
      }}
    >
      <div>
        <div className="ot" style={critico ? { color: "var(--red)" } : undefined}>
          {a.fonte.toUpperCase()} · {a.tipo}
        </div>
        <div className="os">{a.detalhe}</div>
      </div>
    </div>
  );
}

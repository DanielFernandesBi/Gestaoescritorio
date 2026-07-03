"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmarAtoCanonico, desvincularAtoCanonico, type Resultado } from "@/app/actions";
import { humano } from "@/lib/format";
import type { AtoCanonico, AtoFonte } from "@/lib/data";

const fonteAto = (o: string | null) => {
  const f = (o ?? "").toLowerCase();
  return f === "djen" ? "DJEN" : f === "dje" ? "DJE" : f === "push" ? "e-mail push"
    : f === "email" ? "e-mail" : f === "radar" ? "Radar" : f === "redacao" ? "Redação" : (o ? o.toUpperCase() : "—");
};

/**
 * Sug. 75 · etapa 4 — "Confirmar mesmo ato" numa linha da timeline canônica.
 * Só para CLUSTER de intimações gêmeas ainda não confirmadas (ato_canonico_id NULL).
 * O usuário escolhe a canônica; grava ato_canonico_id em todas; opcionalmente
 * sincroniza o status divergente pelo canônico. Confirmação por cluster, nunca em massa.
 */
export function ConfirmarAto({ a }: { a: AtoCanonico }) {
  const router = useRouter();
  const fontes: AtoFonte[] = [a.principal, ...a.outras];
  const ids = fontes.map((f) => f.id);

  const [aberto, setAberto] = useState(false);
  const [canonica, setCanonica] = useState(a.principal.id); // default: fonte de maior autoridade
  const [sinc, setSinc] = useState(a.status_divergente); // divergente → sugere sincronizar
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  async function confirmar() {
    setPend(true);
    const r = await confirmarAtoCanonico(canonica, ids, sinc);
    setPend(false);
    setRes(r);
    if (r.ok) { router.refresh(); setTimeout(() => setAberto(false), 1100); }
  }

  async function desvincular() {
    setPend(true);
    const r = await desvincularAtoCanonico(ids);
    setPend(false);
    setRes(r);
    if (r.ok) router.refresh();
  }

  // Cluster já confirmado → badge + desfazer.
  if (a.confirmado) {
    return (
      <div className="ato-conf">
        <span className="ato-conf-badge">✓ ato confirmado · status sincronizado automaticamente</span>
        <button type="button" className="ato-desvincular" onClick={desvincular} disabled={pend}>
          {pend ? "…" : "Desvincular gêmeas"}
        </button>
        {res && !res.ok && <span className="ato-conf-err">{res.message}</span>}
      </div>
    );
  }

  return (
    <>
      <button type="button" className="ato-confirmar" onClick={() => { setRes(null); setAberto(true); }}>
        Confirmar mesmo ato
      </button>
      {aberto && (
        <div className="modal-scrim" onClick={() => setAberto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>Confirmar “mesmo ato”</h3>
              <p>Estas {fontes.length} intimações parecem ser o mesmo ato captado por fontes diferentes. Escolha a <b>canônica</b>; as demais ficam vinculadas a ela (nada é apagado nem escondido).</p>
            </div>
            <div className="modal-b">
              <div className="ato-escolha">
                {fontes.map((f) => (
                  <label key={f.id} className={`ato-opt${canonica === f.id ? " on" : ""}`}>
                    <input type="radio" name="canonica" value={f.id} checked={canonica === f.id} onChange={() => setCanonica(f.id)} />
                    <div className="ato-opt-main">
                      <div className="ato-opt-h">
                        <span className="ato-opt-fonte">{fonteAto(f.origem)}</span>
                        {f.status && <span className={`pz-tag ${f.status === "providencia_tomada" ? "val" : f.status === "arquivada" ? "cat-neutral" : f.status === "em_analise" ? "cat-blue" : "tang"}`}>{humano(f.status)}</span>}
                        {a.principal.id === f.id && <span className="ato-opt-sug">sugerida</span>}
                      </div>
                      <div className="ato-opt-txt">{f.amostra?.trim() || "—"}</div>
                    </div>
                  </label>
                ))}
              </div>

              {a.status_divergente && (
                <label className="ato-sinc">
                  <input type="checkbox" checked={sinc} onChange={(e) => setSinc(e.target.checked)} />
                  <span>Os status divergem entre as fontes. <b>Sincronizar agora</b> as irmãs pelo status da canônica? (as mudanças futuras já propagam sozinhas)</span>
                </label>
              )}

              <p className="sub" style={{ margin: 0 }}>Confirmar grava apenas o vínculo de ato canônico; não altera status por conta própria (salvo a sincronização acima, se marcada).</p>
              {res && <div className={`modal-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
            </div>
            <div className="modal-f">
              <button className="btn ghost" type="button" onClick={() => setAberto(false)} disabled={pend}>Cancelar</button>
              <button className="btn primary" type="button" onClick={confirmar} disabled={pend || Boolean(res?.ok)}>
                {pend ? "Confirmando…" : "Confirmar mesmo ato"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

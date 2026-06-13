"use client";

import { useDrawer } from "./Drawer";
import { DiasBox, ProcRef } from "./ui";
import { Icon } from "./Icon";
import { fmtDate } from "@/lib/format";
import type { PrazoAberto } from "@/lib/queries";

export function PrazoRow({ p }: { p: PrazoAberto }) {
  const { open } = useDrawer();

  function abrir() {
    open({
      title: (
        <>
          <h2>{p.ato}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <DiasBox dias={p.dias_restantes} />
            <span className="gate done">✓ validado</span>
          </div>
        </>
      ),
      body: (
        <>
          <div className="dsec">
            <h4>Contagem</h4>
            <div className="dgrid">
              <div className="field">
                <div className="k">Data fatal</div>
                <div className="v mono" style={{ color: "var(--red)" }}>
                  {fmtDate(p.data_fatal)}
                </div>
              </div>
              <div className="field">
                <div className="k">Data interna</div>
                <div className="v mono">{fmtDate(p.data_interna)}</div>
              </div>
              <div className="field">
                <div className="k">Responsável</div>
                <div className="v">{p.responsavel ?? "—"}</div>
              </div>
              <div className="field">
                <div className="k">Dias restantes</div>
                <div className="v mono">{p.dias_restantes}</div>
              </div>
            </div>
          </div>

          <div className="dsec">
            <h4>Processo</h4>
            <div className="mini">
              <div>
                <div className="mt">
                  <ProcRef cnj={p.numero_cnj} />
                </div>
                <div className="ms">
                  {[p.tribunal, p.vara_comarca].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="ms">{p.clientes ?? "—"}</div>
              </div>
            </div>
          </div>

          <div className="dsec">
            <h4>Atenção</h4>
            <div className="banner" style={{ margin: 0 }}>
              <span className="ico">
                <Icon name="shield" />
              </span>
              <div>
                Prazo penal em <b>dias corridos</b> (CPP art. 798). Conferir
                feriado local e suspensão de expediente no tribunal antes de
                confiar na data fatal.
              </div>
            </div>
          </div>
        </>
      ),
    });
  }

  return (
    <tr className="clickable" onClick={abrir}>
      <td style={{ width: 64 }}>
        <DiasBox dias={p.dias_restantes} />
      </td>
      <td>
        <div className="name">{p.ato}</div>
        <div className="sub">
          {(p.clientes ?? "—")} · {p.tribunal ?? "—"}
        </div>
      </td>
      <td className="right">
        <div className="mono" style={{ fontWeight: 600 }}>
          {fmtDate(p.data_fatal)}
        </div>
        <div className="sub">interna {fmtDate(p.data_interna)}</div>
      </td>
    </tr>
  );
}

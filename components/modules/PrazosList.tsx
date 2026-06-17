"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { DiasBox, ProcRef, SegredoTag, Gate } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { PrazoDetalhe } from "@/components/detalhe/PrazoDetalhe";
import { fmtDate, humano } from "@/lib/format";
import type { Prazo } from "@/lib/data";

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "crit", label: "Críticos (≤2d)" },
  { id: "semana", label: "Esta semana" },
  { id: "Daniel", label: "Daniel" },
  { id: "Rodolfo", label: "Rodolfo" },
];

export function PrazosList({ prazos }: { prazos: Prazo[] }) {
  const { open } = useDrawer();
  const [f, setF] = useState("todos");

  const filtrados = useMemo(() => {
    return prazos.filter((p) => {
      if (f === "crit") return p.dias_restantes <= 2;
      if (f === "semana") return p.dias_restantes >= 0 && p.dias_restantes <= 7;
      if (f === "Daniel" || f === "Rodolfo") return p.responsavel === f;
      return true;
    });
  }, [prazos, f]);

  const opcoes = FILTROS.map((o) =>
    o.id === "todos" ? { ...o, label: `Todos (${prazos.length})` } : o,
  );

  return (
    <>
      <Chips options={opcoes} value={f} onChange={setF} />
      <div className="card">
        <div className="card-b flush">
          {filtrados.length ? (
            <table>
              <thead>
                <tr>
                  <th>Prazo</th>
                  <th>Ato</th>
                  <th>Processo / cliente</th>
                  <th>Resp.</th>
                  <th>Interna</th>
                  <th>Fatal</th>
                  <th className="center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={p.id}
                    className="clickable"
                    onClick={() =>
                      open({
                        title: (
                          <>
                            <h2>{p.ato}</h2>
                            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <DiasBox dias={p.dias_restantes} />
                              <SegredoTag on={p.segredo} />
                              <Gate validado={p.validado} />
                            </div>
                          </>
                        ),
                        body: <PrazoDetalhe p={p} />,
                      })
                    }
                  >
                    <td style={{ width: 64 }}><DiasBox dias={p.dias_restantes} /></td>
                    <td>
                      <div className="name">{p.ato}</div>
                      <div className="sub">
                        {humano(p.tipo_contagem)} · {p.segredo ? <SegredoTag on /> : p.vara_comarca}
                      </div>
                    </td>
                    <td>
                      <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} />
                      <div className="sub">{p.clientes || "—"}</div>
                    </td>
                    <td>{p.responsavel ?? "—"}</td>
                    <td className="mono">{fmtDate(p.data_interna)}</td>
                    <td className="mono" style={{ color: "var(--red)", fontWeight: 600 }}>{fmtDate(p.data_fatal)}</td>
                    <td className="center"><Gate validado={p.validado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum prazo neste filtro.</div>
          )}
        </div>
      </div>
    </>
  );
}

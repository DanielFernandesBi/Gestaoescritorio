"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { ContratoDetalhe } from "@/components/detalhe/ContratoDetalhe";
import { fmtBRL, humano } from "@/lib/format";
import type { Contrato } from "@/lib/data";

const TONE: Record<string, "green" | "amber" | "red" | "gray"> = {
  vigente: "green", quitado: "gray", rescindido: "red", inadimplente: "red",
};

export function ContratosList({ contratos }: { contratos: Contrato[] }) {
  const { open } = useDrawer();
  const [f, setF] = useState("todos");

  const filtrados = useMemo(
    () =>
      contratos.filter((c) =>
        f === "todos" ? true : f === "abertos" ? c.total_aberto > 0 : c.status === f,
      ),
    [contratos, f],
  );

  const opcoes = [
    { id: "todos", label: `Todos (${contratos.length})` },
    { id: "vigente", label: `Vigentes (${contratos.filter((c) => c.status === "vigente").length})` },
    { id: "abertos", label: `Com saldo (${contratos.filter((c) => c.total_aberto > 0).length})` },
    { id: "inadimplente", label: `Inadimplentes (${contratos.filter((c) => c.status === "inadimplente").length})` },
  ];

  function abrir(c: Contrato) {
    open({
      title: (
        <>
          <h2>{c.cliente}</h2>
          <div style={{ marginTop: 8 }}>
            <Pill tone={TONE[c.status] ?? "gray"}>{humano(c.status)}</Pill>{" "}
            <span className="sub">{fmtBRL(c.valor_total)}</span>
          </div>
        </>
      ),
      body: <ContratoDetalhe contrato={c} />,
    });
  }

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Chips options={opcoes} value={f} onChange={setF} />
      </div>
      <div className="card">
        <div className="card-b flush">
          {filtrados.length ? (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Objeto</th>
                  <th className="right">Total</th>
                  <th className="right">Em aberto</th>
                  <th className="center">Parcelas</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => abrir(c)}>
                    <td className="name">{c.cliente}</td>
                    <td className="sub" style={{ maxWidth: 320 }}>{c.objeto}</td>
                    <td className="right money">{fmtBRL(c.valor_total)}</td>
                    <td className="right money" style={c.total_atraso > 0 ? { color: "var(--red)" } : undefined}>
                      {c.total_aberto > 0 ? fmtBRL(c.total_aberto) : "—"}
                    </td>
                    <td className="center mono">{c.qtd_parcelas}</td>
                    <td className="center"><Pill tone={TONE[c.status] ?? "gray"}>{humano(c.status)}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum contrato neste filtro.</div>
          )}
        </div>
      </div>
    </>
  );
}

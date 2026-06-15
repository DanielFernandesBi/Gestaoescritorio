"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { EstudoDetalhe } from "@/components/detalhe/EstudoDetalhe";
import { fmtDate, humano } from "@/lib/format";
import type { EstudoResumo } from "@/lib/data";

const statusTone = (s: string) =>
  s === "aplicado" ? "green" : s === "concluido" ? "blue" : s === "superado" ? "gray" : "amber";

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "em_elaboracao", label: "Em elaboração" },
  { id: "aplicado", label: "Aplicados" },
  { id: "execucao_global", label: "Execução" },
];

export function EstudosList({ estudos }: { estudos: EstudoResumo[] }) {
  const { open } = useDrawer();
  const [f, setF] = useState("todos");

  const filtrados = useMemo(
    () =>
      estudos.filter((e) =>
        f === "todos" ? true : f === "execucao_global" ? e.tipo === "execucao_global" : e.status === f,
      ),
    [estudos, f],
  );

  const opcoes = FILTROS.map((o) => (o.id === "todos" ? { ...o, label: `Todos (${estudos.length})` } : o));

  function abrir(e: EstudoResumo) {
    open({
      title: (
        <>
          <h2>{e.titulo}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill tone={statusTone(e.status)}>{humano(e.status)}</Pill>
            {e.cliente && <Pill tone="brass" dot={false}>{e.cliente}</Pill>}
          </div>
        </>
      ),
      body: <EstudoDetalhe estudoId={e.id} />,
    });
  }

  return (
    <>
      <Chips options={opcoes} value={f} onChange={setF} />
      <div className="card">
        <div className="card-b flush">
          {filtrados.length ? (
            <table>
              <thead>
                <tr>
                  <th>Estudo</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th className="center">Processos</th>
                  <th className="center">Objetivos</th>
                  <th>Próximo marco</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => abrir(e)}>
                    <td><div className="name">{e.titulo}</div></td>
                    <td>{e.cliente ?? "—"}</td>
                    <td>{humano(e.tipo)}</td>
                    <td className="center mono">{e.n_processos || "—"}</td>
                    <td className="center mono">{e.n_objetivos ? `${e.n_atingidos}/${e.n_objetivos}` : "—"}</td>
                    <td className="mono">{fmtDate(e.proximo_marco)}</td>
                    <td className="center"><Pill tone={statusTone(e.status)}>{humano(e.status)}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum estudo neste filtro.</div>
          )}
        </div>
      </div>
    </>
  );
}

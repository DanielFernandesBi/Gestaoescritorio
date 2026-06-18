"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { FiltrosCard } from "@/components/FiltrosCard";
import { ContratoDetalhe } from "@/components/detalhe/ContratoDetalhe";
import { fmtBRL, humano } from "@/lib/format";
import type { Contrato } from "@/lib/data";

const TONE: Record<string, "green" | "amber" | "red" | "gray"> = {
  vigente: "green", quitado: "gray", rescindido: "red", inadimplente: "red",
};

// Ordem de exibição em "Todos": vigentes primeiro, quitados por último.
const ORDEM: Record<string, number> = { vigente: 0, inadimplente: 1, rescindido: 2, quitado: 3 };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function ContratosList({ contratos }: { contratos: Contrato[] }) {
  const { open } = useDrawer();
  const [f, setF] = useState("todos");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = norm(busca.trim());
    const base = contratos.filter((c) => {
      const okF =
        f === "todos" ? true
          : f === "abertos" ? c.total_aberto > 0
            : f === "inadimplente" ? c.total_atraso > 0
              : c.status === f;
      const okQ = q ? norm(c.cliente).includes(q) : true;
      return okF && okQ;
    });
    // Ordena por status (vigente → … → quitado), preservando a ordem por data.
    return [...base].sort((a, b) => (ORDEM[a.status] ?? 9) - (ORDEM[b.status] ?? 9));
  }, [contratos, f, busca]);

  const opcoes = [
    { id: "todos", label: `Todos (${contratos.length})` },
    { id: "vigente", label: `Vigentes (${contratos.filter((c) => c.status === "vigente").length})` },
    { id: "abertos", label: `Com saldo (${contratos.filter((c) => c.total_aberto > 0).length})` },
    { id: "inadimplente", label: `Inadimplentes (${contratos.filter((c) => c.total_atraso > 0).length})` },
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
      <FiltrosCard>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Chips options={opcoes} value={f} onChange={setF} />
          <input
            placeholder="Filtrar por cliente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              marginLeft: "auto",
              padding: "6px 12px",
              border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit",
              background: "var(--surface)", color: "var(--text)", minWidth: 200,
            }}
          />
        </div>
      </FiltrosCard>
      <div className="card op-card">
        <div className="card-h">
          <h3><Icon name="folder" /> Contratos</h3>
          <span className="sub">{filtrados.length} no filtro</span>
        </div>
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

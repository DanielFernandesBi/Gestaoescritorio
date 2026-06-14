"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { ClienteDetalhe } from "@/components/detalhe/ClienteDetalhe";
import type { Cliente } from "@/lib/data";

type Tone = "red" | "amber" | "green" | "blue" | "gray" | "brass";
const SIT: Record<string, [string, Tone]> = {
  solto: ["Solto", "gray"],
  preso_provisorio: ["Preso provisório", "red"],
  preso_definitivo: ["Preso definitivo", "red"],
  regime_semiaberto: ["Semiaberto", "amber"],
  regime_aberto: ["Aberto", "amber"],
  monitoramento: ["Tornozeleira", "blue"],
  foragido: ["Foragido", "red"],
  falecido: ["Falecido", "gray"],
};
const sitDe = (s: string | null): [string, Tone] => SIT[s ?? ""] ?? [s ?? "—", "gray"];
const preso = (s: string | null) => s === "preso_provisorio" || s === "preso_definitivo";

const PASSO = 60;

export function ClientesList({ clientes }: { clientes: Cliente[] }) {
  const { open } = useDrawer();
  const [f, setF] = useState("todos");
  const [busca, setBusca] = useState("");
  const [visiveis, setVisiveis] = useState(PASSO);

  const filtrados = useMemo(
    () =>
      clientes.filter((c) => {
        const okF =
          f === "presos"
            ? preso(c.situacao_prisional)
            : f === "monitoramento"
              ? c.situacao_prisional === "monitoramento"
              : f === "auto"
                ? c.cadastro_automatico
                : true;
        const okBusca = busca
          ? c.nome.toLowerCase().includes(busca.toLowerCase())
          : true;
        return okF && okBusca;
      }),
    [clientes, f, busca],
  );

  const mostrados = filtrados.slice(0, visiveis);

  const opcoes = [
    { id: "todos", label: `Todos (${clientes.length})` },
    { id: "presos", label: `Presos (${clientes.filter((c) => preso(c.situacao_prisional)).length})` },
    { id: "monitoramento", label: "Monitoramento" },
    { id: "auto", label: `Cadastro automático (${clientes.filter((c) => c.cadastro_automatico).length})` },
  ];

  function abrir(c: Cliente) {
    const [lbl, tone] = sitDe(c.situacao_prisional);
    open({
      title: (
        <>
          <h2>{c.nome}</h2>
          <div style={{ marginTop: 8 }}><Pill tone={tone}>{lbl}</Pill></div>
        </>
      ),
      body: <ClienteDetalhe cliente={c} />,
    });
  }

  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Chips options={opcoes} value={f} onChange={(v) => { setF(v); setVisiveis(PASSO); }} />
        <input
          className="filtro-nome"
          placeholder="Filtrar por nome…"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setVisiveis(PASSO); }}
          style={{
            marginLeft: "auto", marginBottom: 18, padding: "6px 12px",
            border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit",
            background: "var(--surface)", color: "var(--text)", minWidth: 200,
          }}
        />
      </div>
      <div className="card">
        <div className="card-b flush">
          {mostrados.length ? (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CPF</th>
                  <th>UF</th>
                  <th>Situação prisional</th>
                  <th className="center">Processos</th>
                  <th className="center">Prazos</th>
                </tr>
              </thead>
              <tbody>
                {mostrados.map((c) => {
                  const [lbl, tone] = sitDe(c.situacao_prisional);
                  return (
                    <tr key={c.id} className="clickable" onClick={() => abrir(c)}>
                      <td>
                        <div className="name">{c.nome}</div>
                        {c.cadastro_automatico && <div className="sub" style={{ color: "var(--blue)" }}>cadastro automático</div>}
                      </td>
                      <td className="mono">{c.cpf ?? "—"}</td>
                      <td>{c.uf ?? "—"}</td>
                      <td>
                        <Pill tone={tone}>{lbl}</Pill>
                        {c.unidade_prisional && <div className="sub">{c.unidade_prisional}</div>}
                      </td>
                      <td className="center mono">{c.total_processos}</td>
                      <td className="center mono">{c.prazos_abertos || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum cliente neste filtro.</div>
          )}
        </div>
      </div>

      {visiveis < filtrados.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button className="btn" onClick={() => setVisiveis((v) => v + PASSO)}>
            Carregar mais ({filtrados.length - visiveis} restantes)
          </button>
        </div>
      )}
    </>
  );
}

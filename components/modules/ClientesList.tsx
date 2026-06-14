"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
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

export function ClientesList({ clientes }: { clientes: Cliente[] }) {
  const { open } = useDrawer();
  const [f, setF] = useState("todos");

  const filtrados = useMemo(
    () =>
      clientes.filter((c) => {
        if (f === "presos") return preso(c.situacao_prisional);
        if (f === "monitoramento") return c.situacao_prisional === "monitoramento";
        if (f === "auto") return c.cadastro_automatico;
        return true;
      }),
    [clientes, f],
  );

  const opcoes = [
    { id: "todos", label: `Todos (${clientes.length})` },
    { id: "presos", label: `Presos (${clientes.filter((c) => preso(c.situacao_prisional)).length})` },
    { id: "monitoramento", label: "Monitoramento" },
    { id: "auto", label: `Cadastro automático (${clientes.filter((c) => c.cadastro_automatico).length})` },
  ];

  return (
    <>
      <Chips options={opcoes} value={f} onChange={setF} />
      <div className="card">
        <div className="card-b flush">
          {filtrados.length ? (
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
                {filtrados.map((c) => {
                  const [lbl, tone] = sitDe(c.situacao_prisional);
                  return (
                    <tr
                      key={c.id}
                      className="clickable"
                      onClick={() =>
                        open({
                          title: (
                            <>
                              <h2>{c.nome}</h2>
                              <div style={{ marginTop: 8 }}>
                                <Pill tone={tone}>{lbl}</Pill>
                              </div>
                            </>
                          ),
                          body: (
                            <>
                              <div className="dsec">
                                <h4>Ficha</h4>
                                <div className="dgrid">
                                  <div className="field"><div className="k">CPF</div><div className="v mono">{c.cpf ?? "—"}</div></div>
                                  <div className="field"><div className="k">UF</div><div className="v">{c.uf ?? "—"}</div></div>
                                  <div className="field"><div className="k">Situação prisional</div><div className="v">{lbl}</div></div>
                                  <div className="field"><div className="k">Unidade prisional</div><div className="v">{c.unidade_prisional ?? "—"}</div></div>
                                </div>
                              </div>
                              <div className="dsec">
                                <h4>Consolidado (vw_situacao_cliente)</h4>
                                <div className="dgrid">
                                  <div className="field"><div className="k">Processos</div><div className="v mono">{c.total_processos} ({c.processos_ativos} ativos)</div></div>
                                  <div className="field"><div className="k">Prazos abertos</div><div className="v mono">{c.prazos_abertos}</div></div>
                                  <div className="field"><div className="k">Audiências futuras</div><div className="v mono">{c.audiencias_futuras}</div></div>
                                </div>
                              </div>
                              {c.cadastro_automatico && (
                                <div className="banner" style={{ margin: 0 }}>
                                  <span className="ico">ℹ</span>
                                  <div>Cliente de <b>cadastro automático</b> — confira os dados antes de usar em peça.</div>
                                </div>
                              )}
                            </>
                          ),
                        })
                      }
                    >
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
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { ProcRef, SegredoTag, Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { humano } from "@/lib/format";
import type { Processo } from "@/lib/data";

export function ProcessosList({
  processos,
  totalAtivos,
}: {
  processos: Processo[];
  totalAtivos: number;
}) {
  const { open } = useDrawer();
  const [f, setF] = useState("ativos");

  const filtrados = useMemo(
    () =>
      processos.filter((p) => {
        if (f === "semcnj") return !p.numero_cnj;
        if (f === "superior") return p.instancia === "stj" || p.instancia === "stf";
        if (f === "execucao") return p.area === "execucao_penal";
        if (f === "hc") return p.area === "habeas_corpus";
        if (f === "segredo") return p.segredo;
        if (f === "auto") return p.cadastro_automatico;
        return true;
      }),
    [processos, f],
  );

  const opcoes = [
    { id: "ativos", label: `Carregados (${processos.length})` },
    { id: "semcnj", label: "Sem CNJ" },
    { id: "superior", label: "STJ/STF" },
    { id: "execucao", label: "Execução penal" },
    { id: "hc", label: "Habeas corpus" },
    { id: "segredo", label: "Segredo de justiça" },
    { id: "auto", label: "Cadastro automático" },
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
                  <th>Processo</th>
                  <th>Tribunal / instância</th>
                  <th>Área</th>
                  <th>Cliente</th>
                  <th>Resp.</th>
                  <th className="center">Status</th>
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
                            <h2>{p.segredo ? "Processo em segredo de justiça" : p.clientes || "Processo"}</h2>
                            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} />
                              <SegredoTag on={p.segredo} />
                            </div>
                          </>
                        ),
                        body: (
                          <>
                            <div className="dsec">
                              <h4>Dados</h4>
                              <div className="dgrid">
                                <div className="field"><div className="k">Tribunal</div><div className="v">{p.tribunal ?? "—"}</div></div>
                                <div className="field"><div className="k">Vara / comarca</div><div className="v">{p.vara_comarca ?? "—"}</div></div>
                                <div className="field"><div className="k">Instância</div><div className="v">{(p.instancia ?? "—").toUpperCase()} · {p.uf ?? "—"}</div></div>
                                <div className="field"><div className="k">Área</div><div className="v">{humano(p.area)}</div></div>
                                <div className="field"><div className="k">Classe</div><div className="v">{p.classe ?? "—"}</div></div>
                                <div className="field"><div className="k">Responsável</div><div className="v">{p.responsavel ?? "—"}</div></div>
                              </div>
                            </div>
                            <div className="dsec">
                              <h4>Parte</h4>
                              <div className="mini">
                                <div>
                                  <div className="mt">{p.segredo ? "— (sigiloso)" : p.clientes || "—"}</div>
                                  <div className="ms">papel: {p.papel ?? "—"}</div>
                                </div>
                              </div>
                            </div>
                          </>
                        ),
                      })
                    }
                  >
                    <td>
                      <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} />
                      <div className="sub">
                        {p.classe ?? "—"}{p.cadastro_automatico ? " · " : ""}
                        {p.cadastro_automatico && <span style={{ color: "var(--blue)" }}>auto</span>}
                      </div>
                    </td>
                    <td>
                      <div className="name">{p.tribunal ?? "—"}</div>
                      <div className="sub">{(p.instancia ?? "—").toUpperCase()} · {p.uf ?? "—"}</div>
                    </td>
                    <td><Pill tone="gray" dot={false}>{humano(p.area)}</Pill></td>
                    <td>
                      {p.segredo ? <SegredoTag on /> : <span className="name" style={{ fontWeight: 500 }}>{p.clientes || "—"}</span>}
                      <div className="sub">{p.papel ?? ""}</div>
                    </td>
                    <td>{p.responsavel ?? "—"}</td>
                    <td className="center"><Pill tone="green">{p.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum processo neste filtro (entre os {processos.length} carregados).</div>
          )}
        </div>
      </div>
      <p className="sub" style={{ marginTop: 12, textAlign: "center", color: "var(--muted-2)" }}>
        Exibindo os {processos.length} processos ativos mais recentes de {totalAtivos.toLocaleString("pt-BR")} no total.
        A busca global encontra qualquer processo por CNJ ou nº de registro.
      </p>
    </>
  );
}

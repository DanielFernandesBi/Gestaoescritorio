"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui";
import { PromoverProcessoForm } from "@/components/modules/PromoverProcessoForm";
import { promoverOrfa } from "@/app/actions";
import { fmtDate, humano } from "@/lib/format";
import type { AndamentoOrfao } from "@/lib/data";

type ProcLite = { id: string; label: string };
type CliLite = { id: string; nome: string };

export function AndamentosOrfaosList({ orfaos }: { orfaos: AndamentoOrfao[] }) {
  const [procs, setProcs] = useState<ProcLite[]>([]);
  const [clis, setClis] = useState<CliLite[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/processos-lite").then((r) => r.json()).then((d) => vivo && setProcs(d.processos ?? [])).catch(() => {});
    fetch("/api/clientes-lite").then((r) => r.json()).then((d) => vivo && setClis(d.clientes ?? [])).catch(() => {});
    return () => { vivo = false; };
  }, []);

  return (
    <>
      <div className="banner" style={{ marginTop: 0 }}>
        <span className="ico">⚠</span>
        <div>
          <b>Fila de andamentos órfãos.</b> Movimentações sem processo identificado.
          Promova cada uma identificando o processo (por CNJ/registro, com resolução de mesclagem) — nada se perde, tudo é auditado.
        </div>
      </div>
      <div className="card">
        <div className="card-b flush">
          {orfaos.length ? (
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Origem</th>
                  <th className="right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {orfaos.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{fmtDate(a.data)}</td>
                    <td><Pill tone="gray" dot={false}>{humano(a.tipo)}</Pill></td>
                    <td>
                      <div className="name">{a.descricao || "—"}</div>
                      <div className="sub" style={{ color: "var(--amber)" }}>⚠ sem processo identificado — triagem humana</div>
                    </td>
                    <td className="sub">{(a.origem ?? a.cadastrado_por ?? "—").toUpperCase()}</td>
                    <td className="right">
                      <PromoverProcessoForm
                        titulo={`Promover andamento órfão — ${humano(a.tipo)}`}
                        descricao="Identifica/cadastra o processo e vincula o andamento. Nada é apagado; tudo é auditado."
                        acao={promoverOrfa.bind(null, "andamento", a.id)}
                        procs={procs}
                        clis={clis}
                        enviarLabel="Vincular andamento"
                        header={
                          <p className="sub" style={{ marginTop: 0 }}>
                            {fmtDate(a.data)} · {humano(a.tipo)}{a.descricao ? ` — ${a.descricao}` : ""}
                          </p>
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum andamento órfão. Toda movimentação está vinculada a um processo. 🎉</div>
          )}
        </div>
      </div>
    </>
  );
}

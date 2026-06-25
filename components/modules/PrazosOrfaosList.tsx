"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DiasBox } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PromoverOrfao, type ProcLite, type CliLite } from "@/components/PromoverOrfao";
import { fmtDate, humano } from "@/lib/format";
import type { PrazoOrfao } from "@/lib/data";

export function PrazosOrfaosList({ orfaos }: { orfaos: PrazoOrfao[] }) {
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
          <b>Fila de prazos órfãos.</b> Fatais cadastradas sem processo (provisórias, <b>validado=false</b>).
          Nenhuma fatal fica invisível: promova cada uma costurando o processo e o cliente para liberar a validação.
        </div>
      </div>
      <div className="card op-card">
        <div className="card-h"><h3><Icon name="shield" /> Órfãos / triagem ({orfaos.length})</h3></div>
        <div className="card-b flush">
          {orfaos.length ? (
            <table>
              <thead>
                <tr>
                  <th>Prazo</th>
                  <th>Ato</th>
                  <th>Origem</th>
                  <th>Resp.</th>
                  <th>Interna</th>
                  <th>Fatal</th>
                  <th className="right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {orfaos.map((p) => (
                  <tr key={p.prazo_id}>
                    <td style={{ width: 64 }}><DiasBox dias={p.dias_restantes} /></td>
                    <td>
                      <div className="name">{p.ato}</div>
                      <div className="sub" style={{ color: "var(--amber)" }}>⚠ provisório · sem processo</div>
                    </td>
                    <td>
                      {p.intimacao_id ? (
                        <Link className="link" href="/intimacoes" title={p.intimacao_resumo ?? ""}>intimação</Link>
                      ) : (
                        <span className="sub">{humano(p.cadastrado_por) || "—"}</span>
                      )}
                    </td>
                    <td>{p.responsavel ?? "—"}</td>
                    <td className="mono">{fmtDate(p.data_interna)}</td>
                    <td className="mono" style={{ color: "var(--red)", fontWeight: 600 }}>{fmtDate(p.data_fatal)}</td>
                    <td className="right"><PromoverOrfao p={p} procs={procs} clis={clis} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum prazo órfão. Toda fatal está vinculada a um processo. 🎉</div>
          )}
        </div>
      </div>
    </>
  );
}

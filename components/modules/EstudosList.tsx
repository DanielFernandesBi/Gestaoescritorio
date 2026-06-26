"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { FiltrosCard } from "@/components/FiltrosCard";
import { fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { EstudoResumo } from "@/lib/data";

const statusTone = (s: string) =>
  s === "aplicado" ? "green" : s === "concluido" ? "blue" : s === "superado" ? "gray" : "amber";

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "em_elaboracao", label: "Em elaboração" },
  { id: "aplicado", label: "Aplicados" },
  { id: "execucao_global", label: "Execução" },
];

export function EstudosList({ estudos, clienteFiltro }: { estudos: EstudoResumo[]; clienteFiltro?: string }) {
  const router = useRouter();
  const [f, setF] = useState("todos");

  // Sugestão 41: deep-link por cliente — quando vem ?cliente=<id>, a lista já
  // nasce restrita aos estudos daquele cliente (preserva o contexto da ficha).
  const base = useMemo(
    () => (clienteFiltro ? estudos.filter((e) => e.cliente_id === clienteFiltro) : estudos),
    [estudos, clienteFiltro],
  );
  const nomeCliente = clienteFiltro ? base[0]?.cliente ?? null : null;

  const filtrados = useMemo(
    () =>
      base.filter((e) =>
        f === "todos" ? true : f === "execucao_global" ? e.tipo === "execucao_global" : e.status === f,
      ),
    [base, f],
  );

  const opcoes = FILTROS.map((o) => (o.id === "todos" ? { ...o, label: `Todos (${base.length})` } : o));

  function abrir(e: EstudoResumo) {
    router.push(linkPara("estudo", e.id));
  }

  return (
    <>
      {clienteFiltro && (
        <div className="banner" style={{ marginBottom: 16 }}>
          <span className="ico"><Icon name="book" /></span>
          <div>
            Mostrando os estudos {nomeCliente ? <>de <b>{nomeCliente}</b></> : "deste cliente"}.{" "}
            <Link className="link" href="/estudos">ver todos os estudos</Link>
          </div>
        </div>
      )}

      <FiltrosCard>
        <Chips options={opcoes} value={f} onChange={setF} />
      </FiltrosCard>
      <div className="card op-card">
        <div className="card-h">
          <h3><Icon name="book" /> Estudos de caso</h3>
          <span className="sub">{filtrados.length} no filtro</span>
        </div>
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

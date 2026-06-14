"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { ProcRef, SegredoTag, Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { ProcessoDetalhe } from "@/components/detalhe/ProcessoDetalhe";
import { humano } from "@/lib/format";
import type { Processo } from "@/lib/data";

const PASSO = 50;

const CATEGORIAS = [
  { id: "todos", label: "Todos" },
  { id: "semcnj", label: "Sem CNJ" },
  { id: "superior", label: "STJ/STF" },
  { id: "execucao", label: "Execução penal" },
  { id: "hc", label: "Habeas corpus" },
  { id: "segredo", label: "Segredo de justiça" },
  { id: "auto", label: "Cadastro automático" },
];
const RESPS = [
  { id: "todos", label: "Todos os resp." },
  { id: "Daniel", label: "Daniel" },
  { id: "Rodolfo", label: "Rodolfo" },
  { id: "Ambos", label: "Ambos" },
];

export function ProcessosList({
  processos,
  totalAtivos,
}: {
  processos: Processo[];
  totalAtivos: number;
}) {
  const { open } = useDrawer();
  const [cat, setCat] = useState("todos");
  const [resp, setResp] = useState("todos");
  const [visiveis, setVisiveis] = useState(PASSO);

  const filtrados = useMemo(() => {
    return processos.filter((p) => {
      const okCat =
        cat === "todos"
          ? true
          : cat === "semcnj"
            ? !p.numero_cnj
            : cat === "superior"
              ? p.instancia === "stj" || p.instancia === "stf"
              : cat === "execucao"
                ? p.area === "execucao_penal"
                : cat === "hc"
                  ? p.area === "habeas_corpus"
                  : cat === "segredo"
                    ? p.segredo
                    : cat === "auto"
                      ? p.cadastro_automatico
                      : true;
      const okResp = resp === "todos" ? true : p.responsavel === resp;
      return okCat && okResp;
    });
  }, [processos, cat, resp]);

  const mostrados = filtrados.slice(0, visiveis);

  const opcoesCat = CATEGORIAS.map((o) =>
    o.id === "todos" ? { ...o, label: `Todos (${processos.length})` } : o,
  );

  function abrir(p: Processo) {
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
      body: <ProcessoDetalhe proc={p} />,
    });
  }

  return (
    <>
      <Chips options={opcoesCat} value={cat} onChange={(v) => { setCat(v); setVisiveis(PASSO); }} />
      <Chips options={RESPS} value={resp} onChange={(v) => { setResp(v); setVisiveis(PASSO); }} />
      <div className="card">
        <div className="card-b flush">
          {mostrados.length ? (
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
                {mostrados.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => abrir(p)}>
                    <td>
                      <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} />
                      <div className="sub">
                        {p.classe ?? "—"}
                        {p.cadastro_automatico && <> · <span style={{ color: "var(--blue)" }}>auto</span></>}
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

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16, alignItems: "center" }}>
        {visiveis < filtrados.length && (
          <button className="btn" onClick={() => setVisiveis((v) => v + PASSO)}>
            Carregar mais ({filtrados.length - visiveis} restantes)
          </button>
        )}
      </div>
      <p className="sub" style={{ marginTop: 10, textAlign: "center", color: "var(--muted-2)" }}>
        Mostrando {mostrados.length} de {filtrados.length} (filtro) · {processos.length} ativos carregados de{" "}
        {totalAtivos.toLocaleString("pt-BR")}. Qualquer processo é alcançável pela busca global.
      </p>
    </>
  );
}

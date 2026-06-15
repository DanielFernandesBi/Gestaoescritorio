"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { FormModal } from "@/components/FormModal";
import { ClienteDetalhe } from "@/components/detalhe/ClienteDetalhe";
import { definirSituacaoPrisional } from "@/app/actions";
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

  const emMonitoramento = clientes.filter((c) => c.situacao_prisional === "monitoramento").length;
  const opcoes = [
    { id: "todos", label: `Todos (${clientes.length})` },
    { id: "presos", label: `Presos (${clientes.filter((c) => preso(c.situacao_prisional)).length})` },
    { id: "monitoramento", label: `Monitoramento (${emMonitoramento})` },
    { id: "auto", label: `Cadastro automático (${clientes.filter((c) => c.cadastro_automatico).length})` },
  ];

  // Candidatos para marcar monitoramento: ativos que ainda não estão em monitoramento.
  const candidatosMonitoramento = clientes
    .filter((c) => c.situacao_prisional !== "monitoramento")
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const botaoMonitoramento = (
    <FormModal
      label="+ Monitoramento"
      titulo="Adicionar cliente ao monitoramento"
      descricao="Marca a situação prisional como Monitoramento (tornozeleira). Reversível na ficha do cliente."
      acao={definirSituacaoPrisional}
      enviarLabel="Aplicar"
      variant="default"
    >
      <input type="hidden" name="situacao" value="monitoramento" />
      <div>
        <label>Cliente</label>
        <select name="cliente_id" required defaultValue="">
          <option value="" disabled>Selecione o cliente…</option>
          {candidatosMonitoramento.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}{c.situacao_prisional && c.situacao_prisional !== "solto" ? ` — ${sitDe(c.situacao_prisional)[0]}` : ""}
            </option>
          ))}
        </select>
      </div>
      <p className="sub" style={{ margin: 0 }}>Dica: digite no seletor para buscar pelo nome. Depois o cliente aparece no filtro “Monitoramento”.</p>
    </FormModal>
  );

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
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
          {f === "monitoramento" && botaoMonitoramento}
          <input
            className="filtro-nome"
            placeholder="Filtrar por nome…"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setVisiveis(PASSO); }}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit",
              background: "var(--surface)", color: "var(--text)", minWidth: 200,
            }}
          />
        </div>
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
          ) : f === "monitoramento" ? (
            <div className="empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div>Nenhum cliente em monitoramento (tornozeleira).<br />Use o botão abaixo ou, na ficha do cliente, Editar → Situação prisional.</div>
              {botaoMonitoramento}
            </div>
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

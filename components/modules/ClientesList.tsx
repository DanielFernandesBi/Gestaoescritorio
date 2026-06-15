"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { FormModal } from "@/components/FormModal";
import { ClienteDetalhe } from "@/components/detalhe/ClienteDetalhe";
import { alternarFavorito, favoritarCliente } from "@/app/actions";
import { fmtDate, diasAte } from "@/lib/format";
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

function haDias(iso: string | null): string {
  if (!iso) return "—";
  const d = -diasAte(iso);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

export function ClientesList({ clientes }: { clientes: Cliente[] }) {
  const { open } = useDrawer();
  const router = useRouter();
  const [f, setF] = useState("todos");
  const [busca, setBusca] = useState("");
  const [visiveis, setVisiveis] = useState(PASSO);

  const porAtividade = f === "atividade";

  const filtrados = useMemo(() => {
    const lista = clientes.filter((c) => {
      const okF =
        f === "presos"
          ? preso(c.situacao_prisional)
          : f === "favoritos"
            ? c.favorito
            : f === "auto"
              ? c.cadastro_automatico
              : f === "atividade"
                ? c.ultima_atividade != null
                : true;
      const okBusca = busca ? c.nome.toLowerCase().includes(busca.toLowerCase()) : true;
      return okF && okBusca;
    });
    if (porAtividade) {
      lista.sort((a, b) => (b.ultima_atividade ?? "").localeCompare(a.ultima_atividade ?? ""));
    }
    return lista;
  }, [clientes, f, busca, porAtividade]);

  const mostrados = filtrados.slice(0, visiveis);

  const opcoes = [
    { id: "todos", label: `Todos (${clientes.length})` },
    { id: "favoritos", label: `★ Favoritos (${clientes.filter((c) => c.favorito).length})` },
    { id: "presos", label: `Presos (${clientes.filter((c) => preso(c.situacao_prisional)).length})` },
    { id: "atividade", label: `Atividade recente (${clientes.filter((c) => c.ultima_atividade != null).length})` },
    { id: "auto", label: `Cadastro automático (${clientes.filter((c) => c.cadastro_automatico).length})` },
  ];

  async function toggleFav(c: Cliente, e: React.MouseEvent) {
    e.stopPropagation();
    await alternarFavorito(c.id, !c.favorito);
    router.refresh();
  }

  // Seletor para adicionar aos favoritos por nome (temos +200 clientes).
  const naoFavoritos = clientes.filter((c) => !c.favorito).sort((a, b) => a.nome.localeCompare(b.nome));
  const botaoAddFavorito = (
    <FormModal
      label="★ Adicionar favorito"
      titulo="Adicionar cliente aos favoritos"
      descricao="Marcação do escritório para acesso rápido. Não altera a situação prisional do cliente."
      acao={favoritarCliente}
      enviarLabel="Adicionar"
      variant="default"
    >
      <div>
        <label>Cliente</label>
        <select name="cliente_id" required defaultValue="">
          <option value="" disabled>Selecione o cliente…</option>
          {naoFavoritos.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>
      <p className="sub" style={{ margin: 0 }}>Dica: digite no seletor para buscar pelo nome. Você também pode clicar na ★ ao lado de qualquer cliente.</p>
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
          {f === "favoritos" && botaoAddFavorito}
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
                  <th style={{ width: 34 }}></th>
                  <th>Cliente</th>
                  <th>CPF</th>
                  <th>UF</th>
                  <th>Situação prisional</th>
                  {porAtividade ? (
                    <>
                      <th>Última movimentação</th>
                      <th>Última intimação</th>
                    </>
                  ) : (
                    <>
                      <th className="center">Processos</th>
                      <th className="center">Prazos</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {mostrados.map((c) => {
                  const [lbl, tone] = sitDe(c.situacao_prisional);
                  return (
                    <tr key={c.id} className="clickable" onClick={() => abrir(c)}>
                      <td className="center">
                        <button
                          type="button"
                          className={`star${c.favorito ? " on" : ""}`}
                          title={c.favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                          aria-label={c.favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                          onClick={(e) => toggleFav(c, e)}
                        >
                          {c.favorito ? "★" : "☆"}
                        </button>
                      </td>
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
                      {porAtividade ? (
                        <>
                          <td className="mono">{fmtDate(c.ultima_movimentacao)}<div className="sub">{haDias(c.ultima_movimentacao)}</div></td>
                          <td className="mono">{fmtDate(c.ultima_intimacao)}<div className="sub">{haDias(c.ultima_intimacao)}</div></td>
                        </>
                      ) : (
                        <>
                          <td className="center mono">{c.total_processos}</td>
                          <td className="center mono">{c.prazos_abertos || "—"}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : f === "favoritos" ? (
            <div className="empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div>Nenhum cliente nos favoritos ainda.<br />Adicione pelo botão abaixo ou clique na ★ ao lado de qualquer cliente.</div>
              {botaoAddFavorito}
            </div>
          ) : f === "atividade" ? (
            <div className="empty">Nenhum cliente com movimentação ou intimação registrada ainda.</div>
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

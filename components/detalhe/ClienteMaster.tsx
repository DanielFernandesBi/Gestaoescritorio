"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { Cliente } from "@/lib/data";

/* CPF mascarado e tom da situação prisional — usados na row do índice e no
 * detalhe do cliente (fonte única para os dois). */
export const mascararCpf = (cpf: string | null): string => {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return cpf || "—";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
};
export const sitTone = (s: string | null): "green" | "amber" | "red" => {
  if (s === "solto" || s === "regime_aberto") return "green";
  if (s === "foragido" || s === "preso_provisorio" || s === "preso_definitivo" || s === "falecido") return "red";
  return "amber";
};

const ehPreso = (c: Cliente) => /preso|foragido/.test(c.situacao_prisional ?? "");

/* Row do índice de clientes — barra/identidade compacta reaproveitada pelo
 * drawer (detalhe) e pela tela raiz /clientes. */
function MasterCard({ c, ativo }: { c: Cliente; ativo: boolean }) {
  return (
    <Link className={`cli-mcard${ativo ? " on" : ""}`} href={linkPara("cliente", c.id)}>
      <div className="cli-mnome">{c.nome}</div>
      <div className="cli-mmeta">
        <span className={`cli-dot ${sitTone(c.situacao_prisional)}`} />
        {humano(c.situacao_prisional)} · {c.processos_ativos} processo{c.processos_ativos === 1 ? "" : "s"}
      </div>
      {c.cpf && <div className="cli-mcpf mono">CPF {mascararCpf(c.cpf)}</div>}
    </Link>
  );
}

/**
 * Índice (lista compacta) de clientes — header com título, busca e filtros +
 * lista com scroll próprio. Reusado no drawer do cliente e na tela raiz.
 * `activeId` destaca o registro aberto (aura cobalt); ausente na tela raiz.
 */
export function ClienteMaster({ lista, activeId }: { lista: Cliente[]; activeId?: string }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "presos" | "favoritos">("todos");

  const filtrados = useMemo(() => {
    let l = lista;
    if (filtro === "presos") l = l.filter(ehPreso);
    else if (filtro === "favoritos") l = l.filter((c) => c.favorito);
    const q = busca.trim().toLowerCase();
    if (q) {
      const qd = q.replace(/\D/g, "");
      l = l.filter((c) => c.nome.toLowerCase().includes(q) || (qd !== "" && (c.cpf ?? "").replace(/\D/g, "").includes(qd)));
    }
    return l;
  }, [lista, busca, filtro]);

  const nPresos = useMemo(() => lista.filter(ehPreso).length, [lista]);
  const nFav = useMemo(() => lista.filter((c) => c.favorito).length, [lista]);

  return (
    <aside className="audp-master">
      <div className="audp-master-h">
        <h1>Clientes</h1>
        <input
          className="cli-busca"
          placeholder="Buscar nome, CPF, processo…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="audp-filtros">
          <button type="button" className={`audp-chip ink${filtro === "todos" ? " on" : ""}`} onClick={() => setFiltro("todos")}>Todos</button>
          <button type="button" className={`audp-chip tang${filtro === "presos" ? " on" : ""}`} onClick={() => setFiltro("presos")}>Presos ({nPresos})</button>
          <button type="button" className={`audp-chip ink${filtro === "favoritos" ? " on" : ""}`} onClick={() => setFiltro("favoritos")}>Favoritos ({nFav})</button>
        </div>
      </div>
      <div className="audp-master-list">
        {filtrados.length === 0
          ? <div className="audp-empty">Nenhum cliente.</div>
          : filtrados.map((c) => <MasterCard key={c.id} c={c} ativo={c.id === activeId} />)}
      </div>
    </aside>
  );
}

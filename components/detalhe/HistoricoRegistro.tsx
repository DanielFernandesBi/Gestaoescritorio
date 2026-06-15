"use client";

import { useEffect, useState } from "react";
import { humano } from "@/lib/format";

type Evento = {
  id: number;
  ocorrido_em: string;
  operacao: string;
  origem: string | null;
  dados_antes: Record<string, unknown> | null;
  dados_depois: Record<string, unknown> | null;
};

const IGNORAR = new Set(["atualizado_em", "criado_em", "id"]);

function mudancas(e: Evento): string[] {
  if (e.operacao === "INSERT") return ["registro criado"];
  if (e.operacao === "DELETE") return ["registro removido"];
  const a = e.dados_antes ?? {};
  const d = e.dados_depois ?? {};
  const campos: string[] = [];
  for (const k of Object.keys(d)) {
    if (IGNORAR.has(k)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(d[k])) {
      const antes = a[k] == null || a[k] === "" ? "—" : String(a[k]);
      const depois = d[k] == null || d[k] === "" ? "—" : String(d[k]);
      campos.push(`${k}: ${antes.slice(0, 40)} → ${depois.slice(0, 40)}`);
    }
  }
  return campos.length ? campos : ["sem mudança de campos"];
}

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function HistoricoRegistro({ id }: { id: string }) {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/historico/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => vivo && setEventos(d.eventos))
      .catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, [id]);

  if (erro) return <div className="empty">Não consegui carregar o histórico.</div>;
  if (!eventos) return <div className="empty">Carregando histórico…</div>;
  if (!eventos.length) return <div className="empty">Sem eventos de auditoria.</div>;

  return (
    <div className="tl">
      {eventos.map((e) => (
        <div className={`tl-item ${e.operacao === "INSERT" ? "green" : e.operacao === "DELETE" ? "red" : "blue"}`} key={e.id}>
          <div className="d">{quando(e.ocorrido_em)} · {e.operacao}{e.origem ? ` · ${e.origem}` : ""}</div>
          {mudancas(e).map((m, i) => (
            <div className="x" key={i} style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{m}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";

export type OpcaoBusca = { id: string; label: string };

/**
 * Combobox com busca para listas grandes (processos, clientes…). Substitui o
 * <select> nativo que listava milhares de itens sem filtro. Grava o id num
 * <input type="hidden" name={name}> para funcionar dentro dos forms (FormData).
 * A obrigatoriedade é validada no servidor (a action retorna mensagem amigável).
 */
export function BuscaSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Buscar…",
  limite = 50,
}: {
  name: string;
  options: OpcaoBusca[];
  defaultValue?: string;
  placeholder?: string;
  limite?: number;
}) {
  const [sel, setSel] = useState(defaultValue);
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const fecharRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selLabel = options.find((o) => o.id === sel)?.label ?? "";

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options.slice(0, limite);
    const td = t.replace(/\D/g, "");
    const l = options.filter(
      (o) => o.label.toLowerCase().includes(t) || (td !== "" && o.label.replace(/\D/g, "").includes(td)),
    );
    return l.slice(0, limite);
  }, [options, q, limite]);

  const total = options.length;
  const escolher = (o: OpcaoBusca) => { setSel(o.id); setQ(""); setAberto(false); };
  const limpar = () => { setSel(""); setQ(""); setAberto(false); };

  return (
    <div className="bsel">
      <input type="hidden" name={name} value={sel} />
      <div className="bsel-field">
        <input
          className="bsel-input"
          value={aberto ? q : selLabel}
          placeholder={selLabel || placeholder}
          onChange={(e) => { setQ(e.target.value); setSel(""); setAberto(true); }}
          onFocus={() => { setAberto(true); setQ(""); }}
          onBlur={() => { fecharRef.current = setTimeout(() => setAberto(false), 120); }}
        />
        {sel && !aberto && <button type="button" className="bsel-clear" onClick={limpar} aria-label="Limpar">×</button>}
      </div>
      {aberto && (
        <div className="bsel-pop" onMouseDown={() => { if (fecharRef.current) clearTimeout(fecharRef.current); }}>
          {filtrados.length === 0 ? (
            <div className="bsel-empty">Nada encontrado.</div>
          ) : (
            filtrados.map((o) => (
              <button type="button" key={o.id} className={`bsel-opt${o.id === sel ? " on" : ""}`} onClick={() => escolher(o)}>
                {o.label}
              </button>
            ))
          )}
          {total > filtrados.length && <div className="bsel-more">Refine a busca — {total} no total.</div>}
        </div>
      )}
    </div>
  );
}

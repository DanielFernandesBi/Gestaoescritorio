"use client";

import { useEffect, useState } from "react";

// As 5 categorias do push (Sug. 81 fase 2) e seus rótulos. A escolha é POR
// APARELHO: grava em push_subscriptions.categorias da assinatura deste aparelho.
const CATEGORIAS: { id: string; label: string; hint: string }[] = [
  { id: "prazo", label: "Prazos e audiências", hint: "alertas com data no radar" },
  { id: "financeiro", label: "Financeiro", hint: "vence hoje + virou atrasado ontem" },
  { id: "intimacao", label: "Intimações do dia", hint: "capturadas pela triagem" },
  { id: "minuta", label: "Minutas para revisão", hint: "peças em revisão" },
  { id: "silencio", label: "Processos em silêncio", hint: "inércia anômala" },
];

type Estado = "carregando" | "sem_suporte" | "nao_inscrito" | "pronto" | "erro";

export default function PushCategorias() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (vivo) setEstado("sem_suporte");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!vivo) return;
        if (!sub) {
          setEstado("nao_inscrito");
          return;
        }
        const ep = sub.endpoint;
        setEndpoint(ep);
        const res = await fetch(`/api/push/categorias?endpoint=${encodeURIComponent(ep)}`);
        if (!res.ok) throw new Error("falha ao ler categorias");
        const data = (await res.json()) as { categorias: string[] };
        if (!vivo) return;
        setMarcadas(new Set(data.categorias ?? []));
        setEstado("pronto");
      } catch {
        if (vivo) setEstado("erro");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function alternar(id: string) {
    if (!endpoint) return;
    const nova = new Set(marcadas);
    if (nova.has(id)) nova.delete(id);
    else nova.add(id);
    setMarcadas(nova); // otimista
    setSalvo(false);
    setSalvando(true);
    try {
      const res = await fetch("/api/push/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, categorias: [...nova] }),
      });
      if (!res.ok) throw new Error("falha ao salvar");
      setSalvo(true);
    } catch {
      setEstado("erro");
    } finally {
      setSalvando(false);
    }
  }

  if (estado === "sem_suporte") return null;
  if (estado === "carregando") return null;
  if (estado === "nao_inscrito") {
    return (
      <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 8 }}>
        Ative as notificações acima para escolher quais tipos este aparelho recebe.
      </div>
    );
  }
  if (estado === "erro") {
    return (
      <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 8 }}>
        Não consegui carregar as preferências deste aparelho. Recarregue a página.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, width: "100%" }}>
      <div style={{ fontSize: 12.5, opacity: 0.7, marginBottom: 8 }}>
        O que <b>este aparelho</b> recebe (desmarque o que não quiser):
        {salvando ? " · salvando…" : salvo ? " · salvo ✓" : ""}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {CATEGORIAS.map((c) => {
          const on = marcadas.has(c.id);
          return (
            <label
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                fontSize: 13.5,
                padding: "4px 2px",
              }}
            >
              <input type="checkbox" checked={on} onChange={() => alternar(c.id)} style={{ width: 17, height: 17, cursor: "pointer" }} />
              <span>
                {c.label}
                <span style={{ opacity: 0.55, fontSize: 12 }}> — {c.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

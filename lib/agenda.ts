import type { AgendaEvento } from "@/lib/data";

/* Sistema de cores/estado da agenda (interno, Sug. 79 — sem Google Calendar):
 * provisório/não validado = tangerina; fatal confirmado = vermelho; interna já
 * validada = banana (calmo); baixado (cumprido/cancelado/prejudicado) = grafite,
 * com anotação ✅ CUMPRIDO / ❌ ENCERRADO. Fonte única para as três telas
 * (semana, lista, mês). A doutrina validado=false/true permanece intacta. */

export type EvTom = "fatal" | "prov" | "interna" | "aud" | "comp" | "baixado";

export function estado(e: AgendaEvento): { label: string; tone: EvTom; ia: boolean } {
  const s = e.status ?? "";
  if (e.tipo === "prazo") {
    if (s === "cumprido") return { label: "Cumprido", tone: "baixado", ia: false };
    if (s === "cancelado" || s === "prejudicado") return { label: "Encerrado", tone: "baixado", ia: false };
    if (e.marcador === "interna") return { label: "Interna", tone: "interna", ia: false };
    return e.validado
      ? { label: "Fatal", tone: "fatal", ia: false }
      : { label: "Provisório · conferir", tone: "prov", ia: true };
  }
  if (e.tipo === "audiencia") {
    if (e.baixado) return { label: s === "realizada" ? "Realizada" : "Encerrada", tone: "baixado", ia: false };
    return e.validado
      ? { label: "Audiência", tone: "aud", ia: false }
      : { label: "Provisório · conferir", tone: "prov", ia: true };
  }
  // compromisso
  if (e.baixado) return { label: s === "realizado" ? "Realizado" : "Cancelado", tone: "baixado", ia: false };
  return { label: "Compromisso", tone: "comp", ia: false };
}

// Rótulo do chip do mês com a anotação de estado (✅ CUMPRIDO — / ❌ ENCERRADO —
// / FATAL: / ⚠ provisório). "Interna — …" já vem no próprio título do evento.
export function chipTexto(e: AgendaEvento): string {
  const st = estado(e);
  const t = e.titulo;
  if (st.tone === "baixado") {
    const ok = e.status === "cumprido" || e.status === "realizada" || e.status === "realizado";
    return `${ok ? "✅" : "❌"} ${st.label.toUpperCase()} — ${t}`;
  }
  if (e.tipo === "prazo" && e.marcador === "fatal") return e.validado ? `FATAL: ${t}` : `⚠ ${t}`;
  return t;
}

import { linkPara } from "@/lib/links";
import type { AlertaVw } from "@/lib/queries";

/* Rótulos/tom/alvo dos alertas da vw_alertas (Sug. 79) — puros, para o sino
 * (topbar, client) e a /alertas (server) usarem a mesma doutrina. */

const LABEL: Record<string, string> = {
  prazo_fatal_proximo: "Fatal",
  prazo_fatal_fim_semana: "Fatal · fim de semana",
  prazo_pendente_validacao: "A validar",
  prazo_interna_proximo: "Interna",
  audiencia_proxima: "Audiência",
  audiencia_pendente_validacao: "Audiência · a validar",
};

export const rotuloAlerta = (t: string): string => LABEL[t] ?? "Alerta";

export const toneAlerta = (p: number): "crit" | "warn" | "info" =>
  p <= 1 ? "crit" : p === 2 ? "warn" : "info";

// Pendente de validação abre a fila de validação; senão o registro de origem.
export function alvoAlerta(a: AlertaVw): string {
  if (a.tipo_alerta.includes("pendente_validacao")) return "/validacao";
  return a.origem === "audiencia" ? linkPara("audiencia", a.id) : linkPara("prazo", a.id);
}

export function prazoAlerta(a: AlertaVw): string {
  if (a.dias_restantes == null) return "";
  const d = a.dias_restantes;
  return d < 0 ? `${Math.abs(d)}d vencido` : d === 0 ? "hoje" : d === 1 ? "amanhã" : `${d}d`;
}

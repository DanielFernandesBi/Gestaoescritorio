/** Formatação pt-BR — datas dd/mm/aaaa, valores em R$. */

export function fmtBRL(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  return (
    "R$ " +
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** ISO (yyyy-mm-dd) → dd/mm/aaaa. Aceita timestamptz também. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** hh:mm de um timestamptz/data-hora. */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtNum(v: number | string | null | undefined): string {
  return Number(v ?? 0).toLocaleString("pt-BR");
}

/** Classe do semáforo de prazo a partir dos dias restantes. */
export function ddClass(dias: number): "crit" | "warn" | "ok" {
  return dias <= 2 ? "crit" : dias <= 5 ? "warn" : "ok";
}

export function ddLabel(dias: number): string {
  return dias < 0 ? "venc." : dias === 0 ? "hoje" : "dias";
}

export const HOJE = new Date();

/** Dias entre hoje (00h local) e a data ISO (yyyy-mm-dd). Negativo = vencido. */
export function diasAte(iso: string | null | undefined): number {
  if (!iso) return 0;
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
}

/** Capitaliza e troca _ por espaço (ex.: sessao_julgamento → Sessão julgamento). */
export function humano(s: string | null | undefined): string {
  if (!s) return "—";
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Normaliza nome p/ deduplicação: sem acento, maiúsculas, espaços simples. */
export function normalizarNome(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Mantém só dígitos (CPF/CNPJ). */
export function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

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

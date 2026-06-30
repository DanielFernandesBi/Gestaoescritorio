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

/** Fuso oficial do escritório — todas as datas/horas do sistema são de São Paulo. */
export const TZ_SP = "America/Sao_Paulo";

/** Data de hoje (yyyy-mm-dd) no fuso de São Paulo — independe do fuso do servidor
 * (que roda em UTC). Evita que, das 21h à meia-noite BRT, "hoje" pule para o dia
 * seguinte. en-CA já formata como yyyy-mm-dd. */
export function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_SP, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** hh:mm de um timestamptz/data-hora, sempre no fuso de São Paulo. */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ_SP,
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

/** Dias entre hoje (em São Paulo) e a data ISO (yyyy-mm-dd). Negativo = vencido.
 * Compara só a parte de calendário em UTC nos dois lados — resultado independe do
 * fuso do servidor. */
export function diasAte(iso: string | null | undefined): number {
  if (!iso) return 0;
  const alvo = new Date(iso.slice(0, 10) + "T00:00:00Z").getTime();
  const base = new Date(hojeSP() + "T00:00:00Z").getTime();
  return Math.round((alvo - base) / 86_400_000);
}

/** Capitaliza e troca _ por espaço (ex.: sessao_julgamento → Sessão julgamento). */
export function humano(s: string | null | undefined): string {
  if (!s) return "—";
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Encurta um título automático que repete dados já exibidos em campo próprio do
 * card (nome do cliente e nº/identificador do processo). Atua só sobre segmentos
 * separados por travessão (— / –) — o padrão dos títulos automáticos
 * "Assunto — CLIENTE — 0000000-00.0000…". Remove do fim os segmentos que são
 * processo (CNJ / dígitos longos) ou o nome do cliente (1ª e última palavra
 * batendo, tolerando abreviações). Texto descritivo é preservado.
 */
const _toks = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
const _CNJ_RE = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;

export function encurtarTitulo(
  titulo: string | null | undefined,
  cliente?: string | null,
  numeroCnj?: string | null,
  numeroRegistro?: string | null,
): string {
  const bruto = (titulo ?? "").trim();
  const partes = bruto.split(/\s*[—–]\s*/);
  if (partes.length < 2) return bruto;

  const cli = cliente ? _toks(cliente) : [];
  const ehProc = (seg: string) =>
    _CNJ_RE.test(seg) || /\d{6,}/.test(seg) || (!!numeroCnj && seg.includes(numeroCnj)) || (!!numeroRegistro && seg.includes(numeroRegistro));
  const ehCliente = (seg: string) => {
    if (!cli.length) return false;
    const s = _toks(seg);
    return s.length > 0 && s[0] === cli[0] && s[s.length - 1] === cli[cli.length - 1];
  };

  while (partes.length > 1) {
    const ult = partes[partes.length - 1].trim();
    if (ehProc(ult) || ehCliente(ult)) partes.pop();
    else break;
  }
  return partes.join(" — ").trim() || bruto;
}

/**
 * Divide o `ato` do prazo em nome curto (até o 1º travessão/colchete/parêntese)
 * e o resto (anotações do cowork, reclassificações etc.). O cabeçalho usa só o
 * `curto`; o texto completo continua em "Dados do prazo · Ato".
 */
export function dividirAto(ato: string | null | undefined): { curto: string; resto: string | null } {
  const t = (ato ?? "").trim();
  const m = t.match(/\s*(—|–|\[|\(id\.|\()/);
  if (!m || m.index === undefined || m.index < 3) {
    if (t.length <= 72) return { curto: t, resto: null };
    return { curto: t.slice(0, 70).trimEnd() + "…", resto: t };
  }
  const curto = t.slice(0, m.index).trim();
  const resto = t.slice(m.index).trim();
  return curto.length >= 3 ? { curto, resto: resto || null } : { curto: t, resto: null };
}

/** Categoria do prazo (etiqueta) inferida do texto do ato — recurso/defesa/etc. */
export function categoriaAto(ato: string): { tone: string; label: string } | null {
  const a = ato.toLowerCase();
  if (/memori|alega[çc][õo]es finais/.test(a)) return { tone: "neutral", label: "memorial" };
  if (/embargos|manifesta|peti[çc][ãa]o|contrarraz/.test(a)) return { tone: "neutral", label: "manifestação" };
  if (/apela|rese|agravo|recurso|especial|extraordin|ros|carta testemunh/.test(a)) return { tone: "blue", label: "recurso" };
  if (/resposta|defesa|preliminar|alega[çc][õo]es/.test(a)) return { tone: "slate", label: "defesa" };
  return null;
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

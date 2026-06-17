/**
 * Allowlist de e-mails autorizados (Daniel e, depois, Rodolfo).
 * Configurada em ALLOWED_EMAILS (separada por vírgula).
 */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}

/* ---- Mapa e-mail -> sócio (apenas 2 usuários; sem tabela de usuários) ---- */

export type Socio = "Daniel" | "Rodolfo";

function norm(e: string | null | undefined): string {
  return (e ?? "").trim().toLowerCase();
}

/**
 * Mapa do e-mail da sessão para o sócio (Daniel/Rodolfo). Configurável por env
 * (EMAIL_DANIEL / EMAIL_RODOLFO); Daniel já é conhecido, Rodolfo entra depois.
 * Retorna null se o e-mail não casar com nenhum sócio.
 */
export function socioDoEmail(email: string | null | undefined): Socio | null {
  const e = norm(email);
  if (!e) return null;
  const daniel = norm(process.env.EMAIL_DANIEL) || "danielsfernandes8@gmail.com";
  const rodolfo = norm(process.env.EMAIL_RODOLFO);
  if (e === daniel) return "Daniel";
  if (rodolfo && e === rodolfo) return "Rodolfo";
  return null;
}

/** O outro sócio (para "reatribuir ao sócio"). */
export function outroSocio(s: Socio): Socio {
  return s === "Daniel" ? "Rodolfo" : "Daniel";
}

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

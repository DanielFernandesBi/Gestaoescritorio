import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowlist";

/**
 * Revalida a sessão e a allowlist em toda gravação (defesa em profundidade).
 * Lança se não autorizado — as Server Actions tratam e devolvem mensagem.
 */
export async function requireUser(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? null;
  if (!isAllowedEmail(email)) {
    throw new Error("Sessão não autorizada para gravar.");
  }
  return email as string;
}

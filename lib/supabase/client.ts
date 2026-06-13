import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para o browser (Client Components).
 * Usa a chave publicável — segura no front; quem protege os dados é o RLS.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

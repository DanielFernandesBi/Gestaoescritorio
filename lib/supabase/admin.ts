import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a SERVICE ROLE — ignora RLS. Uso EXCLUSIVO server-side
 * e restrito: o cron de notificações (não há usuário logado) e a leitura do
 * notificacoes_log (a tabela tem RLS sem policy, então nem o dono lê pela
 * sessão — só a service role). Nunca importar em client component; a chave
 * SUPABASE_SERVICE_ROLE_KEY não é NEXT_PUBLIC e o `server-only` barra o uso.
 *
 * Init preguiçoso: a env var só é lida em tempo de execução, nunca no topo do
 * módulo — assim o `next build` (que avalia o módulo sem env vars) não quebra.
 */
let _admin: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

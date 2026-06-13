import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase no servidor (Server Components / Route Handlers / Server Actions).
 * Lê a sessão do usuário pelos cookies, então o RLS vale para cada requisição.
 * A service_role NUNCA é usada aqui — Fase 1 é só leitura com a sessão do usuário.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component — pode ser ignorado:
            // o proxy.ts é quem renova a sessão nos cookies.
          }
        },
      },
    },
  );
}

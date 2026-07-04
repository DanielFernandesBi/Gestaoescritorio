import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/allowlist";

/**
 * Renova a sessão a cada requisição e protege as rotas.
 * Padrão oficial @supabase/ssr para Next.js 16 (Proxy).
 * Gate de acesso: só e-mails da allowlist (Daniel/Rodolfo) entram.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // NÃO inserir código entre createServerClient e getClaims().
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const email = (claims?.email as string | undefined) ?? null;

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    // Cron do Vercel: chega sem sessão, autentica por Bearer na própria rota.
    path.startsWith("/api/cron");

  // Sem usuário válido em rota protegida → manda para o login.
  if (!claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Usuário autenticado mas fora da allowlist → derruba a sessão.
  if (claims && !isAllowedEmail(email)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("erro", "nao_autorizado");
    return NextResponse.redirect(url);
  }

  // Já logado tentando ver o login → vai para o painel.
  if (claims && isAllowedEmail(email) && path.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

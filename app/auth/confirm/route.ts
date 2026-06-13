import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowlist";

/**
 * Endpoint do magic link. Aceita os dois fluxos do Supabase para funcionar
 * sem exigir mudança no template de e-mail:
 *  - PKCE (template padrão): ?code=...  -> exchangeCodeForSession
 *  - token_hash (template SSR): ?token_hash=...&type=email -> verifyOtp
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/painel";

  const supabase = await createClient();
  let email: string | null = null;
  let ok = false;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      ok = true;
      email = data.user?.email ?? null;
    }
  } else if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      ok = true;
      email = data.user?.email ?? null;
    }
  }

  if (ok) {
    // Gate final da allowlist: só Daniel/Rodolfo seguem para o sistema.
    if (!isAllowedEmail(email)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?erro=nao_autorizado", request.url),
      );
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(
    new URL("/login?erro=link_invalido", request.url),
  );
}

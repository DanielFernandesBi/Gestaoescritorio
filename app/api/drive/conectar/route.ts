import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowlist";
import { urlAutorizacaoDrive, oauthCredsConfigurado } from "@/lib/drive";
import { redirectUriCallback } from "../callback/uri";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Inicia a autorização do Drive: redireciona para o consentimento do Google.
 * Protegido pela sessão (só Daniel/Rodolfo). Requer GOOGLE_OAUTH_CLIENT_ID/SECRET.
 * O refresh token resultante aparece em /api/drive/callback para colar no Vercel.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? null;
  if (!isAllowedEmail(email)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!oauthCredsConfigurado()) {
    return new NextResponse(
      "Configure GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET no ambiente antes de conectar o Drive.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  const url = urlAutorizacaoDrive(redirectUriCallback(request));
  return NextResponse.redirect(url!);
}

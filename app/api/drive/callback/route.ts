import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowlist";
import { trocarCodigoPorRefreshToken } from "@/lib/drive";
import { redirectUriCallback } from "./uri";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pagina(corpo: string, status = 200): NextResponse {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar Drive — Gestão Fernandes</title>
<style>
  body{font:15px/1.6 system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#1a1a1a}
  h1{font-size:20px} code,input{font-family:ui-monospace,monospace}
  .tok{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:13px;margin:8px 0}
  .ok{color:#0a7d33} .err{color:#b00020}
  ol{padding-left:20px} li{margin:6px 0}
  .box{background:#f6f6f4;border:1px solid #e3e3df;border-radius:10px;padding:16px;margin:16px 0}
</style></head><body>${corpo}</body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

/**
 * Recebe o código do Google, troca pelo refresh token e o exibe (apenas para a
 * sessão autorizada) com instruções de colar no Vercel. O token NÃO é gravado em
 * lugar nenhum pelo app — fica só nesta tela, para você levar ao Vercel.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? null;
  if (!isAllowedEmail(email)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const erro = searchParams.get("error");
  const code = searchParams.get("code");
  if (erro) {
    return pagina(`<h1 class="err">Autorização não concluída</h1><p>O Google retornou: <code>${esc(erro)}</code>.</p><p><a href="/api/drive/conectar">Tentar de novo</a></p>`, 400);
  }
  if (!code) {
    return pagina(`<h1 class="err">Faltou o código de autorização</h1><p><a href="/api/drive/conectar">Iniciar pela rota /api/drive/conectar</a></p>`, 400);
  }

  const refresh = await trocarCodigoPorRefreshToken(code, redirectUriCallback(request));
  if (!refresh) {
    return pagina(`<h1 class="err">Não veio um refresh token</h1>
<p>Isso costuma acontecer quando a conta já tinha autorizado o app antes. Revogue o acesso em
<a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a> e
<a href="/api/drive/conectar">tente novamente</a> (o fluxo força o consentimento).</p>`, 400);
  }

  return pagina(`<h1 class="ok">✓ Drive autorizado</h1>
<p>Copie o <b>refresh token</b> abaixo e cole no Vercel como a variável
<code>GOOGLE_OAUTH_REFRESH_TOKEN</code>:</p>
<input class="tok" readonly value="${esc(refresh)}" onclick="this.select()">
<div class="box"><b>Próximos passos no Vercel</b>
<ol>
<li>Project → <b>Settings → Environment Variables</b>.</li>
<li>Adicione <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> com o valor acima (ambiente <b>Production</b>).</li>
<li>Confirme que <code>GOOGLE_OAUTH_CLIENT_ID</code> e <code>GOOGLE_OAUTH_CLIENT_SECRET</code> já estão lá.</li>
<li><b>Redeploy</b> para o app pegar a variável.</li>
</ol></div>
<p class="sub">Esta tela é a única vez que o token aparece. Se perder, é só refazer por
<code>/api/drive/conectar</code>.</p>`);
}

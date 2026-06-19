import { type NextRequest } from "next/server";

/**
 * redirect_uri da rota de callback, derivado do host externo que o usuário
 * acessou (atrás do proxy do Vercel). Os fluxos de autorizar e de trocar o
 * código DEVEM usar exatamente a mesma URI — por isso o helper é compartilhado.
 * É esta URL que precisa estar registrada no Google Cloud Console.
 */
export function redirectUriCallback(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const base = host ? `${proto}://${host}` : new URL(request.url).origin;
  return `${base}/api/drive/callback`;
}

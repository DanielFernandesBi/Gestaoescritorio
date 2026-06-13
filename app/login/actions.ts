"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowlist";

export type LoginState = {
  status: "idle" | "ok" | "error";
  message: string;
  email?: string;
};

const EMAIL_RE = /^[\w-.+]+@([\w-]+\.)+[\w-]{2,12}$/;

/**
 * URL base do site. Em produção (Vercel) detecta o domínio atual pelos headers,
 * então funciona em produção e em previews sem reconfigurar nada.
 * NEXT_PUBLIC_SITE_URL, se definido, tem prioridade (útil no dev = localhost).
 */
async function getBaseUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function enviarMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Informe um e-mail válido.", email };
  }

  // Gate da allowlist ANTES de enviar — não cria conta para quem não é do escritório.
  if (!isAllowedEmail(email)) {
    return {
      status: "error",
      message:
        "Este e-mail não está autorizado. O acesso é restrito aos sócios do escritório.",
      email,
    };
  }

  const supabase = await createClient();
  const siteUrl = await getBaseUrl();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/painel`,
    },
  });

  if (error) {
    return {
      status: "error",
      message:
        "Não consegui enviar o link agora. Tente novamente em instantes.",
      email,
    };
  }

  return {
    status: "ok",
    message:
      "Link de acesso enviado. Confira seu e-mail e clique no link para entrar.",
    email,
  };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowlist";

export type LoginState = {
  status: "idle" | "ok" | "error";
  message: string;
  email?: string;
};

const EMAIL_RE = /^[\w-.+]+@([\w-]+\.)+[\w-]{2,12}$/;

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

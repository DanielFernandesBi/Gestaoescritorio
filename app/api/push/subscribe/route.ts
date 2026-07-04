import { NextRequest, NextResponse } from "next/server";
// AJUSTE O IMPORT: use o helper de client server-side que o projeto já usa
// para rotas autenticadas (padrão @supabase/ssr). Se o arquivo real tiver
// outro caminho/nome, só trocar esta linha.
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { subscription, dispositivo } = body as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    dispositivo?: string;
  };

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      dispositivo: dispositivo ?? null,
      ativo: true,
      cadastrado_por: "manual",
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

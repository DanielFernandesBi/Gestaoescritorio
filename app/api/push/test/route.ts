import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

// Envio de teste (Sug. 81) — dispara UMA notificação genérica para os aparelhos
// do PRÓPRIO usuário logado, pra validar o pipeline (VAPID + assinatura + SW)
// sem esperar o cron diário. Não altera o comportamento de 08h05/08h35.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Init preguiçoso das chaves VAPID — só em tempo de requisição, nunca no topo
// do módulo, pra o `next build` (que avalia o módulo sem env vars) não quebrar.
let _vapidPronto = false;
function garantirVapid() {
  if (_vapidPronto) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  _vapidPronto = true;
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  // RLS por dono já limitaria às próprias linhas; o filtro por user_id é explícito.
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("ativo", true)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!subs?.length) {
    return NextResponse.json(
      { ok: false, motivo: "nenhum aparelho ativo — ative as notificações primeiro" },
      { status: 400 }
    );
  }

  garantirVapid();

  const payload = JSON.stringify({
    title: "Fernandes Advocacia · Teste",
    body: "Notificação de teste — o push está funcionando neste aparelho. ✅",
    url: "/",
    tag: "fa-teste",
  });

  let enviados = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      enviados++;
    } catch (e: unknown) {
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // assinatura expirada/revogada no navegador — desativa (soft)
        await supabase.from("push_subscriptions").update({ ativo: false }).eq("id", sub.id);
      }
    }
  }

  return NextResponse.json({ ok: enviados > 0, enviados });
}

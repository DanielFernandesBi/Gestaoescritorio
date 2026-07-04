import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Rota chamada pelo Vercel Cron (ver vercel.json — dois horários espaçados,
// nunca 00h00) com Authorization: Bearer $CRON_SECRET. Usa a service role
// (não há usuário logado num cron) — só esta rota deve ter esse client.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Inicialização preguiçosa: o client da service role e as chaves VAPID só são
// lidas em tempo de requisição, nunca no topo do módulo — assim o `next build`
// (que avalia o módulo ao coletar page data, sem env vars) não quebra.
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
  }
  return _supabase;
}

let _vapidPronto = false;
function garantirVapid() {
  if (_vapidPronto) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string, // ex.: "mailto:danielsfernandes8@gmail.com"
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  _vapidPronto = true;
}

type Categoria = "prazo" | "financeiro";

function hojeISO() {
  // America/Sao_Paulo — evita depender do TZ do runtime da função
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  return fmt.format(new Date()); // YYYY-MM-DD
}

async function montarPayloadAgenda(): Promise<{ body: string; count: number } | null> {
  // vw_alertas: fatais próximas, pendentes de validação, audiência hoje/amanhã.
  // Só CONTAGEM — nunca cliente/CNJ/teor (o corpo passa pelos servidores
  // Apple/Google de push).
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("vw_alertas")
    .select("*", { count: "exact", head: true });

  if (error || !count) return null;

  return { body: `${count} alerta(s) de agenda — prazo ou audiência. Abrir agenda.`, count };
}

async function montarPayloadFinanceiro(): Promise<{ body: string; count: number } | null> {
  const supabase = getSupabase();
  const hoje = hojeISO();
  const ontem = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );

  // vence hoje (ainda a_vencer) + o que VIROU atrasado ontem (fn_marcar_atrasados
  // já rodou pela Tarefa 1 antes deste horário) — nunca o backlog inteiro de atraso.
  const [venceHoje, atrasouOntem] = await Promise.all([
    supabase
      .from("pagamentos")
      .select("*", { count: "exact", head: true })
      .eq("status", "a_vencer")
      .eq("vencimento", hoje),
    supabase
      .from("pagamentos")
      .select("*", { count: "exact", head: true })
      .eq("status", "atrasado")
      .eq("vencimento", ontem),
  ]);

  const total = (venceHoje.count ?? 0) + (atrasouOntem.count ?? 0);
  if (total === 0) return null;

  const partes = [];
  if (venceHoje.count) partes.push(`${venceHoje.count} vencendo hoje`);
  if (atrasouOntem.count) partes.push(`${atrasouOntem.count} atrasada(s) desde ontem`);

  return { body: `Financeiro: ${partes.join(" · ")}. Abrir financeiro.`, count: total };
}

async function dispatch(categoria: Categoria) {
  const supabase = getSupabase();
  const payload =
    categoria === "prazo" ? await montarPayloadAgenda() : await montarPayloadFinanceiro();

  if (!payload) return { categoria, enviado: false, motivo: "nada a notificar" };

  const chaveEvento = `${categoria}:${hojeISO()}`;
  const title = categoria === "prazo" ? "Fernandes Advocacia · Agenda" : "Fernandes Advocacia · Financeiro";
  const url = categoria === "prazo" ? "/agenda" : "/financeiro";

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("ativo", true);

  if (!subs?.length) return { categoria, enviado: false, motivo: "sem assinaturas" };

  let enviados = 0;
  for (const sub of subs) {
    // dedup: 1 push por categoria/evento/assinatura/dia
    const { error: dedupError } = await supabase
      .from("notificacoes_log")
      .insert({
        categoria,
        chave_evento: chaveEvento,
        subscription_id: sub.id,
        payload_resumo: payload.body,
      });

    if (dedupError) continue; // já notificado hoje (unique constraint) — pula em silêncio

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ title, body: payload.body, url, tag: `fa-${categoria}` })
      );
      enviados++;
    } catch (e: unknown) {
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // assinatura expirada/revogada no navegador — desativa (soft)
        await supabase.from("push_subscriptions").update({ ativo: false }).eq("id", sub.id);
      }
    }

    // stagger — nunca todos ao mesmo instante, mesmo sendo poucos destinatários hoje
    await new Promise((r) => setTimeout(r, 400));
  }

  return { categoria, enviado: true, destinatarios: enviados };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const categoria = req.nextUrl.searchParams.get("categoria") as Categoria | null;
  if (categoria !== "prazo" && categoria !== "financeiro") {
    return NextResponse.json({ error: "categoria inválida (agenda|financeiro)" }, { status: 400 });
  }

  try {
    garantirVapid();
    const resultado = await dispatch(categoria);
    return NextResponse.json(resultado);
  } catch (e) {
    // falha de ferramenta aborta e reporta — nunca simula (doutrina do manual)
    return NextResponse.json({ error: "falha no disparo", detalhe: String(e) }, { status: 500 });
  }
}

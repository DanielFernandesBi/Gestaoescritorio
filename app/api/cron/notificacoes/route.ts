import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/admin";

// Rota chamada pelo Vercel Cron (ver vercel.json — UM disparo às 10h BRT / 13h
// UTC, depois do DJEN das 08h e da Triagem/T1 das 08h30) com
// Authorization: Bearer $CRON_SECRET. Usa a service role (não há usuário logado
// num cron). As 5 categorias são processadas EM SEQUÊNCIA, com stagger de 400ms
// entre destinatários — nunca tudo no mesmo instante, nunca 00h.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let _vapidPronto = false;
function garantirVapid() {
  if (_vapidPronto) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string, // ex.: "mailto:danielsfernandes8@gmail.com"
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  _vapidPronto = true;
}

const CATEGORIAS = ["prazo", "financeiro", "intimacao", "minuta", "silencio"] as const;
type Categoria = (typeof CATEGORIAS)[number];

// Título e deep link por categoria. O clique abre SEMPRE /notificacoes (a lista
// pessoal do dia — Sug. 81 fase 2, item 6); de lá cada item vai à tela de origem.
const TITULO: Record<Categoria, string> = {
  prazo: "Fernandes Advocacia · Prazos",
  financeiro: "Fernandes Advocacia · Financeiro",
  intimacao: "Fernandes Advocacia · Intimações",
  minuta: "Fernandes Advocacia · Minutas",
  silencio: "Fernandes Advocacia · Silêncio",
};
const DEEP_LINK = "/notificacoes";

function hojeISO() {
  // America/Sao_Paulo — evita depender do TZ do runtime da função
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
function ontemISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
}

type Payload = { body: string; count: number } | null;

// Limiar próprio do PUSH (config_sistema/push_prazo_dias_limiar = 2). O sino do
// app segue com alertas_dias_limiar = 7 — este é só para não chover push.
async function getLimiarPush(): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("config_sistema")
    .select("valor")
    .eq("chave", "push_prazo_dias_limiar")
    .maybeSingle();
  const n = parseInt(String(data?.valor ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

async function montarPayload(categoria: Categoria): Promise<Payload> {
  const supabase = createServiceClient();

  if (categoria === "prazo") {
    // Régua de proximidade PRÓPRIA (2 dias): só alertas COM data dentro do
    // limiar (inclui já vencidos, dias_restantes < 0). Os sem data (pendentes
    // de validação) seguem passando. Nunca a vw_alertas inteira (essa é o sino).
    const limiar = await getLimiarPush();
    const { count } = await supabase
      .from("vw_alertas")
      .select("*", { count: "exact", head: true })
      .or(`dias_restantes.is.null,dias_restantes.lte.${limiar}`);
    if (!count) return null;
    return { body: `${count} alerta(s) de prazo/agenda no radar. Abrir lista.`, count };
  }

  if (categoria === "financeiro") {
    const hoje = hojeISO();
    const ontem = ontemISO();
    // vence hoje (a_vencer) + o que VIROU atrasado ontem — nunca o backlog.
    const [venceHoje, atrasouOntem] = await Promise.all([
      supabase.from("pagamentos").select("*", { count: "exact", head: true }).eq("status", "a_vencer").eq("vencimento", hoje),
      supabase.from("pagamentos").select("*", { count: "exact", head: true }).eq("status", "atrasado").eq("vencimento", ontem),
    ]);
    const total = (venceHoje.count ?? 0) + (atrasouOntem.count ?? 0);
    if (total === 0) return null;
    const partes: string[] = [];
    if (venceHoje.count) partes.push(`${venceHoje.count} vencendo hoje`);
    if (atrasouOntem.count) partes.push(`${atrasouOntem.count} atrasada(s) desde ontem`);
    return { body: `Financeiro: ${partes.join(" · ")}. Abrir lista.`, count: total };
  }

  if (categoria === "intimacao") {
    // Intimações capturadas HOJE (pela T1). criado_em é o carimbo de ingestão.
    const inicioHoje = `${hojeISO()}T00:00:00-03:00`;
    const { count } = await supabase
      .from("intimacoes")
      .select("*", { count: "exact", head: true })
      .gte("criado_em", inicioHoje);
    if (!count) return null;
    return { body: `${count} intimação(ões) capturada(s) hoje. Abrir lista.`, count };
  }

  if (categoria === "minuta") {
    // Minutas para revisão: peças em em_revisao.
    const { count } = await supabase
      .from("pecas")
      .select("*", { count: "exact", head: true })
      .eq("status", "em_revisao");
    if (!count) return null;
    return { body: `${count} minuta(s) para revisão. Abrir lista.`, count };
  }

  // silencio → vw_processos_inercia (processos em silêncio anômalo).
  const { count } = await supabase
    .from("vw_processos_inercia")
    .select("*", { count: "exact", head: true });
  if (!count) return null;
  return { body: `${count} processo(s) em silêncio anômalo. Abrir lista.`, count };
}

async function dispatch(categoria: Categoria) {
  const supabase = createServiceClient();
  const payload = await montarPayload(categoria);
  if (!payload) return { categoria, enviado: false, motivo: "nada a notificar" };

  const chaveEvento = `${categoria}:${hojeISO()}`;

  // FILTRO POR APARELHO: só as assinaturas que marcaram esta categoria.
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("ativo", true)
    .contains("categorias", [categoria]);

  if (!subs?.length) return { categoria, enviado: false, motivo: "sem assinaturas nesta categoria" };

  let enviados = 0;
  for (const sub of subs) {
    // dedup: 1 push por categoria/evento/assinatura/dia (unique constraint)
    const { error: dedupError } = await supabase.from("notificacoes_log").insert({
      categoria,
      chave_evento: chaveEvento,
      subscription_id: sub.id,
      payload_resumo: payload.body,
    });
    if (dedupError) continue; // já notificado hoje — pula em silêncio

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: TITULO[categoria], body: payload.body, url: DEEP_LINK, tag: `fa-${categoria}` }),
      );
      enviados++;
    } catch (e: unknown) {
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // assinatura expirada/revogada no navegador — desativa (soft)
        await supabase.from("push_subscriptions").update({ ativo: false }).eq("id", sub.id);
      }
    }

    // stagger — nunca todos ao mesmo instante
    await new Promise((r) => setTimeout(r, 400));
  }

  return { categoria, enviado: true, destinatarios: enviados };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  garantirVapid();

  // categoria pode ser: ausente (roda as 5), uma só, ou um GRUPO separado por
  // vírgula (ex.: "prazo,intimacao,financeiro"). Assim o vercel.json agenda
  // grupos em horários diferentes sem multiplicar rotas.
  const param = req.nextUrl.searchParams.get("categoria");
  let alvo: Categoria[];
  if (param) {
    alvo = param
      .split(",")
      .map((s) => s.trim())
      .filter((c): c is Categoria => (CATEGORIAS as readonly string[]).includes(c));
    if (!alvo.length) {
      return NextResponse.json({ error: "categoria(s) inválida(s)" }, { status: 400 });
    }
  } else {
    alvo = [...CATEGORIAS];
  }

  try {
    const resultados = [];
    for (const cat of alvo) {
      resultados.push(await dispatch(cat));
    }
    return NextResponse.json({ ok: true, resultados });
  } catch (e) {
    // falha de ferramenta aborta e reporta — nunca simula (doutrina do manual)
    return NextResponse.json({ error: "falha no disparo", detalhe: String(e) }, { status: 500 });
  }
}

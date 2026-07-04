import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

// "Meus pushes de hoje" (Sug. 81 fase 2, item 6). O notificacoes_log tem RLS
// sem policy — a sessão do usuário não lê. Então: identifica o usuário pela
// SESSÃO (RLS), descobre as assinaturas DELE, e lê o log dessas assinaturas
// via SERVICE ROLE, estritamente filtrado pelos subscription_id do próprio
// usuário. Nada de outro usuário vaza.

export type PushCategoria = "prazo" | "financeiro" | "intimacao" | "minuta" | "silencio";

export type MeuPush = {
  id: string;
  categoria: PushCategoria;
  rotulo: string;
  resumo: string;
  href: string;
  enviado_em: string;
};

// Categoria → rótulo + tela de origem (o item leva o sócio ao contexto real).
export const PUSH_META: Record<PushCategoria, { rotulo: string; href: string }> = {
  prazo: { rotulo: "Prazos e audiências", href: "/alertas" },
  financeiro: { rotulo: "Financeiro", href: "/financeiro" },
  intimacao: { rotulo: "Intimações", href: "/intimacoes" },
  minuta: { rotulo: "Minutas para revisão", href: "/producao" },
  silencio: { rotulo: "Processos em silêncio", href: "/inercia" },
};

function inicioHojeSaoPaulo(): string {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return `${hoje}T00:00:00-03:00`;
}

export async function getMeusPushesHoje(): Promise<MeuPush[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createServiceClient();

  // assinaturas do usuário (via service role, mas filtrado pelo user.id da sessão)
  const { data: subs } = await admin.from("push_subscriptions").select("id").eq("user_id", user.id);
  const ids = (subs ?? []).map((s) => s.id as string);
  if (!ids.length) return [];

  const { data: logs } = await admin
    .from("notificacoes_log")
    .select("id, categoria, payload_resumo, enviado_em, subscription_id")
    .in("subscription_id", ids)
    .gte("enviado_em", inicioHojeSaoPaulo())
    .order("enviado_em", { ascending: false });

  // dedup por categoria (vários aparelhos geram uma linha cada — a lista pessoal
  // mostra um item por categoria, o mais recente).
  const vistas = new Set<string>();
  const out: MeuPush[] = [];
  for (const l of logs ?? []) {
    const categoria = l.categoria as PushCategoria;
    if (vistas.has(categoria)) continue;
    const meta = PUSH_META[categoria];
    if (!meta) continue;
    vistas.add(categoria);
    out.push({
      id: l.id as string,
      categoria,
      rotulo: meta.rotulo,
      resumo: (l.payload_resumo as string | null) ?? "",
      href: meta.href,
      enviado_em: l.enviado_em as string,
    });
  }
  return out;
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getAlertas, getProcessosInercia } from "@/lib/queries";
import { alvoAlerta, prazoAlerta, rotuloAlerta } from "@/lib/alertas";
import { linkPara } from "@/lib/links";
import { fmtBRL } from "@/lib/format";

// "Meus pushes de hoje" (Sug. 81 fase 2, item 6) COM DETALHE (adendo): dentro do
// app (atrás do login, área do escritório) não há sigilo de transporte — então a
// /notificacoes abre cada categoria nos ITENS REAIS que a motivaram, com link
// direto para cada registro, em vez do resumo genérico + tela geral não filtrada.
// (Segredo de justiça continua mascarado, como no resto do app.)

export type PushCategoria = "prazo" | "financeiro" | "intimacao" | "minuta" | "silencio";

export const PUSH_META: Record<PushCategoria, { rotulo: string; href: string }> = {
  prazo: { rotulo: "Prazos e audiências", href: "/alertas" },
  financeiro: { rotulo: "Financeiro", href: "/financeiro" },
  intimacao: { rotulo: "Intimações", href: "/intimacoes" },
  minuta: { rotulo: "Minutas para revisão", href: "/producao" },
  silencio: { rotulo: "Processos em silêncio", href: "/inercia" },
};

export type PushDetalheItem = {
  id: string;
  href: string;
  titulo: string;
  sub?: string | null; // CNJ, parcela, etc.
  meta?: string | null; // "amanhã", "R$ 1.200 · vence hoje", "3d em silêncio"
  tone?: "red" | "amber" | "neutral";
};

export type PushGrupo = {
  categoria: PushCategoria;
  rotulo: string;
  telaHref: string;
  enviado_em: string;
  itens: PushDetalheItem[];
};

function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
function ontemSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
}

type Supa = Awaited<ReturnType<typeof createClient>>;

async function limiarPush(supabase: Supa): Promise<number> {
  const { data } = await supabase
    .from("config_sistema")
    .select("valor")
    .eq("chave", "push_prazo_dias_limiar")
    .maybeSingle();
  const n = parseInt(String(data?.valor ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

// ── Detalhe por categoria (sessão do usuário → RLS) ────────────────────────────

async function detalhePrazo(supabase: Supa): Promise<PushDetalheItem[]> {
  const [alertas, limiar] = await Promise.all([getAlertas(80), limiarPush(supabase)]);
  return alertas
    .filter((a) => a.dias_restantes == null || a.dias_restantes <= limiar)
    .map((a) => ({
      id: `${a.tipo_alerta}-${a.id}`,
      href: alvoAlerta(a),
      titulo: a.segredo ? "🔒 Sigiloso" : a.titulo,
      sub: a.segredo ? null : a.numero_cnj,
      meta: [rotuloAlerta(a.tipo_alerta), prazoAlerta(a)].filter(Boolean).join(" · ") || null,
      tone: a.prioridade <= 1 ? "red" : a.prioridade === 2 ? "amber" : "neutral",
    }));
}

type NestedCli = { nome: string | null } | null;
type NestedProc = { numero_cnj: string | null; segredo_justica: boolean | null } | null;

async function detalheFinanceiro(supabase: Supa): Promise<PushDetalheItem[]> {
  const hoje = hojeSP();
  const ontem = ontemSP();
  const { data } = await supabase
    .from("pagamentos")
    .select(
      "id, numero_parcela, valor, vencimento, status, contratos(id, clientes(nome), processos(numero_cnj, segredo_justica))",
    )
    .or(
      `and(status.eq.a_vencer,vencimento.eq.${hoje}),and(status.eq.atrasado,vencimento.eq.${ontem})`,
    )
    .order("vencimento", { ascending: true });

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const ctr = r.contratos as unknown as
      | { id: string; clientes: NestedCli; processos: NestedProc }
      | null;
    const segredo = Boolean(ctr?.processos?.segredo_justica);
    const nome = ctr?.clientes?.nome;
    const venceHoje = r.status === "a_vencer";
    return {
      id: r.id as string,
      href: ctr?.id ? linkPara("contrato", ctr.id) : "/financeiro",
      titulo: segredo ? "🔒 Cliente reservado" : nome || "Parcela",
      sub: segredo ? null : (ctr?.processos?.numero_cnj ?? null),
      meta: `${fmtBRL(r.valor as number)} · ${venceHoje ? "vence hoje" : "atrasou ontem"}`,
      tone: venceHoje ? "amber" : "red",
    };
  });
}

async function detalheIntimacao(supabase: Supa): Promise<PushDetalheItem[]> {
  const inicioHoje = `${hojeSP()}T00:00:00-03:00`;
  const { data } = await supabase
    .from("intimacoes")
    .select(
      "id, resumo, criado_em, processos(numero_cnj, segredo_justica, cliente_processo(clientes(nome)))",
    )
    .gte("criado_em", inicioHoje)
    .order("criado_em", { ascending: false })
    .limit(60);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const proc = r.processos as unknown as
      | { numero_cnj: string | null; segredo_justica: boolean | null; cliente_processo: { clientes: NestedCli }[] | null }
      | null;
    const segredo = Boolean(proc?.segredo_justica);
    const nome = proc?.cliente_processo?.[0]?.clientes?.nome;
    return {
      id: r.id as string,
      href: linkPara("intimacao", r.id as string),
      titulo: segredo ? "🔒 Sigiloso" : (r.resumo as string) || nome || "Intimação",
      sub: segredo ? null : (proc?.numero_cnj ?? null),
      meta: null,
      tone: "neutral",
    };
  });
}

async function detalheMinuta(supabase: Supa): Promise<PushDetalheItem[]> {
  const { data } = await supabase
    .from("pecas")
    .select("id, titulo, atualizado_em, clientes(nome), processos(numero_cnj, segredo_justica)")
    .eq("status", "em_revisao")
    .order("atualizado_em", { ascending: false })
    .limit(60);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const proc = r.processos as unknown as NestedProc;
    const cli = r.clientes as unknown as NestedCli;
    const segredo = Boolean(proc?.segredo_justica);
    return {
      id: r.id as string,
      href: linkPara("peca", r.id as string),
      titulo: (r.titulo as string) || (segredo ? "🔒 Sigiloso" : cli?.nome ?? "Minuta"),
      sub: segredo ? null : (proc?.numero_cnj ?? null),
      meta: "em revisão",
      tone: "amber",
    };
  });
}

async function detalheSilencio(): Promise<PushDetalheItem[]> {
  const proc = await getProcessosInercia(60);
  return proc.map((p) => ({
    id: p.id,
    href: linkPara("processo", p.id),
    titulo: p.segredo ? "🔒 Sigiloso" : (p.clientes || p.numero_cnj || "Processo"),
    sub: p.segredo ? null : p.numero_cnj,
    meta: `${p.dias_silencio}d em silêncio`,
    tone: p.prioridade === "alta" ? "red" : "amber",
  }));
}

async function detalhePorCategoria(supabase: Supa, categoria: PushCategoria): Promise<PushDetalheItem[]> {
  switch (categoria) {
    case "prazo":
      return detalhePrazo(supabase);
    case "financeiro":
      return detalheFinanceiro(supabase);
    case "intimacao":
      return detalheIntimacao(supabase);
    case "minuta":
      return detalheMinuta(supabase);
    case "silencio":
      return detalheSilencio();
  }
}

// Categorias que dispararam push HOJE para o usuário logado (via service role —
// o notificacoes_log tem RLS sem policy), já com o horário mais recente por
// categoria; depois abre cada uma nos itens reais (via sessão + RLS).
export async function getNotificacoesComDetalhe(): Promise<PushGrupo[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createServiceClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id").eq("user_id", user.id);
  const ids = (subs ?? []).map((s) => s.id as string);
  if (!ids.length) return [];

  const inicioHoje = `${hojeSP()}T00:00:00-03:00`;
  const { data: logs } = await admin
    .from("notificacoes_log")
    .select("categoria, enviado_em")
    .in("subscription_id", ids)
    .gte("enviado_em", inicioHoje)
    .order("enviado_em", { ascending: false });

  // categoria → horário mais recente (1 grupo por categoria)
  const horario = new Map<PushCategoria, string>();
  for (const l of (logs ?? []) as { categoria: PushCategoria; enviado_em: string }[]) {
    if (!horario.has(l.categoria)) horario.set(l.categoria, l.enviado_em);
  }
  if (!horario.size) return [];

  const grupos = await Promise.all(
    [...horario.entries()]
      .filter(([cat]) => PUSH_META[cat])
      .map(async ([cat, enviado_em]): Promise<PushGrupo> => ({
        categoria: cat,
        rotulo: PUSH_META[cat].rotulo,
        telaHref: PUSH_META[cat].href,
        enviado_em,
        // resiliente: se a consulta de uma categoria falhar, o grupo aparece
        // vazio em vez de derrubar a página inteira.
        itens: await detalhePorCategoria(supabase, cat).catch(() => []),
      })),
  );

  // ordena por horário de envio (mais recente primeiro)
  return grupos.sort((a, b) => (a.enviado_em < b.enviado_em ? 1 : -1));
}

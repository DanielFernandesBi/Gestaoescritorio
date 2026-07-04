import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Preferências de categorias POR APARELHO (Sug. 81 fase 2). A assinatura é
// identificada pelo endpoint (que o próprio aparelho conhece via pushManager).
// Usa a sessão do usuário + RLS (dono gerencia a própria assinatura), então
// ninguém mexe na assinatura de outro.
export const dynamic = "force-dynamic";

const VALIDAS = ["prazo", "financeiro", "intimacao", "minuta", "silencio"] as const;

// GET /api/push/categorias?endpoint=... → categorias marcadas neste aparelho.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const endpoint = req.nextUrl.searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "endpoint obrigatório" }, { status: 400 });

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("categorias")
    .eq("endpoint", endpoint)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "assinatura não encontrada" }, { status: 404 });

  return NextResponse.json({ categorias: data.categorias ?? [] });
}

// POST { endpoint, categorias: string[] } → grava as categorias deste aparelho.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { endpoint, categorias } = (await req.json()) as {
    endpoint?: string;
    categorias?: unknown;
  };
  if (!endpoint) return NextResponse.json({ error: "endpoint obrigatório" }, { status: 400 });

  if (!Array.isArray(categorias) || categorias.some((c) => !VALIDAS.includes(c as never))) {
    return NextResponse.json({ error: "categorias inválidas" }, { status: 400 });
  }
  // dedup + ordem estável
  const limpa = VALIDAS.filter((c) => (categorias as string[]).includes(c));

  const { error } = await supabase
    .from("push_subscriptions")
    .update({ categorias: limpa })
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, categorias: limpa });
}

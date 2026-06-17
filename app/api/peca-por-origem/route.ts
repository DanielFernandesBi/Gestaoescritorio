import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const COL: Record<string, string> = {
  andamento: "origem_andamento_id",
  intimacao: "intimacao_id",
  tarefa: "tarefa_id",
};

/** Peça já existente para uma origem (dedup do botão "Criar petição pendente"). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") ?? "";
  const id = searchParams.get("id") ?? "";
  const col = COL[tipo];
  if (!col || !id) return NextResponse.json({ peca: null });

  const supabase = await createClient();
  const { data } = await supabase
    .from("pecas")
    .select("id, titulo, status")
    .eq(col, id)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ peca: data ?? null });
}

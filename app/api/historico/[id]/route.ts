import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Histórico de auditoria de um registro (por registro_id). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("auditoria")
    .select("id, ocorrido_em, tabela, operacao, dados_antes, dados_depois, origem")
    .eq("registro_id", id)
    .order("ocorrido_em", { ascending: false })
    .limit(50);
  return NextResponse.json({ eventos: data ?? [] });
}

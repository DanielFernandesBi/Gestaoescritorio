import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Lista enxuta de clientes ativos (id + nome) para seletores. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true });
  return NextResponse.json({ clientes: data ?? [] });
}

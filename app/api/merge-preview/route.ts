import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Contagens do que será reassociado de um registro DUPLICADO, antes de mesclar. */
export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get("tipo");
  const dup = req.nextUrl.searchParams.get("dup");
  if (!dup || (tipo !== "cliente" && tipo !== "processo")) {
    return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });
  }
  const supabase = await createClient();
  const fn = tipo === "cliente" ? "fn_merge_preview_cliente" : "fn_merge_preview_processo";
  const { data, error } = await supabase.rpc(fn, { dup });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contagens: data ?? {} });
}

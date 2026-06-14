import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Detalhe cruzado de um processo: prazos, audiências, intimações e andamentos. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const [prazos, audiencias, intimacoes, andamentos] = await Promise.all([
    supabase
      .from("prazos")
      .select("id, ato, data_fatal, data_interna, status, validado")
      .eq("processo_id", id)
      .eq("status", "aberto")
      .order("data_fatal", { ascending: true }),
    supabase
      .from("audiencias")
      .select("id, tipo, data_hora, modalidade, status, validado")
      .eq("processo_id", id)
      .order("data_hora", { ascending: true }),
    supabase
      .from("intimacoes")
      .select("id, resumo, origem, status, data_publicacao")
      .eq("processo_id", id)
      .order("data_publicacao", { ascending: false, nullsFirst: false })
      .limit(15),
    supabase
      .from("andamentos")
      .select("id, data, tipo, descricao, origem")
      .eq("processo_id", id)
      .order("data", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    prazos: prazos.data ?? [],
    audiencias: audiencias.data ?? [],
    intimacoes: intimacoes.data ?? [],
    andamentos: andamentos.data ?? [],
  });
}

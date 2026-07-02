import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEstudosDoProcesso, getDocumentosProcesso } from "@/lib/data";

/** Detalhe cruzado de um processo: prazos, audiências, intimações, andamentos,
 * peças e tarefas (F1 · Sug. 75). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const [completo, prazos, audiencias, intimacoes, andamentos, pecas, tarefas, estudos, documentos] = await Promise.all([
    supabase.from("processos").select("*").eq("id", id).single(),
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
    // Sug. 75 (F1) — peças e tarefas do processo, antes ausentes deste loader.
    supabase
      .from("pecas")
      .select("id, titulo, tipo, subtipo, status")
      .eq("processo_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("tarefas")
      .select("id, titulo, status, prioridade, responsavel, data_limite")
      .eq("processo_id", id)
      .order("data_limite", { ascending: true, nullsFirst: false })
      .limit(50),
    getEstudosDoProcesso(id),
    getDocumentosProcesso(id),
  ]);

  return NextResponse.json({
    processo: completo.data ?? null,
    prazos: prazos.data ?? [],
    audiencias: audiencias.data ?? [],
    intimacoes: intimacoes.data ?? [],
    andamentos: andamentos.data ?? [],
    pecas: pecas.data ?? [],
    tarefas: tarefas.data ?? [],
    estudos,
    documentos,
  });
}

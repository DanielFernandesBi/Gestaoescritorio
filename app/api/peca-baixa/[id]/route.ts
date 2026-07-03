import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Contexto da baixa de uma peça (Sug. 75 · etapa 5 · F4): o que a fn_baixa_ato
 * fecharia em cascata — prazo, tarefa, intimação — e as gêmeas do cluster da
 * intimação (confirmadas convergem sozinhas; não confirmadas viram opcionais). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pc } = await supabase
    .from("pecas")
    .select("id, titulo, status, processo_id, prazo_id, intimacao_id, tarefa_id, processos(segredo_justica)")
    .eq("id", id)
    .maybeSingle();
  if (!pc) return NextResponse.json({ peca: null });

  const segredo = Boolean((pc.processos as { segredo_justica?: boolean } | null)?.segredo_justica);

  // Prazo vinculado (só relevante se ainda aberto).
  let prazo: { id: string; ato: string; data_fatal: string | null; status: string } | null = null;
  if (pc.prazo_id) {
    const { data: pr } = await supabase.from("prazos").select("id, ato, data_fatal, status").eq("id", pc.prazo_id).maybeSingle();
    if (pr && pr.status === "aberto") prazo = { id: pr.id as string, ato: pr.ato as string, data_fatal: (pr.data_fatal as string | null) ?? null, status: pr.status as string };
  }

  // Tarefa vinculada (só relevante se ainda pendente/em andamento).
  let tarefa: { id: string; titulo: string; status: string } | null = null;
  if (pc.tarefa_id) {
    const { data: t } = await supabase.from("tarefas").select("id, titulo, status").eq("id", pc.tarefa_id).maybeSingle();
    if (t && ["pendente", "em_andamento"].includes(t.status as string)) tarefa = { id: t.id as string, titulo: t.titulo as string, status: t.status as string };
  }

  // Intimação vinculada + se já é ato canônico confirmado.
  let intimacao: { id: string; resumo: string | null; status: string | null } | null = null;
  let gemeasConfirmadas = false;
  let gemeas: { intimacao_id: string; origem: string | null; status: string | null; amostra: string | null }[] = [];
  if (pc.intimacao_id) {
    const { data: it } = await supabase.from("intimacoes").select("id, resumo, status, ato_canonico_id").eq("id", pc.intimacao_id).maybeSingle();
    if (it) {
      intimacao = { id: it.id as string, resumo: (it.resumo as string | null) ?? null, status: (it.status as string | null) ?? null };
      gemeasConfirmadas = (it.ato_canonico_id as string | null) != null;

      // Só oferece gêmeas extras quando a intimação AINDA não foi confirmada.
      if (!gemeasConfirmadas) {
        const { data: cl } = await supabase.from("vw_intimacoes_atos_candidatos").select("ato_cluster_id").eq("intimacao_id", pc.intimacao_id).maybeSingle();
        const cluster = cl?.ato_cluster_id as string | undefined;
        if (cluster) {
          const { data: rows } = await supabase
            .from("vw_intimacoes_atos_candidatos")
            .select("intimacao_id, origem, status, amostra")
            .eq("ato_cluster_id", cluster)
            .neq("intimacao_id", pc.intimacao_id);
          const outrasIds = (rows ?? []).map((r) => r.intimacao_id as string);
          if (outrasIds.length) {
            // Descarta as que já estão confirmadas (ato_canonico_id não nulo).
            const { data: canon } = await supabase.from("intimacoes").select("id, ato_canonico_id").in("id", outrasIds);
            const confirmadas = new Set((canon ?? []).filter((r) => (r.ato_canonico_id as string | null) != null).map((r) => r.id as string));
            gemeas = (rows ?? [])
              .filter((r) => !confirmadas.has(r.intimacao_id as string))
              .map((r) => ({ intimacao_id: r.intimacao_id as string, origem: (r.origem as string | null) ?? null, status: (r.status as string | null) ?? null, amostra: (r.amostra as string | null) ?? null }));
          }
        }
      }
    }
  }

  return NextResponse.json({
    peca: { id: pc.id as string, titulo: pc.titulo as string, status: pc.status as string, processo_id: (pc.processo_id as string | null) ?? null, segredo },
    prazo, tarefa, intimacao, gemeasConfirmadas, gemeas,
  });
}

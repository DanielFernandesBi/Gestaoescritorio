import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Lista enxuta de processos para seletores (rótulo + cliente). */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("processos")
    .select("id, numero_cnj, numero_registro_tribunal, area, instancia, segredo_justica, cliente_processo(clientes(nome))")
    .neq("status", "arquivado")
    .order("criado_em", { ascending: false })
    .limit(1200);

  const processos = (data ?? []).map((p) => {
    const cp = (p.cliente_processo ?? []) as unknown as { clientes: { nome: string } | null }[];
    const nomes = [...new Set(cp.map((x) => x.clientes?.nome).filter(Boolean))].join(", ");
    const ref = p.segredo_justica
      ? "(sigiloso)"
      : (p.numero_cnj as string) || (p.numero_registro_tribunal ? "reg " + p.numero_registro_tribunal : "sem nº");
    const label = [ref, nomes].filter(Boolean).join(" — ");
    return {
      id: p.id as string,
      label,
      area: p.area as string | null,
      instancia: p.instancia as string | null,
      numero_cnj: (p.numero_cnj as string) ?? null,
      segredo: Boolean(p.segredo_justica),
    };
  });

  return NextResponse.json({ processos });
}

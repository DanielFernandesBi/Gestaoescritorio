import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";

/** Lista enxuta de intimações recentes para seletores (rótulo: resumo · processo · data). */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("intimacoes")
    .select("id, resumo, data_publicacao, processos(numero_cnj, numero_registro_tribunal, segredo_justica)")
    .order("data_publicacao", { ascending: false, nullsFirst: false })
    .limit(400);

  const intimacoes = (data ?? []).map((i) => {
    const proc = i.processos as unknown as {
      numero_cnj: string | null;
      numero_registro_tribunal: string | null;
      segredo_justica: boolean | null;
    } | null;
    const ref = proc?.segredo_justica
      ? "(sigiloso)"
      : proc?.numero_cnj || (proc?.numero_registro_tribunal ? "reg " + proc.numero_registro_tribunal : "órfã");
    const resumo = ((i.resumo as string) ?? "—").slice(0, 70);
    const label = [resumo, ref, fmtDate(i.data_publicacao as string)].filter(Boolean).join(" · ");
    return { id: i.id as string, label };
  });

  return NextResponse.json({ intimacoes });
}

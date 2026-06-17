import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";

/** Lista enxuta de prazos abertos para seletores (rótulo: ato · fatal · processo). */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prazos")
    .select("id, ato, data_fatal, processos(numero_cnj, numero_registro_tribunal, segredo_justica)")
    .eq("status", "aberto")
    .order("data_fatal", { ascending: true })
    .limit(800);

  const prazos = (data ?? []).map((p) => {
    const proc = p.processos as unknown as {
      numero_cnj: string | null;
      numero_registro_tribunal: string | null;
      segredo_justica: boolean | null;
    } | null;
    const ref = proc?.segredo_justica
      ? "(sigiloso)"
      : proc?.numero_cnj || (proc?.numero_registro_tribunal ? "reg " + proc.numero_registro_tribunal : "sem processo");
    const label = [`${p.ato} — fatal ${fmtDate(p.data_fatal as string)}`, ref].filter(Boolean).join(" · ");
    return { id: p.id as string, label };
  });

  return NextResponse.json({ prazos });
}

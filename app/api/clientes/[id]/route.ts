import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExecucaoCliente } from "@/lib/data";

/** Detalhe cruzado de um cliente: processos, prazos abertos e audiências futuras. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: completo } = await supabase.from("clientes").select("*").eq("id", id).single();

  // Processos do cliente (via vínculo N:N)
  const { data: vinculos } = await supabase
    .from("cliente_processo")
    .select(
      "papel, processos(id, numero_cnj, numero_registro_tribunal, tribunal, area, instancia, status, segredo_justica)",
    )
    .eq("cliente_id", id);

  type ProcRow = {
    id: string;
    numero_cnj: string | null;
    numero_registro_tribunal: string | null;
    tribunal: string | null;
    area: string | null;
    instancia: string | null;
    status: string;
    segredo_justica: boolean | null;
  };

  const processos = (vinculos ?? [])
    .map((v) => {
      const p = v.processos as unknown as ProcRow | null;
      if (!p) return null;
      return { ...p, papel: v.papel as string | null };
    })
    .filter(Boolean) as (ProcRow & { papel: string | null })[];

  const procIds = processos.map((p) => p.id);

  // Prazos abertos e audiências futuras desses processos
  const [prazos, audiencias] = procIds.length
    ? await Promise.all([
        supabase
          .from("prazos")
          .select("id, ato, data_fatal, validado, processo_id")
          .in("processo_id", procIds)
          .eq("status", "aberto")
          .order("data_fatal", { ascending: true }),
        supabase
          .from("audiencias")
          .select("id, tipo, data_hora, modalidade, status, processo_id")
          .in("processo_id", procIds)
          .eq("status", "designada")
          .order("data_hora", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  const execucao = await getExecucaoCliente(id);

  return NextResponse.json({
    cliente: completo ?? null,
    processos,
    prazos: prazos.data ?? [],
    audiencias: audiencias.data ?? [],
    execucao,
  });
}

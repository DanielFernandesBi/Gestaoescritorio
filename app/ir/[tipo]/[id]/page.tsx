import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEntidadeTipo, linkNavegavel, linkLista, linkPara } from "@/lib/links";

/**
 * Resolver universal de links: `/ir/<tipo>/<id>`.
 *
 * Endereço estável e agnóstico de rota, pensado para a IA/Cowork, e-mails,
 * Google Calendar e auditoria referenciarem um registro sem conhecer a
 * estrutura interna de rotas. Redireciona para o detalhe canônico quando ele
 * já existe; senão, cai na lista do tipo (nunca 404). Conforme as páginas de
 * detalhe forem entregues (flags em lib/links), os mesmos links `/ir` passam a
 * apontar para o detalhe automaticamente.
 */
export default async function IrPage({
  params,
}: {
  params: Promise<{ tipo: string; id: string }>;
}) {
  const { tipo, id } = await params;

  // Andamentos não têm página própria: resolvem para o processo da movimentação
  // (a timeline vive na ficha do processo); órfão cai na lista de andamentos.
  if (tipo === "andamento") {
    const supabase = await createClient();
    const { data } = await supabase.from("andamentos").select("processo_id").eq("id", id).maybeSingle();
    redirect(data?.processo_id ? linkPara("processo", data.processo_id as string) : "/andamentos");
  }

  if (!isEntidadeTipo(tipo)) redirect("/painel");
  redirect(linkNavegavel(tipo, id) ?? linkLista(tipo));
}

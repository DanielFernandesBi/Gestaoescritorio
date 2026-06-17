import { redirect } from "next/navigation";
import { isEntidadeTipo, linkNavegavel, linkLista } from "@/lib/links";

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
  if (!isEntidadeTipo(tipo)) redirect("/painel");
  redirect(linkNavegavel(tipo, id) ?? linkLista(tipo));
}

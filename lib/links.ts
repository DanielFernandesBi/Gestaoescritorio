/**
 * Mapa central de links do sistema — fonte única da verdade para as URLs
 * canônicas de cada registro. Use SEMPRE `linkPara` em vez de montar href à mão,
 * para que mudanças de rota fiquem num só lugar.
 *
 * `linkResolver` produz o endereço estável `/ir/<tipo>/<id>`, pensado para a
 * IA/Cowork, e-mails, Google Calendar e auditoria referenciarem um registro sem
 * conhecer a estrutura de rotas (chega na Fase 2).
 */

export type EntidadeTipo = "processo" | "cliente" | "audiencia" | "intimacao" | "prazo";

const ROTA: Record<EntidadeTipo, string> = {
  processo: "/processos",
  cliente: "/clientes",
  audiencia: "/audiencias",
  intimacao: "/intimacoes",
  prazo: "/prazos",
};

/** URL canônica de um registro específico, ex.: linkPara("processo", id) → "/processos/<id>". */
export function linkPara(tipo: EntidadeTipo, id: string): string {
  return `${ROTA[tipo]}/${id}`;
}

/** Endereço estável e agnóstico de rota: "/ir/<tipo>/<id>" (resolvido na Fase 2). */
export function linkResolver(tipo: EntidadeTipo, id: string): string {
  return `/ir/${tipo}/${id}`;
}

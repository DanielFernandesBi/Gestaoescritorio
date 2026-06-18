/**
 * Mapa central de links do sistema — fonte única da verdade para as URLs
 * canônicas de cada registro. Use SEMPRE `linkPara` em vez de montar href à mão,
 * para que mudanças de rota fiquem num só lugar.
 *
 * `linkResolver` produz o endereço estável `/ir/<tipo>/<id>`, pensado para a
 * IA/Cowork, e-mails, Google Calendar e auditoria referenciarem um registro sem
 * conhecer a estrutura de rotas (chega na Fase 2).
 */

export type EntidadeTipo = "processo" | "cliente" | "audiencia" | "intimacao" | "prazo" | "tarefa" | "contrato";

const ROTA: Record<EntidadeTipo, string> = {
  processo: "/processos",
  cliente: "/clientes",
  audiencia: "/audiencias",
  intimacao: "/intimacoes",
  prazo: "/prazos",
  tarefa: "/tarefas",
  contrato: "/contratos",
};

/** URL canônica de um registro específico, ex.: linkPara("processo", id) → "/processos/<id>". */
export function linkPara(tipo: EntidadeTipo, id: string): string {
  return `${ROTA[tipo]}/${id}`;
}

/** Rota da lista do tipo (fallback quando ainda não há página de detalhe). */
export function linkLista(tipo: EntidadeTipo): string {
  return ROTA[tipo];
}

/** Guard: a string é um tipo de entidade conhecido? */
export function isEntidadeTipo(x: string): x is EntidadeTipo {
  return Object.prototype.hasOwnProperty.call(ROTA, x);
}

/**
 * Tipos que já possuem página de detalhe (`/<rota>/<id>`). Conforme as fases
 * forem entregando as demais páginas, basta virar a flag aqui — todos os links
 * (UI e resolver /ir) passam a apontar para o detalhe automaticamente.
 */
const TEM_PAGINA: Record<EntidadeTipo, boolean> = {
  processo: true, // Fase 1
  cliente: true, // Fase 3
  audiencia: true, // Fase 3
  intimacao: true, // Fase 3b
  prazo: true, // Fase 3b
  tarefa: true, // integração painel
  contrato: true, // integração painel
};

/** Existe página de detalhe para este tipo hoje? */
export function temPagina(tipo: EntidadeTipo): boolean {
  return TEM_PAGINA[tipo];
}

/**
 * Link "seguro para agora": o detalhe canônico quando a página já existe,
 * senão `null` (a UI deve então renderizar texto puro, não um link quebrado).
 */
export function linkNavegavel(tipo: EntidadeTipo, id: string): string | null {
  return TEM_PAGINA[tipo] ? linkPara(tipo, id) : null;
}

/** Mapeia o nome da tabela (auditoria, etc.) para o tipo de entidade navegável. */
export function tipoDeTabela(tabela: string | null): EntidadeTipo | null {
  switch (tabela) {
    case "processos": return "processo";
    case "clientes": return "cliente";
    case "audiencias": return "audiencia";
    case "intimacoes": return "intimacao";
    case "prazos": return "prazo";
    case "tarefas": return "tarefa";
    case "contratos": return "contrato";
    default: return null;
  }
}

/** Endereço estável e agnóstico de rota: "/ir/<tipo>/<id>" (resolvido na Fase 2). */
export function linkResolver(tipo: EntidadeTipo, id: string): string {
  return `/ir/${tipo}/${id}`;
}

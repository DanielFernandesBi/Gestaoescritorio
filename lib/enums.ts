/** Valores válidos (espelham os CHECK constraints do banco). */

export const RESPONSAVEIS = ["Daniel", "Rodolfo", "Ambos", "Correspondente"] as const;

export const PRAZO_STATUS = ["aberto", "cumprido", "perdido", "prejudicado", "cancelado"] as const;
export const TIPO_CONTAGEM = ["corridos", "uteis"] as const;

export const INTIMACAO_STATUS = [
  "pendente",
  "em_analise",
  "providencia_tomada",
  "sem_providencia",
  "arquivada",
] as const;
export const INTIMACAO_ORIGEM = [
  "dje", "djen", "push", "pje", "eproc", "esaj", "projudi", "seeu", "email", "oficio", "outro",
] as const;

export const TAREFA_STATUS = ["pendente", "em_andamento", "concluida", "cancelada"] as const;
export const PRIORIDADES = ["baixa", "media", "alta", "urgente"] as const;

// Produção de peças (kanban de escrita — Sugestão 20). Espelha os CHECK do banco.
export const PECA_TIPO = [
  "inicial", "defesa", "recurso", "manifestacao", "memorial", "incidente", "outra",
] as const;
export const PECA_STATUS = [
  "a_fazer", "em_elaboracao", "em_revisao", "aguardando_insumo",
  "pronta", "protocolada", "cancelada", "prejudicada",
] as const;

export const ANDAMENTO_TIPO = [
  "peticao_protocolada", "decisao", "sentenca", "acordao", "despacho",
  "recurso_interposto", "hc_impetrado", "diligencia", "reuniao_cliente",
  "visita_presidio", "movimentacao_tribunal", "outro",
] as const;
export const ANDAMENTO_ORIGEM = [
  "dje", "djen", "push", "pje", "eproc", "esaj", "projudi", "seeu", "email", "oficio", "tribunal", "outro",
] as const;

export const PROCESSO_INSTANCIA = ["1grau", "2grau", "stj", "stf", "vep", "outra"] as const;
export const PROCESSO_AREA = [
  "criminal", "execucao_penal", "transferencia_federal", "habeas_corpus",
  "revisao_criminal", "civel", "outra",
] as const;
export const PROCESSO_STATUS = [
  "ativo", "suspenso", "arquivado", "transitado_em_julgado", "baixado",
] as const;
export const SITUACAO_PRISIONAL = [
  "solto", "preso_provisorio", "preso_definitivo", "regime_semiaberto",
  "regime_aberto", "monitoramento", "foragido", "falecido",
] as const;
export const PAPEL = [
  "reu", "investigado", "executado", "paciente", "requerente", "recorrente", "vitima", "outro",
] as const;
export const AUDIENCIA_TIPO = [
  "instrucao", "custodia", "interrogatorio", "juri", "sessao_julgamento",
  "conciliacao", "justificacao", "admonitoria", "outra",
] as const;
export const AUDIENCIA_MODALIDADE = ["presencial", "videoconferencia", "hibrida", "virtual"] as const;

export const AUDIENCIA_STATUS = ["designada", "realizada", "redesignada", "cancelada"] as const;
export const PAGAMENTO_STATUS = ["a_vencer", "pago", "atrasado", "renegociado", "cancelado"] as const;
export const CONTRATO_STATUS = ["vigente", "quitado", "rescindido", "inadimplente"] as const;
export const DESPESA_CATEGORIA = [
  "custas", "diligencia", "correspondente", "viagem", "copia_autos", "cartorio", "outra",
] as const;
export const SUGESTAO_STATUS = ["pendente", "aprovada", "executada", "rejeitada"] as const;

// Documentos (acervo do Drive ligado ao caso) — espelha o CHECK do banco.
export const DOCUMENTO_TIPO = [
  "peca", "pedido", "resultado", "nota", "decisao", "atestado",
  "contrato", "procuracao", "documento_pessoal", "bruto", "outro",
] as const;

// Execução penal — atestado de pena (cadastro do SEEU). Campos sem CHECK no banco;
// padronizados aqui para casar com os rótulos da aba Execução.
export const REGIME_EXEC = ["fechado", "semiaberto", "aberto", "livramento"] as const;
export const REGIME_IMPOSTO = ["fechado", "semiaberto", "aberto"] as const;
export const CONDENACAO_SITUACAO = ["ativa", "extinta", "suspensa"] as const;
export const BENEFICIO_ALVO = [
  "progressao", "livramento", "comutacao", "unificacao", "reducao_pena", "absolvicao",
] as const;

// Estudos de caso (estratégia por cliente/execução)
export const ESTUDO_STATUS = ["em_elaboracao", "concluido", "aplicado", "superado"] as const;
export const ESTUDO_TIPO = ["geral", "execucao_global", "recurso", "defesa", "revisional"] as const;
export const OBJETIVO_STATUS = ["planejado", "em_curso", "atingido", "frustrado", "prejudicado"] as const;

/* Funil de novos negócios (Sug. 59/68) — pré-contrato. */
export const OPORTUNIDADE_ESTAGIO = ["tratativa", "estudo_preliminar", "proposta", "negociacao", "fechado", "recusado", "perdido"] as const;
export const ORIGEM_LEAD = ["indicacao", "site", "instagram", "telefone", "outro"] as const;
export const PROBABILIDADE = ["baixa", "media", "alta"] as const;

/** Rótulos amigáveis para alguns valores. */
export const ROTULO: Record<string, string> = {
  providencia_tomada: "Providência tomada",
  em_analise: "Em análise",
  sem_providencia: "Sem providência",
  arquivada: "Arquivada",
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
  peticao_protocolada: "Petição protocolada",
};

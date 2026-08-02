/**
 * Sugestão 96 — "protocolo = arquivamento". Marca de pendência gravada na
 * `pecas.descricao` quando a baixa ocorre SEM o PDF protocolado. A UI detecta a
 * marca pelo prefixo (badge "arquivamento pendente"); ao anexar o arquivo depois,
 * a linha é substituída pela marca de arquivada — preservando o resto da descrição.
 * Helper puro (sem deps server-only): pode ser importado por cliente e servidor.
 */
export const TAG_PENDENTE_ARQ_PREFIXO = "[PENDENTE ARQUIVAMENTO — Sug. 96]";

export const TAG_PENDENTE_ARQ =
  `${TAG_PENDENTE_ARQ_PREFIXO} Protocolada sem PDF salvo; ao receber o arquivo, subir na subpasta do processo e registrar em documentos.`;

/** Verdadeiro quando a descrição carrega a marca de arquivamento pendente. */
export function pendenteArquivamento(descricao: string | null | undefined): boolean {
  return Boolean(descricao && descricao.includes(TAG_PENDENTE_ARQ_PREFIXO));
}

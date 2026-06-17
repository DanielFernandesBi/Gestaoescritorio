/**
 * Mapa determinístico providência → tipo/subtipo de peça
 * (config_sistema/mapa_providencia_peca, Sugestão 20). Casamento por palavra-chave,
 * case e acento-insensível; a PRIMEIRA regra que casar vence; sem regra → fallback;
 * termos de "ignorar" (movimentações meramente informativas) NÃO geram peça.
 *
 * Módulo puro (sem dependências de servidor) — usado tanto na leitura (server)
 * quanto na sugestão do formulário (client). Mesma fonte que a automação usa.
 */

export type RegraMapa = { quando_contem: string[]; tipo: string; subtipo: string | null };
export type MapaProvidencia = {
  regras: RegraMapa[];
  fallback: { tipo: string; subtipo: string | null };
  ignorar: string[];
};

export type SugestaoPeca = { tipo: string; subtipo: string | null; ignorar: boolean };

/** lower + remoção de acentos (espelha f_unaccent + lower do banco). */
function norm(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Sugere tipo/subtipo a partir do texto de providência/descrição.
 * Retorna null quando não há texto ou mapa. `ignorar=true` sinaliza movimentação
 * informativa (esconder/desabilitar o botão de criar peça).
 */
export function sugerirPeca(
  texto: string | null | undefined,
  mapa: MapaProvidencia | null,
): SugestaoPeca | null {
  if (!mapa) return null;
  const t = norm(texto);
  if (!t.trim()) return null;

  // Primeira regra cujo "quando_contem" casar por substring vence (item de ação claro).
  const regra = mapa.regras?.find((r) => r.quando_contem?.some((k) => t.includes(norm(k))));
  if (regra) return { tipo: regra.tipo, subtipo: regra.subtipo ?? null, ignorar: false };

  const fb = mapa.fallback ?? { tipo: "outra", subtipo: null };
  // Sem regra de ação: se casar com algum termo informativo, não sugerir peça.
  if (mapa.ignorar?.some((k) => t.includes(norm(k)))) {
    return { tipo: fb.tipo, subtipo: fb.subtipo ?? null, ignorar: true };
  }
  return { tipo: fb.tipo, subtipo: fb.subtipo ?? null, ignorar: false };
}

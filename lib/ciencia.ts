/* Ciência pessoal de intimações (Sugestão 82) — leitura por usuário logado.
 * A vw_intimacoes_contexto expõe leram_ids (uuid[] dos que deram ciência),
 * leram_rotulos (nomes) e qtd_leituras. "Lida" é relativo ao usuário atual;
 * revisado_em/revisado_por seguem como "primeira leitura por qualquer humano". */

export type CienciaLike = {
  leram_ids?: string[] | null;
  leram_rotulos?: string[] | null;
  qtd_leituras?: number | null;
};

/** Este usuário já deu ciência nesta intimação? */
export function lidaPorMim(i: CienciaLike, meuId: string | null | undefined): boolean {
  return Boolean(meuId && (i.leram_ids ?? []).includes(meuId));
}

/** Selo de leitura relativo ao usuário: "por você" / "por {nomes}" (transparência) / "não revisada". */
export function seloCiencia(i: CienciaLike, meuId: string | null | undefined): { lida: boolean; rotulo: string } {
  if (lidaPorMim(i, meuId)) return { lida: true, rotulo: "revisada por você" };
  const rotulos = (i.leram_rotulos ?? []).filter(Boolean);
  const n = Number(i.qtd_leituras ?? 0);
  if (n > 0) return { lida: false, rotulo: `revisada por ${rotulos.length ? rotulos.join(", ") : `${n} pessoa${n === 1 ? "" : "s"}`}` };
  return { lida: false, rotulo: "não revisada" };
}

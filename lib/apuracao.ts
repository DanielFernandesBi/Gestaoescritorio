/**
 * Apuração da T4 (migrações 91 a 96) — doutrina de apresentação.
 *
 * A dor que isto resolve não é falta de peça nem prazo perdido. É a VOLTA: chegam
 * 10 a 12 movimentações por dia dizendo que ALGO aconteceu, e Daniel precisa abrir
 * o processo, logar em sistema diferente, pesquisar e voltar ao chat para contar o
 * que era. O objetivo é ele saber do que se trata SEM abrir o processo.
 *
 * Duas regras inegociáveis moram aqui, porque valem em toda tela que exiba apuração.
 *
 * 1. A apuração é ADIÇÃO, nunca substituição. `descricao`/`tipo`/`origem` e o código
 *    do push permanecem intactos e continuam acessíveis ("ver original"). A apuração
 *    é camada por cima, com a origem sempre visível — jamais se apresenta a apuração
 *    como se fosse o que o tribunal escreveu.
 * 2. `apurado_por='mapa'` NÃO é `apurado_por='t4'`. A T4 esteve nos autos e viu; o
 *    mapa apenas reconheceu um padrão, sem que ninguém abrisse o processo. É
 *    provavelmente certo, mas é inferência, e apresentar inferência com a mesma
 *    autoridade da verificação quebra a confiança que a tela existe para dar.
 *
 * Módulo puro (sem dependência de servidor) — importável por cliente e por servidor.
 */

/** Quatro estados de `vw_feed_andamentos.status_apuracao`. */
export type StatusApuracao = "apurado" | "em_diligencia" | "a_conferir" | "claro";

/** Quem apurou. Tudo que não é `mapa` significa que alguém teve o ato à vista. */
export type ApuradoPor = "t4" | "chat" | "t2" | "humano" | "mapa";

/** Alguém esteve nos autos, ou foi só reconhecimento de padrão? */
export function verificadoNosAutos(por: string | null | undefined): boolean {
  return Boolean(por) && por !== "mapa";
}

export type SeloApuracao = {
  /** Sufixo da classe CSS (`.apur-selo.<classe>`). */
  classe: "autos" | "mapa";
  rotulo: string;
  /** Explicação longa (title) — por que este selo vale mais, ou menos, que o outro. */
  titulo: string;
};

const DDMM = (iso: string | null | undefined): string =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";

const FONTE: Record<string, string> = {
  t4: "diligência assistida",
  chat: "chat",
  t2: "redação autônoma",
  humano: "registro humano",
};

/**
 * Selo de origem da apuração. Forte para quem teve o documento à vista, discreto
 * para o mapa — a diferença tem de ser visível sem esforço.
 */
export function seloApuracao(
  apuradoPor: string | null | undefined,
  apuradoEm: string | null | undefined,
): SeloApuracao | null {
  if (!apuradoPor) return null;
  const quando = DDMM(apuradoEm);
  if (apuradoPor === "mapa") {
    return {
      classe: "mapa",
      rotulo: quando ? `padrão reconhecido · ${quando}` : "padrão reconhecido",
      titulo:
        "Ninguém abriu o processo. Um movimento de mesma assinatura já foi apurado nos autos antes, e o mapa aplicou a classificação. Só vale para rotina confirmada (3+ confirmações, zero divergência, sem providência) e nunca para processo em segredo de justiça.",
    };
  }
  return {
    classe: "autos",
    rotulo: quando ? `verificado nos autos · ${quando}` : "verificado nos autos",
    titulo: `Alguém teve o ato à vista (${FONTE[apuradoPor] ?? apuradoPor}) e escreveu o que ele é. O texto original do tribunal permanece intacto em "ver original".`,
  };
}

export type EstadoApuracao = {
  rotulo: string;
  /** Sufixo da classe CSS (`.apur-st.<tom>`). */
  tom: "ok" | "fila" | "aberto" | "neutro";
  /** Uma linha explicando o estado ao usuário. */
  ajuda: string;
  /** Cobra ação de Daniel? `em_diligencia` NÃO cobra — já está sendo cuidado. */
  cobraAcao: boolean;
};

export const ESTADO_APURACAO: Record<StatusApuracao, EstadoApuracao> = {
  apurado: {
    rotulo: "apurado",
    tom: "ok",
    ajuda: "Já se sabe do que se trata — a resposta está no card, com a origem.",
    cobraAcao: false,
  },
  em_diligencia: {
    rotulo: "na fila da diligência",
    tom: "fila",
    ajuda: "Enfileirado para a próxima sessão da T4. Não é pendência sua.",
    cobraAcao: false,
  },
  a_conferir: {
    rotulo: "opaco",
    tom: "aberto",
    ajuda: "O push disse que algo aconteceu e não disse o quê. Ainda não foi à fila.",
    cobraAcao: true,
  },
  claro: {
    rotulo: "classificado",
    tom: "neutro",
    ajuda: "A triagem já tipou o ato — não precisa de diligência.",
    cobraAcao: false,
  },
};

/** Guard: string veio do banco e é um dos quatro estados? */
export function ehStatusApuracao(x: string | null | undefined): x is StatusApuracao {
  return x === "apurado" || x === "em_diligencia" || x === "a_conferir" || x === "claro";
}

/** Rótulo curto do sistema de tramitação (`f_sistema_processo`) para chip/agrupamento. */
export const SISTEMA_ROTULO: Record<string, string> = {
  seeu: "SEEU",
  pje: "PJe",
  dcp: "DCP · TJRJ",
  eproc: "eproc",
  esaj: "e-SAJ",
  projudi: "Projudi",
  stj: "STJ",
  stf: "STF",
  residuo: "sem sistema",
};

export function rotuloSistema(s: string | null | undefined): string {
  if (!s) return "sem sistema";
  return SISTEMA_ROTULO[s] ?? s.toUpperCase();
}

/** Rótulo das três entradas da `vw_diligencia_fila`. */
export const FILA_ROTULO: Record<string, { rotulo: string; ajuda: string }> = {
  andamento_opaco: {
    rotulo: "movimento opaco",
    ajuda: "Movimento sem intimação na data, agrupado por processo — uma visita responde todos.",
  },
  teor_ausente: {
    rotulo: "teor ausente",
    ajuda: "Intimação com prazo ou peça abertos cujo ato não veio íntegro na publicação.",
  },
  expectativa: {
    rotulo: "resposta que não veio",
    ajuda: "Ato nosso sem desfecho na janela esperada — possível intimação não capturada.",
  },
};

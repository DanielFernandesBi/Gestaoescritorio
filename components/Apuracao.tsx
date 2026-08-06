import {
  ESTADO_APURACAO,
  ehStatusApuracao,
  seloApuracao,
  type StatusApuracao,
} from "@/lib/apuracao";
import { humano } from "@/lib/format";
import type { ApuracaoAndamento } from "@/lib/data";

/**
 * Camada da apuração da T4 sobre o andamento. Server-friendly (sem estado) —
 * "ver original" é `<details>` nativo, o que mantém o texto bruto do tribunal
 * acessível sem custo de client component.
 *
 * O que este componente NÃO faz, de propósito: não infere providência (usa o
 * campo `exige_providencia` como está, e cala quando é nulo), não esconde nem
 * reescreve `descricao_bruta`/`tipo_bruto`, e não apresenta o que o mapa
 * reconheceu com a mesma autoridade do que a T4 viu nos autos.
 */

/** Chip do estado (`status_apuracao`) — o eixo da tela. */
export function EstadoApuracao({ status }: { status?: string | null }) {
  if (!ehStatusApuracao(status)) return null;
  const e = ESTADO_APURACAO[status as StatusApuracao];
  return (
    <span className={`apur-st ${e.tom}`} title={e.ajuda}>
      {e.rotulo}
    </span>
  );
}

/** Selo de origem — forte para quem esteve nos autos, discreto para o mapa. */
export function SeloOrigem({ por, em }: { por?: string | null; em?: string | null }) {
  const s = seloApuracao(por, em);
  if (!s) return null;
  return (
    <span className={`apur-selo ${s.classe}`} title={s.titulo}>
      {s.rotulo}
    </span>
  );
}

/** Campos objetivos que acompanham a apuração — todos vindos do banco. */
export function ApuracaoCampos({
  a,
  segredo,
}: {
  a: ApuracaoAndamento;
  segredo?: boolean;
}) {
  const temAlgo = a.exige_providencia != null || a.prazo_identificado || segredo;
  if (!temAlgo) return null;
  return (
    <div className="apur-meta">
      {a.exige_providencia === true && (
        <span className="apur-tag prov" title="Campo exige_providencia do banco — não é inferência da tela.">
          exige providência
        </span>
      )}
      {a.exige_providencia === false && (
        <span className="apur-tag prov-nao" title="Campo exige_providencia do banco — ato de rotina, nada a fazer.">
          sem providência
        </span>
      )}
      {a.prazo_identificado && (
        <span className="apur-tag prazo" title="Prazo identificado na apuração. Continua a valer o gate: prazo só nasce definitivo com validação de Daniel.">
          ⏱ {a.prazo_identificado}
        </span>
      )}
      {segredo && (
        <span className="apur-tag sigilo" title="Segredo de justiça — a apuração descreve o ato objetivamente; o conteúdo não vai para exportação nem tela compartilhável.">
          🔒 sigiloso
        </span>
      )}
    </div>
  );
}

/**
 * Bloco "do que se trata". Renderiza a resposta quando ela existe; quando não,
 * assume a pergunta em aberto, em vez de fingir que o metadado a responde.
 *
 * `bruto` é o par (tipo, descrição) do push. Fica sempre disponível — é o que o
 * tribunal escreveu, e a apuração jamais o substitui.
 */
export function ApuracaoBloco({
  a,
  bruto,
  segredo,
  compacto = false,
}: {
  a?: ApuracaoAndamento | null;
  bruto: { tipo: string; descricao: string };
  segredo?: boolean;
  /** No card da lista o texto bruto vem recolhido; no detalhe, aberto. */
  compacto?: boolean;
}) {
  // Sem cobertura da view (órfão, processo arquivado) — nada a acrescentar.
  if (!a) return null;

  if (!a.texto) {
    // Ainda sem resposta. `em_diligencia` é informativo e não cobra ação de Daniel;
    // `a_conferir` é a pergunta que o sistema ainda deve responder.
    if (a.status === "em_diligencia") {
      return (
        <div className="apur-vazio fila">
          <b>Na fila da diligência.</b> O processo já está enfileirado para a próxima sessão da T4 —
          não é pendência sua.
        </div>
      );
    }
    if (a.status === "a_conferir") {
      return (
        <div className="apur-vazio">
          <b>Ainda não sabemos do que se trata.</b> O push avisou que algo aconteceu e não disse o quê.
          Entra na fila da diligência para ser apurado nos autos.
        </div>
      );
    }
    return null;
  }

  return (
    <div className={`apur${a.apurado_por === "mapa" ? " de-mapa" : ""}`}>
      <div className="apur-h">
        <span className="apur-k">do que se trata</span>
        <SeloOrigem por={a.apurado_por} em={a.apurado_em} />
      </div>
      <div className="apur-txt">{a.texto}</div>
      <ApuracaoCampos a={a} segredo={segredo} />
      <details className="apur-orig" open={!compacto}>
        <summary>ver original do tribunal</summary>
        <div className="apur-orig-b">
          <span className="apur-orig-k">
            {humano(bruto.tipo)}
            {a.tipo_apurado && a.tipo_apurado !== bruto.tipo ? ` · reclassificado como ${humano(a.tipo_apurado)}` : ""}
          </span>
          {bruto.descricao || "sem descrição"}
        </div>
      </details>
    </div>
  );
}

import {
  ESTADO_APURACAO,
  FILA_ROTULO,
  ehStatusApuracao,
  rotuloSistema,
  seloApuracao,
  separarLeituraIa,
  type StatusApuracao,
} from "@/lib/apuracao";
import { fmtDate, humano } from "@/lib/format";
import type { ApuracaoAndamento, ConsultaTribunal } from "@/lib/data";

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

/**
 * Glifo da IA — o mesmo losango de quatro pontas que o sistema já usa em todos
 * os painéis para dizer "isto veio da automação", na cor cobalt (`--accent`),
 * que o design system declara como a cor da IA.
 */
export const Spark = ({ s = 12 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)", flex: "none" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);

/**
 * Texto capturado da fonte, com a LEITURA DA IA destacada.
 *
 * O texto do push traz, no mesmo parágrafo, o que foi extraído e a continuação
 * em que a IA diz o que entendeu — o ato gêmeo que cruzou, o teor que não veio,
 * o prazo que entende correr. Acrescentar isso é certo; o que faltava era o
 * leitor saber de quem é cada parte. A continuação passa a sair na cor da IA e
 * com o glifo da IA, sem quebrar a leitura corrida.
 *
 * Quando não há corte seguro, o texto sai exatamente como sempre saiu.
 */
export function TextoCapturado({ texto, aspas = false }: { texto: string; aspas?: boolean }) {
  const { transcrito, leitura } = separarLeituraIa(texto);
  const corpo = aspas ? `“${transcrito}”` : transcrito;
  if (!leitura) return <>{corpo}</>;
  return (
    <>
      {corpo}{" "}
      <span
        className="ia-leitura"
        title="Leitura da IA — o que a automação entendeu ao capturar o ato. O texto da fonte é o que está acima; isto foi acrescentado pela triagem, e não pelo tribunal."
      >
        <Spark s={11} />
        {leitura}
      </span>
    </>
  );
}

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
  semOriginal = false,
}: {
  a?: ApuracaoAndamento | null;
  bruto: { tipo: string; descricao: string };
  segredo?: boolean;
  /** No card da lista o texto bruto vem recolhido; no detalhe, aberto. */
  compacto?: boolean;
  /** No detalhe o teor bruto já tem seção própria — não se repete aqui. */
  semOriginal?: boolean;
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
      {semOriginal && a.tipo_apurado && a.tipo_apurado !== bruto.tipo && (
        <div className="apur-orig-b" style={{ marginTop: 9 }}>
          <span className="apur-orig-k">reclassificação</span>
          O tribunal registrou como <b>{humano(bruto.tipo)}</b>; a apuração diz que é{" "}
          <b>{humano(a.tipo_apurado)}</b>. O tipo original permanece gravado.
        </div>
      )}
      {!semOriginal && (
      <details className="apur-orig" open={!compacto}>
        <summary>ver original do tribunal</summary>
        <div className="apur-orig-b">
          <span className="apur-orig-k">
            {humano(bruto.tipo)}
            {a.tipo_apurado && a.tipo_apurado !== bruto.tipo ? ` · reclassificado como ${humano(a.tipo_apurado)}` : ""}
          </span>
          {bruto.descricao ? <TextoCapturado texto={bruto.descricao} /> : "sem descrição"}
        </div>
      </details>
      )}
    </div>
  );
}

/**
 * Trilha da visita — a linha de `consultas_tribunal` que produziu a apuração.
 * A mesma tabela é a fila e o livro, então aqui se lê a pergunta que foi levada
 * aos autos, quando entrou na fila, quando foi respondida e o que se respondeu.
 * A diferença entre as duas datas é a métrica de espera da diligência.
 */
export function TrilhaConsulta({ c }: { c: ConsultaTribunal }) {
  const fila = c.fila ? FILA_ROTULO[c.fila] : null;
  return (
    <div className="trilha">
      <div className="trilha-top">
        <span className="apur-tag">{fila?.rotulo ?? c.fila ?? "diligência"}</span>
        <span className="apur-tag">{rotuloSistema(c.sistema)}</span>
        {c.dias_espera != null && (
          <span className="trilha-espera" title="Dias entre entrar na fila e ser respondida.">
            {c.dias_espera === 0 ? "respondida no mesmo dia" : `${c.dias_espera} dia${c.dias_espera === 1 ? "" : "s"} na fila`}
          </span>
        )}
      </div>
      {c.pergunta && (
        <div className="trilha-linha">
          <span className="trilha-k">pergunta levada aos autos</span>
          <p>{c.pergunta}</p>
        </div>
      )}
      {c.observacao && (
        <div className="trilha-linha">
          <span className="trilha-k">o que se respondeu</span>
          <p>{c.observacao}</p>
        </div>
      )}
      <div className="trilha-datas mono">
        enfileirada {c.enfileirado_em ? fmtDate(c.enfileirado_em) : "—"} · consultada{" "}
        {c.consultado_em ? fmtDate(c.consultado_em) : "ainda pendente"}
        {c.cadastrado_por ? ` · ${c.cadastrado_por}` : ""}
      </div>
    </div>
  );
}

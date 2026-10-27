"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { Acao } from "@/components/Acao";
import { Expansivel } from "@/components/Expansivel";
import { fmtDate, humano } from "@/lib/format";
import { decidirAprovacoes, type DecisaoAprovacaoItem } from "@/app/actions";
import type { AprovacaoItem, AprovacaoResumo, VarreduraCatalogo } from "@/lib/data";

/**
 * Central de aprovações (Sug. 156) — o gate humano do catálogo.
 *
 * Nada aqui escreve no banco: toda decisão vai pela server action
 * `decidirAprovacoes`, que só chama `fn_decidir_aprovacao`.
 *
 * Os rótulos abaixo são um MAPA, não um `switch` fechado: origem ou classe que
 * o banco passe a emitir ('radar', 'legislacao', uma classe nova) aparece com o
 * nome humanizado e o renderizador genérico, sem exigir mudança de código — é o
 * que a especificação pede ao dizer que novas origens devem entrar sozinhas.
 */

const ROTULO_ORIGEM: Record<string, string> = {
  catalogo: "Catálogo de jurisprudência",
  radar: "Radar de jurisprudência",
  legislacao: "Legislação",
};
const rotuloOrigem = (o: string) => ROTULO_ORIGEM[o] ?? humano(o);

const ROTULO_CLASSE: Record<string, string> = {
  // catálogo
  novo: "Novo verbete",
  situacao_alterada: "Situação alterada",
  redacao_alterada: "Redação alterada",
  metadado_alterado: "Metadado alterado",
  // legislação (Adendo 1)
  lote: "Lote da norma",
  pendencia: "Pendência de redação",
};
const rotuloClasse = (c: string) => ROTULO_CLASSE[c] ?? humano(c);

/**
 * Trava de aprovação. Rejeitar nunca é barrado — é a saída para o item que não
 * serve. São duas razões, uma por fila, e as duas têm regra equivalente no
 * banco: a função recusa igual, esta é a que explica ANTES do clique.
 */
function travaAprovacao(it: AprovacaoItem): string | null {
  // Catálogo: a conferência do literal REPROVOU (NULL é "não conferido ainda",
  // e isso não barra).
  if (it.literal_confere === false) {
    return "O texto literal não confere com a fonte — a conferência reprovou, então não há o que aprovar.";
  }
  // Legislação: redação sem data de vigência. A função levanta
  // "redação sem data de vigência não pode ser aprovada; aguarde a data do DOU".
  if (it.classe === "pendencia" && !metaTexto(it.metadados_propostos, "vigencia_inicio_proposta")) {
    return "Sem data de vigência — aguardando a data do DOU.";
  }
  return null;
}

/** Valor de texto de uma chave do jsonb, ou null se ausente/vazia. */
function metaTexto(dados: Record<string, unknown> | null, chave: string): string | null {
  const v = dados?.[chave];
  return typeof v === "string" && v.trim() ? v : null;
}

const TOM_PRIORIDADE: Record<string, "red" | "amber" | "gray"> = {
  alta: "red",
  media: "amber",
  baixa: "gray",
};

/* ── diferença palavra a palavra (redacao_alterada) ───────────────────────── */

type Parte = { texto: string; mudou: boolean };

/** Acima disto a tabela da LCS não se paga; o texto vai inteiro, sem realce. */
const MAX_PALAVRAS_DIFF = 800;

/**
 * Realce por palavra entre o texto atual e o proposto, por subsequência comum
 * máxima. Sem dependência nova: são verbetes de súmula e tese, da ordem de
 * dezenas a poucas centenas de palavras.
 */
function diffPalavras(atual: string, proposto: string): { a: Parte[]; b: Parte[]; realcou: boolean } {
  const pa = atual.split(/\s+/).filter(Boolean);
  const pb = proposto.split(/\s+/).filter(Boolean);
  if (pa.length > MAX_PALAVRAS_DIFF || pb.length > MAX_PALAVRAS_DIFF) {
    return { a: [{ texto: atual, mudou: false }], b: [{ texto: proposto, mudou: false }], realcou: false };
  }
  const n = pa.length;
  const m = pb.length;
  // dp[(i*(m+1))+j] = tamanho da LCS de pa[i..] com pb[j..]
  const dp = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * (m + 1) + j] =
        pa[i] === pb[j]
          ? dp[(i + 1) * (m + 1) + (j + 1)] + 1
          : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + (j + 1)]);
    }
  }
  const a: Parte[] = [];
  const b: Parte[] = [];
  const empurra = (arr: Parte[], palavra: string, mudou: boolean) => {
    const ult = arr[arr.length - 1];
    if (ult && ult.mudou === mudou) ult.texto += ` ${palavra}`;
    else arr.push({ texto: palavra, mudou });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (pa[i] === pb[j]) {
      empurra(a, pa[i], false);
      empurra(b, pb[j], false);
      i++;
      j++;
    } else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + (j + 1)]) {
      empurra(a, pa[i], true); // saiu
      i++;
    } else {
      empurra(b, pb[j], true); // entrou
      j++;
    }
  }
  while (i < n) empurra(a, pa[i++], true);
  while (j < m) empurra(b, pb[j++], true);
  return { a, b, realcou: true };
}

function TextoRealcado({ partes, tom }: { partes: Parte[]; tom: "saiu" | "entrou" }) {
  return (
    <p className="apv-texto">
      {partes.map((p, k) =>
        p.mudou ? (
          <mark key={k} className={`apv-dif ${tom}`}>
            {p.texto}
          </mark>
        ) : (
          <span key={k}>{p.texto}</span>
        ),
      )}{" "}
    </p>
  );
}

/* ── peças do cartão ─────────────────────────────────────────────────────── */

function Identidade({ it }: { it: AprovacaoItem }) {
  // Na pendência o `identificador_extra` é o rótulo do dispositivo e já aparece
  // em destaque no corpo — repetir aqui só polui a linha.
  const extra = it.classe === "pendencia" ? null : it.identificador_extra;
  const num = [it.numero, extra].filter(Boolean).join(" · ");
  const linha = [it.tribunal, it.tipo ? humano(it.tipo) : null, num, it.orgao].filter(Boolean).join(" · ");
  return linha ? <div className="apv-ident mono">{linha}</div> : null;
}

function Procedencia({ it }: { it: AprovacaoItem }) {
  const confereTom = it.literal_confere === true ? "ok" : it.literal_confere === false ? "no" : "na";
  const pdfTom = it.conferencia_pdf === true ? "ok" : it.conferencia_pdf === false ? "no" : "na";
  return (
    <div className="apv-proc">
      {it.fonte_publicacao && <span className="apv-fonte">{it.fonte_publicacao}</span>}
      {it.fonte_arquivo && <span className="apv-fonte mono">{it.fonte_arquivo}</span>}
      {it.fonte_data && <span className="apv-fonte mono">{fmtDate(it.fonte_data)}</span>}
      <span className={`apv-selo ${confereTom}`} title="Conferência do texto literal contra a fonte.">
        literal{" "}
        {it.literal_confere === true ? "confere" : it.literal_confere === false ? "NÃO confere" : "não conferido"}
      </span>
      <span className={`apv-selo ${pdfTom}`} title="Conferência dupla do PDF (MuPDF).">
        PDF {it.conferencia_pdf === true ? "confere" : it.conferencia_pdf === false ? "divergente" : "não conferido"}
      </span>
    </div>
  );
}

/* ── o que mudou: metadados propostos e o diff cru ───────────────────────── */

const ROTULO_METADADO: Record<string, string> = {
  // catálogo
  data_julgamento: "julgamento",
  data_publicacao_acordao: "publicação do acórdão",
  data_cancelamento: "cancelamento",
  relator: "relator",
  // legislação. `origem` aqui é a LEI ALTERADORA ("L 8.930"), e não a origem da
  // fila (catalogo/legislacao) — o rótulo desfaz a ambiguidade na tela.
  origem: "lei de origem",
  vigencia_inicio_proposta: "vigência · início",
  vigencia_fim_proposta: "vigência · fim",
  revogado_por: "revogado por",
};

/** Chaves do `diff_detalhe` que já têm lugar próprio no cartão. */
const DIFF_JA_EXIBIDO = new Set([
  "texto_atual", // vira a coluna "texto atual"
  "situacao_atual", // vira a transição de situação
  "tese_pendente_publicacao", // vira o aviso de tese pendente
  "texto_difere", // vira o selo abaixo
  "jurisprudencia_id", // id interno do verbete; não é informação de decisão
]);

const PARECE_DATA = /^\d{4}-\d{2}-\d{2}/;
/** Valor do JSON em texto legível — data virando dd/mm/aaaa, resto como está. */
function valorLegivel(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return PARECE_DATA.test(v) ? fmtDate(v) : v;
  return JSON.stringify(v);
}

/**
 * Metadados que a proposta quer gravar. É isto que muda num
 * `metadado_alterado`, e informa também no verbete novo (relator, datas).
 * Rótulo desconhecido cai no nome humanizado — campo novo aparece sozinho.
 */
function MetadadosPropostos({ dados }: { dados: Record<string, unknown> | null }) {
  const pares = Object.entries(dados ?? {}).filter(([, v]) => v != null && v !== "");
  if (!pares.length) return null;
  return (
    <div className="apv-meta">
      <div className="apv-meta-k">Metadados propostos</div>
      <dl className="apv-meta-grid">
        {pares.map(([k, v]) => (
          <div className="apv-meta-par" key={k}>
            <dt>{ROTULO_METADADO[k] ?? humano(k)}</dt>
            <dd className={PARECE_DATA.test(String(v)) ? "mono" : undefined}>{valorLegivel(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * O resto do `diff_detalhe`: o selo de `texto_difere` — que responde se o texto
 * literal muda junto com o metadado, e é a dúvida natural de quem decide — mais
 * qualquer chave que o pipeline passe a emitir e que ainda não tenha lugar no
 * cartão. Nada do diff fica invisível.
 */
function DetalheDiff({ diff }: { diff: Record<string, unknown> | null }) {
  if (!diff) return null;
  const difere = diff.texto_difere;
  const extras = Object.entries(diff).filter(([k, v]) => !DIFF_JA_EXIBIDO.has(k) && v != null && v !== "");
  if (typeof difere !== "boolean" && !extras.length) return null;
  return (
    <div className="apv-diff">
      {typeof difere === "boolean" && (
        <span className={`apv-selo ${difere ? "no" : "ok"}`} title="O texto literal muda junto com o metadado?">
          texto literal {difere ? "também difere" : "é o mesmo"}
        </span>
      )}
      {extras.map(([k, v]) => (
        <span className="apv-diff-extra" key={k}>
          <b>{humano(k)}</b> {valorLegivel(v)}
        </span>
      ))}
    </div>
  );
}

function Transicao({ de, para }: { de: string | null; para: string | null }) {
  if (!de && !para) return null;
  return (
    <div className="apv-transicao">
      <span className="k">situação</span>
      <span className="de">{de ? humano(de) : "—"}</span>
      <span className="seta" aria-hidden>
        →
      </span>
      <span className="para">{para ? humano(para) : "—"}</span>
    </div>
  );
}

/* ── legislação (Adendo 1) ───────────────────────────────────────────────── */

/**
 * O `texto_proposto` do LOTE é uma lista: uma linha por lei alteradora, no
 * formato `sigla — DOU <data> — vigência proposta <data> — cláusula`. Vira
 * tabela, que é o que torna a lista legível: dá para varrer as datas na
 * vertical e achar a que falta.
 *
 * A cláusula fica com o RESTO da linha, não com o quarto pedaço: separador
 * dentro do texto da cláusula não deve comer conteúdo.
 */
function LinhasDoLote({ texto }: { texto: string }) {
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const p = l.split(" — ");
      return p.length >= 4
        ? { sigla: p[0], dou: p[1], vigencia: p[2], clausula: p.slice(3).join(" — ") }
        : { sigla: l, dou: "", vigencia: "", clausula: "" };
    });
  if (!linhas.length) return null;
  // "?" é como o pipeline marca o que não localizou — é justamente o que Daniel
  // precisa ver, então vira destaque e não texto comum.
  const faltando = (s: string) => s.includes("?");
  // O rótulo repetido em toda linha ("DOU ", "vigência proposta ") vira
  // cabeçalho de coluna. Se o prefixo não vier como esperado, o valor fica
  // inteiro — melhor redundante que truncado.
  const semPrefixo = (v: string, prefixo: string) =>
    v.startsWith(prefixo) ? v.slice(prefixo.length).trim() : v;
  return (
    <div className="apv-lote-tabela">
      <div className="apv-lote-linha cab">
        <span className="sigla">norma</span>
        <span className="dou">DOU</span>
        <span className="vig">vigência proposta</span>
        <span className="clau">cláusula de vigência</span>
      </div>
      {linhas.map((l, k) => (
        <div className="apv-lote-linha" key={k}>
          <span className="sigla mono">{l.sigla}</span>
          <span className={`dou mono${faltando(l.dou) ? " falta" : ""}`}>{semPrefixo(l.dou, "DOU") || "—"}</span>
          <span className={`vig mono${faltando(l.vigencia) ? " falta" : ""}`}>
            {semPrefixo(l.vigencia, "vigência proposta") || "—"}
          </span>
          <span className="clau">{l.clausula}</span>
        </div>
      ))}
    </div>
  );
}

/** Corpo do cartão conforme a classe. Classe desconhecida cai no genérico. */
function Corpo({ it }: { it: AprovacaoItem }) {
  const proposto = it.texto_proposto?.trim() ?? "";
  const atual = it.texto_atual?.trim() ?? "";

  // A LCS é quadrática, e a lista re-renderiza a cada clique numa caixa de
  // seleção: sem memo, todo cartão de redação alterada recalcularia o diff a
  // cada toque. A chave é o par de textos, que é o que o cálculo consome.
  const diff = useMemo(
    () => (atual && proposto ? diffPalavras(atual, proposto) : null),
    [atual, proposto],
  );

  if (it.classe === "redacao_alterada" && diff) {
    const d = diff;
    return (
      <>
        <div className="apv-lado-a-lado">
          <div className="apv-col">
            <div className="apv-col-h">texto atual</div>
            <TextoRealcado partes={d.a} tom="saiu" />
          </div>
          <div className="apv-col">
            <div className="apv-col-h">texto proposto</div>
            <TextoRealcado partes={d.b} tom="entrou" />
          </div>
        </div>
        {!d.realcou && (
          <p className="apv-nota">
            Textos longos demais para o realce palavra a palavra — mostrados inteiros, sem marcação.
          </p>
        )}
        {/* Sem `DetalheDiff` aqui: o lado a lado já responde o que mudou no
            texto, e o selo de `texto_difere` seria redundante nesta classe. */}
        <MetadadosPropostos dados={it.metadados_propostos} />
      </>
    );
  }

  if (it.classe === "situacao_alterada") {
    return (
      <>
        <Transicao de={it.situacao_atual} para={it.situacao_nova} />
        {/* `data_cancelamento` e o selo de `texto_difere` pesam justamente aqui:
            uma súmula cancelada muda de situação e às vezes só isso. */}
        <MetadadosPropostos dados={it.metadados_propostos} />
        <DetalheDiff diff={it.diff_detalhe} />
        {proposto && <p className="apv-texto">{proposto}</p>}
      </>
    );
  }

  if (it.classe === "metadado_alterado") {
    return (
      <>
        <Transicao de={it.situacao_atual} para={it.situacao_nova} />
        {it.tese_pendente && (
          <p className="apv-aviso">
            <Icon name="clock" size={14} /> Tese aguardando publicação do acórdão: o texto do catálogo será
            mantido.
          </p>
        )}
        {/* O "o que mudou" vem das colunas `metadados_propostos` e
            `diff_detalhe`, acrescentadas à view em 27/10/2026. Antes daí havia
            aqui uma linha remetendo às observações, que era um contorno. */}
        <MetadadosPropostos dados={it.metadados_propostos} />
        <DetalheDiff diff={it.diff_detalhe} />
        {proposto && <p className="apv-texto">{proposto}</p>}
      </>
    );
  }

  // Legislação · lote: um cartão por lei. O título já resume as contagens; aqui
  // vem a lista das leis alteradoras com DOU, vigência proposta e cláusula.
  if (it.classe === "lote") {
    return proposto ? <LinhasDoLote texto={proposto} /> : <p className="apv-nota">Lote sem leis listadas.</p>;
  }

  // Legislação · pendência: um cartão por redação. O rótulo do dispositivo sai
  // da linha de identidade e vira destaque — é por ele que se reconhece o item.
  if (it.classe === "pendencia") {
    return (
      <>
        {it.identificador_extra && <div className="apv-dispositivo">{it.identificador_extra}</div>}
        <MetadadosPropostos dados={it.metadados_propostos} />
        {proposto ? <p className="apv-texto">{proposto}</p> : <p className="apv-nota">Sem redação proposta.</p>}
      </>
    );
  }

  // `novo` e qualquer classe nova: identidade (acima), metadados propostos —
  // relator e datas informam também no verbete novo — e o texto na íntegra.
  return (
    <>
      <MetadadosPropostos dados={it.metadados_propostos} />
      {proposto ? <p className="apv-texto">{proposto}</p> : <p className="apv-nota">Sem texto proposto.</p>}
    </>
  );
}

/* ── cartão ──────────────────────────────────────────────────────────────── */

function Cartao({
  it,
  marcado,
  onMarcar,
  resultado,
  registrar,
  anotarResumos,
}: {
  it: AprovacaoItem;
  marcado: boolean;
  onMarcar: (id: string, v: boolean) => void;
  resultado?: DecisaoAprovacaoItem;
  registrar: (itens: DecisaoAprovacaoItem[]) => void;
  anotarResumos: (resumos: string[]) => void;
}) {
  const razao = travaAprovacao(it);
  const barrado = razao != null;

  const decidir = async (decisao: "aprovar" | "rejeitar", texto: string) => {
    const r = await decidirAprovacoes([it.id], decisao, texto);
    if (r.itens?.length) registrar(r.itens);
    if (r.resumosLegislacao?.length) anotarResumos(r.resumosLegislacao);
    return { ok: r.ok, message: r.message };
  };

  return (
    <article className={`apv-card${barrado ? " barrado" : ""}${resultado?.resultado === "falhou" ? " falhou" : ""}`}>
      <div className="apv-card-h">
        <label className="apv-check" title={razao ?? "Selecionar para o lote"}>
          <input
            type="checkbox"
            checked={marcado}
            disabled={barrado}
            onChange={(e) => onMarcar(it.id, e.target.checked)}
          />
        </label>
        <Pill tone={TOM_PRIORIDADE[it.prioridade] ?? "gray"} dot={false}>
          {it.prioridade}
        </Pill>
        <div className="apv-titulo">{it.titulo || rotuloClasse(it.classe)}</div>
        {it.criado_em && <span className="apv-data mono">{fmtDate(it.criado_em)}</span>}
      </div>

      <Identidade it={it} />
      <Corpo it={it} />
      <Procedencia it={it} />

      {it.observacoes?.trim() && (
        <div className="apv-obs-bloco">
          <div className="apv-obs-k">Observações</div>
          {/* `Expansivel` é o recolhível da casa: mede o conteúdo e só mostra o
              botão quando transborda, então observação curta aparece inteira.
              No metadado alterado a altura é maior, porque é ali que o pipeline
              registra o que mudou. */}
          <Expansivel altura={it.classe === "metadado_alterado" ? 220 : 92} mais="ver tudo">
            <p className="apv-obs">{it.observacoes}</p>
          </Expansivel>
        </div>
      )}

      {resultado && (
        <div className={`apv-res ${resultado.resultado === "falhou" ? "err" : "ok"}`}>
          <b>{resultado.resultado}</b>
          {resultado.erro ? ` — ${resultado.erro}` : ""}
        </div>
      )}

      <div className="apv-acoes">
        {barrado ? (
          <>
            <button className="btn sm" type="button" disabled title={razao ?? undefined}>
              Aprovar
            </button>
            <span className="apv-barrado-razao">{razao}</span>
          </>
        ) : (
          <Acao
            label="Aprovar"
            titulo="Aprovar e promover ao catálogo"
            variant="primary"
            resumo={
              <>
                Promover <b>{it.titulo || rotuloClasse(it.classe)}</b> ao catálogo oficial. A promoção é feita
                pela <span className="mono">fn_decidir_aprovacao</span>, com carimbo de autor e data.
              </>
            }
            confirmarLabel="Aprovar"
            campoTexto={{ label: "Motivo (opcional)", placeholder: "Por que aprova — opcional", multiline: true }}
            acao={(texto) => decidir("aprovar", texto)}
          />
        )}
        <Acao
          label="Rejeitar"
          titulo="Rejeitar a proposta"
          variant="danger"
          resumo={
            <>
              Recusar <b>{it.titulo || rotuloClasse(it.classe)}</b>. O item sai da fila e o motivo fica gravado
              na observação — nada é apagado.
            </>
          }
          confirmarLabel="Rejeitar"
          campoTexto={{
            label: "Motivo (obrigatório)",
            placeholder: "Por que esta proposta não entra no catálogo",
            obrigatorio: true,
            multiline: true,
          }}
          acao={(texto) => decidir("rejeitar", texto)}
        />
      </div>
    </article>
  );
}

/* ── painel da última T5 ─────────────────────────────────────────────────── */

function ListaDiag({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (!itens.length) return null;
  return (
    <div className="apv-t5-bloco">
      <div className="k">
        {titulo} <span className="n">{itens.length}</span>
      </div>
      <ul>
        {itens.map((t, k) => (
          <li key={k}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function PainelT5({ v }: { v: VarreduraCatalogo | null }) {
  if (!v) {
    return (
      <div className="apv-t5">
        <div className="apv-t5-h">
          <span className="t">
            <Icon name="shield" size={15} /> Última varredura do catálogo (T5)
          </span>
          <code>varreduras · fonte=catalogo</code>
        </div>
        <div className="empty">
          A T5 ainda não registrou nenhum ciclo com <span className="mono">fonte=catalogo</span>.
        </div>
      </div>
    );
  }
  const vazio =
    !v.pendencias_impressao.length && !v.propagacao.length && !v.lacunas.length && !v.anomalias.length;
  return (
    <div className="apv-t5">
      <div className="apv-t5-h">
        <span className="t">
          <Icon name="shield" size={15} /> Última varredura do catálogo (T5)
        </span>
        <span className="apv-t5-meta mono">
          {fmtDate(v.criado_em)}
          {v.data_referencia ? ` · ciclo ${fmtDate(v.data_referencia)}` : ""}
        </span>
        {v.status && <Pill tone={v.status === "ok" ? "green" : "amber"}>{humano(v.status)}</Pill>}
        <code>varreduras · fonte=catalogo</code>
      </div>
      <div className="apv-t5-grid">
        <ListaDiag titulo="Pendências de impressão" itens={v.pendencias_impressao} />
        <ListaDiag titulo="Propagação" itens={v.propagacao} />
        <ListaDiag titulo="Lacunas" itens={v.lacunas} />
        {v.anomalias.length > 0 && (
          <div className="apv-t5-bloco">
            <div className="k">
              Anomalias <span className="n">{v.anomalias.length}</span>
            </div>
            <ul>
              {v.anomalias.map((a, k) => (
                <li key={k}>
                  <b>{a.tipo ? humano(a.tipo) : "anomalia"}</b>
                  {a.detalhe ? ` — ${a.detalhe}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {vazio && <div className="empty">Ciclo sem pendências, propagação, lacunas ou anomalias.</div>}
    </div>
  );
}

/* ── tela ────────────────────────────────────────────────────────────────── */

export function AprovacoesView({
  itens,
  resumo,
  varredura,
}: {
  itens: AprovacaoItem[];
  resumo: AprovacaoResumo[];
  varredura: VarreduraCatalogo | null;
}) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [resultados, setResultados] = useState<Record<string, DecisaoAprovacaoItem>>({});
  const [lote, setLote] = useState<{ pend: boolean; msg: string | null; ok: boolean }>({
    pend: false,
    msg: null,
    ok: true,
  });
  // Resumos de `promocao_legislacao` (Adendo 1, item 3) — informação, não erro.
  const [resumos, setResumos] = useState<string[]>([]);

  const registrar = (linhas: DecisaoAprovacaoItem[]) =>
    setResultados((prev) => {
      const next = { ...prev };
      for (const l of linhas) next[l.staging_id] = l;
      return next;
    });

  const onMarcar = (id: string, v: boolean) =>
    setMarcados((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });

  // Agrupa por origem e, dentro dela, por classe. Chaves vêm dos dados, então
  // origem/classe nova aparece sozinha, na ordem em que a fila a entrega.
  const grupos = useMemo(() => {
    const porOrigem = new Map<string, Map<string, AprovacaoItem[]>>();
    for (const it of itens) {
      let classes = porOrigem.get(it.origem);
      if (!classes) {
        classes = new Map();
        porOrigem.set(it.origem, classes);
      }
      const lista = classes.get(it.classe);
      if (lista) lista.push(it);
      else classes.set(it.classe, [it]);
    }
    return porOrigem;
  }, [itens]);

  const total = itens.length;
  const nAlta = itens.filter((i) => i.prioridade === "alta").length;
  const nBarrados = itens.filter((i) => travaAprovacao(i) != null).length;
  // Nunca manda ao banco um id barrado, mesmo que a seleção tenha sobrevivido a
  // uma recarga: a trava não é só visual. Vale para as duas razões (literal
  // reprovado no catálogo, redação sem vigência na legislação).
  const selecionados = itens.filter((i) => marcados.has(i.id) && travaAprovacao(i) == null).map((i) => i.id);

  const aprovarLote = async () => {
    if (!selecionados.length) return;
    setLote({ pend: true, msg: null, ok: true });
    const r = await decidirAprovacoes(selecionados, "aprovar", "");
    if (r.itens?.length) registrar(r.itens);
    if (r.resumosLegislacao?.length) setResumos(r.resumosLegislacao);
    setLote({ pend: false, msg: r.message, ok: r.ok });
    // Mantém marcados só os que falharam — os promovidos saem da fila.
    const falhos = new Set((r.itens ?? []).filter((i) => i.resultado === "falhou").map((i) => i.staging_id));
    setMarcados(falhos);
    router.refresh();
  };

  return (
    <>
      <PageHeader
        breadcrumb={["Entrada · IA", "Aprovações"]}
        eyebrow="Gate humano do catálogo"
        titulo="Aprovações"
        descricao={
          <>
            O que a varredura do catálogo propõe e ainda depende da sua palavra. Aprovar promove ao catálogo
            oficial; rejeitar guarda o motivo. A decisão passa inteira pela{" "}
            <span className="mono">fn_decidir_aprovacao</span> — esta tela nunca escreve no catálogo.
          </>
        }
        kpis={[
          { valor: total, label: "na fila · total", tone: total ? "accent" : "green" },
          { valor: nAlta, label: "prioridade alta", tone: nAlta ? "red" : "neutral" },
          { valor: nBarrados, label: "barrados · literal não confere", tone: nBarrados ? "amber" : "neutral" },
          { valor: resumo.length, label: "origens na fila", tone: "neutral" },
        ]}
      />

      <PainelT5 v={varredura} />

      {/* Adendo 1, item 3 — a função devolve uma linha por fonte promovida com o
          resumo no campo `erro`, que ali é INFORMAÇÃO. Fica como aviso verde e
          separado dos cartões: o `staging_id` desse resumo é o id da FONTE, que
          no lote coincide com o id do cartão, e misturá-los apagaria o
          "lote aprovado" daquele cartão. */}
      {resumos.length > 0 && (
        <div className="apv-promocao">
          <div className="apv-promocao-h">
            <Icon name="check" size={15} /> Promoção da legislação
          </div>
          <ul>
            {resumos.map((t, k) => (
              <li key={k}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {total === 0 ? (
        <div className="card">
          <div className="empty">Nada a aprovar.</div>
        </div>
      ) : (
        <>
          <div className="apv-lote">
            <span className="apv-lote-n">
              {selecionados.length} selecionado{selecionados.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="btn primary sm"
              disabled={!selecionados.length || lote.pend}
              onClick={aprovarLote}
            >
              {lote.pend ? "Aprovando…" : `Aprovar selecionados${selecionados.length ? ` (${selecionados.length})` : ""}`}
            </button>
            <span className="apv-lote-hint">
              O lote aprova sem motivo. Rejeitar é item a item, porque exige motivo.
            </span>
            {lote.msg && <span className={`apv-lote-msg ${lote.ok ? "ok" : "err"}`}>{lote.msg}</span>}
          </div>

          {[...grupos.entries()].map(([origem, classes]) => {
            const nOrigem = [...classes.values()].reduce((n, l) => n + l.length, 0);
            return (
              <section className="apv-origem" key={origem}>
                <h2 className="apv-origem-h">
                  {rotuloOrigem(origem)} <span className="n">{nOrigem}</span>
                </h2>
                {[...classes.entries()].map(([classe, lista]) => (
                  <div className="apv-classe" key={classe}>
                    <h3 className="apv-classe-h">
                      {rotuloClasse(classe)} <span className="n">{lista.length}</span>
                    </h3>
                    <div className="apv-list">
                      {lista.map((it) => (
                        <Cartao
                          key={it.id}
                          it={it}
                          marcado={marcados.has(it.id)}
                          onMarcar={onMarcar}
                          resultado={resultados[it.id]}
                          registrar={registrar}
                          anotarResumos={setResumos}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

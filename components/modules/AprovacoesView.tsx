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
  novo: "Novo verbete",
  situacao_alterada: "Situação alterada",
  redacao_alterada: "Redação alterada",
  metadado_alterado: "Metadado alterado",
};
const rotuloClasse = (c: string) => ROTULO_CLASSE[c] ?? humano(c);

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
  const num = [it.numero, it.identificador_extra].filter(Boolean).join(" · ");
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
      </>
    );
  }

  if (it.classe === "situacao_alterada") {
    return (
      <>
        <Transicao de={it.situacao_atual} para={it.situacao_nova} />
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
        {proposto && <p className="apv-texto">{proposto}</p>}
        <p className="apv-nota">
          O detalhe campo a campo da alteração fica em <span className="mono">diff_detalhe</span>, que a view
          não expõe — acima está o metadado proposto, e as observações registram o que mudou.
        </p>
      </>
    );
  }

  // `novo` e qualquer classe nova: identidade (acima) + o texto na íntegra.
  return proposto ? <p className="apv-texto">{proposto}</p> : <p className="apv-nota">Sem texto proposto.</p>;
}

/* ── cartão ──────────────────────────────────────────────────────────────── */

function Cartao({
  it,
  marcado,
  onMarcar,
  resultado,
  registrar,
}: {
  it: AprovacaoItem;
  marcado: boolean;
  onMarcar: (id: string, v: boolean) => void;
  resultado?: DecisaoAprovacaoItem;
  registrar: (itens: DecisaoAprovacaoItem[]) => void;
}) {
  // Só `false` barra. NULL é "ainda não conferido", e a especificação proíbe
  // aprovar o que a conferência REPROVOU — não o que ela ainda não olhou.
  const barrado = it.literal_confere === false;
  const razao = "O texto literal não confere com a fonte — a conferência reprovou, então não há o que aprovar.";

  const decidir = async (decisao: "aprovar" | "rejeitar", texto: string) => {
    const r = await decidirAprovacoes([it.id], decisao, texto);
    if (r.itens?.length) registrar(r.itens);
    return { ok: r.ok, message: r.message };
  };

  return (
    <article className={`apv-card${barrado ? " barrado" : ""}${resultado?.resultado === "falhou" ? " falhou" : ""}`}>
      <div className="apv-card-h">
        <label className="apv-check" title={barrado ? razao : "Selecionar para o lote"}>
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
            <button className="btn sm" type="button" disabled title={razao}>
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
  const nBarrados = itens.filter((i) => i.literal_confere === false).length;
  // Nunca manda ao banco um id barrado, mesmo que a seleção tenha sobrevivido a
  // uma recarga: a trava não é só visual.
  const selecionados = itens.filter((i) => marcados.has(i.id) && i.literal_confere !== false).map((i) => i.id);

  const aprovarLote = async () => {
    if (!selecionados.length) return;
    setLote({ pend: true, msg: null, ok: true });
    const r = await decidirAprovacoes(selecionados, "aprovar", "");
    if (r.itens?.length) registrar(r.itens);
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

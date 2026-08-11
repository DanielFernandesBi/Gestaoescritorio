"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Chips } from "@/components/Chips";
import { PageHeader } from "@/components/PageHeader";
import { SegredoTag } from "@/components/ui";
import { FILA_ROTULO, rotuloSistema } from "@/lib/apuracao";
import { fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { ConsultaTribunal, DiligenciaItem, RegraMapaApurado, SaudeApuracao, SaudeRubrica } from "@/lib/data";

/**
 * Diligência assistida — a fila, o progresso e a espera.
 *
 * Esta tela SÓ LÊ o banco. Nenhum botão daqui entra em sistema de tribunal: a
 * visita aos autos é ato da T4, manual, chamada por Daniel com o token na
 * máquina, e nunca agendada por causa do 2FA. O que a tela responde é se vale a
 * pena chamar a T4 hoje — quanto espera, em qual sistema, e há quanto tempo.
 */

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/* O tom do resultado não é enfeite: `encontrado` é resposta boa, `erro` é falha
 * da visita, e `dispensada` (Sug. 129) NÃO é resposta de tribunal nenhuma — é
 * curadoria. Pintá-la de verde ao lado das outras diria que alguém foi aos autos. */
const TOM_RESULTADO: Record<string, string> = {
  encontrado: "prov-nao",
  sem_registro: "prov",
  nao_respondeu: "prov",
  erro: "prazo",
  dispensada: "",
};

function TagResultado({ r }: { r: string | null }) {
  const tom = TOM_RESULTADO[r ?? ""] ?? "";
  return <span className={`apur-tag ${tom}`.trim()}>{r ?? "—"}</span>;
}

/** Identificação do processo numa linha, com o CNJ por extenso (nunca truncado). */
function ProcIdent({
  cnj,
  registro,
  cliente,
  segredo,
  processoId,
}: {
  cnj?: string | null;
  registro?: string | null;
  cliente?: string | null;
  segredo?: boolean;
  processoId?: string | null;
}) {
  const num = cnj ? <span className="cnj">{cnj}</span> : registro ? <span className="num-reg">reg {registro}</span> : <span className="sub">sem CNJ</span>;
  return (
    <div className="dil-ident">
      {segredo ? <SegredoTag on /> : <span className="dil-cli">{cliente || "—"}</span>}
      {processoId ? (
        <Link className="proc-link" href={linkPara("processo", processoId)}>{num}</Link>
      ) : (
        num
      )}
    </div>
  );
}

/* ── painel de saúde ─────────────────────────────────────────────────────── */

function Saude({ s }: { s: SaudeApuracao }) {
  const opacos = s.porStatus.a_conferir;
  const apurados = s.porStatus.apurado;
  const emFila = s.porStatus.em_diligencia;
  const maiorCurva = Math.max(1, ...s.curva.map((c) => c.t4 + c.mapa));

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <h3>
          <span className="ia-seal">T4</span> Saúde da apuração
        </h3>
        <span className="vr-sub">janela de {s.janelaDias} dias · processos ativos</span>
      </div>

      <div className="dil-saude">
        <div className="dil-met">
          <b>{s.total}</b>
          <span>movimentos chegaram</span>
        </div>
        <div className="dil-met">
          <b className="tom-amber">{opacos}</b>
          <span>ainda opacos</span>
        </div>
        <div className="dil-met">
          <b className="tom-blue">{emFila}</b>
          <span>na fila da diligência{s.consultasLegiveis ? "" : " · única leitura confiável hoje"}</span>
        </div>
        <div className="dil-met">
          <b className="tom-green">{apurados}</b>
          <span>apurados · {s.apuradosT4} nos autos, {s.apuradosMapa} pelo mapa</span>
        </div>
        <div className="dil-met">
          <b className={s.esperaMaxima != null && s.esperaMaxima > 30 ? "tom-red" : ""}>
            {s.consultasLegiveis && s.esperaMaxima != null ? s.esperaMaxima : "—"}
          </b>
          <span>
            {s.consultasLegiveis
              ? `dias — o mais antigo na fila${s.esperaMediana != null ? ` · mediana ${s.esperaMediana}` : ""}`
              : "espera na fila — depende de consultas_tribunal, ilegível nesta sessão"}
          </span>
        </div>
      </div>

      {/* A curva é o indicador que vale; o número absoluto de apurados nasce em
          zero e assim fica algumas semanas, e isso não é defeito da tela. */}
      <div className="dil-curva">
        <div className="scan-block-h">Apurados por semana · nos autos × pelo mapa</div>
        {s.curva.length === 0 ? (
          <p className="dil-nota">
            Nenhuma apuração registrada ainda. É o esperado nas primeiras semanas — o mapa de
            aprendizado só age sobre o que chegar com a rubrica do movimento preenchida
            (<span className="mono">movimento_nome</span>, prompt <span className="mono">fase14</span> da T1),
            e o histórico anterior não se beneficia. O que vale acompanhar é a curva, não o número
            absoluto, e a proporção da fatia <b>mapa</b> — quanto maior ela for, mais barato o
            sistema fica, porque é visita aos autos que Daniel deixa de fazer.
          </p>
        ) : (
          <>
            <div className="dil-barras">
              {s.curva.map((c) => {
                const tot = c.t4 + c.mapa;
                return (
                  <div className="dil-bar" key={c.semana} title={`Semana de ${fmtDate(c.semana)} — ${c.t4} nos autos, ${c.mapa} pelo mapa`}>
                    <div className="dil-bar-col" style={{ height: `${Math.round((tot / maiorCurva) * 100)}%` }}>
                      <span className="dil-bar-mapa" style={{ height: `${tot ? Math.round((c.mapa / tot) * 100) : 0}%` }} />
                    </div>
                    <span className="dil-bar-l">{fmtDate(c.semana).slice(0, 5)}</span>
                  </div>
                );
              })}
            </div>
            <div className="dil-legenda">
              <span className="lg-autos" /> nos autos (T4/humano)
              <span className="lg-mapa" /> padrão reconhecido (mapa)
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── fila que a T4 recebe ────────────────────────────────────────────────── */

function LinhaConsulta({ c }: { c: ConsultaTribunal }) {
  const fila = c.fila ? FILA_ROTULO[c.fila] : null;
  return (
    <article className={`dil-card${c.dias_espera != null && c.dias_espera > 30 ? " velha" : ""}`}>
      <div className="dil-top">
        <span className="apur-tag" title={fila?.ajuda}>{fila?.rotulo ?? c.fila ?? "diligência"}</span>
        <span className="apur-tag">{rotuloSistema(c.sistema)}</span>
        <span className="dil-espera mono" title="Dias desde que entrou na fila.">
          {c.dias_espera == null ? "—" : plural(c.dias_espera, "dia", "dias")} na fila
        </span>
      </div>
      <ProcIdent cnj={c.numero_cnj} registro={c.numero_registro} cliente={c.cliente} segredo={c.segredo} processoId={c.processo_id} />
      {c.pergunta && <p className="dil-pergunta">{c.pergunta}</p>}
      <div className="dil-foot mono">
        enfileirada {c.enfileirado_em ? fmtDate(c.enfileirado_em) : "—"}
        {c.intimacao_id && <> · <Link className="proc-link" href={linkPara("intimacao", c.intimacao_id)}>intimação</Link></>}
        {c.peca_id && <> · <Link className="proc-link" href={linkPara("peca", c.peca_id)}>peça travada</Link></>}
      </div>
    </article>
  );
}

function LinhaFila({ d }: { d: DiligenciaItem }) {
  const fila = FILA_ROTULO[d.fila];
  return (
    <article className="dil-card leve">
      <div className="dil-top">
        <span className="apur-tag" title={fila?.ajuda}>{fila?.rotulo ?? d.fila}</span>
        <span className="apur-tag">{rotuloSistema(d.sistema)}</span>
        {d.prioridade === "alta" && <span className="apur-tag prov">prioridade alta</span>}
        {d.qtd > 1 && <span className="dil-qtd" title="Movimentos agrupados — uma visita responde todos.">{d.qtd} movimentos</span>}
        <span className="dil-espera mono">
          {d.dias_espera == null ? "—" : plural(d.dias_espera, "dia", "dias")} sem resposta
        </span>
      </div>
      <ProcIdent cnj={d.numero_cnj} registro={d.numero_registro} cliente={d.cliente} segredo={d.segredo} processoId={d.processo_id} />
      {d.pergunta && <p className="dil-pergunta">{d.pergunta}</p>}
    </article>
  );
}

/* ── curadoria do mapa de aprendizado ────────────────────────────────────── */

function Curadoria({ regras, rubrica }: { regras: RegraMapaApurado[]; rubrica: SaudeRubrica }) {
  const suprimem = regras.filter((r) => r.autoriza_supressao);
  const pctRecente = rubrica.recentes ? Math.round((rubrica.recentesComRubrica / rubrica.recentes) * 100) : 0;

  return (
    <>
      <p className="dil-intro">
        Toda apuração feita nos autos vira regra — assinatura normalizada do movimento →
        classificação. Da próxima vez que o mesmo movimento chegar,{" "}
        <span className="mono">fn_aplicar_mapa_andamentos</span> preenche a apuração sozinha,{" "}
        <b>sem que ninguém vá aos autos</b>. É por isso que a curadoria importa: a regra dispensa a
        visita, e dispensar visita é deixar de perguntar.
      </p>

      {/* A rubrica é o gargalo medido do mapa; sem ela a assinatura sai suja. */}
      <div className="mapa-rubrica">
        <div className="mapa-rubrica-h">Rubrica do movimento · o que faz o mapa comprimir</div>
        <div className="dil-saude" style={{ padding: "14px 0 0" }}>
          <div className="dil-met">
            <b className={pctRecente >= 90 ? "tom-green" : pctRecente > 0 ? "tom-amber" : "tom-red"}>{pctRecente}%</b>
            <span>dos andamentos dos últimos 7 dias já vêm com <span className="mono">movimento_nome</span></span>
          </div>
          <div className="dil-met">
            <b>{rubrica.comRubrica}</b>
            <span>com rubrica, de {rubrica.total} no acervo — o histórico anterior ao <span className="mono">fase14</span> não se beneficia</span>
          </div>
        </div>
        <p className="dil-nota">
          Com a rubrica nula a assinatura tem de sair da <span className="mono">descricao</span>, que
          carrega ruído por processo (nome de parte, vara, número, prefixo da fonte), e três
          variações da mesma juntada viram três regras distintas — nenhuma juntando as três
          confirmações necessárias. Medido em 06/08: 471 assinaturas distintas em 506 movimentos
          opacos, compressão de 7%. O conserto só age sobre o que chegar daqui em diante, então o
          número a acompanhar é o da primeira linha, não o do acervo.
        </p>
      </div>

      {regras.length === 0 ? (
        <div className="dil-cego" style={{ background: "var(--surface-2)", borderColor: "var(--line)", borderLeftColor: "var(--muted-2)" }}>
          <b style={{ color: "var(--text)" }}>O mapa ainda não tem nenhuma regra, e isso é o esperado.</b>
          <p>
            Ele aprende de <b>apuração</b>, não de captura — cada regra nasce de alguém ter estado
            nos autos. Enquanto a T4 não rodar, não há o que aprender, por mais movimentos que a T1
            capture. A primeira regra aparece depois da primeira sessão de diligência, e só passa a
            dispensar visita quando acumular <b>3 confirmações, zero divergência</b> e{" "}
            <span className="mono">exige_providencia = false</span>.
          </p>
        </div>
      ) : (
        <>
          <div className="mapa-resumo">
            <b>{regras.length}</b> regra(s) aprendida(s) · <b>{suprimem.length}</b> já dispensa(m) a
            visita aos autos · {regras.length - suprimem.length} ainda em observação
          </div>
          <div className="dil-list">
            {regras.map((r) => (
              <article className={`dil-card mapa-card${r.autoriza_supressao ? " suprime" : ""}`} key={r.id}>
                <div className="dil-top">
                  {r.autoriza_supressao ? (
                    <span className="apur-tag prov" title="Esta regra dispensa a visita aos autos: o movimento é apurado pelo mapa e não vai à diligência.">
                      dispensa visita
                    </span>
                  ) : (
                    <span className="apur-tag" title="Ainda não dispensa visita — falta confirmação, há divergência ou o ato exige providência.">
                      em observação
                    </span>
                  )}
                  {r.tipo_apurado && <span className="apur-tag">{humano(r.tipo_apurado)}</span>}
                  <span className="apur-tag">{rotuloSistema(r.sistema)}</span>
                  {r.exige_providencia === true && <span className="apur-tag prov">exige providência</span>}
                  <span className="dil-espera mono" title="Confirmações × divergências. A supressão exige 3+ e zero.">
                    {r.confirmacoes}✓ {r.divergencias}✗
                  </span>
                </div>
                <div className="mapa-assin mono">{r.assinatura}</div>
                {r.apuracao_padrao && <p className="dil-pergunta">{r.apuracao_padrao}</p>}
                {r.exemplo_bruto && (
                  <details className="apur-orig">
                    <summary>ver exemplo do texto bruto</summary>
                    <div className="apur-orig-b">{r.exemplo_bruto}</div>
                  </details>
                )}
                <div className="dil-foot mono">
                  visto de {r.primeira_vez ? fmtDate(r.primeira_vez) : "—"} a{" "}
                  {r.ultima_vez ? fmtDate(r.ultima_vez) : "—"}
                  {r.criado_por ? ` · ${r.criado_por}` : ""}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <p className="dil-nota" style={{ marginTop: 14 }}>
        Esta área é de <b>leitura</b>. Desligar uma regra que você julgue arriscada é ato de
        curadoria humana e hoje passa pelo chat — a política da migração 97 é só de SELECT, de
        propósito. Para fazê-lo por aqui basta uma função estreita que <i>apenas desliga</i> a
        supressão, auditada pelo gatilho da migração 98; é uma migração e está pronta para quando
        você quiser.
      </p>
    </>
  );
}

/* ── tela ────────────────────────────────────────────────────────────────── */

/** Linha do livro — vale para a resposta de tribunal e para a dispensa. */
function LinhaLivro({ c }: { c: ConsultaTribunal }) {
  return (
    <article className="dil-card feita">
      <div className="dil-top">
        <TagResultado r={c.resultado} />
        <span className="apur-tag">{rotuloSistema(c.sistema)}</span>
        <span className="dil-espera mono">
          {c.dias_espera == null ? "—" : plural(c.dias_espera, "dia", "dias")}{" "}
          {c.resultado === "dispensada" ? "na fila até a dispensa" : "até responder"}
        </span>
      </div>
      <ProcIdent cnj={c.numero_cnj} registro={c.numero_registro} cliente={c.cliente} segredo={c.segredo} processoId={c.processo_id} />
      {c.observacao && <p className="dil-pergunta">{c.observacao}</p>}
      <div className="dil-foot mono">
        enfileirada {c.enfileirado_em ? fmtDate(c.enfileirado_em) : "—"} ·{" "}
        {c.resultado === "dispensada" ? "dispensada" : "consultada"}{" "}
        {c.consultado_em ? fmtDate(c.consultado_em) : "—"}
      </div>
    </article>
  );
}

export function DiligenciaView({
  saude,
  pendentes,
  fila,
  respondidas,
  dispensadas,
  regras,
  rubrica,
}: {
  saude: SaudeApuracao;
  pendentes: ConsultaTribunal[];
  fila: DiligenciaItem[];
  respondidas: ConsultaTribunal[];
  dispensadas: ConsultaTribunal[];
  regras: RegraMapaApurado[];
  rubrica: SaudeRubrica;
}) {
  const [aba, setAba] = useState("pendentes");
  const [sis, setSis] = useState("todos");

  // Chips de sistema montados da própria fila — agrupar por sistema é o que
  // economiza login, que é o gargalo real de uma sessão de T4.
  const sistemas = useMemo(() => {
    const m = new Map<string, number>();
    const fonte =
      aba === "fila"
        ? fila.map((f) => f.sistema)
        : aba === "respondidas"
          ? [...respondidas, ...dispensadas].map((c) => c.sistema)
          : pendentes.map((c) => c.sistema);
    for (const s of fonte) m.set(s || "residuo", (m.get(s || "residuo") ?? 0) + 1);
    return [
      { id: "todos", label: `Todos (${fonte.length})` },
      ...[...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, label: `${rotuloSistema(id)} (${n})` })),
    ];
  }, [aba, fila, pendentes, respondidas, dispensadas]);

  const casaSistema = (s: string | null) => sis === "todos" || (s || "residuo") === sis;
  const pendVis = pendentes.filter((c) => casaSistema(c.sistema));
  const filaVis = fila.filter((f) => casaSistema(f.sistema));
  const respVis = respondidas.filter((c) => casaSistema(c.sistema));
  const dispVis = dispensadas.filter((c) => casaSistema(c.sistema));

  const trocarAba = (v: string) => { setAba(v); setSis("todos"); };

  return (
    <>
      <PageHeader
        breadcrumb={["Entrada · IA", "Diligência assistida"]}
        eyebrow="Autos consultados com Daniel presente"
        titulo="Diligência assistida"
        descricao={
          <>
            A captura diz que algo aconteceu; a diligência vai aos autos descobrir <b>o quê</b>.
            Esta tela só lê o banco — entrar em sistema de tribunal é ato da T4, manual, chamada
            por você com o token na máquina, e nunca agendada por causa do 2FA.
          </>
        }
        kpis={[
          // Com a tabela ilegível, o número honesto é o da view — e o rótulo diz de onde vem.
          saude.consultasLegiveis
            ? { valor: pendentes.length, label: "Na fila da T4 · enfileiradas", tone: pendentes.length ? "amber" : "green" }
            : { valor: saude.emDiligencia, label: "Movimentos em diligência · pela view", tone: "amber" },
          { valor: saude.consultasLegiveis ? (saude.esperaMaxima ?? 0) : 0, label: saude.consultasLegiveis ? "Dias — a espera mais antiga" : "Espera — ilegível nesta sessão", tone: (saude.esperaMaxima ?? 0) > 30 ? "red" : "neutral" },
          { valor: fila.length, label: "Aguardando enfileiramento", tone: "neutral" },
          { valor: saude.porStatus.apurado, label: "Apurados na janela", tone: "green" },
        ]}
      />

      <Saude s={saude} />

      <Chips
        options={[
          { id: "pendentes", label: `Na fila da T4 (${pendentes.length})` },
          { id: "fila", label: `Aguardando enfileiramento (${fila.length})` },
          { id: "respondidas", label: `Livro da diligência (${respondidas.length + dispensadas.length})` },
          { id: "mapa", label: `Mapa de aprendizado (${regras.length})` },
        ]}
        value={aba}
        onChange={trocarAba}
      />
      {aba !== "mapa" && sistemas.length > 2 && <Chips options={sistemas} value={sis} onChange={setSis} />}

      {aba === "mapa" && <Curadoria regras={regras} rubrica={rubrica} />}

      {aba === "pendentes" && (
        <>
          <p className="dil-intro">
            Linhas já gravadas como <span className="mono">pendente</span> em{" "}
            <span className="mono">consultas_tribunal</span> — é exatamente a lista que a T4 recebe
            quando você a chamar. Agrupe por sistema antes de começar; um login serve para todos os
            processos do mesmo sistema.
          </p>
          {!saude.consultasLegiveis ? (
            <div className="dil-cego">
              <b>A fila existe, mas esta sessão não consegue lê-la.</b>
              <p>
                Há <b>{saude.emDiligencia}</b> movimento(s) marcado(s) como <i>na fila da diligência</i>{" "}
                por <span className="mono">vw_feed_andamentos</span>, que enxerga{" "}
                <span className="mono">consultas_tribunal</span> com os direitos do dono. A leitura
                direta da tabela devolve zero, e isso não é fila vazia — a tabela nasceu com RLS
                ligado e <b>sem política de leitura</b> para <span className="mono">authenticated</span>{" "}
                (migrações 83 e 84). Enquanto a política não existir, esta aba, a trilha da visita no
                detalhe do andamento e o livro das respondidas ficam mudos.
              </p>
              <p className="dil-cego-cta">
                É correção de banco, com autorização expressa e registro em{" "}
                <span className="mono">migracoes</span> — não se resolve pelo frontend. A fila{" "}
                <b>calculada</b> ao lado continua legível e mostra o que ainda pode ser enfileirado.
              </p>
            </div>
          ) : pendVis.length === 0 ? (
            <div className="empty">Nada na fila da T4. Nenhuma sessão a fazer agora.</div>
          ) : (
            <div className="dil-list">{pendVis.map((c) => <LinhaConsulta key={c.id} c={c} />)}</div>
          )}
        </>
      )}

      {aba === "fila" && (
        <>
          <p className="dil-intro">
            Fila <b>calculada</b> (<span className="mono">vw_diligencia_fila</span>) — o que ainda pode
            ser enfileirado, e que a T1 grava ao rodar{" "}
            <span className="mono">fn_enfileirar_diligencia</span>. Sai daqui o que tem consulta{" "}
            <b>pendente</b> enfileirada há menos de{" "}
            <span className="mono">diligencia_pendente_validade_dias</span> (7 dias) e o que tem
            consulta <b>encerrada</b> — de qualquer resultado, inclusive dispensa — posterior à data
            do próprio movimento. Não há janela de trinta dias: o item volta quando chega movimento
            NOVO, e a pendência não atendida volta sozinha vencidos os 7 dias.
          </p>
          {filaVis.length === 0 ? (
            <div className="empty">Nada aguardando enfileiramento.</div>
          ) : (
            // A view não tem chave própria: a entrada `expectativa` pode repetir o
            // mesmo processo com tipos de gatilho distintos, ambas sem intimacao_id,
            // e por isso o índice entra como desempate.
            <div className="dil-list">{filaVis.map((d, i) => <LinhaFila key={`${d.fila}-${d.processo_id}-${d.intimacao_id ?? i}`} d={d} />)}</div>
          )}
        </>
      )}

      {aba === "respondidas" && (
        <>
          <p className="dil-intro">
            O livro da diligência. A mesma tabela é a fila e o registro, então aqui se lê o que foi
            perguntado e o que se respondeu. &quot;É ato de rotina, nada a fazer&quot; é resposta
            válida e fica registrada como qualquer outra. <b>As duas metades não se misturam:</b>{" "}
            resposta é visita aos autos; dispensa é decisão de curadoria, em que ninguém entrou no
            tribunal.
          </p>

          <div className="scan-block-h">Respondidas nos autos ({respVis.length})</div>
          {respVis.length === 0 ? (
            <div className="empty">Nenhuma consulta respondida ainda.</div>
          ) : (
            <div className="dil-list">{respVis.map((c) => <LinhaLivro key={c.id} c={c} />)}</div>
          )}

          {dispensadas.length > 0 && (
            <>
              <div className="scan-block-h" style={{ marginTop: 18 }}>
                Dispensadas — a pergunta perdeu o objeto ({dispVis.length})
              </div>
              <p className="dil-intro">
                <span className="mono">dispensada</span> é o resultado terminal criado na Sug. 129
                (migração 104) para fechar item sem mentir: <span className="mono">nao_respondeu</span>{" "}
                afirmaria que o <b>tribunal</b> não respondeu, e nestes o tribunal nunca foi
                consultado. Cada linha traz, na observação, a data e o motivo da dispensa. Elas{" "}
                <b>não cegam a sentinela</b> — como qualquer resultado encerrado, seguram o item fora
                da fila só até chegar movimento novo posterior.
              </p>
              {dispVis.length === 0 ? (
                <div className="empty">Nenhuma dispensa neste sistema.</div>
              ) : (
                <div className="dil-list">{dispVis.map((c) => <LinhaLivro key={c.id} c={c} />)}</div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

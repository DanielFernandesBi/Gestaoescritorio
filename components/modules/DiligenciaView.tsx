"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Chips } from "@/components/Chips";
import { PageHeader } from "@/components/PageHeader";
import { SegredoTag } from "@/components/ui";
import { FILA_ROTULO, rotuloSistema } from "@/lib/apuracao";
import { fmtDate } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { ConsultaTribunal, DiligenciaItem, SaudeApuracao } from "@/lib/data";

/**
 * Diligência assistida — a fila, o progresso e a espera.
 *
 * Esta tela SÓ LÊ o banco. Nenhum botão daqui entra em sistema de tribunal: a
 * visita aos autos é ato da T4, manual, chamada por Daniel com o token na
 * máquina, e nunca agendada por causa do 2FA. O que a tela responde é se vale a
 * pena chamar a T4 hoje — quanto espera, em qual sistema, e há quanto tempo.
 */

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

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

/* ── tela ────────────────────────────────────────────────────────────────── */

export function DiligenciaView({
  saude,
  pendentes,
  fila,
  respondidas,
}: {
  saude: SaudeApuracao;
  pendentes: ConsultaTribunal[];
  fila: DiligenciaItem[];
  respondidas: ConsultaTribunal[];
}) {
  const [aba, setAba] = useState("pendentes");
  const [sis, setSis] = useState("todos");

  // Chips de sistema montados da própria fila — agrupar por sistema é o que
  // economiza login, que é o gargalo real de uma sessão de T4.
  const sistemas = useMemo(() => {
    const m = new Map<string, number>();
    const fonte = aba === "fila" ? fila.map((f) => f.sistema) : aba === "respondidas" ? respondidas.map((c) => c.sistema) : pendentes.map((c) => c.sistema);
    for (const s of fonte) m.set(s || "residuo", (m.get(s || "residuo") ?? 0) + 1);
    return [
      { id: "todos", label: `Todos (${fonte.length})` },
      ...[...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, label: `${rotuloSistema(id)} (${n})` })),
    ];
  }, [aba, fila, pendentes, respondidas]);

  const casaSistema = (s: string | null) => sis === "todos" || (s || "residuo") === sis;
  const pendVis = pendentes.filter((c) => casaSistema(c.sistema));
  const filaVis = fila.filter((f) => casaSistema(f.sistema));
  const respVis = respondidas.filter((c) => casaSistema(c.sistema));

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
          { id: "respondidas", label: `Já respondidas (${respondidas.length})` },
        ]}
        value={aba}
        onChange={trocarAba}
      />
      {sistemas.length > 2 && <Chips options={sistemas} value={sis} onChange={setSis} />}

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
            <span className="mono">fn_enfileirar_diligencia</span>. Sai daqui o que já tem consulta
            pendente ou respondida há menos de 30 dias, e volta só com movimento novo.
          </p>
          {filaVis.length === 0 ? (
            <div className="empty">Nada aguardando enfileiramento.</div>
          ) : (
            {/* A view não tem chave própria: a entrada `expectativa` pode repetir
                processo com tipos de gatilho distintos, e ambas vêm sem intimacao_id. */}
            <div className="dil-list">{filaVis.map((d, i) => <LinhaFila key={`${d.fila}-${d.processo_id}-${d.intimacao_id ?? i}`} d={d} />)}</div>
          )}
        </>
      )}

      {aba === "respondidas" && (
        <>
          <p className="dil-intro">
            O livro da diligência. A mesma tabela é a fila e o registro, então aqui se lê o que foi
            perguntado e o que se respondeu. &quot;É ato de rotina, nada a fazer&quot; é resposta
            válida e fica registrada como qualquer outra.
          </p>
          {respVis.length === 0 ? (
            <div className="empty">Nenhuma consulta respondida ainda.</div>
          ) : (
            <div className="dil-list">
              {respVis.map((c) => (
                <article className="dil-card feita" key={c.id}>
                  <div className="dil-top">
                    <span className="apur-tag prov-nao">{c.resultado}</span>
                    <span className="apur-tag">{rotuloSistema(c.sistema)}</span>
                    <span className="dil-espera mono">
                      {c.dias_espera == null ? "—" : plural(c.dias_espera, "dia", "dias")} até responder
                    </span>
                  </div>
                  <ProcIdent cnj={c.numero_cnj} registro={c.numero_registro} cliente={c.cliente} segredo={c.segredo} processoId={c.processo_id} />
                  {c.observacao && <p className="dil-pergunta">{c.observacao}</p>}
                  <div className="dil-foot mono">
                    enfileirada {c.enfileirado_em ? fmtDate(c.enfileirado_em) : "—"} · consultada{" "}
                    {c.consultado_em ? fmtDate(c.consultado_em) : "—"}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

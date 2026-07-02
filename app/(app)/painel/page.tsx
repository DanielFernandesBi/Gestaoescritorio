import { getPainelData, getUltimaVarredura, getUserEmail, getConferenciasEscaladas, getBeneficiosProximos, getBriefingAtual, getExecucaoFrescor, getExpectativaPendente } from "@/lib/queries";
import { getAudiencias, getPecas, getPrazos } from "@/lib/data";
import { socioDoEmail } from "@/lib/allowlist";
import { Icon } from "@/components/Icon";
import { Pill, SegredoTag, DiasBox } from "@/components/ui";
import { VerMais } from "@/components/VerMais";
import { AnomaliaRow } from "@/components/AnomaliaRow";
import { FormModal } from "@/components/FormModal";
import { validarPrazoEditado, validarAudienciaEditada } from "@/app/actions";
import { TIPO_CONTAGEM, RESPONSAVEIS, AUDIENCIA_TIPO, AUDIENCIA_MODALIDADE } from "@/lib/enums";
import { fmtBRL, fmtDate, fmtTime, fmtNum, humano } from "@/lib/format";
import { linkPara, isEntidadeTipo } from "@/lib/links";
import { Markdown } from "@/components/Markdown";
import { BriefingPdfBtn } from "@/components/BriefingPdfBtn";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusTone = (s: string): "green" | "amber" | "red" =>
  s === "concluida" ? "green" : s === "parcial" ? "amber" : "red";

// Sug. 80 — rótulo da fonte da varredura (inclui redação/manutenção).
const fonteLabel = (f: string) =>
  f === "ambas" ? "DJEN + push" : f === "djen" ? "DJEN" : f === "push" ? "Push"
    : f === "redacao" ? "Redação" : f === "manutencao" ? "Manutenção" : f.toUpperCase();

// Caixinha de data (dia + mês) para audiências.
function diaMes(iso: string) {
  const d = new Date(iso);
  return {
    dia: d.getDate(),
    mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
  };
}
function audTone(dias: number): "crit" | "warn" | "ok" {
  return dias <= 2 ? "crit" : dias <= 7 ? "warn" : "ok";
}
const dl = (n: number) => `${n} ${Math.abs(n) === 1 ? "dia" : "dias"}`;

// Separa o "ato" curto (título) da nota longa que a triagem às vezes anexa entre
// colchetes (reclassificação/conferência) — a nota vira 3ª linha truncada, nunca título.
function splitAto(ato: string): [string, string | null] {
  const j = ato.indexOf(" [");
  if (j > 0) return [ato.slice(0, j).trim(), ato.slice(j).trim()];
  return [ato, null];
}

type FocoCard = { titulo: string; sub: string; href: string | null; tag: string; tone: "crit" | "warn" | "ok" };

export default async function PainelPage() {
  const [
    { stats, prazos, movimentacoes, validacao },
    varredura,
    audiencias,
    email,
    pecas,
    conferencias,
    beneficios,
    briefing,
    prazosAll,
    cobertura,
    expectativa,
  ] = await Promise.all([
    getPainelData(),
    getUltimaVarredura(),
    getAudiencias(),
    getUserEmail(),
    getPecas(),
    getConferenciasEscaladas(),
    getBeneficiosProximos(),
    getBriefingAtual(),
    getPrazos(),
    getExecucaoFrescor(),
    getExpectativaPendente(),
  ]);

  const nome = socioDoEmail(email);
  const prazoPorId = new Map(prazosAll.map((p) => [p.id, p]));
  const audPorId = new Map(audiencias.map((a) => [a.id, a]));

  const horaSP = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );
  const saudacao = horaSP < 12 ? "Bom dia" : horaSP < 18 ? "Boa tarde" : "Boa noite";
  const hojeISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const agora = Date.now();
  const audProximas = audiencias
    .filter((a) => new Date(a.data_hora).getTime() >= agora - 12 * 3600 * 1000)
    .slice(0, 4);

  // Produção: minutas em revisão para o KPI, a varredura e o "onde focar".
  const minutasRevisar = pecas.filter((p) => p.status === "em_revisao").length;

  // Fontes que a última varredura cobriu (derivado de varredura.fonte).
  const fonteDJEN = varredura ? ["djen", "ambas"].includes(varredura.fonte) : false;
  const fontePush = varredura ? ["push", "ambas"].includes(varredura.fonte) : false;

  // Briefing (Sugestão 65): texto vem de vw_briefing_atual; números seguem de varredura.
  const briefingDeHoje = briefing?.data_referencia === hojeISO;
  const autorBriefing =
    briefing && (briefing.gerado_por === "cowork" || briefing.gerado_por === "chat") ? "Claude" : briefing?.gerado_por;

  // "Onde focar agora": do briefing quando há; senão, derivação determinística (fallback).
  const focosDet: FocoCard[] = [];
  const fatal = prazos[0];
  if (fatal) {
    focosDet.push({
      titulo: splitAto(fatal.ato)[0],
      sub: `${fatal.clientes ?? "—"}${fatal.numero_cnj ? ` · ${fatal.numero_cnj}` : ""}`,
      href: linkPara("prazo", fatal.prazo_id),
      tag: `fatal em ${dl(fatal.dias_restantes)}`,
      tone: audTone(fatal.dias_restantes),
    });
  }
  const confTop = conferencias.find((c) => c.prioridade === "urgente") ?? conferencias[0];
  if (confTop) {
    focosDet.push({
      titulo: confTop.titulo,
      sub: confTop.segredo ? "🔒 segredo de justiça" : confTop.cliente ?? "conferência escalada",
      href: linkPara("tarefa", confTop.id),
      tag: confTop.prioridade ?? "conferência",
      tone: confTop.prioridade === "urgente" ? "crit" : "warn",
    });
  }
  if (minutasRevisar > 0) {
    focosDet.push({
      titulo: `Revisar ${minutasRevisar} ${minutasRevisar === 1 ? "minuta" : "minutas"} da produção`,
      sub: "peças em revisão · produção",
      href: "/producao",
      tag: "em revisão",
      tone: "ok",
    });
  }
  const refHref = (ref: { tipo: string | null; id: string | null } | null): string | null => {
    if (!ref || !ref.id || !ref.tipo) return null;
    if (ref.tipo === "peca") return "/producao";
    return isEntidadeTipo(ref.tipo) ? linkPara(ref.tipo, ref.id) : null;
  };
  const ondeFocar: FocoCard[] = briefing
    ? briefing.onde_focar.map((o) => ({
        titulo: o.titulo,
        sub: o.detalhe,
        href: refHref(o.ref),
        tag: o.urgencia,
        tone: o.urgencia === "urgente" ? "crit" : o.urgencia === "alta" ? "warn" : "ok",
      }))
    : focosDet;

  // Resumo determinístico — só usado como fallback quando ainda não há briefing.
  const resumoPartes: string[] = [];
  if (stats.prazos_abertos)
    resumoPartes.push(
      `${stats.prazos_abertos} ${stats.prazos_abertos === 1 ? "prazo aberto" : "prazos abertos"}${fatal ? `, fatal mais próximo em ${dl(fatal.dias_restantes)}` : ""}`,
    );
  if (stats.pendentes_validacao) resumoPartes.push(`${stats.pendentes_validacao} a validar`);
  if (stats.conferencias_pendentes)
    resumoPartes.push(`${stats.conferencias_pendentes} ${stats.conferencias_pendentes === 1 ? "conferência" : "conferências"}`);
  if (minutasRevisar) resumoPartes.push(`${minutasRevisar} ${minutasRevisar === 1 ? "minuta a revisar" : "minutas a revisar"}`);
  const resumoTexto = resumoPartes.length
    ? resumoPartes.join(" · ").replace(/^./, (c) => c.toUpperCase()) + "."
    : "Sem pendências para hoje. 🎉";

  return (
    <div className="painel-page">
      <div className="painel-head">
        <div>
          <div className="eyebrow">Ritual matinal · {fmtDate(new Date().toISOString())}</div>
          <h1>{saudacao}{nome ? `, ${nome}` : ""}.</h1>
          <p>
            {varredura && <>Última varredura concluída às <b>{fmtTime(varredura.criado_em)}</b> · </>}
            {stats.pendentes_validacao} validações e {stats.intimacoes_orfas} intimações órfãs aguardam você.
          </p>
        </div>
        <Link className="btn primary" href="/validacao">
          <Icon name="check" size={15} /> Revisar validações ({stats.pendentes_validacao})
        </Link>
      </div>

      {/* LEITURA DO DIA — briefing persistido (Sugestão 65); números seguem da varredura */}
      <div className="focus">
        <div className="focus-glow" />
        <div className="focus-h">
          <span className="lhs">
            {briefing && <span className="ia-seal">IA</span>}
            <Icon name="activity" size={16} /> Leitura do dia
          </span>
          <span className="focus-sub">
            {briefing ? (
              <>
                gerado às <b>{fmtTime(briefing.gerado_em)}</b> · {autorBriefing}
                {!briefingDeHoje && <> · <span className="focus-stale">de {fmtDate(briefing.data_referencia)}</span></>}
              </>
            ) : (
              "derivado dos dados de hoje · não é texto gerado por IA"
            )}
          </span>
        </div>

        {briefing?.resumo ? (
          <div className="focus-resumo md" id="bf-resumo">
            <Markdown>{briefing.resumo}</Markdown>
          </div>
        ) : (
          <p className="focus-resumo">{resumoTexto}</p>
        )}

        {briefing?.corpo && (
          <details className="focus-corpo">
            <summary>Ver briefing completo</summary>
            <div className="md" id="bf-corpo">
              <Markdown>{briefing.corpo}</Markdown>
            </div>
            <div className="bf-pdf-row">
              <BriefingPdfBtn
                data={fmtDate(briefing.data_referencia)}
                gerado={fmtTime(briefing.gerado_em)}
                autor={autorBriefing}
              />
            </div>
          </details>
        )}

        {(!briefing || !briefingDeHoje) && (
          <div className="focus-cta">
            {briefing ? "Este é o último briefing disponível." : "Nenhum briefing registrado ainda."} Peça{" "}
            <b>“rode a triagem de hoje”</b> no chat para gerar o de hoje.
          </div>
        )}

        {ondeFocar.length > 0 && (
          <>
            <div className="focus-sub2">Onde focar agora</div>
            <ol className="focus-list">
              {ondeFocar.map((f, i) => {
                const inner = (
                  <>
                    <span className="focus-n">{i + 1}</span>
                    <div className="focus-main">
                      <div className="focus-t">{f.titulo}</div>
                      <div className="focus-s">{f.sub}</div>
                    </div>
                    <span className={`focus-tag ${f.tone}`}>{f.tag}</span>
                  </>
                );
                return f.href ? (
                  <Link className="focus-item" key={i} href={f.href}>{inner}</Link>
                ) : (
                  <li className="focus-item" key={i}>{inner}</li>
                );
              })}
            </ol>
          </>
        )}
      </div>

      {/* VARREDURA AUTÔNOMA — fontes → extração → métricas + OAB + anomalias */}
      <div className="scan">
        <div className="scan-h">
          <h3><Icon name="shield" /> Varredura autônoma</h3>
          {varredura && <Pill tone={statusTone(varredura.status)}>{varredura.status}</Pill>}
        </div>
        {!varredura ? (
          <div className="empty">Nenhuma varredura registrada ainda.</div>
        ) : (
          <>
            <div className="scan-sub">
              Rodou em {fmtDate(varredura.criado_em)} {fmtTime(varredura.criado_em)} · referência{" "}
              {fmtDate(varredura.data_referencia)} · fonte {fonteLabel(varredura.fonte)}
            </div>
            <div className="scan-flow">
              <div className="flow-src">
                <span className={`fonte ${fonteDJEN ? "on" : "off"}`}><span className="dot" /> DJEN / CNJ</span>
                <span className={`fonte ${fontePush ? "on" : "off"}`}><span className="dot" /> Push e-mail</span>
                <span className={`fonte ${fontePush ? "on" : "off"}`} title="Conferência cruzada por conteúdo — roda na perna push, não é porta de ingestão">
                  <span className="dot" /> Recorte Digital <em>· conferência cruzada</em>
                </span>
              </div>
              <div className="flow-mid">
                <span className="flow-seal">Cowork · Claude</span>
                <div className="flow-mid-t">Extração &amp; cruzamento</div>
                <div className="flow-mid-s">CNJ · partes · prazo · fundamento · providência</div>
                <div className="flow-mid-n">{fmtNum(varredura.itens_processados)} itens lidos</div>
              </div>
              <div className="flow-metrics">
                <Link className="metric metric-link" href="/varredura/intimacoes"><b>{fmtNum(varredura.intimacoes_novas)}</b><span>intimações</span></Link>
                <Link className="metric metric-link" href="/varredura/andamentos"><b>{fmtNum(varredura.andamentos_novos)}</b><span>andamentos</span></Link>
                <Link className="metric metric-link" href="/varredura/prazos"><b>{fmtNum(varredura.prazos_criados)}</b><span>prazos</span></Link>
                <Link className="metric metric-link" href="/varredura/minutas"><b>{fmtNum(minutasRevisar)}</b><span>minutas</span></Link>
              </div>
            </div>
            <div className="scan-foot">
              <div className="scan-block">
                <div className="scan-block-h">Cobertura por OAB</div>
                {varredura.diagnostico_oab && varredura.diagnostico_oab.length > 0 ? (
                  <div className="scan-grid">
                    {varredura.diagnostico_oab.map((d) => (
                      <div className="oab" key={d.oab}>
                        <div className="lbl">{d.oab}</div>
                        <div className="metrics">
                          <div className="metric"><b>{fmtNum(d.acervo_total)}</b><span>no acervo</span></div>
                          <div className="metric"><b>{fmtNum(d.itens_janela)}</b><span>na janela</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty sm">Sem diagnóstico por OAB.</div>
                )}
              </div>
              <div className="scan-block">
                <div className="scan-block-h">Anomalias</div>
                {varredura.anomalias && varredura.anomalias.length ? (
                  <div className="anom-list">
                    {varredura.anomalias.map((a, idx) => (
                      <AnomaliaRow key={idx} a={a} critico={varredura.status !== "concluida"} />
                    ))}
                  </div>
                ) : (
                  <div className="empty sm">Sem anomalias. 🎉</div>
                )}
                {/* Sug. 64 — possível cobertura perdida (gatilho sem desfecho na janela) */}
                {expectativa.length > 0 && (
                  <div className="exp-block">
                    <div className="exp-h">
                      <span className="ico">⚠</span> Possível cobertura perdida
                      <span className="exp-n">{expectativa.length}</span>
                    </div>
                    <div className="exp-list">
                      {expectativa.slice(0, 6).map((e) => (
                        <Link className="exp-row" key={`${e.processo_id}-${e.tipo}`} href={linkPara("processo", e.processo_id)}>
                          <div className="exp-main">
                            <div className="exp-t">{e.tipo === "hc_impetrado" ? "HC impetrado" : humano(e.tipo)} · sem desfecho há {dl(e.dias_desde_gatilho)}</div>
                            <div className="exp-s">
                              <span>{e.segredo ? <SegredoTag on /> : (e.numero_cnj ?? (e.numero_registro ? `reg ${e.numero_registro}` : "sem nº"))}</span>
                              {e.instancia ? ` · ${e.instancia.toUpperCase()}` : ""}
                            </div>
                          </div>
                          <span className="exp-cta">conferir nos autos →</span>
                        </Link>
                      ))}
                    </div>
                    <div className="exp-foot">Ato nosso que deveria ter resposta e não veio — possível intimação não capturada.</div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* KPIs — panorama do acervo e financeiro */}
      <div className="kpis kpis-6">
        <Link className="kpi red" href="/prazos">
          <div className="accent" />
          <div className="label"><Icon name="clock" size={14} /> Prazos abertos</div>
          <div className="val">{stats.prazos_abertos}</div>
          <div className="meta">
            {prazos[0]
              ? <>próximo fatal em <b style={{ color: "var(--red)" }}>{dl(prazos[0].dias_restantes)}</b></>
              : "sem prazos abertos"}
          </div>
        </Link>

        <Link className="kpi amber" href="/validacao">
          <div className="accent" />
          <div className="label"><Icon name="check" size={14} /> A validar <span className="ai-dot" title="alimentado pela automação" /></div>
          <div className="val">{stats.pendentes_validacao}</div>
          <div className="meta">prazos + audiências</div>
        </Link>

        <Link className={`kpi ${stats.conferencias_pendentes > 0 ? "amber" : ""}`} href="/tarefas">
          <div className="accent" />
          <div className="label"><Icon name="list" size={14} /> Conferências <span className="ai-dot" title="alimentado pela automação" /></div>
          <div className="val">{stats.conferencias_pendentes}</div>
          <div className="meta">tarefas automáticas do Cowork</div>
        </Link>

        <Link className={`kpi ${minutasRevisar > 0 ? "amber" : ""}`} href="/producao">
          <div className="accent" />
          <div className="label"><Icon name="book" size={14} /> Peças em produção <span className="ai-dot" title="alimentado pela automação" /></div>
          <div className="val">{pecas.length}</div>
          <div className="meta">
            {minutasRevisar > 0 ? <><b style={{ color: "var(--amber)" }}>{minutasRevisar}</b> minuta{minutasRevisar === 1 ? "" : "s"} a revisar</> : "nenhuma minuta a revisar"}
          </div>
        </Link>

        <Link className="kpi blue" href="/processos">
          <div className="accent" />
          <div className="label"><Icon name="folder" size={14} /> Processos ativos</div>
          <div className="val">{fmtNum(stats.processos_ativos)}</div>
          <div className="meta">{stats.processos_sem_cnj} sem CNJ · {stats.processos_sigilosos} sigilosos</div>
        </Link>

        <Link className="kpi green" href="/financeiro">
          <div className="accent" />
          <div className="label"><Icon name="wallet" size={14} /> A receber</div>
          <div className="val" style={{ fontSize: 24 }}>{fmtBRL(stats.valor_a_receber)}</div>
          <div className="meta">{stats.parcelas_pendentes} parcelas em aberto</div>
        </Link>
      </div>

      {/* Prazos fatais + Aguardando validação */}
      <div className="two-eq">
        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="clock" /> Prazos fatais</span>
            <Link className="link" href="/prazos">ver todos →</Link>
          </h3>
          {prazos.length ? (
            prazos.slice(0, 4).map((p) => {
              const [ato, nota] = splitAto(p.ato);
              return (
                <Link className="deadline" key={p.prazo_id} href={linkPara("prazo", p.prazo_id)}>
                  <DiasBox dias={p.dias_restantes} />
                  <div className="dl-main">
                    <div className="dl-t">{ato}</div>
                    <div className="dl-s">
                      <span className="dl-cli">{p.clientes ?? "—"}</span>
                      {p.numero_cnj && <> · <span className="cnj">{p.numero_cnj}</span></>}
                    </div>
                    {nota && <div className="dl-note">{nota}</div>}
                  </div>
                  <div className="dl-r mono">
                    {fmtDate(p.data_fatal)}
                    <div className="dl-s">interna {fmtDate(p.data_interna)}</div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="empty">Nenhum prazo aberto.</div>
          )}
        </div>

        <div className="hcard ai-card">
          <h3>
            <span className="lhs"><span className="ia-seal">IA</span> Aguardando validação</span>
            <span className="ai-count">{validacao.length}</span>
          </h3>
          <div className="ai-intro">Itens provisórios criados pela triagem. Você confirma a ciência e a fatal.</div>
          {validacao.length ? (
            <VerMais max={5}>
              {validacao.map((v) => {
                const t = (v.tipo ?? "").toLowerCase();
                const p = t.includes("prazo") ? prazoPorId.get(v.id) : undefined;
                const a = t.includes("audi") ? audPorId.get(v.id) : undefined;
                const cli = p?.clientes || a?.clientes || null;
                const seg = Boolean(p?.segredo || a?.segredo);
                const detalheHref = p ? linkPara("prazo", p.id) : a ? linkPara("audiencia", a.id) : null;
                const corpo = (
                  <>
                    <div className="dl-t">{splitAto(v.descricao)[0]}</div>
                    <div className="dl-s">
                      {seg ? <><SegredoTag on /> · </> : cli && <><span className="dl-cli">{cli}</span> · </>}
                      {humano(v.tipo)}
                      {v.numero_cnj && <> · <span className="cnj">{v.numero_cnj}</span></>}
                      {v.data_relevante && <> · fatal prov. {fmtDate(v.data_relevante)}</>}
                    </div>
                  </>
                );
                return (
                  <div className="deadline valida-row" key={`${v.tipo}-${v.id}`}>
                    {detalheHref ? (
                      <Link className="dl-main valida-link" href={detalheHref}>{corpo}</Link>
                    ) : (
                      <div className="dl-main">{corpo}</div>
                    )}
                    {p ? (
                      <FormModal label="Validar" titulo="Revisar prazo" descricao="Ajuste a data fatal exata e confirme." acao={validarPrazoEditado.bind(null, p.id)} enviarLabel="Validar">
                        <div><label>Ato</label><input name="ato" required defaultValue={p.ato} /></div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div><label>Data fatal</label><input type="date" name="data_fatal" required defaultValue={p.data_fatal?.slice(0, 10)} /></div>
                          <div><label>Data interna</label><input type="date" name="data_interna" defaultValue={p.data_interna?.slice(0, 10) ?? ""} /></div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div><label>Contagem</label><select name="tipo_contagem" defaultValue={p.tipo_contagem ?? "corridos"}>{TIPO_CONTAGEM.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                          <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                        </div>
                      </FormModal>
                    ) : a ? (
                      <FormModal label="Validar" titulo="Revisar audiência" descricao="Ajuste a data e hora exatas e confirme." acao={validarAudienciaEditada.bind(null, a.id)} enviarLabel="Validar">
                        <div><label>Tipo</label><select name="tipo" defaultValue={a.tipo}>{AUDIENCIA_TIPO.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
                        <div><label>Data e hora</label><input type="datetime-local" name="data_hora" required defaultValue={a.data_hora?.slice(0, 16)} /></div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div><label>Modalidade</label><select name="modalidade" defaultValue={a.modalidade ?? "presencial"}>{AUDIENCIA_MODALIDADE.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                          <div><label>Responsável</label><select name="responsavel" defaultValue={a.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                        </div>
                        <div><label>Local / link</label><input name="local_link" defaultValue={a.local_link ?? ""} /></div>
                      </FormModal>
                    ) : (
                      <Link className="btn primary" href="/validacao">Validar</Link>
                    )}
                  </div>
                );
              })}
            </VerMais>
          ) : (
            <div className="empty">Fila de validação vazia. 🎉</div>
          )}
        </div>
      </div>

      {/* Conferências escaladas + Audiências próximas */}
      <div className="two-eq">
        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="shield" /> Conferências escaladas</span>
            <Link className="link" href="/tarefas">tarefas →</Link>
          </h3>
          {conferencias.length ? (
            <VerMais max={5}>
              {conferencias.map((c) => {
                const motivo = c.motivo_auto === "inercia" ? "silêncio anômalo" : c.prioridade === "urgente" ? "afeta liberdade/patrimônio" : c.prioridade === "alta" ? "decisão de mérito" : "conferência";
                return (
                  <Link className="deadline" key={c.id} href={linkPara("tarefa", c.id)}>
                    <div className="dl-main">
                      <div className="dl-t">{c.titulo}</div>
                      <div className="dl-s">
                        <span className="dl-cli">{c.segredo ? <SegredoTag on /> : (c.cliente ?? "—")}</span>
                        {" · "}{motivo}
                        <span className="ai-dot" title="escalada pela automação" />
                      </div>
                    </div>
                    <Pill tone={c.prioridade === "urgente" ? "red" : c.prioridade === "alta" ? "amber" : "gray"} dot={false}>
                      {(c.prioridade ?? "—").toUpperCase()}
                    </Pill>
                  </Link>
                );
              })}
            </VerMais>
          ) : (
            <div className="empty">Nenhuma conferência escalada. 🎉</div>
          )}
        </div>

        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="gavel" /> Audiências próximas</span>
            <Link className="link" href="/audiencias">agenda →</Link>
          </h3>
          {audProximas.length ? (
            audProximas.map((a) => {
              const { dia, mes } = diaMes(a.data_hora);
              const stTone = a.validado ? "ok" : "warn";
              return (
                <Link className="deadline" key={a.id} href={linkPara("audiencia", a.id)}>
                  <span className={`ddays ${stTone}`}>
                    <b>{dia}</b>
                    <span>{mes}</span>
                  </span>
                  <div className="dl-main">
                    <div className="dl-t">{a.segredo ? "Audiência (sigilo)" : humano(a.tipo)}</div>
                    <div className="dl-s">
                      {a.segredo ? <SegredoTag on /> : a.clientes && <span className="dl-cli">{a.clientes}</span>}
                      {(a.segredo || a.clientes) && " · "}
                      {fmtTime(a.data_hora)} · {humano(a.modalidade)}
                      {a.local_link ? ` · ${a.local_link}` : ""}
                    </div>
                  </div>
                  <span className={`gate ${a.validado ? "done" : "wait"}`}>
                    {a.validado ? "✓ validado" : "a validar"}
                  </span>
                </Link>
              );
            })
          ) : (
            <div className="empty">Nenhuma audiência próxima.</div>
          )}
        </div>
      </div>

      {/* Movimentações recentes + Benefícios próximos · execução */}
      <div className="two-eq">
        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="activity" /> Movimentações recentes</span>
            <Link className="link" href="/andamentos">ver todas →</Link>
          </h3>
          {movimentacoes.length ? (
            <VerMais max={6}>
              {movimentacoes.map((m) => (
                <Link className="deadline" key={m.id} href={linkPara("andamento", m.id)}>
                  <div className="dl-main">
                    <div className="dl-t">{humano(m.tipo)}</div>
                    <div className="dl-s"><span className="dl-cli">{m.segredo ? <SegredoTag on /> : (m.clientes ?? "—")}</span></div>
                  </div>
                  <div className="dl-r">
                    <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{m.numero_cnj ?? m.numero_registro ?? "—"}</span>
                    <div className="dl-s">{(m.origem ?? "").toUpperCase()} · {fmtDate(m.data)}</div>
                  </div>
                </Link>
              ))}
            </VerMais>
          ) : (
            <div className="empty">Nenhuma movimentação nos últimos 7 dias.</div>
          )}
        </div>

        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="users" /> Benefícios próximos · execução</span>
            <Link className="link" href="/clientes">clientes →</Link>
          </h3>
          {beneficios.length ? (
            <VerMais max={6}>
              {beneficios.map((b) => (
                <Link className="deadline" key={b.cliente_id} href={linkPara("cliente", b.cliente_id)}>
                  <div className="dl-main">
                    <div className="dl-t">{b.segredo ? <SegredoTag on /> : b.nome}</div>
                    <div className="dl-s">
                      {b.tipo === "progressao" ? "progressão de regime" : "livramento condicional"}
                      {b.regime_atual ? ` · ${humano(b.regime_atual)}` : ""}
                    </div>
                  </div>
                  <div className="dl-r">
                    <Pill tone={b.dias < 0 ? "red" : b.dias <= 30 ? "amber" : "blue"} dot={false}>
                      {b.dias < 0 ? `${Math.abs(b.dias)}d vencido` : `${b.dias}d`}
                    </Pill>
                    {b.data_prevista && <div className="dl-s mono" style={{ marginTop: 4 }}>{fmtDate(b.data_prevista)}</div>}
                  </div>
                </Link>
              ))}
            </VerMais>
          ) : (
            <div className="empty">Nenhum benefício de execução próximo.</div>
          )}
        </div>
      </div>

      {/* Cobertura de execução (Sug. 63) — cobertura/validade do atestado */}
      <div className="hcard section-gap">
        <h3>
          <span className="lhs"><Icon name="shield" /> Cobertura de execução</span>
          <Link className="link" href="/clientes">clientes →</Link>
        </h3>
        <div className="cov-counters">
          <div className={`cov-ct red${cobertura.sem_atestado ? "" : " off"}`}><b>{fmtNum(cobertura.sem_atestado)}</b><span>sem atestado</span></div>
          <div className={`cov-ct amber${cobertura.defasado ? "" : " off"}`}><b>{fmtNum(cobertura.defasado)}</b><span>defasado · acima do limiar</span></div>
          <div className="cov-ct green"><b>{fmtNum(cobertura.em_dia)}</b><span>em dia</span></div>
        </div>
        {cobertura.semLista.length > 0 ? (
          <>
            <div className="cov-sub">
              Clientes de execução sem atestado
              {cobertura.algum_sigiloso && <span className="cov-sig">🔒 inclui sigiloso</span>}
            </div>
            <VerMais max={5}>
              {cobertura.semLista.map((c) => (
                <Link className="deadline" key={c.cliente_id} href={linkPara("cliente", c.cliente_id)}>
                  <div className="dl-main">
                    <div className="dl-t">{c.algum_sigiloso ? <SegredoTag on /> : c.nome}</div>
                    <div className="dl-s">
                      {c.condenacoes_ativas > 0
                        ? `${c.condenacoes_ativas} condenação${c.condenacoes_ativas === 1 ? "" : "ões"} ativa${c.condenacoes_ativas === 1 ? "" : "s"}`
                        : "execução ativa"}
                      {c.tem_hediondo ? " · hediondo" : ""}
                    </div>
                  </div>
                  <Pill tone="red" dot={false}>sem atestado</Pill>
                </Link>
              ))}
            </VerMais>
          </>
        ) : (
          <div className="empty">Todo cliente de execução tem atestado lançado. 🎉</div>
        )}
        <div className="cov-foot">Universo: condenação ativa, snapshot de execução ou processo de execução ativo. Benefícios correm no escuro sem atestado vigente.</div>
      </div>
    </div>
  );
}

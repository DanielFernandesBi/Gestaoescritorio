import { getUltimaVarredura, getVarreduras, getWatermarks } from "@/lib/queries";
import { getPecas, getRadarRecente } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Pill } from "@/components/ui";
import { AnomaliaRow } from "@/components/AnomaliaRow";
import { fmtDate, fmtTime, fmtNum, humano } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusTone = (s: string): "green" | "amber" | "red" =>
  s === "concluida" ? "green" : s === "parcial" ? "amber" : "red";

const relTone = (r: string | null): "red" | "amber" | "green" | "gray" =>
  r === "alta" || r === "vinculante" ? "red" : r === "media" ? "amber" : r === "baixa" ? "gray" : "green";

export default async function VarreduraPage() {
  const [varredura, historico, wm, pecas, radar] = await Promise.all([
    getUltimaVarredura(),
    getVarreduras(8),
    getWatermarks(),
    getPecas(),
    getRadarRecente(),
  ]);
  const radarAcervo = radar.filter((r) => r.candidato_acervo).length;

  const minutasRevisar = pecas.filter((p) => p.status === "em_revisao").length;
  const fonteDJEN = varredura ? ["djen", "ambas"].includes(varredura.fonte) : false;
  const fontePush = varredura ? ["push", "ambas"].includes(varredura.fonte) : false;

  // Etapas do pipeline — explicador da triagem real (manual) com as contagens reais.
  const anomCount = varredura?.anomalias?.length ?? 0;
  const etapas = [
    { t: "DJEN — buscador na nuvem", d: "Cloud Run 22h → Drive djen_AAAA-MM-DD.json · a triagem lê o mais recente", tag: `${fmtNum(varredura?.itens_processados ?? 0)} itens`, tone: "" },
    { t: "Push de e-mail (Gmail)", d: "SEEU/execução + EasyJur (identifica clientes, inclusive sigilosos)", tag: "lido", tone: "" },
    { t: "Recorte Digital — conferência cruzada", d: "não ingere; casa por conteúdo — detecta buraco de cobertura do DJEN", tag: anomCount ? `${anomCount} anomalia${anomCount > 1 ? "s" : ""}` : "sem buraco", tone: anomCount ? "amber" : "green" },
    { t: "Extração & cruzamento — Claude", d: "CNJ, partes, datas, providência, prazo + fundamento · cruza fontes da mesma execução", tag: "núcleo", tone: "ai" },
    { t: "Gravação no banco", d: "UPSERT processos/clientes · INSERT intimações/andamentos · origem=cowork · auditado", tag: "verificado", tone: "green" },
    { t: "Google Calendar — eventos provisórios", d: "prazos/audiências lançados como tangerina (rede de segurança até validar)", tag: `${fmtNum(varredura?.prazos_criados ?? 0)} prazos`, tone: "" },
    { t: "Redator agendado — 2ª passada", d: "minutas de alta confiança (em revisão) · diferidas (aguardando insumo)", tag: `${minutasRevisar} minuta${minutasRevisar === 1 ? "" : "s"}`, tone: "ai" },
  ];

  return (
    <div className="varredura-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Automação · triagem autônoma</div>
          <h1>Varredura</h1>
          <p>
            O Cowork lê DJEN e e-mail, extrai com IA e alimenta o banco — todo dia às <b>22h</b> e sob demanda.
            Nada é deletado; tudo é auditado.
          </p>
        </div>
        <div className="vr-cta" title="A triagem roda no Cloud Scheduler às 22h; sob demanda, peça no chat (Cowork)">
          <Icon name="clock" size={14} /> Roda 22:00 · ou peça <b>“rode a triagem”</b> no chat
        </div>
      </div>

      {/* HERO — última execução (mesma fonte do Painel: vw_ultima_varredura) */}
      <div className="scan">
        <div className="scan-h">
          <h3>
            <span className="ia-seal">IA</span> <Icon name="shield" /> Última execução
            {varredura && <> · {fmtDate(varredura.criado_em)} {fmtTime(varredura.criado_em)}</>}
          </h3>
          {varredura && <Pill tone={statusTone(varredura.status)}>{varredura.status}</Pill>}
        </div>
        {!varredura ? (
          <div className="empty">Nenhuma varredura registrada ainda.</div>
        ) : (
          <>
            <div className="scan-flow">
              <div className="flow-src">
                <span className={`fonte ${fonteDJEN ? "on" : "off"}`}><span className="dot" /> DJEN / CNJ</span>
                <span className={`fonte ${fontePush ? "on" : "off"}`}><span className="dot" /> Push e-mail</span>
                <span className={`fonte ${fontePush ? "on" : "off"}`} title="Conferência cruzada — roda na perna push, não ingere"><span className="dot" /> Recorte Digital <em>· cruzada</em></span>
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
                <Link className="metric metric-link" href="/producao"><b>{fmtNum(minutasRevisar)}</b><span>minutas</span></Link>
              </div>
            </div>

            {/* Janela varrida — watermarks */}
            <div className="vr-wm">
              <div className="vr-wm-i">
                <div className="vr-wm-l">Watermark DJEN</div>
                <div className="vr-wm-v">{wm.djen ? <>↑ {fmtDate(wm.djen)} {fmtTime(wm.djen)}</> : "—"}</div>
              </div>
              <div className="vr-wm-i">
                <div className="vr-wm-l">Watermark push</div>
                <div className="vr-wm-v">{wm.push ? <>↑ {fmtDate(wm.push)} {fmtTime(wm.push)}</> : "—"}</div>
              </div>
              <div className="vr-wm-i">
                <div className="vr-wm-l">Referência</div>
                <div className="vr-wm-v">{fmtDate(varredura.data_referencia)} · fonte {varredura.fonte.toUpperCase()}</div>
              </div>
            </div>

            <div className="scan-foot">
              <div className="scan-block">
                <div className="scan-block-h">Cobertura por OAB <span className="vr-ok">fontes saudáveis</span></div>
                {varredura.diagnostico_oab && varredura.diagnostico_oab.length > 0 ? (
                  <div className="scan-grid">
                    {varredura.diagnostico_oab.map((d) => (
                      <div className="oab" key={d.oab}>
                        <div className="lbl">{d.oab}</div>
                        <div className="metrics">
                          <div className="metric"><b>{fmtNum(d.itens_janela)}</b><span>na janela</span></div>
                          <div className="metric"><b>{fmtNum(d.acervo_total)}</b><span>no acervo</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty sm">Sem diagnóstico por OAB.</div>
                )}
                <div className="vr-hint">O <code>diagnostico_oab</code> é o termômetro de fonte vazia/quebrada: janela zerada com acervo cheio acende alerta mesmo sem erro explícito.</div>
              </div>
              <div className="scan-block">
                <div className="scan-block-h">Anomalias {anomCount > 0 && <span className="vr-badge">{anomCount}</span>}</div>
                {varredura.anomalias && varredura.anomalias.length ? (
                  <div className="anom-list">
                    {varredura.anomalias.map((a, i) => <AnomaliaRow key={i} a={a} critico={varredura.status !== "concluida"} />)}
                  </div>
                ) : (
                  <div className="empty sm">Calendar, Drive e Gmail sem degradação nesta execução. 🎉</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ETAPAS DO PIPELINE */}
      <div className="card section-gap">
        <div className="card-h">
          <h3><Icon name="activity" /> Etapas do pipeline</h3>
          <span className="vr-sub">degradação segura · Supabase/Gmail abortam · Calendar/Drive/DJEN degradam</span>
        </div>
        <div className="vr-steps">
          {etapas.map((e, i) => (
            <div className="vr-step" key={i}>
              <span className="vr-step-n">{i + 1}</span>
              <div className="vr-step-main">
                <div className="vr-step-t">{e.t}</div>
                <div className="vr-step-d">{e.d}</div>
              </div>
              <span className={`vr-step-tag ${e.tone}`}>{e.tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RADAR DE JURISPRUDÊNCIA — feed da IA (informativos/súmulas/precedentes) */}
      <div className="card section-gap">
        <div className="card-h">
          <h3><span className="ia-seal">IA</span> <Icon name="book" /> Radar de jurisprudência</h3>
          <span className="vr-sub">vw_radar_recente · {radarAcervo} candidato{radarAcervo === 1 ? "" : "s"} ao acervo curado</span>
        </div>
        <div className="card-b">
          {radar.length ? (
            <div className="rad-list">
              {radar.map((r) => (
                <div className="rad-item" key={r.id}>
                  <div className="rad-tags">
                    {(r.tribunal || r.orgao) && <span className="pz-tag cat-slate">{r.tribunal ?? r.orgao}</span>}
                    {r.tipo && <span className="pz-tag cat-neutral">{humano(r.tipo)}</span>}
                    {r.relevancia && <Pill tone={relTone(r.relevancia)} dot={false}>{humano(r.relevancia)}</Pill>}
                    {r.candidato_acervo && <span className="pz-tag cowork">candidato ao acervo</span>}
                    {r.numero_informativo && <span className="rad-inf mono">Inf. {r.numero_informativo}</span>}
                  </div>
                  <div className="rad-titulo">
                    {r.link_inteiro_teor || r.url
                      ? <a className="proc-link" href={(r.link_inteiro_teor || r.url)!} target="_blank" rel="noreferrer">{r.titulo}</a>
                      : r.titulo}
                  </div>
                  {r.resumo && <div className="rad-resumo">{r.resumo}</div>}
                  <div className="rad-meta">
                    {[r.relator, r.numero_processo, r.area ? humano(r.area) : null, r.data_publicacao ? fmtDate(r.data_publicacao) : null].filter(Boolean).join(" · ")}
                    {r.temas?.length ? <> · {r.temas.map((t, i) => <span key={i} className="rad-tema">{t}</span>)}</> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              Sem jurisprudência capturada ainda. O radar coleta <b>informativos</b> (STJ/STF), <b>súmulas</b> e precedentes —
              os marcados como <b>candidato ao acervo</b> viram teses curadas nos <Link className="link" href="/estudos">estudos</Link>.
            </div>
          )}
        </div>
      </div>

      {/* HISTÓRICO DE EXECUÇÕES */}
      <div className="card section-gap">
        <div className="card-h">
          <h3><Icon name="list" /> Histórico de execuções</h3>
          <span className="vr-sub">tabela varreduras · append-only</span>
        </div>
        <div className="card-b flush">
          {historico.length ? (
            <table className="vr-table">
              <thead>
                <tr><th>Execução</th><th>Janela</th><th>Fonte</th><th className="num">Itens</th><th className="num">Int · And · Prz</th><th>Status</th></tr>
              </thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id} className="vr-row">
                    <td className="mono"><Link className="vr-rowlink" href={`/varredura/ciclos/${h.id}`}>{fmtDate(h.criado_em)} {fmtTime(h.criado_em)}</Link></td>
                    <td className="mono">{h.janela_inicio ? `${fmtDate(h.janela_inicio)} – ${fmtDate(h.janela_fim)}` : "—"}</td>
                    <td>{h.fonte.toUpperCase()}</td>
                    <td className="num mono">{fmtNum(h.itens_processados)}</td>
                    <td className="num mono">{h.intimacoes_novas} · {h.andamentos_novos} · {h.prazos_criados}</td>
                    <td>
                      <Pill tone={statusTone(h.status)} dot={false}>{h.status}</Pill>
                      {h.status !== "concluida" && h.anomalias?.[0] && <span className="vr-st-hint"> · {h.anomalias[0].tipo}</span>}
                      <Link className="vr-rowabrir" href={`/varredura/ciclos/${h.id}`}>abrir →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma execução registrada.</div>
          )}
        </div>
      </div>
    </div>
  );
}

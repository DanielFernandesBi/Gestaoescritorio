"use client";

import Link from "next/link";
import { AtestadoForm } from "@/components/detalhe/AtestadoForm";
import { fmtDate, fmtNum, humano, hojeSP } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { ExecucaoCliente as TExec, ExecObjetivo, ExecAtestado, ExecCenario } from "@/lib/data";

// Tom do status do cenário projetado (Sug. 57).
const cenTone = (s: string): "blue" | "amber" | "green" | "red" | "gray" =>
  s === "confirmado" ? "green" : s === "frustrado" ? "red" : s === "parcial" ? "amber" : s === "superado" ? "gray" : "blue";

// Delta em dias entre baseline e projetada (negativo = antecipa).
function deltaDias(baseline: string | null, projetada: string | null): number | null {
  if (!baseline || !projetada) return null;
  return Math.round((new Date(projetada + "T12:00:00Z").getTime() - new Date(baseline + "T12:00:00Z").getTime()) / 86_400_000);
}
function deltaTxt(d: number | null): string {
  if (d == null || d === 0) return "";
  const abs = Math.abs(d);
  return d < 0 ? `antecipa ${abs}d` : `adia ${abs}d`;
}

// Uma linha "marco: baseline → projetada (delta)".
function CenLinha({ rotulo, baseline, projetada }: { rotulo: string; baseline: string | null; projetada: string | null }) {
  const d = deltaDias(baseline, projetada);
  if (!baseline && !projetada) return null;
  return (
    <div className="xc-linha">
      <span className="k">{rotulo}</span>
      <span className="base">{baseline ? fmtDate(baseline) : "—"}</span>
      <span className="arr">→</span>
      <span className={`proj${d != null && d < 0 ? " up" : d != null && d > 0 ? " down" : ""}`}>{projetada ? fmtDate(projetada) : "—"}</span>
      {d != null && d !== 0 && <span className={`dlt ${d < 0 ? "up" : "down"}`}>{deltaTxt(d)}</span>}
    </div>
  );
}

function CenarioCard({ c }: { c: ExecCenario }) {
  const tone = cenTone(c.status);
  return (
    <div className={`xc-card t-${tone}`}>
      <span className="bar" />
      <div className="xc-body">
        <div className="xc-head">
          <span className="ti">{c.titulo || "Cenário projetado"}</span>
          <span className={`xp-st ${tone}`}>{humano(c.status)}</span>
          <span className="xc-aprox">APROXIMAÇÃO — confirmar no SEEU</span>
        </div>
        <CenLinha rotulo="Progressão" baseline={c.data_progressao_baseline} projetada={c.data_progressao_projetada} />
        <CenLinha rotulo="Livramento" baseline={c.data_livramento_baseline} projetada={c.data_livramento_projetada} />
        {c.premissas.length > 0 && (
          <ul className="xc-prem">
            {c.premissas.map((p, i) => (
              <li key={i}>
                {[p.condenacao, p.motivo].filter(Boolean).join(" · ") || "premissa"}
                {p.delta_dias != null && <> · <b>{p.delta_dias > 0 ? "+" : ""}{p.delta_dias}d</b></>}
                {p.nova_data_base && <> · nova data-base {fmtDate(p.nova_data_base)}</>}
              </li>
            ))}
          </ul>
        )}
        {c.observacoes && <div className="xc-obs">{c.observacoes}</div>}
        <div className="xc-foot">
          {c.metodo && <span className="met">{c.metodo}</span>}
          {c.peca_id && <Link className="lk" href={linkPara("peca", c.peca_id)}>peça que originou ↗</Link>}
          {c.estudo_id && <Link className="lk" href={linkPara("estudo", c.estudo_id)}>estudo ↗</Link>}
        </div>
      </div>
    </div>
  );
}

// Sug. 63 — badge de frescor/cobertura do atestado no topo da aba Execução.
// Vermelho quando não há atestado ou quando dias_desde_atestado > limiar_dias.
function FrescorBadge({ f }: { f: TExec["frescor"] }) {
  if (!f) return null;
  const vermelho = f.frescor === "sem_atestado" || (f.dias_desde_atestado != null && f.dias_desde_atestado > f.limiar_dias);
  const txt =
    f.frescor === "sem_atestado"
      ? "sem atestado de pena"
      : `atestado de ${f.dias_desde_atestado} ${f.dias_desde_atestado === 1 ? "dia" : "dias"}`;
  const title =
    f.frescor === "sem_atestado"
      ? "Nenhum atestado de pena lançado — benefícios correm no escuro. Solicitar/lançar atestado do SEEU."
      : `${vermelho ? "Defasado" : "Em dia"} · limiar ${f.limiar_dias} dias${f.ult_atestado ? ` · último em ${fmtDate(f.ult_atestado)}` : ""}`;
  return (
    <span className={`xp-frescor ${vermelho ? "red" : "ok"}`} title={title}>
      {vermelho ? "⚠ " : "✓ "}{txt}
    </span>
  );
}

const REGIME_LBL: Record<string, string> = {
  fechado: "Regime fechado",
  semiaberto: "Regime semiaberto",
  aberto: "Regime aberto",
  livramento: "Livramento condicional",
};
const regimeTxt = (r: string | null) => (r ? REGIME_LBL[r] ?? humano(r) : "—");
const fonteTxt = (f: string | null) => (f && /seeu/i.test(f) ? "push SEEU" : f || "manual");
const anoDe = (iso: string | null) => (iso ? iso.slice(0, 4) : "—");

// Contador grande (progressão, livramento, término, remição) com tom opcional.
function Ct({ lbl, big, unit, sub, tone }: { lbl: string; big: string; unit?: string; sub?: string; tone?: "red" | "green" }) {
  return (
    <div className={`xp-ct${tone ? " " + tone : ""}`}>
      <div className="lbl">{lbl}</div>
      <div className="big">{big}{unit && <span className="u">{unit}</span>}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

// Tom da barra lateral / etiqueta do objetivo conforme status (e vencimento).
function objTone(o: ExecObjetivo, vencido: boolean): "red" | "green" | "blue" | "amber" | "gray" {
  if (o.status === "atingido") return "green";
  if (o.status === "frustrado") return "red";
  if (o.status === "prejudicado") return "gray";
  if (o.status === "planejado") return "gray";
  if (o.status === "em_curso") return vencido ? "red" : "blue";
  return "amber";
}
function resTone(status: string): "green" | "amber" | "muted" {
  if (status === "atingido") return "green";
  if (status === "frustrado") return "amber";
  return "amber";
}

export function ExecucaoCliente({ exec, clienteId, situacaoAtual }: { exec: TExec; clienteId: string; situacaoAtual: string | null }) {
  if (!exec.temDados) {
    return (
      <div className="dsec">
        <h4>Execução penal {exec.frescor && <FrescorBadge f={exec.frescor} />}</h4>
        <div className="banner" style={{ margin: "0 0 12px" }}>
          <span className="ico">⚖</span>
          <div>
            Ainda não há atestado de execução, condenações ou estudo estratégico para este cliente.
            Lance o atestado do SEEU abaixo (ou aguarde o fluxo de chat/cowork) — os dados aparecem aqui automaticamente.
          </div>
        </div>
        <div className="acoes">
          <AtestadoForm clienteId={clienteId} situacaoAtual={situacaoAtual} />
        </div>
      </div>
    );
  }

  const s = exec.situacao;
  const nCond = exec.condenacoes.length;
  const progVenc = s?.dias_para_progressao != null && s.dias_para_progressao <= 0;

  // Barra de cumprimento: fração total = progresso%, dividida em cumprido + remido.
  const total = s?.pena_total_dias ?? null;
  const cumpDias = s?.pena_cumprida_dias ?? null;
  const remidos = s?.dias_remidos ?? 0;
  const remanescente = s?.pena_remanescente_dias ?? (total != null && cumpDias != null ? total - cumpDias : null);
  const fill = s?.progresso ?? null;
  const remShare = cumpDias && cumpDias > 0 ? Math.min(1, remidos / cumpDias) : 0;
  const segR = fill != null ? fill * remShare : 0;
  const segC = fill != null ? fill - segR : 0;

  return (
    <>
      {/* cobertura/validade do atestado (Sug. 63) */}
      {exec.frescor && (
        <div className="xp-frescor-row">
          <span className="xp-frescor-lbl">Cobertura do atestado</span>
          <FrescorBadge f={exec.frescor} />
        </div>
      )}

      {/* contexto da pena (cabeçalho da aba) */}
      {s && (
        <div className="xp-base" style={{ marginBottom: 14, fontSize: 12 }}>
          {nCond > 0 && <>pena unificada de <b style={{ color: "var(--text)" }}>{nCond}</b> condenaç{nCond === 1 ? "ão" : "ões"}</>}
          {s.pec_cnj && <> · PEC nº <b style={{ color: "var(--text)" }}>{s.pec_cnj}</b></>}
          {s.pec_tribunal && <> · {s.pec_tribunal}</>}
          {s.pec_instancia && <> · {humano(s.pec_instancia)}</>}
        </div>
      )}

      {/* alerta de marco vencido */}
      {progVenc && (
        <div className="xp-alert">
          <span className="ico">⚠</span>
          <div className="txt">
            <b>Progressão de regime vencida há {Math.abs(s!.dias_para_progressao!)} dias.</b>{" "}
            {s!.data_prevista_progressao && <>Marco previsto {fmtDate(s!.data_prevista_progressao)} · </>}
            pedido de progressão a protocolar.
          </div>
          <Link className="btn primary" href={`/producao?cliente=${clienteId}`}>Criar peça · progressão</Link>
        </div>
      )}

      {/* situação executória atual */}
      {s && (
        <div className="xp-sit">
          <div className="xp-sit-h">
            <span className="xp-eyebrow">
              Situação executória atual
              <span className="xp-ia">+ extraído pela IA · {fonteTxt(s.fonte)}</span>
            </span>
            <span className="meta">
              {s.data_atestado ? `atestado de ${fmtDate(s.data_atestado)}` : "sem atestado"}
              {exec.atestados.length > 0 && ` · v${exec.atestados.length}`}
            </span>
          </div>

          <div className="xp-counters">
            <Ct
              lbl="Progressão"
              big={s.dias_para_progressao == null ? "—" : `${s.dias_para_progressao <= 0 ? "−" : ""}${Math.abs(s.dias_para_progressao)}`}
              unit={s.dias_para_progressao == null ? undefined : "d"}
              sub={s.data_prevista_progressao ? `previsto ${fmtDate(s.data_prevista_progressao)}${progVenc ? " · vencida" : ""}` : undefined}
              tone={progVenc ? "red" : undefined}
            />
            <Ct
              lbl="Livramento cond."
              big={s.dias_para_livramento == null ? "—" : `${s.dias_para_livramento}`}
              unit={s.dias_para_livramento == null ? undefined : "d"}
              sub={s.data_prevista_livramento ? `previsto ${fmtDate(s.data_prevista_livramento)}` : undefined}
            />
            <Ct
              lbl="Término da pena"
              big={anoDe(s.data_termino_pena)}
              sub={s.data_termino_pena ? fmtDate(s.data_termino_pena) : undefined}
            />
            <Ct
              lbl="Remição"
              big={`${fmtNum(s.dias_remidos ?? 0)}`}
              unit="d"
              sub={s.dias_perdidos ? `−${s.dias_perdidos} perdidos` : "sem perdas"}
              tone="green"
            />
          </div>

          {fill != null && (
            <div className="xp-prog">
              <div className="xp-prog-h">
                <span className="k">Cumprimento da pena unificada</span>
                <span className="v">{s.pena_cumprida_texto ?? "—"} de {s.pena_total_texto ?? "—"} · {fill}%</span>
              </div>
              <div className="xp-bar">
                <span className="seg-c" style={{ width: `${segC}%` }} />
                <span className="seg-r" style={{ width: `${segR}%` }} />
              </div>
              <div className="xp-legend">
                {cumpDias != null && <span className="lg"><span className="d c" /> cumprido <b>{fmtNum(cumpDias)} d</b></span>}
                {remidos > 0 && <span className="lg"><span className="d r" /> remido <b>{fmtNum(remidos)} d</b></span>}
                {remanescente != null && <span className="lg"><span className="d x" /> remanescente <b>{fmtNum(remanescente)} d</b></span>}
              </div>
              {(s.data_base_progressao || s.data_base_livramento) && (
                <div className="xp-base">
                  datas-base:
                  {s.data_base_progressao && <> progressão {fmtDate(s.data_base_progressao)}</>}
                  {s.data_base_livramento && <> · livramento {fmtDate(s.data_base_livramento)}</>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* cenários projetados (Sug. 57) — reflexo de peças nos marcos */}
      {exec.cenarios.length > 0 && (
        <div className="xp-sec">
          <div className="xp-sec-h">
            <span className="t">
              Cenários projetados · reflexo de peças
              <span className="n">{exec.cenarios.length} cenário{exec.cenarios.length === 1 ? "" : "s"} · baseline factual intacto</span>
            </span>
          </div>
          {exec.cenarios.map((c) => <CenarioCard key={c.id} c={c} />)}
          <div className="xp-note">
            Projeções calculadas a partir de peças (revisão criminal, agravo em execução, comutação, unificação). São <b>aproximações</b> —
            o marco oficial só muda com atestado novo no SEEU. A situação executória acima permanece o fato.
          </div>
        </div>
      )}

      {/* condenações que compõem a pena */}
      {nCond > 0 && (
        <div className="xp-sec">
          <div className="xp-sec-h">
            <span className="t">Condenações que compõem a pena<span className="n">{nCond} ativa{nCond === 1 ? "" : "s"}</span></span>
          </div>
          {exec.condenacoes.map((c, i) => {
            const titulo = c.descricao_crime || [c.artigo, c.lei].filter(Boolean).join(" — ") || "Condenação";
            return (
              <div className="xp-cond" key={c.processo_origem_id ?? c.numero_processo_origem ?? i}>
                <div className="xp-cond-top">
                  <div style={{ minWidth: 0 }}>
                    <div className="crime">{titulo}</div>
                    <div className="org">
                      {c.processo_origem_id ? (
                        <Link href={`/processos/${c.processo_origem_id}`}>{c.numero_processo_origem ?? "ver processo"} ↗</Link>
                      ) : (
                        <>{c.numero_processo_origem ?? "sem nº"} · <span className="nolink">⚠ sem ação vinculada</span></>
                      )}
                      {c.juizo_vara ? ` · ${c.juizo_vara}` : ""}{c.uf ? ` · ${c.uf}` : ""}
                    </div>
                  </div>
                  <div className="xp-cond-right">
                    {c.data_transito && <div className="tr">trânsito {fmtDate(c.data_transito)}</div>}
                    {c.situacao && <span className="xp-tag sit" style={{ marginTop: 6, display: "inline-flex" }}>{humano(c.situacao)}</span>}
                  </div>
                </div>

                <div className="xp-cond-grid">
                  <div className="xp-cell">
                    <div className="l">Artigo / lei</div>
                    <div className="v">{[c.artigo, c.lei].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <div className="xp-cell">
                    <div className="l">Pena</div>
                    <div className="v"><b>{c.pena_texto ?? "—"}</b>{c.regime_imposto ? ` · ${humano(c.regime_imposto)}` : ""}</div>
                  </div>
                  <div className="xp-cell">
                    <div className="l">Frações</div>
                    <div className="v">
                      {c.fracao_progressao ? `prog. ${c.fracao_progressao}` : "—"}
                      {c.fracao_livramento ? <><br />{`livr. ${c.fracao_livramento}`}</> : null}
                    </div>
                  </div>
                </div>

                {(c.hediondo || c.reincidente) && (
                  <div className="xp-flags">
                    {c.hediondo && <span className="xp-tag hediondo">hediondo</span>}
                    {c.reincidente && <span className="xp-tag reincidente">reincidente</span>}
                  </div>
                )}
              </div>
            );
          })}
          <div className="xp-note">
            Condenações são autossuficientes — chegam pelo atestado. Vincule à ação de origem quando o processo existir no acervo, sem recadastrar.
          </div>
        </div>
      )}

      {/* objetivos × resultados */}
      {exec.objetivos.length > 0 && (
        <div className="xp-sec">
          <div className="xp-sec-h">
            <span className="t">
              Objetivos × resultados
              <span className="n">{exec.estrategia[0]?.titulo ? `${exec.estrategia[0].titulo} · ` : ""}{exec.objetivos.length} marco{exec.objetivos.length === 1 ? "" : "s"}</span>
            </span>
            <Link className="act" href={`/estudos?cliente=${clienteId}`}>Abrir estudo de caso</Link>
          </div>
          {exec.objetivos.map((o) => {
            const vencido = Boolean(o.data_alvo && o.data_alvo.slice(0, 10) < hojeSP() && o.status !== "atingido" && o.status !== "frustrado");
            const tone = objTone(o, vencido);
            return (
              <div className={`xp-obj t-${tone}`} key={o.objetivo_id}>
                <span className="bar" />
                <div className="body">
                  <div className="head">
                    <span className="ti">{o.objetivo}</span>
                    <span className={`xp-st ${tone === "blue" ? "blue" : tone === "green" ? "green" : tone === "red" ? "red" : tone === "amber" ? "amber" : "gray"}`}>
                      {humano(o.status)}{vencido ? " · vencido" : ""}
                    </span>
                  </div>
                  <div className="desc">
                    {o.beneficio_alvo && <>Alvo: <b>{o.beneficio_alvo}</b></>}
                    {o.alvo_cnj && <> · alvo {o.alvo_cnj}</>}
                    {o.instrumento_cnj && <> · via {o.instrumento_cnj}{o.instrumento_area ? ` (${humano(o.instrumento_area)})` : ""}</>}
                    {o.data_alvo && <> · data-alvo {fmtDate(o.data_alvo)}</>}
                  </div>
                </div>
                <div className="res">
                  <div className="rl">Resultado</div>
                  <div className={`rv ${o.resultado ? resTone(o.status) : "muted"}`}>{o.resultado || "—"}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* atestados — evolução versionada */}
      {exec.atestados.length > 0 && (
        <div className="xp-sec">
          <div className="xp-sec-h">
            <span className="t">Atestados de pena · evolução<span className="n">snapshot versionado · nunca sobrescrito</span></span>
          </div>
          <div className="xp-time">
            {exec.atestados.map((a, i) => {
              const versao = exec.atestados.length - i;
              const anterior: ExecAtestado | undefined = exec.atestados[i + 1];
              const delta = a.dias_remidos != null && anterior?.dias_remidos != null ? a.dias_remidos - anterior.dias_remidos : null;
              return (
                <div className={`pt${i === 0 ? "" : " old"}`} key={a.id}>
                  <div className="ph">
                    <span className="pd">{fmtDate(a.data_atestado)}</span>
                    <span className="vbadge">v{versao}{i === 0 ? " · atual" : ""}</span>
                    <span className="src">fonte: {fonteTxt(a.fonte)}</span>
                    {a.drive_file_id && (
                      <a className="link" href={`https://drive.google.com/file/d/${a.drive_file_id}/view`} target="_blank" rel="noreferrer">PDF</a>
                    )}
                  </div>
                  <div className="pm">
                    <b>{regimeTxt(a.regime_atual)}</b>
                    {a.dias_remidos != null && <> · remido <b>{a.dias_remidos}d</b>{delta != null && delta > 0 && <span className="up"> (+{delta} no período)</span>}</>}
                    {a.data_prevista_progressao && <> · progressão prevista <b>{fmtDate(a.data_prevista_progressao)}</b></>}
                    {a.observacoes && <><br /><span className="mark">{a.observacoes}</span></>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* lançar novo atestado */}
      <div className="dsec">
        <div className="acoes">
          <AtestadoForm clienteId={clienteId} situacaoAtual={situacaoAtual} />
        </div>
      </div>
    </>
  );
}

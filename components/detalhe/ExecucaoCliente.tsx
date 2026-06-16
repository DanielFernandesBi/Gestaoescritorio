"use client";

import { Pill, SegredoTag } from "@/components/ui";
import { AtestadoForm } from "@/components/detalhe/AtestadoForm";
import { fmtDate, humano } from "@/lib/format";
import type { ExecucaoCliente as TExec } from "@/lib/data";

const REGIME_LBL: Record<string, string> = {
  fechado: "Regime fechado",
  semiaberto: "Regime semiaberto",
  aberto: "Regime aberto",
  livramento: "Livramento condicional",
};
const regimeTxt = (r: string | null) => (r ? REGIME_LBL[r] ?? humano(r) : "—");

function Counter({ label, dias, data }: { label: string; dias: number | null; data: string | null }) {
  if (dias == null && !data) return null;
  const soon = dias != null && dias < 90;
  const venceu = dias != null && dias <= 0;
  return (
    <div className={`exec-counter${soon ? " soon" : ""}`}>
      <div className="lbl">{label}</div>
      <div className="big">{dias == null ? "—" : venceu ? "atingível" : `${dias} dias`}</div>
      {data && <div className="when">{venceu ? "marco em " : "previsto p/ "}{fmtDate(data)}</div>}
    </div>
  );
}

const objTone = (s: string) =>
  s === "atingido" ? "green" : s === "em_curso" ? "blue" : s === "frustrado" ? "red" : s === "prejudicado" ? "gray" : "amber";

export function ExecucaoCliente({ exec, clienteId, situacaoAtual }: { exec: TExec; clienteId: string; situacaoAtual: string | null }) {
  if (!exec.temDados) {
    return (
      <div className="dsec">
        <h4>Execução penal</h4>
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

  return (
    <>
      <div className="dsec">
        <div className="acoes">
          <AtestadoForm clienteId={clienteId} situacaoAtual={situacaoAtual} />
        </div>
      </div>

      {s && (
        <div className="dsec">
          <h4>Situação atual {s.data_atestado && <span style={{ color: "var(--muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· atestado de {fmtDate(s.data_atestado)}</span>}</h4>
          <div className="exec-card">
            <div className="exec-top">
              <div>
                <div className="exec-regime">{regimeTxt(s.regime_atual)}</div>
                {s.segredo && <div style={{ marginTop: 4 }}><SegredoTag on /></div>}
              </div>
              <div style={{ textAlign: "right", fontSize: 11.5, color: "var(--muted)" }}>
                {s.dias_remidos ? <div>remidos: <b className="mono">{s.dias_remidos}</b> d</div> : null}
                {s.dias_perdidos ? <div>perdidos: <b className="mono">{s.dias_perdidos}</b> d</div> : null}
                {s.data_termino_pena && <div>término: <b className="mono">{fmtDate(s.data_termino_pena)}</b></div>}
              </div>
            </div>

            {s.progresso != null && (
              <>
                <div className="exec-bar"><span style={{ width: `${s.progresso}%` }} /></div>
                <div className="exec-bar-lbl">
                  <span>cumprido: {s.pena_cumprida_texto ?? "—"}</span>
                  <span>{s.progresso}% de {s.pena_total_texto ?? "—"}</span>
                </div>
              </>
            )}

            <div className="exec-counters">
              <Counter label="Próxima progressão" dias={s.dias_para_progressao} data={s.data_prevista_progressao} />
              <Counter label="Livramento condicional" dias={s.dias_para_livramento} data={s.data_prevista_livramento} />
            </div>
          </div>
        </div>
      )}

      {exec.atestados.length > 1 && (
        <div className="dsec">
          <h4>Evolução (atestados)</h4>
          <div className="exec-time">
            {exec.atestados.map((a) => (
              <div className="pt" key={a.id}>
                <div className="pd">
                  {fmtDate(a.data_atestado)} · {regimeTxt(a.regime_atual)}
                  {a.drive_file_id && (
                    <>
                      {" "}
                      <a className="link" href={`https://drive.google.com/file/d/${a.drive_file_id}/view`} target="_blank" rel="noreferrer">PDF</a>
                    </>
                  )}
                </div>
                <div className="pm">
                  cumprido {a.pena_cumprida_texto ?? "—"}
                  {a.dias_remidos ? ` · remidos ${a.dias_remidos}d` : ""}
                  {a.data_prevista_progressao ? ` · progressão ${fmtDate(a.data_prevista_progressao)}` : ""}
                  {a.fonte ? ` · ${a.fonte}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {exec.condenacoes.length > 0 && (
        <div className="dsec">
          <h4>Condenações ({exec.condenacoes.length})</h4>
          <div className="mini-list">
            {exec.condenacoes.map((c, i) => (
              <div className="mini" key={c.processo_origem_id ?? c.numero_processo_origem ?? i} style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="mt mono">{c.numero_processo_origem ?? "sem nº"} {c.uf ? `· ${c.uf}` : ""}</div>
                  <div className="ms">
                    {[c.artigo, c.lei].filter(Boolean).join(" — ") || "tipificação não informada"}
                    {c.juizo_vara ? ` · ${c.juizo_vara}` : ""}
                  </div>
                  <div className="ms">
                    pena <b>{c.pena_texto ?? "—"}</b> · {humano(c.regime_imposto)}
                    {c.fracao_progressao ? ` · prog ${c.fracao_progressao}` : ""}
                    {c.fracao_livramento ? ` · livr ${c.fracao_livramento}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                    {c.hediondo && <Pill tone="red" dot={false}>hediondo</Pill>}
                    {c.reincidente && <Pill tone="amber" dot={false}>reincidente</Pill>}
                    {c.situacao && <Pill tone="gray" dot={false}>{humano(c.situacao)}</Pill>}
                    {!c.processo_origem_id && <span className="ms" style={{ color: "var(--amber)" }}>ação de origem não vinculada</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(exec.estrategia.length > 0 || exec.objetivos.length > 0) && (
        <div className="dsec">
          <h4>Objetivos × resultados</h4>
          {exec.estrategia.map((e) => (
            <div className="mini" key={e.estudo_id} style={{ marginBottom: 8 }}>
              <div>
                <div className="mt">{e.titulo}</div>
                <div className="ms">
                  {e.objetivos_planejados + e.objetivos_em_curso} em aberto · {e.objetivos_atingidos} atingidos
                  {e.objetivos_frustrados ? ` · ${e.objetivos_frustrados} frustrados` : ""}
                  {e.proximo_marco ? ` · próximo marco ${fmtDate(e.proximo_marco)}` : ""}
                </div>
              </div>
              <a className="link" href="/estudos">abrir estudo</a>
            </div>
          ))}
          <div className="mini-list" style={{ marginTop: exec.estrategia.length ? 4 : 0 }}>
            {exec.objetivos.map((o) => (
              <div className="mini" key={o.objetivo_id} style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="mt">{o.objetivo} {o.beneficio_alvo && <span className="ms">· {o.beneficio_alvo}</span>}</div>
                  <div className="ms">
                    {o.alvo_cnj ? <>alvo <b className="mono">{o.alvo_cnj}</b></> : "sem alvo"}
                    {o.instrumento_cnj && <> · via <b className="mono">{o.instrumento_cnj}</b>{o.instrumento_area ? ` (${humano(o.instrumento_area)})` : ""}</>}
                    {o.data_alvo && <> · meta {fmtDate(o.data_alvo)}</>}
                  </div>
                  {o.resultado && <div className="ms">resultado: {o.resultado}</div>}
                </div>
                <Pill tone={objTone(o.status)}>{humano(o.status)}</Pill>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

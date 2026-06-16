"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarAtestado, type AtestadoInput, type CondenacaoInput, type Resultado } from "@/app/actions";
import { REGIME_EXEC, REGIME_IMPOSTO, CONDENACAO_SITUACAO } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";

/* Atestado de pena (SEEU): cabeçalho + N condenações, em regime chat
   (preencher → resumo → confirmar). Somente leitura/escrita pela sessão (RLS). */

const condVazia = (): CondenacaoInput => ({
  numero_processo_origem: "", juizo_vara: "", uf: "", artigo: "", lei: "",
  descricao_crime: "", pena_texto: "", regime_imposto: "fechado",
  fracao_progressao: "", fracao_livramento: "", hediondo: false, reincidente: false,
  situacao: "ativa",
});

const cabecalhoVazio = (cliente_id: string): AtestadoInput => ({
  cliente_id,
  data_atestado: new Date().toISOString().slice(0, 10),
  fonte: "seeu", regime_atual: "fechado",
  pena_total_texto: "", pena_total_dias: "", pena_cumprida_texto: "", pena_cumprida_dias: "",
  pena_remanescente_texto: "", dias_remidos: "", dias_perdidos: "", total_interrupcoes_texto: "",
  data_base_progressao: "", data_prevista_progressao: "", data_base_livramento: "",
  data_prevista_livramento: "", data_termino_pena: "", drive_file_id: "", observacoes: "",
  condenacoes: [condVazia()],
});

export function AtestadoForm({ clienteId, situacaoAtual }: { clienteId: string; situacaoAtual: string | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<"form" | "resumo">("form");
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [d, setD] = useState<AtestadoInput>(() => cabecalhoVazio(clienteId));

  function abrir() {
    setD(cabecalhoVazio(clienteId));
    setEtapa("form");
    setRes(null);
    setAberto(true);
  }
  function setCampo<K extends keyof AtestadoInput>(k: K, v: AtestadoInput[K]) {
    setD((s) => ({ ...s, [k]: v }));
  }
  function setCond(i: number, k: keyof CondenacaoInput, v: string | boolean) {
    setD((s) => ({ ...s, condenacoes: s.condenacoes.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  }
  function addCond() {
    setD((s) => ({ ...s, condenacoes: [...s.condenacoes, condVazia()] }));
  }
  function rmCond(i: number) {
    setD((s) => ({ ...s, condenacoes: s.condenacoes.filter((_, j) => j !== i) }));
  }

  // condenações com algum dado preenchido (espelha o filtro do server).
  const condsPreenchidas = d.condenacoes.filter((c) =>
    [c.numero_processo_origem, c.artigo, c.lei, c.descricao_crime, c.pena_texto].some((x) => x.trim()),
  );

  async function confirmar() {
    setPend(true);
    const r = await criarAtestado(d);
    setPend(false);
    setRes(r);
    if (r.ok) {
      router.refresh();
      setTimeout(() => setAberto(false), 1200);
    }
  }

  const podeAvancar = Boolean(d.data_atestado);

  return (
    <>
      <button className="btn primary" type="button" onClick={abrir}>
        Lançar atestado de pena
      </button>

      {aberto && (
        <div className="modal-scrim" onClick={() => setAberto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modal-h">
              <h3>{etapa === "form" ? "Lançar atestado de pena (SEEU)" : "Confirmar lançamento"}</h3>
              <p>
                {etapa === "form"
                  ? "Snapshot novo (nunca edita o anterior) + condenações. Datas previstas semeiam objetivos se houver estudo."
                  : "Revise o que será gravado. A situação prisional só muda se não houver divergência."}
              </p>
            </div>

            <div className="modal-b">
              {etapa === "form" ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div><label>Data do atestado</label><input type="date" value={d.data_atestado} onChange={(e) => setCampo("data_atestado", e.target.value)} /></div>
                    <div><label>Fonte</label><input value={d.fonte} onChange={(e) => setCampo("fonte", e.target.value)} placeholder="seeu" /></div>
                    <div><label>Regime atual</label><select value={d.regime_atual} onChange={(e) => setCampo("regime_atual", e.target.value)}>{REGIME_EXEC.map((r) => <option key={r} value={r}>{humano(r)}</option>)}</select></div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                    <div><label>Pena total (texto)</label><input value={d.pena_total_texto} onChange={(e) => setCampo("pena_total_texto", e.target.value)} placeholder="ex.: 44a1m24d" /></div>
                    <div><label>Pena total (dias)</label><input inputMode="numeric" value={d.pena_total_dias} onChange={(e) => setCampo("pena_total_dias", e.target.value)} placeholder="opcional" /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                    <div><label>Pena cumprida (texto)</label><input value={d.pena_cumprida_texto} onChange={(e) => setCampo("pena_cumprida_texto", e.target.value)} /></div>
                    <div><label>Pena cumprida (dias)</label><input inputMode="numeric" value={d.pena_cumprida_dias} onChange={(e) => setCampo("pena_cumprida_dias", e.target.value)} placeholder="opcional" /></div>
                  </div>
                  <div><label>Pena remanescente (texto)</label><input value={d.pena_remanescente_texto} onChange={(e) => setCampo("pena_remanescente_texto", e.target.value)} /></div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div><label>Dias remidos</label><input inputMode="numeric" value={d.dias_remidos} onChange={(e) => setCampo("dias_remidos", e.target.value)} /></div>
                    <div><label>Dias perdidos</label><input inputMode="numeric" value={d.dias_perdidos} onChange={(e) => setCampo("dias_perdidos", e.target.value)} /></div>
                    <div><label>Interrupções (texto)</label><input value={d.total_interrupcoes_texto} onChange={(e) => setCampo("total_interrupcoes_texto", e.target.value)} /></div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label>Data-base progressão</label><input type="date" value={d.data_base_progressao} onChange={(e) => setCampo("data_base_progressao", e.target.value)} /></div>
                    <div><label>Progressão prevista</label><input type="date" value={d.data_prevista_progressao} onChange={(e) => setCampo("data_prevista_progressao", e.target.value)} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label>Data-base livramento</label><input type="date" value={d.data_base_livramento} onChange={(e) => setCampo("data_base_livramento", e.target.value)} /></div>
                    <div><label>Livramento previsto</label><input type="date" value={d.data_prevista_livramento} onChange={(e) => setCampo("data_prevista_livramento", e.target.value)} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label>Término da pena</label><input type="date" value={d.data_termino_pena} onChange={(e) => setCampo("data_termino_pena", e.target.value)} /></div>
                    <div><label>Drive file id (PDF)</label><input value={d.drive_file_id} onChange={(e) => setCampo("drive_file_id", e.target.value)} placeholder="opcional" /></div>
                  </div>
                  <div><label>Observações</label><textarea value={d.observacoes} onChange={(e) => setCampo("observacoes", e.target.value)} /></div>

                  <div className="dsec" style={{ marginTop: 6 }}>
                    <h4>Condenações ({condsPreenchidas.length})</h4>
                    {d.condenacoes.map((c, i) => (
                      <div key={i} className="card" style={{ marginBottom: 10 }}>
                        <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                            <div><label>Nº processo de origem</label><input value={c.numero_processo_origem} onChange={(e) => setCond(i, "numero_processo_origem", e.target.value)} /></div>
                            <div><label>UF</label><input maxLength={2} value={c.uf} onChange={(e) => setCond(i, "uf", e.target.value.toUpperCase())} /></div>
                          </div>
                          <div><label>Juízo / vara</label><input value={c.juizo_vara} onChange={(e) => setCond(i, "juizo_vara", e.target.value)} /></div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div><label>Artigo</label><input value={c.artigo} onChange={(e) => setCond(i, "artigo", e.target.value)} placeholder="ex.: 157, §2º" /></div>
                            <div><label>Lei</label><input value={c.lei} onChange={(e) => setCond(i, "lei", e.target.value)} placeholder="ex.: CP" /></div>
                          </div>
                          <div><label>Descrição do crime</label><input value={c.descricao_crime} onChange={(e) => setCond(i, "descricao_crime", e.target.value)} /></div>
                          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                            <div><label>Pena (texto)</label><input value={c.pena_texto} onChange={(e) => setCond(i, "pena_texto", e.target.value)} placeholder="ex.: 5a4m" /></div>
                            <div><label>Regime imposto</label><select value={c.regime_imposto} onChange={(e) => setCond(i, "regime_imposto", e.target.value)}>{REGIME_IMPOSTO.map((r) => <option key={r} value={r}>{humano(r)}</option>)}</select></div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                            <div><label>Fração progressão</label><input value={c.fracao_progressao} onChange={(e) => setCond(i, "fracao_progressao", e.target.value)} placeholder="ex.: 2/5" /></div>
                            <div><label>Fração livramento</label><input value={c.fracao_livramento} onChange={(e) => setCond(i, "fracao_livramento", e.target.value)} placeholder="ex.: 1/3" /></div>
                            <div><label>Situação</label><select value={c.situacao} onChange={(e) => setCond(i, "situacao", e.target.value)}>{CONDENACAO_SITUACAO.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
                          </div>
                          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
                              <input type="checkbox" checked={c.hediondo} onChange={(e) => setCond(i, "hediondo", e.target.checked)} style={{ width: "auto" }} /> Hediondo
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
                              <input type="checkbox" checked={c.reincidente} onChange={(e) => setCond(i, "reincidente", e.target.checked)} style={{ width: "auto" }} /> Reincidente
                            </label>
                            {d.condenacoes.length > 1 && (
                              <button className="btn sm" type="button" onClick={() => rmCond(i)} style={{ marginLeft: "auto" }}>Remover</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button className="btn" type="button" onClick={addCond}>+ Adicionar condenação</button>
                  </div>
                </>
              ) : (
                <div className="modal-resumo">
                  <p><b>Atestado</b> de {fmtDate(d.data_atestado)} · fonte {d.fonte || "seeu"} · regime {humano(d.regime_atual)}.</p>
                  <p style={{ marginTop: 6 }}>
                    Pena total {d.pena_total_texto || "—"} · cumprida {d.pena_cumprida_texto || "—"}
                    {d.data_prevista_progressao ? ` · progressão prevista ${fmtDate(d.data_prevista_progressao)}` : ""}
                    {d.data_prevista_livramento ? ` · livramento previsto ${fmtDate(d.data_prevista_livramento)}` : ""}.
                  </p>
                  <p style={{ marginTop: 6 }}><b>{condsPreenchidas.length}</b> condenação(ões) serão gravadas{condsPreenchidas.length ? `: ${condsPreenchidas.map((c) => c.numero_processo_origem || c.artigo || "s/ nº").join("; ")}` : ""}.</p>
                  {(d.data_prevista_progressao || d.data_prevista_livramento) && (
                    <p style={{ marginTop: 6 }}>Se houver estudo do cliente, serão semeados objetivos de progressão/livramento com as datas previstas.</p>
                  )}
                  <p style={{ marginTop: 6 }}>
                    Situação prisional atual: <b>{situacaoAtual ? humano(situacaoAtual) : "—"}</b>. O regime do atestado só altera o cadastro
                    se não houver divergência; havendo divergência, é aberta uma <b>tarefa de conferência</b> (nada é sobrescrito).
                  </p>
                </div>
              )}

              {res && <div className={`modal-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
            </div>

            <div className="modal-f">
              {etapa === "form" ? (
                <>
                  <button className="btn ghost" type="button" onClick={() => setAberto(false)}>Cancelar</button>
                  <button className="btn primary" type="button" onClick={() => setEtapa("resumo")} disabled={!podeAvancar}>Revisar</button>
                </>
              ) : (
                <>
                  <button className="btn ghost" type="button" onClick={() => setEtapa("form")} disabled={pend}>Voltar</button>
                  <button className="btn primary" type="button" onClick={confirmar} disabled={pend || Boolean(res?.ok)}>{pend ? "Gravando…" : "Confirmar e gravar"}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDrawer } from "@/components/Drawer";
import { Pill, SegredoTag, DiasBox, ProcRef } from "@/components/ui";
import { Acao } from "@/components/Acao";
import { Chips } from "@/components/Chips";
import { FormModal } from "@/components/FormModal";
import {
  criarPeca,
  moverPeca,
  atualizarPeca,
  validarPeca,
  vincularPrazoIntimacao,
  assumirPeca,
  reatribuirPeca,
} from "@/app/actions";
import { PECA_TIPO, PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import type { Peca } from "@/lib/data";

type Socio = "Daniel" | "Rodolfo";
const oUtroSocio = (s: Socio): Socio => (s === "Daniel" ? "Rodolfo" : "Daniel");

type ProcLite = { id: string; label: string };
type CliLite = { id: string; nome: string };
type Lite = { id: string; label: string };

const COLS: { key: string; label: string }[] = [
  { key: "a_fazer", label: "A fazer" },
  { key: "em_elaboracao", label: "Em elaboração" },
  { key: "em_revisao", label: "Em revisão" },
  { key: "aguardando_insumo", label: "Aguardando insumo" },
  { key: "pronta", label: "Pronta" },
];

const priTone = (p: string | null): "red" | "amber" | "gray" =>
  p === "urgente" ? "red" : p === "alta" ? "amber" : "gray";

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as const;

/** Rótulo do processo da peça (CNJ, registro do tribunal, ou inicial sem processo). */
function pecaProcLabel(p: Peca): string {
  if (p.numero_cnj) return p.numero_cnj;
  if (p.numero_registro) return "reg " + p.numero_registro;
  return p.processo_id ? "—" : "inicial — sem processo";
}

/* ---- Lite lists (seletores) ------------------------------------------- */

function useLites() {
  const [procs, setProcs] = useState<ProcLite[]>([]);
  const [clis, setClis] = useState<CliLite[]>([]);
  const [prazos, setPrazos] = useState<Lite[]>([]);
  const [intims, setIntims] = useState<Lite[]>([]);
  useEffect(() => {
    let vivo = true;
    fetch("/api/processos-lite").then((r) => r.json()).then((d) => vivo && setProcs(d.processos ?? [])).catch(() => {});
    fetch("/api/clientes-lite").then((r) => r.json()).then((d) => vivo && setClis(d.clientes ?? [])).catch(() => {});
    fetch("/api/prazos-lite").then((r) => r.json()).then((d) => vivo && setPrazos(d.prazos ?? [])).catch(() => {});
    fetch("/api/intimacoes-lite").then((r) => r.json()).then((d) => vivo && setIntims(d.intimacoes ?? [])).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return { procs, clis, prazos, intims };
}

/* ---- Campos do formulário (criar/editar) ------------------------------ */

function CamposBasicos({ p }: { p?: Peca }) {
  const editar = Boolean(p);
  return (
    <>
      <div><label>Título</label><input name="titulo" required defaultValue={p?.titulo ?? ""} placeholder="Ex.: Apelação — Fulano de Tal" /></div>
      <div style={grid2}>
        <div><label>Tipo</label><select name="tipo" defaultValue={p?.tipo ?? "manifestacao"}>{PECA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Subtipo</label><input name="subtipo" defaultValue={p?.subtipo ?? ""} placeholder="apelação, RESE, HC, alegações finais…" /></div>
      </div>
      <div style={grid2}>
        <div><label>Prioridade</label><select name="prioridade" defaultValue={p?.prioridade ?? "media"}>{PRIORIDADES.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={p?.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div style={grid2}>
        <div><label>Data alvo (opcional)</label><input type="date" name="data_alvo" />{editar && <span className="sub">Em branco mantém a atual.</span>}</div>
        <div><label>Drive (id da minuta)</label><input name="drive_file_id" defaultValue={p?.drive_file_id ?? ""} placeholder="opcional" /></div>
      </div>
      <div><label>Descrição</label><textarea name="descricao" placeholder={editar ? "Deixe em branco para manter a descrição atual." : "Detalhes da peça…"} /></div>
    </>
  );
}

/* ---- Botão "Nova peça" (page-head) ------------------------------------ */

export function NovaPeca() {
  const { procs, clis, prazos, intims } = useLites();
  return (
    <FormModal
      label={<>+ Nova peça</>}
      titulo="Nova peça"
      descricao="Pode nascer SEM processo (inicial de caso novo). Criada manualmente nasce validada."
      acao={criarPeca}
      enviarLabel="Criar peça"
    >
      <CamposBasicos />
      <h4 style={{ margin: "12px 0 2px", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--brass)" }}>Vínculos (todos opcionais)</h4>
      <div style={grid2}>
        <div>
          <label>Cliente</label>
          <select name="cliente_id" defaultValue="">
            <option value="">— nenhum —</option>
            {clis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label>Processo</label>
          <select name="processo_id" defaultValue="">
            <option value="">— nenhum (inicial de caso novo) —</option>
            {procs.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label>Prazo vinculado</label>
        <select name="prazo_id" defaultValue="">
          <option value="">— nenhum —</option>
          {prazos.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <div>
        <label>Intimação de origem</label>
        <select name="intimacao_id" defaultValue="">
          <option value="">— nenhuma —</option>
          {intims.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <p className="sub" style={{ margin: 0 }}>O prazo vinculado herda o semáforo de dias corridos; na baixa do prazo a peça vai para “protocolada” automaticamente.</p>
    </FormModal>
  );
}

/* ---- Ação rápida "validar" (cartão provisório) ------------------------ */

function ValidarRapido({ id }: { id: string }) {
  const router = useRouter();
  const [pend, setPend] = useState(false);
  async function go(e: React.MouseEvent) {
    e.stopPropagation();
    setPend(true);
    const r = await validarPeca(id);
    setPend(false);
    if (r.ok) router.refresh();
  }
  return (
    <button className="btn sm ok" onClick={go} type="button" disabled={pend} style={{ padding: "2px 8px", fontSize: 11 }}>
      {pend ? "…" : "validar"}
    </button>
  );
}

/* ---- Ação rápida "assumir" (cartão) ----------------------------------- */

function AssumirRapido({ id }: { id: string }) {
  const router = useRouter();
  const [pend, setPend] = useState(false);
  async function go(e: React.MouseEvent) {
    e.stopPropagation();
    setPend(true);
    const r = await assumirPeca(id);
    setPend(false);
    if (r.ok) router.refresh();
  }
  return (
    <button className="btn sm" onClick={go} type="button" disabled={pend} style={{ padding: "2px 8px", fontSize: 11 }}>
      {pend ? "…" : "assumir"}
    </button>
  );
}

/* ---- Board ------------------------------------------------------------ */

export function ProducaoBoard({
  pecas,
  protocoladas = [],
  socio = null,
}: {
  pecas: Peca[];
  protocoladas?: Peca[];
  socio?: Socio | null;
}) {
  const { open } = useDrawer();
  const router = useRouter();
  const params = useSearchParams();
  const { prazos, intims } = useLites();
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("todas");
  const autoAbertoRef = useRef(false);

  // Filtro por responsável (atribuição entre os sócios).
  const outro = socio ? oUtroSocio(socio) : null;
  const pecasFiltradas = pecas.filter((p) => {
    if (filtro === "minhas") return socio != null && p.responsavel === socio;
    if (filtro === "socio") return outro != null && p.responsavel === outro;
    if (filtro === "distribuir") return p.responsavel === "Ambos";
    return true;
  });
  const nMinhas = socio ? pecas.filter((p) => p.responsavel === socio).length : 0;
  const nSocio = outro ? pecas.filter((p) => p.responsavel === outro).length : 0;
  const nDistribuir = pecas.filter((p) => p.responsavel === "Ambos").length;
  const filtros = [
    { id: "todas", label: `Todas (${pecas.length})` },
    ...(socio ? [{ id: "minhas", label: `Minhas peças (${nMinhas})` }] : []),
    ...(outro ? [{ id: "socio", label: `Do sócio · ${outro} (${nSocio})` }] : []),
    { id: "distribuir", label: `A distribuir (${nDistribuir})` },
    { id: "protocoladas", label: `Protocoladas (${protocoladas.length})` },
  ];

  // Deep-link ?peca=<id> (vindo do dedup de "Criar petição pendente"): destaca/abre a peça.
  useEffect(() => {
    if (autoAbertoRef.current) return;
    const id = params.get("peca");
    if (!id) return;
    const p = pecas.find((x) => x.id === id) ?? protocoladas.find((x) => x.id === id);
    if (p) {
      autoAbertoRef.current = true;
      abrir(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pecas, protocoladas]);

  function onDragStart(e: DragEvent, p: Peca) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: p.id, status: p.status }));
    e.dataTransfer.effectAllowed = "move";
  }
  async function onDrop(e: DragEvent, colKey: string) {
    e.preventDefault();
    setDragCol(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const { id, status } = JSON.parse(raw) as { id: string; status: string };
      if (!id || status === colKey) return;
      const r = await moverPeca(id, colKey);
      if (r.ok) router.refresh();
    } catch {
      /* payload inválido — ignora */
    }
  }

  function abrir(p: Peca) {
    const provisorio = p.cadastro_automatico && !p.validado;
    open({
      title: (
        <>
          <h2>{p.titulo}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill tone="blue" dot={false}>{humano(p.tipo)}{p.subtipo ? ` · ${p.subtipo}` : ""}</Pill>
            <Pill tone={priTone(p.prioridade)}>{humano(p.prioridade)}</Pill>
            <SegredoTag on={p.segredo} />
            {provisorio && <span className="gate wait">⏳ PROVISÓRIO – conferir</span>}
          </div>
        </>
      ),
      body: (
        <>
          {provisorio && (
            <div className="banner" style={{ margin: "0 0 18px" }}>
              <span className="ico">⚠</span>
              <div><b>Peça provisória (cadastro automático).</b> Nasceu da triagem (validado=false). Confira e valide — mesma doutrina do gate dos prazos.</div>
            </div>
          )}
          <div className="dsec">
            <h4>Dados</h4>
            <div className="dgrid">
              <div className="field"><div className="k">Status</div><div className="v">{humano(p.status)}</div></div>
              <div className="field"><div className="k">Responsável</div><div className="v">{p.responsavel ?? "—"}</div></div>
              <div className="field"><div className="k">Cliente</div><div className="v">{p.cliente ?? "—"}</div></div>
              <div className="field"><div className="k">Processo</div><div className="v mono">{pecaProcLabel(p)}</div></div>
              {p.status === "protocolada" ? (
                <div className="field"><div className="k">Protocolada em</div><div className="v mono">{fmtDate(p.protocolada_em)}</div></div>
              ) : (
                <div className="field"><div className="k">Data efetiva</div><div className="v mono">{fmtDate(p.data_efetiva)}</div></div>
              )}
              <div className="field"><div className="k">Drive</div><div className="v mono" style={{ fontSize: 11 }}>{p.drive_file_id ?? "—"}</div></div>
            </div>
          </div>

          {socio && (
            <div className="dsec">
              <h4>Atribuição</h4>
              <div className="acoes">
                {p.responsavel !== socio && (
                  <Acao label="Assumir" titulo="Assumir peça"
                    resumo={<>Assumir <b>{p.titulo}</b> como <b>{socio}</b>?{p.status === "a_fazer" ? <> Será movida para <b>Em elaboração</b>.</> : null}</>}
                    acao={() => assumirPeca(p.id)} />
                )}
                {outro && p.responsavel !== outro && (
                  <Acao label={`Reatribuir a ${outro}`} titulo="Reatribuir peça"
                    resumo={<>Reatribuir <b>{p.titulo}</b> a <b>{outro}</b>?</>}
                    acao={() => reatribuirPeca(p.id)} />
                )}
              </div>
            </div>
          )}

          <div className="dsec">
            <h4>Prazo vinculado</h4>
            {p.prazo_id ? (
              <div className="dgrid">
                <div className="field"><div className="k">Data fatal</div><div className="v mono" style={{ color: "var(--red)" }}>{fmtDate(p.data_fatal)}</div></div>
                <div className="field"><div className="k">Data interna</div><div className="v mono">{fmtDate(p.data_interna)}</div></div>
                <div className="field"><div className="k">Dias restantes</div><div className="v mono">{p.dias_restantes ?? "—"}</div></div>
                <div className="field"><div className="k">Prazo</div><div className="v">{p.prazo_validado ? "validado" : "provisório"}</div></div>
              </div>
            ) : (
              <div className="empty">Sem prazo vinculado{p.data_efetiva ? ` · semáforo pela data alvo (${fmtDate(p.data_efetiva)})` : ""}.</div>
            )}
          </div>

          {provisorio && (
            <div className="dsec">
              <h4>Conferência</h4>
              <div className="acoes">
                <Acao
                  label="Validar peça"
                  variant="ok"
                  titulo="Validar peça provisória"
                  resumo={<>Confirmar <b>{p.titulo}</b> como conferida (validado=true)?</>}
                  acao={() => validarPeca(p.id)}
                />
              </div>
            </div>
          )}

          <div className="dsec">
            <h4>Editar</h4>
            <div className="acoes">
              <FormModal label="Editar peça" titulo="Editar peça" acao={atualizarPeca.bind(null, p.id)} enviarLabel="Salvar" variant="default">
                <CamposBasicos p={p} />
              </FormModal>
              <FormModal label="Vincular prazo/intimação" titulo="Vínculos de origem" acao={vincularPrazoIntimacao.bind(null, p.id)} enviarLabel="Salvar vínculos" variant="default">
                <div>
                  <label>Prazo vinculado</label>
                  <select name="prazo_id" defaultValue={p.prazo_id ?? ""}>
                    <option value="">— nenhum —</option>
                    {prazos.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Intimação de origem</label>
                  <select name="intimacao_id" defaultValue={p.intimacao_id ?? ""}>
                    <option value="">— nenhuma —</option>
                    {intims.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </div>
                <p className="sub" style={{ margin: 0 }}>Deixe em branco para desfazer o vínculo. O prazo vinculado fecha o loop na baixa (peça → protocolada).</p>
              </FormModal>
            </div>
          </div>

          <div className="dsec">
            <h4>Mover</h4>
            <div className="acoes">
              {COLS.filter((c) => c.key !== p.status).map((c) => (
                <Acao key={c.key} label={c.label} titulo="Mover peça"
                  resumo={<>Mover <b>{p.titulo}</b> para <b>{c.label}</b>?</>}
                  acao={() => moverPeca(p.id, c.key)} />
              ))}
              {p.status !== "protocolada" && (
                <Acao label="Protocolada" variant="ok" titulo="Marcar protocolada"
                  resumo={<>Marcar <b>{p.titulo}</b> como <b>protocolada</b>? Sai do board.</>}
                  acao={() => moverPeca(p.id, "protocolada")} />
              )}
            </div>
          </div>

          <div className="dsec">
            <h4>Encerrar (nunca apaga — troca de status)</h4>
            <div className="acoes">
              <Acao label="Cancelar peça" variant="danger" titulo="Cancelar peça"
                resumo={<>Cancelar <b>{p.titulo}</b>? (status → cancelada, auditado)</>}
                acao={() => moverPeca(p.id, "cancelada")} />
              <Acao label="Prejudicar" variant="danger" titulo="Prejudicar peça"
                resumo={<>Marcar <b>{p.titulo}</b> como <b>prejudicada</b>? (auditado)</>}
                acao={() => moverPeca(p.id, "prejudicada")} />
            </div>
          </div>
        </>
      ),
    });
  }

  if (filtro === "protocoladas") {
    return (
      <>
        <Chips options={filtros} value={filtro} onChange={setFiltro} />
        {protocoladas.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {protocoladas.map((p) => (
              <div key={p.id} className="task" style={{ cursor: "pointer" }} onClick={() => abrir(p)}>
                <div className="ttop">
                  <div className="t">{p.titulo}</div>
                  <Pill tone="green" dot={false}>protocolada</Pill>
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Pill tone="blue" dot={false}>{humano(p.tipo)}{p.subtipo ? ` · ${p.subtipo}` : ""}</Pill>
                </div>
                <div className="d">
                  {p.cliente ?? "—"} · {p.numero_cnj || p.numero_registro ? <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} /> : pecaProcLabel(p)}
                </div>
                {p.segredo && <div style={{ marginTop: 6 }}><SegredoTag on /></div>}
                <div className="f">
                  <span className="sub">{p.responsavel ?? "—"}</span>
                  {p.protocolada_em && <span className="sub mono">protocolada {fmtDate(p.protocolada_em)}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card"><div className="card-b"><div className="empty">Nenhuma peça protocolada ainda.</div></div></div>
        )}
      </>
    );
  }

  return (
    <>
      {filtros.length > 1 && <Chips options={filtros} value={filtro} onChange={setFiltro} />}
      <div className="kanban k5">
      {COLS.map((col) => {
        const itens = pecasFiltradas.filter((p) => p.status === col.key);
        return (
          <div
            className={`kcol${dragCol === col.key ? " drop-on" : ""}`}
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setDragCol(col.key); }}
            onDragLeave={() => setDragCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => onDrop(e, col.key)}
          >
            <div className="kcol-h">
              <span>{col.label}</span>
              <span className="ct">{itens.length}</span>
            </div>
            <div className="kcol-b">
              {itens.length ? (
                itens.map((p) => {
                  const provisorio = p.cadastro_automatico && !p.validado;
                  return (
                    <div
                      key={p.id}
                      className="task"
                      draggable
                      onDragStart={(e) => onDragStart(e, p)}
                      style={{ cursor: "pointer" }}
                      onClick={() => abrir(p)}
                    >
                      <div className="ttop">
                        <div className="t">{p.titulo}</div>
                        {p.dias_restantes != null && <DiasBox dias={p.dias_restantes} />}
                      </div>
                      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Pill tone="blue" dot={false}>{humano(p.tipo)}{p.subtipo ? ` · ${p.subtipo}` : ""}</Pill>
                        {p.prazo_id && (
                          <Pill tone={p.prazo_validado ? "green" : "amber"} dot={false}>
                            prazo {p.prazo_validado ? "validado" : "provisório"}
                          </Pill>
                        )}
                      </div>
                      <div className="d">
                        {p.cliente ?? "—"} · {p.numero_cnj || p.numero_registro ? <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} /> : pecaProcLabel(p)}
                      </div>
                      {p.segredo && <div style={{ marginTop: 6 }}><SegredoTag on /></div>}
                      {provisorio && (
                        <div className="prov">
                          ⚠ PROVISÓRIO – conferir <ValidarRapido id={p.id} />
                        </div>
                      )}
                      <div className="f">
                        <span className="sub">
                          {p.responsavel ?? "—"}
                          {socio && p.responsavel !== socio && (
                            <> · <AssumirRapido id={p.id} /></>
                          )}
                        </span>
                        {p.data_efetiva && <span className="sub mono">{fmtDate(p.data_efetiva)}</span>}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty">—</div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SegredoTag } from "@/components/ui";
import { mesclarCliente, mesclarProcesso } from "@/app/actions";
import { fmtDate, humano } from "@/lib/format";
import type { Resultado } from "@/app/actions";
import type {
  ClienteDuplicadoCluster,
  ProcessoReconciliacao,
  ProcessoPossivelDuplicata,
  DuplicadosContadores,
  TombstoneResolvido,
} from "@/lib/data";

type ProcLite = { id: string; label: string; numero_cnj: string | null; segredo: boolean };

/* ── glifos (fora do set do Icon.tsx) ───────────────────────────────────── */
const Spark = ({ s = 11, c = "#fff" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: c }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);
const Person = ({ c = "var(--muted-2)" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
  </svg>
);
const Merge = ({ s = 17, c = "var(--accent)", tail = true }: { s?: number; c?: string; tail?: boolean }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 4v5a5 5 0 0 0 5 5 5 5 0 0 1 5 5v1M17 4v5a5 5 0 0 1-5 5" />
    {tail && <path d="M14 18l3 2-3 2" />}
  </svg>
);
const Minus = ({ c = "var(--slate)" }: { c?: string }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>
);
const Check = ({ c = "var(--green)" }: { c?: string }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);
const Alert = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);
const Refresh = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8" /><path d="M3 4v4h4" />
  </svg>
);
const Arrow = ({ c = "var(--muted-2)" }: { c?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

/* ── peça reutilizável: linha de contagens de vínculos ──────────────────── */
function Counts({ items }: { items: [number, string][] }) {
  return (
    <div className="dup-counts">
      {items.map(([n, lbl]) => (
        <span key={lbl}><b>{n}</b> {lbl}</span>
      ))}
    </div>
  );
}

/* ── card de processo sem CNJ (reconciliação) ───────────────────────────── */
function ProcessoCard({
  proc,
  carregarLista,
}: {
  proc: ProcessoReconciliacao;
  carregarLista: () => Promise<ProcLite[]>;
}) {
  const router = useRouter();
  const [lista, setLista] = useState<ProcLite[] | null>(null);
  const [escolha, setEscolha] = useState("");      // id do processo com CNJ (par)
  const [inverter, setInverter] = useState(false); // por padrão o canônico é o que tem CNJ
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [oculto, setOculto] = useState(false);

  const par = lista?.find((x) => x.id === escolha) ?? null;
  // canônico = o que tem CNJ (o par escolhido), salvo inversão
  const canonico = inverter ? proc.id : escolha;
  const duplicado = inverter ? escolha : proc.id;

  async function abrirSeletor() {
    if (lista) return;
    const todos = await carregarLista();
    setLista(todos.filter((x) => x.numero_cnj && x.id !== proc.id));
  }
  async function confirmar() {
    if (!canonico || !duplicado) return;
    setPend(true);
    const r = await mesclarProcesso(canonico, duplicado);
    setPend(false);
    setRes(r);
    if (r.ok) { router.refresh(); }
  }

  if (oculto) {
    return (
      <div className="dup-dismissed">
        Marcado como <b>não duplicado</b> nesta sessão · <span className="mono">{proc.numero_registro_tribunal ?? "sem nº"}</span>
        <button type="button" onClick={() => setOculto(false)}>desfazer</button>
      </div>
    );
  }

  const tot = proc.n_intim + proc.n_prazos + proc.n_andam + proc.n_docs;

  return (
    <article className="dup-card ai">
      <div className="dup-card-h">
        <span className="dup-badge soft"><Spark c="var(--accent)" />registro sem CNJ · legado</span>
        <span className="dup-scn">CNJ ↔ registro do tribunal{proc.tribunal ? ` (${proc.tribunal})` : ""}</span>
        <span className="dup-warn"><Alert />conferir antes de mesclar</span>
      </div>

      <div className="dup-split">
        {/* canônico (com CNJ) — escolhido pelo usuário */}
        <div className="dup-side">
          <div className="dup-tag keep"><Check />manter · canônico (com CNJ)</div>
          {par ? (
            <>
              <div className="dup-person"><Person /><b>{par.segredo ? "Processo sigiloso" : (par.numero_cnj ?? par.label)}</b></div>
              <div className="dup-id mono">{par.segredo ? "—" : par.numero_cnj}</div>
              <div className="dup-sub">{par.label}</div>
              <button type="button" className="dup-link" onClick={() => { setEscolha(""); setRes(null); }}>trocar processo</button>
            </>
          ) : (
            <div className="dup-pick">
              <label>Processo com CNJ correspondente</label>
              <select
                value={escolha}
                onFocus={abrirSeletor}
                onChange={(e) => { setEscolha(e.target.value); setRes(null); }}
              >
                <option value="">{lista ? "Selecione…" : "Carregar processos…"}</option>
                {(lista ?? []).map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </select>
              <span className="dup-hint">o canônico é o registro que já tem CNJ</span>
            </div>
          )}
        </div>

        {/* eixo religar */}
        <div className="dup-merge">
          <span className="ring"><Merge /></span>
          <span className="lbl">religar</span>
        </div>

        {/* tombstone (este registro, sem CNJ) */}
        <div className="dup-side tomb">
          <div className="dup-tag tomb"><Minus />vira tombstone (sem CNJ)</div>
          <div className="dup-person"><Person /><b>{proc.numero_registro_tribunal ?? "registro sem nº"}</b>{proc.segredo_justica && <SegredoTag on />}</div>
          <div className="dup-id mono">reg. {proc.numero_registro_tribunal ?? "—"}</div>
          <div className="dup-sub">{[proc.tribunal, proc.uf, proc.instancia ? humano(proc.instancia) : null].filter(Boolean).join(" · ") || "—"}</div>
          <div className="dup-prov">criado {fmtDate(proc.criado_em)}{proc.cadastrado_por ? ` · ${proc.cadastrado_por}` : ""}</div>
          <Counts items={[[proc.n_intim, "intim."], [proc.n_prazos, proc.n_prazos === 1 ? "prazo" : "prazos"], [proc.n_andam, "andam."], [proc.n_docs, proc.n_docs === 1 ? "doc" : "docs"]]} />
        </div>
      </div>

      <div className="dup-foot">
        <span className="note">
          {tot > 0
            ? <>O histórico (<b>{tot}</b> vínculo{tot === 1 ? "" : "s"}) migra para o canônico com CNJ; o registro do tribunal fica preservado como chave alternativa. </>
            : <>Sem vínculos filhos — apenas o registro vira tombstone apontando o canônico. </>}
          <span className="warn-txt">Confirme que é o mesmo processo antes de mesclar.</span>
        </span>
        {par && (
          <button type="button" className="btn sm ghost" onClick={() => setInverter((v) => !v)}>
            {inverter ? "Canônico: este registro" : "Inverter canônico"}
          </button>
        )}
        <button type="button" className="btn sm" onClick={() => setOculto(true)}>Não é duplicado</button>
        <button type="button" className="btn sm primary" onClick={confirmar} disabled={pend || !escolha || Boolean(res?.ok)}>
          <Merge s={13} c="#fff" tail={false} />{pend ? "Mesclando…" : "Mesclar · manter CNJ"}
        </button>
      </div>
      {res && <div className={`dup-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
    </article>
  );
}

/* ── Sug. 54 · card da FILA REAL: stub só-registro × processo CNJ do mesmo
 * cliente (par já conhecido pela view; canônico = o que tem CNJ) ─────────── */
function PossivelCard({ p }: { p: ProcessoPossivelDuplicata }) {
  const router = useRouter();
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [oculto, setOculto] = useState(false);

  async function confirmar() {
    setPend(true);
    const r = await mesclarProcesso(p.cnj_id, p.registro_id);
    setPend(false);
    setRes(r);
    if (r.ok) router.refresh();
  }

  if (oculto) {
    return (
      <div className="dup-dismissed">
        Marcado como <b>não duplicado</b> nesta sessão · <span className="mono">{p.numero_registro_tribunal ?? "sem nº"}</span>
        <button type="button" onClick={() => setOculto(false)}>desfazer</button>
      </div>
    );
  }

  return (
    <article className="dup-card ai">
      <div className="dup-card-h">
        <span className="dup-badge"><Spark />possível duplicata · revisar</span>
        <span className="dup-scn">mesmo cliente{p.tribunal ? ` · ${p.tribunal}` : ""}{p.area ? ` · ${humano(p.area)}` : ""}</span>
        <span className="dup-warn"><Alert />conferir antes de mesclar</span>
      </div>

      <div className="dup-split">
        <div className="dup-side">
          <div className="dup-tag keep"><Check />manter · canônico (com CNJ)</div>
          <div className="dup-person"><Person /><b>{p.segredo ? "Processo sigiloso" : (p.numero_cnj ?? "processo com CNJ")}</b></div>
          <div className="dup-id mono">{p.numero_cnj ?? "—"}</div>
          <div className="dup-sub">{p.cliente ?? "—"}</div>
        </div>

        <div className="dup-merge"><span className="ring"><Merge /></span><span className="lbl">religar</span></div>

        <div className="dup-side tomb">
          <div className="dup-tag tomb"><Minus />vira tombstone (sem CNJ)</div>
          <div className="dup-person"><Person /><b>{p.numero_registro_tribunal ?? "registro sem nº"}</b>{p.segredo && <SegredoTag on />}</div>
          <div className="dup-id mono">reg. {p.numero_registro_tribunal ?? "—"}</div>
          <div className="dup-sub">{[p.tribunal, p.area ? humano(p.area) : null].filter(Boolean).join(" · ") || "—"}</div>
        </div>
      </div>

      <div className="dup-foot">
        <span className="note">
          O mesmo cliente tem um processo <b>só-registro</b> e outro <b>com CNJ</b> na mesma área/tribunal — forte candidato à mesma ação.{" "}
          <span className="warn-txt">Confirme que é o mesmo processo antes de mesclar.</span>
        </span>
        <button type="button" className="btn sm" onClick={() => setOculto(true)}>Não é duplicado</button>
        <button type="button" className="btn sm primary" onClick={confirmar} disabled={pend || Boolean(res?.ok)}>
          <Merge s={13} c="#fff" tail={false} />{pend ? "Mesclando…" : "Mesclar · manter CNJ"}
        </button>
      </div>
      {res && <div className={`dup-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
    </article>
  );
}

/* ── card de cliente duplicado (mesmo nome normalizado) ─────────────────── */
function ClienteCard({ cluster }: { cluster: ClienteDuplicadoCluster }) {
  const router = useRouter();
  const [canonIdx, setCanonIdx] = useState(0);
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [oculto, setOculto] = useState(false);

  const n = cluster.ids.length;
  const dupIdx = canonIdx === 0 ? 1 : 0; // o "outro" exibido como tombstone
  const homonimo = cluster.cpfs_distintos > 1;

  const membro = (i: number) => ({
    id: cluster.ids[i],
    nome: cluster.nomes[i],
    cpf: cluster.cpfs[i],
    criado: cluster.criados[i],
    por: cluster.cadastrados_por[i],
    v: cluster.vinculos[i] ?? { n_processos: 0, n_contratos: 0, n_docs: 0 },
  });
  const canon = membro(canonIdx);
  const dup = membro(dupIdx);

  async function confirmar() {
    setPend(true);
    const r = await mesclarCliente(canon.id, dup.id);
    setPend(false);
    setRes(r);
    if (r.ok) router.refresh();
  }

  if (oculto) {
    return (
      <div className="dup-dismissed">
        Marcado como <b>não duplicado</b> nesta sessão · {cluster.nomes[0]}
        <button type="button" onClick={() => setOculto(false)}>desfazer</button>
      </div>
    );
  }

  const flag = homonimo
    ? <span className="dup-flag red"><Alert />homônimo? · CPFs distintos</span>
    : cluster.algum_com_cpf
      ? <span className="dup-flag amber"><Alert />revisar · confirmar CPF</span>
      : <span className="dup-flag gray">sem CPF</span>;

  const counts = (m: ReturnType<typeof membro>): [number, string][] => [
    [m.v.n_processos, m.v.n_processos === 1 ? "processo" : "processos"],
    [m.v.n_contratos, m.v.n_contratos === 1 ? "contrato" : "contratos"],
    [m.v.n_docs, m.v.n_docs === 1 ? "doc" : "docs"],
  ];

  return (
    <article className="dup-card">
      <div className="dup-card-h plain">
        <span className="dup-badge soft"><Spark c="var(--accent)" />candidato a duplicata</span>
        <span className="dup-scn">Acento / maiúsculas</span>
        <span className="dup-ident mono">{cluster.nome_normalizado}</span>
        <span className="dup-h-end">{flag}</span>
      </div>

      <div className="dup-split">
        <div className="dup-side">
          <div className="dup-tag keep"><Check />manter · canônico</div>
          <div className="dup-person"><Person /><b>{canon.nome}</b></div>
          <div className="dup-id mono">{canon.cpf ? `CPF ${canon.cpf}` : "sem CPF"}</div>
          <div className="dup-prov">criado {fmtDate(canon.criado)}{canon.por ? ` · ${canon.por}` : ""}</div>
          <Counts items={counts(canon)} />
        </div>

        <div className="dup-merge">
          <span className="ring"><Merge /></span>
          <span className="lbl">religar</span>
        </div>

        <div className="dup-side tomb">
          <div className="dup-tag tomb"><Minus />vira tombstone</div>
          <div className="dup-person"><Person /><b>{dup.nome}</b></div>
          <div className="dup-id mono">{dup.cpf ? `CPF ${dup.cpf}` : "sem CPF"}</div>
          <div className="dup-prov">criado {fmtDate(dup.criado)}{dup.por ? ` · ${dup.por}` : ""}</div>
          <Counts items={counts(dup)} />
        </div>
      </div>

      <div className="dup-foot">
        <span className="note">
          Religa processos, contratos e documentos ao canônico. Campos vazios do canônico são completados pelo duplicado (nunca sobrescreve).{" "}
          {homonimo
            ? <span className="warn-txt">CPFs distintos — forte indício de pessoas diferentes; em geral NÃO mescle.</span>
            : <span className="dim">Nome difere só por acento/caixa — confirme o CPF.</span>}
          {n > 2 && <> Grupo com <b>{n}</b> registros — mescle um de cada vez.</>}
        </span>
        <button type="button" className="btn sm ghost" onClick={() => setCanonIdx((i) => (i === 0 ? 1 : 0))}>Inverter canônico</button>
        <button type="button" className="btn sm" onClick={() => setOculto(true)}>Não é duplicado</button>
        <button type="button" className="btn sm primary" onClick={confirmar} disabled={pend || canon.id === dup.id || Boolean(res?.ok)}>
          <Merge s={13} c="#fff" tail={false} />{pend ? "Mesclando…" : "Mesclar clientes"}
        </button>
      </div>
      {res && <div className={`dup-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
    </article>
  );
}

/* ── tela ────────────────────────────────────────────────────────────────── */
const LOTE = 6;

export function DuplicadosView({
  contadores,
  clusters,
  possiveis,
  processos,
  tombstones,
}: {
  contadores: DuplicadosContadores;
  clusters: ClienteDuplicadoCluster[];
  possiveis: ProcessoPossivelDuplicata[];
  processos: ProcessoReconciliacao[];
  tombstones: TombstoneResolvido[];
}) {
  const router = useRouter();
  const [verTodos, setVerTodos] = useState(false);
  const [verLegado, setVerLegado] = useState(false);
  const listaRef = useRef<ProcLite[] | null>(null);

  // /api/processos-lite é buscada uma única vez e compartilhada por todos os cards.
  const carregarLista = useCallback(async (): Promise<ProcLite[]> => {
    if (listaRef.current) return listaRef.current;
    const r = await fetch("/api/processos-lite").then((x) => x.json()).catch(() => ({ processos: [] }));
    listaRef.current = (r.processos ?? []) as ProcLite[];
    return listaRef.current;
  }, []);

  const visiveis = verTodos ? processos : processos.slice(0, LOTE);

  return (
    <div className="dup-page">
      {/* cabeçalho */}
      <div className="dup-head">
        <div className="lhs">
          <div className="eyebrow">Conferência de identidade · nunca descarta</div>
          <h1>Duplicados</h1>
          <p>
            A IA sinaliza candidatos a duplicata por <code>numero_cnj</code> <b>ou</b> <code>numero_registro_tribunal</code> (STJ/STF)
            e por nome normalizado. Mesclar não apaga: o registro vira <b>tombstone</b> (<code>merged_into</code>) e os vínculos
            religam pelo canônico.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => router.refresh()}><Refresh />Rodar conferência</button>
      </div>

      {/* contadores */}
      <div className="dup-counters">
        <div className="dup-counter accent"><div className="big">{contadores.possiveis_revisar}</div><div className="lbl">possível duplicata · revisar</div></div>
        <div className="dup-counter"><div className="big">{contadores.clientes_revisar}</div><div className="lbl">clientes · a revisar</div></div>
        <div className="dup-counter"><div className="big">{contadores.legado_pendente}</div><div className="lbl">CNJ pendente · legado</div></div>
        <div className="dup-counter"><div className="big green">{contadores.mesclados_30d}</div><div className="lbl">mesclados · 30d</div></div>
      </div>

      {/* Sug. 54 — FILA REAL de merge (stub só-registro × CNJ do mesmo cliente) */}
      <div className="dup-seclabel">
        <span className="t">Possível duplicata · revisar</span>
        <code>vw_possiveis_duplicatas_registro</code>
      </div>
      {possiveis.length > 0 ? (
        possiveis.map((p) => <PossivelCard key={p.registro_id} p={p} />)
      ) : (
        <div className="dup-empty">Nenhuma duplicata real a revisar — nenhum stub só-registro pareia com um processo CNJ do mesmo cliente. 🎉</div>
      )}

      {/* clientes */}
      <div className="dup-seclabel">
        <span className="t">Clientes · mesmo nome normalizado</span>
        <code>nome_normalizado</code>
      </div>
      {clusters.length > 0 ? (
        clusters.map((c) => <ClienteCard key={c.nome_normalizado} cluster={c} />)
      ) : (
        <div className="dup-empty">Nenhum cliente duplicado por nome normalizado. 🎉</div>
      )}

      {/* Sug. 54 — LEGADO só-registro: backlog estático, não alarme diário */}
      {processos.length > 0 && (
        <>
          <div className="dup-seclabel">
            <span className="t">Legado · CNJ pendente (a reconciliar)</span>
            <code>numero_cnj IS NULL · stubs inertes</code>
          </div>
          <div className="dup-legado-note">
            <b>{processos.length}</b> processos STJ/STF antigos só com registro do tribunal (migração de planilha), sem CNJ — em sua maioria
            inertes. <b>Não é alarme:</b> a reconciliação é preguiçosa — quando o caso se movimenta, o DJEN traz o CNJ e o stub é
            mesclado no canônico (tombstone). Abra abaixo só se já souber o CNJ correspondente.
          </div>
          {!verLegado ? (
            <button type="button" className="dup-vertodos" onClick={() => setVerLegado(true)}>
              Revisar legado manualmente ({processos.length})
            </button>
          ) : (
            <>
              {visiveis.map((p) => <ProcessoCard key={p.id} proc={p} carregarLista={carregarLista} />)}
              {processos.length > LOTE && !verTodos && (
                <button type="button" className="dup-vertodos" onClick={() => setVerTodos(true)}>
                  Ver todos os {processos.length} registros sem CNJ
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* tombstones resolvidos */}
      {tombstones.length > 0 && (
        <article className="dup-card dup-resolved">
          <div className="dup-resolved-h">
            <span className="t">Tombstones resolvidos</span>
            <code>merged_into → canônico · fn_resolver_processo</code>
            <span className="end">auditado · irreversível por DELETE</span>
          </div>
          <div className="dup-resolved-list">
            {tombstones.map((t) => (
              <div className="row" key={t.id}>
                <span className="ico"><Minus c="var(--slate)" /></span>
                <div className="mid">
                  <div className="keys">
                    <span className="mono old">{t.reg_antigo ? `reg. ${t.reg_antigo}` : (t.cnj_antigo ?? "—")}</span>
                    <Arrow />
                    <span className="mono new">{t.canonico_ident ?? "—"}</span>
                  </div>
                  <div className="sub">
                    {t.cliente && <b>{t.cliente}</b>}
                    {t.vinculos > 0 && <> · {t.vinculos} vínculo{t.vinculos === 1 ? "" : "s"} religado{t.vinculos === 1 ? "" : "s"}</>}
                  </div>
                </div>
                <span className="when mono">{fmtDate(t.resolvido_em)}{t.origem ? ` · ${t.origem}` : ""}</span>
              </div>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}

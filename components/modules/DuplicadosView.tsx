"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Chips } from "@/components/Chips";
import { Pill, SegredoTag } from "@/components/ui";
import { mesclarCliente, mesclarProcesso } from "@/app/actions";
import { fmtDate, humano } from "@/lib/format";
import type { Resultado } from "@/app/actions";
import type { ClienteDuplicadoCluster, ProcessoReconciliacao } from "@/lib/data";

type ProcLite = { id: string; label: string; numero_cnj: string | null; segredo: boolean };

/* Bloco de contagens (o que será reassociado) ---------------------------- */
function Contagens({ tipo, dup }: { tipo: "cliente" | "processo"; dup: string | null }) {
  const [cont, setCont] = useState<Record<string, number> | null>(null);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    if (!dup) { setCont(null); return; }
    let vivo = true;
    setCarregando(true);
    fetch(`/api/merge-preview?tipo=${tipo}&dup=${dup}`)
      .then((r) => r.json())
      .then((d) => { if (vivo) setCont(d.contagens ?? {}); })
      .catch(() => { if (vivo) setCont({}); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [tipo, dup]);

  if (!dup) return null;
  if (carregando) return <p className="sub">Calculando o que será reassociado…</p>;
  const itens = Object.entries(cont ?? {}).filter(([, n]) => n > 0);
  return (
    <div className="dsec" style={{ marginBottom: 0 }}>
      <h4>Será reassociado ao canônico</h4>
      {itens.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {itens.map(([t, n]) => <Pill key={t} tone="blue" dot={false}>{humano(t)}: {n}</Pill>)}
        </div>
      ) : (
        <p className="sub" style={{ margin: 0 }}>Nenhum vínculo filho no duplicado — apenas a desativação/arquivamento.</p>
      )}
    </div>
  );
}

/* Modal genérico --------------------------------------------------------- */
function Modal({ titulo, children, onClose }: { titulo: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-h"><h3>{titulo}</h3></div>
        {children}
      </div>
    </div>
  );
}

/* Assistente — clientes -------------------------------------------------- */
function MergeClienteModal({ cluster }: { cluster: ClienteDuplicadoCluster }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [canonico, setCanonico] = useState("");
  const [duplicado, setDuplicado] = useState("");
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  const membros = cluster.ids.map((id, i) => ({ id, nome: cluster.nomes[i], cpf: cluster.cpfs[i] }));
  const homonimo = cluster.cpfs_distintos > 1;

  function abrir() {
    setAberto(true); setRes(null);
    setCanonico(cluster.ids[0] ?? "");
    setDuplicado(cluster.ids[1] ?? "");
  }
  async function confirmar() {
    setPend(true);
    const r = await mesclarCliente(canonico, duplicado);
    setPend(false); setRes(r);
    if (r.ok) { router.refresh(); setTimeout(() => setAberto(false), 1000); }
  }

  return (
    <>
      <button className="btn sm" onClick={abrir} type="button">Mesclar…</button>
      {aberto && (
        <Modal titulo="Mesclar clientes duplicados" onClose={() => setAberto(false)}>
          <div className="modal-b">
            {homonimo && (
              <div className="banner" style={{ margin: "0 0 14px", borderLeftColor: "var(--red)" }}>
                <span className="ico" style={{ color: "var(--red)" }}>⚠</span>
                <div><b>CPFs distintos neste grupo</b> — forte indício de <b>homônimos</b> (pessoas diferentes). Em geral, <b>NÃO mescle</b>.</div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label>Canônico (mantém)</label>
                <select value={canonico} onChange={(e) => setCanonico(e.target.value)}>
                  {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.cpf ? ` · ${m.cpf}` : " · sem CPF"}</option>)}
                </select>
              </div>
              <div>
                <label>Duplicado (desativa)</label>
                <select value={duplicado} onChange={(e) => { setDuplicado(e.target.value); setRes(null); }}>
                  {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.cpf ? ` · ${m.cpf}` : " · sem CPF"}</option>)}
                </select>
              </div>
            </div>
            <p className="sub" style={{ marginTop: 8 }}>Campos vazios do canônico serão completados pelo duplicado (nunca sobrescreve preenchido). O duplicado fica inativo — não é apagado.</p>
            <Contagens tipo="cliente" dup={duplicado} />
            {res && <div className={`modal-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
          </div>
          <div className="modal-f">
            <button className="btn ghost" type="button" onClick={() => setAberto(false)} disabled={pend}>Fechar</button>
            <button className="btn primary" type="button" onClick={confirmar}
              disabled={pend || !canonico || !duplicado || canonico === duplicado || Boolean(res?.ok)}>
              {pend ? "Mesclando…" : "Confirmar mesclagem"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* Assistente — processos ------------------------------------------------- */
function MergeProcessoModal({ proc }: { proc: ProcessoReconciliacao }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<ProcLite[]>([]);
  const [outro, setOutro] = useState("");
  const [canonicoEhEste, setCanonicoEhEste] = useState(false);
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!aberto || lista.length) return;
    fetch("/api/processos-lite").then((r) => r.json()).then((d) => setLista((d.processos ?? []).filter((x: ProcLite) => x.id !== proc.id))).catch(() => {});
  }, [aberto, lista.length, proc.id]);

  const outroProc = lista.find((x) => x.id === outro);
  // por padrão "este" (registro-só) é o duplicado e o outro (com CNJ) é o canônico
  const canonico = canonicoEhEste ? proc.id : outro;
  const duplicado = canonicoEhEste ? outro : proc.id;
  const segredoEnvolvido = proc.segredo_justica || Boolean(outroProc?.segredo);

  function abrir() { setAberto(true); setRes(null); setOutro(""); setCanonicoEhEste(false); }
  async function confirmar() {
    setPend(true);
    const r = await mesclarProcesso(canonico, duplicado);
    setPend(false); setRes(r);
    if (r.ok) { router.refresh(); setTimeout(() => setAberto(false), 1000); }
  }

  return (
    <>
      <button className="btn sm" onClick={abrir} type="button">Mesclar…</button>
      {aberto && (
        <Modal titulo="Mesclar / reconciliar processo" onClose={() => setAberto(false)}>
          <div className="modal-b">
            {segredoEnvolvido && (
              <div className="banner" style={{ margin: "0 0 14px", borderLeftColor: "var(--amber)" }}>
                <span className="ico" style={{ color: "var(--amber)" }}>⚠</span>
                <div><b>Segredo de justiça envolvido</b> — confira o sigilo antes de mesclar.</div>
              </div>
            )}
            <div className="field" style={{ marginBottom: 10 }}>
              <div className="k">Este registro (sem CNJ)</div>
              <div className="v mono">{proc.numero_registro_tribunal ?? "—"} · {proc.tribunal ?? "—"} {proc.segredo_justica && <SegredoTag on />}</div>
              {proc.clientes && <div className="sub">{proc.clientes}</div>}
            </div>
            <div>
              <label>Processo correspondente (com CNJ)</label>
              <select value={outro} onChange={(e) => { setOutro(e.target.value); setRes(null); }}>
                <option value="">Selecione…</option>
                {lista.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" checked={canonicoEhEste} onChange={(e) => setCanonicoEhEste(e.target.checked)} style={{ width: "auto" }} />
              Manter ESTE como canônico (por padrão, o canônico é o que já tem CNJ)
            </label>
            <p className="sub" style={{ marginTop: 8 }}>
              Canônico: <b>{canonicoEhEste ? "este registro" : (outroProc?.label ?? "—")}</b>.
              Se o canônico não tiver CNJ, ele é completado a partir do duplicado (não cria outro). Duplicado vira <b>arquivado</b>.
            </p>
            <Contagens tipo="processo" dup={duplicado === proc.id ? proc.id : outro} />
            {res && <div className={`modal-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
          </div>
          <div className="modal-f">
            <button className="btn ghost" type="button" onClick={() => setAberto(false)} disabled={pend}>Fechar</button>
            <button className="btn primary" type="button" onClick={confirmar}
              disabled={pend || !outro || Boolean(res?.ok)}>
              {pend ? "Mesclando…" : "Confirmar mesclagem"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* Tela ------------------------------------------------------------------- */
export function DuplicadosView({ clusters, processos }: { clusters: ClienteDuplicadoCluster[]; processos: ProcessoReconciliacao[] }) {
  const [aba, setAba] = useState("clientes");
  const abas = [
    { id: "clientes", label: `Clientes (${clusters.length})` },
    { id: "processos", label: `Processos sem CNJ (${processos.length})` },
  ];

  return (
    <>
      <Chips options={abas} value={aba} onChange={setAba} />

      {aba === "clientes" ? (
        <div className="card">
          <div className="card-b flush">
            {clusters.length ? (
              <table>
                <thead>
                  <tr><th>Nome</th><th className="center">Registros</th><th>CPFs no grupo</th><th className="center">Sinal</th><th className="right">Ação</th></tr>
                </thead>
                <tbody>
                  {clusters.map((c) => {
                    const homonimo = c.cpfs_distintos > 1;
                    return (
                      <tr key={c.nome_normalizado}>
                        <td>
                          <div className="name">{c.nomes[0]}</div>
                          <div className="sub">{c.nomes.join(" · ")}</div>
                        </td>
                        <td className="center mono">{c.qtd}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{c.cpfs.map((x) => x ?? "—").join(" · ")}</td>
                        <td className="center">
                          {homonimo
                            ? <Pill tone="red">homônimo?</Pill>
                            : c.algum_com_cpf ? <Pill tone="amber">revisar</Pill> : <Pill tone="gray" dot={false}>sem CPF</Pill>}
                        </td>
                        <td className="right"><MergeClienteModal cluster={c} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty">Nenhum cliente duplicado por nome. 🎉</div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-b flush">
            {processos.length ? (
              <table>
                <thead>
                  <tr><th>Registro</th><th>Tribunal / UF</th><th>Área</th><th>Cliente(s)</th><th>Criado</th><th className="right">Ação</th></tr>
                </thead>
                <tbody>
                  {processos.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.numero_registro_tribunal ?? "—"} {p.segredo_justica && <SegredoTag on />}</td>
                      <td>{[p.tribunal, p.uf].filter(Boolean).join(" · ") || "—"}</td>
                      <td><Pill tone="gray" dot={false}>{humano(p.area)}</Pill></td>
                      <td className="sub">{p.clientes ?? "—"}</td>
                      <td className="mono">{fmtDate(p.criado_em)}</td>
                      <td className="right"><MergeProcessoModal proc={p} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">Nenhum processo sem CNJ para reconciliar. 🎉</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

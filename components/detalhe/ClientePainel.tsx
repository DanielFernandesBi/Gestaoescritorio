"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ProcRef, SegredoTag } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { ExecucaoCliente } from "@/components/detalhe/ExecucaoCliente";
import { DocumentosCaso } from "@/components/detalhe/DocumentosCaso";
import { atualizarCliente, desativarCliente, criarTarefa, criarEstudo } from "@/app/actions";
import { SITUACAO_PRISIONAL, PRIORIDADES, RESPONSAVEIS, ESTUDO_TIPO } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type {
  ClienteFull, Cliente, Anotacao, ClienteProcMini,
  ExecucaoCliente as TExec, Documento,
} from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const NoteIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);
const PlusIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
);
const Scale = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v18M5 8l7-5 7 5M5 8v8l7 5 7-5V8" /></svg>
);
const Spark = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const idadeDe = (iso: string | null): number | null => {
  if (!iso) return null;
  const b = new Date(iso + "T12:00:00Z"), hoje = new Date();
  let a = hoje.getUTCFullYear() - b.getUTCFullYear();
  const m = hoje.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getUTCDate() < b.getUTCDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};
const mascararCpf = (cpf: string | null): string => {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return cpf || "—";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
};
const mesAno = (iso: string | null): string | null =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "") : null;

// Tom da situação prisional.
const sitTone = (s: string | null): "green" | "amber" | "red" => {
  if (s === "solto" || s === "regime_aberto") return "green";
  if (s === "foragido" || s === "preso_provisorio" || s === "preso_definitivo" || s === "falecido") return "red";
  return "amber";
};
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const reais = (n: number) => `R$ ${n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n.toFixed(0)}`;

// Linkifica o 1º telefone "discável" (≥8 dígitos, sem máscara) num texto livre.
function Telefonavel({ texto }: { texto: string }) {
  const m = texto.match(/(\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4})/);
  if (!m || m.index === undefined) return <>{texto}</>;
  const tel = m[1].replace(/\D/g, "");
  return (
    <>
      {texto.slice(0, m.index)}
      <a className="proc-link" href={`tel:${tel}`}>{m[1]}</a>
      {texto.slice(m.index + m[1].length)}
    </>
  );
}

const polo = (p: ClienteProcMini) => p.papel ? humano(p.papel) : "parte";
const classeObjeto = (p: ClienteProcMini) =>
  [p.classe ? humano(p.classe) : (p.area ? humano(p.area) : "Processo"), p.area && p.classe ? humano(p.area) : null]
    .filter(Boolean).join(" · ");

/* ── seção rotulada ──────────────────────────────────────────────────────── */
function Sec({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="audp-sec">
      <div className="audp-sech">{titulo}{sub && <span className="cli-sech-sub">{sub}</span>}{extra}</div>
      {children}
    </div>
  );
}

/* ── master: card de cliente ─────────────────────────────────────────────── */
function MasterCard({ c, ativo }: { c: Cliente; ativo: boolean }) {
  return (
    <Link className={`cli-mcard${ativo ? " on" : ""}`} href={linkPara("cliente", c.id)}>
      <div className="cli-mnome">{c.nome}</div>
      <div className="cli-mmeta">
        <span className={`cli-dot ${sitTone(c.situacao_prisional)}`} />
        {humano(c.situacao_prisional)} · {c.processos_ativos} processo{c.processos_ativos === 1 ? "" : "s"}
      </div>
      {c.cpf && <div className="cli-mcpf mono">CPF {mascararCpf(c.cpf)}</div>}
    </Link>
  );
}

/* ── editar cliente ──────────────────────────────────────────────────────── */
function EditarCliente({ p }: { p: ClienteFull }) {
  return (
    <FormModal
      label={<><PenIco /> Editar cliente</>}
      titulo="Editar cliente"
      descricao="Altere os dados cadastrais. Nada é apagado — tudo auditado."
      acao={atualizarCliente.bind(null, p.id)}
      enviarLabel="Salvar"
      variant="default"
    >
      <div><label>Nome</label><input name="nome" required defaultValue={p.nome} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>CPF</label><input name="cpf" defaultValue={p.cpf ?? ""} /></div>
        <div><label>RG</label><input name="rg" defaultValue={p.rg ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div><label>Situação prisional</label><select name="situacao_prisional" defaultValue={p.situacao_prisional ?? "solto"}>{SITUACAO_PRISIONAL.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
        <div><label>UF</label><input name="uf" maxLength={2} defaultValue={p.uf ?? ""} /></div>
      </div>
      <div><label>Unidade prisional</label><input name="unidade_prisional" defaultValue={p.unidade_prisional ?? ""} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Telefone</label><input name="telefone" defaultValue={p.telefone ?? ""} /></div>
        <div><label>E-mail</label><input name="email" defaultValue={p.email ?? ""} /></div>
      </div>
      <div><label>Contato da família</label><input name="contato_familia" defaultValue={p.contato_familia ?? ""} /></div>
      <div><label>Observações</label><textarea name="observacoes" defaultValue={p.observacoes ?? ""} /></div>
    </FormModal>
  );
}

/* ── nova tarefa (cabeçalho) ─────────────────────────────────────────────── */
function NovaTarefa({ p }: { p: ClienteFull }) {
  return (
    <FormModal
      label={<><PlusIco /> Nova tarefa</>}
      titulo="Nova tarefa do cliente"
      descricao="Cria uma tarefa já vinculada a este cliente."
      acao={criarTarefa}
      enviarLabel="Criar tarefa"
      variant="default"
    >
      <input type="hidden" name="cliente_id" defaultValue={p.id} />
      <input type="hidden" name="processo_id" defaultValue={p.processos[0]?.id ?? ""} />
      <div><label>Título</label><input name="titulo" required placeholder={`Ex.: Diligência — ${p.nome}`} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Prioridade</label><select name="prioridade" defaultValue="media">{PRIORIDADES.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div><label>Prazo (data limite)</label><input type="date" name="data_limite" /></div>
      <div><label>Descrição</label><textarea name="descricao" placeholder="Detalhes da tarefa." /></div>
    </FormModal>
  );
}

type Tab = "consolidado" | "processos" | "execucao" | "estudos" | "financeiro" | "documentos" | "notas";
const TABS: { id: Tab; label: string }[] = [
  { id: "consolidado", label: "Consolidado" },
  { id: "processos", label: "Processos" },
  { id: "execucao", label: "Execução" },
  { id: "estudos", label: "Estudo de execução" },
  { id: "financeiro", label: "Financeiro" },
  { id: "documentos", label: "Documentos" },
  { id: "notas", label: "Notas" },
];

/* Criar estudo de caso já vinculado ao cliente. */
function CriarEstudo({ p }: { p: ClienteFull }) {
  return (
    <FormModal
      label={<><PlusIco /> Criar estudo de caso</>}
      titulo="Novo estudo de caso"
      descricao="Cria um estudo de execução/estratégia já vinculado a este cliente."
      acao={criarEstudo}
      enviarLabel="Criar estudo"
      variant="default"
    >
      <input type="hidden" name="cliente_id" defaultValue={p.id} />
      <div><label>Título</label><input name="titulo" required placeholder="Ex.: Progressão e livramento na pena unificada" /></div>
      <div><label>Tipo</label><select name="tipo" defaultValue="execucao_global">{ESTUDO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
      <div><label>Diagnóstico · estratégia geral</label><textarea name="conteudo" placeholder="Visão geral da estratégia." /></div>
    </FormModal>
  );
}

/* ── blocos reutilizados ─────────────────────────────────────────────────── */
function ProcessosBloco({ p, tab, setTab }: { p: ClienteFull; tab: Tab; setTab: (t: Tab) => void }) {
  const lista = tab === "processos" ? p.processos : p.processos.slice(0, 2);
  const resto = p.processos.length - lista.length;
  return (
    <Sec titulo="Processos vinculados" extra={<span className="audp-count">{p.processos.length}</span>}>
      {p.processos.length === 0 ? (
        <div className="audp-empty">Sem processos vinculados.</div>
      ) : (
        <div className="przp-stack">
          {lista.map((pr) => (
            <div className="przp-origem" key={pr.id}>
              <span className="pz-tag cat-slate">{polo(pr)}</span>
              <div className="mid">
                <div className="t">{classeObjeto(pr)}{pr.segredo && <> <SegredoTag on /></>}</div>
                <div className="s mono">
                  {(pr.numero_cnj || pr.numero_registro)
                    ? <ProcRef cnj={pr.numero_cnj} registro={pr.numero_registro} id={pr.id} />
                    : "sem CNJ"}
                  {pr.vara_comarca ? ` · ${pr.vara_comarca}` : pr.tribunal ? ` · ${pr.tribunal}` : ""}
                </div>
              </div>
              <Link className="btn sm" href={linkPara("processo", pr.id)}>Abrir</Link>
            </div>
          ))}
          {resto > 0 && (
            <button type="button" className="cli-vertodos" onClick={() => setTab("processos")}>
              + {resto} processo{resto === 1 ? "" : "s"} · ver todos na aba Processos
            </button>
          )}
        </div>
      )}
    </Sec>
  );
}

function ExecBloco({ p }: { p: ClienteFull }) {
  const e = p.exec;
  if (!e) return null;
  const prog = e.dias_para_progressao;
  const livr = e.dias_para_livramento;
  const txt = (d: number | null) => d == null ? "—" : d < 0 ? `vencida ${d} d` : `em ${d} d`;
  return (
    <Sec titulo="Execução penal" sub="vw_situacao_executoria_atual">
      <div className="cli-exec">
        <div className="cli-exec-grid">
          <div className="fld"><div className="k">Regime atual</div><div className="v">{humano(e.regime_atual)}</div></div>
          <div className="fld"><div className="k">Pena unificada</div><div className="v mono">{e.pena_total_texto ?? "—"}</div></div>
          <div className="fld"><div className="k">Progressão</div><div className="v mono" style={{ color: prog != null && prog < 0 ? "var(--red)" : "var(--text)", fontWeight: 600 }}>{txt(prog)}</div></div>
          <div className="fld"><div className="k">Livramento</div><div className="v mono">{txt(livr)}</div></div>
        </div>
        <div className="cli-exec-foot">Snapshot mais recente · atestado de {fmtDate(e.data_atestado)} (SEEU). Cada atestado é uma linha datada — nunca sobrescrita.</div>
      </div>
    </Sec>
  );
}

function EstudosBloco({ p }: { p: ClienteFull }) {
  return (
    <Sec titulo="Estudo de execução" extra={<><span className="audp-count">{p.estudos.length}</span><span className="cli-sech-acao"><CriarEstudo p={p} /></span></>}>
      {p.estudos.length === 0 ? (
        <div className="przp-empty-row">
          <span>Nenhum estudo de execução para este cliente.</span>
          <CriarEstudo p={p} />
        </div>
      ) : (
        <div className="przp-stack">
          {p.estudos.map((e) => (
            <div className="przp-origem" key={e.id}>
              <span className="pz-tag cowork"><Spark s={9} />{e.tipo ? humano(e.tipo) : "estudo"}</span>
              <div className="mid">
                <div className="t">{e.titulo}</div>
                <div className="s">{e.status ? humano(e.status) : "—"}</div>
              </div>
              <Link className="btn sm" href={linkPara("estudo", e.id)}>Abrir</Link>
            </div>
          ))}
        </div>
      )}
    </Sec>
  );
}

function FinanceiroBloco({ p }: { p: ClienteFull }) {
  return (
    <Sec titulo="Financeiro" sub="contratos · pagamentos">
      {p.contratos.length === 0 ? (
        <div className="audp-empty">Sem contratos vinculados.</div>
      ) : (
        <div className="przp-stack">
          {p.contratos.map((c) => (
            <div className="przp-origem" key={c.id}>
              <span className={`pz-tag ${c.status === "vigente" ? "val" : c.status === "inadimplente" ? "preso" : "cat-neutral"}`}>{humano(c.status)}</span>
              <div className="mid">
                <div className="t">{c.objeto || "Contrato"}</div>
                <div className="s">{c.contratante ? `contratante: ${c.contratante}` : "—"}{c.valor_total ? ` · total ${reais(c.valor_total)}` : ""}</div>
              </div>
              {c.valor_aberto > 0 && (
                <div className="cli-fin-valor">
                  <div className="v">{reais(c.valor_aberto)} aberto</div>
                  {c.prox_venc && <div className="s">próx. {ddmm(c.prox_venc)}</div>}
                </div>
              )}
              <Link className="btn sm" href={linkPara("contrato", c.id)}>Abrir</Link>
            </div>
          ))}
        </div>
      )}
    </Sec>
  );
}

/* ── componente principal ────────────────────────────────────────────────── */
export function ClientePainel({
  p, lista, anotacoes, exec, documentos,
}: {
  p: ClienteFull; lista: Cliente[]; anotacoes: Anotacao[]; exec: TExec; documentos: Documento[];
}) {
  const [tab, setTab] = useState<Tab>("consolidado");
  const [busca, setBusca] = useState("");
  const [verNotas, setVerNotas] = useState(false);

  const idade = idadeDe(p.data_nascimento);
  const desde = mesAno(p.criado_em);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    const qd = q.replace(/\D/g, "");
    return lista.filter((c) =>
      c.nome.toLowerCase().includes(q) || (qd && (c.cpf ?? "").replace(/\D/g, "").includes(qd)),
    );
  }, [lista, busca]);

  const ver = (t: Tab) => tab === "consolidado" || tab === t;
  const abrirNotas = () => { setTab("notas"); setVerNotas(true); };

  return (
    <div className="audp">
      {/* MASTER */}
      <aside className="audp-master">
        <div className="audp-master-h">
          <h1>Clientes</h1>
          <input
            className="cli-busca"
            placeholder="Buscar nome, CPF, processo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="audp-master-list">
          {filtrados.length === 0
            ? <div className="audp-empty">Nenhum cliente.</div>
            : filtrados.map((c) => <MasterCard key={c.id} c={c} ativo={c.id === p.id} />)}
        </div>
      </aside>

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/clientes">← Clientes</Link>
          <nav className="cli-tabs">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={`cli-tab${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </nav>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* cabeçalho do perfil */}
            <div className="audp-title-row">
              <div className="audp-title-l">
                <div className="audp-tags">
                  <span className={`pz-tag ${sitTone(p.situacao_prisional) === "green" ? "val" : sitTone(p.situacao_prisional) === "red" ? "preso" : "tang"}`}>{humano(p.situacao_prisional)}</span>
                  {p.exec && <span className="pz-tag cat-neutral">execução penal ativa</span>}
                  {p.favorito && <span className="pz-tag cowork">★ favorito</span>}
                </div>
                <h2 className="audp-h2 nome-cliente">{p.nome}</h2>
                <div className="audp-cliline">
                  <span className="mono">CPF {mascararCpf(p.cpf)}</span>
                  {idade != null && <span className="cli-sep">· {idade} anos</span>}
                  {desde && <span className="cli-sep">· cliente desde {desde}</span>}
                </div>
              </div>
              <div className="cli-head-actions">
                <NovaTarefa p={p} />
                <button type="button" className="btn default" onClick={abrirNotas}><NoteIco /> Nota datada</button>
              </div>
            </div>

            {/* BLOCO 1 · CONSOLIDADO */}
            {ver("consolidado") && (
              <Sec titulo="Consolidado" sub="vw_situacao_cliente">
                <div className="cli-kpis">
                  <div className="cli-kpi"><div className="n">{p.processos_ativos}</div><div className="l">processos ativos</div></div>
                  <div className="cli-kpi"><div className={`n${p.prazos_vencidos > 0 ? " red" : ""}`}>{p.prazos_abertos}</div><div className="l">prazos abertos{p.prazos_vencidos > 0 && <> · <span className="red">{p.prazos_vencidos} vencido{p.prazos_vencidos === 1 ? "" : "s"}</span></>}</div></div>
                  <div className="cli-kpi"><div className="n">{p.tarefas_pendentes}</div><div className="l">tarefas pendentes</div></div>
                  <div className="cli-kpi"><div className="n">{p.audiencias_futuras}</div><div className="l">audiência{p.audiencias_futuras === 1 ? "" : "s"} designada{p.audiencias_futuras === 1 ? "" : "s"}</div></div>
                </div>
              </Sec>
            )}

            {/* BLOCO 2 · DADOS PESSOAIS */}
            {ver("consolidado") && (
              <Sec titulo="Dados pessoais">
                <div className="audp-dados">
                  <div className="fld"><div className="k">CPF</div><div className="v mono">{mascararCpf(p.cpf)}</div></div>
                  <div className="fld"><div className="k">Nascimento</div><div className="v">{p.data_nascimento ? `${fmtDate(p.data_nascimento)}${idade != null ? ` · ${idade} anos` : ""}` : "—"}</div></div>
                  <div className="fld"><div className="k">Situação prisional</div><div className="v" style={{ color: `var(--${sitTone(p.situacao_prisional) === "green" ? "green" : sitTone(p.situacao_prisional) === "red" ? "red" : "amber"})`, fontWeight: 600 }}>{humano(p.situacao_prisional)}</div></div>
                  <div className="fld"><div className="k">Unidade prisional</div><div className="v">{p.unidade_prisional ?? "—"}</div></div>
                  <div className="fld"><div className="k">Contato da família</div><div className="v">{p.contato_familia ? <Telefonavel texto={p.contato_familia} /> : "—"}</div></div>
                  <div className="fld"><div className="k">Responsável</div><div className="v">{p.responsavel ?? "—"}</div></div>
                </div>
                {p.observacoes && (
                  <div className="cli-obs">
                    <div className="k">Observações</div>
                    <p>{p.observacoes}</p>
                  </div>
                )}
              </Sec>
            )}

            {/* BLOCO 3 · IDENTIDADE ÚNICA (IA) */}
            {ver("consolidado") && (
              <div className="audp-ia">
                <div className="audp-ia-h"><Spark /><span>Identidade única · resolvida pela IA</span></div>
                <div className="cli-ia-grid">
                  <div className="fld"><div className="k">Nome normalizado</div><div className="v mono" style={{ color: "var(--accent-strong)" }}>{p.nome_normalizado ?? "—"}</div></div>
                  <div className="fld"><div className="k">Chave de dedução</div><div className="v">nome_normalizado + CPF</div></div>
                </div>
                <div className="audp-ia-note">
                  Casado por <span className="mono">nome_normalizado</span> (sem acento · maiúsculas · espaços colapsados) + CPF — <b>sem duplicata</b>.
                  O índice é não-único de propósito: homônimos legítimos são permitidos só após triagem humana. <b>Nome sempre visível</b>,
                  inclusive em processos sob segredo de justiça — é sistema interno.
                </div>
              </div>
            )}

            {/* BLOCO 4 · EXECUÇÃO PENAL (resumo) */}
            {ver("consolidado") && <ExecBloco p={p} />}

            {/* BLOCO 5 · PROCESSOS VINCULADOS */}
            {(tab === "consolidado" || tab === "processos") && <ProcessosBloco p={p} tab={tab} setTab={setTab} />}

            {/* BLOCO 6 · PRAZOS ABERTOS */}
            {ver("consolidado") && p.prazos.length > 0 && (
              <Sec titulo="Prazos abertos" extra={<span className="audp-count">{p.prazos.length}</span>}>
                <div className="przp-stack">
                  {p.prazos.map((pr) => (
                    <div className={`cli-prazo${pr.dias < 0 ? " venc" : pr.dias <= 2 ? " crit" : ""}`} key={pr.id}>
                      <div className="mid">
                        <div className="t">{pr.ato.split(/\s*[—–[]/)[0].trim()}</div>
                        <div className="s">{pr.validado ? "validado" : "interna provisória"}{pr.data_interna ? ` · interna ${ddmm(pr.data_interna)}` : ""}</div>
                      </div>
                      <div className={`cli-prazo-dias ${pr.dias < 0 ? "red" : pr.dias <= 2 ? "red" : "amber"}`}>
                        <div className="d">{pr.dias < 0 ? `−${Math.abs(pr.dias)} d` : `${pr.dias} d`}</div>
                        <div className="f">fatal {ddmm(pr.data_fatal)}</div>
                      </div>
                      <Link className="btn sm" href={linkPara("prazo", pr.id)}>Abrir</Link>
                    </div>
                  ))}
                </div>
              </Sec>
            )}

            {/* BLOCO 7 · FINANCEIRO */}
            {(tab === "consolidado" || tab === "financeiro") && <FinanceiroBloco p={p} />}

            {/* BLOCO 8 · ESTUDO DE EXECUÇÃO */}
            {(tab === "consolidado" || tab === "execucao" || tab === "estudos") && <EstudosBloco p={p} />}

            {/* EXECUÇÃO — visão completa (aba) */}
            {tab === "execucao" && (
              <div className="audp-sec cli-exec-full">
                <ExecucaoCliente exec={exec} clienteId={p.id} situacaoAtual={p.situacao_prisional} />
              </div>
            )}

            {/* DOCUMENTOS (aba) */}
            {tab === "documentos" && (
              <div className="audp-sec">
                <DocumentosCaso documentos={documentos} vinculo={{ campo: "cliente_id", id: p.id }} />
              </div>
            )}

            {/* BLOCO 9 · AUDIÊNCIAS FUTURAS */}
            {ver("consolidado") && (
              <Sec titulo="Audiências futuras" extra={<span className="audp-count">{p.audiencias.length}</span>}>
                {p.audiencias.length === 0 ? (
                  <div className="przp-empty-row">
                    <span>Sem audiências futuras designadas.</span>
                    <Link className="btn sm" href="/audiencias">Nova audiência</Link>
                  </div>
                ) : (
                  <div className="przp-stack">
                    {p.audiencias.map((a) => (
                      <div className="przp-origem" key={a.id}>
                        <span className="pz-tag cat-blue">{humano(a.tipo)}</span>
                        <div className="mid">
                          <div className="t">{a.nome?.trim() || humano(a.tipo)}</div>
                          <div className="s">{humano(a.modalidade)}</div>
                        </div>
                        <div className="cli-aud-when mono">{ddmm(a.data_hora)}</div>
                        <Link className="btn sm" href={linkPara("audiencia", a.id)}>Abrir</Link>
                      </div>
                    ))}
                  </div>
                )}
              </Sec>
            )}

            {/* NOTAS (aba dedicada ou bloco no consolidado via botão) */}
            {(tab === "notas" || (verNotas && tab === "consolidado")) && (
              <Sec titulo="Anotações" extra={<span className="audp-count">{anotacoes.length}</span>}>
                <Anotacoes entidadeTipo="cliente" entidadeId={p.id} notas={anotacoes} />
              </Sec>
            )}

            {/* EDITAR / ARQUIVAR */}
            {ver("consolidado") && (
              <>
                <div className="audp-status">
                  <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Editar / arquivar</div>
                  <EditarCliente p={p} />
                  <button type="button" className={`btn default${verNotas || tab === "notas" ? " on" : ""}`} onClick={abrirNotas}>
                    <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
                  </button>
                  {p.ativo && (
                    <Acao
                      label="Inativar"
                      variant="danger"
                      titulo="Inativar cliente"
                      confirmarLabel="Inativar"
                      resumo={<>O cliente <b>não é apagado</b> — fica inativo (some das listas, mantido no banco e auditado). Confirmar?</>}
                      acao={() => desativarCliente(p.id)}
                    />
                  )}
                </div>
                <div className="audp-status-note">Inativar é troca de status — nunca DELETE. O histórico de execução e contratos permanece. Tudo auditado.</div>
              </>
            )}
          </div>
        </div>

        {/* action bar */}
        <div className="audp-actionbar">
          <button type="button" className="btn primary" onClick={() => setTab("execucao")}><Scale /> Abrir execução penal</button>
          <button type="button" className="btn default" onClick={() => setTab("execucao")}>Lançar atestado de pena</button>
          <button type="button" className="btn default" onClick={() => setTab("financeiro")}>Contratos</button>
          <button type="button" className="btn default" onClick={abrirNotas}><NoteIco /> Nota datada</button>
        </div>
      </section>
    </div>
  );
}

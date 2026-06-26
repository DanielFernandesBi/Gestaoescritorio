"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ProcRef } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { DocumentosCaso } from "@/components/detalhe/DocumentosCaso";
import { CriarCompromisso } from "@/components/CriarCompromisso";
import {
  criarAndamento, criarPrazo, atualizarProcesso, arquivarProcesso, vincularClienteProcesso, reanalisarPecas,
} from "@/app/actions";
import {
  ANDAMENTO_TIPO, ANDAMENTO_ORIGEM, TIPO_CONTAGEM, RESPONSAVEIS,
  PROCESSO_INSTANCIA, PROCESSO_AREA, PROCESSO_STATUS, PAPEL,
} from "@/lib/enums";
import { humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { Processo, ProcessoFull, Anotacao } from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Spark = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>
);
const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const NoteIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);
const PlusIco = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>);
const ClockIco = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const curto = (s: string) => { const t = (s ?? "").split(/\s*[—–[]| · |\. /)[0].trim(); return t.length > 64 ? t.slice(0, 62) + "…" : t; };
const num = (p: { numero_cnj: string | null; numero_registro: string | null }) => p.numero_cnj ?? (p.numero_registro ? `reg ${p.numero_registro}` : null);
const statusTone = (s: string) => s === "ativo" ? "val" : s === "arquivado" || s === "baixado" ? "cat-neutral" : "tone-amber";

/* ── seção rotulada ──────────────────────────────────────────────────────── */
function Sec({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="audp-sec">
      <div className="audp-sech">{titulo}{sub && <span className="cli-sech-sub">{sub}</span>}{extra}</div>
      {children}
    </div>
  );
}
/** Card de vínculo genérico (lista). */
function Item({ tag, tagTone = "cat-slate", titulo, sub, href, dias }: { tag: string; tagTone?: string; titulo: ReactNode; sub?: ReactNode; href: string; dias?: number | null }) {
  return (
    <div className="przp-origem">
      <span className={`pz-tag ${tagTone}`}>{tag}</span>
      <div className="mid"><div className="t">{titulo}</div>{sub && <div className="s">{sub}</div>}</div>
      {dias != null && <span className={`proc-dias ${dias < 0 ? "red" : dias <= 2 ? "red" : dias <= 5 ? "amber" : "tang"}`}>{dias < 0 ? `−${Math.abs(dias)}d` : `${dias}d`}</span>}
      <Link className="btn sm abrir" href={href}>Abrir</Link>
    </div>
  );
}

/* ── master ──────────────────────────────────────────────────────────────── */
function MasterCard({ p, ativo }: { p: Processo; ativo: boolean }) {
  return (
    <Link className={`audp-mcard cli-mcard${ativo ? " on" : ""}`} href={linkPara("processo", p.id)}>
      <div className="cli-mnome">{p.segredo ? "Segredo de justiça" : (p.clientes || "Processo")}</div>
      {num(p) && <div className="cli-mcpf mono">{num(p)}</div>}
      <div className="cli-mmeta">{[p.classe ? humano(p.classe) : (p.area ? humano(p.area) : null), p.tribunal].filter(Boolean).join(" · ") || "—"}</div>
    </Link>
  );
}

/* ── editar processo ─────────────────────────────────────────────────────── */
function EditarProcesso({ p }: { p: ProcessoFull }) {
  return (
    <FormModal label={<><PenIco /> Editar processo</>} titulo="Editar processo" descricao="Altere dados, classe, tribunal ou status. Só grava os campos preenchidos." acao={atualizarProcesso.bind(null, p.id)} enviarLabel="Salvar" variant="default">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Número CNJ</label><input name="numero_cnj" defaultValue={p.numero_cnj ?? ""} /></div>
        <div><label>Registro do tribunal</label><input name="numero_registro_tribunal" defaultValue={p.numero_registro ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Tribunal</label><input name="tribunal" defaultValue={p.tribunal ?? ""} /></div>
        <div><label>Vara / comarca</label><input name="vara_comarca" defaultValue={p.vara_comarca ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div><label>UF</label><input name="uf" maxLength={2} defaultValue={p.uf ?? ""} /></div>
        <div><label>Instância</label><select name="instancia" defaultValue={p.instancia ?? ""}><option value="">—</option>{PROCESSO_INSTANCIA.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}</select></div>
        <div><label>Área</label><select name="area" defaultValue={p.area ?? ""}><option value="">—</option>{PROCESSO_AREA.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Classe</label><input name="classe" defaultValue={p.classe ?? ""} /></div>
        <div><label>Assunto</label><input name="assunto" defaultValue={p.assunto ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div><label>Fase</label><input name="fase" defaultValue={p.fase ?? ""} /></div>
        <div><label>Status</label><select name="status" defaultValue={p.status}>{PROCESSO_STATUS.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div><label>Link do tribunal</label><input name="link_tribunal" defaultValue={p.link_tribunal ?? ""} placeholder="URL do processo no PJe/eproc…" /></div>
      <div><label>Observações</label><textarea name="observacoes" defaultValue={p.observacoes ?? ""} /></div>
      <label className="proc-check"><input type="checkbox" name="segredo_justica" defaultChecked={p.segredo} /> Segredo de justiça</label>
    </FormModal>
  );
}

/* ── ações do cabeçalho ──────────────────────────────────────────────────── */
function RegistrarAndamento({ p }: { p: ProcessoFull }) {
  return (
    <FormModal label={<><PlusIco /> Registrar andamento</>} titulo="Registrar andamento" descricao="Movimentação informativa do processo." acao={criarAndamento} enviarLabel="Registrar" variant="default">
      <input type="hidden" name="processo_id" defaultValue={p.id} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Tipo</label><select name="tipo" defaultValue="movimentacao_tribunal">{ANDAMENTO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Data</label><input type="date" name="data" /></div>
      </div>
      <div><label>Origem</label><select name="origem" defaultValue="tribunal"><option value="">—</option>{ANDAMENTO_ORIGEM.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}</select></div>
      <div><label>Descrição / teor</label><textarea name="descricao" required placeholder="Teor da movimentação." /></div>
    </FormModal>
  );
}
function NovoPrazo({ p }: { p: ProcessoFull }) {
  return (
    <FormModal label={<><ClockIco /> Novo prazo</>} titulo="Novo prazo" descricao="Prazo penal em dias corridos (CPP art. 798). Nasce provisório (a validar)." acao={criarPrazo} enviarLabel="Criar prazo" variant="default">
      <input type="hidden" name="processo_id" defaultValue={p.id} />
      <div><label>Ato</label><input name="ato" required placeholder="Ex.: Razões de apelação" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Data fatal</label><input type="date" name="data_fatal" required /></div>
        <div><label>Data interna</label><input type="date" name="data_interna" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Contagem</label><select name="tipo_contagem" defaultValue="corridos">{TIPO_CONTAGEM.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
    </FormModal>
  );
}

/* ── componente principal ────────────────────────────────────────────────── */
export function ProcessoPainel({ p, lista, anotacoes }: { p: ProcessoFull; lista: Processo[]; anotacoes: Anotacao[] }) {
  const [busca, setBusca] = useState("");
  const [verNotas, setVerNotas] = useState(false);
  const [clis, setClis] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/clientes-lite").then((r) => r.json()).then((d) => vivo && setClis(d.clientes ?? [])).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    const qd = q.replace(/\D/g, "");
    return lista.filter((x) =>
      (x.clientes ?? "").toLowerCase().includes(q) ||
      (qd && ((x.numero_cnj ?? "").replace(/\D/g, "").includes(qd) || (x.numero_registro ?? "").replace(/\D/g, "").includes(qd))));
  }, [lista, busca]);

  const titulo = p.segredo ? "Processo em segredo de justiça" : (p.clientes || "Processo sem partes");
  const ativo = p.status === "ativo";

  const VincularCliente = ({ label = "Vincular cliente", variant = "primary" as "primary" | "default" }) => (
    <FormModal label={label} titulo="Vincular cliente ao processo" descricao="A IA tenta casar por nome normalizado + CPF; na dúvida, abre tarefa de conferência em vez de criar às cegas." acao={vincularClienteProcesso.bind(null, p.id)} enviarLabel="Vincular" variant={variant}>
      <div><label>Cliente</label><select name="cliente_id" required defaultValue=""><option value="" disabled>Selecione…</option>{clis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
      <div><label>Papel</label><select name="papel" defaultValue="reu">{PAPEL.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
    </FormModal>
  );

  return (
    <div className="audp">
      {/* MASTER */}
      <aside className="audp-master">
        <div className="audp-master-h">
          <h1>Processos</h1>
          <input className="cli-busca" placeholder="Buscar CNJ, registro, cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="audp-master-list">
          {filtrados.length === 0 ? <div className="audp-empty">Nenhum processo.</div>
            : filtrados.map((x) => <MasterCard key={x.id} p={x} ativo={x.id === p.id} />)}
        </div>
      </aside>

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top"><Link className="audp-back" href="/processos">← Processos</Link></div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* cabeçalho */}
            <div className="audp-title-row">
              <div className="audp-title-l">
                <div className="audp-tags">
                  <span className={`pz-tag ${statusTone(p.status)}`}>{humano(p.status)}</span>
                  {p.classe && <span className="pz-tag cat-blue">{humano(p.classe)}</span>}
                  {p.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
                  {p.cadastro_automatico && <span className="pz-tag cowork"><Spark s={9} />cadastro automático</span>}
                </div>
                <h2 className="audp-h2">{titulo}</h2>
                <div className="audp-cliline"><ProcRef cnj={p.numero_cnj} registro={p.numero_registro} id={p.id} /></div>
              </div>
              <div className="proc-head-actions">
                <RegistrarAndamento p={p} />
                <NovoPrazo p={p} />
                <CriarCompromisso processoId={p.id} />
              </div>
            </div>

            {p.merged_into && (
              <div className="audp-redes">Processo consolidado por mesclagem. <Link className="proc-link" href={linkPara("processo", p.merged_into)}>Ir ao registro canônico →</Link></div>
            )}

            {/* BLOCO 1 · DADOS */}
            <Sec titulo="Dados">
              <div className="audp-dados">
                <div className="fld"><div className="k">Tribunal</div><div className="v">{p.tribunal ?? "—"}</div></div>
                <div className="fld"><div className="k">Vara / comarca</div><div className="v">{p.vara_comarca ?? "—"}</div></div>
                <div className="fld"><div className="k">Instância</div><div className="v">{p.instancia ? `${p.instancia.toUpperCase()}${p.uf ? ` · ${p.uf}` : ""}` : "—"}</div></div>
                <div className="fld"><div className="k">Área</div><div className="v">{p.area ? humano(p.area) : "—"}</div></div>
                <div className="fld"><div className="k">Classe</div><div className="v">{p.classe ? humano(p.classe) : "—"}</div></div>
                <div className="fld"><div className="k">Responsável</div><div className="v">{p.responsavel ?? "—"}</div></div>
                {(p.assunto || p.fase || p.processo_origem || p.link_tribunal) && <>
                  <div className="fld"><div className="k">Assunto</div><div className="v">{p.assunto ?? "—"}</div></div>
                  <div className="fld"><div className="k">Fase</div><div className="v">{p.fase ?? "—"}</div></div>
                  <div className="fld"><div className="k">Origem · vínculo</div><div className="v">{p.processo_origem ? <Link className="proc-link" href={linkPara("processo", p.processo_origem)}>processo de origem →</Link> : p.link_tribunal ? <a className="proc-link" href={p.link_tribunal} target="_blank" rel="noreferrer">portal do tribunal ↗</a> : "—"}</div></div>
                </>}
              </div>
              {p.observacoes && <div className="cli-obs"><div className="k">Observações</div><p>{p.observacoes}</p></div>}
            </Sec>

            {/* BLOCO 2 · IDENTIDADE IA */}
            <div className="audp-ia">
              <div className="audp-ia-h"><Spark /><span>Identidade · resolvida pela IA</span></div>
              <div className="cli-ia-grid">
                <div className="fld"><div className="k">Número CNJ</div><div className="v mono">{p.numero_cnj ?? "—"}</div></div>
                <div className="fld"><div className="k">Registro do tribunal</div><div className="v mono">{p.numero_registro ?? "— (consulta por CNJ)"}</div></div>
              </div>
              <div className="audp-ia-note">Antes de cadastrar, o sistema consulta por <b>CNJ ou registro do tribunal</b> — evita duplicata. Este é o registro <b>canônico</b>{p.merged_into ? "" : " (nenhum tombstone aponta para ele)"}.</div>
            </div>

            {/* BLOCO 3 · PARTES */}
            <Sec titulo="Partes" extra={<span className="audp-count">{p.partes.length}</span>}>
              {p.partes.length === 0 ? (
                <div className="przp-empty-row"><span>{p.segredo ? "Processo em segredo — partes não identificadas pela automação." : "Sem partes vinculadas."}</span><VincularCliente label="Vincular cliente" variant="default" /></div>
              ) : (
                <div className="przp-stack">
                  {p.partes.map((parte) => (
                    <div className="przp-origem" key={parte.id}>
                      <span className="pz-tag cat-slate">{parte.papel ? humano(parte.papel) : "parte"}</span>
                      <div className="mid"><div className="t"><Link className="proc-link" href={linkPara("cliente", parte.id)}>{parte.nome}</Link></div></div>
                      <Link className="btn sm abrir" href={linkPara("cliente", parte.id)}>Abrir</Link>
                    </div>
                  ))}
                  <div className="proc-vinc-extra"><VincularCliente label="Vincular outro cliente" variant="default" /></div>
                </div>
              )}
              <div className="pk-vinc-nota">A IA tenta casar pelo <span className="mono">nome_normalizado</span> + CPF; na dúvida, abre tarefa de conferência em vez de criar às cegas.</div>
            </Sec>

            {/* BLOCO 4 · PRAZOS */}
            <Sec titulo="Prazos abertos" extra={<span className="audp-count">{p.prazos.length}</span>}>
              {p.prazos.length === 0 ? <div className="audp-empty">Sem prazos abertos.</div> : (
                <div className="przp-stack">{p.prazos.map((pr) => (
                  <Item key={pr.id} tag={pr.validado ? "prazo" : "provisório"} tagTone={pr.validado ? "cat-slate" : "tang"} titulo={curto(pr.ato)} sub={<span className="mono">fatal {ddmm(pr.data_fatal)}{pr.data_interna ? ` · interna ${ddmm(pr.data_interna)}` : ""}</span>} dias={pr.dias} href={linkPara("prazo", pr.id)} />
                ))}</div>
              )}
            </Sec>

            {/* BLOCO 5 · AUDIÊNCIAS */}
            <Sec titulo="Audiências" extra={<span className="audp-count">{p.audiencias.length}</span>}>
              {p.audiencias.length === 0 ? (
                <div className="przp-empty-row"><span>Sem audiências designadas.</span><Link className="btn sm" href="/audiencias">Nova audiência</Link></div>
              ) : (
                <div className="przp-stack">{p.audiencias.map((a) => (
                  <Item key={a.id} tag={a.validado ? "audiência" : "provisória"} tagTone={a.validado ? "cat-blue" : "tang"} titulo={a.nome?.trim() || humano(a.tipo)} sub={<span className="mono">{ddmm(a.data_hora)} · {humano(a.modalidade)} · {humano(a.status)}</span>} href={linkPara("audiencia", a.id)} />
                ))}</div>
              )}
            </Sec>

            {/* BLOCO 6 · INTIMAÇÕES */}
            <Sec titulo="Intimações" extra={<span className="audp-count">{p.intimacoes.length}</span>}>
              {p.intimacoes.length === 0 ? <div className="audp-empty">Sem intimações.</div> : (
                <div className="przp-stack">{p.intimacoes.map((i) => (
                  <Item key={i.id} tag={(i.origem ?? "—").toLowerCase()} tagTone="cat-blue" titulo={curto(i.resumo ?? "Intimação")} sub={<>{i.providencia ? `providência: ${i.providencia}` : humano(i.status)}{i.data_publicacao ? ` · ${ddmm(i.data_publicacao)}` : ""}</>} href={linkPara("intimacao", i.id)} />
                ))}</div>
              )}
            </Sec>

            {/* BLOCO 7 · PEÇAS (produção) — fora do print, surfaçado */}
            {p.pecas.length > 0 && (
              <Sec titulo="Peças · produção" extra={<span className="audp-count">{p.pecas.length}</span>}>
                <div className="przp-stack">{p.pecas.map((pc) => (
                  <Item key={pc.id} tag={humano(pc.tipo)} tagTone="cat-neutral" titulo={curto(pc.titulo)} sub={<>{pc.subtipo ? `${humano(pc.subtipo)} · ` : ""}{humano(pc.status)}</>} href={linkPara("peca", pc.id)} />
                ))}</div>
              </Sec>
            )}

            {/* BLOCO 8 · ESTUDOS — fora do print, surfaçado */}
            {p.estudos.length > 0 && (
              <Sec titulo="Estudos de execução" extra={<span className="audp-count">{p.estudos.length}</span>}>
                <div className="przp-stack">{p.estudos.map((e) => (
                  <Item key={e.id} tag="estudo" tagTone="cowork" titulo={curto(e.titulo)} sub={humano(e.status)} href={linkPara("estudo", e.id)} />
                ))}</div>
              </Sec>
            )}

            {/* BLOCO 9 · CONTRATOS — fora do print, surfaçado */}
            {p.contratos.length > 0 && (
              <Sec titulo="Contratos" extra={<span className="audp-count">{p.contratos.length}</span>}>
                <div className="przp-stack">{p.contratos.map((c) => (
                  <Item key={c.id} tag={humano(c.status)} tagTone={c.status === "vigente" ? "val" : "cat-neutral"} titulo={curto(c.objeto ?? "Contrato")} sub={c.valor_total ? `R$ ${c.valor_total.toLocaleString("pt-BR")}` : undefined} href={linkPara("contrato", c.id)} />
                ))}</div>
              </Sec>
            )}

            {/* BLOCO 10 · COMPROMISSOS — fora do print, surfaçado */}
            {p.compromissos.length > 0 && (
              <Sec titulo="Compromissos" extra={<span className="audp-count">{p.compromissos.length}</span>}>
                <div className="przp-stack">{p.compromissos.map((c) => (
                  <Item key={c.id} tag="compromisso" tagTone="cat-neutral" titulo={curto(c.titulo)} sub={<span className="mono">{ddmm(c.data_hora)} · {humano(c.status)}</span>} href={linkPara("compromisso", c.id)} />
                ))}</div>
              </Sec>
            )}

            {/* BLOCO 11 · ANDAMENTOS */}
            <Sec titulo="Andamentos" extra={<span className="audp-count">{p.andamentos.length}</span>}>
              {p.andamentos.length === 0 ? <div className="audp-empty">Sem andamentos.</div> : (
                <div className="przp-stack">{p.andamentos.map((a) => (
                  <Item key={a.id} tag={humano(a.tipo)} tagTone="cat-neutral" titulo={curto(a.descricao)} sub={<span className="mono">{ddmm(a.data)}</span>} href={linkPara("andamento", a.id)} />
                ))}</div>
              )}
            </Sec>

            {/* BLOCO 12 · DOCUMENTOS */}
            <Sec titulo="Documentos" extra={<span className="cli-sech-acao"><Acao label={<>↻ Reavaliar peças pendentes</>} variant="ghost" size="sm" titulo="Reavaliar peças pendentes" confirmarLabel="Reavaliar" resumo={<>Reanalisar as peças pendentes deste processo (redator agendado)?</>} acao={() => reanalisarPecas(p.id)} /></span>}>
              <DocumentosCaso documentos={p.documentos} vinculo={{ campo: "processo_id", id: p.id }} segredo={p.segredo} titulo="Documentos do processo" tipoPadrao="peca" />
            </Sec>

            {/* NOTAS */}
            {verNotas && (
              <Sec titulo="Anotações" extra={<span className="audp-count">{anotacoes.length}</span>}>
                <Anotacoes entidadeTipo="processo" entidadeId={p.id} notas={anotacoes} />
              </Sec>
            )}

            {/* EDITAR / ARQUIVAR */}
            <div className="audp-status">
              <div className="audp-sech" style={{ flex: 1, margin: 0 }}>Editar / arquivar</div>
              <EditarProcesso p={p} />
              <button type="button" className={`btn default${verNotas ? " on" : ""}`} onClick={() => setVerNotas((v) => !v)}>
                <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
              </button>
              {ativo && (
                <Acao label="Arquivar" variant="danger" titulo="Arquivar processo" confirmarLabel="Arquivar" resumo={<>Arquivar este processo? Não é apagado — muda para <b>arquivado</b> (auditado).</>} campoTexto={{ label: "Motivo (opcional)", placeholder: "Ex.: baixado / transitado em julgado." }} acao={(t) => arquivarProcesso(p.id, t)} />
              )}
            </div>
            <div className="audp-status-note">Arquivar é troca de status — nunca DELETE. Tudo auditado.</div>
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ProcRef } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { Anotacoes } from "@/components/detalhe/Anotacoes";
import { MarcarLido } from "@/components/MarcarLido";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
import { PromoverProcessoForm } from "@/components/modules/PromoverProcessoForm";
import { atualizarIntimacao, atualizarIntimacaoCampos, criarPrazo, criarTarefa, promoverOrfa } from "@/app/actions";
import { PROCESSO_INSTANCIA, PROCESSO_AREA, RESPONSAVEIS, TIPO_CONTAGEM, PRIORIDADES } from "@/lib/enums";
import { sugerirPeca, type MapaProvidencia } from "@/lib/pecas";
import { fmtDate, humano, dividirAto } from "@/lib/format";
import { linkPara } from "@/lib/links";
import { lidaPorMim, seloCiencia } from "@/lib/ciencia";
import type { Intimacao, IntimacaoFull, Anotacao } from "@/lib/data";

/* ── glifos ──────────────────────────────────────────────────────────────── */
const Spark = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden><path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" /></svg>
);
const Check = ({ s = 14, c = "#fff" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);
const PenIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const NoteIco = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v12l-4 4H4z" /><path d="M14 20v-4h4M8 9h8M8 13h5" /></svg>
);
const Clock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const TaskIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 11l2 2 4-4" /><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4" /></svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ddmm = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const statusTone = (s: string) =>
  s === "pendente" ? "tone-amber" : s === "providencia_tomada" ? "val" : s === "em_analise" ? "tone-blue" : s === "arquivada" ? "cat-neutral" : "cat-slate";
const ehIA = (c: string | null | undefined) => !c || /cowork|chat|robo|auto|djen|push/i.test(c);
const procNum = (i: { numero_cnj: string | null; numero_registro: string | null }) =>
  i.numero_cnj ?? (i.numero_registro ? `reg ${i.numero_registro}` : null);
// Identificação curta para órfãs (sem cliente/CNJ): corta o resumo gigante.
const resumoCurto = (s: string | null) => dividirAto(s).curto;
// fatal sugerida = ciência + prazo (corridos): exclui o dia do começo, inclui o do vencimento.
function fatalSugerida(ciencia: string | null, dias: number | null): string {
  if (!ciencia || !dias) return "";
  const d = new Date(ciencia + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/* ── seção rotulada ──────────────────────────────────────────────────────── */
function Sec({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="audp-sec">
      <div className="audp-sech">{titulo}{sub && <span className="cli-sech-sub">{sub}</span>}{extra}</div>
      {children}
    </div>
  );
}

/* ── master: card de intimação ───────────────────────────────────────────── */
function MasterCard({ i, ativo }: { i: Intimacao; ativo: boolean }) {
  return (
    <Link className={`audp-mcard cli-mcard${ativo ? " on" : ""}`} href={linkPara("intimacao", i.id)}>
      <div className="int-mtags">
        <span className="pz-tag cat-blue">{(i.origem ?? "—").toLowerCase()}</span>
        {i.orfa && <span className="pz-tag orfa">órfã</span>}
        {ehIA(i.cadastrado_por) && <span className="pz-tag cowork"><Spark s={8} />IA</span>}
      </div>
      <div className="cli-mnome">{i.orfa ? resumoCurto(i.resumo) : (i.cliente || "Sem cliente")}</div>
      <div className="cli-mmeta">{procNum(i) ? <span className="mono">{procNum(i)}</span> : "sem processo"} · ciência {ddmm(i.data_ciencia)}</div>
    </Link>
  );
}

/* ── índice (lista compacta) — reusado no drawer e na tela raiz /intimacoes ── */
export function IntimacaoMaster({ lista, activeId }: { lista: Intimacao[]; activeId?: string }) {
  const [filtro, setFiltro] = useState<"janela" | "orfas">("janela");
  const janela = lista.filter((x) => x.status !== "arquivada");
  const orfas = lista.filter((x) => x.orfa);
  const visiveis = filtro === "orfas" ? orfas : janela;
  return (
    <aside className="audp-master">
      <div className="audp-master-h">
        <h1>Intimações</h1>
        <div className="audp-filtros">
          <button type="button" className={`audp-chip ink${filtro === "janela" ? " on" : ""}`} onClick={() => setFiltro("janela")}>Janela ({janela.length})</button>
          <button type="button" className={`audp-chip tang${filtro === "orfas" ? " on" : ""}`} onClick={() => setFiltro("orfas")}>órfãs ({orfas.length})</button>
        </div>
      </div>
      <div className="audp-master-list">
        {visiveis.length === 0
          ? <div className="audp-empty">Nada por aqui.</div>
          : visiveis.map((x) => <MasterCard key={x.id} i={x} ativo={x.id === activeId} />)}
      </div>
    </aside>
  );
}

/* ── editar intimação ────────────────────────────────────────────────────── */
function EditarIntimacao({ i }: { i: IntimacaoFull }) {
  return (
    <FormModal label={<><PenIco /> Editar intimação</>} titulo="Editar intimação" descricao="Ajuste os dados extraídos, datas e teor. Só grava o que for preenchido — nada é apagado." acao={atualizarIntimacaoCampos.bind(null, i.id)} enviarLabel="Salvar" variant="default">
      <div><label>Resumo</label><input name="resumo" defaultValue={i.resumo ?? ""} placeholder="Resumo da intimação" /></div>
      <div><label>Teor integral</label><textarea name="teor" rows={5} defaultValue={i.teor ?? ""} placeholder="Cole o teor integral." /></div>
      <div><label>Providência</label><textarea name="providencia" defaultValue={i.providencia ?? ""} placeholder="Providência a tomar / tomada" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div><label>Disponibilização</label><input type="date" name="data_disponibilizacao" defaultValue={i.proprio?.data_disponibilizacao?.slice(0, 10) ?? ""} /></div>
        <div><label>Publicação</label><input type="date" name="data_publicacao" defaultValue={i.data_publicacao?.slice(0, 10) ?? ""} /></div>
        <div><label>Ciência</label><input type="date" name="data_ciencia" defaultValue={i.data_ciencia?.slice(0, 10) ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Tribunal</label><input name="tribunal" defaultValue={i.proprio?.tribunal ?? ""} placeholder="Ex.: TJMA" /></div>
        <div><label>Órgão / vara</label><input name="orgao" defaultValue={i.proprio?.orgao ?? ""} placeholder="Ex.: 2ª Vara Criminal" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Classe</label><input name="classe" defaultValue={i.proprio?.classe ?? ""} placeholder="Ex.: Ação Penal" /></div>
        <div><label>Grau / instância</label><select name="instancia" defaultValue={i.proprio?.instancia ?? ""}><option value="">—</option>{PROCESSO_INSTANCIA.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div><label>Área</label><select name="area" defaultValue={i.proprio?.area ?? ""}><option value="">—</option>{PROCESSO_AREA.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
        <div><label>Prazo (dias)</label><input type="number" name="prazo_dias" min={0} defaultValue={i.proprio?.prazo_dias ?? ""} /></div>
        <div><label>Fundamento</label><input name="fundamento" defaultValue={i.proprio?.fundamento ?? ""} placeholder="CPP art. 593" /></div>
      </div>
    </FormModal>
  );
}

/* ── encaminhar → prazo (cria prazo da intimação) ────────────────────────── */
function EncaminharPrazo({ i, sug, label, variant = "default" }: { i: IntimacaoFull; sug: ReturnType<typeof sugerirPeca>; label: ReactNode; variant?: "default" | "primary" }) {
  const atoSugerido = sug && !sug.ignorar ? `${humano(sug.tipo)}${sug.subtipo ? ` · ${humano(sug.subtipo)}` : ""}` : (i.resumo ?? "");
  return (
    <FormModal label={label} titulo="Encaminhar → prazo" descricao="Lança o prazo a partir desta intimação (pipeline intimação → prazo). Nasce provisório (aguardando validação)." acao={criarPrazo} enviarLabel="Lançar prazo" variant={variant}>
      <input type="hidden" name="processo_id" defaultValue={i.processo_id ?? ""} />
      <input type="hidden" name="intimacao_id" defaultValue={i.id} />
      <div><label>Ato</label><input name="ato" required defaultValue={atoSugerido} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Data fatal</label><input type="date" name="data_fatal" required defaultValue={fatalSugerida(i.data_ciencia, i.prazo_dias ?? null)} /></div>
        <div><label>Data interna</label><input type="date" name="data_interna" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Contagem</label><select name="tipo_contagem" defaultValue="corridos">{TIPO_CONTAGEM.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue="Daniel">{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <p className="sub" style={{ margin: 0 }}>Prazos penais em dias corridos: confira a ciência ({fmtDate(i.data_ciencia)}) e feriados locais. {i.fundamento ? `Fundamento sugerido: ${i.fundamento}.` : ""}</p>
    </FormModal>
  );
}

/* ── nova tarefa (a partir da intimação) ─────────────────────────────────── */
function NovaTarefaIntim({ i, label, variant = "default" }: { i: IntimacaoFull; label: ReactNode; variant?: "default" | "primary" }) {
  const tituloSug = (i.providencia?.trim() || i.resumo?.trim() || "Tarefa da intimação").slice(0, 120);
  const clienteId = i.clienteRefs[0]?.id ?? "";
  return (
    <FormModal label={label} titulo="Nova tarefa" descricao="Cria uma tarefa pendente, já vinculada ao processo/cliente desta intimação." acao={criarTarefa} enviarLabel="Criar tarefa" variant={variant}>
      <input type="hidden" name="processo_id" defaultValue={i.processo_id ?? ""} />
      <input type="hidden" name="cliente_id" defaultValue={clienteId} />
      <div><label>Título</label><input name="titulo" required defaultValue={tituloSug} /></div>
      <div><label>Descrição</label><textarea name="descricao" defaultValue={i.resumo ?? ""} placeholder="Detalhes da tarefa…" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Prioridade</label><select name="prioridade" defaultValue="media">{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue="Daniel">{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      <div><label>Data limite (opcional)</label><input type="date" name="data_limite" defaultValue={fatalSugerida(i.data_ciencia, i.prazo_dias ?? null)} /></div>
    </FormModal>
  );
}

/* ── componente principal ────────────────────────────────────────────────── */
// Estado de DECISÃO DE FLUXO (Sug. 53) — fonte: vw_intimacoes_contexto (status,
// na_caixa) + os vínculos ABERTO/não-terminal (prazo/peça). Só está "aberta para
// decisão" quando status='pendente' E na_caixa=true; caso contrário já foi
// decidida/encaminhada e os botões de fluxo travam.
type DecInfo = { aberta: boolean; selo: string; motivo: string };
function classificarDecisao(i: IntimacaoFull): DecInfo {
  if (i.status === "pendente" && i.na_caixa === true) return { aberta: true, selo: "", motivo: "" };
  if (i.status === "arquivada") return { aberta: false, selo: "Arquivada", motivo: "Arquivada" };
  if (i.prazo || i.peca) return { aberta: false, selo: `Encaminhada · ${i.prazo ? "tem prazo" : "tem peça"}`, motivo: "Já encaminhada (tem prazo/peça)" };
  if (i.status === "sem_providencia") return { aberta: false, selo: "Decidida · sem providência", motivo: "Já decidida: sem providência" };
  if (i.status === "providencia_tomada") return { aberta: false, selo: "Decidida · providência tomada", motivo: "Providência já tomada" };
  if (i.status === "em_analise") return { aberta: false, selo: "Em análise", motivo: "Em análise" };
  return { aberta: false, selo: "Já encaminhada", motivo: "Já encaminhada" };
}

// Botão de fluxo TRAVADO: visível, desabilitado, cadeado + tooltip (a11y).
function BotaoTravado({ label, motivo, variant = "default" }: { label: ReactNode; motivo: string; variant?: string }) {
  return (
    <button type="button" className={`btn ${variant}`} disabled aria-disabled="true" title={motivo} style={{ opacity: 0.55, cursor: "not-allowed" }}>
      🔒 {label}
    </button>
  );
}

// Reabrir decisão — desfaz o travamento SÓ após confirmar (nunca em clique único).
function ReabrirDecisao({ onReabrir }: { onReabrir: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  if (!confirmar) {
    return (
      <button type="button" className="btn default" onClick={() => setConfirmar(true)} title="Desfazer a decisão e permitir novo encaminhamento">
        ↻ Reabrir decisão
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>Reabrir esta intimação e permitir novo encaminhamento?</span>
      <button type="button" className="btn sm primary" onClick={onReabrir}>Sim, reabrir</button>
      <button type="button" className="btn sm" onClick={() => setConfirmar(false)}>Cancelar</button>
    </span>
  );
}

export function IntimacaoPainel({ i, lista, mapa, anotacoes, meuId }: { i: IntimacaoFull; lista: Intimacao[]; mapa: MapaProvidencia | null; anotacoes: Anotacao[]; meuId: string | null }) {
  const [verNotas, setVerNotas] = useState(true);
  const [procs, setProcs] = useState<{ id: string; label: string }[]>([]);
  const [clis, setClis] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/processos-lite").then((r) => r.json()).then((d) => vivo && setProcs(d.processos ?? [])).catch(() => {});
    fetch("/api/clientes-lite").then((r) => r.json()).then((d) => vivo && setClis(d.clientes ?? [])).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const sug = useMemo(() => sugerirPeca(i.providencia || i.resumo, mapa), [i.providencia, i.resumo, mapa]);
  // Decisão de fluxo: trava os botões que mudam a decisão quando já decidida.
  const dec = classificarDecisao(i);
  const [reaberto, setReaberto] = useState(false);
  const podeDecidir = dec.aberta || reaberto;
  const temCobertura = Boolean(i.codigo_publicacao);

  return (
    <div className="audp">
      {/* MASTER — índice compartilhado (mesma row da tela raiz /intimacoes) */}
      <IntimacaoMaster lista={lista} activeId={i.id} />

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/intimacoes">← Intimações</Link>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {/* cabeçalho */}
            <div className="audp-tags">
              <span className="pz-tag cat-blue">origem · {(i.origem ?? "—").toLowerCase()}</span>
              <span className={`pz-tag ${statusTone(i.status)}`}>{humano(i.status)}</span>
              {ehIA(i.cadastrado_por) && <span className="pz-tag cowork"><Spark s={9} />extraída pela IA</span>}
              {i.orfa && <span className="pz-tag orfa">órfã</span>}
              {i.segredo && <span className="pz-tag segredo">🔒 segredo de justiça</span>}
              {!dec.aberta && (
                <span
                  className="pz-tag"
                  title={dec.motivo}
                  style={{
                    background: "color-mix(in srgb, var(--brass) 16%, transparent)",
                    color: "var(--brass)",
                    border: "1px solid color-mix(in srgb, var(--brass) 32%, transparent)",
                    fontWeight: 700,
                  }}
                >
                  🔒 {dec.selo}{reaberto ? " · reaberta para edição" : ""}
                </span>
              )}
            </div>
            <div className="int-ident">
              {i.orfa ? (
                <b className="int-ident-nome">{resumoCurto(i.resumo)}</b>
              ) : i.clienteRefs.length ? (
                <b className="int-ident-nome">{i.clienteRefs.map((c, n) => <span key={c.id}>{n > 0 && ", "}<Link className="proc-link" href={linkPara("cliente", c.id)}>{c.nome}</Link></span>)}</b>
              ) : (
                <b className="int-ident-nome" style={{ color: "var(--amber)" }}>Sem cliente vinculado</b>
              )}
              {procNum(i) && <span className="int-ident-proc"><ProcRef cnj={i.numero_cnj} registro={i.numero_registro} id={i.processo_id} /></span>}
            </div>

            {/* BLOCO 1 · PROVIDÊNCIA → PEÇA */}
            <div className="audp-ia">
              <div className="audp-ia-h"><Spark /><span>Providência → peça · mapa_providencia_peca</span></div>
              <div className="int-fluxo">
                <span className="int-kw">“{(i.providencia || sug?.subtipo || sug?.tipo || i.resumo || "—").toString().slice(0, 22)}”</span>
                <span className="int-arr">→</span>
                <span className="int-peca">{sug && !sug.ignorar ? `${humano(sug.tipo)}${sug.subtipo ? ` · ${humano(sug.subtipo)}` : ""}` : "sem peça sugerida"}</span>
                <span className="int-fund mono">{[i.fundamento, i.prazo_dias ? `${i.prazo_dias} dias corridos` : null].filter(Boolean).join(" · ") || "—"}</span>
              </div>
              <div className="audp-ia-note">O mapa determinístico (casamento por palavra-chave) pré-preenche o <b>tipo/subtipo</b> da peça e encadeia o pipeline intimação → prazo → peça. O prazo gerado herda a contagem; a peça nasce <span className="mono">validado=false</span> para triagem.</div>
            </div>

            {/* BLOCO 2 · DADOS EXTRAÍDOS */}
            <Sec titulo="Dados extraídos" sub="campos próprios da intimação">
              <div className="audp-dados">
                <div className="fld"><div className="k">Tribunal</div><div className="v">{i.tribunal ?? "—"}</div></div>
                <div className="fld"><div className="k">Órgão / vara</div><div className="v">{i.orgao ?? i.vara_comarca ?? "—"}</div></div>
                <div className="fld"><div className="k">Instância</div><div className="v">{i.instancia ? `${i.instancia.toUpperCase()}` : "—"}</div></div>
                <div className="fld"><div className="k">Classe</div><div className="v">{i.classe ?? "—"}</div></div>
                <div className="fld"><div className="k">Área</div><div className="v">{i.area ? humano(i.area) : "—"}</div></div>
                <div className="fld"><div className="k">Providência</div><div className="v">{i.providencia ?? "—"}</div></div>
                <div className="fld"><div className="k">Prazo legal</div><div className="v">{i.prazo_dias ? `${i.prazo_dias} dias corridos` : "—"}</div></div>
                <div className="fld"><div className="k">Fundamento</div><div className="v">{i.fundamento ?? "—"}</div></div>
                <div className="fld"><div className="k">Código publicação</div><div className="v mono" style={{ fontSize: 12 }}>{i.codigo_publicacao ?? "—"}</div></div>
              </div>
            </Sec>

            {/* BLOCO 3 · DATAS */}
            <Sec titulo="Datas · dura · jurídica">
              <div className="int-datas">
                <div className="int-data"><div className="k">Disponibilização</div><div className="d mono">{ddmm(i.data_disponibilizacao)}</div><div className="s">dado <b>duro</b> do diário — independe do processo</div></div>
                <div className="int-data"><div className="k">Publicação (estimada)</div><div className="d mono">{ddmm(i.data_publicacao)}</div><div className="s">disponibilização + 1 dia útil</div></div>
                <div className="int-data on"><div className="k">Ciência</div><div className="d mono">{ddmm(i.data_ciencia)}</div><div className="s">decisão jurídica — dispara o prazo</div></div>
              </div>
            </Sec>

            {/* BLOCO 4 · COBERTURA */}
            <Sec titulo="Cobertura · recorte digital">
              <div className={`int-cobertura${temCobertura ? " ok" : ""}`}>
                <span className="ic">{temCobertura ? <Check s={15} c="var(--green)" /> : "—"}</span>
                <div className="mid">
                  <div className="t">{temCobertura ? "Captura confirmada" : "Sem código de publicação capturado"}</div>
                  <div className="s">{temCobertura ? "Recorte do diário casado por código único — sem duplicidade nem buraco de cobertura. Confirmação silenciosa: não regrava nada." : "Intimação sem código de rastreio do diário oficial — conferir a captura."}</div>
                </div>
                <div className="meta mono">{(i.origem ?? "").toUpperCase()}<br />dedup codigo_publicacao</div>
              </div>
            </Sec>

            {/* BLOCO 5 · TEOR INTEGRAL */}
            <Sec titulo="Teor integral" extra={i.teor?.trim() ? <span className="pz-tag val"><Check s={9} c="var(--green)" />em mãos · libera a peça</span> : undefined}>
              <div className="int-teor">
                {i.teor?.trim()
                  ? <p>“{i.teor}”</p>
                  : i.resumo
                    ? <><p>“{i.resumo}”</p><div className="int-teor-aviso">Teor integral não capturado — exibindo o resumo. Cole o teor em “Editar intimação”.</div></>
                    : <p className="dim">Sem teor disponível.</p>}
                <div className="int-teor-meta mono">teor_decisao_integral · fonte {(i.origem ?? "—").toUpperCase()}</div>
              </div>
            </Sec>

            {/* BLOCO 6 · ENCADEAMENTO */}
            <Sec titulo="Encadeamento">
              <div className="przp-stack">
                {/* processo */}
                {i.orfa ? (
                  <div className="int-orfa">
                    <b>Intimação órfã.</b> Processo não identificado — promova na triagem antes de vincular.
                    <div style={{ marginTop: 9 }}>
                      <PromoverProcessoForm titulo="Promover intimação órfã" descricao="Identifica/cadastra o processo (dedup + resolução de mesclagem) e vincula a intimação. Auditado." acao={promoverOrfa.bind(null, "intimacao", i.id)} procs={procs} clis={clis} enviarLabel="Vincular intimação" header={<p className="sub" style={{ marginTop: 0 }}>{i.resumo ?? "—"}</p>} />
                    </div>
                  </div>
                ) : (
                  <div className="przp-origem">
                    <span className="pz-tag cat-slate">processo</span>
                    <div className="mid">
                      <div className="t">{[i.classe, i.tribunal].filter(Boolean).join(" · ") || "Processo vinculado"}</div>
                      <div className="s mono"><ProcRef cnj={i.numero_cnj} registro={i.numero_registro} id={i.processo_id} /> · vinculado</div>
                    </div>
                    {i.processo_id && <Link className="btn sm abrir" href={linkPara("processo", i.processo_id)}>Abrir</Link>}
                  </div>
                )}

                {/* peça vinculada (dado nosso, fora do print — não deixar sem aparecer) */}
                {i.peca && (
                  <div className="przp-origem">
                    <span className="pz-tag cowork">peça</span>
                    <div className="mid"><div className="t">{i.peca.titulo}</div><div className="s">{humano(i.peca.status)}</div></div>
                    <Link className="btn sm abrir" href="/producao">Abrir</Link>
                  </div>
                )}

                {/* prazo gerado */}
                {i.prazo ? (
                  <div className="przp-origem">
                    <span className={`pz-tag ${i.prazo.validado ? "val" : "tang"}`}>{i.prazo.validado ? "prazo validado" : "prazo provisório"}</span>
                    <div className="mid"><div className="t">{i.prazo.ato.split(/\s*[—–[]/)[0].trim()}</div><div className="s mono">fatal {ddmm(i.prazo.data_fatal)} · {i.prazo.dias < 0 ? `${i.prazo.dias} d` : `em ${i.prazo.dias} d`}</div></div>
                    <Link className="btn sm abrir" href={linkPara("prazo", i.prazo.id)}>Abrir</Link>
                  </div>
                ) : !i.orfa ? (
                  <div className="przp-empty-row">
                    <span>Ainda sem prazo lançado.</span>
                    {podeDecidir
                      ? <EncaminharPrazo i={i} sug={sug} label={<><Clock /> Encaminhar → prazo</>} />
                      : <BotaoTravado label={<><Clock /> Encaminhar → prazo</>} motivo={dec.motivo} />}
                  </div>
                ) : null}
              </div>
            </Sec>

            {/* NOTAS */}
            {verNotas && (
              <Sec titulo="Anotações" extra={<span className="audp-count">{anotacoes.length}</span>}>
                <Anotacoes entidadeTipo="intimacao" entidadeId={i.id} notas={anotacoes} />
              </Sec>
            )}

            {/* STATUS */}
            <div className="audp-status">
              <div className="audp-sech" style={{ margin: 0 }}>Status</div>
              <span className={`cli-fi-flag${seloCiencia(i, meuId).lida ? " lida" : ""}`} style={{ flex: 1 }}>{seloCiencia(i, meuId).rotulo}</span>
              <MarcarLido id={i.id} lida={lidaPorMim(i, meuId)} />
              <EditarIntimacao i={i} />
              <button type="button" className={`btn default${verNotas ? " on" : ""}`} onClick={() => setVerNotas((v) => !v)}>
                <NoteIco /> Anotações{anotacoes.length ? ` (${anotacoes.length})` : ""}
              </button>
              {podeDecidir ? (
                <Acao label="Marcar sem providência" titulo="Sem providência" confirmarLabel="Marcar" resumo={<>Marcar como <b>sem providência</b> (ciência apenas)?</>} acao={() => atualizarIntimacao(i.id, "sem_providencia")} />
              ) : (
                <BotaoTravado label="Marcar sem providência" motivo={dec.motivo} />
              )}
              {podeDecidir ? (
                <Acao label="Arquivar" variant="danger" titulo="Arquivar intimação" confirmarLabel="Arquivar" resumo={<>Arquivar esta intimação? Muda o status para <b>arquivada</b> (auditado).</>} acao={() => atualizarIntimacao(i.id, "arquivada")} />
              ) : (
                <BotaoTravado label="Arquivar" motivo={dec.motivo} variant="danger" />
              )}
              {!dec.aberta && !reaberto && <ReabrirDecisao onReabrir={() => setReaberto(true)} />}
            </div>
            <div className="audp-status-note">Arquivar é troca de status — nunca DELETE. A intimação permanece como porta de entrada auditada.</div>
          </div>
        </div>

        {/* action bar */}
        <div className="audp-actionbar">
          {!i.orfa && !i.prazo && (
            podeDecidir
              ? <EncaminharPrazo i={i} sug={sug} label={<><Clock /> Encaminhar → prazo</>} variant="primary" />
              : <BotaoTravado label={<><Clock /> Encaminhar → prazo</>} motivo={dec.motivo} variant="primary" />
          )}
          {podeDecidir
            ? <CriarPecaPendente tipoOrigem="intimacao" origemId={i.id} texto={i.providencia || i.resumo} baseTitulo={i.resumo} mapa={mapa} />
            : <BotaoTravado label="+ Criar petição pendente" motivo={dec.motivo} />}
          <NovaTarefaIntim i={i} label={<><TaskIco /> Nova tarefa</>} />
          {i.orfa
            ? <PromoverProcessoForm titulo="Vincular processo" descricao="Identifica/cadastra o processo e vincula a intimação." acao={promoverOrfa.bind(null, "intimacao", i.id)} procs={procs} clis={clis} enviarLabel="Vincular" />
            : i.processo_id && <Link className="btn default" href={linkPara("processo", i.processo_id)}>Vincular processo</Link>}
        </div>
      </section>
    </div>
  );
}

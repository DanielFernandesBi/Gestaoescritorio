"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProcRef, SegredoTag, Pill, ContextoCaso, PartesCliente } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { MarcarLido } from "@/components/MarcarLido";
import { CaixaBtn } from "@/components/CaixaBtn";
import { linkPara } from "@/lib/links";
import { fmtDate, humano } from "@/lib/format";
import { lidaPorMim, seloCiencia } from "@/lib/ciencia";
import type { Intimacao } from "@/lib/data";

const PASSO = 50;

const tone = (s: string) =>
  s === "pendente" ? "amber"
    : s === "providencia_tomada" ? "green"
      : s === "em_analise" ? "blue"
        : s === "sem_providencia" ? "brass"
          : s === "arquivada" ? "violet"
            : "gray";

// Sugestão 53 — DOIS eixos: LEITURA (default "Para revisar" = revisado_em null) e
// FLUXO ("Na caixa" = na_caixa derivado dos fatos). Depois, os filtros por status.
const STATUS = [
  { id: "para_revisar", label: "Para revisar" },
  { id: "na_caixa", label: "Na caixa" },
  { id: "todas", label: "Todas" },
  { id: "pendentes", label: "Pendentes" },
  { id: "em_analise", label: "Em análise" },
  { id: "sem_providencia", label: "Sem providência" },
  { id: "providencia_tomada", label: "Providência tomada" },
  { id: "arquivada", label: "Arquivadas" },
  { id: "orfas", label: "Órfãs" },
];
const ORIGENS = [
  { id: "todas", label: "Todas origens" },
  { id: "dje", label: "DJe" },
  { id: "push", label: "Push STJ/STF" },
  { id: "pje", label: "PJe" },
  { id: "seeu", label: "SEEU" },
  { id: "email", label: "E-mail" },
  { id: "eproc", label: "eproc" },
];

// Estado de encaminhamento do card (eixo de FLUXO), com a cor/aura certa.
function encaminhamento(i: Intimacao): { label: string; cls: string; check?: boolean } | null {
  if (!i.orfa && i.tem_prazo && i.prazo_fatal) {
    const dias = i.prazo_dias_restantes;
    return {
      label: `Prazo · fatal ${fmtDate(i.prazo_fatal)}${dias != null ? ` · ${dias}d` : ""}`,
      cls: i.prazo_validado ? "enc-ok" : "enc-prov",
      check: Boolean(i.prazo_validado),
    };
  }
  if (i.tem_peca) return { label: `Minuta IA · ${humano(i.peca_status ?? "em produção")}`, cls: "enc-ai" };
  if (i.na_caixa) return { label: "Na caixa · sem prazo", cls: "enc-caixa" };
  // Sug. 132 — a lista ficava MUDA sobre a intimação que a automação encaminhou
  // para tarefa ou audiência (o manual conta quatro artefatos, não dois). Sem
  // linha nenhuma, o item parecia intocado. Qual é o artefato só o detalhe sabe,
  // porque tarefa e audiência não têm `intimacao_id` — daí o convite a abrir.
  if (i.status === "em_analise") return { label: "Em análise · abrir para ver o encaminhamento", cls: "enc-caixa" };
  return null;
}

export function IntimacoesList({ intimacoes, meuId }: { intimacoes: Intimacao[]; meuId: string | null }) {
  // Abre no eixo de LEITURA PESSOAL: o que EU ainda não revisei (Sug. 82).
  const [st, setSt] = useState("para_revisar");
  const [orig, setOrig] = useState("todas");
  const [visiveis, setVisiveis] = useState(PASSO);

  const filtradas = useMemo(
    () =>
      intimacoes.filter((i) => {
        const okSt =
          st === "para_revisar" ? !lidaPorMim(i, meuId)
            : st === "na_caixa" ? Boolean(i.na_caixa)
              : st === "pendentes" ? i.status === "pendente"
                : st === "em_analise" ? i.status === "em_analise"
                  : st === "sem_providencia" ? i.status === "sem_providencia"
                    : st === "providencia_tomada" ? i.status === "providencia_tomada"
                      : st === "arquivada" ? i.status === "arquivada"
                        : st === "orfas" ? i.orfa
                          : true;
        const okOrig = orig === "todas" ? true : i.origem === orig;
        return okSt && okOrig;
      }),
    [intimacoes, st, orig, meuId],
  );
  const mostradas = filtradas.slice(0, visiveis);

  const nRevisar = intimacoes.filter((i) => !lidaPorMim(i, meuId)).length;
  const nCaixa = intimacoes.filter((i) => i.na_caixa).length;
  const nPend = intimacoes.filter((i) => i.status === "pendente").length;
  const nAnalise = intimacoes.filter((i) => i.status === "em_analise").length;
  const nSemProv = intimacoes.filter((i) => i.status === "sem_providencia").length;
  const nProvTomada = intimacoes.filter((i) => i.status === "providencia_tomada").length;
  const nArquivada = intimacoes.filter((i) => i.status === "arquivada").length;
  const nOrfas = intimacoes.filter((i) => i.orfa).length;

  const irPara = (id: string) => { setSt(id); setVisiveis(PASSO); };

  const contaDe: Record<string, number> = {
    para_revisar: nRevisar, na_caixa: nCaixa, todas: intimacoes.length,
    pendentes: nPend, em_analise: nAnalise, sem_providencia: nSemProv,
    providencia_tomada: nProvTomada, arquivada: nArquivada, orfas: nOrfas,
  };
  const opcoesStatus = STATUS.map((o) => ({ ...o, label: `${o.label} (${contaDe[o.id] ?? 0})` }));

  return (
    <>
      <div className="card op-card" style={{ marginBottom: 16 }}>
        <div className="card-h"><h3><Icon name="list" /> Filtros</h3></div>
        <div className="card-b">
          <Chips options={opcoesStatus} value={st} onChange={(v) => { setSt(v); setVisiveis(PASSO); }} />
          <Chips options={ORIGENS} value={orig} onChange={(v) => { setOrig(v); setVisiveis(PASSO); }} />
        </div>
      </div>

      <div className="scan">
        <div className="scan-h"><h3><Icon name="inbox" /> Panorama das intimações</h3></div>
        <div className="scan-metrics">
          <button type="button" className={`metric${st === "para_revisar" ? " metric-on" : ""}`} onClick={() => irPara("para_revisar")}><b>{nRevisar}</b><span>Para revisar · não lidas</span></button>
          <button type="button" className={`metric${st === "na_caixa" ? " metric-on" : ""}`} onClick={() => irPara("na_caixa")}><b>{nCaixa}</b><span>Na caixa · aguardando encaminhamento</span></button>
          <button type="button" className={`metric${st === "orfas" ? " metric-on" : ""}`} onClick={() => irPara("orfas")}><b>{nOrfas}</b><span>Órfãs · sem processo</span></button>
          <button type="button" className={`metric${st === "todas" ? " metric-on" : ""}`} onClick={() => irPara("todas")}><b>{intimacoes.length}</b><span>Total · acervo recente</span></button>
        </div>
      </div>

      <div className="int-head">
        <span className="sub">{filtradas.length} no filtro</span>
      </div>

      {mostradas.length ? (
        <div className="int-list">
          {mostradas.map((i) => {
            const selo = seloCiencia(i, meuId);
            const naoLida = !selo.lida;
            const enc = encaminhamento(i);
            const abrir = linkPara("intimacao", i.id);
            return (
              <div className={`int-card${naoLida ? " nao-lida" : ""}`} key={i.id}>
                <div className="int-top">
                  {naoLida && <span className="dot-nova" aria-hidden title="Não lida" />}
                  <span className="int-orig">{(i.origem ?? "—").toUpperCase()}</span>
                  <span className="int-date mono">{fmtDate(i.data_publicacao)}</span>
                  <Pill tone={tone(i.status)}>{humano(i.status)}</Pill>
                  <span className={`int-flag-lida${selo.lida ? " lida" : ""}`}>{selo.rotulo}</span>
                </div>

                <div className="int-cliente">
                  {i.orfa ? (
                    <span className="int-orfa">⚠ Sem processo identificado · triagem humana</span>
                  ) : (
                    <>
                      {i.partes?.length ? <PartesCliente partes={i.partes} /> : (i.cliente ?? "Sem cliente vinculado")}
                      {i.preso && <span className="ag-flag preso">PRESO</span>}
                      {i.segredo && <> <SegredoTag on /></>}
                    </>
                  )}
                </div>

                <ContextoCaso ctx={i.contexto} />

                {i.providencia && (
                  <div className="int-prov"><span className="int-k">providência</span> {i.providencia}</div>
                )}

                <div className="int-foot">
                  <div className="int-enc">
                    {i.orfa ? (
                      <span className="sub">sem CNJ · fila de órfãos</span>
                    ) : (
                      <ProcRef cnj={i.numero_cnj} registro={i.numero_registro} id={i.processo_id} />
                    )}
                    {enc && <span className={`int-encp ${enc.cls}`}>{enc.check ? "✓ " : ""}{enc.label}</span>}
                  </div>
                  <div className="int-acoes">
                    {i.orfa ? (
                      <Link className="btn sm" href={abrir}>Promover · vincular</Link>
                    ) : i.tem_prazo && !i.prazo_validado ? (
                      <Link className="btn sm primary" href="/validacao">Validar prazo</Link>
                    ) : i.tem_peca ? (
                      <Link className="btn sm" href="/producao">Ver minuta</Link>
                    ) : null}
                    {!i.orfa && i.processo_id && <CaixaBtn processoId={i.processo_id} />}
                    <MarcarLido id={i.id} lida={selo.lida} />
                    <Link className="btn sm abrir" href={abrir}>Abrir</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty">Nenhuma intimação neste filtro.</div>
      )}

      {visiveis < filtradas.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button className="btn" onClick={() => setVisiveis((v) => v + PASSO)}>
            Carregar mais ({filtradas.length - visiveis} restantes)
          </button>
        </div>
      )}
    </>
  );
}

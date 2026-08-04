"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Chips } from "@/components/Chips";
import { PageHeader } from "@/components/PageHeader";
import { AndamentosTimeline, conferenciaAberta } from "@/components/modules/AndamentosTimeline";
import { AndamentosOrfaosList } from "@/components/modules/AndamentosOrfaosList";
import type { Movimentacao, AndamentoOrfao } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

const DECISAO = ["decisao", "sentenca", "acordao", "despacho"];
const ehDecisao = (t: string) => DECISAO.some((d) => t.includes(d));

const ORIGENS = [
  { id: "todas", label: "Todas origens" },
  { id: "tribunal", label: "Tribunal" },
  { id: "djen", label: "DJEN" },
  { id: "push", label: "Push" },
  { id: "email", label: "E-mail" },
];

export function AndamentosModulo({
  movimentacoes,
  orfaos,
  mapa = null,
  acoes,
}: {
  movimentacoes: Movimentacao[];
  orfaos: AndamentoOrfao[];
  mapa?: MapaProvidencia | null;
  acoes?: ReactNode;
}) {
  const [aba, setAba] = useState("recentes");
  const [orig, setOrig] = useState("todas");
  const PASSO = 25;
  const [visiveis, setVisiveis] = useState(PASSO);
  // Sem cap fixo de quantidade: paginação client-side. Trocar de filtro volta ao
  // lote inicial (reset no próprio handler, não em efeito).
  const irAba = (v: string) => { setAba(v); setVisiveis(PASSO); };
  const irOrig = (v: string) => { setOrig(v); setVisiveis(PASSO); };

  // "A conferir" é a fila ACIONÁVEL — conferência ainda aberta. "Escalados" é o
  // histórico do período (inclui as já resolvidas), que é o que o KPI sempre mediu.
  // Sem a distinção, 19 escalados com 18 concluídos escondiam o único pendente.
  const nAConferir = movimentacoes.filter(conferenciaAberta).length;
  const nEscalados = movimentacoes.filter((m) => m.escalado).length;
  const nDecisoes = movimentacoes.filter((m) => ehDecisao(m.tipo)).length;

  const abas = [
    { id: "recentes", label: `Recentes · 7d (${movimentacoes.length})` },
    { id: "conferir", label: `A conferir (${nAConferir})` },
    { id: "escalados", label: `Escalados (${nEscalados})` },
    { id: "decisoes", label: `Decisões (${nDecisoes})` },
    { id: "orfaos", label: `Órfãos (${orfaos.length})` },
  ];

  const filtradas = useMemo(
    () =>
      movimentacoes.filter((m) => {
        const okAba =
          aba === "conferir" ? conferenciaAberta(m)
            : aba === "escalados" ? m.escalado
              : aba === "decisoes" ? ehDecisao(m.tipo)
                : true;
        const okOrig = orig === "todas" ? true : (m.origem ?? "") === orig;
        return okAba && okOrig;
      }),
    [movimentacoes, aba, orig],
  );

  return (
    <>
      <PageHeader
        breadcrumb={["Entrada · IA", "Andamentos"]}
        eyebrow="Histórico processual · captura automática"
        titulo="Andamentos"
        descricao={
          <>
            Toda movimentação útil — decisões, despachos, juntadas, pautas — capturada e deduplicada.
            São informativos; o que tem consequência é escalado para conferência.
          </>
        }
        acoes={acoes}
        kpis={[
          { valor: movimentacoes.length, label: "Recentes · últimos 7 dias", tone: "neutral" },
          // O KPI passa a medir o ACIONÁVEL (mesma régua do badge do menu). Antes
          // mostrava o total escalado no período, concluídos inclusive, e por isso
          // divergia do menu — 19 aqui contra 1 lá, sem nada explicando a diferença.
          { valor: nAConferir, label: "A conferir · conferência aberta", tone: "amber" },
          { valor: orfaos.length, label: "Órfãos · sem processo", tone: "red" },
          { valor: nDecisoes, label: "Decisões · mérito/despacho", tone: "accent" },
        ]}
      />

      <Chips options={abas} value={aba} onChange={irAba} />
      {aba !== "orfaos" && <Chips options={ORIGENS} value={orig} onChange={irOrig} />}

      {aba === "orfaos" ? (
        <AndamentosOrfaosList orfaos={orfaos} />
      ) : (
        <>
          <AndamentosTimeline movimentacoes={filtradas.slice(0, visiveis)} mapa={mapa} filtro={aba} />
          {filtradas.length > visiveis && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setVisiveis((v) => v + PASSO)}>
                Mostrar mais ({filtradas.length - visiveis} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

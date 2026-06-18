"use client";

import { useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { FiltrosCard } from "@/components/FiltrosCard";
import { VerMais } from "@/components/VerMais";
import { TarefaDetalhe } from "@/components/detalhe/TarefaDetalhe";
import { fmtDate, humano } from "@/lib/format";
import type { Tarefa } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

type Tone = "red" | "amber" | "gray";
const priTone = (p: string | null): Tone =>
  p === "urgente" ? "red" : p === "alta" ? "amber" : "gray";

type Socio = "Daniel" | "Rodolfo";
const oUtroSocio = (s: Socio): Socio => (s === "Daniel" ? "Rodolfo" : "Daniel");

const COLS: { key: string; label: string }[] = [
  { key: "pendente", label: "Pendente" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida", label: "Concluída" },
];

const POR_COLUNA = 10;

export function TarefasBoard({
  tarefas,
  mapa = null,
  socio = null,
}: {
  tarefas: Tarefa[];
  mapa?: MapaProvidencia | null;
  socio?: Socio | null;
}) {
  const { open } = useDrawer();
  const [filtro, setFiltro] = useState("todas");
  const [pri, setPri] = useState("todas");

  const outro = socio ? oUtroSocio(socio) : null;
  const filtradas = tarefas.filter((t) => {
    const okAtr =
      filtro === "minhas" ? socio != null && t.responsavel === socio
        : filtro === "socio" ? outro != null && t.responsavel === outro
          : filtro === "distribuir" ? t.responsavel === "Ambos"
            : true;
    const okPri = pri === "todas" ? true : t.prioridade === pri;
    return okAtr && okPri;
  });

  const nMinhas = socio ? tarefas.filter((t) => t.responsavel === socio).length : 0;
  const nSocio = outro ? tarefas.filter((t) => t.responsavel === outro).length : 0;
  const nDistribuir = tarefas.filter((t) => t.responsavel === "Ambos").length;
  const atribuicao = [
    { id: "todas", label: `Todas (${tarefas.length})` },
    ...(socio ? [{ id: "minhas", label: `Minhas (${nMinhas})` }] : []),
    ...(outro ? [{ id: "socio", label: `${outro} (${nSocio})` }] : []),
    { id: "distribuir", label: `A distribuir (${nDistribuir})` },
  ];
  const prioridades = [
    { id: "todas", label: "Toda prioridade" },
    { id: "urgente", label: "Urgente" },
    { id: "alta", label: "Alta" },
    { id: "media", label: "Média" },
    { id: "baixa", label: "Baixa" },
  ];

  function cartao(t: Tarefa) {
    return (
      <div
        key={t.id}
        className="task"
        style={{ cursor: "pointer" }}
        onClick={() =>
          open({
            title: (
              <>
                <h2>{t.titulo}</h2>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <Pill tone={priTone(t.prioridade)}>{humano(t.prioridade)}</Pill>
                </div>
              </>
            ),
            body: <TarefaDetalhe t={t} mapa={mapa} socio={socio} />,
          })
        }
      >
        <div className="t">{t.titulo}</div>
        {t.descricao && <div className="d">{t.descricao}</div>}
        <div className="f">
          <Pill tone={priTone(t.prioridade)}>{humano(t.prioridade)}</Pill>
          <span className="sub">{t.responsavel ?? "—"}{t.data_limite ? ` · ${fmtDate(t.data_limite)}` : ""}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <FiltrosCard>
        <Chips options={atribuicao} value={filtro} onChange={setFiltro} />
        <Chips options={prioridades} value={pri} onChange={setPri} />
      </FiltrosCard>

      <div className="card op-card">
        <div className="card-h">
          <h3><Icon name="list" /> Tarefas</h3>
          <span className="sub">{filtradas.length} no filtro</span>
        </div>
        <div className="card-b">
          <div className="kanban">
            {COLS.map((col) => {
              const itens = filtradas.filter((t) => t.status === col.key);
              return (
                <div className="kcol" key={col.key}>
                  <div className="kcol-h">
                    <span>{col.label}</span>
                    <span className="ct">{itens.length}</span>
                  </div>
                  <div className="kcol-b">
                    {itens.length ? (
                      <VerMais max={POR_COLUNA}>{itens.map(cartao)}</VerMais>
                    ) : (
                      <div className="empty">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

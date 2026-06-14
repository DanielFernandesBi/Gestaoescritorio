"use client";

import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import { fmtDate, humano } from "@/lib/format";
import type { Tarefa } from "@/lib/data";

type Tone = "red" | "amber" | "gray";
const priTone = (p: string | null): Tone =>
  p === "urgente" ? "red" : p === "alta" ? "amber" : "gray";

const COLS: { key: string; label: string }[] = [
  { key: "pendente", label: "Pendente" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida", label: "Concluída" },
];

export function TarefasBoard({ tarefas }: { tarefas: Tarefa[] }) {
  const { open } = useDrawer();

  return (
    <div className="kanban">
      {COLS.map((col) => {
        const itens = tarefas.filter((t) => t.status === col.key);
        return (
          <div className="kcol" key={col.key}>
            <div className="kcol-h">
              <span>{col.label}</span>
              <span className="ct">{itens.length}</span>
            </div>
            <div className="kcol-b">
              {itens.length ? (
                itens.map((t) => (
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
                        body: (
                          <>
                            <div className="dsec">
                              <h4>Descrição</h4>
                              <div className="field"><div className="v">{t.descricao ?? "—"}</div></div>
                            </div>
                            <div className="dsec">
                              <h4>Dados</h4>
                              <div className="dgrid">
                                <div className="field"><div className="k">Status</div><div className="v">{humano(t.status)}</div></div>
                                <div className="field"><div className="k">Prioridade</div><div className="v">{humano(t.prioridade)}</div></div>
                                <div className="field"><div className="k">Responsável</div><div className="v">{t.responsavel ?? "—"}</div></div>
                                <div className="field"><div className="k">Data limite</div><div className="v mono">{fmtDate(t.data_limite)}</div></div>
                              </div>
                            </div>
                          </>
                        ),
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
                ))
              ) : (
                <div className="empty">—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

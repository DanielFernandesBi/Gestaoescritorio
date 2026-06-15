"use client";

import { useDrawer } from "@/components/Drawer";
import { Pill } from "@/components/ui";
import { Acao } from "@/components/Acao";
import { FormModal } from "@/components/FormModal";
import { moverTarefa, atualizarTarefa } from "@/app/actions";
import { PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";
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
                            <div className="dsec">
                              <h4>Editar</h4>
                              <div className="acoes">
                                <FormModal label="Editar tarefa" titulo="Editar tarefa" acao={atualizarTarefa.bind(null, t.id)} enviarLabel="Salvar" variant="default">
                                  <div><label>Título</label><input name="titulo" required defaultValue={t.titulo} /></div>
                                  <div><label>Descrição</label><textarea name="descricao" defaultValue={t.descricao ?? ""} /></div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <div><label>Prioridade</label><select name="prioridade" defaultValue={t.prioridade ?? "media"}>{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
                                    <div><label>Responsável</label><select name="responsavel" defaultValue={t.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                                  </div>
                                  <div><label>Data limite</label><input type="date" name="data_limite" defaultValue={t.data_limite?.slice(0, 10) ?? ""} /></div>
                                </FormModal>
                              </div>
                            </div>
                            <div className="dsec">
                              <h4>Mover</h4>
                              <div className="acoes">
                                {t.status !== "em_andamento" && (
                                  <Acao label="Em andamento" titulo="Mover tarefa"
                                    resumo={<>Mover <b>{t.titulo}</b> para <b>em andamento</b>?</>}
                                    acao={() => moverTarefa(t.id, "em_andamento")} />
                                )}
                                {t.status !== "concluida" && (
                                  <Acao label="Concluir" variant="ok" titulo="Concluir tarefa"
                                    resumo={<>Marcar <b>{t.titulo}</b> como <b>concluída</b>?</>}
                                    acao={() => moverTarefa(t.id, "concluida")} />
                                )}
                                {t.status !== "pendente" && (
                                  <Acao label="Voltar p/ pendente" titulo="Reabrir tarefa"
                                    resumo={<>Voltar <b>{t.titulo}</b> para <b>pendente</b>?</>}
                                    acao={() => moverTarefa(t.id, "pendente")} />
                                )}
                                <Acao label="Cancelar" variant="danger" titulo="Cancelar tarefa"
                                  resumo={<>Cancelar <b>{t.titulo}</b>?</>}
                                  acao={() => moverTarefa(t.id, "cancelada")} />
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

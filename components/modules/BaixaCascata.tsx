"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { baixarProtocoloPeca, type CascataBaixa, type TarefaPendenteRelacionada } from "@/app/actions";
import { humano } from "@/lib/format";

const ddmmyy = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const hojeISO = () => new Date().toISOString().slice(0, 10);

/**
 * Sugestão 93 / Migração 70 — Nível 2 da cascata. Após uma baixa, a fn_baixa_ato
 * pode devolver conferências AUTOMÁTICAS do mesmo processo (janela de dias) que ela
 * NÃO fechou. Doutrina: nada fora do ato exato se conclui em silêncio — este modal
 * pede confirmação humana explícita e rechama a baixa da MESMA peça com as marcadas
 * como p_tarefas_extra (idempotente: não duplica andamento nem sobrescreve datas).
 *
 * Uso: const { raise, node } = useBaixaCascata(); …após a baixa: raise(pecaId, r.cascata, data);
 * e renderize {node}. raise() retorna true se abriu o modal (havia pendentes).
 */
export function useBaixaCascata(onDone?: () => void) {
  const router = useRouter();
  const [pecaId, setPecaId] = useState<string | null>(null);
  const [data, setData] = useState<string>(hojeISO());
  const [itens, setItens] = useState<TarefaPendenteRelacionada[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [pend, setPend] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const raise = useCallback((pid: string, cascata?: CascataBaixa, dataProtocolo?: string): boolean => {
    const rel = cascata?.tarefasPendentesRelacionadas ?? [];
    if (!rel.length) return false;
    setPecaId(pid);
    setData(dataProtocolo || hojeISO());
    setItens(rel);
    setMarcados(new Set());
    setErro(null);
    return true;
  }, []);

  const fechar = useCallback(() => { setPecaId(null); setItens([]); setMarcados(new Set()); setErro(null); }, []);
  const toggle = (id: string) => setMarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function confirmar() {
    if (!pecaId) return;
    const ids = [...marcados];
    if (!ids.length) { fechar(); return; }
    setPend(true); setErro(null);
    const r = await baixarProtocoloPeca(pecaId, undefined, { tarefasExtra: ids, dataProtocolo: data });
    setPend(false);
    if (r.ok) { fechar(); router.refresh(); onDone?.(); }
    else setErro(r.message);
  }

  const node = pecaId ? (
    <div className="modal-scrim" onClick={fechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>Conferências do mesmo processo ainda pendentes</h3>
          <p>Estas conferências automáticas do mesmo processo continuam pendentes — alguma foi resolvida por este protocolo? Marque só as que este ato resolveu. Nada é concluído sem sua confirmação.</p>
        </div>
        <div className="modal-b">
          <div className="bx-lista">
            {itens.map((t) => (
              <label key={t.tarefa_id} className="bx-item opt">
                <input type="checkbox" checked={marcados.has(t.tarefa_id)} onChange={() => toggle(t.tarefa_id)} />
                <div className="bx-item-main">
                  <div className="bx-item-t">
                    {t.titulo}
                    {t.prioridade && <span className={`bx-prio ${t.prioridade}`}>{humano(t.prioridade)}</span>}
                  </div>
                  <div className="bx-item-s">{t.tipo_andamento ? humano(t.tipo_andamento) : "andamento"} · {ddmmyy(t.data_andamento)}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="bx-info amber">Só as marcadas são concluídas (com o motivo anotado pela função). As demais seguem pendentes.</div>
          {erro && <div className="modal-msg err">{erro}</div>}
        </div>
        <div className="modal-f">
          <button className="btn ghost" type="button" onClick={fechar} disabled={pend}>Nenhuma</button>
          <button className="btn primary" type="button" onClick={confirmar} disabled={pend || !marcados.size}>
            {pend ? "Concluindo…" : `Concluir selecionada(s)${marcados.size ? ` (${marcados.size})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { raise, node };
}

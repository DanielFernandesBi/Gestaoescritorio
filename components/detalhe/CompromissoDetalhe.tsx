"use client";

import { ProcRef, SegredoTag } from "@/components/ui";
import { Acao } from "@/components/Acao";
import { cancelarCompromisso } from "@/app/actions";
import { fmtDate, fmtTime } from "@/lib/format";
import type { Compromisso } from "@/lib/data";

/** Corpo de detalhe de um compromisso — drawer por rota e página /compromissos/[id]. */
export function CompromissoDetalhe({ c }: { c: Compromisso }) {
  return (
    <>
      <div className="dsec">
        <h4>Quando</h4>
        <div className="dgrid">
          <div className="field"><div className="k">Data</div><div className="v mono">{fmtDate(c.data_hora)}</div></div>
          <div className="field"><div className="k">Hora</div><div className="v mono">{fmtTime(c.data_hora)}</div></div>
          <div className="field"><div className="k">Responsável</div><div className="v">{c.responsavel ?? "—"}</div></div>
          <div className="field"><div className="k">Local</div><div className="v">{c.local ?? "—"}</div></div>
        </div>
      </div>

      {c.descricao && (
        <div className="dsec">
          <h4>Descrição</h4>
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>{c.descricao}</p>
        </div>
      )}

      <div className="dsec">
        <h4>Vínculos</h4>
        <div className="mini">
          <div>
            <div className="mt">
              {c.processo_id ? (
                <ProcRef cnj={c.numero_cnj} registro={c.numero_registro} id={c.processo_id} />
              ) : (
                <span className="sub">Sem processo vinculado</span>
              )}{" "}
              <SegredoTag on={c.segredo} />
            </div>
            <div className="ms">{c.cliente ?? "Sem cliente vinculado"}</div>
          </div>
        </div>
      </div>

      {c.status !== "cancelado" && (
        <div className="dsec">
          <h4>Ações</h4>
          <div className="acoes">
            <Acao
              label="Cancelar compromisso"
              variant="danger"
              titulo="Cancelar compromisso"
              confirmarLabel="Cancelar"
              resumo={<>Cancelar <b>{c.titulo}</b>? O registro não é apagado — muda para <b>cancelado</b>.</>}
              acao={() => cancelarCompromisso(c.id)}
            />
          </div>
        </div>
      )}
    </>
  );
}

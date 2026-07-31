"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { promoverAndamentoParaIntimacao, type Resultado } from "@/app/actions";
import { linkPara } from "@/lib/links";

/**
 * "Transformar em intimação" para os cards de Andamentos. Promove a movimentação à
 * porta de entrada canônica (intimação · pendente) e leva o usuário ao drawer da
 * intimação, onde o pipeline segue por "Encaminhar → prazo". Mais fiel ao fluxo do
 * manual que o atalho "Transformar em prazo" (que lança o prazo direto). Só aparece
 * quando o andamento tem processo. O andamento é preservado; tudo auditado.
 */
export function PromoverIntimacao({
  andamentoId,
  className = "btn sm",
  label,
}: {
  andamentoId: string;
  className?: string;
  label?: React.ReactNode;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  async function confirmar() {
    setPend(true);
    const r = await promoverAndamentoParaIntimacao(andamentoId);
    setPend(false);
    setRes(r);
    if (r.ok && r.intimacaoId) {
      router.push(linkPara("intimacao", r.intimacaoId));
    } else if (r.ok) {
      router.refresh();
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={() => { setAberto(true); setRes(null); }}>
        {label ?? "→ Transformar em intimação"}
      </button>
      {aberto && (
        <div className="modal-scrim" onClick={() => setAberto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>Transformar em intimação</h3>
              <p>Promove esta movimentação à <b>porta de entrada canônica</b> — uma intimação <b>pendente</b> no processo deste andamento. Em seguida você é levado à intimação para <b>Encaminhar → prazo</b>.</p>
            </div>
            <div className="modal-b">
              <p className="sub" style={{ margin: 0 }}>
                A intimação nasce com o teor desta movimentação; datas de ciência/disponibilização e prazo legal você
                ajusta na triagem da intimação (a ciência que dispara o prazo é decisão sua). O andamento é preservado —
                nada é apagado, tudo auditado.
              </p>
              {res && <div className={`modal-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
            </div>
            <div className="modal-f">
              <button className="btn ghost" type="button" onClick={() => setAberto(false)} disabled={pend}>Cancelar</button>
              <button className="btn primary" type="button" onClick={confirmar} disabled={pend || Boolean(res?.ok)}>
                {pend ? "Promovendo…" : "Promover a intimação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

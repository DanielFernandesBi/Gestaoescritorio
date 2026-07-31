"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarPrazoDeAndamento, type Resultado } from "@/app/actions";
import { TIPO_CONTAGEM, RESPONSAVEIS } from "@/lib/enums";
import { humano } from "@/lib/format";

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as const;

/**
 * "Transformar em prazo" para os cards de Andamentos. A maioria das capturas por
 * push vira andamento; quando a automação não promoveu (ou o ato exige controle de
 * prazo pela defesa), o humano lança o prazo OFICIAL daqui — em paralelo ao "Criar
 * petição pendente" (que só cria peça no kanban). O prazo nasce PROVISÓRIO (a validar).
 * Só aparece quando o andamento tem processo (prazo exige processo).
 */
export function CriarPrazoDeAndamento({
  andamentoId,
  atoSugerido,
  className = "btn sm",
  label,
}: {
  andamentoId: string;
  atoSugerido: string;
  className?: string;
  label?: React.ReactNode;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPend(true);
    const r = await criarPrazoDeAndamento(andamentoId, fd);
    setPend(false);
    setRes(r);
    if (r.ok) {
      router.refresh();
      setTimeout(() => setAberto(false), 1000);
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={() => { setAberto(true); setRes(null); }}>
        {label ?? "⏱ Transformar em prazo"}
      </button>
      {aberto && (
        <div className="modal-scrim" onClick={() => setAberto(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
            <div className="modal-h">
              <h3>Transformar em prazo</h3>
              <p>Lança um prazo oficial a partir desta movimentação (útil quando o push virou só andamento). Nasce <b>provisório · a validar</b>, no processo deste andamento.</p>
            </div>
            <div className="modal-b">
              <div><label>Ato</label><input name="ato" required defaultValue={atoSugerido} /></div>
              <div style={grid2}>
                <div><label>Data fatal</label><input type="date" name="data_fatal" required /></div>
                <div><label>Data interna (opcional)</label><input type="date" name="data_interna" /></div>
              </div>
              <div style={grid2}>
                <div><label>Contagem</label><select name="tipo_contagem" defaultValue="corridos">{TIPO_CONTAGEM.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
                <div><label>Responsável</label><select name="responsavel" defaultValue="Daniel">{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
              </div>
              <div><label>Observação (opcional)</label><textarea name="observacoes" placeholder="Ex.: prazo da defesa; conferir ciência/feriados locais." /></div>
              <p className="sub" style={{ margin: 0 }}>
                Prazos penais costumam correr em dias corridos — confira a data de ciência e feriados locais. A origem
                (este andamento) fica registrada na observação para auditoria.
              </p>
              {res && <div className={`modal-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
            </div>
            <div className="modal-f">
              <button className="btn ghost" type="button" onClick={() => setAberto(false)} disabled={pend}>Cancelar</button>
              <button className="btn primary" type="submit" disabled={pend || Boolean(res?.ok)}>
                {pend ? "Lançando…" : "Lançar prazo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

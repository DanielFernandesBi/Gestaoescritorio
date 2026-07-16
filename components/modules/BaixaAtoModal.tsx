"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { baixarAtoPeca, baixarProtocoloPeca, type ResultadoBaixa } from "@/app/actions";
import { useBaixaCascata } from "@/components/modules/BaixaCascata";
import { humano } from "@/lib/format";

type Ctx = {
  peca: { id: string; titulo: string; status: string; processo_id: string | null; segredo: boolean } | null;
  prazo: { id: string; ato: string; data_fatal: string | null; status: string } | null;
  tarefa: { id: string; titulo: string; status: string } | null;
  intimacao: { id: string; resumo: string | null; status: string | null } | null;
  gemeasConfirmadas: boolean;
  gemeas: { intimacao_id: string; origem: string | null; status: string | null; amostra: string | null }[];
};

const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const hojeISO = () => new Date().toISOString().slice(0, 10);
const fonteAto = (o: string | null) => {
  const f = (o ?? "").toLowerCase();
  return f === "djen" ? "DJEN" : f === "dje" ? "DJE" : f === "push" ? "e-mail push" : f === "email" ? "e-mail" : (o ? o.toUpperCase() : "—");
};

/**
 * Modal "Protocolei / dar baixa" (Sug. 75 · etapa 5 · F4). Lista o que será fechado
 * em checkboxes (prazo, tarefa, intimação) — todos marcados por padrão. Tudo marcado
 * = fn_baixa_ato (cascata). Desmarcar algo cai no caminho granular (fecha só o
 * marcado). Gêmeas confirmadas convergem sozinhas; candidatas não confirmadas viram
 * opcionais (p_intimacoes_extra). Recibo ao final; nada é fechado fora do listado.
 */
export function BaixaAtoModal({ pecaId, titulo, label, className = "btn sm" }: {
  pecaId: string; titulo: string; label?: React.ReactNode; className?: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [fecharPrazo, setFecharPrazo] = useState(true);
  const [fecharTarefa, setFecharTarefa] = useState(true);
  const [fecharIntim, setFecharIntim] = useState(true);
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [data, setData] = useState(hojeISO());
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<ResultadoBaixa | null>(null);
  const { raise, node: cascataNode } = useBaixaCascata();

  async function abrir() {
    setAberto(true); setRes(null); setCarregando(true);
    setFecharPrazo(true); setFecharTarefa(true); setFecharIntim(true); setExtras(new Set()); setData(hojeISO());
    try {
      const c = await fetch(`/api/peca-baixa/${pecaId}`).then((r) => r.json()).catch(() => null);
      setCtx(c);
    } finally { setCarregando(false); }
  }

  const temPrazo = Boolean(ctx?.prazo);
  const temTarefa = Boolean(ctx?.tarefa);
  const temIntim = Boolean(ctx?.intimacao);
  // Desmarcar um vínculo existente ⇒ caminho granular (não usa a função).
  const granular = (temPrazo && !fecharPrazo) || (temTarefa && !fecharTarefa) || (temIntim && !fecharIntim);

  async function confirmar() {
    setPend(true);
    let r: ResultadoBaixa;
    if (granular) {
      r = await baixarProtocoloPeca(pecaId, undefined, {
        pularPrazo: temPrazo && !fecharPrazo,
        pularTarefa: temTarefa && !fecharTarefa,
        pularIntimacao: temIntim && !fecharIntim,
        dataProtocolo: data,
      });
    } else {
      r = await baixarAtoPeca(pecaId, [...extras], data);
    }
    setPend(false); setRes(r);
    if (r.ok) {
      router.refresh();
      // Nível 2: se a função apontou conferências pendentes do mesmo processo,
      // pede confirmação humana explícita (nunca conclui em silêncio).
      raise(pecaId, r.cascata, data);
    }
  }

  const toggleExtra = (id: string) => setExtras((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <button type="button" className={className} onClick={abrir}>{label ?? "Protocolei / dar baixa"}</button>
      {aberto && (
        <div className="modal-scrim" onClick={() => setAberto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>Protocolei / dar baixa</h3>
              <p>Confirme o que será fechado em cascata a partir de <b>{titulo}</b>{ctx?.peca?.segredo ? " 🔒" : ""}. Nada é fechado fora do que você marcar aqui.</p>
            </div>
            <div className="modal-b">
              {carregando || !ctx ? (
                <div className="empty">Carregando vínculos…</div>
              ) : !ctx.peca ? (
                <div className="modal-msg err">Peça não encontrada.</div>
              ) : res?.ok ? (
                <div className="bx-recibo">
                  <div className="bx-recibo-h">✓ {res.message}</div>
                  {ctx.peca.processo_id && <Link className="link" href={`/producao?peca=${pecaId}`}>Abrir a peça no módulo Produção</Link>}
                </div>
              ) : (
                <>
                  {!temPrazo && !temTarefa && !temIntim && (
                    <div className="bx-orfa">⚠ Esta peça não tem prazo, tarefa nem intimação vinculados. A baixa só registra o protocolo e marca a peça como protocolada. Você pode <Link className="link" href={`/producao?peca=${pecaId}`}>vincular processo/prazo/intimação</Link> e rebaixar depois (é seguro, não duplica).</div>
                  )}

                  <div className="bx-lista">
                    {temPrazo && (
                      <label className="bx-item">
                        <input type="checkbox" checked={fecharPrazo} onChange={(e) => setFecharPrazo(e.target.checked)} />
                        <div className="bx-item-main">
                          <div className="bx-item-t">Prazo vinculado → <b>cumprido</b></div>
                          <div className="bx-item-s">{ctx.prazo!.ato.split(/\s*[—–[]/)[0].trim()} · fatal {ddmm(ctx.prazo!.data_fatal)}</div>
                        </div>
                      </label>
                    )}
                    {temTarefa && (
                      <label className="bx-item">
                        <input type="checkbox" checked={fecharTarefa} onChange={(e) => setFecharTarefa(e.target.checked)} />
                        <div className="bx-item-main">
                          <div className="bx-item-t">Tarefa vinculada → <b>concluída</b></div>
                          <div className="bx-item-s">{ctx.tarefa!.titulo} · {humano(ctx.tarefa!.status)}</div>
                        </div>
                      </label>
                    )}
                    {temIntim && (
                      <label className="bx-item">
                        <input type="checkbox" checked={fecharIntim} onChange={(e) => setFecharIntim(e.target.checked)} />
                        <div className="bx-item-main">
                          <div className="bx-item-t">Intimação vinculada → <b>providência tomada</b></div>
                          <div className="bx-item-s">{(ctx.intimacao!.resumo ?? "Intimação").slice(0, 80)} · {humano(ctx.intimacao!.status)}</div>
                        </div>
                      </label>
                    )}
                  </div>

                  {ctx.gemeasConfirmadas && (
                    <div className="bx-info">✓ Gêmeas confirmadas — as demais fontes convergem automaticamente pelo trigger; não é preciso marcá-las.</div>
                  )}

                  {!granular && ctx.gemeas.length > 0 && (
                    <div className="bx-gemeas">
                      <div className="bx-gemeas-h">Gêmeas candidatas (não confirmadas) — marque para resolver junto:</div>
                      {ctx.gemeas.map((g) => (
                        <label key={g.intimacao_id} className="bx-item opt">
                          <input type="checkbox" checked={extras.has(g.intimacao_id)} onChange={() => toggleExtra(g.intimacao_id)} />
                          <div className="bx-item-main">
                            <div className="bx-item-t">{fonteAto(g.origem)} · {humano(g.status)}</div>
                            <div className="bx-item-s">{(g.amostra ?? "—").slice(0, 90)}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {granular && (
                    <div className="bx-info amber">Item desmarcado — a baixa fechará <b>só o que ficou marcado</b> (caminho granular). As gêmeas extras só entram quando tudo está marcado.</div>
                  )}

                  <div className="bx-data">
                    <label>Data do protocolo</label>
                    <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  </div>

                  {res && !res.ok && <div className="modal-msg err">{res.message}</div>}
                </>
              )}
            </div>
            <div className="modal-f">
              <button className="btn ghost" type="button" onClick={() => setAberto(false)} disabled={pend}>{res?.ok ? "Fechar" : "Cancelar"}</button>
              {!carregando && ctx?.peca && !res?.ok && (
                <button className="btn primary" type="button" onClick={confirmar} disabled={pend}>
                  {pend ? "Dando baixa…" : "Confirmar baixa"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {cascataNode}
    </>
  );
}

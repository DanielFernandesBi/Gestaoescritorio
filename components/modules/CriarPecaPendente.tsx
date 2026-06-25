"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { criarPecaDeOrigem, type Resultado } from "@/app/actions";
import { PECA_TIPO, PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";
import { humano } from "@/lib/format";
import { sugerirPeca, type MapaProvidencia } from "@/lib/pecas";

type TipoOrigem = "andamento" | "intimacao" | "tarefa";
type Lite = { id: string; label: string };
type PecaExistente = { id: string; titulo: string; status: string };

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as const;

/**
 * Botão "Criar petição pendente" para as telas de Andamentos/Intimações/Tarefas.
 * Abre o formulário de peça PRÉ-PREENCHIDO a partir do item (sugestão pelo mapa
 * providência→peça). Cliente, processo e prazo são herdados no servidor. Dedup por
 * origem: se já existir peça, aponta a existente em vez de criar outra.
 */
export function CriarPecaPendente({
  tipoOrigem,
  origemId,
  texto,
  mapa,
  baseTitulo,
  label,
  className = "btn sm",
}: {
  tipoOrigem: TipoOrigem;
  origemId: string;
  texto: string | null | undefined;
  mapa: MapaProvidencia | null;
  baseTitulo?: string | null;
  label?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const sug = sugerirPeca(texto, mapa);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [existente, setExistente] = useState<PecaExistente | null>(null);
  const [prazos, setPrazos] = useState<Lite[]>([]);

  // Movimentação meramente informativa (mapa "ignorar") → não oferece criar peça.
  if (sug?.ignorar) {
    return <span className="sub">Movimentação informativa — sem peça a produzir.</span>;
  }

  const tipoSug = sug?.tipo ?? "manifestacao";
  const subSug = sug?.subtipo ?? "";
  const tituloSug = (subSug || baseTitulo || humano(tipoSug)).trim();

  async function abrir() {
    setAberto(true);
    setRes(null);
    setExistente(null);
    setCarregando(true);
    try {
      const [pe, pl] = await Promise.all([
        fetch(`/api/peca-por-origem?tipo=${tipoOrigem}&id=${origemId}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/prazos-lite`).then((r) => r.json()).catch(() => ({})),
      ]);
      setExistente(pe?.peca ?? null);
      setPrazos(pl?.prazos ?? []);
    } finally {
      setCarregando(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPend(true);
    const r = await criarPecaDeOrigem(tipoOrigem, origemId, fd);
    setPend(false);
    setRes(r);
    if (r.ok) {
      router.refresh();
      setTimeout(() => setAberto(false), 1000);
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={abrir}>{label ?? "+ Criar petição pendente"}</button>
      {aberto && (
        <div className="modal-scrim" onClick={() => setAberto(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
            <div className="modal-h">
              <h3>Criar petição pendente</h3>
              <p>Captura a peça a produzir a partir deste item, sem redigitar. Cliente, processo e prazo são herdados da origem.</p>
            </div>
            <div className="modal-b">
              {carregando ? (
                <div className="empty">Carregando…</div>
              ) : existente ? (
                <div className="modal-resumo">
                  Já existe uma peça para esta origem: <b>{existente.titulo}</b> ({humano(existente.status)}).{" "}
                  <Link className="link" href={`/producao?peca=${existente.id}`}>Abrir no módulo Produção</Link>. Não criamos outra (dedup).
                </div>
              ) : (
                <>
                  <div><label>Título</label><input name="titulo" required defaultValue={tituloSug} /></div>
                  <div style={grid2}>
                    <div><label>Tipo</label><select name="tipo" defaultValue={tipoSug}>{PECA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
                    <div><label>Subtipo</label><input name="subtipo" defaultValue={subSug} placeholder="apelação, RESE, HC…" /></div>
                  </div>
                  <div style={grid2}>
                    <div><label>Prioridade</label><select name="prioridade" defaultValue="media">{PRIORIDADES.map((p) => <option key={p} value={p}>{humano(p)}</option>)}</select></div>
                    <div><label>Responsável</label><select name="responsavel" defaultValue="Daniel">{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                  </div>
                  <div>
                    <label>Prazo vinculado</label>
                    <select name="prazo_id" defaultValue="">
                      <option value="">— herdar automaticamente o prazo aberto do processo —</option>
                      {prazos.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </div>
                  <div style={grid2}>
                    <div><label>Data alvo (opcional)</label><input type="date" name="data_alvo" /></div>
                    <div><label>Drive (id da minuta)</label><input name="drive_file_id" placeholder="opcional" /></div>
                  </div>
                  <div><label>Descrição</label><textarea name="descricao" defaultValue={texto ?? ""} /></div>
                  <p className="sub" style={{ margin: 0 }}>
                    Tipo/subtipo sugeridos pelo mapa providência→peça; edite à vontade. Se a origem veio da automação,
                    a peça nasce provisória (validado=false) para conferência no módulo Produção.
                  </p>
                </>
              )}
              {res && <div className={`modal-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
            </div>
            <div className="modal-f">
              <button className="btn ghost" type="button" onClick={() => setAberto(false)} disabled={pend}>Fechar</button>
              {!existente && !carregando && (
                <button className="btn primary" type="submit" disabled={pend || Boolean(res?.ok)}>
                  {pend ? "Salvando…" : "Criar peça"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  );
}

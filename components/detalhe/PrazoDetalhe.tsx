"use client";

import { useEffect, useState } from "react";
import { ProcRef } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { Acao } from "@/components/Acao";
import { FormModal } from "@/components/FormModal";
import {
  validarPrazo, baixarPrazo, cancelarPrazo, atualizarPrazo,
  criarTarefa, criarPeca, vincularClienteProcesso,
} from "@/app/actions";
import { TIPO_CONTAGEM, RESPONSAVEIS, PRIORIDADES, PECA_TIPO, PAPEL } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import type { Prazo } from "@/lib/data";

/**
 * Corpo de detalhe de um prazo — usado tanto no drawer (PrazosList) quanto na
 * página canônica /prazos/[id].
 */
export function PrazoDetalhe({ p }: { p: Prazo }) {
  const [clientesLite, setClientesLite] = useState<{ id: string; nome: string }[]>([]);
  const dataAlvo = (p.data_interna ?? p.data_fatal)?.slice(0, 10);

  useEffect(() => {
    if (!p.processo_id) return;
    let vivo = true;
    fetch("/api/clientes-lite")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => vivo && setClientesLite(d.clientes ?? []))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [p.processo_id]);

  return (
    <>
      <div className="dsec">
        <h4>Contagem</h4>
        <div className="dgrid">
          <div className="field">
            <div className="k">Data fatal</div>
            <div className="v mono" style={{ color: "var(--red)" }}>{fmtDate(p.data_fatal)}</div>
          </div>
          <div className="field">
            <div className="k">Data interna</div>
            <div className="v mono">{fmtDate(p.data_interna)}</div>
          </div>
          <div className="field">
            <div className="k">Tipo de contagem</div>
            <div className="v">{humano(p.tipo_contagem)} (CPP art. 798)</div>
          </div>
          <div className="field">
            <div className="k">Responsável</div>
            <div className="v">{p.responsavel ?? "—"}</div>
          </div>
        </div>
      </div>
      <div className="dsec">
        <h4>Processo</h4>
        <div className="mini">
          <div>
            <div className="mt">
              <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} id={p.processo_id} />
            </div>
            <div className="ms">{[p.tribunal, p.vara_comarca].filter(Boolean).join(" · ") || "—"}</div>
            <div className="ms">{p.clientes || "—"}</div>
          </div>
        </div>
      </div>
      <div className="dsec">
        <h4>Atenção</h4>
        <div className="banner" style={{ margin: 0 }}>
          <span className="ico"><Icon name="shield" /></span>
          <div>
            Prazo penal em <b>dias corridos</b>. Conferir feriado local e
            suspensão de expediente no tribunal antes de confiar na data fatal.
          </div>
        </div>
      </div>

      <div className="dsec">
        <h4>Ações</h4>
        <div className="acoes">
          <FormModal label="Editar prazo" titulo="Editar prazo" acao={atualizarPrazo.bind(null, p.id)} enviarLabel="Salvar" variant="default">
            <div><label>Ato</label><input name="ato" required defaultValue={p.ato} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Data fatal</label><input type="date" name="data_fatal" required defaultValue={p.data_fatal?.slice(0, 10)} /></div>
              <div><label>Data interna</label><input type="date" name="data_interna" defaultValue={p.data_interna?.slice(0, 10) ?? ""} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Contagem</label><select name="tipo_contagem" defaultValue={p.tipo_contagem ?? "corridos"}>{TIPO_CONTAGEM.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
          </FormModal>
          {!p.validado && !p.orfao && (
            <Acao
              label="Validar"
              variant="primary"
              titulo="Validar prazo"
              confirmarLabel="Validar"
              resumo={<>Marcar <b>{p.ato}</b> como validado e criar o marcador fatal (vermelho) no Google Calendar?</>}
              acao={() => validarPrazo(p.id)}
            />
          )}
          {p.orfao && (
            <span className="sub" style={{ color: "var(--amber)" }}>
              ⚠ Prazo órfão (sem processo). Use a aba <b>Órfãos / triagem</b> para promover antes de validar.
            </span>
          )}
          <Acao
            label="Dar baixa (cumprido)"
            variant="ok"
            titulo="Dar baixa no prazo"
            confirmarLabel="Dar baixa"
            resumo={<>Marcar <b>{p.ato}</b> como <b>cumprido</b> (data de hoje) e registrar um andamento no processo?</>}
            campoTexto={{ label: "Andamento (opcional)", placeholder: "Ex.: Protocolada a petição de razões de apelação.", multiline: true }}
            acao={(t) => baixarPrazo(p.id, t)}
          />
          <Acao
            label="Cancelar prazo"
            variant="danger"
            titulo="Cancelar prazo"
            confirmarLabel="Cancelar prazo"
            resumo={<>Cancelar <b>{p.ato}</b>? O registro não é apagado — muda para status <b>cancelado</b> (auditado).</>}
            campoTexto={{ label: "Motivo", placeholder: "Ex.: prazo duplicado / intimação revista.", obrigatorio: true }}
            acao={(t) => cancelarPrazo(p.id, t)}
          />
        </div>
      </div>

      <div className="dsec">
        <h4>Atalhos</h4>
        <div className="acoes">
          <FormModal
            label={<><Icon name="list" size={14} /> Criar tarefa</>}
            titulo="Nova tarefa deste prazo"
            descricao="Cria uma tarefa já vinculada ao processo do prazo."
            acao={criarTarefa}
            enviarLabel="Criar tarefa"
            variant="default"
          >
            <input type="hidden" name="processo_id" defaultValue={p.processo_id ?? ""} />
            <div><label>Título</label><input name="titulo" required defaultValue={p.ato} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Prioridade</label><select name="prioridade" defaultValue="alta">{PRIORIDADES.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
              <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
            <div><label>Prazo (data limite)</label><input type="date" name="data_limite" defaultValue={dataAlvo} /></div>
            <div><label>Descrição</label><textarea name="descricao" placeholder="Detalhes da tarefa." /></div>
          </FormModal>

          <FormModal
            label={<><Icon name="book" size={14} /> Produção de peça</>}
            titulo="Nova peça (produção)"
            descricao="Abre uma peça no backlog já ligada a este prazo e processo."
            acao={criarPeca}
            enviarLabel="Criar peça"
            variant="default"
          >
            <input type="hidden" name="processo_id" defaultValue={p.processo_id ?? ""} />
            <input type="hidden" name="prazo_id" defaultValue={p.id} />
            <div><label>Título</label><input name="titulo" required defaultValue={p.ato} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Tipo</label><select name="tipo" defaultValue="outra">{PECA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
              <div><label>Prioridade</label><select name="prioridade" defaultValue="alta">{PRIORIDADES.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
              <div><label>Data alvo</label><input type="date" name="data_alvo" defaultValue={dataAlvo} /></div>
            </div>
            <div><label>Descrição</label><textarea name="descricao" placeholder="Tese / observações." /></div>
          </FormModal>

          {p.processo_id && (
            <FormModal
              label={<><Icon name="users" size={14} /> Vincular cliente</>}
              titulo="Vincular cliente ao processo"
              descricao="Use se a extração trouxe o cliente errado ou faltando."
              acao={vincularClienteProcesso.bind(null, p.processo_id)}
              enviarLabel="Vincular"
              variant="default"
            >
              <div>
                <label>Cliente</label>
                <select name="cliente_id" required defaultValue="">
                  <option value="" disabled>Selecione…</option>
                  {clientesLite.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div><label>Papel</label><select name="papel" defaultValue="reu">{PAPEL.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
            </FormModal>
          )}
        </div>
      </div>
    </>
  );
}

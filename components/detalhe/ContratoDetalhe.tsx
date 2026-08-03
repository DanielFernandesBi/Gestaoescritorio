"use client";

import { Pill, Observacoes } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { DocumentosCaso } from "@/components/detalhe/DocumentosCaso";
import { marcarPago, atualizarContrato, criarParcela } from "@/app/actions";
import { CONTRATO_STATUS } from "@/lib/enums";
import { fmtBRL, fmtDate, humano } from "@/lib/format";
import type { Contrato, Documento } from "@/lib/data";

const TONE: Record<string, "green" | "amber" | "red" | "gray"> = {
  vigente: "green", quitado: "gray", rescindido: "red", inadimplente: "red",
};

export function ContratoDetalhe({ contrato: c, documentos = [] }: { contrato: Contrato; documentos?: Documento[] }) {
  const socio = c.valor_total / 2;
  return (
    <>
      <div className="dsec">
        <h4>Objeto da contratação</h4>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: "var(--text)" }}>{c.objeto}</p>
        <Observacoes texto={c.observacoes} />
      </div>

      <div className="dsec">
        <h4>Dados</h4>
        <div className="dgrid">
          <div className="field"><div className="k">Cliente</div><div className="v">{c.cliente}</div></div>
          <div className="field"><div className="k">Contratante</div><div className="v">{c.contratante ?? "—"}</div></div>
          <div className="field"><div className="k">Forma de pagamento</div><div className="v">{c.forma_pagamento ?? "—"}</div></div>
          <div className="field"><div className="k">Data do contrato</div><div className="v">{fmtDate(c.data_contrato)}</div></div>
          <div className="field"><div className="k">Processo</div><div className="v mono">{c.processo_cnj ?? "—"}</div></div>
          <div className="field"><div className="k">Status</div><div className="v"><Pill tone={TONE[c.status] ?? "gray"}>{humano(c.status)}</Pill></div></div>
        </div>
      </div>

      <div className="dsec">
        <h4>Resumo financeiro</h4>
        <div className="kpis" style={{ gridTemplateColumns: "repeat(2,1fr)", margin: 0 }}>
          <div className="kpi"><div className="label">Valor total</div><div className="val" style={{ fontSize: 20 }}>{fmtBRL(c.valor_total)}</div></div>
          <div className="kpi green"><div className="accent" /><div className="label">Recebido</div><div className="val" style={{ fontSize: 20 }}>{fmtBRL(c.total_pago)}</div></div>
          <div className="kpi amber"><div className="accent" /><div className="label">Em aberto</div><div className="val" style={{ fontSize: 20 }}>{fmtBRL(c.total_aberto)}</div></div>
          <div className="kpi brass"><div className="accent" /><div className="label">Sócio (50%)</div><div className="val" style={{ fontSize: 20 }}>{fmtBRL(socio)}</div><div className="meta">rateio sobre o total</div></div>
        </div>
      </div>

      <div className="dsec">
        <h4>Gerir contrato</h4>
        <div className="acoes">
          <FormModal label="Editar contrato" titulo="Editar contrato" acao={atualizarContrato.bind(null, c.id)} enviarLabel="Salvar">
            <div><label>Objeto</label><textarea name="objeto" required defaultValue={c.objeto} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Valor total (R$)</label><input name="valor_total" defaultValue={String(c.valor_total)} /></div>
              <div><label>Status</label><select name="status" defaultValue={c.status}>{CONTRATO_STATUS.map((s) => <option key={s} value={s}>{humano(s)}</option>)}</select></div>
            </div>
            <div><label>Contratante</label><input name="contratante" defaultValue={c.contratante ?? ""} /></div>
            <div><label>Forma de pagamento</label><input name="forma_pagamento" defaultValue={c.forma_pagamento ?? ""} /></div>
            <div><label>Observações</label><textarea name="observacoes" defaultValue={c.observacoes ?? ""} /></div>
          </FormModal>
          <FormModal label="Adicionar parcela" titulo="Nova parcela" acao={criarParcela.bind(null, c.id)} enviarLabel="Adicionar" variant="default">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Nº parcela</label><input type="number" name="numero_parcela" min={0} defaultValue={c.qtd_parcelas + 1} /></div>
              <div><label>Valor (R$)</label><input name="valor" required /></div>
            </div>
            <div><label>Vencimento</label><input type="date" name="vencimento" required /></div>
            <div><label>Forma</label><input name="forma" placeholder="pix, transferência…" /></div>
          </FormModal>
        </div>
      </div>

      <div className="dsec">
        <h4>Parcelas ({c.parcelas.length})</h4>
        {c.parcelas.length ? (
          <table>
            <thead><tr><th className="center">#</th><th className="right">Valor</th><th>Vencimento</th><th>Pagamento</th><th className="right">Sócio 50%</th><th className="center">Status</th><th className="center">Ação</th></tr></thead>
            <tbody>
              {c.parcelas.map((p) => (
                <tr key={p.id}>
                  <td className="center mono">{p.numero_parcela}/{c.qtd_parcelas}</td>
                  <td className="right money">{fmtBRL(p.valor)}</td>
                  <td className="mono">{fmtDate(p.vencimento)}{p.dias_atraso > 0 && <div className="sub" style={{ color: "var(--red)" }}>{p.dias_atraso} dias</div>}</td>
                  <td className="mono">{p.pago_em ? <span style={{ color: "var(--green)" }}>{fmtDate(p.pago_em)}</span> : <span className="sub">—</span>}</td>
                  <td className="right money sub">{fmtBRL(p.valor / 2)}</td>
                  <td className="center"><Pill tone={p.status === "pago" ? "green" : p.status === "atrasado" ? "red" : p.status === "a_vencer" ? "amber" : "gray"}>{humano(p.status)}</Pill></td>
                  <td className="center">
                    {(p.status === "a_vencer" || p.status === "atrasado") && (
                      <Acao label="Marcar paga" variant="ok" titulo="Registrar pagamento" confirmarLabel="Marcar paga"
                        resumo={<>Registrar a parcela {p.numero_parcela} ({fmtBRL(p.valor)}) como <b>paga</b> hoje?</>}
                        acao={marcarPago.bind(null, p.id)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">Sem parcelas — use “Adicionar parcela”.</div>
        )}
      </div>

      <DocumentosCaso
        documentos={documentos}
        vinculo={{ campo: "contrato_id", id: c.id }}
        titulo="Documentos financeiros"
        tipoPadrao="outro"
      />
    </>
  );
}

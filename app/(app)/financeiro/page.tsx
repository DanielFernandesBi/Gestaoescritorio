import { getFinanceiro, getContratos, getDespesas, getClientes, getFechamentoMensal } from "@/lib/data";
import { Pill } from "@/components/ui";
import { Acao } from "@/components/Acao";
import { Icon } from "@/components/Icon";
import { FormModal } from "@/components/FormModal";
import { ContratosList } from "@/components/modules/ContratosList";
import { RowLink } from "@/components/RowLink";
import {
  marcarPago, rodarMarcarAtrasados, criarContrato, criarDespesa, marcarDespesaReembolsada,
} from "@/app/actions";
import { DESPESA_CATEGORIA } from "@/lib/enums";
import { linkPara } from "@/lib/links";
import { fmtBRL, fmtDate, humano } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const ym = new Date().toISOString().slice(0, 7);
  const [{ parcelas, totalReceber, totalAtraso }, contratos, despesas, clientes, fechamento] = await Promise.all([
    getFinanceiro(),
    getContratos(),
    getDespesas(),
    getClientes(),
    getFechamentoMensal(ym),
  ]);
  const mesLabel = new Date(`${ym}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const totalRecebido = contratos.reduce((s, c) => s + c.total_pago, 0);
  const contratosVigentes = contratos.filter((c) => c.status === "vigente").length;
  const despesasAbertas = despesas.filter((d) => d.reembolsavel && !d.reembolsada);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Honorários, contratos & despesas</div>
          <h1>Financeiro</h1>
          <p>
            Fonte da verdade no Supabase (contratos/parcelas). Clique num contrato para ler o objeto.
            Rode <b>fn_marcar_atrasados()</b> antes do fechamento.
          </p>
        </div>
        <div className="acoes">
          <FormModal label={<><Icon name="folder" size={15} /> Novo contrato</>} titulo="Novo contrato" acao={criarContrato} enviarLabel="Criar">
            <div><label>Cliente</label>
              <select name="cliente_id" required defaultValue="">
                <option value="" disabled>Selecione…</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div><label>Objeto da contratação</label><textarea name="objeto" required placeholder="Ex.: Defesa criminal (latrocínio); execução penal — progressão de regime…" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Valor total (R$)</label><input name="valor_total" required placeholder="30000 ou 30.000,00" /></div>
              <div><label>Data do contrato</label><input type="date" name="data_contrato" /></div>
            </div>
            <div><label>Contratante (se ≠ cliente)</label><input name="contratante" placeholder="Ex.: mãe do réu" /></div>
            <div><label>Forma de pagamento</label><input name="forma_pagamento" placeholder="Entrada + 3x; à vista; quinzenal…" /></div>
            <div><label>Observações</label><textarea name="observacoes" /></div>
          </FormModal>
          <FormModal label={<><Icon name="wallet" size={15} /> Nova despesa</>} titulo="Nova despesa" descricao="Custas, diligências, cópias…" acao={criarDespesa} enviarLabel="Lançar" variant="default">
            <div><label>Descrição</label><input name="descricao" required placeholder="Ex.: custas de apelação" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Valor (R$)</label><input name="valor" required /></div>
              <div><label>Categoria</label><select name="categoria" defaultValue="custas">{DESPESA_CATEGORIA.map((c) => <option key={c} value={c}>{humano(c)}</option>)}</select></div>
            </div>
            <div><label>Data</label><input type="date" name="data" /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" name="reembolsavel" defaultChecked style={{ width: "auto" }} /> Reembolsável pelo cliente
            </label>
            <div><label>Observações</label><textarea name="observacoes" /></div>
          </FormModal>
          <Acao
            label="Rodar fn_marcar_atrasados"
            variant="default"
            size="md"
            titulo="Marcar parcelas atrasadas"
            confirmarLabel="Rodar agora"
            resumo={<>Move para <b>atrasado</b> toda parcela <b>a_vencer</b> com vencimento anterior a hoje.</>}
            acao={rodarMarcarAtrasados}
          />
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <div className="kpi green"><div className="accent" /><div className="label">A receber (pendente)</div><div className="val" style={{ fontSize: 23 }}>{fmtBRL(totalReceber)}</div><div className="meta">{parcelas.length} parcelas em aberto</div></div>
        <div className="kpi red"><div className="accent" /><div className="label">Em atraso</div><div className="val" style={{ fontSize: 23 }}>{fmtBRL(totalAtraso)}</div><div className="meta">cobrança prioritária</div></div>
        <div className="kpi"><div className="label">Recebido (acumulado)</div><div className="val" style={{ fontSize: 23 }}>{fmtBRL(totalRecebido)}</div><div className="meta">parcelas pagas</div></div>
        <div className="kpi brass"><div className="accent" /><div className="label">Contratos vigentes</div><div className="val">{contratosVigentes}</div><div className="meta">{contratos.length} no total</div></div>
      </div>

      <div className="card section-gap">
        <div className="card-h"><h3><Icon name="wallet" /> Fechamento de {mesLabel}</h3></div>
        <div className="card-b">
          <div className="kpis" style={{ gridTemplateColumns: "repeat(4,1fr)", margin: 0 }}>
            <div className="kpi green"><div className="accent" /><div className="label">Recebido no mês</div><div className="val" style={{ fontSize: 22 }}>{fmtBRL(fechamento.recebido)}</div><div className="meta">{fechamento.qtdPagas} parcelas pagas</div></div>
            <div className="kpi brass"><div className="accent" /><div className="label">Sócio (50%)</div><div className="val" style={{ fontSize: 22 }}>{fmtBRL(fechamento.socio)}</div><div className="meta">rateio do recebido</div></div>
            <div className="kpi amber"><div className="accent" /><div className="label">A receber no mês</div><div className="val" style={{ fontSize: 22 }}>{fmtBRL(fechamento.aReceber)}</div><div className="meta">{fmtBRL(fechamento.emAtraso)} em atraso</div></div>
            <div className="kpi"><div className="label">Despesas no mês</div><div className="val" style={{ fontSize: 22 }}>{fmtBRL(fechamento.despesas)}</div><div className="meta">líquido sócio: {fmtBRL(fechamento.socio - fechamento.despesas / 2)}</div></div>
          </div>
        </div>
      </div>

      <h3 className="section-gap" style={{ marginBottom: 12 }}>Contratos</h3>
      <ContratosList contratos={contratos} />

      <div className="card section-gap">
        <div className="card-h"><h3>Parcelas a vencer / atrasadas</h3></div>
        <div className="card-b flush">
          {parcelas.length ? (
            <table>
              <thead>
                <tr><th>Cliente</th><th>Objeto</th><th className="center">Parcela</th><th className="right">Valor</th><th>Vencimento</th><th className="center">Status</th><th className="center">Ação</th></tr>
              </thead>
              <tbody>
                {parcelas.map((p) => (
                  <RowLink key={p.id} href={p.contrato_id ? linkPara("contrato", p.contrato_id) : "/financeiro"} ariaLabel={`Abrir contrato de ${p.cliente}`}>
                    <td className="name">{p.cliente}</td>
                    <td className="sub">{p.objeto ?? "—"}</td>
                    <td className="center mono">{p.numero_parcela}</td>
                    <td className="right money">{fmtBRL(p.valor)}</td>
                    <td className="mono">{fmtDate(p.vencimento)}{p.dias_atraso > 0 && <div className="sub" style={{ color: "var(--red)" }}>{p.dias_atraso} dias</div>}</td>
                    <td className="center"><Pill tone={p.status === "atrasado" ? "red" : "amber"}>{p.status === "atrasado" ? "atrasado" : "a vencer"}</Pill></td>
                    <td className="center">
                      <Acao label="Marcar paga" variant="ok" titulo="Registrar pagamento" confirmarLabel="Marcar paga"
                        resumo={<>Registrar a parcela {p.numero_parcela} de <b>{p.cliente}</b> ({fmtBRL(p.valor)}) como <b>paga</b> hoje?</>}
                        acao={marcarPago.bind(null, p.id)} />
                    </td>
                  </RowLink>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma parcela pendente.</div>
          )}
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-h"><h3>Despesas {despesasAbertas.length > 0 && <span className="sub">· {despesasAbertas.length} a reembolsar</span>}</h3></div>
        <div className="card-b flush">
          {despesas.length ? (
            <table>
              <thead>
                <tr><th>Descrição</th><th>Categoria</th><th className="right">Valor</th><th>Data</th><th className="center">Reembolso</th><th className="center">Ação</th></tr>
              </thead>
              <tbody>
                {despesas.map((d) => (
                  <tr key={d.id}>
                    <td className="name">{d.descricao}</td>
                    <td>{humano(d.categoria)}</td>
                    <td className="right money">{fmtBRL(d.valor)}</td>
                    <td className="mono">{fmtDate(d.data)}</td>
                    <td className="center">
                      {!d.reembolsavel ? <Pill tone="gray">não reembolsável</Pill>
                        : d.reembolsada ? <Pill tone="green">reembolsada</Pill>
                          : <Pill tone="amber">a reembolsar</Pill>}
                    </td>
                    <td className="center">
                      {d.reembolsavel && !d.reembolsada && (
                        <Acao label="Reembolsada" variant="ok" titulo="Marcar reembolsada" confirmarLabel="Confirmar"
                          resumo={<>Marcar <b>{d.descricao}</b> ({fmtBRL(d.valor)}) como reembolsada?</>}
                          acao={marcarDespesaReembolsada.bind(null, d.id)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma despesa lançada. Use “Nova despesa”.</div>
          )}
        </div>
      </div>
    </>
  );
}

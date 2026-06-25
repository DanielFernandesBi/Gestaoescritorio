import { getFinanceiro, getContratos, getDespesas, getClientes, getFechamentoMensal } from "@/lib/data";
import { FinanceiroView } from "@/components/modules/FinanceiroView";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const ym = new Date().toISOString().slice(0, 7);
  const [{ parcelas }, contratos, despesas, clientes, fechamento] = await Promise.all([
    getFinanceiro(),
    getContratos(),
    getDespesas(),
    getClientes(),
    getFechamentoMensal(ym),
  ]);
  const mesLabel = new Date(`${ym}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });

  // Fluxo de caixa do ano corrente: previsto (todas as parcelas do mês) e
  // realizado (pagas), a partir das parcelas reais dos contratos.
  const ano = new Date().getFullYear();
  const previsto = Array(12).fill(0) as number[];
  const realizado = Array(12).fill(0) as number[];
  for (const c of contratos) {
    for (const p of c.parcelas) {
      if (!p.vencimento) continue;
      const d = new Date(p.vencimento);
      if (d.getFullYear() !== ano) continue;
      const m = d.getMonth();
      previsto[m] += p.valor;
      if (p.status === "pago") realizado[m] += p.valor_pago ?? p.valor;
    }
  }
  const fluxo = previsto.map((prev, mes) => ({ mes, previsto: prev, realizado: realizado[mes] }));

  // Receita recebida por cliente (top 6).
  const receitaPorCliente = [...contratos
    .reduce((map, c) => map.set(c.cliente, (map.get(c.cliente) ?? 0) + c.total_pago), new Map<string, number>())
    .entries()]
    .map(([cliente, valor]) => ({ cliente, valor }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6);

  const clientesLite = clientes.map((c) => ({ id: c.id, nome: c.nome }));

  return (
    <FinanceiroView
      contratos={contratos}
      parcelas={parcelas}
      despesas={despesas}
      fechamento={fechamento}
      fluxo={fluxo}
      receitaPorCliente={receitaPorCliente}
      clientes={clientesLite}
      mesLabel={mesLabel}
    />
  );
}

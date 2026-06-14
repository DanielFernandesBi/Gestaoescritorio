import { getFinanceiro } from "@/lib/data";
import { Pill } from "@/components/ui";
import { fmtBRL, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const { parcelas, totalReceber, totalAtraso, contratosVigentes, contratosTotal } =
    await getFinanceiro();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Honorários & parcelas</div>
          <h1>Financeiro</h1>
          <p>
            Parcelas a vencer e atrasadas (vw_financeiro_pendente). Rodar
            fn_marcar_atrasados() antes do fechamento.
          </p>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="kpi green">
          <div className="accent" />
          <div className="label">A receber (pendente)</div>
          <div className="val" style={{ fontSize: 25 }}>{fmtBRL(totalReceber)}</div>
          <div className="meta">{parcelas.length} parcelas em aberto</div>
        </div>
        <div className="kpi red">
          <div className="accent" />
          <div className="label">Em atraso</div>
          <div className="val" style={{ fontSize: 25 }}>{fmtBRL(totalAtraso)}</div>
          <div className="meta">cobrança prioritária</div>
        </div>
        <div className="kpi brass">
          <div className="accent" />
          <div className="label">Contratos vigentes</div>
          <div className="val">{contratosVigentes}</div>
          <div className="meta">{contratosTotal} contratos no total</div>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-h"><h3>Parcelas a vencer / atrasadas</h3></div>
        <div className="card-b flush">
          {parcelas.length ? (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Objeto</th>
                  <th className="center">Parcela</th>
                  <th className="right">Valor</th>
                  <th>Vencimento</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((p, i) => (
                  <tr key={i}>
                    <td className="name">{p.cliente}</td>
                    <td className="sub">{p.objeto ?? "—"}</td>
                    <td className="center mono">{p.numero_parcela}</td>
                    <td className="right money">{fmtBRL(p.valor)}</td>
                    <td className="mono">
                      {fmtDate(p.vencimento)}
                      {p.dias_atraso > 0 && (
                        <div className="sub" style={{ color: "var(--red)" }}>{p.dias_atraso} dias</div>
                      )}
                    </td>
                    <td className="center">
                      <Pill tone={p.status === "atrasado" ? "red" : "amber"}>
                        {p.status === "atrasado" ? "atrasado" : "a vencer"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma parcela pendente.</div>
          )}
        </div>
      </div>
    </>
  );
}

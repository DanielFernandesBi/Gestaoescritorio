import { Icon } from "@/components/Icon";
import { fmtBRL } from "@/lib/format";

type FluxoMes = { mes: number; previsto: number; realizado: number; pendente: number };
type ReceitaCliente = { cliente: string; valor: number };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const kBRL = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000 ? `R$ ${Math.round(v / 1000)}k`
      : `R$ ${Math.round(v)}`;

/** Linha de fluxo de caixa anual: previsto (azul), realizado (verde), pendente (vermelho). */
function FluxoCaixa({ fluxo, ano }: { fluxo: FluxoMes[]; ano: number }) {
  const W = 540, H = 280, L = 58, R = 14, T = 18, B = 34;
  const plotW = W - L - R, plotH = H - T - B;
  const maxV = Math.max(1, ...fluxo.flatMap((f) => [f.previsto, f.realizado, f.pendente]));
  const x = (m: number) => L + (fluxo.length > 1 ? (m * plotW) / (fluxo.length - 1) : 0);
  const y = (v: number) => T + plotH * (1 - v / maxV);
  const linha = (key: keyof FluxoMes) =>
    fluxo.map((f) => `${x(f.mes).toFixed(1)},${y(f[key] as number).toFixed(1)}`).join(" ");
  const series: { key: keyof FluxoMes; cor: string; nome: string }[] = [
    { key: "previsto", cor: "var(--blue)", nome: "Previsto" },
    { key: "realizado", cor: "var(--green)", nome: "Realizado" },
    { key: "pendente", cor: "var(--red)", nome: "Pendente" },
  ];
  const grid = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="card op-card">
      <div className="card-h">
        <h3><Icon name="activity" /> Fluxo de caixa {ano}</h3>
        <div className="gleg">
          {series.map((s) => (
            <span key={s.key} className="gleg-i"><i style={{ background: s.cor }} />{s.nome}</span>
          ))}
        </div>
      </div>
      <div className="card-b">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gráfico de fluxo de caixa anual">
          {grid.map((g) => {
            const gy = T + plotH * g;
            return (
              <g key={g}>
                <line x1={L} y1={gy} x2={W - R} y2={gy} stroke="var(--line-soft)" strokeWidth={1} />
                <text x={L - 8} y={gy + 3} textAnchor="end" fontSize={10} fill="var(--muted)">{kBRL(maxV * (1 - g))}</text>
              </g>
            );
          })}
          {fluxo.map((f) => (
            <text key={f.mes} x={x(f.mes)} y={H - 12} textAnchor="middle" fontSize={10} fill="var(--muted)">{MESES[f.mes]}</text>
          ))}
          {series.map((s) => (
            <g key={s.key}>
              <polyline points={linha(s.key)} fill="none" stroke={s.cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {fluxo.map((f) => (
                <circle key={f.mes} cx={x(f.mes)} cy={y(f[s.key] as number)} r={2.5} fill={s.cor} />
              ))}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** Barras horizontais de receita (recebida) por cliente. */
function ReceitaPorCliente({ dados }: { dados: ReceitaCliente[] }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div className="card op-card">
      <div className="card-h"><h3><Icon name="users" /> Receita por cliente</h3></div>
      <div className="card-b">
        {dados.length ? (
          <div className="gbars">
            {dados.map((d) => (
              <div className="gbar-row" key={d.cliente}>
                <span className="gbar-lbl" title={d.cliente}>{d.cliente}</span>
                <span className="gbar-track">
                  <span className="gbar-fill" style={{ width: `${Math.max(2, (d.valor / max) * 100)}%` }} />
                </span>
                <span className="gbar-val">{fmtBRL(d.valor)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">Sem receita recebida registrada.</div>
        )}
      </div>
    </div>
  );
}

export function FinanceiroGraficos({
  fluxo,
  ano,
  receitaPorCliente,
}: {
  fluxo: FluxoMes[];
  ano: number;
  receitaPorCliente: ReceitaCliente[];
}) {
  return (
    <div className="fin-charts section-gap">
      <FluxoCaixa fluxo={fluxo} ano={ano} />
      <ReceitaPorCliente dados={receitaPorCliente} />
    </div>
  );
}

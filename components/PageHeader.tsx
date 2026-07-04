import { Fragment } from "react";

// Cabeçalho "heritage" reutilizável (Sug. 81 adendo UI): faixa escura emoldurada
// (mesma linguagem da sidebar/topbar) + faixa opcional de KPIs tonalizados. Usa
// só tokens do globals.css (.ph-*). Server-friendly (sem estado/hooks).

export type PageHeaderKpiTone = "red" | "amber" | "green" | "accent" | "neutral";

export type PageHeaderKpi = {
  valor: React.ReactNode;
  label: string;
  tone?: PageHeaderKpiTone;
};

export function PageHeader({
  eyebrow,
  titulo,
  descricao,
  breadcrumb,
  contexto,
  acoes,
  kpis,
}: {
  eyebrow?: string;
  titulo: string;
  descricao?: React.ReactNode;
  breadcrumb?: string[];
  contexto?: React.ReactNode;
  acoes?: React.ReactNode;
  kpis?: PageHeaderKpi[];
}) {
  const temTopo = (breadcrumb && breadcrumb.length > 0) || contexto != null;

  return (
    <div className="ph">
      <div className="ph-band">
        {temTopo && (
          <div className="ph-top">
            {breadcrumb && breadcrumb.length > 0 ? (
              <nav className="ph-crumb" aria-label="Trilha de navegação">
                {breadcrumb.map((b, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="sep" aria-hidden>/</span>}
                    <span className="crumb-i">{b}</span>
                  </Fragment>
                ))}
              </nav>
            ) : (
              <span />
            )}
            {contexto != null && (
              <div className="ph-ctx">
                <span className="dot" aria-hidden />
                <span>{contexto}</span>
              </div>
            )}
          </div>
        )}

        <div className="ph-main">
          <div className="ph-lhs">
            {eyebrow && <div className="ph-eyebrow">{eyebrow}</div>}
            <h1 className="ph-title">{titulo}</h1>
            {descricao != null && <p className="ph-desc">{descricao}</p>}
          </div>
          {acoes != null && <div className="ph-acoes">{acoes}</div>}
        </div>
      </div>

      {kpis && kpis.length > 0 && (
        <div className="ph-kpis" style={{ "--ph-kpi-n": kpis.length } as React.CSSProperties}>
          {kpis.map((k, i) => (
            <div key={i} className={`ph-kpi ${k.tone ?? "neutral"}`}>
              <div className="v">{k.valor}</div>
              <div className="l">{k.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PageHeader;

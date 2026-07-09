import { fmtNum } from "@/lib/format";
import type { DiagnosticoOab } from "@/lib/queries";

/* Sug. 87 — cobertura por OAB/nome na última varredura. Seis rótulos: 4 OABs dos
 * sócios + 2 buscas por nome. Rótulo "nome:" é candidato a homônimo (destaque);
 * modo "dia-a-dia" sinaliza fallback (degradação leve); {erro} mostra a falha da
 * fonte sem derrubar as demais. */
export function CoberturaOab({ diag }: { diag: DiagnosticoOab[] | null }) {
  if (!diag || diag.length === 0) {
    return <div className="empty sm">Sem diagnóstico por OAB.</div>;
  }
  return (
    <div className="scan-grid">
      {diag.map((d) => (
        <div className={`oab${d.erro ? " erro" : ""}${d.isNome ? " nome" : ""}`} key={d.rotulo}>
          <div className="lbl">
            {d.isNome ? (
              <>
                <span className="oab-badge">por nome</span>
                <span className="oab-nome">{d.rotulo.slice(5)}</span>
              </>
            ) : (
              d.rotulo
            )}
            {d.modo === "dia-a-dia" && (
              <span className="oab-modo" title="Fonte reconsultada dia a dia (fallback) — degradação leve, sem perder a fonte inteira">
                dia-a-dia
              </span>
            )}
          </div>
          {d.erro ? (
            <div className="oab-erro" title={d.erro}>⚠ {d.erro}</div>
          ) : (
            <div className="metrics">
              <div className="metric"><b>{fmtNum(d.coletadas ?? 0)}</b><span>coletadas</span></div>
              <div className="metric"><b>{fmtNum(d.acervo ?? 0)}</b><span>no acervo</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

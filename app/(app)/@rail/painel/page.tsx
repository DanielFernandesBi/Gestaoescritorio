import Link from "next/link";
import { getPainelData } from "@/lib/queries";
import { getPrazosOrfaos } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Trilho lateral de órfãs — 3ª coluna do shell, só no painel (slot @rail).
 * Reúne a fila de triagem: intimações, prazos e andamentos sem processo.
 */
export default async function PainelRail() {
  const [{ stats, orfas }, prazosOrfaos] = await Promise.all([
    getPainelData(),
    getPrazosOrfaos(),
  ]);
  const total =
    stats.intimacoes_orfas + stats.andamentos_orfaos + prazosOrfaos.length;

  return (
    <aside className="orfas-rail" aria-label="Fila de triagem de órfãs">
      <div className="rail-top">
        <span className="lhs">
          <Icon name="inbox" size={14} /> Fila de triagem
        </span>
        <span className={`rail-count${total === 0 ? " zero" : ""}`}>{total}</span>
      </div>

      {total === 0 ? (
        <div className="sup-empty">
          Nada a triar. Tudo vinculado a um processo. 🎉
        </div>
      ) : (
        <>
          <div className="sup-card">
            <div className="sh">
              <h4>Intimações órfãs</h4>
              <span className="ct">{stats.intimacoes_orfas}</span>
            </div>
            {orfas.length ? (
              orfas.map((i) => (
                <Link key={i.id} className="orf" href="/intimacoes">
                  <div className="ot">{i.resumo ?? i.teor_inicio ?? "—"}</div>
                  <div className="os">
                    {(i.origem ?? "").toUpperCase()} · {fmtDate(i.criado_em)}
                  </div>
                </Link>
              ))
            ) : (
              <div className="orf">
                <div className="os">Nenhuma intimação órfã listada.</div>
              </div>
            )}
          </div>

          <div className="sup-card">
            <div className="sh">
              <h4>Prazos órfãos</h4>
              <span className="ct">{prazosOrfaos.length}</span>
            </div>
            {prazosOrfaos.length ? (
              prazosOrfaos.slice(0, 8).map((p) => (
                <Link key={p.prazo_id} className="orf" href="/prazos">
                  <div className="ot">{p.ato}</div>
                  <div className="os">
                    fatal {fmtDate(p.data_fatal)} · {p.dias_restantes}d · sem processo
                  </div>
                </Link>
              ))
            ) : (
              <div className="orf">
                <div className="os">Nenhuma fatal sem processo.</div>
              </div>
            )}
          </div>

          {stats.andamentos_orfaos > 0 && (
            <div className="sup-card">
              <div className="sh">
                <h4>Andamentos órfãos</h4>
                <span className="ct">{stats.andamentos_orfaos}</span>
              </div>
              <Link className="orf" href="/andamentos">
                <div className="ot">Movimentos sem processo no acervo</div>
                <div className="os">aba “Órfãos / triagem” — assistente Promover</div>
              </Link>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

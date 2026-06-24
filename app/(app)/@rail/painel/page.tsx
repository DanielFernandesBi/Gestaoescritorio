import Link from "next/link";
import { getPainelData } from "@/lib/queries";
import { getPrazosOrfaos } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Trilho lateral — 3ª coluna do shell, só no painel (slot @rail).
 * Topo: atalho do Assistente (o Claude opera pelo chat/Cowork — aqui é CTA, não
 * chat embutido). Abaixo: a fila de triagem (intimações, prazos e andamentos órfãos).
 */
export default async function PainelRail() {
  const [{ stats, orfas }, prazosOrfaos] = await Promise.all([
    getPainelData(),
    getPrazosOrfaos(),
  ]);
  const total =
    stats.intimacoes_orfas + stats.andamentos_orfaos + prazosOrfaos.length;

  return (
    <aside className="orfas-rail" aria-label="Assistente e fila de triagem">
      <Link className="assist-rail" href="/busca">
        <div className="assist-rail-h">
          <span className="assist-seal"><Icon name="activity" size={14} /></span>
          <span>Assistente Claude</span>
        </div>
        <div className="assist-rail-b">
          Peça o relatório do dia ou uma ação pelo chat (Cowork). Aqui, busque
          processo, cliente ou intimação.
        </div>
        <span className="assist-rail-cta">Busca global ⌘K →</span>
      </Link>

      <div className="rail-top">
        <span className="lhs">
          <Icon name="inbox" size={14} /> Fila de triagem
        </span>
        <span className={`rail-count${total === 0 ? " zero" : ""}`}>{total}</span>
      </div>

      {total === 0 ? (
        <div className="sup-card">
          <div className="orf">
            <div className="os">Nada a triar agora. 🎉</div>
          </div>
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

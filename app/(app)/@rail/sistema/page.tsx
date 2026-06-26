import Link from "next/link";
import { getMigracoes } from "@/lib/data";

/** Nome curto da migração: 1ª oração da descrição (corta em . / — / : / quebra). */
function nomeMigracao(desc: string | null): string | null {
  if (!desc) return null;
  const t = desc.trim().split(/[.\n]|\s[—–]\s|:\s/)[0].trim();
  return t.length > 52 ? t.slice(0, 50).trimEnd() + "…" : t;
}

/**
 * Trilho lateral da /sistema — 3ª coluna do shell (slot @rail). Como o sistema
 * evolui (IA sugere → Daniel decide → DDL autorizada em migracoes), as últimas
 * migrações reais e a faixa Assistente.
 */
const SPARK = (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);

export const dynamic = "force-dynamic";

export default async function SistemaRail() {
  const migracoes = await getMigracoes(6);
  return (
    <aside className="orfas-rail" aria-label="Como o sistema evolui e últimas migrações">
      {/* como o sistema evolui */}
      <div className="vrail-card pz-ciclo-card">
        <div className="pz-ciclo-h">{SPARK}<span>Como o sistema evolui</span></div>
        <ol className="pz-ciclo">
          <li><span className="n tang">1</span><span>A IA detecta a necessidade e registra em <code>sugestoes_sistema</code> com o SQL pronto.</span></li>
          <li><span className="n green">2</span><span>Daniel decide: <b>aprovar</b>, <b>executar</b> ou <b>rejeitar</b> — só registra o status.</span></li>
          <li><span className="n slate">3</span><span>A DDL roda <b>só com autorização expressa</b> e fica registrada em <code>migracoes</code>.</span></li>
        </ol>
        <div className="pz-ciclo-foot">O manual de operação é o próprio sistema vivo — vive em <code>config_sistema/manual_operacao</code>.</div>
      </div>

      {/* últimas migrações */}
      <div className="vrail-card">
        <div className="vrail-h">Últimas migrações</div>
        {migracoes.length ? (
          <ul className="sis-mig">
            {migracoes.map((m) => (
              <li key={m.id} title={m.descricao ?? ""}>
                {m.sql_executado ? (
                  <details className="sis-mig-det">
                    <summary><span className="d mono">#{m.id}</span><span className="t">{nomeMigracao(m.descricao) ?? `migração #${m.id}`}</span></summary>
                    <pre className="sis-mig-sql">{m.sql_executado}</pre>
                  </details>
                ) : (
                  <div className="sis-mig-row"><span className="d mono">#{m.id}</span><span className="t">{nomeMigracao(m.descricao) ?? `migração #${m.id}`}</span></div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="sub">Nenhuma migração registrada.</div>
        )}
      </div>

      {/* Assistente */}
      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">Por que sugeriu a #51?</div>
          <div className="bubble ia">Detectei 3 ciclos seguidos sem intimação numa comarca com processos ativos — pode ser buraco de DJEN. A view ajudaria a flagrar. Deixei o SQL pronto; só executa se você autorizar.</div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Propor melhoria, ver migração, conferir tabela…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

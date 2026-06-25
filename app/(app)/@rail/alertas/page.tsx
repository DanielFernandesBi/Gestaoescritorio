import Link from "next/link";
import { Icon } from "@/components/Icon";

/**
 * Trilho lateral da /alertas — 3ª coluna do shell (slot @rail).
 * De onde vêm os alertas (régua de severidade do manual) + Assistente
 * (o Claude opera pelo chat — aqui é CTA, não chat embutido).
 */
export default function AlertasRail() {
  return (
    <aside className="orfas-rail" aria-label="De onde vêm os alertas">
      <div className="vrail-card">
        <div className="vrail-h">De onde vêm os alertas</div>
        <ul className="al-help">
          <li><span className="al-dot crit" /><b>Liberdade primeiro</b> — preso, prisão, busca, regressão sobem ao topo.</li>
          <li><span className="al-dot exec" /><b>Execução</b> — progressão/livramento ≤180d (vencidos no topo) de <code>vw_situacao_executoria</code>.</li>
          <li><span className="al-dot radar" /><b>Radar &amp; varredura</b> — parados ≥30d e anomalias de cobertura DJEN/Calendar/Drive.</li>
        </ul>
        <div className="cal-note">Financeiro entra como alerta pontual (vencido/vence hoje), não como bloco fixo.</div>
      </div>

      <Link className="assist-rail" href="/busca">
        <div className="assist-rail-h">
          <span className="assist-seal"><Icon name="activity" size={14} /></span>
          <span>Assistente</span>
        </div>
        <div className="assist-rail-b">
          O Claude opera pelo chat (Cowork) — peça lá “resolva o mais grave”. Aqui, o atalho de busca.
        </div>
        <div className="assist-rail-prompt">
          <span>Minutar, provocar andamento ou cobrar…</span>
          <span className="assist-send">→</span>
        </div>
      </Link>
    </aside>
  );
}

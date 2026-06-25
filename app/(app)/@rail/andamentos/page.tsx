import Link from "next/link";
import { Icon } from "@/components/Icon";

/**
 * Trilho lateral da /andamentos — 3ª coluna do shell (slot @rail).
 * Explicador da captura (informativo × escalonamento Sug. 30) + Assistente
 * (o Claude opera pelo chat — aqui é CTA, não chat embutido).
 */
export default function AndamentosRail() {
  return (
    <aside className="orfas-rail" aria-label="Captura de movimentações">
      <div className="vrail-card">
        <div className="vrail-h">Captura de movimentações</div>
        <ul className="fila-help">
          <li><b>Informativo</b> — andamento não exige validação; só registra o histórico.</li>
          <li><b>Escalonamento (Sug. 30)</b> — o que afeta liberdade, mérito, prazo ou audiência vira tarefa de conferência (urgente/alta).</li>
          <li><b>Órfãos</b> — movimentação sem processo entra na triagem; nunca é descartada.</li>
          <li>Dedup por <code>codigo_movimentacao</code>. Tudo auditado, nada deletado.</li>
        </ul>
      </div>

      <Link className="assist-rail" href="/busca">
        <div className="assist-rail-h">
          <span className="assist-seal"><Icon name="activity" size={14} /></span>
          <span>Assistente</span>
        </div>
        <div className="assist-rail-b">
          O Claude opera pelo chat (Cowork) — peça lá “algo urgente hoje?”. Aqui, o atalho de busca.
        </div>
        <div className="assist-rail-prompt">
          <span>Conferir, registrar resultado ou criar peça…</span>
          <span className="assist-send">→</span>
        </div>
      </Link>
    </aside>
  );
}

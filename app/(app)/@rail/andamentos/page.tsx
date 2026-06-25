import Link from "next/link";

/**
 * Trilho lateral da /andamentos — 3ª coluna do shell (slot @rail).
 * Legenda da captura (informativo × escalonamento × órfãos) + Assistente
 * (cartão claro estilo chat; o Claude opera pelo chat/Cowork — o prompt é CTA
 * para a busca, sem chat embutido falso).
 */
export default function AndamentosRail() {
  return (
    <aside className="orfas-rail" aria-label="Captura de movimentações">
      <div className="vrail-card">
        <div className="vrail-h">Captura de movimentações</div>
        <ul className="leg">
          <li><span className="leg-dot info" /><b>Informativo</b> — só registra o histórico; não exige validação.</li>
          <li><span className="leg-dot urg" /><b>Escalonamento (Sug. 30)</b> — liberdade, mérito, prazo ou audiência viram conferência.</li>
          <li><span className="leg-dot slate" /><b>Órfãos</b> — sem processo entram na triagem; nunca descartados.</li>
        </ul>
        <div className="cal-note">Dedup por <code>codigo_movimentacao</code>. Tudo auditado, nada deletado.</div>
      </div>

      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">Algo urgente hoje?</div>
          <div className="bubble ia">
            Busca e apreensão deferida (Marcos Aurélio) escalou como <b>URGENTE</b>. Quer abrir a conferência
            ou criar o HC?
          </div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Conferir, registrar resultado ou criar peça…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

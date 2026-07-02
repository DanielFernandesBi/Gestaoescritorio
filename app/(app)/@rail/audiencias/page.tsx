import Link from "next/link";

/**
 * Trilho lateral da /audiencias — 3ª coluna do shell (slot @rail). Distingue a
 * sessão virtual (votos eletrônicos, sem sustentação) da videoconferência (ao
 * vivo), a legenda de cores da /agenda e a faixa Assistente. Conteúdo estático;
 * o input é CTA para a busca (sem chat embutido falso), como nos demais trilhos.
 */
const SPARK = (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);

export default function AudienciasRail() {
  return (
    <aside className="orfas-rail" aria-label="Virtual × videoconferência e cores na agenda">
      {/* virtual ≠ videoconferência */}
      <div className="vrail-card pz-ciclo-card">
        <div className="pz-ciclo-h">{SPARK}<span>Virtual ≠ videoconferência</span></div>
        <ul className="aud-vv">
          <li><span className="m sq" /><span><b>Virtual</b> — lista de votos eletrônicos dos Ministros ao longo de dias, sem sessão ao vivo e <b>sem sustentação</b>. Registra <code>sessao_julgamento</code> + <code>virtual</code>.</span></li>
          <li><span className="m dot" /><span><b>Videoconferência</b> — sessão telepresencial <b>ao vivo</b>, com sustentação oral.</span></li>
        </ul>
      </div>

      {/* cores na agenda */}
      <div className="vrail-card">
        <div className="vrail-h">Na agenda</div>
        <ul className="pz-cores">
          <li><span className="sw tang" /><span><b>Tangerina</b> — designada provisória, a conferir.</span></li>
          <li><span className="sw green" /><span><b>Calma</b> — validada por Daniel (data/local confirmados).</span></li>
          <li><span className="sw slate" /><span><b>Grafite</b> — realizada / redesignada / cancelada.</span></li>
        </ul>
        <div className="pz-ciclo-foot">Baixa é troca de status, nunca apagada nem movida. A realizada vira andamento no processo.</div>
      </div>

      {/* Assistente */}
      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">O júri do Rafael é dia 03?</div>
          <div className="bubble ia">A data 03/07 09h veio da pauta capturada — provisória. Confirmo no portal antes de validar? Aí ela passa de tangerina para confirmada na /agenda.</div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Validar, redesignar, preparar, marcar realizada…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

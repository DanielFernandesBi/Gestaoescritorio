import Link from "next/link";

/**
 * Trilho lateral da /tarefas — 3ª coluna do shell (slot @rail). Explica como as
 * conferências nascem da triagem (mapa_andamento_tarefa), o que a tarefa puxa e a
 * faixa Assistente. Conteúdo estático; o input é CTA para a busca (sem chat
 * embutido falso), como nos demais trilhos.
 */
const SPARK = (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);

export default function TarefasRail() {
  return (
    <aside className="orfas-rail" aria-label="Conferências da triagem e o que a tarefa puxa">
      {/* conferências nascem de movimentações */}
      <div className="vrail-card pz-ciclo-card">
        <div className="pz-ciclo-h">{SPARK}<span>Conferências da triagem</span></div>
        <p className="tk-rail-p">Toda movimentação passa pelo mapa <code>mapa_andamento_tarefa</code>. Quando tem <b>consequência</b>, vira conferência para o Daniel — alerta em texto livre <b>não conta</b>.</p>
        <ul className="tk-rail-list">
          <li><span className="b red" /><span><b>Urgente</b> — liberdade ou patrimônio (prisão, bloqueio, regressão).</span></li>
          <li><span className="b amber" /><span><b>Alta</b> — mérito, decisão e audiência designada.</span></li>
        </ul>
        <div className="pz-ciclo-foot">Dedup ≤ 1 conferência por movimentação · vinculada ao <code>andamento_id</code>.</div>
      </div>

      {/* a tarefa puxa */}
      <div className="vrail-card">
        <div className="vrail-h">A tarefa puxa</div>
        <ul className="tk-rail-list">
          <li><span className="b sq accent" /><span><b>Criar peça</b> — pré-preenche tipo/subtipo pelo mapa de providência.</span></li>
          <li><span className="b green" /><span><b>Agenda</b> — vira compromisso/lembrete no Google Calendar.</span></li>
          <li><span className="b slate" /><span><b>Ver movimentação</b> — abre o andamento que originou a conferência.</span></li>
          <li><span className="b muted" /><span><b>Atribuição</b> — assumir ou reatribuir entre Daniel e Rodolfo.</span></li>
        </ul>
        <div className="pz-ciclo-foot">Nunca deletar: correção é trocar status (cancelada). Tudo auditado.</div>
      </div>

      {/* Assistente */}
      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">Por que abriram a conferência do Edmilson?</div>
          <div className="bubble ia">Um andamento decretou regressão de regime — afeta a liberdade, então o mapa escalou como urgente. Quer que eu já abra a peça de agravo em execução?</div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Criar tarefa, assumir, criar peça, agendar…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

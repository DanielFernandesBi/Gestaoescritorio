import Link from "next/link";

/**
 * Trilho lateral da /producao — 3ª coluna do shell (slot @rail). Explica o redator
 * agendado (2ª passada do Cowork), o que o kanban cruza e a faixa Assistente.
 * Conteúdo estático; o input é CTA para a busca (sem chat embutido falso).
 */
const SPARK = (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);

export default function ProducaoRail() {
  return (
    <aside className="orfas-rail" aria-label="Redator agendado e como o kanban cruza">
      {/* redator agendado */}
      <div className="vrail-card pz-ciclo-card">
        <div className="pz-ciclo-h">{SPARK}<span>Redator agendado</span></div>
        <p className="tk-rail-p">A 2ª passada do Cowork redige a minuta das peças de <b>alta confiança</b> e move <code>a_fazer</code> → <code>em_revisão</code>. Sempre <b>validado=false</b> — nunca protocola.</p>
        <div className="prd-rail-stats">
          <div className="s accent"><div className="n">IA</div><div className="l">minutas → revisão</div></div>
          <div className="s amber"><div className="n">⏳</div><div className="l">aguard. insumo</div></div>
        </div>
        <div className="pz-ciclo-foot">Cadeia: <code>auditor-dosimetria</code> / <code>calculadora-execução</code> → <code>redator-penal</code>, ancorada no acervo curado. Jurisprudência só de súmula/vinculante/acervo.</div>
      </div>

      {/* o kanban cruza */}
      <div className="vrail-card">
        <div className="vrail-h">O kanban cruza</div>
        <ul className="tk-rail-list">
          <li><span className="b sq accent" /><span><b>vw_pecas_pendentes</b> — une peça + prazo e calcula <code>dias_restantes</code> pela data herdada.</span></li>
          <li><span className="b slate" /><span><b>mapa_providencia_peca</b> — providência → tipo/subtipo pré-preenche a nova peça.</span></li>
          <li><span className="b green" /><span>Na <b>baixa do prazo</b> a peça vai a <code>protocolada</code> e grava <code>andamento_id</code>.</span></li>
        </ul>
        <div className="pz-ciclo-foot">Nunca deletar: correção é trocar status (cancelada / prejudicada). Tudo auditado.</div>
      </div>

      {/* Assistente */}
      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">O que falta no agravo do Antônio?</div>
          <div className="bubble ia">A minuta está pronta para revisão (gate ALTA). Resta 1 nota interna: confirmar a data de intimação da monocrática para o cabeçalho. Abro no editor?</div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Criar peça, redigir minuta, checar prazo…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

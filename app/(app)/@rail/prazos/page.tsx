import Link from "next/link";

/**
 * Trilho lateral da /prazos — 3ª coluna do shell (slot @rail). Doutrina do
 * ciclo do prazo (provisório → validado → baixa), a legenda de cores do
 * Calendar e a faixa Assistente. Conteúdo estático; o input é CTA para a
 * busca (sem chat embutido falso), como nos demais trilhos.
 */
const SPARK = (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);

export default function PrazosRail() {
  return (
    <aside className="orfas-rail" aria-label="Ciclo do prazo e cores no Calendar">
      {/* ciclo do prazo */}
      <div className="vrail-card pz-ciclo-card">
        <div className="pz-ciclo-h">{SPARK}<span>Ciclo do prazo</span></div>
        <ol className="pz-ciclo">
          <li><span className="n tang">1</span><span><b>Nasce provisório</b> (cowork) e já entra no Calendar em <b className="tang">tangerina</b> — nenhuma fatal fica invisível.</span></li>
          <li><span className="n green">2</span><span>Daniel <b>valida</b>: o provisório vira cor calma e cria o marcador da fatal em <b className="red">vermelho</b>.</span></li>
          <li><span className="n slate">3</span><span>Na <b>baixa</b> os eventos são reescritos para <b className="slate">grafite</b> — nunca apagados nem movidos.</span></li>
        </ol>
        <div className="pz-ciclo-foot">Data interna sugerida 2 dias úteis antes da fatal. Validar órfão exige vincular o processo antes.</div>
      </div>

      {/* cores no calendar */}
      <div className="vrail-card">
        <div className="vrail-h">Cores no Calendar</div>
        <ul className="pz-cores">
          <li><span className="sw tang" /><span><b>Tangerina</b> — provisório, ainda não confirmado.</span></li>
          <li><span className="sw red" /><span><b>Vermelho</b> — fatal real, sempre conferida.</span></li>
          <li><span className="sw green" /><span><b>Calmo</b> — lembrete interno já validado.</span></li>
          <li><span className="sw slate" /><span><b>Grafite</b> — prazo baixado (cumprido/cancelado).</span></li>
        </ul>
      </div>

      {/* Assistente */}
      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">Confere a fatal da apelação do Marcos.</div>
          <div className="bubble ia">8 dias corridos da ciência (25/06) → fatal 02/07, sem feriado no MA na janela. Posso validar e criar o marcador vermelho?</div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Validar, recontar dias, dar baixa, promover órfã…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

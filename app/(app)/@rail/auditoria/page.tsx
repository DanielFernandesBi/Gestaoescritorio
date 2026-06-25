import Link from "next/link";

/**
 * Trilho lateral da /auditoria — 3ª coluna do shell (slot @rail). Doutrina do
 * log imutável (fn_auditar / DELETE bloqueado / origem), a última varredura e a
 * faixa Assistente. Conteúdo estático; o input é CTA para a busca.
 */
const ShieldCheck = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6z" /><path d="M9 12l2 2 4-4" />
  </svg>
);

export default function AuditoriaRail() {
  return (
    <aside className="orfas-rail" aria-label="A auditoria é a prova e última varredura">
      {/* a auditoria é a prova */}
      <div className="vrail-card">
        <div className="vrail-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>{ShieldCheck}<span>A auditoria é a prova</span></div>
        <ul className="aud-rail-list">
          <li><span className="b sq ink" /><span><b>fn_auditar</b> grava tabela, operação e os dados antes/depois de cada gravação.</span></li>
          <li><span className="b red" /><span><b>DELETE bloqueado</b> por <code>fn_bloquear</code> — correção é trocar status.</span></li>
          <li><span className="b accent" /><span>A origem distingue <b>cowork</b> (IA) de <b>Daniel</b> (humano).</span></li>
        </ul>
        <div className="pz-ciclo-foot">Relatório de agente não é prova. O ritual matinal cruza o briefing contra a auditoria — divergência se investiga antes de tudo.</div>
      </div>

      {/* última varredura */}
      <div className="vrail-card">
        <div className="vrail-h">Última varredura</div>
        <div className="aud-scan">
          <div className="row"><span className="dot green" /><b>DJEN · concluída</b><span className="when mono">06:12</span></div>
          <div className="s mono">24 itens · 6 intimações · 3 prazos · 0 anomalias</div>
          <div className="s">diagnóstico_oab ok nas 2 OABs · watermark movido.</div>
        </div>
      </div>

      {/* Assistente */}
      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">Quem validou a apelação do Marcos?</div>
          <div className="bubble ia">Daniel, hoje 06:48 — UPDATE em prazos, validado false→true. O evento tem os dados antes/depois; quer o registro completo?</div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Filtrar por tabela, conferir um registro…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

import Link from "next/link";

/**
 * Trilho lateral da /duplicados — 3ª coluna do shell (slot @rail).
 * Doutrina da conferência de identidade (como a IA detecta + o que a mesclagem
 * faz) e a faixa Assistente. Conteúdo estático; o input é CTA para a busca
 * (sem chat embutido falso), como nos demais trilhos.
 */
const SPARK = (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);

export default function DuplicadosRail() {
  return (
    <aside className="orfas-rail" aria-label="Como a conferência de identidade funciona">
      {/* Como a IA detecta */}
      <div className="vrail-card dup-detect-card">
        <div className="dup-detect-h">{SPARK}<span>Como a IA detecta</span></div>
        <ul className="dup-detect">
          <li className="t-proc">
            <span className="b" />
            <span><b>Processo</b> — por <code>numero_cnj</code> OU <code>numero_registro_tribunal</code> (STJ/STF antigos sem CNJ).</span>
          </li>
          <li className="t-cli">
            <span className="b" />
            <span><b>Cliente</b> — por <code>nome_normalizado</code> (maiúsculas, sem acento) — nunca normalizar ad hoc.</span>
          </li>
          <li className="t-pub">
            <span className="b" />
            <span><b>Publicação</b> — <code>codigo_publicacao</code> com índice único já rejeita a duplicata na entrada.</span>
          </li>
        </ul>
      </div>

      {/* O que a mesclagem faz */}
      <div className="vrail-card">
        <div className="vrail-h">O que a mesclagem faz</div>
        <ol className="dup-steps">
          <li><span className="n">1</span><span>O duplicado vira <b>tombstone</b> com <code>merged_into</code> apontando o canônico.</span></li>
          <li><span className="n">2</span><span>Intimações, prazos, andamentos e documentos <b>religam</b> ao canônico.</span></li>
          <li><span className="n">3</span><span>Referências futuras resolvem o canônico por <code>fn_resolver_processo</code>.</span></li>
        </ol>
        <div className="dup-steps-foot">Nunca DELETE. Órfãos nunca são descartados. Tudo auditado.</div>
      </div>

      {/* Assistente */}
      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">Esse registro do STJ é mesmo duplicado?</div>
          <div className="bubble ia">Casei o registro do tribunal com um CNJ pelo nome e tribunal, mas não confirmei a classe/relator. Abro os dois lado a lado para você conferir antes de mesclar?</div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Comparar, mesclar, marcar “não é duplicado”…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

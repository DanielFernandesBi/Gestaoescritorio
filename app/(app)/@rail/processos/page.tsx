import Link from "next/link";

/**
 * Trilho lateral da /processos — 3ª coluna do shell (slot @rail).
 * Doutrina do acervo (chave, mesclagem, saúde, sigilo) + Assistente
 * (cartão claro estilo chat; o prompt é CTA p/ a busca, sem chat embutido falso).
 */
export default function ProcessosRail() {
  return (
    <aside className="orfas-rail" aria-label="Como o acervo se organiza">
      <div className="vrail-card">
        <div className="vrail-h">Como o acervo se organiza</div>
        <ul className="fila-help">
          <li><b>Chave</b> — CNJ ou registro do tribunal. STJ/STF antigos entram por registro.</li>
          <li><b>Mesclagem</b> — duplicatas viram tombstone com <code>merged_into</code>; nada some.</li>
          <li><b>Saúde</b> — fatal próxima, inércia ≥30d e benefícios de execução aparecem em cada card.</li>
          <li>Sigilo sempre sinalizado. Nome do cliente visível (sistema interno).</li>
        </ul>
      </div>

      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">Situação do Renato?</div>
          <div className="bubble ia">Defesa Preliminar com fatal em <b>2 dias</b> (preso). Quer abrir os prazos ou já minutar a peça?</div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Consolidar caso, abrir prazos ou peça…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

import Link from "next/link";

/**
 * Trilho lateral da /clientes — 3ª coluna do shell (slot @rail).
 * "A ficha do cliente cruza" (com bolinhas coloridas por fonte) + Assistente
 * (cartão claro estilo chat; o prompt é CTA p/ a busca, sem chat embutido falso).
 */
export default function ClientesRail() {
  return (
    <aside className="orfas-rail" aria-label="A ficha do cliente cruza">
      <div className="vrail-card">
        <div className="vrail-h">A ficha do cliente cruza</div>
        <ul className="cruza">
          <li><span className="cruza-dot cobalt" /><b>vw_situacao_cliente</b> — processos, prazos, tarefas e audiências num só lugar.</li>
          <li><span className="cruza-dot red" /><b>Execução</b> — situação executória, condenações e objetivos×resultados.</li>
          <li><span className="cruza-dot slate sq" /><b>Notas do Drive</b> — pasta por nome; nota nova datada, nunca sobrescreve.</li>
        </ul>
        <div className="cal-note">Dedup por nome normalizado; homônimo nunca cadastra automático. Sigilo sinalizado.</div>
      </div>

      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">Situação do Edmilson?</div>
          <div className="bubble ia">Semiaberto, progressão vencida há <b>12 dias</b> — falta o último atestado. Quer que eu monte a nota datada a partir do banco?</div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Consolidar, lançar atestado ou anotar…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

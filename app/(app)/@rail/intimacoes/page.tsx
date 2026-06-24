import Link from "next/link";
import { Icon } from "@/components/Icon";

/**
 * Trilho lateral da /intimacoes — 3ª coluna do shell (slot @rail).
 * Explicador da fila (dois eixos da Sugestão 53) + atalho do Assistente
 * (o Claude opera pelo chat — aqui é CTA, não chat embutido).
 */
export default function IntimacoesRail() {
  return (
    <aside className="orfas-rail" aria-label="Como funciona a fila">
      <div className="vrail-card">
        <div className="vrail-h">Como funciona a fila</div>
        <ul className="fila-help">
          <li><b>Para revisar</b> — não lidas. Abrir já marca como lida (o Cowork nunca lê por você).</li>
          <li><b>Na caixa</b> — aguardam encaminhamento (sem prazo/peça ainda).</li>
          <li><span className="enc-ok">✓ Encaminhada</span> — virou prazo ou peça (minuta IA).</li>
          <li>Ações gravam no banco e no Calendar com auditoria. O “do que se trata” é montado do banco.</li>
        </ul>
      </div>

      <Link className="assist-rail" href="/busca">
        <div className="assist-rail-h">
          <span className="assist-seal"><Icon name="activity" size={14} /></span>
          <span>Assistente</span>
        </div>
        <div className="assist-rail-b">
          O Claude opera pelo chat (Cowork) — peça lá “tem algo sem encaminhar?”. Aqui, o atalho de busca.
        </div>
        <div className="assist-rail-prompt">
          <span>Encaminhar, vincular ou resumir…</span>
          <span className="assist-send">→</span>
        </div>
      </Link>
    </aside>
  );
}

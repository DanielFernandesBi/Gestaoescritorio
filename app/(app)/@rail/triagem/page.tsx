import Link from "next/link";
import { Icon } from "@/components/Icon";

/**
 * Trilho lateral da /triagem — 3ª coluna do shell (slot @rail).
 * Doutrina da triagem (manual) + Assistente (o Claude opera pelo chat —
 * aqui é CTA, não chat embutido).
 */
export default function TriagemRail() {
  return (
    <aside className="orfas-rail" aria-label="Como funciona a triagem">
      <div className="vrail-card">
        <div className="vrail-h">Como funciona a triagem</div>
        <ul className="fila-help">
          <li><b>Prazo órfão</b> = fatal viva. Entra no Calendar como provisório e só é validável após vincular.</li>
          <li><b>Promover</b> resolve por nome normalizado + <code>fn_resolver_processo</code> e vincula; auditado, nada apagado.</li>
          <li><b>Homônimo</b> — nomes muito parecidos nunca viram cadastro automático; sua decisão resolve.</li>
          <li>Sigiloso nunca vira cliente automaticamente — fica para triagem humana.</li>
        </ul>
      </div>

      <Link className="assist-rail" href="/busca">
        <div className="assist-rail-h">
          <span className="assist-seal"><Icon name="activity" size={14} /></span>
          <span>Assistente</span>
        </div>
        <div className="assist-rail-b">
          O Claude opera pelo chat (Cowork) — peça lá “o que triar primeiro?”. Aqui, o atalho de busca.
        </div>
        <div className="assist-rail-prompt">
          <span>Vincular, buscar candidatos ou cadastrar…</span>
          <span className="assist-send">→</span>
        </div>
      </Link>
    </aside>
  );
}

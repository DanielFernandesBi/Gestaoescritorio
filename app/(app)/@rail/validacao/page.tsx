import Link from "next/link";
import { getFilaValidacao } from "@/lib/data";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * Trilho lateral da /validacao — 3ª coluna do shell (slot @rail).
 * "O que acontece ao validar" (passos reais do gate), atalho do Assistente
 * (o Claude opera pelo chat — aqui é CTA, não chat embutido) e o resumo da fila.
 */
export default async function ValidacaoRail() {
  const { prazos, audiencias, presos } = await getFilaValidacao();

  return (
    <aside className="orfas-rail" aria-label="Resumo da validação">
      <div className="vrail-card">
        <div className="vrail-h">O que acontece ao validar</div>
        <ol className="vrail-steps">
          <li><span className="vstep-n">1</span> Confirma a ciência e fixa a data fatal.</li>
          <li><span className="vstep-n">2</span> O provisório vira fatal <span className="vermelho">vermelha</span> na /agenda.</li>
          <li><span className="vstep-n">3</span> <code>validado=true</code> · sai desta fila e entra nos prazos ativos.</li>
        </ol>
      </div>

      <Link className="assist-rail" href="/busca">
        <div className="assist-rail-h">
          <span className="assist-seal"><Icon name="activity" size={14} /></span>
          <span>Assistente</span>
        </div>
        <div className="assist-rail-b">
          O Claude opera pelo chat (Cowork) — peça lá “o que valido primeiro?”. Aqui, o atalho de busca.
        </div>
        <div className="assist-rail-prompt">
          <span>Confirmar ciência ou ajustar…</span>
          <span className="assist-send">→</span>
        </div>
      </Link>

      <div className="vrail-card">
        <div className="vrail-h">Resumo da fila</div>
        <div className="fr-row"><span>Prazos</span><b>{prazos.length}</b></div>
        <div className="fr-row"><span>Audiências</span><b>{audiencias.length}</b></div>
        <div className="fr-row preso"><span>Com réu preso</span><b>{presos}</b></div>
      </div>
    </aside>
  );
}

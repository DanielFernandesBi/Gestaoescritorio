import Link from "next/link";
import { Acao } from "@/components/Acao";
import { rodarMarcarAtrasados } from "@/app/actions";

/**
 * Trilho lateral da /financeiro — 3ª coluna do shell (slot @rail). Ação de
 * fechar o mês (rodar fn_marcar_atrasados), doutrina de como o dinheiro entra
 * e a faixa Assistente.
 */
export default function FinanceiroRail() {
  return (
    <aside className="orfas-rail" aria-label="Fechar o mês e como o dinheiro entra">
      {/* fechar o mês */}
      <div className="vrail-card">
        <div className="vrail-h">Fechar o mês</div>
        <p className="tk-rail-p">Antes do fechamento, atualize as parcelas vencidas — move <code>a_vencer</code> → <code className="red">atrasado</code>.</p>
        <Acao
          label={<>↻ Rodar fn_marcar_atrasados</>}
          variant="primary"
          size="md"
          titulo="Marcar parcelas atrasadas"
          confirmarLabel="Rodar agora"
          resumo={<>Move para <b>atrasado</b> toda parcela <b>a_vencer</b> com vencimento anterior a hoje. Tudo auditado.</>}
          acao={rodarMarcarAtrasados}
        />
      </div>

      {/* como o dinheiro entra */}
      <div className="vrail-card">
        <div className="vrail-h">Como o dinheiro entra</div>
        <ul className="aud-rail-list">
          <li><span className="b sq accent" /><span><b>contratos</b> guardam objeto, valor e forma; o contratante pode ser um familiar.</span></li>
          <li><span className="b green" /><span><b>pagamentos</b> são as parcelas — pago, a vencer, atrasado, renegociado.</span></li>
          <li><span className="b slate" /><span><b>despesas</b> reembolsáveis entram no líquido do sócio.</span></li>
        </ul>
        <div className="pz-ciclo-foot">Preferir <code>vw_financeiro_pendente</code> nos relatórios. Tudo auditado.</div>
      </div>

      {/* Assistente */}
      <div className="vrail-card chat-card">
        <div className="chat-h">
          <span className="chat-seal">Assistente</span>
          <span className="chat-claude"><span className="chat-dot" /> Claude</span>
        </div>
        <div className="chat-body">
          <div className="bubble user">Quem está em atraso?</div>
          <div className="bubble ia">2 parcelas, R$ 14,5k: Rafael S. Lima (2/4, 12 dias) e Patrícia N. Gomes (3/6, 4 dias). Quer que eu prepare a régua de cobrança?</div>
        </div>
        <Link className="chat-input" href="/busca">
          <span>Marcar paga, projetar caixa, fechar o mês…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

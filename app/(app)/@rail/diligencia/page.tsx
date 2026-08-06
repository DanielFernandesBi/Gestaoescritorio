import Link from "next/link";

/**
 * Trilho da /diligencia — o piso inviolável da T4 e o que a tela NÃO faz.
 * A regra zero fica no topo de propósito: é o risco maior de toda a automação.
 */
export default function DiligenciaRail() {
  return (
    <aside className="orfas-rail" aria-label="Diligência assistida">
      <div className="vrail-card">
        <div className="vrail-h">Regra zero</div>
        <div className="dil-regra">
          <b>Jamais abrir intimação ou expediente pendente no painel do tribunal.</b> Em PJe e SEEU
          isso registra <b>ciência</b> e deflagra prazo. A T4 consulta a linha do tempo e os
          documentos já disponíveis; se o ato só for visível por link que dá ciência, ela para e
          pergunta.
        </div>
      </div>

      <div className="vrail-card">
        <div className="vrail-h">Como a T4 trabalha</div>
        <ul className="vrail-steps">
          <li><span className="vstep-n">1</span>Você a chama — nunca é agendada, por causa do 2FA. O token fica na máquina e você digita senha e autenticador.</li>
          <li><span className="vstep-n">2</span>Ela lê <code>vw_diligencia_fila</code>, agrupa por sistema para economizar login e abre processo a processo.</li>
          <li><span className="vstep-n">3</span>Responde <b>do que se trata</b>, se corre prazo e se exige providência, e grava por <code>fn_registrar_diligencia</code>.</li>
          <li><span className="vstep-n">4</span>A apuração vai para o andamento como <b>adição</b>. O texto do tribunal nunca é apagado.</li>
        </ul>
      </div>

      <div className="vrail-card">
        <div className="vrail-h">Não é varredura</div>
        <div className="cal-note">
          Só se entra onde já se sabe que há algo para ver, e é a fila que define isso. Vasculhar
          todos os processos todos os dias é mau uso do acesso.
          <br />
          <br />
          O piso é o mesmo do redator agendado — jamais protocola, peticiona, assina ou junta
          documento; jamais cria peça ou prazo definitivo; nunca toca a leitura das intimações, que
          é ato humano e pessoal.
        </div>
      </div>

      <div className="vrail-card">
        <div className="vrail-h">Duas origens, dois pesos</div>
        <ul className="leg">
          <li><span className="leg-dot ok" /><b>Nos autos</b> — alguém teve o ato à vista. É verificação.</li>
          <li><span className="leg-dot slate" /><b>Pelo mapa</b> — um padrão foi reconhecido, ninguém abriu o processo. É inferência, e só vale para rotina confirmada (3+ confirmações, zero divergência, sem providência). Processo sigiloso nunca é apurado pelo mapa.</li>
        </ul>
        <Link className="chat-input" href="/andamentos">
          <span>Ver o feed com as apurações…</span>
          <span className="chat-send">→</span>
        </Link>
      </div>
    </aside>
  );
}

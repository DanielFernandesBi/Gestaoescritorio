import type { ReactNode } from "react";

/**
 * Casca mestre-detalhe das telas raiz de listagem — reaproveita a mesma casca
 * do drawer (.audp): nav escuro (fora, no AppShell) · índice (lista compacta) ·
 * área principal com scroll próprio · assistente como faixa inferior opcional.
 *
 * `indice` é o componente de lista do próprio drawer da entidade (não duplicar).
 * `children` é o conteúdo atual da tela (hero, stats, cards), encostado à
 * esquerda no índice e limitado a ~1040px. `assistente` é a faixa inferior.
 */
export function ListaRaiz({
  indice,
  children,
  assistente,
}: {
  indice: ReactNode;
  children: ReactNode;
  assistente?: ReactNode;
}) {
  return (
    <div className="audp audp-raiz">
      {indice}
      <section className="audp-detail">
        <div className="audp-scroll">
          <div className="audp-inner audp-raiz-inner">{children}</div>
        </div>
        {assistente && <div className="audp-assist">{assistente}</div>}
      </section>
    </div>
  );
}

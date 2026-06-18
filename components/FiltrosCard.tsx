import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

/**
 * Card padrão de filtros (mesmo visual do Painel): cabeçalho com ícone + título
 * "Filtros" e os chips no corpo. Mantém o espaçamento padrão (16px abaixo).
 */
export function FiltrosCard({ children }: { children: ReactNode }) {
  return (
    <div className="card op-card" style={{ marginBottom: 16 }}>
      <div className="card-h"><h3><Icon name="list" /> Filtros</h3></div>
      <div className="card-b">{children}</div>
    </div>
  );
}

import { Icon } from "./Icon";

export function EmBreve({
  titulo,
  eyebrow,
  descricao,
}: {
  titulo: string;
  eyebrow: string;
  descricao: string;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{titulo}</h1>
          <p>{descricao}</p>
        </div>
      </div>
      <div className="card">
        <div className="empty">
          <div style={{ marginBottom: 10, color: "var(--brass)" }}>
            <Icon name="settings" size={26} className="" />
          </div>
          Módulo em construção.
          <br />
          <span style={{ fontSize: 12 }}>
            O Painel já está ligado ao banco; este módulo entra na sequência da Fase 1
            (somente leitura), usando as views e tabelas reais.
          </span>
        </div>
      </div>
    </>
  );
}

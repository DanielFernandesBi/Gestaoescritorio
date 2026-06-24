import { LoginForm } from "./LoginForm";
import { devLoginEnabled } from "@/lib/dev-login";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="mark">
          Fernandes <span className="amp">&amp;</span> Fernandes
        </div>
        <div className="sub">Advocacia Criminal</div>

        <h1>Acesso ao sistema</h1>
        <p className="lead">
          Sistema de gestão do escritório. Enviamos um link de acesso para o
          seu e-mail.
        </p>

        <LoginForm erroInicial={erro} devEnabled={devLoginEnabled()} />

        <div className="login-foot">
          Acesso restrito aos sócios · prazos penais em dias corridos
          <br />o banco é a fonte da verdade
        </div>
      </div>
    </div>
  );
}

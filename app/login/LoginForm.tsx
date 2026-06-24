"use client";

import { useActionState, useState } from "react";
import { devLogin, enviarMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle", message: "" };

export function LoginForm({
  erroInicial,
  devEnabled = false,
}: {
  erroInicial?: string;
  devEnabled?: boolean;
}) {
  const [state, action, pending] = useActionState(enviarMagicLink, initial);

  const erroUrl =
    erroInicial === "nao_autorizado"
      ? "Acesso não autorizado para este e-mail."
      : erroInicial === "link_invalido"
        ? "Link expirado ou inválido. Solicite um novo."
        : null;

  return (
    <>
      <form action={action}>
        <label htmlFor="email">E-mail do escritório</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          defaultValue={state.email}
          required
          disabled={state.status === "ok"}
        />

        <button className="btn primary" type="submit" disabled={pending || state.status === "ok"}>
          {pending ? "Enviando…" : state.status === "ok" ? "Link enviado" : "Enviar link de acesso"}
        </button>

        {state.status === "ok" && (
          <div className="login-msg ok">{state.message}</div>
        )}
        {state.status === "error" && (
          <div className="login-msg err">{state.message}</div>
        )}
        {state.status === "idle" && erroUrl && (
          <div className="login-msg err">{erroUrl}</div>
        )}
      </form>

      {devEnabled && <DevLogin />}
    </>
  );
}

function DevLogin() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(devLogin, initial);

  return (
    <div className="dev-login">
      <button
        type="button"
        className="btn ghost sm dev-login-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        ⚡ Dev Login
      </button>

      {open && (
        <form action={action} className="dev-login-form">
          <label htmlFor="dev-email">E-mail</label>
          <input
            id="dev-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            defaultValue={state.email}
            required
          />

          <label htmlFor="dev-password">Senha</label>
          <input
            id="dev-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />

          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? "Entrando…" : "Entrar (dev)"}
          </button>

          {state.status === "error" && (
            <div className="login-msg err">{state.message}</div>
          )}
        </form>
      )}
    </div>
  );
}

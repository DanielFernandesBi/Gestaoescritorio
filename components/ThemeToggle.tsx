"use client";

import { useEffect, useState } from "react";

/**
 * Alterna entre tema claro e escuro gravando a escolha em localStorage.
 * O tema inicial é aplicado por um script inline no layout (anti-flash),
 * antes da hidratação — aqui só sincronizamos o estado do botão.
 */
export function ThemeToggle() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.dataset.theme === "dark");
  }, []);

  function alternar() {
    const proximo =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = proximo;
    try {
      localStorage.setItem("tema", proximo);
    } catch {
      /* localStorage indisponível — ignora */
    }
    setEscuro(proximo === "dark");
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={alternar}
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
    >
      <span aria-hidden>{escuro ? "☀" : "☾"}</span>
    </button>
  );
}

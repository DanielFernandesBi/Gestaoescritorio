"use client";

import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { SinoAlertas } from "./SinoAlertas";

export function Topbar({
  iniciais,
  onMenu,
  navOpen = false,
}: {
  iniciais: string;
  onMenu?: () => void;
  navOpen?: boolean;
}) {
  const hoje = new Date();
  const dataLonga = hoje
    .toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      timeZone: "America/Sao_Paulo",
    })
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <header className="topbar">
      <button
        type="button"
        className="nav-menu-btn"
        onClick={onMenu}
        aria-label="Abrir menu"
        aria-controls="app-nav"
        aria-expanded={navOpen}
      >
        <Icon name="menu" className="" />
      </button>
      <form className="search" action="/busca" method="get">
        <span className="si">
          <Icon name="search" className="" />
        </span>
        <input
          name="q"
          placeholder="Buscar cliente, CNJ, nº de registro, intimação…"
          aria-label="Busca global"
          autoComplete="off"
        />
      </form>
      <div className="spacer" />
      <SinoAlertas />
      <ThemeToggle />
      <div className="today">
        <b>{dataLonga}</b>
        <span>Ritual matinal</span>
      </div>
      <div className="who" title="Sessão ativa">
        {iniciais}
      </div>
    </header>
  );
}

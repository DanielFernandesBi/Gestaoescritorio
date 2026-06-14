"use client";

import { Icon } from "./Icon";

export function Topbar({ iniciais }: { iniciais: string }) {
  const hoje = new Date();
  const dataLonga = hoje
    .toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    })
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <header className="topbar">
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

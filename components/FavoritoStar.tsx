"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { alternarFavorito } from "@/app/actions";

/** Estrela de favorito clicável (não dispara o clique da linha). */
export function FavoritoStar({ id, favorito }: { id: string; favorito: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(favorito);
  const [pend, setPend] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pend) return;
    const novo = !on;
    setOn(novo); // otimista
    setPend(true);
    const r = await alternarFavorito(id, novo);
    setPend(false);
    if (r.ok) router.refresh();
    else setOn(!novo); // reverte em erro
  }

  return (
    <button
      type="button"
      className={`star${on ? " on" : ""}`}
      title={on ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-label={on ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      onClick={toggle}
    >
      {on ? "★" : "☆"}
    </button>
  );
}

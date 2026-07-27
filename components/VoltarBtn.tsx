"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./Icon";

/**
 * "Voltar" global (histórico do navegador). Os links do app (nº do processo, nome
 * do cliente, etc.) redirecionam sem deixar um caminho de volta; este botão leva à
 * ÚLTIMA tela via router.back(), sem refazer o percurso.
 *
 * Só aparece depois da primeira navegação DENTRO do app nesta sessão de tela — o
 * layout (e portanto este componente) fica montado entre as rotas do App Router,
 * então o sinal sobrevive às trocas de página. Assim não mostramos "voltar" num
 * deep-link recém-aberto (onde back() sairia do app).
 */
export function VoltarBtn() {
  const router = useRouter();
  const pathname = usePathname();
  const [podeVoltar, setPodeVoltar] = useState(false);
  const anterior = useRef<string | null>(null);

  useEffect(() => {
    // 1ª montagem = tela de entrada; a partir da 1ª troca de rota, habilita.
    if (anterior.current !== null && anterior.current !== pathname) {
      setPodeVoltar(true);
    }
    anterior.current = pathname;
  }, [pathname]);

  if (!podeVoltar) return null;

  return (
    <button
      type="button"
      className="topbar-back"
      onClick={() => router.back()}
      aria-label="Voltar para a tela anterior"
      title="Voltar para a tela anterior"
    >
      <Icon name="arrow-left" />
      <span>Voltar</span>
    </button>
  );
}

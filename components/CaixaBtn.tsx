"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";

/**
 * Atalho CHAMATIVO para a Caixa de trabalho ESPECÍFICA de um processo. De qualquer
 * card ligado a um processo (andamento, intimação, prazo, peça, tarefa, audiência),
 * leva a /caixa?foco=<processo_id> — onde tudo o que está em aberto naquele processo
 * (prazos, audiências, intimações, peças, tarefas) aparece reunido. Símbolo de caixa.
 */
export function CaixaBtn({
  processoId,
  label = "Caixa do processo",
  className = "",
  stop = true,
}: {
  processoId: string;
  label?: string;
  className?: string;
  stop?: boolean; // impede que o clique borbulhe para um card/linha clicável ao redor
}) {
  return (
    <Link
      className={`caixa-btn ${className}`}
      href={`/caixa?foco=${processoId}`}
      title="Abrir a Caixa de trabalho deste processo — prazos, audiências, intimações, peças e tarefas em aberto"
      onClick={stop ? (e) => e.stopPropagation() : undefined}
    >
      <Icon name="inbox" size={14} />
      <span>{label}</span>
    </Link>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { linkPara } from "@/lib/links";

/**
 * Envoltório clicável para a referência do processo. Fica num componente client
 * separado para poder usar stopPropagation — assim o link funciona mesmo dentro
 * de uma linha de tabela clicável, sem disparar o onClick da linha.
 */
export function ProcLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Link
      href={linkPara("processo", id)}
      className="proc-link"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}

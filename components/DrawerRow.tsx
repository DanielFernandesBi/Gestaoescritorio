"use client";

import type { ReactNode } from "react";
import { useDrawer } from "./Drawer";

/**
 * Linha de tabela clicável que abre o drawer de detalhe.
 * `title`/`body` podem ser montados no servidor e passados como props.
 */
export function DrawerRow({
  title,
  body,
  children,
}: {
  title: ReactNode;
  body: ReactNode;
  children: ReactNode;
}) {
  const { open } = useDrawer();
  return (
    <tr className="clickable" onClick={() => open({ title, body })}>
      {children}
    </tr>
  );
}

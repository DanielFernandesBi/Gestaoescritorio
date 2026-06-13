"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type DrawerContent = { title: ReactNode; body: ReactNode };

type DrawerCtx = {
  open: (content: DrawerContent) => void;
  close: () => void;
};

const Ctx = createContext<DrawerCtx | null>(null);

export function useDrawer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDrawer deve ser usado dentro de <DrawerProvider>");
  return ctx;
}

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<DrawerContent | null>(null);

  const open = useCallback((c: DrawerContent) => setContent(c), []);
  const close = useCallback(() => setContent(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      <div
        className={`scrim${content ? " open" : ""}`}
        onClick={close}
        aria-hidden
      />
      <aside
        className={`drawer${content ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="drawer-h">
          <div>{content?.title}</div>
          <button className="x" onClick={close} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="drawer-b">{content?.body}</div>
      </aside>
    </Ctx.Provider>
  );
}

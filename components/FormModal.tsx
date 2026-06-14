"use client";

import { useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Resultado } from "@/app/actions";

/** Modal com formulário que envia FormData para uma Server Action. */
export function FormModal({
  label,
  titulo,
  descricao,
  acao,
  children,
  enviarLabel = "Salvar",
  variant = "primary",
}: {
  label: ReactNode;
  titulo: string;
  descricao?: string;
  acao: (fd: FormData) => Promise<Resultado>;
  children: ReactNode;
  enviarLabel?: string;
  variant?: "primary" | "default";
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPend(true);
    const r = await acao(fd);
    setPend(false);
    setRes(r);
    if (r.ok) {
      router.refresh();
      setTimeout(() => setAberto(false), 800);
    }
  }

  return (
    <>
      <button className={`btn ${variant}`} onClick={() => { setAberto(true); setRes(null); }} type="button">
        {label}
      </button>
      {aberto && (
        <div className="modal-scrim" onClick={() => setAberto(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
            <div className="modal-h">
              <h3>{titulo}</h3>
              {descricao && <p>{descricao}</p>}
            </div>
            <div className="modal-b">
              {children}
              {res && <div className={`modal-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>}
            </div>
            <div className="modal-f">
              <button className="btn ghost" type="button" onClick={() => setAberto(false)} disabled={pend}>
                Cancelar
              </button>
              <button className="btn primary" type="submit" disabled={pend || Boolean(res?.ok)}>
                {pend ? "Salvando…" : enviarLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

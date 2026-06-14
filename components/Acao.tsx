"use client";

import { useState, type ReactNode, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { Resultado } from "@/app/actions";

type CampoTexto = {
  label: string;
  placeholder?: string;
  obrigatorio?: boolean;
  multiline?: boolean;
};

type Variant = "primary" | "default" | "danger" | "ok" | "ghost";

/**
 * Botão que pede confirmação (mostra um resumo do que será gravado, conforme o
 * manual) e executa uma Server Action. Opcionalmente coleta um texto (motivo,
 * providência, descrição). Atualiza a tela ao concluir.
 */
export function Acao({
  label,
  titulo,
  resumo,
  acao,
  confirmarLabel = "Confirmar",
  variant = "default",
  size = "sm",
  campoTexto,
}: {
  label: ReactNode;
  titulo: string;
  resumo?: ReactNode;
  acao: (texto: string) => Promise<Resultado>;
  confirmarLabel?: string;
  variant?: Variant;
  size?: "sm" | "md";
  campoTexto?: CampoTexto;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pend, setPend] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  const faltaTexto = Boolean(campoTexto?.obrigatorio && !texto.trim());

  function abrir(e: MouseEvent) {
    e.stopPropagation();
    setAberto(true);
    setRes(null);
    setTexto("");
  }
  function fechar(e?: MouseEvent) {
    e?.stopPropagation();
    setAberto(false);
  }
  async function confirmar(e: MouseEvent) {
    e.stopPropagation();
    if (faltaTexto) return;
    setPend(true);
    const r = await acao(texto);
    setPend(false);
    setRes(r);
    if (r.ok) {
      router.refresh();
      setTimeout(() => setAberto(false), 800);
    }
  }

  const cls = `btn ${variant === "default" ? "" : variant} ${size === "sm" ? "sm" : ""}`.trim();

  return (
    <>
      <button className={cls} onClick={abrir} type="button">
        {label}
      </button>
      {aberto && (
        <div className="modal-scrim" onClick={fechar}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{titulo}</h3>
            </div>
            <div className="modal-b">
              {resumo && <div className="modal-resumo">{resumo}</div>}
              {campoTexto && (
                <div>
                  <label>{campoTexto.label}</label>
                  {campoTexto.multiline ? (
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder={campoTexto.placeholder}
                    />
                  ) : (
                    <input
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder={campoTexto.placeholder}
                    />
                  )}
                </div>
              )}
              {res && (
                <div className={`modal-msg ${res.ok ? "ok" : "err"}`}>{res.message}</div>
              )}
            </div>
            <div className="modal-f">
              <button className="btn ghost" onClick={fechar} type="button" disabled={pend}>
                Fechar
              </button>
              <button
                className={`btn ${variant === "danger" ? "danger" : "primary"}`}
                onClick={confirmar}
                type="button"
                disabled={pend || faltaTexto || Boolean(res?.ok)}
              >
                {pend ? "Gravando…" : confirmarLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

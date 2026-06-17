import { ddClass, ddLabel } from "@/lib/format";
import { ProcLink } from "@/components/ProcLink";

/** Semáforo de prazo (dias restantes). */
export function DiasBox({ dias }: { dias: number }) {
  return (
    <span className={`ddays ${ddClass(dias)}`}>
      <b>{dias < 0 ? Math.abs(dias) : dias}</b>
      <span>{ddLabel(dias)}</span>
    </span>
  );
}

export function SegredoTag({ on }: { on?: boolean | null }) {
  if (!on) return null;
  return <span className="lock">🔒 segredo de justiça</span>;
}

/**
 * Referência do processo: CNJ ou nº de registro do tribunal.
 * Quando `id` é informado, vira link para a página/modal do processo.
 */
export function ProcRef({
  cnj,
  registro,
  id,
}: {
  cnj?: string | null;
  registro?: string | null;
  id?: string | null;
}) {
  const inner = cnj ? (
    <span className="cnj">{cnj}</span>
  ) : registro ? (
    <span
      className="num-reg"
      title="Processo identificado por nº de registro do tribunal"
    >
      reg {registro}
    </span>
  ) : (
    <span className="sub">sem CNJ</span>
  );

  if (id && (cnj || registro)) return <ProcLink id={id}>{inner}</ProcLink>;
  return inner;
}

type PillTone = "red" | "amber" | "green" | "blue" | "gray" | "brass";

export function Pill({
  tone = "gray",
  dot = true,
  children,
}: {
  tone?: PillTone;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`pill ${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function Gate({ validado }: { validado: boolean }) {
  return validado ? (
    <span className="gate done">✓ validado</span>
  ) : (
    <span className="gate wait">⏳ aguardando</span>
  );
}

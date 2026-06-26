import Link from "next/link";
import { ddClass, ddLabel, humano } from "@/lib/format";
import { ProcLink } from "@/components/ProcLink";
import { linkPara } from "@/lib/links";
import type { CasoContexto, ParteCliente } from "@/lib/data";

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

type PillTone = "red" | "amber" | "green" | "blue" | "gray" | "brass" | "violet";

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

/**
 * Sugestão 56 — "Do que se trata": linha determinística montada do banco
 * (classe · assunto · área · fase · instância · tribunal · vara), para o usuário
 * bater o olho e entender o caso. Não exibe nada quando não há contexto.
 */
export function ContextoCaso({ ctx }: { ctx?: CasoContexto | null }) {
  if (!ctx) return null;
  const partes = [ctx.classe, ctx.assunto, ctx.area, ctx.fase, ctx.instancia, ctx.tribunal, ctx.vara_comarca]
    .map((s) => s?.trim())
    .filter(Boolean) as string[];
  if (!partes.length) return null;
  return (
    <div className="ctx-caso sub" title="Do que se trata (montado do banco)">
      <span className="ctx-k">do que se trata</span> {partes.join(" · ")}
    </div>
  );
}

/**
 * Sugestão 56 — cliente(s) em destaque com o papel no processo
 * (réu/paciente/executado/recorrente…). Usado no topo do card de intimação.
 */
export function PartesCliente({ partes }: { partes?: ParteCliente[] | null }) {
  if (!partes?.length) return null;
  return (
    <>
      {partes.map((p, i) => (
        <span key={`${p.nome}-${i}`} className="parte">
          {p.id ? (
            <Link className="parte-nome parte-link" href={linkPara("cliente", p.id)}>{p.nome}</Link>
          ) : (
            <span className="parte-nome">{p.nome}</span>
          )}
          {p.papel && <span className="parte-papel"> · {humano(p.papel)}</span>}
        </span>
      ))}
    </>
  );
}

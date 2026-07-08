import Link from "next/link";
import { getTodasAnotacoes } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Tone = "red" | "amber" | "green" | "blue" | "gray" | "brass" | "violet";

// Etiqueta por origem: o usuário bate o olho e sabe DE ONDE veio a anotação.
const ETIQUETA: Record<string, { label: string; tone: Tone }> = {
  intimacao: { label: "intimação", tone: "blue" },
  processo: { label: "processo", tone: "brass" },
  andamento: { label: "movimentação", tone: "blue" },
  prazo: { label: "prazo", tone: "amber" },
  tarefa: { label: "tarefa", tone: "violet" },
  cliente: { label: "cliente", tone: "green" },
  audiencia: { label: "audiência", tone: "brass" },
  peca: { label: "peça", tone: "blue" },
  contrato: { label: "contrato", tone: "green" },
  estudo: { label: "estudo", tone: "violet" },
  varredura: { label: "varredura", tone: "gray" },
};

export default async function NotasPage() {
  const notas = await getTodasAnotacoes();

  return (
    <>
      <PageHeader
        breadcrumb={["Trabalho", "Notas"]}
        eyebrow="Anotações livres · todas as origens"
        titulo="Notas"
        descricao={
          <>
            Tudo o que foi anotado à mão — em intimações, processos, movimentações, prazos, clientes… —
            reunido aqui. Cada nota mostra <b>onde</b> foi feita, <b>por quem</b> e <b>quando</b>, com link
            para abrir a origem.
          </>
        }
        kpis={[{ valor: notas.length, label: "anotações", tone: "accent" }]}
      />
      <div className="card">
        <div className="card-b">
          {notas.length === 0 ? (
            <div className="empty">
              Nenhuma anotação ainda. Escreva a primeira em qualquer intimação, processo, prazo…
            </div>
          ) : (
            <div className="notas-lista">
              {notas.map((n) => {
                const et = ETIQUETA[n.entidade_tipo] ?? { label: n.entidade_tipo, tone: "gray" as Tone };
                const editado = n.atualizado_em && n.atualizado_em !== n.criado_em;
                return (
                  <div key={n.id} className="audp-nota">
                    <div className="nota-orig">
                      <Pill tone={et.tone} dot={false}>{et.label}</Pill>
                      {n.href ? (
                        <Link className="link" href={n.href}>{n.contexto ?? "abrir origem"}</Link>
                      ) : (
                        <span className="sub">{n.contexto ?? "—"}</span>
                      )}
                    </div>
                    <div className="audp-nota-txt">{n.texto}</div>
                    <div className="audp-nota-foot">
                      <span className="audp-nota-meta">
                        {n.autor} · {fmtDate(n.criado_em)}{editado ? " · editada" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

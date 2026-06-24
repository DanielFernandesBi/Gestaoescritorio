import Link from "next/link";
import { getUltimaVarredura } from "@/lib/queries";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * Trilho lateral da /varredura — 3ª coluna do shell (slot @rail).
 * Saúde das fontes DERIVADA da última varredura (status + anomalias; fonte que
 * aparece em anomalia = degradou), próxima execução e o atalho do Assistente.
 */
export default async function VarreduraRail() {
  const varredura = await getUltimaVarredura();
  const anomalias = varredura?.anomalias ?? [];
  const degradou = (nome: string) => anomalias.some((a) => (a.fonte ?? "").toLowerCase().includes(nome));

  const fontes = [
    { nome: "Supabase", ok: Boolean(varredura) },
    { nome: "Gmail", ok: Boolean(varredura) && varredura!.status !== "falha" && !degradou("gmail") },
    { nome: "DJEN · Cloud Run 22h", ok: !degradou("djen") },
    { nome: "Google Calendar", ok: !degradou("calendar") },
    { nome: "Google Drive", ok: !degradou("drive") },
  ];

  return (
    <aside className="orfas-rail" aria-label="Saúde da varredura">
      <div className="vrail-card">
        <div className="vrail-h">Saúde das fontes</div>
        {fontes.map((f) => (
          <div className="fonte-row" key={f.nome}>
            <span className={`fonte-dot ${f.ok ? "ok" : "bad"}`} />
            <span className="fonte-nome">{f.nome}</span>
            <span className={`fonte-st ${f.ok ? "ok" : "bad"}`}>{f.ok ? "online" : "degradou"}</span>
          </div>
        ))}
      </div>

      <div className="vrail-card">
        <div className="vrail-h">Próxima execução</div>
        <div className="prox-exec">
          <span className="cal-dot" /> hoje · <b>22:00</b> · Cowork
        </div>
        <div className="cal-note">Cloud Scheduler diário (Brasília). Sob demanda, peça “rode a triagem” no chat.</div>
      </div>

      <Link className="assist-rail" href="/busca">
        <div className="assist-rail-h">
          <span className="assist-seal"><Icon name="activity" size={14} /></span>
          <span>Assistente</span>
        </div>
        <div className="assist-rail-b">
          O Claude opera pelo chat (Cowork) — peça lá “por que ontem foi parcial?”. Aqui, o atalho de busca.
        </div>
        <div className="assist-rail-prompt">
          <span>Rodar agora ou investigar fonte…</span>
          <span className="assist-send">→</span>
        </div>
      </Link>
    </aside>
  );
}

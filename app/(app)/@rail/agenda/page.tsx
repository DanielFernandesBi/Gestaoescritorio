import Link from "next/link";
import { getUltimaVarredura } from "@/lib/queries";
import { getFilaValidacao } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Trilho lateral da /agenda — 3ª coluna do shell (slot @rail).
 * Estado do Calendar (a triagem cria os eventos), fila de provisórios e o
 * atalho do Assistente (o Claude opera pelo chat — aqui é CTA, não chat embutido).
 */
export default async function AgendaRail() {
  const [varredura, { prazos, audiencias }] = await Promise.all([getUltimaVarredura(), getFilaValidacao()]);
  const provisorios = prazos.length + audiencias.length;

  return (
    <aside className="orfas-rail" aria-label="Resumo da agenda">
      <div className="vrail-card">
        <div className="vrail-h">Google Calendar</div>
        <div className="cal-sync">
          <span className="cal-dot" />
          {varredura ? <>Sincronizado · última triagem às <b>{fmtTime(varredura.criado_em)}</b></> : "Sem sincronização registrada"}
        </div>
        <div className="cal-note">
          A triagem cria todo prazo/audiência como evento <span className="tang">tangerina</span> — rede de
          segurança até você validar.
        </div>
      </div>

      <Link className="vrail-card prov-card" href="/validacao">
        <div className="prov-n">{provisorios}</div>
        <div className="prov-l">{provisorios === 1 ? "evento provisório" : "eventos provisórios"} aguardam validação</div>
        <span className="prov-cta">Validar →</span>
      </Link>

      <Link className="assist-rail" href="/busca">
        <div className="assist-rail-h">
          <span className="assist-seal"><Icon name="activity" size={14} /></span>
          <span>Assistente</span>
        </div>
        <div className="assist-rail-b">
          O Claude opera pelo chat (Cowork) — peça lá “tenho conflito esta semana?”. Aqui, o atalho de busca.
        </div>
        <div className="assist-rail-prompt">
          <span>Reagendar ou criar compromisso…</span>
          <span className="assist-send">→</span>
        </div>
      </Link>
    </aside>
  );
}

import { getProcessosParados, getFinanceiro } from "@/lib/data";
import { getBeneficiosProximos, getUltimaVarredura, getAlertas } from "@/lib/queries";
import { AlertasView, type Alerta } from "@/components/modules/AlertasView";
import { Icon } from "@/components/Icon";
import { rotuloAlerta, toneAlerta, alvoAlerta, prazoAlerta } from "@/lib/alertas";
import { fmtDate, fmtBRL, fmtTime, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TITULO_ANOMALIA: Record<string, string> = {
  cobertura_djen: "Possível buraco de cobertura do DJEN",
  minuta_falha: "Minuta não gerada pelo redator",
  minuta_diferida: "Minuta diferida — aguardando insumo",
  digest_duplicado: "Recorte Digital duplicado",
  fonte_nao_ingerida: "Fonte não ingerida",
};
const tituloAnomalia = (t: string) => TITULO_ANOMALIA[t] ?? humano(t);

const ORDEM: Record<Alerta["categoria"], number> = { prazo_fatal: 0, execucao: 1, parado: 2, anomalia: 3, financeiro: 4 };

export default async function AlertasPage() {
  const [vwAlertas, parados, fin, beneficios, varredura] = await Promise.all([
    getAlertas(),
    getProcessosParados(30),
    getFinanceiro(),
    getBeneficiosProximos(50),
    getUltimaVarredura(),
  ]);

  const alertas: Alerta[] = [];

  // Prazos e audiências no radar vêm da vw_alertas (seção Central, abaixo).

  // 2. Benefícios de execução (vencidos = crítico; próximos ≤180d = acompanhar).
  for (const b of beneficios.filter((b) => b.dias <= 180)) {
    const vencido = b.dias < 0;
    alertas.push({
      id: `exec-${b.cliente_id}-${b.tipo}`,
      categoria: "execucao",
      severidade: vencido ? "critico" : "acompanhar",
      tag: "EXECUÇÃO · BENEFÍCIO",
      titulo: `${b.tipo === "progressao" ? "Progressão" : "Livramento"} ${vencido ? "vencida" : "próxima"} — ${b.segredo ? "Cliente sigiloso" : b.nome}`,
      sub: `${b.regime_atual ? `${humano(b.regime_atual)} · ` : ""}marco ${vencido ? "vencido" : "atingível"} · benefício a requerer`,
      metrica: `vw_situacao_executoria_atual · data prevista ${fmtDate(b.data_prevista)}`,
      dias: b.dias,
      acoes: [
        { label: "Requerer progressão", href: linkPara("cliente", b.cliente_id), primary: true },
        { label: "Abrir execução", href: linkPara("cliente", b.cliente_id) },
      ],
    });
  }

  // 3. Processos parados ≥30d (com réu preso = crítico). Cap p/ manter o radar enxuto.
  for (const p of parados.slice(0, 25)) {
    alertas.push({
      id: `parado-${p.processo_id}`,
      categoria: "parado",
      severidade: p.tem_preso ? "critico" : "acompanhar",
      tag: "RADAR · PARADO",
      preso: p.tem_preso,
      titulo: `Sem movimentação há ${p.dias_parado} dias`,
      sub: [p.segredo_justica ? "🔒 sigiloso" : p.clientes, humano(p.area), p.numero_cnj ?? p.numero_registro_tribunal].filter(Boolean).join(" · ") || null,
      metrica: `getProcessosParados(30) · último andamento ${fmtDate(p.ultima_movimentacao)}`,
      dias: p.dias_parado,
      acoes: [
        { label: "Provocar andamento", href: linkPara("processo", p.processo_id), primary: true },
        { label: "Abrir processo", href: linkPara("processo", p.processo_id) },
      ],
    });
  }

  // 4. Anomalias da última varredura (acompanhar).
  (varredura?.anomalias ?? []).forEach((an, idx) => {
    alertas.push({
      id: `anom-${idx}`,
      categoria: "anomalia",
      severidade: "acompanhar",
      tag: an.tipo,
      tag2: an.fonte ? humano(an.fonte) : null,
      titulo: tituloAnomalia(an.tipo),
      sub: an.detalhe,
      metrica: "vw_ultima_varredura · anomalias",
      canto: varredura ? fmtTime(varredura.criado_em) : null,
      acoes: [
        { label: "Ver na varredura", href: "/varredura", primary: true },
        { label: "Marcar conferido", href: "/varredura" },
      ],
    });
  });

  // 5. Financeiro atrasado (alerta pontual — acompanhar).
  for (const pa of fin.parcelas.filter((p) => p.status === "atrasado")) {
    alertas.push({
      id: `fin-${pa.id}`,
      categoria: "financeiro",
      severidade: "acompanhar",
      tag: "FINANCEIRO · ATRASADO",
      titulo: pa.cliente,
      sub: `parcela ${pa.numero_parcela} · ${pa.dias_atraso} dias em atraso`,
      canto: `venc. ${fmtDate(pa.vencimento)}`,
      valor: fmtBRL(pa.valor),
      acoes: [
        { label: "Cobrar", href: pa.contrato_id ? linkPara("contrato", pa.contrato_id) : "/financeiro", primary: true },
        { label: "Financeiro", href: "/financeiro" },
      ],
    });
  }

  alertas.sort((a, b) => {
    const sev = (a.severidade === "critico" ? 0 : 1) - (b.severidade === "critico" ? 0 : 1);
    if (sev) return sev;
    const cat = ORDEM[a.categoria] - ORDEM[b.categoria];
    if (cat) return cat;
    return (a.dias ?? 9999) - (b.dias ?? 9999);
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Radar de riscos</div>
          <h1>Alertas</h1>
          <p>O que pode escapar: prazos e audiências no limite, benefícios de execução, processos parados e anomalias da varredura. Críticos no topo.</p>
        </div>
      </div>

      {/* Sug. 79 — Central de prazos & audiências (mesma fonte do sino: vw_alertas) */}
      <div className="al-central">
        <div className="al-central-h">
          <span className="t"><Icon name="bell" size={15} /> Prazos &amp; audiências no radar</span>
          <span className="n">{vwAlertas.length}</span>
          <code>vw_alertas</code>
        </div>
        {vwAlertas.length ? (
          <div className="al-central-list">
            {vwAlertas.map((a) => (
              <Link key={`${a.tipo_alerta}-${a.id}`} className={`al-crow t-${toneAlerta(a.prioridade)}`} href={alvoAlerta(a)}>
                <span className="al-ctag">{rotuloAlerta(a.tipo_alerta)}</span>
                <div className="al-cmid">
                  <div className="ti">{a.segredo ? "🔒 Sigiloso" : a.titulo}</div>
                  {a.numero_cnj && !a.segredo && <div className="sub mono">{a.numero_cnj}</div>}
                </div>
                {prazoAlerta(a) && <span className={`al-cdias t-${toneAlerta(a.prioridade)}`}>{prazoAlerta(a)}</span>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">Nenhum prazo ou audiência no limite. 🎉</div>
        )}
      </div>

      <AlertasView alertas={alertas} />
    </>
  );
}

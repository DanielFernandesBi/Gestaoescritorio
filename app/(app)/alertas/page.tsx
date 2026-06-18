import Link from "next/link";
import { getProcessosParados, getClientesPresos } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Pill, ProcRef, SegredoTag } from "@/components/ui";
import { CriarAlerta } from "@/components/CriarAlerta";
import { fmtDate, humano } from "@/lib/format";

export const dynamic = "force-dynamic";

const FAIXAS = [15, 30, 60, 90];
const SIT: Record<string, string> = { preso_provisorio: "Preso provisório", preso_definitivo: "Preso definitivo" };

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const sp = await searchParams;
  const dias = Number(sp?.dias ?? "30") || 30;
  const [parados, presos] = await Promise.all([getProcessosParados(dias), getClientesPresos()]);
  const presosParados = parados.filter((p) => p.tem_preso).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inteligência · radar de risco</div>
          <h1>Alertas</h1>
          <p>
            Processos não arquivados sem movimentação (andamento, intimação, prazo,
            audiência ou atualização) há um tempo, e réus presos para priorizar.
          </p>
        </div>
        <CriarAlerta />
      </div>

      <div className="banner">
        <span className="ico"><Icon name="shield" /></span>
        <div>
          “Movimentação” = sinal mais recente de atividade no processo. A base foi importada
          recentemente, então a lista cresce com o tempo. Réu preso tem prioridade constitucional
          (duração razoável da prisão) — confira excesso de prazo.
        </div>
      </div>

      <div className="card op-card" style={{ marginBottom: 16 }}>
        <div className="card-h"><h3><Icon name="list" /> Filtros</h3></div>
        <div className="card-b">
          <div className="chips" style={{ marginBottom: 0 }}>
            {FAIXAS.map((f) => (
              <Link key={f} href={`/alertas?dias=${f}`} className={`chip${f === dias ? " on" : ""}`}>
                sem mov. ≥ {f} dias
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card op-card">
        <div className="card-h">
          <h3><Icon name="clock" /> Processos sem movimentação ({parados.length}{presosParados > 0 && <span className="sub"> · {presosParados} com réu preso</span>})</h3>
        </div>
        <div className="card-b flush">
          {parados.length ? (
            <table>
              <thead>
                <tr><th className="center">Parado</th><th>Processo</th><th>Cliente(s)</th><th>Área</th><th>Resp.</th><th>Últ. mov.</th></tr>
              </thead>
              <tbody>
                {parados.map((p) => (
                  <tr key={p.processo_id}>
                    <td className="center"><Pill tone={p.dias_parado >= 90 ? "red" : p.dias_parado >= 60 ? "amber" : "gray"}>{p.dias_parado}d</Pill></td>
                    <td><ProcRef cnj={p.numero_cnj} registro={p.numero_registro_tribunal} /> <SegredoTag on={p.segredo_justica} /><div className="sub">{[p.tribunal, p.vara_comarca].filter(Boolean).join(" · ") || "—"}</div></td>
                    <td>{p.clientes || "—"}{p.tem_preso && <div className="sub" style={{ color: "var(--red)" }}>réu preso</div>}</td>
                    <td>{humano(p.area)}</td>
                    <td>{p.responsavel ?? "—"}</td>
                    <td className="mono">{fmtDate(p.ultima_movimentacao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum processo parado há ≥{dias} dias. 🎉</div>
          )}
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-h"><h3><Icon name="users" /> Réus presos ({presos.length})</h3></div>
        <div className="card-b flush">
          {presos.length ? (
            <table>
              <thead>
                <tr><th>Cliente</th><th>Situação</th><th className="center">Processos</th><th className="center">Prazos abertos</th><th className="center">Audiências</th></tr>
              </thead>
              <tbody>
                {presos.map((c) => (
                  <tr key={c.cliente_id}>
                    <td className="name">{c.nome}</td>
                    <td><Pill tone="red">{SIT[c.situacao_prisional] ?? humano(c.situacao_prisional)}</Pill></td>
                    <td className="center mono">{c.processos_ativos}/{c.total_processos}</td>
                    <td className="center mono">{c.prazos_abertos || "—"}</td>
                    <td className="center mono">{c.audiencias_futuras || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum cliente preso no momento.</div>
          )}
        </div>
      </div>
    </>
  );
}

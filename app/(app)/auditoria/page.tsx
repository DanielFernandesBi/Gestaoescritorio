import { getAuditoria } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Pill } from "@/components/ui";
import { fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";

const opTone = (op: string) =>
  op === "INSERT" ? "green" : op === "UPDATE" ? "blue" : "red";

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditoriaPage() {
  const { eventos, total } = await getAuditoria();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Log imutável · prova</div>
          <h1>Auditoria</h1>
          <p>
            {fmtNum(total)} eventos registrados. Relatório de agente não é prova; a
            auditoria é.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3><Icon name="shield" /> Últimas 24h (vw_relatorio_diario)</h3>
        </div>
        <div className="card-b flush">
          {eventos.length ? (
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Tabela</th>
                  <th>Operação</th>
                  <th>Referência</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e, i) => (
                  <tr key={i}>
                    <td className="mono">{quando(e.ocorrido_em)}</td>
                    <td><Pill tone="gray" dot={false}>{e.tabela}</Pill></td>
                    <td><Pill tone={opTone(e.operacao)} dot={false}>{e.operacao}</Pill></td>
                    <td className="sub">{e.referencia ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum evento nas últimas 24h.</div>
          )}
        </div>
      </div>
    </>
  );
}

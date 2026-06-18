import { getAudiencias } from "@/lib/data";
import { Pill, SegredoTag, Gate, ProcRef } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { RowLink } from "@/components/RowLink";
import { Acao } from "@/components/Acao";
import { linkPara } from "@/lib/links";
import { validarAudiencia, cancelarAudiencia } from "@/app/actions";
import { fmtDate, fmtTime, humano } from "@/lib/format";

export const dynamic = "force-dynamic";

const modTone = (m: string | null) =>
  m === "presencial" ? "gray" : m === "videoconferencia" ? "blue" : "amber";

export default async function AudienciasPage() {
  const audiencias = await getAudiencias();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Designações</div>
          <h1>Audiências</h1>
          <p>Instrução, custódia, júri e sessões de julgamento — presencial, vídeo ou híbrida.</p>
        </div>
      </div>

      <div className="card op-card">
        <div className="card-h">
          <h3><Icon name="gavel" /> Audiências</h3>
          <span className="sub">{audiencias.length} designações</span>
        </div>
        <div className="card-b flush">
          {audiencias.length ? (
            <table>
              <thead>
                <tr>
                  <th>Data / hora</th>
                  <th>Tipo</th>
                  <th>Processo</th>
                  <th>Modalidade</th>
                  <th>Local / link</th>
                  <th>Resp.</th>
                  <th className="center">Estado</th>
                  <th className="center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {audiencias.map((a) => (
                  <RowLink key={a.id} href={linkPara("audiencia", a.id)} ariaLabel={`Abrir audiência de ${humano(a.tipo)}`}>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {fmtDate(a.data_hora)}
                      <div className="sub mono">{fmtTime(a.data_hora)}</div>
                    </td>
                    <td><Pill tone="brass" dot={false}>{humano(a.tipo)}</Pill></td>
                    <td>
                      <ProcRef cnj={a.numero_cnj} />
                      {a.segredo && <div className="sub"><SegredoTag on /></div>}
                    </td>
                    <td><Pill tone={modTone(a.modalidade)} dot={false}>{humano(a.modalidade)}</Pill></td>
                    <td className="sub">{a.local_link ?? "—"}</td>
                    <td>{a.responsavel ?? "—"}</td>
                    <td className="center"><Gate validado={a.validado} /></td>
                    <td className="center">
                      <div className="acoes" style={{ justifyContent: "center" }}>
                        {!a.validado && (
                          <Acao
                            label="Validar"
                            variant="primary"
                            titulo="Validar audiência"
                            confirmarLabel="Validar"
                            resumo={<>Confirmar a audiência de <b>{humano(a.tipo)}</b> e criar o evento no Google Calendar?</>}
                            acao={validarAudiencia.bind(null, a.id)}
                          />
                        )}
                        {a.status === "designada" && (
                          <Acao
                            label="Cancelar"
                            variant="danger"
                            titulo="Cancelar audiência"
                            confirmarLabel="Cancelar"
                            resumo={<>Cancelar a audiência? Não é apagada — muda para <b>cancelada</b> (auditado).</>}
                            campoTexto={{ label: "Motivo (opcional)", placeholder: "Ex.: redesignada." }}
                            acao={cancelarAudiencia.bind(null, a.id)}
                          />
                        )}
                      </div>
                    </td>
                  </RowLink>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma audiência designada.</div>
          )}
        </div>
      </div>
    </>
  );
}

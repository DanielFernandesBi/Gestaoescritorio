import { getAudiencias } from "@/lib/data";
import { Pill, SegredoTag, Gate, ProcRef } from "@/components/ui";
import { DrawerRow } from "@/components/DrawerRow";
import { Acao } from "@/components/Acao";
import { validarAudiencia } from "@/app/actions";
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

      <div className="card">
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
                  <DrawerRow
                    key={a.id}
                    title={
                      <>
                        <h2>{humano(a.tipo)}</h2>
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Pill tone={modTone(a.modalidade)}>{humano(a.modalidade)}</Pill>
                          <SegredoTag on={a.segredo} />
                          <Gate validado={a.validado} />
                        </div>
                      </>
                    }
                    body={
                      <>
                        <div className="dsec">
                          <h4>Sessão</h4>
                          <div className="dgrid">
                            <div className="field"><div className="k">Data</div><div className="v mono">{fmtDate(a.data_hora)}</div></div>
                            <div className="field"><div className="k">Hora</div><div className="v mono">{fmtTime(a.data_hora)}</div></div>
                            <div className="field"><div className="k">Modalidade</div><div className="v">{humano(a.modalidade)}</div></div>
                            <div className="field"><div className="k">Responsável</div><div className="v">{a.responsavel ?? "—"}</div></div>
                          </div>
                        </div>
                        <div className="dsec">
                          <h4>Local / link</h4>
                          <div className="field"><div className="v">{a.local_link ?? "—"}</div></div>
                        </div>
                        <div className="dsec">
                          <h4>Processo</h4>
                          <div className="mini">
                            <div>
                              <div className="mt"><ProcRef cnj={a.numero_cnj} /></div>
                              <div className="ms">{a.segredo ? "— (sigiloso)" : a.clientes || "—"}</div>
                            </div>
                          </div>
                        </div>
                      </>
                    }
                  >
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
                    </td>
                  </DrawerRow>
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

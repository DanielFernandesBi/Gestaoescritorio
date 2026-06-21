"use client";

import { useMemo, useState } from "react";
import { Pill, SegredoTag, Gate, ProcRef } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { RowLink } from "@/components/RowLink";
import { Acao } from "@/components/Acao";
import { Chips } from "@/components/Chips";
import { FiltrosCard } from "@/components/FiltrosCard";
import { linkPara } from "@/lib/links";
import { validarAudiencia, baixarAudiencia, cancelarAudiencia } from "@/app/actions";
import { fmtDate, fmtTime, humano } from "@/lib/format";
import type { Audiencia } from "@/lib/data";

const modTone = (m: string | null) =>
  m === "presencial" ? "gray" : m === "videoconferencia" ? "blue" : m === "virtual" ? "violet" : "amber";

const statusTone = (s: string) =>
  s === "realizada" ? "green" : s === "cancelada" ? "red" : s === "redesignada" ? "gray" : "brass";

const FILTROS = [
  { id: "designada", label: "Ativas" },
  { id: "realizada", label: "Realizadas" },
  { id: "redesignada", label: "Redesignadas" },
  { id: "cancelada", label: "Canceladas" },
  { id: "todas", label: "Todas" },
];

export function AudienciasList({ audiencias }: { audiencias: Audiencia[] }) {
  // Visão padrão: apenas as ativas (status='designada'). Sugestão 41.
  const [f, setF] = useState("designada");

  const filtradas = useMemo(
    () => audiencias.filter((a) => (f === "todas" ? true : a.status === f)),
    [audiencias, f],
  );

  const nAtivas = audiencias.filter((a) => a.status === "designada").length;
  const opcoes = FILTROS.map((o) =>
    o.id === "designada"
      ? { ...o, label: `Ativas (${nAtivas})` }
      : o.id === "todas"
        ? { ...o, label: `Todas (${audiencias.length})` }
        : o,
  );

  return (
    <>
      <FiltrosCard>
        <Chips options={opcoes} value={f} onChange={setF} />
      </FiltrosCard>

      <div className="card op-card">
        <div className="card-h">
          <h3><Icon name="gavel" /> Audiências</h3>
          <span className="sub">{filtradas.length} no filtro</span>
        </div>
        <div className="card-b flush">
          {filtradas.length ? (
            <table>
              <thead>
                <tr>
                  <th>Data / hora</th>
                  <th>Tipo</th>
                  <th>Processo / cliente</th>
                  <th>Modalidade</th>
                  <th>Local / link</th>
                  <th>Resp.</th>
                  <th className="center">Estado</th>
                  <th className="center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((a) => (
                  <RowLink key={a.id} href={linkPara("audiencia", a.id)} ariaLabel={`Abrir audiência de ${humano(a.tipo)}`}>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {fmtDate(a.data_hora)}
                      <div className="sub mono">{fmtTime(a.data_hora)}</div>
                    </td>
                    <td><Pill tone="brass" dot={false}>{humano(a.tipo)}</Pill></td>
                    <td>
                      <div style={{ whiteSpace: "nowrap" }}>
                        <ProcRef cnj={a.numero_cnj} registro={a.numero_registro} />
                      </div>
                      <div className="sub">
                        {a.clientes || "Sem cliente identificado"}
                        {a.segredo && <> · <SegredoTag on /></>}
                      </div>
                    </td>
                    <td><Pill tone={modTone(a.modalidade)} dot={false}>{humano(a.modalidade)}</Pill></td>
                    <td className="sub">{a.local_link ?? "—"}</td>
                    <td>{a.responsavel ?? "—"}</td>
                    <td className="center">
                      {a.status === "designada"
                        ? <Gate validado={a.validado} />
                        : <Pill tone={statusTone(a.status)} dot={false}>{humano(a.status)}</Pill>}
                    </td>
                    <td className="center">
                      <div className="acoes" style={{ justifyContent: "center" }}>
                        {!a.validado && a.status === "designada" && (
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
                          <>
                            <Acao
                              label="Realizada"
                              variant="ok"
                              titulo="Dar baixa na audiência"
                              confirmarLabel="Marcar realizada"
                              resumo={<>Marcar a audiência de <b>{humano(a.tipo)}</b> como <b>realizada</b>? O evento no Calendar é baixado (grafite + ✅), nunca apagado.</>}
                              acao={() => baixarAudiencia(a.id)}
                            />
                            <Acao
                              label="Cancelar"
                              variant="danger"
                              titulo="Cancelar audiência"
                              confirmarLabel="Cancelar"
                              resumo={<>Cancelar a audiência? Não é apagada — muda para <b>cancelada</b> (auditado) e o evento do Calendar é encerrado.</>}
                              campoTexto={{ label: "Motivo (opcional)", placeholder: "Ex.: redesignada." }}
                              acao={cancelarAudiencia.bind(null, a.id)}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </RowLink>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma audiência neste filtro.</div>
          )}
        </div>
      </div>
    </>
  );
}

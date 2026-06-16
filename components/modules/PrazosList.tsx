"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { DiasBox, ProcRef, SegredoTag, Gate } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { Acao } from "@/components/Acao";
import { FormModal } from "@/components/FormModal";
import { validarPrazo, baixarPrazo, cancelarPrazo, atualizarPrazo } from "@/app/actions";
import { TIPO_CONTAGEM, RESPONSAVEIS } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import type { Prazo } from "@/lib/data";

function corpo(p: Prazo) {
  return (
    <>
      <div className="dsec">
        <h4>Contagem</h4>
        <div className="dgrid">
          <div className="field">
            <div className="k">Data fatal</div>
            <div className="v mono" style={{ color: "var(--red)" }}>{fmtDate(p.data_fatal)}</div>
          </div>
          <div className="field">
            <div className="k">Data interna</div>
            <div className="v mono">{fmtDate(p.data_interna)}</div>
          </div>
          <div className="field">
            <div className="k">Tipo de contagem</div>
            <div className="v">{humano(p.tipo_contagem)} (CPP art. 798)</div>
          </div>
          <div className="field">
            <div className="k">Responsável</div>
            <div className="v">{p.responsavel ?? "—"}</div>
          </div>
        </div>
      </div>
      <div className="dsec">
        <h4>Processo</h4>
        <div className="mini">
          <div>
            <div className="mt">
              <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} />
            </div>
            <div className="ms">{[p.tribunal, p.vara_comarca].filter(Boolean).join(" · ") || "—"}</div>
            <div className="ms">{p.clientes || "—"}</div>
          </div>
        </div>
      </div>
      <div className="dsec">
        <h4>Atenção</h4>
        <div className="banner" style={{ margin: 0 }}>
          <span className="ico"><Icon name="shield" /></span>
          <div>
            Prazo penal em <b>dias corridos</b>. Conferir feriado local e
            suspensão de expediente no tribunal antes de confiar na data fatal.
          </div>
        </div>
      </div>

      <div className="dsec">
        <h4>Ações</h4>
        <div className="acoes">
          <FormModal label="Editar prazo" titulo="Editar prazo" acao={atualizarPrazo.bind(null, p.id)} enviarLabel="Salvar" variant="default">
            <div><label>Ato</label><input name="ato" required defaultValue={p.ato} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Data fatal</label><input type="date" name="data_fatal" required defaultValue={p.data_fatal?.slice(0, 10)} /></div>
              <div><label>Data interna</label><input type="date" name="data_interna" defaultValue={p.data_interna?.slice(0, 10) ?? ""} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Contagem</label><select name="tipo_contagem" defaultValue={p.tipo_contagem ?? "corridos"}>{TIPO_CONTAGEM.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
          </FormModal>
          {!p.validado && !p.orfao && (
            <Acao
              label="Validar"
              variant="primary"
              titulo="Validar prazo"
              confirmarLabel="Validar"
              resumo={<>Marcar <b>{p.ato}</b> como validado e criar o marcador fatal (vermelho) no Google Calendar?</>}
              acao={() => validarPrazo(p.id)}
            />
          )}
          {p.orfao && (
            <span className="sub" style={{ color: "var(--amber)" }}>
              ⚠ Prazo órfão (sem processo). Use a aba <b>Órfãos / triagem</b> para promover antes de validar.
            </span>
          )}
          <Acao
            label="Dar baixa (cumprido)"
            variant="ok"
            titulo="Dar baixa no prazo"
            confirmarLabel="Dar baixa"
            resumo={<>Marcar <b>{p.ato}</b> como <b>cumprido</b> (data de hoje) e registrar um andamento no processo?</>}
            campoTexto={{ label: "Andamento (opcional)", placeholder: "Ex.: Protocolada a petição de razões de apelação.", multiline: true }}
            acao={(t) => baixarPrazo(p.id, t)}
          />
          <Acao
            label="Cancelar prazo"
            variant="danger"
            titulo="Cancelar prazo"
            confirmarLabel="Cancelar prazo"
            resumo={<>Cancelar <b>{p.ato}</b>? O registro não é apagado — muda para status <b>cancelado</b> (auditado).</>}
            campoTexto={{ label: "Motivo", placeholder: "Ex.: prazo duplicado / intimação revista.", obrigatorio: true }}
            acao={(t) => cancelarPrazo(p.id, t)}
          />
        </div>
      </div>
    </>
  );
}

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "crit", label: "Críticos (≤2d)" },
  { id: "semana", label: "Esta semana" },
  { id: "Daniel", label: "Daniel" },
  { id: "Rodolfo", label: "Rodolfo" },
];

export function PrazosList({ prazos }: { prazos: Prazo[] }) {
  const { open } = useDrawer();
  const [f, setF] = useState("todos");

  const filtrados = useMemo(() => {
    return prazos.filter((p) => {
      if (f === "crit") return p.dias_restantes <= 2;
      if (f === "semana") return p.dias_restantes >= 0 && p.dias_restantes <= 7;
      if (f === "Daniel" || f === "Rodolfo") return p.responsavel === f;
      return true;
    });
  }, [prazos, f]);

  const opcoes = FILTROS.map((o) =>
    o.id === "todos" ? { ...o, label: `Todos (${prazos.length})` } : o,
  );

  return (
    <>
      <Chips options={opcoes} value={f} onChange={setF} />
      <div className="card">
        <div className="card-b flush">
          {filtrados.length ? (
            <table>
              <thead>
                <tr>
                  <th>Prazo</th>
                  <th>Ato</th>
                  <th>Processo / cliente</th>
                  <th>Resp.</th>
                  <th>Interna</th>
                  <th>Fatal</th>
                  <th className="center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={p.id}
                    className="clickable"
                    onClick={() =>
                      open({
                        title: (
                          <>
                            <h2>{p.ato}</h2>
                            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <DiasBox dias={p.dias_restantes} />
                              <SegredoTag on={p.segredo} />
                              <Gate validado={p.validado} />
                            </div>
                          </>
                        ),
                        body: corpo(p),
                      })
                    }
                  >
                    <td style={{ width: 64 }}><DiasBox dias={p.dias_restantes} /></td>
                    <td>
                      <div className="name">{p.ato}</div>
                      <div className="sub">
                        {humano(p.tipo_contagem)} · {p.segredo ? <SegredoTag on /> : p.vara_comarca}
                      </div>
                    </td>
                    <td>
                      <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} />
                      <div className="sub">{p.clientes || "—"}</div>
                    </td>
                    <td>{p.responsavel ?? "—"}</td>
                    <td className="mono">{fmtDate(p.data_interna)}</td>
                    <td className="mono" style={{ color: "var(--red)", fontWeight: 600 }}>{fmtDate(p.data_fatal)}</td>
                    <td className="center"><Gate validado={p.validado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum prazo neste filtro.</div>
          )}
        </div>
      </div>
    </>
  );
}

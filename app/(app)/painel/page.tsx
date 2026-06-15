import { getPainelData } from "@/lib/queries";
import { getFinanceiro, getProcessosParados } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Pill } from "@/components/ui";
import { PrazoRow } from "@/components/PrazoRow";
import { fmtBRL, fmtDate, fmtNum } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const [{ stats, prazos, validacao, orfas, agenda }, fin, parados] = await Promise.all([
    getPainelData(),
    getFinanceiro(),
    getProcessosParados(30),
  ]);
  const atrasadas = fin.parcelas.filter((p) => p.status === "atrasado");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Bom dia</div>
          <h1>Painel do dia</h1>
          <p>Conferência cruzada com a auditoria · prioridades, validações e agenda.</p>
        </div>
        <Link className="btn primary" href="/validacao">
          <Icon name="check" size={15} /> Revisar validações ({stats.pendentes_validacao})
        </Link>
      </div>

      <div className="banner">
        <span className="ico">
          <Icon name="shield" />
        </span>
        <div>
          <b>Relatório conferido contra a auditoria.</b> {fmtNum(stats.auditoria_total)}{" "}
          eventos registrados · {stats.processos_auto} processos e {stats.clientes_auto}{" "}
          clientes em cadastro automático aguardam revisão. Feriados locais e
          suspensões de expediente devem ser conferidos por Daniel.
        </div>
      </div>

      <div className="kpis">
        <div className="kpi red">
          <div className="accent" />
          <div className="label">
            <Icon name="clock" size={14} /> Prazos abertos
          </div>
          <div className="val">{stats.prazos_abertos}</div>
          <div className="meta">
            {prazos[0]
              ? <>próximo fatal em <b style={{ color: "var(--red)" }}>{prazos[0].dias_restantes} dias</b></>
              : "sem prazos abertos"}
          </div>
        </div>

        <div className="kpi amber">
          <div className="accent" />
          <div className="label">
            <Icon name="inbox" size={14} /> Intimações pendentes
          </div>
          <div className="val">
            {stats.intimacoes_pendentes} <small>· {stats.intimacoes_orfas} órfãs</small>
          </div>
          <div className="meta">triagem humana pendente</div>
        </div>

        <div className="kpi blue">
          <div className="accent" />
          <div className="label">
            <Icon name="folder" size={14} /> Processos ativos
          </div>
          <div className="val">{fmtNum(stats.processos_ativos)}</div>
          <div className="meta">
            {stats.processos_sem_cnj} sem CNJ · {stats.processos_sigilosos} sigilosos
          </div>
        </div>

        <div className="kpi green">
          <div className="accent" />
          <div className="label">
            <Icon name="wallet" size={14} /> A receber
          </div>
          <div className="val" style={{ fontSize: 24 }}>
            {fmtBRL(stats.valor_a_receber)}
          </div>
          <div className="meta">{stats.parcelas_pendentes} parcelas em aberto</div>
        </div>
      </div>

      <div className="two-col section-gap">
        <div className="card">
          <div className="card-h">
            <h3>
              <Icon name="clock" /> Prazos mais próximos
            </h3>
            <Link className="link" href="/prazos">
              ver todos
            </Link>
          </div>
          <div className="card-b flush">
            {prazos.length ? (
              <table>
                <tbody>
                  {prazos.slice(0, 5).map((p) => (
                    <PrazoRow key={p.prazo_id} p={p} />
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">Nenhum prazo aberto.</div>
            )}
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <div className="card-h">
              <h3>
                <Icon name="check" /> Aguardando validação
              </h3>
              <Link className="link" href="/validacao">
                abrir
              </Link>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {validacao.length ? (
                validacao.map((v) => (
                  <div className="mini" key={v.id}>
                    <div>
                      <div className="mt">{v.descricao}</div>
                      <div className="ms">
                        {v.numero_cnj ?? "sem CNJ"} · {fmtDate(v.data_relevante)}
                      </div>
                    </div>
                    <Pill tone={v.tipo?.toLowerCase().includes("audi") ? "blue" : "amber"}>
                      {v.tipo?.toLowerCase()}
                    </Pill>
                  </div>
                ))
              ) : (
                <div className="empty">Nada aguardando validação.</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>
                <Icon name="inbox" /> Intimações órfãs
              </h3>
              <Link className="link" href="/intimacoes">
                triagem
              </Link>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {orfas.length ? (
                orfas.map((i) => (
                  <div className="mini" key={i.id}>
                    <div>
                      <div className="mt">{i.resumo ?? i.teor_inicio ?? "—"}</div>
                      <div className="ms">
                        {(i.origem ?? "").toUpperCase()} · {fmtDate(i.criado_em)}
                      </div>
                    </div>
                    <Pill tone="gray" dot={false}>
                      sem processo
                    </Pill>
                  </div>
                ))
              ) : (
                <div className="empty">Nenhuma intimação órfã. 🎉</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-h">
          <h3>
            <Icon name="grid" /> Agenda dos próximos 7 dias
          </h3>
        </div>
        <div className="card-b flush">
          {agenda.length ? (
            <table>
              <tbody>
                {agenda.map((e, idx) => (
                  <tr key={idx}>
                    <td style={{ width: 120 }} className="mono">
                      {fmtDate(e.data)}
                    </td>
                    <td>
                      <Pill tone={e.tipo?.toUpperCase().includes("AUDI") ? "blue" : "amber"}>
                        {e.tipo === "PRAZO" ? "Prazo" : e.tipo === "AUDIÊNCIA" ? "Audiência" : e.tipo} · {e.descricao}
                      </Pill>
                    </td>
                    <td className="right sub">{e.numero_cnj ?? e.responsavel ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Agenda vazia para os próximos 7 dias.</div>
          )}
        </div>
      </div>

      <div className="two-col section-gap">
        <div className="card">
          <div className="card-h">
            <h3><Icon name="wallet" /> Cobranças atrasadas</h3>
            <Link className="link" href="/financeiro">financeiro</Link>
          </div>
          <div className="card-b flush">
            {atrasadas.length ? (
              <table>
                <tbody>
                  {atrasadas.slice(0, 6).map((p) => (
                    <tr key={p.id}>
                      <td className="name">{p.cliente}</td>
                      <td className="right money">{fmtBRL(p.valor)}</td>
                      <td className="right sub" style={{ color: "var(--red)" }}>{p.dias_atraso}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">Nenhuma parcela atrasada. 🎉</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3><Icon name="shield" /> Radar — processos parados (≥30d)</h3>
            <Link className="link" href="/alertas">ver alertas</Link>
          </div>
          <div className="card-b flush">
            {parados.length ? (
              <table>
                <tbody>
                  {parados.slice(0, 6).map((p) => (
                    <tr key={p.processo_id}>
                      <td className="mono">{p.numero_cnj ?? p.numero_registro_tribunal ?? "—"}</td>
                      <td className="sub">{p.clientes ?? "—"}{p.tem_preso && <span style={{ color: "var(--red)" }}> · preso</span>}</td>
                      <td className="right"><Pill tone={p.dias_parado >= 90 ? "red" : "amber"}>{p.dias_parado}d</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">Nenhum processo parado há ≥30 dias. 🎉</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

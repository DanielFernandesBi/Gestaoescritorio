import { getPainelData, getUltimaVarredura, getUserEmail } from "@/lib/queries";
import { getFinanceiro, getProcessosParados, getPrazosOrfaos, getPecas } from "@/lib/data";
import { socioDoEmail } from "@/lib/allowlist";
import { Icon } from "@/components/Icon";
import { Pill, ProcRef, SegredoTag } from "@/components/ui";
import { PrazoRow } from "@/components/PrazoRow";
import { fmtBRL, fmtDate, fmtTime, fmtNum, humano } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const [{ stats, prazos, validacao, orfas, agenda, movimentacoes, relatorio24h, cadastrosAuto, tarefasVencidas }, fin, parados, prazosOrfaos, varredura, pecas, email] = await Promise.all([
    getPainelData(),
    getFinanceiro(),
    getProcessosParados(30),
    getPrazosOrfaos(),
    getUltimaVarredura(),
    getPecas(),
    getUserEmail(),
  ]);
  const atrasadas = fin.parcelas.filter((p) => p.status === "atrasado");
  const socio = socioDoEmail(email);
  const pecasMinhas = socio ? pecas.filter((p) => p.responsavel === socio).length : 0;

  // Resumo do backlog de peças (vw_pecas_pendentes já exclui protocolada/cancelada/prejudicada).
  const pecasPorStatus = pecas.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const pecasUrgentes = pecas.filter((p) => p.prioridade === "urgente").length;
  const pecasAtrasadas = pecas.filter((p) => p.dias_restantes != null && p.dias_restantes < 0).length;
  const proximaPeca = pecas
    .map((p) => p.data_efetiva)
    .filter((d): d is string => Boolean(d))
    .sort()[0] ?? null;
  const PECA_COLS: { key: string; label: string }[] = [
    { key: "a_fazer", label: "A fazer" },
    { key: "em_elaboracao", label: "Em elaboração" },
    { key: "em_revisao", label: "Em revisão" },
    { key: "aguardando_insumo", label: "Aguardando insumo" },
    { key: "pronta", label: "Pronta" },
  ];
  const statusTone = (s: string): "green" | "amber" | "red" =>
    s === "concluida" ? "green" : s === "parcial" ? "amber" : "red";

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

      <div className="card section-gap">
        <div className="card-h">
          <h3>
            <Icon name="shield" /> Cobertura da última varredura
          </h3>
          {varredura && <Pill tone={statusTone(varredura.status)}>{varredura.status}</Pill>}
        </div>
        <div className="card-b">
          {!varredura ? (
            <div className="empty">Nenhuma varredura registrada ainda.</div>
          ) : (
            <>
              <div className="ms" style={{ marginBottom: 10, color: "var(--muted)" }}>
                Rodou em {fmtDate(varredura.criado_em)} {fmtTime(varredura.criado_em)} · referência{" "}
                {fmtDate(varredura.data_referencia)} · fonte {varredura.fonte.toUpperCase()}
              </div>
              <div className="ms" style={{ marginBottom: 12 }}>
                processados <b>{fmtNum(varredura.itens_processados)}</b> · intimações novas{" "}
                <b>{fmtNum(varredura.intimacoes_novas)}</b> · andamentos novos{" "}
                <b>{fmtNum(varredura.andamentos_novos)}</b> · prazos criados{" "}
                <b>{fmtNum(varredura.prazos_criados)}</b>
              </div>
              {varredura.diagnostico_oab && varredura.diagnostico_oab.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {varredura.diagnostico_oab.map((d) => (
                    <div className="mini" key={d.oab}>
                      <div>
                        <div className="mt mono">{d.oab}</div>
                        <div className="ms">
                          acervo {fmtNum(d.acervo_total)} · {fmtNum(d.itens_janela)} na janela
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  DJEN sem diagnóstico nesta execução (degradação) — ver anomalias.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="kpis">
        <Link className="kpi red" href="/prazos">
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
        </Link>

        <Link className="kpi amber" href="/intimacoes">
          <div className="accent" />
          <div className="label">
            <Icon name="inbox" size={14} /> Intimações pendentes
          </div>
          <div className="val">
            {stats.intimacoes_pendentes} <small>· {stats.intimacoes_orfas} órfãs</small>
          </div>
          <div className="meta">triagem humana pendente</div>
        </Link>

        <Link className="kpi blue" href="/processos">
          <div className="accent" />
          <div className="label">
            <Icon name="folder" size={14} /> Processos ativos
          </div>
          <div className="val">{fmtNum(stats.processos_ativos)}</div>
          <div className="meta">
            {stats.processos_sem_cnj} sem CNJ · {stats.processos_sigilosos} sigilosos
          </div>
        </Link>

        <Link className="kpi green" href="/financeiro">
          <div className="accent" />
          <div className="label">
            <Icon name="wallet" size={14} /> A receber
          </div>
          <div className="val" style={{ fontSize: 24 }}>
            {fmtBRL(stats.valor_a_receber)}
          </div>
          <div className="meta">{stats.parcelas_pendentes} parcelas em aberto</div>
        </Link>
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

          <div className="card">
            <div className="card-h">
              <h3>
                <Icon name="clock" /> Prazos órfãos — triagem
                {prazosOrfaos.length > 0 && <span className="badge alert" style={{ marginLeft: 8 }}>{prazosOrfaos.length}</span>}
              </h3>
              <Link className="link" href="/prazos">triagem</Link>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {prazosOrfaos.length ? (
                prazosOrfaos.slice(0, 5).map((p) => (
                  <div className="mini" key={p.prazo_id}>
                    <div>
                      <div className="mt">{p.ato}</div>
                      <div className="ms">fatal {fmtDate(p.data_fatal)} · sem processo</div>
                    </div>
                    <Pill tone={p.dias_restantes <= 2 ? "red" : p.dias_restantes <= 7 ? "amber" : "gray"}>
                      {p.dias_restantes}d
                    </Pill>
                  </div>
                ))
              ) : (
                <div className="empty">Nenhuma fatal sem processo. 🎉</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>
                <Icon name="book" /> Peças pendentes
                {pecasAtrasadas > 0 && <span className="badge alert" style={{ marginLeft: 8 }}>{pecasAtrasadas} atrasadas</span>}
              </h3>
              <Link className="link" href="/producao">produção</Link>
            </div>
            <div className="card-b">
              {pecas.length ? (
                <>
                  <div className="ms" style={{ marginBottom: 10 }}>
                    <b>{pecas.length}</b> no backlog{socio && <> · <b>{pecasMinhas}</b> minhas</>} ·{" "}
                    <b style={{ color: "var(--red)" }}>{pecasUrgentes}</b> urgentes ·{" "}
                    <b style={{ color: "var(--red)" }}>{pecasAtrasadas}</b> atrasadas
                    {proximaPeca && <> · próxima {fmtDate(proximaPeca)}</>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {PECA_COLS.filter((c) => pecasPorStatus[c.key]).map((c) => (
                      <Pill key={c.key} tone="gray" dot={false}>
                        {c.label}: {pecasPorStatus[c.key]}
                      </Pill>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty">Nenhuma peça pendente. 🎉</div>
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
            <h3><Icon name="activity" /> Movimentações recentes (7 dias)</h3>
            <Link className="link" href="/andamentos">ver todas</Link>
          </div>
          <div className="card-b flush">
            {movimentacoes.length ? (
              <table>
                <tbody>
                  {movimentacoes.map((m) => (
                    <tr key={m.id}>
                      <td style={{ width: 96 }} className="mono">{fmtDate(m.data)}</td>
                      <td>
                        <div className="name">{humano(m.tipo)}</div>
                        <div className="sub">{m.segredo ? <SegredoTag on /> : (m.clientes ?? "—")}</div>
                      </td>
                      <td className="right">
                        <ProcRef cnj={m.numero_cnj} registro={m.numero_registro} />
                        <div className="sub">{(m.origem ?? "").toUpperCase()}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">Nenhuma movimentação nos últimos 7 dias.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3><Icon name="inbox" /> Órfãs a triar</h3>
          </div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <Link className="mini" href="/intimacoes" style={{ textDecoration: "none", color: "inherit" }}>
              <div>
                <div className="mt">Intimações órfãs</div>
                <div className="ms">sem processo identificado — promover na triagem</div>
              </div>
              <Pill tone={stats.intimacoes_orfas ? "amber" : "gray"}>{stats.intimacoes_orfas}</Pill>
            </Link>
            <Link className="mini" href="/andamentos" style={{ textDecoration: "none", color: "inherit" }}>
              <div>
                <div className="mt">Andamentos órfãos</div>
                <div className="ms">aba “Órfãos / triagem” — assistente Promover</div>
              </div>
              <Pill tone={stats.andamentos_orfaos ? "amber" : "gray"}>{stats.andamentos_orfaos}</Pill>
            </Link>
            {stats.intimacoes_orfas === 0 && stats.andamentos_orfaos === 0 && (
              <div className="empty">Nada a triar. Tudo vinculado a um processo. 🎉</div>
            )}
          </div>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-h">
          <h3><Icon name="shield" /> Gravado nas últimas 24h</h3>
          <Link className="link" href="/auditoria">auditoria</Link>
        </div>
        <div className="card-b flush">
          {relatorio24h.length ? (
            <table>
              <tbody>
                {relatorio24h.map((e, i) => (
                  <tr key={i}>
                    <td style={{ width: 140 }} className="mono">{fmtDate(e.ocorrido_em)} {fmtTime(e.ocorrido_em)}</td>
                    <td>
                      <Pill tone="gray" dot={false}>{humano(e.tabela)}</Pill>{" "}
                      <span className="sub">{e.operacao}</span>
                    </td>
                    <td className="right sub">{e.referencia ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nada gravado nas últimas 24h.</div>
          )}
        </div>
      </div>

      <div className="two-col section-gap">
        <div className="card">
          <div className="card-h">
            <h3><Icon name="users" /> Cadastros automáticos de hoje — revisar</h3>
          </div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {cadastrosAuto.length ? (
              cadastrosAuto.map((c) => (
                <Link
                  key={`${c.tipo}-${c.id}`}
                  className="mini"
                  href={c.tipo === "processo" ? "/processos" : "/clientes"}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div>
                    <div className="mt">{c.label}</div>
                    <div className="ms">{c.tipo} · {fmtDate(c.criado_em)}</div>
                  </div>
                  <Pill tone="amber" dot={false}>revisar</Pill>
                </Link>
              ))
            ) : (
              <div className="empty">Nenhum cadastro automático hoje.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3><Icon name="list" /> Tarefas vencidas</h3>
            <Link className="link" href="/tarefas">tarefas</Link>
          </div>
          <div className="card-b flush">
            {tarefasVencidas.length ? (
              <table>
                <tbody>
                  {tarefasVencidas.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="name">{t.titulo}</div>
                        <div className="sub">{t.responsavel ?? "—"}</div>
                      </td>
                      <td className="right">
                        <div className="mono" style={{ color: "var(--red)" }}>{fmtDate(t.data_limite)}</div>
                        <div className="sub" style={{ color: "var(--red)" }}>{Math.abs(t.dias)}d em atraso</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">Nenhuma tarefa vencida. 🎉</div>
            )}
          </div>
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

      <div className="card section-gap">
        <div className="card-h">
          <h3>
            <Icon name="shield" /> Anomalias
          </h3>
          {varredura && varredura.status !== "concluida" && (
            <Pill tone={statusTone(varredura.status)}>{varredura.status}</Pill>
          )}
        </div>
        <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {!varredura ? (
            <div className="empty">Nenhuma varredura registrada ainda.</div>
          ) : varredura.anomalias && varredura.anomalias.length ? (
            varredura.anomalias.map((a, idx) => (
              <div className="mini" key={idx}>
                <div>
                  <div
                    className="mt"
                    style={varredura.status !== "concluida" ? { color: "var(--red)" } : undefined}
                  >
                    {a.fonte.toUpperCase()} · {a.tipo}
                  </div>
                  <div className="ms">{a.detalhe}</div>
                </div>
              </div>
            ))
          ) : varredura.status === "concluida" ? (
            <div className="empty">Sem anomalias nesta varredura. 🎉</div>
          ) : (
            <div className="empty">Sem anomalias listadas nesta execução.</div>
          )}
        </div>
      </div>
    </>
  );
}

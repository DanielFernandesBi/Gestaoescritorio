import { getPainelData, getUltimaVarredura, getUserEmail, getConferenciasEscaladas, getBeneficiosProximos } from "@/lib/queries";
import { getAudiencias, getPecas } from "@/lib/data";
import { socioDoEmail } from "@/lib/allowlist";
import { Icon } from "@/components/Icon";
import { Pill, ProcRef, SegredoTag, DiasBox } from "@/components/ui";
import { VerMais } from "@/components/VerMais";
import { AnomaliaRow } from "@/components/AnomaliaRow";
import { fmtBRL, fmtDate, fmtTime, fmtNum, humano, diasAte } from "@/lib/format";
import { linkPara } from "@/lib/links";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusTone = (s: string): "green" | "amber" | "red" =>
  s === "concluida" ? "green" : s === "parcial" ? "amber" : "red";

// Caixinha de data (dia + mês) para audiências, com tom por proximidade.
function diaMes(iso: string) {
  const d = new Date(iso);
  return {
    dia: d.getDate(),
    mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
  };
}
function audTone(dias: number): "crit" | "warn" | "ok" {
  return dias <= 2 ? "crit" : dias <= 7 ? "warn" : "ok";
}
const dl = (n: number) => `${n} ${Math.abs(n) === 1 ? "dia" : "dias"}`;

// Colunas do mini-board de produção (subset do kanban; vw_pecas_pendentes já
// exclui protocoladas/canceladas/prejudicadas).
const PROD_COLS: { key: string; label: string }[] = [
  { key: "a_fazer", label: "A fazer" },
  { key: "em_elaboracao", label: "Em elaboração" },
  { key: "em_revisao", label: "Em revisão" },
  { key: "aguardando_insumo", label: "Aguardando insumo" },
];

export default async function PainelPage() {
  const [
    { stats, prazos, movimentacoes, validacao },
    varredura,
    audiencias,
    email,
    pecas,
    conferencias,
    beneficios,
  ] = await Promise.all([
    getPainelData(),
    getUltimaVarredura(),
    getAudiencias(),
    getUserEmail(),
    getPecas(),
    getConferenciasEscaladas(),
    getBeneficiosProximos(),
  ]);

  const nome = socioDoEmail(email);

  const horaSP = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );
  const saudacao = horaSP < 12 ? "Bom dia" : horaSP < 18 ? "Boa tarde" : "Boa noite";

  const agora = Date.now();
  const audProximas = audiencias
    .filter((a) => new Date(a.data_hora).getTime() >= agora - 12 * 3600 * 1000)
    .slice(0, 4);

  // Produção: minutas em revisão para o KPI, a varredura e o "onde focar".
  const minutasRevisar = pecas.filter((p) => p.status === "em_revisao").length;

  // Fontes que a última varredura cobriu (derivado de varredura.fonte).
  const fonteDJEN = varredura ? ["djen", "ambas"].includes(varredura.fonte) : false;
  const fontePush = varredura ? ["push", "ambas"].includes(varredura.fonte) : false;

  // "Onde focar agora" — derivação determinística dos sinais reais (sem LLM):
  // o fatal mais próximo, a conferência mais urgente e as minutas a revisar.
  const focos: { titulo: string; sub: string; href: string; tag: string; tone: "crit" | "warn" | "ok" }[] = [];
  const fatal = prazos[0];
  if (fatal) {
    focos.push({
      titulo: fatal.ato,
      sub: `${fatal.clientes ?? "—"}${fatal.numero_cnj ? ` · ${fatal.numero_cnj}` : ""}`,
      href: linkPara("prazo", fatal.prazo_id),
      tag: `fatal em ${dl(fatal.dias_restantes)}`,
      tone: audTone(fatal.dias_restantes),
    });
  }
  const confTop = conferencias.find((c) => c.prioridade === "urgente") ?? conferencias[0];
  if (confTop) {
    focos.push({
      titulo: confTop.titulo,
      sub: confTop.segredo ? "🔒 segredo de justiça" : confTop.cliente ?? "conferência escalada",
      href: linkPara("tarefa", confTop.id),
      tag: confTop.prioridade ?? "conferência",
      tone: confTop.prioridade === "urgente" ? "crit" : "warn",
    });
  }
  if (minutasRevisar > 0) {
    focos.push({
      titulo: `Revisar ${minutasRevisar} ${minutasRevisar === 1 ? "minuta" : "minutas"} da produção`,
      sub: "peças em revisão · produção",
      href: "/producao",
      tag: "em revisão",
      tone: "ok",
    });
  }

  // Resumo do dia — frase determinística montada das contagens reais (sem LLM).
  const resumoPartes: string[] = [];
  if (stats.prazos_abertos)
    resumoPartes.push(
      `${stats.prazos_abertos} ${stats.prazos_abertos === 1 ? "prazo aberto" : "prazos abertos"}${fatal ? `, fatal mais próximo em ${dl(fatal.dias_restantes)}` : ""}`,
    );
  if (stats.pendentes_validacao) resumoPartes.push(`${stats.pendentes_validacao} a validar`);
  if (stats.conferencias_pendentes)
    resumoPartes.push(`${stats.conferencias_pendentes} ${stats.conferencias_pendentes === 1 ? "conferência" : "conferências"}`);
  if (minutasRevisar) resumoPartes.push(`${minutasRevisar} ${minutasRevisar === 1 ? "minuta a revisar" : "minutas a revisar"}`);
  const resumoTexto = resumoPartes.length
    ? resumoPartes.join(" · ").replace(/^./, (c) => c.toUpperCase()) + "."
    : "Sem pendências para hoje. 🎉";

  return (
    <div className="painel-page">
      <div className="painel-head">
        <div>
          <div className="eyebrow">Ritual matinal · {fmtDate(new Date().toISOString())}</div>
          <h1>{saudacao}{nome ? `, ${nome}` : ""}.</h1>
          <p>
            {varredura && <>Última varredura concluída às <b>{fmtTime(varredura.criado_em)}</b> · </>}
            {stats.pendentes_validacao} validações e {stats.intimacoes_orfas} intimações órfãs aguardam você.
          </p>
        </div>
        <Link className="btn primary" href="/validacao">
          <Icon name="check" size={15} /> Revisar validações ({stats.pendentes_validacao})
        </Link>
      </div>

      {/* LEITURA DO DIA — hero: resumo determinístico (sem LLM) + onde focar */}
      <div className="focus">
        <div className="focus-glow" />
        <div className="focus-h">
          <span className="lhs"><Icon name="activity" size={16} /> Leitura do dia</span>
          <span className="focus-sub">derivado dos dados de hoje · não é texto gerado por IA</span>
        </div>
        <p className="focus-resumo">{resumoTexto}</p>
        <div className="focus-sub2">Onde focar agora</div>
        {focos.length ? (
          <ol className="focus-list">
            {focos.map((f, i) => (
              <Link className="focus-item" key={i} href={f.href}>
                <span className="focus-n">{i + 1}</span>
                <div className="focus-main">
                  <div className="focus-t">{f.titulo}</div>
                  <div className="focus-s">{f.sub}</div>
                </div>
                <span className={`focus-tag ${f.tone}`}>{f.tag}</span>
              </Link>
            ))}
          </ol>
        ) : (
          <div className="empty">Nada urgente agora. 🎉</div>
        )}
      </div>

      {/* VARREDURA AUTÔNOMA — fontes → extração → métricas + OAB + anomalias */}
      <div className="scan">
        <div className="scan-h">
          <h3><Icon name="shield" /> Varredura autônoma</h3>
          {varredura && <Pill tone={statusTone(varredura.status)}>{varredura.status}</Pill>}
        </div>
        {!varredura ? (
          <div className="empty">Nenhuma varredura registrada ainda.</div>
        ) : (
          <>
            <div className="scan-sub">
              Rodou em {fmtDate(varredura.criado_em)} {fmtTime(varredura.criado_em)} · referência{" "}
              {fmtDate(varredura.data_referencia)} · fonte {varredura.fonte.toUpperCase()}
            </div>
            <div className="scan-flow">
              <div className="flow-src">
                <span className={`fonte ${fonteDJEN ? "on" : "off"}`}><span className="dot" /> DJEN / CNJ</span>
                <span className={`fonte ${fontePush ? "on" : "off"}`}><span className="dot" /> Push e-mail</span>
                <span className={`fonte ${fontePush ? "on" : "off"}`} title="Conferência cruzada por conteúdo — roda na perna push, não é porta de ingestão">
                  <span className="dot" /> Recorte Digital <em>· conferência cruzada</em>
                </span>
              </div>
              <div className="flow-mid">
                <span className="flow-seal">Cowork · Claude</span>
                <div className="flow-mid-t">Extração &amp; cruzamento</div>
                <div className="flow-mid-s">CNJ · partes · prazo · fundamento · providência</div>
                <div className="flow-mid-n">{fmtNum(varredura.itens_processados)} itens lidos</div>
              </div>
              <div className="flow-metrics">
                <Link className="metric metric-link" href="/varredura/intimacoes"><b>{fmtNum(varredura.intimacoes_novas)}</b><span>intimações</span></Link>
                <Link className="metric metric-link" href="/varredura/andamentos"><b>{fmtNum(varredura.andamentos_novos)}</b><span>andamentos</span></Link>
                <Link className="metric metric-link" href="/varredura/prazos"><b>{fmtNum(varredura.prazos_criados)}</b><span>prazos</span></Link>
                <Link className="metric metric-link" href="/producao"><b>{fmtNum(minutasRevisar)}</b><span>minutas</span></Link>
              </div>
            </div>
            <div className="scan-foot">
              <div className="scan-block">
                <div className="scan-block-h">Cobertura por OAB</div>
                {varredura.diagnostico_oab && varredura.diagnostico_oab.length > 0 ? (
                  <div className="scan-grid">
                    {varredura.diagnostico_oab.map((d) => (
                      <div className="oab" key={d.oab}>
                        <div className="lbl">{d.oab}</div>
                        <div className="metrics">
                          <div className="metric"><b>{fmtNum(d.acervo_total)}</b><span>no acervo</span></div>
                          <div className="metric"><b>{fmtNum(d.itens_janela)}</b><span>na janela</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty sm">Sem diagnóstico por OAB.</div>
                )}
              </div>
              <div className="scan-block">
                <div className="scan-block-h">Anomalias</div>
                {varredura.anomalias && varredura.anomalias.length ? (
                  <div className="anom-list">
                    {varredura.anomalias.map((a, idx) => (
                      <AnomaliaRow key={idx} a={a} critico={varredura.status !== "concluida"} />
                    ))}
                  </div>
                ) : (
                  <div className="empty sm">Sem anomalias. 🎉</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* KPIs — panorama do acervo e financeiro */}
      <div className="kpis kpis-6">
        <Link className="kpi red" href="/prazos">
          <div className="accent" />
          <div className="label"><Icon name="clock" size={14} /> Prazos abertos</div>
          <div className="val">{stats.prazos_abertos}</div>
          <div className="meta">
            {prazos[0]
              ? <>próximo fatal em <b style={{ color: "var(--red)" }}>{dl(prazos[0].dias_restantes)}</b></>
              : "sem prazos abertos"}
          </div>
        </Link>

        <Link className="kpi amber" href="/validacao">
          <div className="accent" />
          <div className="label"><Icon name="check" size={14} /> A validar <span className="ai-dot" title="alimentado pela automação" /></div>
          <div className="val">{stats.pendentes_validacao}</div>
          <div className="meta">prazos + audiências</div>
        </Link>

        <Link className={`kpi ${stats.conferencias_pendentes > 0 ? "amber" : ""}`} href="/tarefas">
          <div className="accent" />
          <div className="label"><Icon name="list" size={14} /> Conferências <span className="ai-dot" title="alimentado pela automação" /></div>
          <div className="val">{stats.conferencias_pendentes}</div>
          <div className="meta">tarefas automáticas do Cowork</div>
        </Link>

        <Link className={`kpi ${minutasRevisar > 0 ? "amber" : ""}`} href="/producao">
          <div className="accent" />
          <div className="label"><Icon name="book" size={14} /> Peças em produção <span className="ai-dot" title="alimentado pela automação" /></div>
          <div className="val">{pecas.length}</div>
          <div className="meta">
            {minutasRevisar > 0 ? <><b style={{ color: "var(--amber)" }}>{minutasRevisar}</b> minuta{minutasRevisar === 1 ? "" : "s"} a revisar</> : "nenhuma minuta a revisar"}
          </div>
        </Link>

        <Link className="kpi blue" href="/processos">
          <div className="accent" />
          <div className="label"><Icon name="folder" size={14} /> Processos ativos</div>
          <div className="val">{fmtNum(stats.processos_ativos)}</div>
          <div className="meta">{stats.processos_sem_cnj} sem CNJ · {stats.processos_sigilosos} sigilosos</div>
        </Link>

        <Link className="kpi green" href="/financeiro">
          <div className="accent" />
          <div className="label"><Icon name="wallet" size={14} /> A receber</div>
          <div className="val" style={{ fontSize: 24 }}>{fmtBRL(stats.valor_a_receber)}</div>
          <div className="meta">{stats.parcelas_pendentes} parcelas em aberto</div>
        </Link>
      </div>

      {/* Prazos fatais + Aguardando validação */}
      <div className="two-eq">
        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="clock" /> Prazos fatais</span>
            <Link className="link" href="/prazos">ver todos →</Link>
          </h3>
          {prazos.length ? (
            prazos.slice(0, 4).map((p) => (
              <Link className="deadline" key={p.prazo_id} href={linkPara("prazo", p.prazo_id)}>
                <DiasBox dias={p.dias_restantes} />
                <div className="dl-main">
                  <div className="dl-t">{p.ato}</div>
                  <div className="dl-s">
                    {p.clientes ?? "—"}
                    {p.numero_cnj && <> · <span className="cnj">{p.numero_cnj}</span></>}
                  </div>
                </div>
                <div className="dl-r mono">
                  {fmtDate(p.data_fatal)}
                  <div className="dl-s">interna {fmtDate(p.data_interna)}</div>
                </div>
              </Link>
            ))
          ) : (
            <div className="empty">Nenhum prazo aberto.</div>
          )}
        </div>

        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="check" /> Aguardando validação</span>
            <Link className="link" href="/validacao">revisar todos →</Link>
          </h3>
          {validacao.length ? (
            <VerMais max={5}>
              {validacao.map((v) => (
                <Link className="deadline" key={`${v.tipo}-${v.id}`} href="/validacao">
                  <div className="dl-main">
                    <div className="dl-t">{v.descricao}</div>
                    <div className="dl-s">
                      {humano(v.tipo)}
                      {v.numero_cnj && <> · <span className="cnj">{v.numero_cnj}</span></>}
                    </div>
                  </div>
                  <div className="dl-r">
                    <Pill tone="amber" dot={false}>provisório</Pill>
                    {v.data_relevante && <div className="dl-s mono" style={{ marginTop: 4 }}>{fmtDate(v.data_relevante)}</div>}
                  </div>
                </Link>
              ))}
            </VerMais>
          ) : (
            <div className="empty">Fila de validação vazia. 🎉</div>
          )}
        </div>
      </div>

      {/* Conferências escaladas + Audiências próximas */}
      <div className="two-eq">
        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="shield" /> Conferências escaladas</span>
            <Link className="link" href="/tarefas">tarefas →</Link>
          </h3>
          {conferencias.length ? (
            <VerMais max={5}>
              {conferencias.map((c) => (
                <Link className="deadline" key={c.id} href={linkPara("tarefa", c.id)}>
                  <div className="dl-main">
                    <div className="dl-t">{c.titulo}</div>
                    <div className="dl-s">
                      {c.segredo ? <SegredoTag on /> : (c.cliente ?? "—")}
                      {c.numero_cnj && !c.segredo && <> · <span className="cnj">{c.numero_cnj}</span></>}
                    </div>
                  </div>
                  <Pill tone={c.prioridade === "urgente" ? "red" : c.prioridade === "alta" ? "amber" : "gray"} dot={false}>
                    {(c.prioridade ?? "—").toUpperCase()}
                  </Pill>
                </Link>
              ))}
            </VerMais>
          ) : (
            <div className="empty">Nenhuma conferência escalada. 🎉</div>
          )}
        </div>

        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="gavel" /> Audiências próximas</span>
            <Link className="link" href="/audiencias">agenda →</Link>
          </h3>
          {audProximas.length ? (
            audProximas.map((a) => {
              const { dia, mes } = diaMes(a.data_hora);
              return (
                <Link className="deadline" key={a.id} href={linkPara("audiencia", a.id)}>
                  <span className={`ddays ${audTone(diasAte(a.data_hora))}`}>
                    <b>{dia}</b>
                    <span>{mes}</span>
                  </span>
                  <div className="dl-main">
                    <div className="dl-t">{a.segredo ? "Audiência (sigilo)" : humano(a.tipo)}</div>
                    <div className="dl-s">
                      {fmtTime(a.data_hora)} · {humano(a.modalidade)}
                      {a.local_link ? ` · ${a.local_link}` : ""}
                    </div>
                  </div>
                  <span className={`gate ${a.validado ? "done" : "wait"}`}>
                    {a.validado ? "✓ validado" : "a validar"}
                  </span>
                </Link>
              );
            })
          ) : (
            <div className="empty">Nenhuma audiência próxima.</div>
          )}
        </div>
      </div>

      {/* PRODUÇÃO DE PEÇAS — mini-board do kanban (vw_pecas_pendentes) */}
      <div className="card">
        <div className="card-h">
          <h3><Icon name="book" /> Produção de peças</h3>
          <Link className="link" href="/producao">abrir fila →</Link>
        </div>
        {pecas.length ? (
          <div className="prod-board">
            {PROD_COLS.map((col) => {
              const itens = pecas.filter((p) => p.status === col.key);
              return (
                <div className="prod-col" key={col.key}>
                  <div className="prod-col-h">
                    <span>{col.label}</span>
                    <span className="ct">{itens.length}</span>
                  </div>
                  {itens.length ? (
                    itens.slice(0, 4).map((p) => (
                      <Link
                        className="prod-item"
                        key={p.id}
                        href={p.processo_id ? linkPara("processo", p.processo_id) : "/producao"}
                      >
                        <div className="pi-t">{p.titulo}</div>
                        <div className="pi-s">
                          {p.segredo ? "🔒 sigilo" : p.cliente ?? "—"}
                        </div>
                        <div className="pi-tags">
                          {col.key === "aguardando_insumo" && p.gate_pendencia ? (
                            <span className="pi-tag warn">{p.gate_pendencia}</span>
                          ) : col.key === "em_revisao" && p.cadastro_automatico ? (
                            <span className="pi-tag ai">minuta IA · revisar</span>
                          ) : p.cadastro_automatico ? (
                            <span className="pi-tag ai">IA · triagem</span>
                          ) : null}
                          {p.dias_restantes != null && (
                            <span className={`pi-tag ${p.dias_restantes <= 2 ? "crit" : p.dias_restantes <= 7 ? "warn" : ""}`}>
                              {p.dias_restantes < 0 ? `${Math.abs(p.dias_restantes)}d em atraso` : `fatal em ${dl(p.dias_restantes)}`}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="prod-empty">—</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">Nenhuma peça em produção.</div>
        )}
      </div>

      {/* Movimentações recentes + Benefícios próximos · execução */}
      <div className="two-eq">
        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="activity" /> Movimentações recentes</span>
            <Link className="link" href="/andamentos">ver todas →</Link>
          </h3>
          {movimentacoes.length ? (
            <VerMais max={6}>
              {movimentacoes.map((m) => (
                <div className="deadline" key={m.id}>
                  <div className="dl-main">
                    <div className="dl-t">{humano(m.tipo)}</div>
                    <div className="dl-s">{m.segredo ? <SegredoTag on /> : (m.clientes ?? "—")}</div>
                  </div>
                  <div className="dl-r">
                    <ProcRef cnj={m.numero_cnj} registro={m.numero_registro} id={m.processo_id} />
                    <div className="dl-s">{(m.origem ?? "").toUpperCase()} · {fmtDate(m.data)}</div>
                  </div>
                </div>
              ))}
            </VerMais>
          ) : (
            <div className="empty">Nenhuma movimentação nos últimos 7 dias.</div>
          )}
        </div>

        <div className="hcard">
          <h3>
            <span className="lhs"><Icon name="users" /> Benefícios próximos · execução</span>
            <Link className="link" href="/clientes">clientes →</Link>
          </h3>
          {beneficios.length ? (
            <VerMais max={6}>
              {beneficios.map((b) => (
                <Link className="deadline" key={b.cliente_id} href={linkPara("cliente", b.cliente_id)}>
                  <div className="dl-main">
                    <div className="dl-t">{b.segredo ? <SegredoTag on /> : b.nome}</div>
                    <div className="dl-s">
                      {b.tipo === "progressao" ? "progressão de regime" : "livramento condicional"}
                      {b.regime_atual ? ` · ${humano(b.regime_atual)}` : ""}
                    </div>
                  </div>
                  <div className="dl-r">
                    <Pill tone={b.dias < 0 ? "red" : b.dias <= 30 ? "amber" : "blue"} dot={false}>
                      {b.dias < 0 ? `${Math.abs(b.dias)}d vencido` : `${b.dias}d`}
                    </Pill>
                    {b.data_prevista && <div className="dl-s mono" style={{ marginTop: 4 }}>{fmtDate(b.data_prevista)}</div>}
                  </div>
                </Link>
              ))}
            </VerMais>
          ) : (
            <div className="empty">Nenhum benefício de execução próximo.</div>
          )}
        </div>
      </div>
    </div>
  );
}

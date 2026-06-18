import { getPainelData, getUltimaVarredura, getUserEmail } from "@/lib/queries";
import { getFinanceiro, getProcessosParados, getAudiencias } from "@/lib/data";
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

export default async function PainelPage() {
  const [
    { stats, prazos, agenda, movimentacoes, cadastrosAuto, tarefasVencidas },
    fin,
    parados,
    varredura,
    audiencias,
    email,
  ] = await Promise.all([
    getPainelData(),
    getFinanceiro(),
    getProcessosParados(30),
    getUltimaVarredura(),
    getAudiencias(),
    getUserEmail(),
  ]);

  const atrasadas = fin.parcelas.filter((p) => p.status === "atrasado");
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

  return (
    <>
      <div className="painel-head">
        <div>
          <div className="eyebrow">Ritual matinal</div>
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

      {/* HERO: prazos fatais + audiências próximas */}
      <div className="hoje">
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

      {/* COBERTURA DA ÚLTIMA VARREDURA */}
      <div className="scan">
        <div className="scan-h">
          <h3><Icon name="shield" /> Cobertura da última varredura</h3>
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
            <div className="scan-metrics">
              <div className="metric"><b>{fmtNum(varredura.itens_processados)}</b><span>processados</span></div>
              <div className="metric"><b>{fmtNum(varredura.intimacoes_novas)}</b><span>intimações novas</span></div>
              <div className="metric"><b>{fmtNum(varredura.andamentos_novos)}</b><span>andamentos novos</span></div>
              <div className="metric"><b>{fmtNum(varredura.prazos_criados)}</b><span>prazos criados</span></div>
            </div>
            {varredura.diagnostico_oab && varredura.diagnostico_oab.length > 0 && (
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
            )}
          </>
        )}
      </div>

      {/* KPIs — panorama do acervo e financeiro */}
      <div className="kpis">
        <Link className="kpi red" href="/prazos">
          <div className="accent" />
          <div className="label"><Icon name="clock" size={14} /> Prazos abertos</div>
          <div className="val">{stats.prazos_abertos}</div>
          <div className="meta">
            {prazos[0]
              ? <>próximo fatal em <b style={{ color: "var(--red)" }}>{prazos[0].dias_restantes} dias</b></>
              : "sem prazos abertos"}
          </div>
        </Link>

        <Link className="kpi amber" href="/validacao">
          <div className="accent" />
          <div className="label"><Icon name="check" size={14} /> A validar</div>
          <div className="val">{stats.pendentes_validacao}</div>
          <div className="meta">prazos + audiências</div>
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

      {/* Agenda + movimentações — meia tela cada */}
      <div className="two-eq">
        <div className="card op-card">
          <div className="card-h">
            <h3><Icon name="grid" /> Agenda dos próximos 7 dias</h3>
          </div>
          <div className="op-list">
            {agenda.length ? (
              <VerMais max={6}>
                {agenda.map((e, i) => {
                  const isAudi = e.tipo?.toUpperCase().includes("AUDI");
                  return (
                    <Link
                      className="op-row"
                      key={i}
                      href={isAudi ? linkPara("audiencia", e.ref_id) : linkPara("prazo", e.ref_id)}
                    >
                      <div>
                        <div className="ot">{e.descricao}</div>
                        <div className="os">{e.cliente ?? "—"}{e.responsavel ? ` · ${e.responsavel}` : ""}</div>
                      </div>
                      <div className="dl-r">
                        <Pill tone={isAudi ? "blue" : "amber"} dot={false}>{isAudi ? "Audiência" : "Prazo"}</Pill>
                        <div className="os mono" style={{ marginTop: 4 }}>{fmtDate(e.data)}</div>
                      </div>
                    </Link>
                  );
                })}
              </VerMais>
            ) : (
              <div className="empty">Agenda vazia para os próximos 7 dias.</div>
            )}
          </div>
        </div>

        <div className="card op-card">
          <div className="card-h">
            <h3><Icon name="activity" /> Movimentações recentes (7 dias)</h3>
            <Link className="link" href="/andamentos">ver todas</Link>
          </div>
          <div className="op-list">
            {movimentacoes.length ? (
              <VerMais max={6}>
                {movimentacoes.map((m) => (
                  <div className="op-row" key={m.id}>
                    <div>
                      <div className="ot">{humano(m.tipo)}</div>
                      <div className="os">{m.segredo ? <SegredoTag on /> : (m.clientes ?? "—")}</div>
                    </div>
                    <div className="dl-r">
                      <ProcRef cnj={m.numero_cnj} registro={m.numero_registro} id={m.processo_id} />
                      <div className="os">{(m.origem ?? "").toUpperCase()} · {fmtDate(m.data)}</div>
                    </div>
                  </div>
                ))}
              </VerMais>
            ) : (
              <div className="empty">Nenhuma movimentação nos últimos 7 dias.</div>
            )}
          </div>
        </div>
      </div>

      {/* Operacional — 5 cards de tamanho igual */}
      <div className="cards-row">
        <div className="card op-card">
          <div className="card-h">
            <h3><Icon name="users" /> Cadastros automáticos</h3>
            <Link className="link" href="/auditoria">auditoria</Link>
          </div>
          <div className="op-list">
            {cadastrosAuto.length ? (
              <VerMais max={6}>
                {cadastrosAuto.map((c) => (
                  <Link className="op-row" key={`${c.tipo}-${c.id}`} href={linkPara(c.tipo, c.id)}>
                    <div>
                      <div className="ot">{c.label}</div>
                      <div className="os">{c.tipo} · {fmtDate(c.criado_em)}</div>
                    </div>
                    <Pill tone="amber" dot={false}>revisar</Pill>
                  </Link>
                ))}
              </VerMais>
            ) : (
              <div className="empty">Nenhum cadastro automático hoje.</div>
            )}
          </div>
        </div>

        <div className="card op-card">
          <div className="card-h">
            <h3><Icon name="list" /> Tarefas vencidas</h3>
            <Link className="link" href="/tarefas">tarefas</Link>
          </div>
          <div className="op-list">
            {tarefasVencidas.length ? (
              <VerMais max={6}>
                {tarefasVencidas.map((t) => (
                  <Link className="op-row" key={t.id} href={linkPara("tarefa", t.id)}>
                    <div>
                      <div className="ot">{t.titulo}</div>
                      <div className="os">{t.responsavel ?? "—"}</div>
                    </div>
                    <div className="dl-r">
                      <div className="mono" style={{ color: "var(--red)", fontWeight: 600 }}>{fmtDate(t.data_limite)}</div>
                      <div className="os" style={{ color: "var(--red)" }}>{Math.abs(t.dias)}d atraso</div>
                    </div>
                  </Link>
                ))}
              </VerMais>
            ) : (
              <div className="empty">Nenhuma tarefa vencida. 🎉</div>
            )}
          </div>
        </div>

        <div className="card op-card">
          <div className="card-h">
            <h3><Icon name="wallet" /> Cobranças atrasadas</h3>
            <Link className="link" href="/financeiro">financeiro</Link>
          </div>
          <div className="op-list">
            {atrasadas.length ? (
              <VerMais max={6}>
                {atrasadas.map((p) => (
                  <Link className="op-row" key={p.id} href={p.contrato_id ? linkPara("contrato", p.contrato_id) : "/financeiro"}>
                    <div>
                      <div className="ot">{p.cliente}</div>
                      <div className="os" style={{ color: "var(--red)" }}>parcela {p.numero_parcela} · {p.dias_atraso}d em atraso</div>
                    </div>
                    <div className="money">{fmtBRL(p.valor)}</div>
                  </Link>
                ))}
              </VerMais>
            ) : (
              <div className="empty">Nenhuma parcela atrasada. 🎉</div>
            )}
          </div>
        </div>

        <div className="card op-card">
          <div className="card-h">
            <h3><Icon name="shield" /> Radar — parados ≥30d</h3>
            <Link className="link" href="/alertas">alertas</Link>
          </div>
          <div className="op-list">
            {parados.length ? (
              <VerMais max={6}>
                {parados.map((p) => (
                  <Link className="op-row" key={p.processo_id} href={linkPara("processo", p.processo_id)}>
                    <div>
                      <div className="ot mono">{p.numero_cnj ?? p.numero_registro_tribunal ?? "—"}</div>
                      <div className="os">{p.clientes ?? "—"}{p.tem_preso && <span style={{ color: "var(--red)" }}> · preso</span>}</div>
                    </div>
                    <Pill tone={p.dias_parado >= 90 ? "red" : "amber"}>{p.dias_parado}d</Pill>
                  </Link>
                ))}
              </VerMais>
            ) : (
              <div className="empty">Nenhum processo parado. 🎉</div>
            )}
          </div>
        </div>

        <div className="card op-card">
          <div className="card-h">
            <h3><Icon name="shield" /> Anomalias</h3>
            {varredura && varredura.status !== "concluida" && (
              <Pill tone={statusTone(varredura.status)}>{varredura.status}</Pill>
            )}
          </div>
          <div className="op-list">
            {varredura?.anomalias && varredura.anomalias.length ? (
              <VerMais max={6}>
                {varredura.anomalias.map((a, idx) => (
                  <AnomaliaRow key={idx} a={a} critico={varredura.status !== "concluida"} />
                ))}
              </VerMais>
            ) : (
              <div className="empty">Sem anomalias. 🎉</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Acao } from "@/components/Acao";
import { FormModal } from "@/components/FormModal";
import { BuscaSelect } from "@/components/BuscaSelect";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { marcarPago, criarContrato, criarDespesa, marcarDespesaReembolsada } from "@/app/actions";
import { DESPESA_CATEGORIA } from "@/lib/enums";
import { linkPara } from "@/lib/links";
import { fmtBRL, fmtDate, humano } from "@/lib/format";
import type { Contrato, Parcela, Despesa, Fechamento } from "@/lib/data";

type Cli = { id: string; nome: string };
type FluxoMes = { mes: number; realizado: number; previsto: number };
type ReceitaCliente = { cliente: string; valor: number };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Compacto: R$ 218k · R$ 14,5k · R$ 900 (1 casa quando fracionário e < 100k). */
function kBRL(v: number): string {
  if (v >= 1000) {
    const k = v / 1000;
    return k >= 100 || Number.isInteger(k) ? `R$ ${Math.round(k)}k` : `R$ ${k.toFixed(1).replace(".", ",")}k`;
  }
  return `R$ ${Math.round(v)}`;
}

/** Status efetivo: quitado/rescindido pelo cadastro; inadimplente se há atraso real. */
function statusEff(c: Contrato): "vigente" | "inadimplente" | "quitado" | "rescindido" {
  if (c.status === "quitado") return "quitado";
  if (c.status === "rescindido") return "rescindido";
  if (c.total_atraso > 0) return "inadimplente";
  return "vigente";
}
const stTone = (s: string) => (s === "quitado" ? "blue" : s === "inadimplente" ? "red" : s === "rescindido" ? "slate" : "green");

/**
 * Abas de contrato. "Vigentes" é o contrato VIVO — não quitado e não rescindido —,
 * portanto INCLUI o inadimplente, que também está em vigor. Antes "Vigentes" era
 * sinônimo de "em dia" e escondia os inadimplentes, fazendo a carteira ativa
 * parecer menor do que é (10 aparentes contra 22 reais no acervo de 04/08/2026).
 * "Em dia" é a aba nova e herda aquele filtro antigo, agora com o nome correto.
 */
type FiltroContrato = "vigente" | "inadimplente" | "emdia" | "quitado";
const casaFiltro = (st: string, f: FiltroContrato) =>
  f === "vigente" ? st !== "quitado" && st !== "rescindido"
    : f === "emdia" ? st === "vigente"
      : st === f;
const ROTULO_CONTRATO: Record<FiltroContrato, string> = {
  vigente: "Vigentes",
  inadimplente: "Inadimplentes",
  emdia: "Em dia",
  quitado: "Quitados",
};

/* ── fluxo de caixa (barra empilhada: realizado verde + previsto hachurado) ── */
function FluxoCaixa({ fluxo, ano }: { fluxo: FluxoMes[]; ano: number }) {
  const mesAtual = new Date().getMonth();
  const maxV = Math.max(1, ...fluxo.map((f) => f.previsto));
  const H = 150;
  const realizadoAno = fluxo.reduce((s, f) => s + f.realizado, 0);
  const previstoTotal = fluxo.reduce((s, f) => s + f.previsto, 0);
  const previstoRestante = Math.max(0, previstoTotal - realizadoAno);
  return (
    <article className="fin-card">
      <div className="fin-card-h">
        <span className="t">Fluxo de caixa · {ano}</span>
        <span className="fin-leg">
          <span><i className="sw green" />realizado</span>
          <span><i className="sw prev" />previsto</span>
        </span>
      </div>
      <div className="fin-card-b">
        <div className="fin-fluxo">
          {fluxo.map((f) => {
            const prevH = (f.previsto / maxV) * H;
            const realH = (Math.min(f.realizado, f.previsto) / maxV) * H;
            const pendH = Math.max(0, prevH - realH);
            return (
              <div className="col" key={f.mes} title={`${MESES[f.mes]} · realizado ${fmtBRL(f.realizado)} · previsto ${fmtBRL(f.previsto)}`}>
                <div className="bar" style={{ height: H }}>
                  {pendH > 0 && <div className="prev" style={{ height: pendH }} />}
                  {realH > 0 && <div className="real" style={{ height: realH }} />}
                </div>
                <span className={`m${f.mes === mesAtual ? " on" : ""}`}>{MESES[f.mes]}</span>
              </div>
            );
          })}
        </div>
        <div className="fin-fluxo-foot">
          <span>realizado no ano <b className="green">{kBRL(realizadoAno)}</b></span>
          <span>previsto restante <b>{kBRL(previstoRestante)}</b></span>
          <span className="end">previsto total <b className="ink">{kBRL(previstoTotal)}</b></span>
        </div>
      </div>
    </article>
  );
}

/* ── donut da carteira ──────────────────────────────────────────────────── */
function Donut({ vig, quit, inad, total }: { vig: number; quit: number; inad: number; total: number }) {
  const t = Math.max(1, total);
  const p = (n: number) => (n / t) * 100;
  const a = p(vig), b = p(quit), c = p(inad);
  const g = `conic-gradient(var(--green) 0 ${a}%, var(--blue) ${a}% ${a + b}%, var(--red) ${a + b}% ${a + b + c}%, var(--brass) ${a + b + c}% 100%)`;
  return (
    <div className="fin-donut" style={{ background: g }}>
      <div className="hole"><span>{total}</span></div>
    </div>
  );
}

/* ── tela ────────────────────────────────────────────────────────────────── */
export function FinanceiroView({
  contratos,
  parcelas,
  despesas,
  fechamento,
  fluxo,
  receitaPorCliente,
  clientes,
  mesLabel,
}: {
  contratos: Contrato[];
  parcelas: Parcela[];
  despesas: Despesa[];
  fechamento: Fechamento;
  fluxo: FluxoMes[];
  receitaPorCliente: ReceitaCliente[];
  clientes: Cli[];
  mesLabel: string;
}) {
  const [fContrato, setFContrato] = useState<FiltroContrato>("vigente");
  const [verTodos, setVerTodos] = useState(false);

  // KPIs
  const atrasadas = parcelas.filter((p) => p.status === "atrasado");
  const totalAtraso = atrasadas.reduce((s, p) => s + p.valor, 0);
  const aVencer = parcelas.filter((p) => p.status === "a_vencer").reduce((s, p) => s + p.valor, 0);
  const recebidoAno = fluxo.reduce((s, f) => s + f.realizado, 0);
  const eff = useMemo(() => contratos.map((c) => ({ c, st: statusEff(c) })), [contratos]);
  const carteira = {
    vigente: eff.filter((x) => x.st === "vigente").length,
    inadimplente: eff.filter((x) => x.st === "inadimplente").length,
    quitado: eff.filter((x) => x.st === "quitado").length,
    rescindido: eff.filter((x) => x.st === "rescindido").length,
  };

  // inadimplência
  const carteiraReceber = contratos.reduce((s, c) => s + c.total_aberto, 0);
  const pctInad = carteiraReceber > 0 ? (totalAtraso / carteiraReceber) * 100 : 0;
  const totalPorContrato = new Map(contratos.map((c) => [c.id, c.qtd_parcelas]));
  const inadLista = atrasadas.map((p) => ({
    cliente: p.cliente,
    parc: `${p.numero_parcela}/${p.contrato_id ? totalPorContrato.get(p.contrato_id) ?? "?" : "?"}`,
    dias: p.dias_atraso,
    valor: p.valor,
  }));

  const maxReceita = Math.max(1, ...receitaPorCliente.map((r) => r.valor));

  // Contagem por aba, exibida no próprio chip: é o que impede a leitura errada da
  // carteira — o número fica visível antes de clicar, em vez de depender do filtro.
  const nPorAba = useMemo(() => ({
    vigente: eff.filter((x) => casaFiltro(x.st, "vigente")).length,
    inadimplente: eff.filter((x) => casaFiltro(x.st, "inadimplente")).length,
    emdia: eff.filter((x) => casaFiltro(x.st, "emdia")).length,
    quitado: eff.filter((x) => casaFiltro(x.st, "quitado")).length,
  }), [eff]);

  const contratosFiltrados = eff.filter((x) => casaFiltro(x.st, fContrato));
  const contratosView = verTodos ? contratosFiltrados : contratosFiltrados.slice(0, 4);
  const despesasAbertas = despesas.filter((d) => d.reembolsavel && !d.reembolsada).length;

  return (
    <div className="fin-page">
      {/* cabeçalho heritage + KPIs */}
      <PageHeader
        breadcrumb={["Gestão", "Financeiro"]}
        eyebrow="Honorários · contratos · parcelas · despesas"
        titulo="Financeiro"
        descricao={
          <>
            Fonte da verdade no Supabase (contratos + parcelas + despesas). Rateio do sócio a 50% do recebido.
            Rode <code>fn_marcar_atrasados()</code> antes de fechar o mês.
          </>
        }
        acoes={
          <>
            <FormModal label={<><Icon name="wallet" size={15} /> Nova despesa</>} titulo="Nova despesa" descricao="Custas, diligências, cópias…" acao={criarDespesa} enviarLabel="Lançar" variant="default">
              <div><label>Descrição</label><input name="descricao" required placeholder="Ex.: custas de apelação" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label>Valor (R$)</label><input name="valor" required /></div>
                <div><label>Categoria</label><select name="categoria" defaultValue="custas">{DESPESA_CATEGORIA.map((c) => <option key={c} value={c}>{humano(c)}</option>)}</select></div>
              </div>
              <div><label>Data</label><input type="date" name="data" /></div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" name="reembolsavel" defaultChecked style={{ width: "auto" }} /> Reembolsável pelo cliente
              </label>
              <div><label>Observações</label><textarea name="observacoes" /></div>
            </FormModal>
            <FormModal label={<><Icon name="folder" size={15} /> Novo contrato</>} titulo="Novo contrato" acao={criarContrato} enviarLabel="Criar">
              <div><label>Cliente</label>
                <BuscaSelect name="cliente_id" options={clientes.map((c) => ({ id: c.id, label: c.nome }))} placeholder="Buscar cliente…" />
              </div>
              <div><label>Objeto da contratação</label><textarea name="objeto" required placeholder="Ex.: Defesa criminal; execução penal — progressão…" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label>Valor total (R$)</label><input name="valor_total" required placeholder="30000 ou 30.000,00" /></div>
                <div><label>Data do contrato</label><input type="date" name="data_contrato" /></div>
              </div>
              <div><label>Contratante (se ≠ cliente)</label><input name="contratante" placeholder="Ex.: mãe do réu" /></div>
              <div><label>Forma de pagamento</label><input name="forma_pagamento" placeholder="Entrada + 3x; à vista; quinzenal…" /></div>
              <div><label>Observações</label><textarea name="observacoes" /></div>
            </FormModal>
          </>
        }
        kpis={[
          { valor: kBRL(aVencer), label: "A receber · a vencer", tone: "green" },
          { valor: kBRL(totalAtraso), label: "Em atraso", tone: "red" },
          { valor: kBRL(recebidoAno), label: "Recebido · acumulado", tone: "neutral" },
          { valor: <>{carteira.vigente}<span className="sub"> / {contratos.length}</span></>, label: "Contratos vigentes", tone: "neutral" },
        ]}
      />

      {/* fluxo de caixa */}
      <FluxoCaixa fluxo={fluxo} ano={new Date().getFullYear()} />

      {/* fechamento + carteira */}
      <div className="fin-2col wide">
        <article className="fin-card">
          <div className="fin-card-h"><span className="t">Fechamento de {mesLabel}</span></div>
          <div className="fin-fech">
            <div><div className="k">Recebido no mês</div><div className="v">{kBRL(fechamento.recebido)}</div><div className="s mono">{fechamento.qtdPagas} parcelas pagas</div></div>
            <div><div className="k">Sócio (50%)</div><div className="v">{kBRL(fechamento.socio)}</div><div className="s mono">rateio do recebido</div></div>
            <div><div className="k">A receber no mês</div><div className="v">{kBRL(fechamento.aReceber)}</div><div className="s mono red">{kBRL(fechamento.emAtraso)} em atraso</div></div>
            <div><div className="k">Despesas · líquido sócio</div><div className="v">{kBRL(fechamento.socio - fechamento.despesas / 2)}</div><div className="s mono">despesas {kBRL(fechamento.despesas)}</div></div>
          </div>
        </article>
        <article className="fin-card">
          <div className="fin-card-h"><span className="t">Carteira de contratos</span></div>
          <div className="fin-carteira">
            <Donut vig={carteira.vigente} quit={carteira.quitado} inad={carteira.inadimplente} total={contratos.length} />
            <div className="leg">
              <div><span className="sw green" />Vigentes<b>{carteira.vigente}</b></div>
              <div><span className="sw blue" />Quitados<b>{carteira.quitado}</b></div>
              <div><span className="sw red" />Inadimplentes<b>{carteira.inadimplente}</b></div>
              <div><span className="sw slate" />Rescindidos<b>{carteira.rescindido}</b></div>
            </div>
          </div>
        </article>
      </div>

      {/* receita por cliente + inadimplência */}
      <div className="fin-2col wide">
        <article className="fin-card">
          <div className="fin-card-h"><span className="t">Receita por cliente · top {receitaPorCliente.length}</span></div>
          <div className="fin-receita">
            {receitaPorCliente.length ? receitaPorCliente.map((r) => (
              <div className="row" key={r.cliente}>
                <div className="top"><b>{r.cliente}</b><span className="mono">{kBRL(r.valor)}</span></div>
                <div className="track"><div className="fill" style={{ width: `${Math.max(3, (r.valor / maxReceita) * 100)}%` }} /></div>
              </div>
            )) : <div className="fin-empty">Sem receita recebida registrada.</div>}
          </div>
        </article>
        <article className="fin-card red-card">
          <div className="fin-card-h red"><Icon name="shield" size={14} /><span className="t">Inadimplência</span></div>
          <div className="fin-inad">
            <div className="pct">{pctInad.toFixed(1).replace(".", ",")}%</div>
            <div className="base">da carteira em atraso ({kBRL(totalAtraso)} de {kBRL(carteiraReceber)})</div>
            {inadLista.length ? (
              <div className="lista">
                {inadLista.map((x, i) => (
                  <div className="item" key={i}>
                    <div className="who"><b>{x.cliente}</b><div className="mono sub">parc. {x.parc} · {x.dias} dias</div></div>
                    <span className="val mono">{kBRL(x.valor)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="fin-empty">Sem parcelas em atraso. 🎉</div>}
            {inadLista.length > 0 && <Link className="fin-regua" href="/busca">Preparar régua de cobrança</Link>}
          </div>
        </article>
      </div>

      {/* contratos */}
      <article className="fin-card">
        <div className="fin-card-h">
          <span className="t">Contratos</span>
          <span className="sub mono">{contratos.length} · clique para o objeto</span>
          <span className="fin-tabs">
            {(["vigente", "inadimplente", "emdia", "quitado"] as const).map((s) => (
              <button key={s} type="button" className={`tk-chip${fContrato === s ? " on" : ""}`} onClick={() => { setFContrato(s); setVerTodos(false); }}>
                {ROTULO_CONTRATO[s]} ({nPorAba[s]})
              </button>
            ))}
          </span>
        </div>
        <div className="fin-contratos">
          {contratosView.length ? contratosView.map(({ c, st }) => {
            const pagas = c.parcelas.filter((p) => p.status === "pago").length;
            const pct = st === "quitado" ? 100 : c.qtd_parcelas ? Math.round((pagas / c.qtd_parcelas) * 100) : 0;
            const tone = stTone(st);
            return (
              <Link className="row" key={c.id} href={linkPara("contrato", c.id)}>
                <div className="lhs">
                  <div className="top"><b>{c.cliente}</b><span className={`pill ${tone}`}>{st}</span></div>
                  <div className="obj">{c.objeto}{c.contratante ? <> · <span className="dim">contratante: {c.contratante}</span></> : null}</div>
                </div>
                <div className="prog">
                  <div className="meta mono"><span>{pagas}/{c.qtd_parcelas} parcelas</span><span className={tone === "red" ? "red" : tone === "blue" ? "blue" : ""}>{st === "inadimplente" ? "atraso" : `${pct}%`}</span></div>
                  <div className="track"><div className={`fill ${tone}`} style={{ width: `${pct}%` }} /></div>
                </div>
                <div className="val">
                  <div className="tot mono">{kBRL(c.valor_total)}</div>
                  <div className={`paid mono ${tone}`}>{st === "inadimplente" ? `${kBRL(c.total_atraso)} em atraso` : st === "quitado" ? "quitado" : `${kBRL(c.total_pago)} pagos`}</div>
                </div>
              </Link>
            );
          }) : <div className="fin-empty">Nenhum contrato em “{ROTULO_CONTRATO[fContrato]}”.</div>}
        </div>
        {contratosFiltrados.length > 4 && (
          <button type="button" className="fin-vermais" onClick={() => setVerTodos((v) => !v)}>
            {verTodos ? "ver menos ↑" : `ver os ${contratosFiltrados.length} contratos →`}
          </button>
        )}
      </article>

      {/* parcelas a vencer / atrasadas */}
      <article className="fin-card">
        <div className="fin-card-h"><span className="t">Parcelas a vencer / atrasadas</span><span className="end mono">vw_financeiro_pendente</span></div>
        {parcelas.length ? (
          <table className="fin-table">
            <colgroup><col style={{ width: "25%" }} /><col style={{ width: "27%" }} /><col style={{ width: "10%" }} /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} /><col style={{ width: "12%" }} /></colgroup>
            <thead><tr><th>Cliente</th><th>Objeto</th><th className="c">Parc.</th><th className="r">Valor</th><th>Vencimento</th><th className="c">Ação</th></tr></thead>
            <tbody>
              {parcelas.map((p) => (
                <tr key={p.id}>
                  <td><b className="nm">{p.cliente}</b></td>
                  {/* A observação da parcela explica desdobramento, pagamento parcial e
                      renegociação — sem ela a linha "R$ 3.500" fica sem history. Vai como
                      subtítulo da célula, no mesmo padrão .sub da célula de vencimento,
                      para não quebrar a grade da tabela. */}
                  <td className="obj">{p.objeto ?? "—"}{p.observacoes && <div className="sub">{p.observacoes}</div>}</td>
                  <td className="c mono">{p.numero_parcela}{p.contrato_id && totalPorContrato.has(p.contrato_id) ? `/${totalPorContrato.get(p.contrato_id)}` : ""}</td>
                  <td className="r mono money">{kBRL(p.valor)}</td>
                  <td className="mono">{fmtDate(p.vencimento)}<div className={`sub ${p.status === "atrasado" ? "red" : "amber"}`}>{p.status === "atrasado" ? `${p.dias_atraso} dias` : "a vencer"}</div></td>
                  <td className="c">
                    <Acao label="Marcar paga" variant="ok" size="sm" titulo="Registrar pagamento" confirmarLabel="Marcar paga"
                      resumo={<>Registrar a parcela {p.numero_parcela} de <b>{p.cliente}</b> ({fmtBRL(p.valor)}) como <b>paga</b> hoje?</>}
                      acao={marcarPago.bind(null, p.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="fin-empty">Nenhuma parcela pendente.</div>}
      </article>

      {/* despesas */}
      <article className="fin-card">
        <div className="fin-card-h"><span className="t">Despesas</span>{despesasAbertas > 0 && <span className="sub mono">{despesasAbertas} a reembolsar</span>}</div>
        {despesas.length ? (
          <table className="fin-table">
            <colgroup><col style={{ width: "38%" }} /><col style={{ width: "18%" }} /><col style={{ width: "14%" }} /><col style={{ width: "14%" }} /><col style={{ width: "16%" }} /></colgroup>
            <thead><tr><th>Descrição</th><th>Categoria</th><th className="r">Valor</th><th>Data</th><th className="c">Reembolso</th></tr></thead>
            <tbody>
              {despesas.map((d) => (
                <tr key={d.id}>
                  <td><b className="nm">{d.descricao}</b></td>
                  <td>{humano(d.categoria)}</td>
                  <td className="r mono money">{kBRL(d.valor)}</td>
                  <td className="mono">{fmtDate(d.data)}</td>
                  <td className="c">
                    {!d.reembolsavel ? <span className="fin-tag gray">não reembolsável</span>
                      : d.reembolsada ? <span className="fin-tag green">reembolsada</span>
                        : <Acao label="Reembolsada" variant="default" size="sm" titulo="Marcar reembolsada" confirmarLabel="Confirmar"
                            resumo={<>Marcar <b>{d.descricao}</b> ({fmtBRL(d.valor)}) como reembolsada?</>}
                            acao={marcarDespesaReembolsada.bind(null, d.id)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="fin-empty">Nenhuma despesa lançada. Use “Nova despesa”.</div>}
      </article>
    </div>
  );
}

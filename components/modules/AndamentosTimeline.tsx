"use client";

import Link from "next/link";
import { SegredoTag, ContextoCaso, PartesCliente } from "@/components/ui";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
import { CriarPrazoDeAndamento } from "@/components/modules/CriarPrazoDeAndamento";
import { PromoverIntimacao } from "@/components/modules/PromoverIntimacao";
import { CaixaBtn } from "@/components/CaixaBtn";
import { linkPara } from "@/lib/links";
import { fmtDate, humano } from "@/lib/format";
import type { Movimentacao } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

// Tom da badge de tipo (decisão/sentença vermelho; acórdão verde; recurso/HC azul; resto slate).
function tipoTone(t: string): string {
  if (t.includes("sentenca") || t.includes("decisao") || t.includes("despacho")) return "red";
  if (t.includes("acordao")) return "green";
  if (t.includes("peticao") || t.includes("protocol") || t.includes("recurso") || t.includes("hc")) return "blue";
  return "slate";
}

// Resultado destacado na headline (favorável/adverso) — só apresentação.
const FAV = /\b(provid[ao]|deferid[ao]|concedid[ao]|absolvi)/i;
const ADV = /\b(negad[ao]|indeferid[ao]|improvid[ao]|desprovid[ao]|condena)/i;
function resultado(desc: string): { kw: string; cls: string } | null {
  const f = desc.match(FAV);
  if (f) return { kw: f[0].toUpperCase(), cls: "fav" };
  const a = desc.match(ADV);
  if (a) return { kw: a[0].toUpperCase(), cls: "adv" };
  return null;
}

// Headline curta = primeira oração do texto longo.
function headline(desc: string): string {
  const cut = desc.split(/ — | · |\. |; |\n/)[0].trim();
  return cut.length > 72 ? cut.slice(0, 72).trim() + "…" : cut;
}

/**
 * Conferência ABERTA (pendente/em_andamento) × já resolvida.
 *
 * `escalado` só diz que existe tarefa não-cancelada, e por isso marcava igual a
 * conferência viva e a já fechada. Com 19 escalados na janela e 18 concluídos, o
 * único que ainda cobrava ação ficava indistinguível — é o que esta função separa.
 */
export const conferenciaAberta = (m: Movimentacao) =>
  Boolean(m.escalado) && (m.escalado_status === "pendente" || m.escalado_status === "em_andamento");

// Urgência (cor da barra/banner): urgente=red; alta=amber (verde se resultado favorável); informativo=cinza.
// Conferência já concluída volta a ser informativa — não deve competir por atenção.
function urgencia(m: Movimentacao): "urg" | "alta" | "ok" | "info" {
  if (!conferenciaAberta(m)) return "info";
  if (m.prioridade === "urgente") return "urg";
  return resultado(m.descricao)?.cls === "fav" ? "ok" : "alta";
}
const motivo = (p: string | null | undefined) =>
  p === "urgente" ? "medida que afeta a liberdade/patrimônio"
    : p === "alta" ? "resultado de mérito / decisão / sessão"
      : "conferência humana";

export function AndamentosTimeline({
  movimentacoes,
  mapa = null,
  filtro,
}: {
  movimentacoes: Movimentacao[];
  mapa?: MapaProvidencia | null;
  filtro?: string;
}) {
  if (!movimentacoes.length) return <div className="empty">Nenhuma movimentação neste filtro.</div>;

  // Continuidade do filtro na navegação para o detalhe (barra rápida).
  const q = filtro === "escalados" || filtro === "conferir" ? `?f=${filtro}` : "";
  const hrefDet = (id: string) => `${linkPara("andamento", id)}${q}`;

  return (
    <div className="and-list">
      {movimentacoes.map((m) => {
        const u = urgencia(m);
        const head = headline(m.descricao);
        const res = resultado(m.descricao);
        const temDesc = m.descricao.length > head.length + 16;
        return (
          <article className={`and-card u-${u}`} key={m.id}>
            <span className="and-bar" />
            <div className="and-body">
              <div className="and-top">
                <span className={`and-tipo t-${tipoTone(m.tipo)}`}>{humano(m.tipo)}</span>
                {m.tribunal && <span className="and-trib">{m.tribunal}</span>}
                <span className="and-date mono">{fmtDate(m.data)}</span>
              </div>

              <h3 className="and-h">
                <Link className="and-h-link" href={hrefDet(m.id)}>{head}</Link>
                {res && <span className={`and-kw ${res.cls}`}>{res.kw}</span>}
              </h3>

              <div className="and-cli">
                {m.segredo ? <SegredoTag on /> : m.partes?.length ? <PartesCliente partes={m.partes} /> : <span className="dl-cli">{m.clientes ?? "—"}</span>}
                {m.numero_cnj && <> · <span className="cnj">{m.numero_cnj}</span></>}
              </div>
              <ContextoCaso ctx={m.contexto} />
              {temDesc && <div className="and-desc">{m.descricao}</div>}

              {m.escalado && (conferenciaAberta(m) ? (
                <div className="and-banner">
                  <span className="and-banner-ico">⚠</span>
                  <div>
                    <b>A conferir · {(m.prioridade ?? "alta").toUpperCase()}</b> — {motivo(m.prioridade)}
                    {m.escalado_status === "em_andamento" && <> · <b>em andamento</b></>}
                  </div>
                </div>
              ) : (
                /* Já conferido: o cartão precisa dizer que a pendência FECHOU, em tom
                   calmo, senão volta a competir por atenção com o que ainda cobra ação. */
                <div className="and-banner feito">
                  <span className="and-banner-ico">✓</span>
                  <div><b>Conferência concluída</b> — escalado pela triagem e já resolvido.</div>
                </div>
              ))}

              <div className="and-foot">
                <span className="and-cap"><span className="and-cap-dot" /> capturado pela triagem · origem {(m.origem ?? "—").toUpperCase()}</span>
                <div className="and-acoes">
                  {m.escalado && (
                    <Link
                      className={`btn sm${conferenciaAberta(m) ? " primary" : ""}`}
                      href={m.tarefa_id ? linkPara("tarefa", m.tarefa_id) : "/tarefas"}
                    >
                      {conferenciaAberta(m) ? "Conferir" : "Ver conferência"}
                    </Link>
                  )}
                  <CriarPecaPendente tipoOrigem="andamento" origemId={m.id} texto={m.descricao} mapa={mapa} />
                  {m.processo_id && <PromoverIntimacao andamentoId={m.id} />}
                  {m.processo_id && <CriarPrazoDeAndamento andamentoId={m.id} atoSugerido={head} />}
                  {m.processo_id && <CaixaBtn processoId={m.processo_id} />}
                  {m.processo_id && <Link className="btn sm" href={linkPara("processo", m.processo_id)}>Abrir processo</Link>}
                  <Link className="btn sm abrir" href={hrefDet(m.id)}>Abrir</Link>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

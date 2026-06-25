"use client";

import Link from "next/link";
import { useDrawer } from "@/components/Drawer";
import { ProcRef, SegredoTag, ContextoCaso, PartesCliente } from "@/components/ui";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
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

// Urgência (cor da barra/banner): urgente=red; alta=amber (verde se resultado favorável); informativo=cinza.
function urgencia(m: Movimentacao): "urg" | "alta" | "ok" | "info" {
  if (!m.escalado) return "info";
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
}: {
  movimentacoes: Movimentacao[];
  mapa?: MapaProvidencia | null;
}) {
  const { open } = useDrawer();

  if (!movimentacoes.length) return <div className="empty">Nenhuma movimentação neste filtro.</div>;

  const abrir = (m: Movimentacao) =>
    open({
      title: (
        <>
          <h2>{humano(m.tipo)}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ProcRef cnj={m.numero_cnj} registro={m.numero_registro} />
            <SegredoTag on={m.segredo} />
          </div>
          <ContextoCaso ctx={m.contexto} />
        </>
      ),
      body: (
        <>
          <div className="dsec">
            <h4>Movimentação</h4>
            <div className="field"><div className="v">{m.descricao}</div></div>
          </div>
          <div className="dsec">
            <h4>Dados</h4>
            <div className="dgrid">
              <div className="field"><div className="k">Data</div><div className="v mono">{fmtDate(m.data)}</div></div>
              <div className="field"><div className="k">Origem</div><div className="v">{(m.origem ?? "—").toUpperCase()}</div></div>
              <div className="field"><div className="k">Tribunal</div><div className="v">{m.tribunal ?? "—"}</div></div>
              <div className="field"><div className="k">Autor</div><div className="v">{m.autor ?? "—"}</div></div>
              <div className="field"><div className="k">Cliente</div><div className="v">{m.segredo ? "— (sigiloso)" : m.clientes ?? "—"}</div></div>
            </div>
          </div>
          <div className="dsec">
            <h4>Produção</h4>
            <div className="acoes"><CriarPecaPendente tipoOrigem="andamento" origemId={m.id} texto={m.descricao} mapa={mapa} /></div>
          </div>
        </>
      ),
    });

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
                {head}
                {res && <span className={`and-kw ${res.cls}`}>{res.kw}</span>}
              </h3>

              <div className="and-cli">
                {m.segredo ? <SegredoTag on /> : m.partes?.length ? <PartesCliente partes={m.partes} /> : <span className="dl-cli">{m.clientes ?? "—"}</span>}
                {m.numero_cnj && <> · <span className="cnj">{m.numero_cnj}</span></>}
              </div>
              <ContextoCaso ctx={m.contexto} />
              {temDesc && <div className="and-desc">{m.descricao}</div>}

              {m.escalado && (
                <div className="and-banner">
                  <span className="and-banner-ico">⚠</span>
                  <div>
                    <b>Escalado para conferência · {(m.prioridade ?? "alta").toUpperCase()}</b> — {motivo(m.prioridade)}
                  </div>
                </div>
              )}

              <div className="and-foot">
                <span className="and-cap"><span className="and-cap-dot" /> capturado pela triagem · origem {(m.origem ?? "—").toUpperCase()}</span>
                <div className="and-acoes">
                  {m.escalado && <Link className="btn sm primary" href={m.tarefa_id ? linkPara("tarefa", m.tarefa_id) : "/tarefas"}>Ver conferência</Link>}
                  <CriarPecaPendente tipoOrigem="andamento" origemId={m.id} texto={m.descricao} mapa={mapa} />
                  {m.processo_id && <Link className="btn sm" href={linkPara("processo", m.processo_id)}>Abrir processo</Link>}
                  <button type="button" className="btn sm ghost" onClick={() => abrir(m)}>Abrir</button>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

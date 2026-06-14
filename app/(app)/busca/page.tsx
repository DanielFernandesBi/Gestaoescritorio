import { buscaGlobal } from "@/lib/data";
import { ProcRef, SegredoTag, Pill } from "@/components/ui";
import { DrawerRow } from "@/components/DrawerRow";
import { ProcessoDetalhe } from "@/components/detalhe/ProcessoDetalhe";
import { Icon } from "@/components/Icon";
import { fmtDate, humano } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const termo = q.trim();
  const { clientes, processos, intimacoes } =
    termo.length >= 2
      ? await buscaGlobal(termo)
      : { clientes: [], processos: [], intimacoes: [] };

  const total = clientes.length + processos.length + intimacoes.length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Busca global</div>
          <h1>{termo ? `Resultados para “${termo}”` : "Busca"}</h1>
          <p>
            {termo.length < 2
              ? "Digite ao menos 2 caracteres — cliente, CNJ ou nº de registro."
              : `${total} resultado(s) · clientes, processos e intimações.`}
          </p>
        </div>
      </div>

      {termo.length >= 2 && total === 0 && (
        <div className="card"><div className="empty">Nada encontrado para “{termo}”.</div></div>
      )}

      {clientes.length > 0 && (
        <div className="card section-gap">
          <div className="card-h"><h3><Icon name="users" /> Clientes ({clientes.length})</h3></div>
          <div className="card-b flush">
            <table>
              <thead><tr><th>Cliente</th><th>CPF</th><th>UF</th><th>Situação</th></tr></thead>
              <tbody>
                {clientes.map((c) => (
                  <DrawerRow
                    key={c.id}
                    title={<h2>{c.nome}</h2>}
                    body={
                      <div className="dsec"><h4>Ficha</h4><div className="dgrid">
                        <div className="field"><div className="k">CPF</div><div className="v mono">{c.cpf ?? "—"}</div></div>
                        <div className="field"><div className="k">UF</div><div className="v">{c.uf ?? "—"}</div></div>
                        <div className="field"><div className="k">Situação prisional</div><div className="v">{humano(c.situacao_prisional)}</div></div>
                      </div></div>
                    }
                  >
                    <td className="name">{c.nome}</td>
                    <td className="mono">{c.cpf ?? "—"}</td>
                    <td>{c.uf ?? "—"}</td>
                    <td><Pill tone="gray">{humano(c.situacao_prisional)}</Pill></td>
                  </DrawerRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {processos.length > 0 && (
        <div className="card section-gap">
          <div className="card-h"><h3><Icon name="folder" /> Processos ({processos.length})</h3></div>
          <div className="card-b flush">
            <table>
              <thead><tr><th>Processo</th><th>Tribunal</th><th>Área</th><th>Cliente</th></tr></thead>
              <tbody>
                {processos.map((p) => (
                  <DrawerRow
                    key={p.id}
                    title={
                      <>
                        <h2>{p.segredo ? "Processo em segredo de justiça" : p.clientes || "Processo"}</h2>
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <ProcRef cnj={p.numero_cnj} registro={p.numero_registro} /><SegredoTag on={p.segredo} />
                        </div>
                      </>
                    }
                    body={<ProcessoDetalhe proc={p} />}
                  >
                    <td><ProcRef cnj={p.numero_cnj} registro={p.numero_registro} /></td>
                    <td className="sub">{p.tribunal ?? "—"}</td>
                    <td><Pill tone="gray" dot={false}>{humano(p.area)}</Pill></td>
                    <td>{p.segredo ? <SegredoTag on /> : <span className="name" style={{ fontWeight: 500 }}>{p.clientes || "—"}</span>}</td>
                  </DrawerRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {intimacoes.length > 0 && (
        <div className="card section-gap">
          <div className="card-h"><h3><Icon name="inbox" /> Intimações ({intimacoes.length})</h3></div>
          <div className="card-b flush">
            <table>
              <thead><tr><th>Origem</th><th>Resumo</th><th>Processo</th><th>Publicação</th></tr></thead>
              <tbody>
                {intimacoes.map((i) => (
                  <DrawerRow
                    key={i.id}
                    title={<h2>{i.resumo ?? "Intimação"}</h2>}
                    body={
                      <div className="dsec"><h4>Dados</h4><div className="dgrid">
                        <div className="field"><div className="k">Origem</div><div className="v">{(i.origem ?? "—").toUpperCase()}</div></div>
                        <div className="field"><div className="k">Status</div><div className="v">{humano(i.status)}</div></div>
                        <div className="field"><div className="k">Processo</div><div className="v mono">{i.numero_cnj ?? "—"}</div></div>
                        <div className="field"><div className="k">Publicação</div><div className="v mono">{fmtDate(i.data_publicacao)}</div></div>
                      </div></div>
                    }
                  >
                    <td><Pill tone="gray" dot={false}>{(i.origem ?? "—").toUpperCase()}</Pill></td>
                    <td className="name">{i.resumo ?? "—"}</td>
                    <td>{i.numero_cnj ? <ProcRef cnj={i.numero_cnj} /> : <span className="sub">—</span>}</td>
                    <td className="mono">{fmtDate(i.data_publicacao)}</td>
                  </DrawerRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

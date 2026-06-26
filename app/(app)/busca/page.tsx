import { buscaGlobal } from "@/lib/data";
import { ProcRef, SegredoTag, Pill } from "@/components/ui";
import { LinkRow } from "@/components/LinkRow";
import { FavoritoStar } from "@/components/FavoritoStar";
import { Icon } from "@/components/Icon";
import { fmtDate, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";

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
              <thead><tr><th style={{ width: 34 }}></th><th>Cliente</th><th>CPF</th><th>UF</th><th>Situação</th></tr></thead>
              <tbody>
                {clientes.map((c) => (
                  <LinkRow key={c.id} href={linkPara("cliente", c.id)}>
                    <td className="center"><FavoritoStar id={c.id} favorito={c.favorito} /></td>
                    <td className="name">{c.nome}</td>
                    <td className="mono">{c.cpf ?? "—"}</td>
                    <td>{c.uf ?? "—"}</td>
                    <td><Pill tone="gray">{humano(c.situacao_prisional)}</Pill></td>
                  </LinkRow>
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
                  <LinkRow key={p.id} href={linkPara("processo", p.id)}>
                    <td><ProcRef cnj={p.numero_cnj} registro={p.numero_registro} /></td>
                    <td className="sub">{p.tribunal ?? "—"}</td>
                    <td><Pill tone="gray" dot={false}>{humano(p.area)}</Pill></td>
                    <td>{p.segredo ? <SegredoTag on /> : <span className="name" style={{ fontWeight: 500 }}>{p.clientes || "—"}</span>}</td>
                  </LinkRow>
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
                  <LinkRow key={i.id} href={linkPara("intimacao", i.id)}>
                    <td><Pill tone="gray" dot={false}>{(i.origem ?? "—").toUpperCase()}</Pill></td>
                    <td className="name">{i.resumo ?? "—"}</td>
                    <td>{i.numero_cnj ? <ProcRef cnj={i.numero_cnj} /> : <span className="sub">—</span>}</td>
                    <td className="mono">{fmtDate(i.data_publicacao)}</td>
                  </LinkRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

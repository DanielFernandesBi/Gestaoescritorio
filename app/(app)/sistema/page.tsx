import { getSugestoes, getEstruturaBanco } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Pill } from "@/components/ui";
import { Acao } from "@/components/Acao";
import { atualizarSugestao } from "@/app/actions";
import { fmtNum, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const stTone = (s: string) =>
  s === "executada" ? "green" : s === "aprovada" ? "blue" : s === "rejeitada" ? "red" : "amber";

export default async function SistemaPage() {
  const [sugestoes, estrutura] = await Promise.all([
    getSugestoes(),
    getEstruturaBanco(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Manual vivo · evolução</div>
          <h1>Sistema & evolução</h1>
          <p>
            Necessidade de campo/tabela/view → registrar em <b>sugestoes_sistema</b> com
            SQL. DDL só com autorização expressa, registrada em <b>migracoes</b>.
          </p>
        </div>
      </div>

      <div className="banner">
        <span className="ico"><Icon name="settings" /></span>
        <div>
          <b>Sugestões de evolução do schema</b> registradas no banco. Esta tela é só
          leitura — nada é executado aqui; DDL passa por autorização do Daniel.
        </div>
      </div>

      {sugestoes.map((s) => (
        <div className="suggest" key={s.id}>
          <div className="st">
            {s.id}. {s.contexto}
            <Pill tone={stTone(s.status)}>{s.status}</Pill>
          </div>
          <div className="sc">{s.sugestao}</div>
          {s.sql_proposto && <pre>{s.sql_proposto}</pre>}
          <div className="acoes" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Pendente: decisão completa. Aprovada: ainda dá para executar ou rejeitar.
                Executada / rejeitada: estados terminais — sem botão destrutivo. */}
            {s.status === "pendente" && (
              <Acao label="Aprovar" titulo="Aprovar sugestão"
                resumo={<>Marcar a sugestão #{s.id} como <b>aprovada</b>? (não executa DDL — só registra a decisão)</>}
                acao={atualizarSugestao.bind(null, s.id, "aprovada")} />
            )}
            {(s.status === "pendente" || s.status === "aprovada") && (
              <Acao label="Marcar executada" variant="ok" titulo="Marcar executada"
                resumo={<>Confirmar que a sugestão #{s.id} já foi <b>executada</b> no banco?</>}
                acao={atualizarSugestao.bind(null, s.id, "executada")} />
            )}
            {(s.status === "pendente" || s.status === "aprovada") && (
              <Acao label="Rejeitar" variant="danger" titulo="Rejeitar sugestão"
                resumo={<>Marcar a sugestão #{s.id} como <b>rejeitada</b>?</>}
                acao={atualizarSugestao.bind(null, s.id, "rejeitada")} />
            )}

            {s.status === "executada" && (
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--green)" }}>
                ✓ Implementada{s.decidida_em ? ` em ${fmtDate(s.decidida_em)}` : ""}
              </span>
            )}
            {s.status === "rejeitada" && (
              <>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
                  Rejeitada{s.decidida_em ? ` em ${fmtDate(s.decidida_em)}` : ""}
                </span>
                <Acao label="Reconsiderar" variant="ghost" titulo="Reconsiderar sugestão"
                  resumo={<>Voltar a sugestão #{s.id} para <b>pendente</b>?</>}
                  acao={atualizarSugestao.bind(null, s.id, "pendente")} />
              </>
            )}
          </div>
        </div>
      ))}

      <div className="card section-gap">
        <div className="card-h"><h3>Estrutura do banco</h3></div>
        <div className="card-b flush">
          <table>
            <thead>
              <tr>
                <th>Tabela</th>
                <th className="right">Registros</th>
              </tr>
            </thead>
            <tbody>
              {estrutura.map((t) => (
                <tr key={t.tabela}>
                  <td className="name mono" style={{ fontSize: 12 }}>{t.tabela}</td>
                  <td className="right mono">{fmtNum(t.registros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

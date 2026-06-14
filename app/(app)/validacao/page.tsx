import { getValidacao } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Pill } from "@/components/ui";
import { DrawerRow } from "@/components/DrawerRow";
import { fmtDate, humano } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ValidacaoPage() {
  const itens = await getValidacao();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Gate de validação humana</div>
          <h1>Validação de Daniel</h1>
          <p>
            Todo prazo/audiência de automação nasce <b>validado=false</b>. Ao
            validar, confirma-se a data fatal e gera-se o evento no Google Calendar.
          </p>
        </div>
      </div>

      <div className="banner">
        <span className="ico"><Icon name="check" /></span>
        <div>
          Evento provisório na <b>data_interna</b> (Tangerina) até a validação;
          confirmado vira o marcador <b>vermelho</b> da data fatal. Validar não
          dispensa a conferência de feriado local.
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Fila do dia · {itens.length} {itens.length === 1 ? "item" : "itens"}</h3>
        </div>
        <div className="card-b flush">
          {itens.length ? (
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Ato</th>
                  <th>Processo</th>
                  <th>Data</th>
                  <th>Origem</th>
                  <th className="center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((v) => {
                  const ehAudiencia = v.tipo?.toLowerCase().includes("audi");
                  return (
                    <DrawerRow
                      key={v.id}
                      title={
                        <>
                          <h2>{v.descricao}</h2>
                          <div style={{ marginTop: 8 }}>
                            <span className="gate wait">⏳ aguardando validação</span>
                          </div>
                        </>
                      }
                      body={
                        <div className="dsec">
                          <h4>Item pendente</h4>
                          <div className="dgrid">
                            <div className="field"><div className="k">Tipo</div><div className="v">{humano(v.tipo)}</div></div>
                            <div className="field"><div className="k">Processo</div><div className="v mono">{v.numero_cnj ?? "sem CNJ"}</div></div>
                            <div className="field"><div className="k">Data relevante</div><div className="v mono">{fmtDate(v.data_relevante)}</div></div>
                            <div className="field"><div className="k">Cadastrado por</div><div className="v">{v.cadastrado_por ?? "—"}</div></div>
                          </div>
                        </div>
                      }
                    >
                      <td>
                        <Pill tone={ehAudiencia ? "blue" : "amber"}>{humano(v.tipo)}</Pill>
                      </td>
                      <td className="name">{v.descricao}</td>
                      <td className="cnj">{v.numero_cnj ?? "—"}</td>
                      <td className="mono">{fmtDate(v.data_relevante)}</td>
                      <td><Pill tone="gray" dot={false}>{v.cadastrado_por ?? "—"}</Pill></td>
                      <td className="center"><span className="gate wait">⏳ aguardando</span></td>
                    </DrawerRow>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nada aguardando validação. 🎉</div>
          )}
        </div>
      </div>
    </>
  );
}

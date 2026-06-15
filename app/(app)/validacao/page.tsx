import { getPrazos, getAudiencias } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Pill, DiasBox, ProcRef, SegredoTag } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { validarPrazoEditado, validarAudienciaEditada } from "@/app/actions";
import { TIPO_CONTAGEM, RESPONSAVEIS, AUDIENCIA_TIPO, AUDIENCIA_MODALIDADE } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ValidacaoPage() {
  const [prazos, audiencias] = await Promise.all([getPrazos(), getAudiencias()]);
  const prazosPend = prazos.filter((p) => !p.validado);
  const audPend = audiencias.filter((a) => !a.validado);
  const total = prazosPend.length + audPend.length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Gate de validação humana</div>
          <h1>Validação de Daniel</h1>
          <p>
            Revise o <b>dia exato</b> e os campos antes de confirmar. Ao validar,
            grava os ajustes e gera o evento no Google Calendar (fatal em vermelho).
          </p>
        </div>
      </div>

      <div className="banner">
        <span className="ico"><Icon name="check" /></span>
        <div>
          Tudo que a automação cria nasce <b>validado=false</b> com data <b>provisória</b>.
          Aqui você ajusta e confirma — validar não dispensa conferir feriado local.
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3><Icon name="clock" /> Prazos aguardando ({prazosPend.length})</h3></div>
        <div className="card-b flush">
          {prazosPend.length ? (
            <table>
              <thead><tr><th>Prazo</th><th>Ato</th><th>Processo / cliente</th><th>Fatal (provisória)</th><th className="center">Revisar</th></tr></thead>
              <tbody>
                {prazosPend.map((p) => (
                  <tr key={p.id}>
                    <td style={{ width: 64 }}><DiasBox dias={p.dias_restantes} /></td>
                    <td><div className="name">{p.ato}</div><div className="sub">{humano(p.tipo_contagem)}</div></td>
                    <td><ProcRef cnj={p.numero_cnj} registro={p.numero_registro} /> <SegredoTag on={p.segredo} /><div className="sub">{p.clientes || "—"}</div></td>
                    <td className="mono" style={{ color: "var(--amber)", fontWeight: 600 }}>{fmtDate(p.data_fatal)}</td>
                    <td className="center">
                      <FormModal label="Revisar e validar" titulo="Revisar prazo" descricao="Ajuste a data fatal exata e confirme." acao={validarPrazoEditado.bind(null, p.id)} enviarLabel="Validar">
                        <div><label>Ato</label><input name="ato" required defaultValue={p.ato} /></div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div><label>Data fatal</label><input type="date" name="data_fatal" required defaultValue={p.data_fatal?.slice(0, 10)} /></div>
                          <div><label>Data interna</label><input type="date" name="data_interna" defaultValue={p.data_interna?.slice(0, 10) ?? ""} /></div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div><label>Contagem</label><select name="tipo_contagem" defaultValue={p.tipo_contagem ?? "corridos"}>{TIPO_CONTAGEM.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                          <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                        </div>
                      </FormModal>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum prazo aguardando validação.</div>
          )}
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-h"><h3><Icon name="gavel" /> Audiências aguardando ({audPend.length})</h3></div>
        <div className="card-b flush">
          {audPend.length ? (
            <table>
              <thead><tr><th>Tipo</th><th>Processo</th><th>Data/hora (provisória)</th><th className="center">Revisar</th></tr></thead>
              <tbody>
                {audPend.map((a) => (
                  <tr key={a.id}>
                    <td><Pill tone="brass" dot={false}>{humano(a.tipo)}</Pill></td>
                    <td><ProcRef cnj={a.numero_cnj} /> <SegredoTag on={a.segredo} /></td>
                    <td className="mono">{fmtDate(a.data_hora)}</td>
                    <td className="center">
                      <FormModal label="Revisar e validar" titulo="Revisar audiência" descricao="Ajuste a data e hora exatas e confirme." acao={validarAudienciaEditada.bind(null, a.id)} enviarLabel="Validar">
                        <div><label>Tipo</label><select name="tipo" defaultValue={a.tipo}>{AUDIENCIA_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
                        <div><label>Data e hora</label><input type="datetime-local" name="data_hora" required defaultValue={a.data_hora?.slice(0, 16)} /></div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div><label>Modalidade</label><select name="modalidade" defaultValue={a.modalidade ?? "presencial"}>{AUDIENCIA_MODALIDADE.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                          <div><label>Responsável</label><select name="responsavel" defaultValue={a.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                        </div>
                        <div><label>Local / link</label><input name="local_link" defaultValue={a.local_link ?? ""} /></div>
                      </FormModal>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma audiência aguardando validação.</div>
          )}
        </div>
      </div>

      {total === 0 && (
        <div className="banner section-gap"><span className="ico"><Icon name="check" /></span><div>Fila de validação vazia. 🎉</div></div>
      )}
    </>
  );
}

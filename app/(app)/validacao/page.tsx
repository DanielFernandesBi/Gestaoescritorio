import { getFilaValidacao } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { DiasBox, SegredoTag } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { validarPrazo, validarPrazoEditado, validarAudiencia, validarAudienciaEditada } from "@/app/actions";
import { TIPO_CONTAGEM, RESPONSAVEIS, AUDIENCIA_TIPO, AUDIENCIA_MODALIDADE } from "@/lib/enums";
import { fmtDate, fmtTime, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import Link from "next/link";

export const dynamic = "force-dynamic";

function diaMes(iso: string) {
  const d = new Date(iso);
  return { dia: d.getDate(), mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") };
}
const quando = (dias: number) => (dias < 0 ? "atrasada" : dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`);

type Filtro = "todos" | "prazos" | "audiencias" | "preso";

export default async function ValidacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const filtro: Filtro = f === "prazos" || f === "audiencias" || f === "preso" ? f : "todos";

  const { prazos, audiencias, presos } = await getFilaValidacao();
  const total = prazos.length + audiencias.length;

  const prazosView = filtro === "preso" ? prazos.filter((p) => p.preso) : prazos;
  const showPrazos = filtro === "todos" || filtro === "prazos" || filtro === "preso";
  const showAud = filtro === "todos" || filtro === "audiencias";

  const chips: { key: Filtro; label: string; count: number; tone?: string }[] = [
    { key: "todos", label: "Todos", count: total },
    { key: "prazos", label: "Prazos", count: prazos.length },
    { key: "audiencias", label: "Audiências", count: audiencias.length },
    { key: "preso", label: "Com preso", count: presos, tone: "preso" },
  ];

  return (
    <div className="valida-page">
      <PageHeader
        breadcrumb={["Hoje", "Validação"]}
        eyebrow="Decisão humana · prioridade do dia"
        titulo="Validação"
        descricao={
          <>
            {total} prazo{total === 1 ? "" : "s"} e audiências provisórios criados pela triagem aguardam sua confirmação.
          </>
        }
        kpis={[
          { valor: prazos.length, label: "prazos a validar", tone: "accent" },
          { valor: audiencias.length, label: "audiências a validar", tone: "amber" },
          { valor: presos, label: "com preso", tone: "red" },
          { valor: total, label: "total na fila", tone: "neutral" },
        ]}
      />

      <div className="banner ai">
        <span className="ia-seal">IA</span>
        <div>
          Estes itens nasceram <b>provisórios</b> e já aparecem na <b>/agenda</b> (rede de segurança). Ao <b>validar</b>,
          você confirma a ciência, a fatal é <b>fixada</b> e o prazo é liberado. As datas fatais são <b>estimativas</b> —
          confira feriados locais e suspensão de expediente.
        </div>
      </div>

      <div className="vfilter">
        {chips.map((c) => (
          <Link
            key={c.key}
            href={c.key === "todos" ? "/validacao" : `/validacao?f=${c.key}`}
            className={`vchip${filtro === c.key ? " on" : ""}${c.tone === "preso" ? " preso" : ""}`}
          >
            {c.label} <span className="vchip-n">{c.count}</span>
          </Link>
        ))}
      </div>

      {showPrazos && (
        <>
          <div className="vsec-h">Prazos provisórios <span>ordenados pela fatal mais próxima</span></div>
          {prazosView.length ? (
            prazosView.map((p) => (
              <div className="vcard" key={p.id}>
                <div className="vcard-top">
                  <div className="vtags">
                    <span className="vtag prov">Prazo · provisório</span>
                    {p.preso && <span className="vtag preso">Preso</span>}
                    {p.segredo && <SegredoTag on />}
                  </div>
                  <DiasBox dias={p.dias_restantes} />
                </div>
                <div className="vcard-title">{p.ato}</div>
                <div className="vcard-sub">
                  <span className="vcli">{p.clientes || "—"}</span>
                  {p.numero_cnj && <> · <span className="cnj">{p.numero_cnj}</span></>}
                  {!p.numero_cnj && p.numero_registro && <> · <span className="cnj">reg {p.numero_registro}</span></>}
                  {p.tribunal && <> · {p.tribunal}</>}
                  {p.vara_comarca && <> · {p.vara_comarca}</>}
                </div>
                <div className="vgrid">
                  <div><span className="vk">Disponibilização</span><span className="vv mono">{p.data_disponibilizacao ? fmtDate(p.data_disponibilizacao) : "—"}</span></div>
                  <div><span className="vk">Ciência (est.)</span><span className="vv mono">{p.data_ciencia ? fmtDate(p.data_ciencia) : "—"}</span></div>
                  <div><span className="vk">Prazo legal</span><span className="vv">{p.dias != null ? `${p.dias} dias ${p.tipo_contagem ?? "corridos"}` : "—"}</span></div>
                  <div><span className="vk">Fundamento</span><span className="vv">{p.fundamento || "—"}</span></div>
                  <div><span className="vk">Fatal provisória</span><span className="vv mono fatal">{fmtDate(p.data_fatal)}</span></div>
                  <div><span className="vk">Interna sugerida</span><span className="vv mono">{p.data_interna ? fmtDate(p.data_interna) : "—"}</span></div>
                </div>
                <div className="vcard-foot">
                  <span className="vfoot-l">
                    <Icon name="grid" size={13} />{" "}
                    provisório · a validar
                    {p.origem && <> · extraído do {p.origem.toUpperCase()}</>}
                  </span>
                  <div className="vactions">
                    {p.intimacao_id && (
                      <Link className="btn ghost sm" href={linkPara("intimacao", p.intimacao_id)}>Ver intimação</Link>
                    )}
                    <FormModal label="Ajustar datas" titulo="Ajustar e validar prazo" descricao="Reveja a data fatal exata e confirme." acao={validarPrazoEditado.bind(null, p.id)} enviarLabel="Validar" variant="default">
                      <div><label>Ato</label><input name="ato" required defaultValue={p.ato} /></div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div><label>Data fatal</label><input type="date" name="data_fatal" required defaultValue={p.data_fatal?.slice(0, 10)} /></div>
                        <div><label>Data interna</label><input type="date" name="data_interna" defaultValue={p.data_interna?.slice(0, 10) ?? ""} /></div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div><label>Contagem</label><select name="tipo_contagem" defaultValue={p.tipo_contagem ?? "corridos"}>{TIPO_CONTAGEM.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                        <div><label>Responsável</label><select name="responsavel" defaultValue={p.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                      </div>
                    </FormModal>
                    <Acao
                      label={<><Icon name="check" size={14} /> Validar fatal</>}
                      titulo="Validar prazo"
                      resumo={<>Confirmar a ciência e fixar a fatal de <b>{p.ato}</b> em <b>{fmtDate(p.data_fatal)}</b>. Fica vermelha na /agenda — confira feriados locais.</>}
                      acao={validarPrazo.bind(null, p.id)}
                      confirmarLabel="Validar fatal"
                      variant="primary"
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Nenhum prazo provisório nesta lista. 🎉</div>
          )}
        </>
      )}

      {showAud && (
        <>
          <div className="vsec-h">Audiências provisórias</div>
          {audiencias.length ? (
            audiencias.map((a) => {
              const { dia, mes } = diaMes(a.data_hora);
              return (
                <div className="vcard" key={a.id}>
                  <div className="vcard-top">
                    <div className="vtags aud">
                      <span className={`ddays ${a.dias_ate <= 2 ? "crit" : a.dias_ate <= 7 ? "warn" : "ok"}`}><b>{dia}</b><span>{mes}</span></span>
                      <span className="vtag prov">Audiência · provisória</span>
                      <span className="vtag quando">{quando(a.dias_ate)}</span>
                      {a.segredo && <SegredoTag on />}
                    </div>
                  </div>
                  <div className="vcard-title">{a.segredo ? "Audiência (sigilo)" : humano(a.tipo)}</div>
                  <div className="vcard-sub">
                    <span className="vcli">{a.clientes || "—"}</span>
                    {a.numero_cnj && <> · <span className="cnj">{a.numero_cnj}</span></>}
                  </div>
                  <div className="vgrid">
                    <div><span className="vk">Data e hora</span><span className="vv mono">{fmtDate(a.data_hora)} · {fmtTime(a.data_hora)}</span></div>
                    <div><span className="vk">Modalidade</span><span className="vv">{humano(a.modalidade)}</span></div>
                    <div><span className="vk">Local</span><span className="vv">{a.local_link || "—"}</span></div>
                  </div>
                  <div className="vcard-foot">
                    <span className="vfoot-l">
                      <Icon name="grid" size={13} />{" "}
                      provisória · a validar
                    </span>
                    <div className="vactions">
                      <Link className="btn ghost sm" href={linkPara("audiencia", a.id)}>Ver audiência</Link>
                      <FormModal label="Ajustar" titulo="Ajustar e validar audiência" descricao="Reveja a data e hora exatas e confirme." acao={validarAudienciaEditada.bind(null, a.id)} enviarLabel="Validar" variant="default">
                        <div><label>Tipo</label><select name="tipo" defaultValue={a.tipo}>{AUDIENCIA_TIPO.map((x) => <option key={x} value={x}>{humano(x)}</option>)}</select></div>
                        <div><label>Data e hora</label><input type="datetime-local" name="data_hora" required defaultValue={a.data_hora?.slice(0, 16)} /></div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div><label>Modalidade</label><select name="modalidade" defaultValue={a.modalidade ?? "presencial"}>{AUDIENCIA_MODALIDADE.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                          <div><label>Responsável</label><select name="responsavel" defaultValue={a.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                        </div>
                        <div><label>Local / link</label><input name="local_link" defaultValue={a.local_link ?? ""} /></div>
                      </FormModal>
                      <Acao
                        label={<><Icon name="check" size={14} /> Validar audiência</>}
                        titulo="Validar audiência"
                        resumo={<>Confirmar a audiência de <b>{humano(a.tipo)}</b> em <b>{fmtDate(a.data_hora)} {fmtTime(a.data_hora)}</b>?</>}
                        acao={validarAudiencia.bind(null, a.id)}
                        confirmarLabel="Validar audiência"
                        variant="primary"
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty">Nenhuma audiência provisória. 🎉</div>
          )}
        </>
      )}

      {total === 0 && (
        <div className="banner section-gap"><span className="ico"><Icon name="check" /></span><div>Fila de validação vazia. 🎉</div></div>
      )}
    </div>
  );
}

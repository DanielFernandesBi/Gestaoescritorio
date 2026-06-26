import { getAgendaEventos, type AgendaEvento } from "@/lib/data";
import { SegredoTag } from "@/components/ui";
import { fmtTime } from "@/lib/format";
import { linkPara } from "@/lib/links";
import { Expansivel } from "@/components/Expansivel";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Datas em string ISO (YYYY-MM-DD), ancoradas ao meio-dia UTC para não driftar fuso.
const ATZ = "T12:00:00Z";
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + ATZ);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const wkMon = (iso: string) => (new Date(iso + ATZ).getUTCDay() + 6) % 7; // 0=Seg … 6=Dom
const fmtUTC = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { ...opts, timeZone: "UTC" }).format(new Date(iso + ATZ)).replace(".", "");
const diaMesCurto = (iso: string) => fmtUTC(iso, { day: "2-digit", month: "short" });
const addMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const mesLongo = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
};
const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Estado visual (cor/rótulo + se é provisório da IA). Tons: fatal=red,
// provisório/interna/fatal provisória=amber, audiência=blue, compromisso=green,
// baixado=muted.
function estado(e: AgendaEvento): { label: string; tone: string; ia: boolean } {
  if (e.baixado) return { label: "baixado", tone: "baixado", ia: false };
  if (e.tipo === "compromisso") return { label: "compromisso", tone: "comp", ia: false };
  if (e.tipo === "audiencia") return e.validado ? { label: "audiência", tone: "aud", ia: false } : { label: "provisório", tone: "prov", ia: true };
  if (e.marcador === "interna") return { label: "interna", tone: "interna", ia: false };
  return e.validado ? { label: "fatal", tone: "fatal", ia: false } : { label: "fatal provisória", tone: "prov", ia: true };
}

function EventoRow({ e }: { e: AgendaEvento }) {
  const st = estado(e);
  const fimDeSemana = e.tipo === "prazo" && e.marcador === "fatal" && wkMon(e.data.slice(0, 10)) >= 5;
  const detalhe = [
    e.tipo === "audiencia" ? e.modalidade : null,
    e.local,
    e.tipo === "prazo" ? e.fundamento : null,
    e.numero_cnj,
  ].filter(Boolean).join(" · ");
  return (
    <Link className={`ag-ev ev-${st.tone}`} href={linkPara(e.tipo, e.id)}>
      <span className="ag-ev-time">{e.diaInteiro ? "dia inteiro" : fmtTime(e.data)}</span>
      <span className="ag-ev-bar" />
      <div className="ag-ev-main">
        <div className="ag-ev-t">
          {e.titulo}
          {e.preso && <span className="ag-flag preso">PRESO</span>}
          {e.orfao && <span className="ag-flag orfao">ÓRFÃO</span>}
        </div>
        <div className="ag-ev-s">
          {e.segredo ? <SegredoTag on /> : e.cliente && <span className="dl-cli">{e.cliente}</span>}
          {detalhe && <>{(e.segredo || e.cliente) ? " · " : ""}{detalhe}</>}
        </div>
        {fimDeSemana && <div className="ag-ev-note">cai em fim de semana — confira prorrogação p/ 1º dia útil</div>}
      </div>
      <div className="ag-ev-r">
        <span className="ag-pill">{st.label}</span>
        {st.ia && <span className="ag-ia"><span className="d" />IA · a validar</span>}
      </div>
    </Link>
  );
}

// Rótulo contextual do dia (direita do cabeçalho): fatal / prorrogação / contagem.
function rotuloDia(doDia: AgendaEvento[], iso: string): { txt: string; cls: string } {
  const temFatal = doDia.some((e) => e.tipo === "prazo" && e.marcador === "fatal");
  const fds = wkMon(iso) >= 5;
  if (temFatal && fds) return { txt: "fim de semana · fatal prorroga", cls: "amber" };
  if (temFatal) return { txt: "fatal", cls: "red" };
  return { txt: `${doDia.length} ${doDia.length === 1 ? "evento" : "eventos"}`, cls: "" };
}

function DiaSecao({ iso, eventos, hojeISO, mostrarVazio }: { iso: string; eventos: AgendaEvento[]; hojeISO: string; mostrarVazio: boolean }) {
  const doDia = eventos.filter((e) => e.data.slice(0, 10) === iso).sort((a, b) => a.data.localeCompare(b.data));
  if (!doDia.length && !mostrarVazio) return null;
  const rotulo = iso === hojeISO ? "Hoje" : iso === addDays(hojeISO, 1) ? "Amanhã" : fmtUTC(iso, { weekday: "long" });
  const r = doDia.length ? rotuloDia(doDia, iso) : { txt: "sem eventos", cls: "" };
  return (
    <article className={`ag-dia${iso === hojeISO ? " ag-hoje" : ""}`}>
      <div className="ag-dia-h">
        <span className="ag-dia-t"><b>{rotulo}</b> {fmtUTC(iso, { weekday: "long" })} · {diaMesCurto(iso)}</span>
        <span className={`ag-dia-ct ${r.cls}`}>{r.txt}</span>
      </div>
      {doDia.length
        ? doDia.map((e, i) => <EventoRow key={`${e.tipo}-${e.id}-${e.marcador ?? ""}-${i}`} e={e} />)
        : <div className="ag-dia-vazio">Sem eventos.</div>}
    </article>
  );
}

// Faixa da semana — 7 cards com pontinhos por evento (cor do tom).
function FaixaSemana({ dias, eventos, hojeISO }: { dias: string[]; eventos: AgendaEvento[]; hojeISO: string }) {
  return (
    <div className="ag-week">
      {dias.map((iso) => {
        const doDia = eventos.filter((e) => e.data.slice(0, 10) === iso);
        const hoje = iso === hojeISO;
        const temFatal = doDia.some((e) => e.tipo === "prazo" && e.marcador === "fatal");
        return (
          <div key={iso} className={`ag-wd${hoje ? " on" : ""}${temFatal && !hoje ? " fatal" : ""}${!doDia.length ? " vazio" : ""}`}>
            <div className="dow">{DOW[wkMon(iso)]}</div>
            <div className="num">{Number(iso.slice(8, 10))}</div>
            {doDia.length ? (
              <div className="dots">{doDia.slice(0, 4).map((e, i) => <span key={i} className={`dot ev-${estado(e).tone}`} />)}</div>
            ) : <div className="vz">—</div>}
          </div>
        );
      })}
    </div>
  );
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ view?: string; m?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === "lista" || sp.view === "mes" ? sp.view : "semana";
  const hojeISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const mesRef = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : hojeISO.slice(0, 7);

  let inicio: string, fim: string, gridStart = "";
  if (view === "mes") {
    const first = `${mesRef}-01`;
    gridStart = addDays(first, -wkMon(first));
    inicio = gridStart;
    fim = addDays(gridStart, 41);
  } else if (view === "lista") {
    inicio = hojeISO;
    fim = addDays(hojeISO, 29);
  } else {
    inicio = hojeISO;
    fim = addDays(hojeISO, 6);
  }

  const eventos = await getAgendaEventos(inicio, fim);
  const semana = Array.from({ length: 7 }, (_, i) => addDays(hojeISO, i));
  const mHref = (v: string) => `/agenda?view=${v}${v === "mes" ? `&m=${mesRef}` : ""}`;

  return (
    <div className="ag-page">
      <div className="ag-head">
        <div className="lhs">
          <div className="eyebrow">Próximos 7 dias · sincronizado com o Calendar</div>
          <h1>Agenda</h1>
          <p>Prazos, audiências e compromissos da semana. Eventos provisórios da triagem aguardam validação.</p>
        </div>
        <div className="ag-views">
          <Link className={`ag-vbtn${view === "semana" ? " on" : ""}`} href={mHref("semana")}>Semana</Link>
          <Link className={`ag-vbtn${view === "lista" ? " on" : ""}`} href={mHref("lista")}>Lista</Link>
          <Link className={`ag-vbtn${view === "mes" ? " on" : ""}`} href={mHref("mes")}>Mês</Link>
        </div>
      </div>

      {/* legenda */}
      <div className="ag-legend">
        <span className="lg ev-fatal">Fatal confirmada</span>
        <span className="lg ev-prov">Provisório · a validar</span>
        <span className="lg ev-aud">Audiência</span>
        <span className="lg ev-comp">Validado · compromisso</span>
        <span className="lg ev-baixado">Baixado</span>
      </div>

      {view === "semana" && (
        <>
          <FaixaSemana dias={semana} eventos={eventos} hojeISO={hojeISO} />
          <div className="ag-list">
            {semana.map((iso) => <DiaSecao key={iso} iso={iso} eventos={eventos} hojeISO={hojeISO} mostrarVazio />)}
          </div>
        </>
      )}

      {view === "lista" && (
        <div className="ag-list">
          {Array.from({ length: 30 }, (_, i) => addDays(hojeISO, i))
            .filter((iso) => eventos.some((e) => e.data.slice(0, 10) === iso))
            .map((iso) => <DiaSecao key={iso} iso={iso} eventos={eventos} hojeISO={hojeISO} mostrarVazio={false} />)}
          {!eventos.length && <div className="ag-dia-vazio">Nada nos próximos 30 dias.</div>}
        </div>
      )}

      {view === "mes" && (
        <div className="ag-month">
          <div className="ag-month-nav">
            <Link className="btn sm" href={`/agenda?view=mes&m=${addMonth(mesRef, -1)}`}>← anterior</Link>
            <div className="ag-month-t">{mesLongo(mesRef)}</div>
            <Link className="btn sm" href={`/agenda?view=mes&m=${addMonth(mesRef, 1)}`}>próximo →</Link>
          </div>
          <div className="ag-grid">
            {DOW.map((d) => <div key={d} className="ag-grid-dow">{d}</div>)}
            {Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)).map((iso) => {
              const doDia = eventos.filter((e) => e.data.slice(0, 10) === iso);
              const foraDoMes = iso.slice(0, 7) !== mesRef;
              return (
                <div key={iso} className={`ag-cell${foraDoMes ? " fora" : ""}${iso === hojeISO ? " ag-hoje" : ""}`}>
                  <div className="ag-cell-n">{Number(iso.slice(8, 10))}</div>
                  {doDia.length > 0 && (
                    <Expansivel altura={86} mais={`+${doDia.length} ver tudo`} menos="recolher">
                      <div className="ag-cell-evs">
                        {doDia.map((e, i) => (
                          <Link key={`${e.id}-${i}`} className={`ag-chip ev-${estado(e).tone}`} href={linkPara(e.tipo, e.id)} title={e.titulo}>
                            {e.titulo}
                          </Link>
                        ))}
                      </div>
                    </Expansivel>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { getAgendaEventos, type AgendaEvento } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { SegredoTag } from "@/components/ui";
import { fmtTime } from "@/lib/format";
import { linkPara } from "@/lib/links";
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

// Estado visual do evento (cor + rótulo) — semáforo + aura provisória da IA.
function estado(e: AgendaEvento): { label: string; cls: string } {
  if (e.baixado) return { label: "baixado", cls: "ev-baixado" };
  if (e.tipo === "compromisso") return { label: "compromisso", cls: "ev-comp" };
  if (e.tipo === "audiencia") return e.validado ? { label: "audiência", cls: "ev-aud" } : { label: "provisório IA · a validar", cls: "ev-prov" };
  if (e.marcador === "interna") return { label: "interna", cls: "ev-interna" };
  return e.validado ? { label: "fatal", cls: "ev-fatal" } : { label: "fatal provisória IA · a validar", cls: "ev-prov" };
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
    <Link className={`ag-ev ${st.cls}`} href={linkPara(e.tipo, e.id)}>
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
        <span className={`ag-pill ${st.cls}`}>{st.label}</span>
        <div className="ag-ev-when">{e.diaInteiro ? "dia inteiro" : fmtTime(e.data)}</div>
      </div>
    </Link>
  );
}

function DiaSecao({ iso, eventos, hojeISO, mostrarVazio }: { iso: string; eventos: AgendaEvento[]; hojeISO: string; mostrarVazio: boolean }) {
  const doDia = eventos.filter((e) => e.data.slice(0, 10) === iso).sort((a, b) => a.data.localeCompare(b.data));
  if (!doDia.length && !mostrarVazio) return null;
  const rotulo = iso === hojeISO ? "Hoje" : iso === addDays(hojeISO, 1) ? "Amanhã" : "";
  return (
    <div className={`ag-dia${iso === hojeISO ? " hoje" : ""}`}>
      <div className="ag-dia-h">
        <span className="ag-dia-t">
          {rotulo && <b>{rotulo} </b>}
          {fmtUTC(iso, { weekday: "long" })} · {diaMesCurto(iso)}
        </span>
        <span className="ag-dia-ct">{doDia.length ? `${doDia.length} ${doDia.length === 1 ? "evento" : "eventos"}` : "sem eventos"}</span>
      </div>
      {doDia.map((e, i) => <EventoRow key={`${e.tipo}-${e.id}-${e.marcador ?? ""}-${i}`} e={e} />)}
    </div>
  );
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ view?: string; m?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === "lista" || sp.view === "mes" ? sp.view : "semana";
  const hojeISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const mesRef = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : hojeISO.slice(0, 7);

  // Range conforme a visão.
  let inicio: string, fim: string, gridStart = "";
  if (view === "mes") {
    const first = `${mesRef}-01`;
    gridStart = addDays(first, -wkMon(first));
    inicio = gridStart;
    fim = addDays(gridStart, 41); // 6 semanas
  } else if (view === "lista") {
    inicio = hojeISO;
    fim = addDays(hojeISO, 29);
  } else {
    inicio = hojeISO;
    fim = addDays(hojeISO, 6);
  }

  const eventos = await getAgendaEventos(inicio, fim);
  const provisorios = eventos.filter((e) => !e.validado && !e.baixado && e.tipo !== "compromisso").length;

  const mHref = (v: string) => `/agenda?view=${v}${v === "mes" ? `&m=${mesRef}` : ""}`;

  return (
    <div className="agenda-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Próximos dias · sincronizado com o Calendar</div>
          <h1>Agenda</h1>
          <p>Prazos, audiências e compromissos. Eventos provisórios da triagem aguardam validação.</p>
        </div>
        <Link className="btn primary" href="/validacao">
          <Icon name="check" size={15} /> Validar ({provisorios})
        </Link>
      </div>

      <div className="ag-toolbar">
        <div className="ag-views">
          <Link className={`ag-vbtn${view === "semana" ? " on" : ""}`} href={mHref("semana")}>Semana</Link>
          <Link className={`ag-vbtn${view === "lista" ? " on" : ""}`} href={mHref("lista")}>Lista</Link>
          <Link className={`ag-vbtn${view === "mes" ? " on" : ""}`} href={mHref("mes")}>Mês</Link>
        </div>
        <div className="ag-legend">
          <span className="lg ev-fatal">Fatal</span>
          <span className="lg ev-prov">Provisório · a validar</span>
          <span className="lg ev-aud">Audiência</span>
          <span className="lg ev-comp">Compromisso</span>
          <span className="lg ev-interna">Interna</span>
          <span className="lg ev-baixado">Baixado</span>
        </div>
      </div>

      {view === "semana" && (
        <div className="ag-list">
          {Array.from({ length: 7 }, (_, i) => addDays(hojeISO, i)).map((iso) => (
            <DiaSecao key={iso} iso={iso} eventos={eventos} hojeISO={hojeISO} mostrarVazio />
          ))}
        </div>
      )}

      {view === "lista" && (
        <div className="ag-list">
          {Array.from({ length: 30 }, (_, i) => addDays(hojeISO, i))
            .filter((iso) => eventos.some((e) => e.data.slice(0, 10) === iso))
            .map((iso) => (
              <DiaSecao key={iso} iso={iso} eventos={eventos} hojeISO={hojeISO} mostrarVazio={false} />
            ))}
          {!eventos.length && <div className="empty">Nada nos próximos 30 dias.</div>}
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
                <div key={iso} className={`ag-cell${foraDoMes ? " fora" : ""}${iso === hojeISO ? " hoje" : ""}`}>
                  <div className="ag-cell-n">{Number(iso.slice(8, 10))}</div>
                  <div className="ag-cell-evs">
                    {doDia.slice(0, 4).map((e, i) => (
                      <Link key={`${e.id}-${i}`} className={`ag-chip ${estado(e).cls}`} href={linkPara(e.tipo, e.id)} title={e.titulo}>
                        {e.titulo}
                      </Link>
                    ))}
                    {doDia.length > 4 && <div className="ag-chip-mais">+{doDia.length - 4}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

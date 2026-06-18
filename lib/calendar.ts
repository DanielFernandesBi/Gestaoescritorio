import "server-only";
import { google } from "googleapis";

/**
 * Google Calendar via service account (credenciais só no servidor).
 * Esquema de cores do manual: provisório=Tangerina(6), fatal=Tomato(11),
 * validado/calmo=Banana(5). Degradação segura: qualquer falha retorna null e
 * NUNCA derruba a gravação no banco (o chamador trata isso).
 *
 * Env (no Vercel/.env.local):
 *   GOOGLE_CLIENT_EMAIL   — e-mail da service account
 *   GOOGLE_PRIVATE_KEY    — chave privada (com \n escapados)
 *   GOOGLE_CALENDAR_ID    — id do calendário compartilhado com a service account
 */

const TZ = "America/Sao_Paulo";

export function calendarConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_CALENDAR_ID,
  );
}

function cliente() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

const CAL = () => process.env.GOOGLE_CALENDAR_ID!;

function maisUmDia(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function ddmm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

type PrazoEvt = {
  ato: string;
  dataFatal: string;
  dataInterna: string | null;
  ref: string; // cliente ou CNJ
  fundamento?: string;
};

/** Evento PROVISÓRIO (dia inteiro na data_interna, Tangerina). Retorna o eventId. */
export async function criarEventoProvisorio(p: PrazoEvt): Promise<string | null> {
  const cal = cliente();
  if (!cal) return null;
  const dia = (p.dataInterna ?? p.dataFatal).slice(0, 10);
  try {
    const r = await cal.events.insert({
      calendarId: CAL(),
      requestBody: {
        summary: `[PROVISÓRIO – CONFERIR] ${p.ato} — fatal ${ddmm(p.dataFatal)} — ${p.ref}`,
        description: [p.fundamento, "Conferir feriado local e suspensão de expediente."]
          .filter(Boolean)
          .join("\n"),
        colorId: "6",
        start: { date: dia },
        end: { date: maisUmDia(dia) },
      },
    });
    return r.data.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Validação: recolore o evento provisório para calmo (Banana) e cria o
 * marcador VERMELHO (Tomato) da data fatal. Retorna o id do evento fatal.
 */
export async function confirmarPrazo(
  p: PrazoEvt,
  eventoProvisorioId: string | null,
): Promise<string | null> {
  const cal = cliente();
  if (!cal) return null;
  try {
    if (eventoProvisorioId) {
      await cal.events
        .patch({
          calendarId: CAL(),
          eventId: eventoProvisorioId,
          requestBody: {
            summary: `[VALIDADO] ${p.ato} — interna — ${p.ref}`,
            colorId: "5",
          },
        })
        .catch(() => undefined);
    }
    const dia = p.dataFatal.slice(0, 10);
    const r = await cal.events.insert({
      calendarId: CAL(),
      requestBody: {
        summary: `FATAL: ${p.ato} — ${p.ref}`,
        description: "Prazo fatal CONFIRMADO por Daniel. Dias corridos (CPP art. 798).",
        colorId: "11",
        start: { date: dia },
        end: { date: maisUmDia(dia) },
      },
    });
    return r.data.id ?? null;
  } catch {
    return null;
  }
}

type AudEvt = {
  tipo: string;
  dataHora: string; // ISO timestamptz
  modalidade: string | null;
  local: string | null;
  ref: string;
};

/** Atualiza (patch) um evento de audiência já existente, sem duplicar. */
export async function atualizarEventoAudiencia(eventId: string, a: AudEvt): Promise<boolean> {
  const cal = cliente();
  if (!cal) return false;
  try {
    const inicio = new Date(a.dataHora);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    await cal.events.patch({
      calendarId: CAL(),
      eventId,
      requestBody: {
        summary: `Audiência (${a.tipo}) — ${a.ref}`,
        location: a.local ?? undefined,
        description: `Modalidade: ${a.modalidade ?? "—"}.`,
        start: { dateTime: inicio.toISOString(), timeZone: TZ },
        end: { dateTime: fim.toISOString(), timeZone: TZ },
      },
    });
    return true;
  } catch {
    return false;
  }
}

type CompromissoEvt = {
  titulo: string;
  dataHora: string; // ISO timestamptz
  local: string | null;
  descricao: string | null;
};

/** Evento de compromisso genérico (com hora, Sálvia/9). Retorna o eventId. */
export async function criarEventoCompromisso(c: CompromissoEvt): Promise<string | null> {
  const cal = cliente();
  if (!cal) return null;
  try {
    const inicio = new Date(c.dataHora);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    const r = await cal.events.insert({
      calendarId: CAL(),
      requestBody: {
        summary: `Compromisso — ${c.titulo}`,
        location: c.local ?? undefined,
        description: c.descricao ?? undefined,
        colorId: "9",
        start: { dateTime: inicio.toISOString(), timeZone: TZ },
        end: { dateTime: fim.toISOString(), timeZone: TZ },
      },
    });
    return r.data.id ?? null;
  } catch {
    return null;
  }
}

/** Evento de audiência (com hora). Retorna o eventId. */
export async function criarEventoAudiencia(a: AudEvt): Promise<string | null> {
  const cal = cliente();
  if (!cal) return null;
  try {
    const inicio = new Date(a.dataHora);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    const r = await cal.events.insert({
      calendarId: CAL(),
      requestBody: {
        summary: `Audiência (${a.tipo}) — ${a.ref}`,
        location: a.local ?? undefined,
        description: `Modalidade: ${a.modalidade ?? "—"}.`,
        colorId: "5",
        start: { dateTime: inicio.toISOString(), timeZone: TZ },
        end: { dateTime: fim.toISOString(), timeZone: TZ },
      },
    });
    return r.data.id ?? null;
  } catch {
    return null;
  }
}

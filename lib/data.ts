import { createClient } from "@/lib/supabase/server";
import { diasAte, humano } from "@/lib/format";
import { linkPara } from "@/lib/links";
import type { MapaProvidencia } from "@/lib/pecas";

/* Helpers ---------------------------------------------------------------- */

type NestedCliente = { clientes: { nome: string } | null };
type NestedProcesso = {
  numero_cnj: string | null;
  numero_registro_tribunal: string | null;
  tribunal: string | null;
  vara_comarca: string | null;
  uf: string | null;
  segredo_justica: boolean | null;
  // Contexto "do que se trata" (Sugestão 56) — opcionais, presentes quando a query os pede.
  classe?: string | null;
  assunto?: string | null;
  area?: string | null;
  fase?: string | null;
  instancia?: string | null;
  cliente_processo?: NestedCliente[] | null;
} | null;

function nomesClientes(cp?: NestedCliente[] | null): string {
  if (!cp?.length) return "";
  const nomes = cp.map((x) => x.clientes?.nome).filter(Boolean) as string[];
  return [...new Set(nomes)].join(", ");
}

/* Contexto do caso (Sugestão 56) — bloco "do que se trata", montado deterministicamente
 * do banco (sem schema novo). Para intimações/andamentos órfãos usa-se COALESCE com os
 * campos próprios da intimação; o frontend renderiza via <ContextoCaso/>. */
export type CasoContexto = {
  classe: string | null;
  assunto: string | null;
  area: string | null;
  fase: string | null;
  instancia: string | null;
  tribunal: string | null;
  vara_comarca: string | null;
};

/** Cliente + papel no processo (réu/paciente/executado/recorrente…), para o destaque do card. */
export type ParteCliente = { nome: string; papel: string | null };

function partesClientes(cp?: (NestedCliente & { papel?: string | null })[] | null): ParteCliente[] {
  if (!cp?.length) return [];
  const vistos = new Set<string>();
  const out: ParteCliente[] = [];
  for (const x of cp) {
    const nome = x.clientes?.nome;
    if (!nome || vistos.has(nome)) continue;
    vistos.add(nome);
    out.push({ nome, papel: x.papel ?? null });
  }
  return out;
}

/* Prazos ----------------------------------------------------------------- */

export type Prazo = {
  id: string;
  ato: string;
  data_fatal: string;
  data_interna: string | null;
  tipo_contagem: string | null;
  status: string;
  validado: boolean;
  responsavel: string | null;
  processo_id: string | null;
  numero_cnj: string | null;
  numero_registro: string | null;
  tribunal: string | null;
  vara_comarca: string | null;
  segredo: boolean;
  clientes: string;
  dias_restantes: number;
  orfao: boolean;
};

export async function getPrazos(): Promise<Prazo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prazos")
    .select(
      "id, ato, data_fatal, data_interna, tipo_contagem, status, validado, responsavel, processo_id, processos(numero_cnj,numero_registro_tribunal,tribunal,vara_comarca,segredo_justica,cliente_processo(clientes(nome)))",
    )
    .eq("status", "aberto")
    .order("data_fatal", { ascending: true });

  return (data ?? []).map((r): Prazo => {
    const p = r.processos as unknown as NestedProcesso;
    return {
      id: r.id as string,
      ato: r.ato as string,
      data_fatal: r.data_fatal as string,
      data_interna: r.data_interna as string | null,
      tipo_contagem: r.tipo_contagem as string | null,
      status: r.status as string,
      validado: Boolean(r.validado),
      responsavel: r.responsavel as string | null,
      numero_cnj: p?.numero_cnj ?? null,
      numero_registro: p?.numero_registro_tribunal ?? null,
      tribunal: p?.tribunal ?? null,
      vara_comarca: p?.vara_comarca ?? null,
      segredo: Boolean(p?.segredo_justica),
      clientes: nomesClientes(p?.cliente_processo),
      processo_id: (r.processo_id as string) ?? null,
      dias_restantes: diasAte(r.data_fatal as string),
      orfao: r.processo_id == null,
    };
  });
}

/** Um prazo pelo id (qualquer status), na mesma forma de `getPrazos`. */
export async function getPrazoPorId(id: string): Promise<Prazo | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("prazos")
    .select(
      "id, ato, data_fatal, data_interna, tipo_contagem, status, validado, responsavel, processo_id, processos(numero_cnj,numero_registro_tribunal,tribunal,vara_comarca,segredo_justica,cliente_processo(clientes(nome)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!r) return null;
  const p = r.processos as unknown as NestedProcesso;
  return {
    id: r.id as string,
    ato: r.ato as string,
    data_fatal: r.data_fatal as string,
    data_interna: r.data_interna as string | null,
    tipo_contagem: r.tipo_contagem as string | null,
    status: r.status as string,
    validado: Boolean(r.validado),
    responsavel: r.responsavel as string | null,
    numero_cnj: p?.numero_cnj ?? null,
    numero_registro: p?.numero_registro_tribunal ?? null,
    tribunal: p?.tribunal ?? null,
    vara_comarca: p?.vara_comarca ?? null,
    segredo: Boolean(p?.segredo_justica),
    clientes: nomesClientes(p?.cliente_processo),
    processo_id: (r.processo_id as string) ?? null,
    dias_restantes: diasAte(r.data_fatal as string),
    orfao: r.processo_id == null,
  };
}

/* Prazos órfãos (triagem) ------------------------------------------------ */

export type PrazoOrfao = {
  prazo_id: string;
  criado_em: string | null;
  ato: string;
  data_fatal: string;
  data_interna: string | null;
  dias_restantes: number;
  responsavel: string | null;
  intimacao_id: string | null;
  intimacao_resumo: string | null;
  cadastrado_por: string | null;
  observacoes: string | null;
};

export async function getPrazosOrfaos(): Promise<PrazoOrfao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_prazos_orfaos")
    .select("*")
    .order("data_fatal", { ascending: true });
  const rows = (data ?? []) as Record<string, unknown>[];

  // Resumo da intimação de origem (se houver) para exibir + link.
  const ids = [...new Set(rows.map((r) => r.intimacao_id).filter(Boolean))] as string[];
  const resumos = new Map<string, string | null>();
  if (ids.length) {
    const { data: ints } = await supabase.from("intimacoes").select("id, resumo").in("id", ids);
    for (const it of ints ?? []) resumos.set(it.id as string, (it.resumo as string) ?? null);
  }

  return rows.map((r): PrazoOrfao => ({
    prazo_id: r.prazo_id as string,
    criado_em: (r.criado_em as string) ?? null,
    ato: r.ato as string,
    data_fatal: r.data_fatal as string,
    data_interna: (r.data_interna as string) ?? null,
    dias_restantes: Number(r.dias_restantes ?? 0),
    responsavel: (r.responsavel as string) ?? null,
    intimacao_id: (r.intimacao_id as string) ?? null,
    intimacao_resumo: r.intimacao_id ? resumos.get(r.intimacao_id as string) ?? null : null,
    cadastrado_por: (r.cadastrado_por as string) ?? null,
    observacoes: (r.observacoes as string) ?? null,
  }));
}

/* Validação -------------------------------------------------------------- */

export type Validacao = {
  tipo: string;
  id: string;
  numero_cnj: string | null;
  descricao: string;
  data_relevante: string | null;
  cadastrado_por: string | null;
  criado_em: string;
};

export async function getValidacao(): Promise<Validacao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_pendentes_validacao")
    .select("*")
    .order("data_relevante", { ascending: true });
  return (data ?? []) as Validacao[];
}

/* Fila de validação (tela /validacao) — provisórios (validado=false) com os campos
 * do mockup Plantão: contexto da intimação (disponibilização/ciência/fundamento/origem),
 * prazo legal em dias, selo de evento no Calendar e flag de réu preso. Tudo via joins
 * já existentes no schema — sem inventar dado. */

const PRESO_SET = new Set(["preso_provisorio", "preso_definitivo", "regime_semiaberto"]);

type CPSituacao = { clientes?: { nome?: string | null; situacao_prisional?: string | null } | null };
type ProcValida = {
  numero_cnj?: string | null;
  numero_registro_tribunal?: string | null;
  tribunal?: string | null;
  vara_comarca?: string | null;
  segredo_justica?: boolean | null;
  cliente_processo?: CPSituacao[] | null;
} | null;
type IntimValida = {
  data_disponibilizacao?: string | null;
  data_ciencia?: string | null;
  fundamento?: string | null;
  origem?: string | null;
} | null;

export type PrazoValidacao = {
  id: string;
  ato: string;
  data_fatal: string;
  data_interna: string | null;
  dias: number | null;
  tipo_contagem: string | null;
  dias_restantes: number;
  numero_cnj: string | null;
  numero_registro: string | null;
  tribunal: string | null;
  vara_comarca: string | null;
  clientes: string;
  preso: boolean;
  segredo: boolean;
  tem_calendar: boolean;
  intimacao_id: string | null;
  data_disponibilizacao: string | null;
  data_ciencia: string | null;
  fundamento: string | null;
  origem: string | null;
  responsavel: string | null;
};

export type AudienciaValidacao = {
  id: string;
  tipo: string;
  data_hora: string;
  modalidade: string | null;
  local_link: string | null;
  numero_cnj: string | null;
  clientes: string;
  segredo: boolean;
  tem_calendar: boolean;
  dias_ate: number;
  responsavel: string | null;
};

function nomesDeCp(cps: CPSituacao[] | null | undefined): string {
  if (!cps?.length) return "";
  return [...new Set(cps.map((x) => x.clientes?.nome).filter(Boolean))].join(", ");
}

export async function getFilaValidacao(): Promise<{
  prazos: PrazoValidacao[];
  audiencias: AudienciaValidacao[];
  presos: number;
}> {
  const supabase = await createClient();
  const [pr, au] = await Promise.all([
    supabase
      .from("prazos")
      .select(
        "id, ato, data_fatal, data_interna, dias, tipo_contagem, responsavel, calendar_event_id, intimacao_id, processos(numero_cnj,numero_registro_tribunal,tribunal,vara_comarca,segredo_justica,cliente_processo(clientes(nome,situacao_prisional))), intimacoes(data_disponibilizacao,data_ciencia,fundamento,origem)",
      )
      .eq("status", "aberto")
      .eq("validado", false)
      .order("data_fatal", { ascending: true }),
    supabase
      .from("audiencias")
      .select(
        "id, tipo, data_hora, modalidade, local_link, responsavel, calendar_event_id, processos(numero_cnj,numero_registro_tribunal,segredo_justica,cliente_processo(clientes(nome)))",
      )
      .eq("status", "designada")
      .eq("validado", false)
      .order("data_hora", { ascending: true }),
  ]);

  const prazos = ((pr.data ?? []) as Record<string, unknown>[]).map((r): PrazoValidacao => {
    const p = r.processos as unknown as ProcValida;
    const it = r.intimacoes as unknown as IntimValida;
    const cps = p?.cliente_processo ?? [];
    return {
      id: r.id as string,
      ato: r.ato as string,
      data_fatal: r.data_fatal as string,
      data_interna: (r.data_interna as string) ?? null,
      dias: r.dias == null ? null : Number(r.dias),
      tipo_contagem: (r.tipo_contagem as string) ?? null,
      dias_restantes: diasAte(r.data_fatal as string),
      numero_cnj: p?.numero_cnj ?? null,
      numero_registro: p?.numero_registro_tribunal ?? null,
      tribunal: p?.tribunal ?? null,
      vara_comarca: p?.vara_comarca ?? null,
      clientes: nomesDeCp(cps),
      preso: cps.some((x) => x.clientes?.situacao_prisional != null && PRESO_SET.has(x.clientes.situacao_prisional)),
      segredo: Boolean(p?.segredo_justica),
      tem_calendar: Boolean(r.calendar_event_id),
      intimacao_id: (r.intimacao_id as string) ?? null,
      data_disponibilizacao: it?.data_disponibilizacao ?? null,
      data_ciencia: it?.data_ciencia ?? null,
      fundamento: it?.fundamento ?? null,
      origem: it?.origem ?? null,
      responsavel: (r.responsavel as string) ?? null,
    };
  });

  const audiencias = ((au.data ?? []) as Record<string, unknown>[]).map((r): AudienciaValidacao => {
    const p = r.processos as unknown as ProcValida;
    return {
      id: r.id as string,
      tipo: r.tipo as string,
      data_hora: r.data_hora as string,
      modalidade: (r.modalidade as string) ?? null,
      local_link: (r.local_link as string) ?? null,
      numero_cnj: p?.numero_cnj ?? null,
      clientes: nomesDeCp(p?.cliente_processo),
      segredo: Boolean(p?.segredo_justica),
      tem_calendar: Boolean(r.calendar_event_id),
      dias_ate: diasAte(r.data_hora as string),
      responsavel: (r.responsavel as string) ?? null,
    };
  });

  return { prazos, audiencias, presos: prazos.filter((p) => p.preso).length };
}

/* Painel de prazos (tela /prazos, alvo Plantão) --------------------------------
 * Todos os prazos abertos com o contexto rico da intimação de origem
 * (disponibilização/ciência/fundamento) e do processo (CNJ/registro/sigilo/preso),
 * mais os flags `validado`/`orfao` para a UI separar provisórios · validados ·
 * órfãos. Mesma malha de joins de `getFilaValidacao`, sem o filtro de validação. */

export type PrazoCard = {
  id: string;
  ato: string;
  data_fatal: string;
  data_interna: string | null;
  dias: number | null;
  tipo_contagem: string | null;
  dias_restantes: number;
  validado: boolean;
  orfao: boolean;
  processo_id: string | null;
  numero_cnj: string | null;
  numero_registro: string | null;
  tribunal: string | null;
  vara_comarca: string | null;
  clientes: string;
  preso: boolean;
  segredo: boolean;
  tem_calendar: boolean;
  intimacao_id: string | null;
  data_disponibilizacao: string | null;
  data_ciencia: string | null;
  fundamento: string | null;
  origem: string | null;
  responsavel: string | null;
};

export async function getPrazosPainel(): Promise<PrazoCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prazos")
    .select(
      "id, ato, data_fatal, data_interna, dias, tipo_contagem, responsavel, validado, processo_id, calendar_event_id, intimacao_id, processos(numero_cnj,numero_registro_tribunal,tribunal,vara_comarca,segredo_justica,cliente_processo(clientes(nome,situacao_prisional))), intimacoes(data_disponibilizacao,data_ciencia,fundamento,origem)",
    )
    .eq("status", "aberto")
    .order("data_fatal", { ascending: true });

  return ((data ?? []) as Record<string, unknown>[]).map((r): PrazoCard => {
    const p = r.processos as unknown as ProcValida;
    const it = r.intimacoes as unknown as IntimValida;
    const cps = p?.cliente_processo ?? [];
    return {
      id: r.id as string,
      ato: r.ato as string,
      data_fatal: r.data_fatal as string,
      data_interna: (r.data_interna as string) ?? null,
      dias: r.dias == null ? null : Number(r.dias),
      tipo_contagem: (r.tipo_contagem as string) ?? null,
      dias_restantes: diasAte(r.data_fatal as string),
      validado: Boolean(r.validado),
      orfao: r.processo_id == null,
      processo_id: (r.processo_id as string) ?? null,
      numero_cnj: p?.numero_cnj ?? null,
      numero_registro: p?.numero_registro_tribunal ?? null,
      tribunal: p?.tribunal ?? null,
      vara_comarca: p?.vara_comarca ?? null,
      clientes: nomesDeCp(cps),
      preso: cps.some((x) => x.clientes?.situacao_prisional != null && PRESO_SET.has(x.clientes.situacao_prisional)),
      segredo: Boolean(p?.segredo_justica),
      tem_calendar: Boolean(r.calendar_event_id),
      intimacao_id: (r.intimacao_id as string) ?? null,
      data_disponibilizacao: it?.data_disponibilizacao ?? null,
      data_ciencia: it?.data_ciencia ?? null,
      fundamento: it?.fundamento ?? null,
      origem: it?.origem ?? null,
      responsavel: (r.responsavel as string) ?? null,
    };
  });
}

/* Agenda — eventos da semana/mês (prazos + audiências + compromissos) ------
 * Replica o alvo do mock /agenda. Lê as três tabelas-base num range de datas e
 * normaliza num evento único. Prazos entram com marcador 'fatal' (data_fatal) e,
 * quando a interna cai no range, também 'interna' (data_interna). Sem DDL: usa só
 * colunas/joins existentes; `vw_agenda_semana` é magra demais para o mock. */

export type AgendaEvento = {
  tipo: "prazo" | "audiencia" | "compromisso";
  marcador: "fatal" | "interna" | null;
  id: string;
  data: string; // date (prazo) ou datetime (audiência/compromisso)
  diaInteiro: boolean;
  titulo: string;
  cliente: string | null;
  segredo: boolean;
  preso: boolean;
  numero_cnj: string | null;
  processo_id: string | null;
  orfao: boolean;
  validado: boolean;
  baixado: boolean;
  modalidade: string | null;
  local: string | null;
  fundamento: string | null;
  responsavel: string | null;
  dias_restantes: number;
};

export async function getAgendaEventos(inicio: string, fim: string): Promise<AgendaEvento[]> {
  const supabase = await createClient();
  const fimDt = `${fim}T23:59:59`; // limite superior para colunas timestamptz

  const [pr, au, co] = await Promise.all([
    supabase
      .from("prazos")
      .select(
        "id, ato, data_fatal, data_interna, status, validado, responsavel, processo_id, intimacao_id, processos(numero_cnj,numero_registro_tribunal,tribunal,vara_comarca,segredo_justica,cliente_processo(clientes(nome,situacao_prisional))), intimacoes(fundamento,origem)",
      )
      .or(`and(data_fatal.gte.${inicio},data_fatal.lte.${fim}),and(data_interna.gte.${inicio},data_interna.lte.${fim})`)
      .in("status", ["aberto", "cumprido", "prejudicado", "cancelado"]),
    supabase
      .from("audiencias")
      .select(
        "id, tipo, data_hora, modalidade, local_link, status, validado, responsavel, processo_id, processos(numero_cnj,segredo_justica,cliente_processo(clientes(nome,situacao_prisional)))",
      )
      .gte("data_hora", inicio)
      .lte("data_hora", fimDt),
    supabase
      .from("compromissos")
      .select("id, titulo, data_hora, local, status, responsavel, processo_id, clientes(nome), processos(segredo_justica)")
      .gte("data_hora", inicio)
      .lte("data_hora", fimDt),
  ]);

  const out: AgendaEvento[] = [];

  for (const r of (pr.data ?? []) as Record<string, unknown>[]) {
    const p = r.processos as unknown as ProcValida;
    const it = r.intimacoes as unknown as IntimValida;
    const cps = p?.cliente_processo ?? [];
    const baixado = (r.status as string) !== "aberto";
    const base = {
      tipo: "prazo" as const,
      id: r.id as string,
      diaInteiro: true,
      cliente: nomesDeCp(cps) || null,
      segredo: Boolean(p?.segredo_justica),
      preso: cps.some((x) => x.clientes?.situacao_prisional != null && PRESO_SET.has(x.clientes.situacao_prisional)),
      numero_cnj: p?.numero_cnj ?? null,
      processo_id: (r.processo_id as string) ?? null,
      orfao: r.processo_id == null,
      validado: Boolean(r.validado),
      baixado,
      modalidade: null,
      local: null,
      fundamento: it?.fundamento ?? null,
      responsavel: (r.responsavel as string) ?? null,
    };
    const ato = r.ato as string;
    const dataFatal = r.data_fatal as string;
    const dataInterna = (r.data_interna as string) ?? null;
    if (dataFatal >= inicio && dataFatal <= fim) {
      out.push({ ...base, marcador: "fatal", data: dataFatal, titulo: ato, dias_restantes: diasAte(dataFatal) });
    }
    if (dataInterna && dataInterna >= inicio && dataInterna <= fim && !baixado) {
      out.push({ ...base, marcador: "interna", data: dataInterna, titulo: `Interna — ${ato}`, dias_restantes: diasAte(dataInterna) });
    }
  }

  for (const r of (au.data ?? []) as Record<string, unknown>[]) {
    const p = r.processos as unknown as ProcValida;
    const cps = p?.cliente_processo ?? [];
    out.push({
      tipo: "audiencia",
      marcador: null,
      id: r.id as string,
      data: r.data_hora as string,
      diaInteiro: false,
      titulo: humano(r.tipo as string),
      cliente: nomesDeCp(cps) || null,
      segredo: Boolean(p?.segredo_justica),
      preso: cps.some((x) => x.clientes?.situacao_prisional != null && PRESO_SET.has(x.clientes.situacao_prisional)),
      numero_cnj: p?.numero_cnj ?? null,
      processo_id: (r.processo_id as string) ?? null,
      orfao: false,
      validado: Boolean(r.validado),
      baixado: (r.status as string) !== "designada",
      modalidade: (r.modalidade as string) ?? null,
      local: (r.local_link as string) ?? null,
      fundamento: null,
      responsavel: (r.responsavel as string) ?? null,
      dias_restantes: diasAte(r.data_hora as string),
    });
  }

  for (const r of (co.data ?? []) as Record<string, unknown>[]) {
    const cl = r.clientes as unknown as { nome?: string | null } | null;
    const p = r.processos as unknown as { segredo_justica?: boolean | null } | null;
    const st = r.status as string;
    out.push({
      tipo: "compromisso",
      marcador: null,
      id: r.id as string,
      data: r.data_hora as string,
      diaInteiro: false,
      titulo: (r.titulo as string) ?? "Compromisso",
      cliente: cl?.nome ?? null,
      segredo: Boolean(p?.segredo_justica),
      preso: false,
      numero_cnj: null,
      processo_id: (r.processo_id as string) ?? null,
      orfao: false,
      validado: true,
      baixado: st === "cancelado" || st === "realizado",
      modalidade: null,
      local: (r.local as string) ?? null,
      fundamento: null,
      responsavel: (r.responsavel as string) ?? null,
      dias_restantes: diasAte(r.data_hora as string),
    });
  }

  out.sort((a, b) => a.data.localeCompare(b.data));
  return out;
}

/* Intimações ------------------------------------------------------------- */

export type Intimacao = {
  id: string;
  origem: string | null;
  resumo: string | null;
  status: string;
  data_publicacao: string | null;
  data_ciencia: string | null;
  providencia: string | null;
  codigo_publicacao: string | null;
  processo_id: string | null;
  numero_cnj: string | null;
  numero_registro: string | null;
  tribunal: string | null;
  segredo: boolean;
  orfa: boolean;
  cliente: string | null;
  // Sugestão 56 — cliente(s) em destaque (com papel) e "do que se trata".
  partes?: ParteCliente[];
  contexto?: CasoContexto;
  // Sugestão 53 — sinais derivados da vw_intimacoes_contexto (DOIS eixos: fluxo × leitura).
  tem_prazo?: boolean;        // já tem prazo vinculado (robô/ humano amarrou)
  tem_peca?: boolean;         // já tem peça vinculada
  tem_providencia?: boolean;  // providência registrada
  na_caixa?: boolean;         // FLUXO: ainda precisa de encaminhamento (caixa derivada)
  revisado_em?: string | null;   // LEITURA: quando o humano leu (null = não lida)
  revisado_por?: string | null;
  // Redesign /intimacoes — flag de réu preso + detalhe do encaminhamento (prazo/peça vinculados).
  preso?: boolean;
  prazo_fatal?: string | null;
  prazo_dias_restantes?: number | null;
  prazo_validado?: boolean | null;
  peca_status?: string | null;
  // Preenchidos no detalhe (getIntimacaoPorId):
  teor?: string | null;
  cadastrado_por?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
  instancia?: string | null;
  vara_comarca?: string | null;
  uf?: string | null;
  area?: string | null;
  orgao?: string | null;
  classe?: string | null;
  prazo_dias?: number | null;
  fundamento?: string | null;
  data_disponibilizacao?: string | null;
  // Valores próprios da intimação (sem fallback do processo) p/ o formulário:
  proprio?: {
    tribunal: string | null;
    orgao: string | null;
    instancia: string | null;
    classe: string | null;
    area: string | null;
    prazo_dias: number | null;
    fundamento: string | null;
    data_disponibilizacao: string | null;
  };
};

export async function getIntimacoes(): Promise<Intimacao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("intimacoes")
    .select(
      "id, origem, resumo, status, data_publicacao, data_ciencia, providencia, codigo_publicacao, processo_id, classe, area, instancia, tribunal, orgao, processos(numero_cnj,numero_registro_tribunal,tribunal,vara_comarca,classe,assunto,area,fase,instancia,segredo_justica,cliente_processo(papel,clientes(nome,situacao_prisional)))",
    )
    .order("data_publicacao", { ascending: false, nullsFirst: false })
    .limit(300);

  const lista = (data ?? []).map((r): Intimacao => {
    const p = r.processos as unknown as NestedProcesso;
    const cp = p?.cliente_processo as unknown as (NestedCliente & { papel?: string | null })[] | null;
    // "Do que se trata": campo próprio da intimação primeiro (cobre órfãs), fallback no processo.
    const contexto: CasoContexto = {
      classe: (r.classe as string | null) ?? p?.classe ?? null,
      assunto: p?.assunto ?? null,
      area: (r.area as string | null) ?? p?.area ?? null,
      fase: p?.fase ?? null,
      instancia: (r.instancia as string | null) ?? p?.instancia ?? null,
      tribunal: (r.tribunal as string | null) ?? p?.tribunal ?? null,
      vara_comarca: p?.vara_comarca ?? null,
    };
    return {
      id: r.id as string,
      origem: r.origem as string | null,
      resumo: r.resumo as string | null,
      status: r.status as string,
      data_publicacao: r.data_publicacao as string | null,
      data_ciencia: r.data_ciencia as string | null,
      providencia: r.providencia as string | null,
      codigo_publicacao: r.codigo_publicacao as string | null,
      numero_cnj: p?.numero_cnj ?? null,
      numero_registro: p?.numero_registro_tribunal ?? null,
      tribunal: (r.tribunal as string | null) ?? p?.tribunal ?? null,
      segredo: Boolean(p?.segredo_justica),
      processo_id: (r.processo_id as string) ?? null,
      orfa: r.processo_id == null,
      cliente: nomesClientes(p?.cliente_processo) || null,
      partes: partesClientes(cp),
      contexto,
      preso: ((cp ?? []) as { clientes?: { situacao_prisional?: string | null } | null }[]).some((x) => {
        const s = x.clientes?.situacao_prisional;
        return s != null && PRESO_SET.has(s);
      }),
    };
  });

  // Sugestão 53 — mescla os sinais derivados (caixa de fatos × leitura) da view
  // unificada vw_intimacoes_contexto, por intimacao_id. Mantém o card rico da #56
  // (partes/contexto montados aqui) e só ACRESCENTA os flags de fluxo/leitura.
  if (lista.length) {
    const ids = lista.map((i) => i.id);
    const [{ data: sinais }, { data: prz }, { data: pcs }] = await Promise.all([
      supabase
        .from("vw_intimacoes_contexto")
        .select("intimacao_id, tem_prazo, tem_peca, tem_providencia, na_caixa, revisado_em, revisado_por")
        .in("intimacao_id", ids),
      // Detalhe do encaminhamento: prazo aberto vinculado (fatal/dias/validado).
      supabase.from("prazos").select("intimacao_id, data_fatal, validado").eq("status", "aberto").in("intimacao_id", ids),
      // …e a peça vinculada (status da minuta). Preferimos em_revisao quando houver.
      supabase.from("pecas").select("intimacao_id, status").in("intimacao_id", ids),
    ]);
    const porId = new Map((sinais ?? []).map((s) => [s.intimacao_id as string, s]));
    const prazoPorInt = new Map<string, { data_fatal: string | null; validado: boolean }>();
    for (const r of prz ?? []) {
      const k = r.intimacao_id as string;
      if (!prazoPorInt.has(k)) prazoPorInt.set(k, { data_fatal: (r.data_fatal as string) ?? null, validado: Boolean(r.validado) });
    }
    const pecaPorInt = new Map<string, string>();
    for (const r of pcs ?? []) {
      const k = r.intimacao_id as string;
      const st = r.status as string;
      if (!pecaPorInt.has(k) || st === "em_revisao") pecaPorInt.set(k, st);
    }
    for (const i of lista) {
      const s = porId.get(i.id);
      i.tem_prazo = Boolean(s?.tem_prazo);
      i.tem_peca = Boolean(s?.tem_peca);
      i.tem_providencia = Boolean(s?.tem_providencia);
      i.na_caixa = Boolean(s?.na_caixa);
      i.revisado_em = (s?.revisado_em as string | null) ?? null;
      i.revisado_por = (s?.revisado_por as string | null) ?? null;
      const pz = prazoPorInt.get(i.id);
      i.prazo_fatal = pz?.data_fatal ?? null;
      i.prazo_dias_restantes = pz?.data_fatal ? diasAte(pz.data_fatal) : null;
      i.prazo_validado = pz ? pz.validado : null;
      i.peca_status = pecaPorInt.get(i.id) ?? null;
    }
  }

  return lista;
}

/** Uma intimação pelo id, na mesma forma de `getIntimacoes`. */
export async function getIntimacaoPorId(id: string): Promise<Intimacao | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("intimacoes")
    .select(
      "id, origem, resumo, teor, status, data_publicacao, data_ciencia, providencia, codigo_publicacao, cadastrado_por, criado_em, atualizado_em, processo_id, tribunal, orgao, instancia, classe, area, prazo_dias, fundamento, data_disponibilizacao, processos(numero_cnj,numero_registro_tribunal,tribunal,vara_comarca,uf,instancia,area,classe,segredo_justica,cliente_processo(clientes(nome)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!r) return null;
  const p = r.processos as unknown as NestedProcesso & { instancia?: string | null; area?: string | null; classe?: string | null };
  const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
  return {
    teor: (r.teor as string | null) ?? null,
    cadastrado_por: (r.cadastrado_por as string | null) ?? null,
    criado_em: (r.criado_em as string | null) ?? null,
    atualizado_em: (r.atualizado_em as string | null) ?? null,
    // Efetivos = valor próprio da intimação, com fallback no processo vinculado.
    instancia: (r.instancia as string | null) ?? p?.instancia ?? null,
    vara_comarca: p?.vara_comarca ?? null,
    uf: p?.uf ?? null,
    area: (r.area as string | null) ?? p?.area ?? null,
    orgao: (r.orgao as string | null) ?? null,
    classe: (r.classe as string | null) ?? p?.classe ?? null,
    prazo_dias: num(r.prazo_dias),
    fundamento: (r.fundamento as string | null) ?? null,
    data_disponibilizacao: (r.data_disponibilizacao as string | null) ?? null,
    proprio: {
      tribunal: (r.tribunal as string | null) ?? null,
      orgao: (r.orgao as string | null) ?? null,
      instancia: (r.instancia as string | null) ?? null,
      classe: (r.classe as string | null) ?? null,
      area: (r.area as string | null) ?? null,
      prazo_dias: num(r.prazo_dias),
      fundamento: (r.fundamento as string | null) ?? null,
      data_disponibilizacao: (r.data_disponibilizacao as string | null) ?? null,
    },
    id: r.id as string,
    origem: r.origem as string | null,
    resumo: r.resumo as string | null,
    status: r.status as string,
    data_publicacao: r.data_publicacao as string | null,
    data_ciencia: r.data_ciencia as string | null,
    providencia: r.providencia as string | null,
    codigo_publicacao: r.codigo_publicacao as string | null,
    numero_cnj: p?.numero_cnj ?? null,
    numero_registro: p?.numero_registro_tribunal ?? null,
    tribunal: (r.tribunal as string | null) ?? p?.tribunal ?? null,
    segredo: Boolean(p?.segredo_justica),
    processo_id: (r.processo_id as string) ?? null,
    orfa: r.processo_id == null,
    cliente: nomesClientes(p?.cliente_processo) || null,
  };
}

/* Audiências ------------------------------------------------------------- */

export type Audiencia = {
  id: string;
  processo_id: string;
  tipo: string;
  data_hora: string;
  modalidade: string | null;
  local_link: string | null;
  status: string;
  responsavel: string | null;
  observacoes: string | null;
  validado: boolean;
  numero_cnj: string | null;
  numero_registro: string | null;
  segredo: boolean;
  clientes: string;
  redesignada_de?: string | null;
  data_anterior?: string | null;
};

export async function getAudiencias(): Promise<Audiencia[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audiencias")
    .select(
      "id, processo_id, tipo, data_hora, modalidade, local_link, status, responsavel, observacoes, validado, processos(numero_cnj,numero_registro_tribunal,segredo_justica,cliente_processo(clientes(nome)))",
    )
    .order("data_hora", { ascending: true });

  return (data ?? []).map((r): Audiencia => {
    const p = r.processos as unknown as NestedProcesso;
    return {
      id: r.id as string,
      processo_id: r.processo_id as string,
      tipo: r.tipo as string,
      data_hora: r.data_hora as string,
      modalidade: r.modalidade as string | null,
      local_link: r.local_link as string | null,
      status: r.status as string,
      responsavel: r.responsavel as string | null,
      observacoes: r.observacoes as string | null,
      validado: Boolean(r.validado),
      numero_cnj: p?.numero_cnj ?? null,
      numero_registro: p?.numero_registro_tribunal ?? null,
      segredo: Boolean(p?.segredo_justica),
      clientes: nomesClientes(p?.cliente_processo),
    };
  });
}

/** Uma audiência pelo id, na mesma forma de `getAudiencias`. */
export async function getAudienciaPorId(id: string): Promise<Audiencia | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("audiencias")
    .select(
      "id, processo_id, tipo, data_hora, modalidade, local_link, status, responsavel, observacoes, validado, redesignada_de, processos(numero_cnj,numero_registro_tribunal,segredo_justica,cliente_processo(clientes(nome)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!r) return null;
  const p = r.processos as unknown as NestedProcesso;
  let data_anterior: string | null = null;
  if (r.redesignada_de) {
    const { data: ant } = await supabase
      .from("audiencias")
      .select("data_hora")
      .eq("id", r.redesignada_de as string)
      .maybeSingle();
    data_anterior = (ant?.data_hora as string | null) ?? null;
  }
  return {
    redesignada_de: (r.redesignada_de as string | null) ?? null,
    data_anterior,
    id: r.id as string,
    processo_id: r.processo_id as string,
    tipo: r.tipo as string,
    data_hora: r.data_hora as string,
    modalidade: r.modalidade as string | null,
    local_link: r.local_link as string | null,
    status: r.status as string,
    responsavel: r.responsavel as string | null,
    observacoes: r.observacoes as string | null,
    validado: Boolean(r.validado),
    numero_cnj: p?.numero_cnj ?? null,
    numero_registro: p?.numero_registro_tribunal ?? null,
    segredo: Boolean(p?.segredo_justica),
    clientes: nomesClientes(p?.cliente_processo),
  };
}

/* Painel de audiências (tela /audiencias, alvo Plantão) ------------------------
 * Todas as audiências com o flag de réu preso (situação prisional via join) e os
 * dias até a sessão, para a UI separar próxima · provisórias · sessão virtual ·
 * realizadas. Reusa a malha de joins de getAudiencias + a lógica de preso de
 * getFilaValidacao. getAudiencias (painel antigo + painel geral) fica intacta. */

export type AudienciaCard = {
  id: string;
  processo_id: string;
  tipo: string;
  data_hora: string;
  data_fim: string | null;
  modalidade: string | null;
  local_link: string | null;
  status: string;
  responsavel: string | null;
  observacoes: string | null;
  validado: boolean;
  numero_cnj: string | null;
  numero_registro: string | null;
  segredo: boolean;
  clientes: string;
  preso: boolean;
  dias_ate: number;
};

export async function getAudienciasPainel(): Promise<AudienciaCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audiencias")
    .select(
      "id, processo_id, tipo, data_hora, data_fim, modalidade, local_link, status, responsavel, observacoes, validado, processos(numero_cnj,numero_registro_tribunal,segredo_justica,cliente_processo(clientes(nome,situacao_prisional)))",
    )
    .order("data_hora", { ascending: true });

  return ((data ?? []) as Record<string, unknown>[]).map((r): AudienciaCard => {
    const p = r.processos as unknown as ProcValida;
    const cps = p?.cliente_processo ?? [];
    return {
      id: r.id as string,
      processo_id: r.processo_id as string,
      tipo: r.tipo as string,
      data_hora: r.data_hora as string,
      data_fim: (r.data_fim as string) ?? null,
      modalidade: (r.modalidade as string) ?? null,
      local_link: (r.local_link as string) ?? null,
      status: r.status as string,
      responsavel: (r.responsavel as string) ?? null,
      observacoes: (r.observacoes as string) ?? null,
      validado: Boolean(r.validado),
      numero_cnj: p?.numero_cnj ?? null,
      numero_registro: p?.numero_registro_tribunal ?? null,
      segredo: Boolean(p?.segredo_justica),
      clientes: nomesDeCp(cps),
      preso: cps.some((x) => x.clientes?.situacao_prisional != null && PRESO_SET.has(x.clientes.situacao_prisional)),
      dias_ate: diasAte(r.data_hora as string),
    };
  });
}

/* Processos -------------------------------------------------------------- */

export type Processo = {
  id: string;
  numero_cnj: string | null;
  numero_registro: string | null;
  tribunal: string | null;
  vara_comarca: string | null;
  uf: string | null;
  instancia: string | null;
  area: string | null;
  classe: string | null;
  status: string;
  responsavel: string | null;
  segredo: boolean;
  cadastro_automatico: boolean;
  clientes: string;
  papel: string | null;
};

export async function getProcessos(limit = 250): Promise<Processo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("processos")
    .select(
      "id, numero_cnj, numero_registro_tribunal, tribunal, vara_comarca, uf, instancia, area, classe, status, responsavel, segredo_justica, cadastro_automatico, cliente_processo(papel,clientes(nome))",
    )
    .eq("status", "ativo")
    .order("criado_em", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r): Processo => {
    const cp = r.cliente_processo as unknown as (NestedCliente & { papel: string | null })[] | null;
    return {
      id: r.id as string,
      numero_cnj: r.numero_cnj as string | null,
      numero_registro: r.numero_registro_tribunal as string | null,
      tribunal: r.tribunal as string | null,
      vara_comarca: r.vara_comarca as string | null,
      uf: r.uf as string | null,
      instancia: r.instancia as string | null,
      area: r.area as string | null,
      classe: r.classe as string | null,
      status: r.status as string,
      responsavel: r.responsavel as string | null,
      segredo: Boolean(r.segredo_justica),
      cadastro_automatico: Boolean(r.cadastro_automatico),
      clientes: nomesClientes(cp),
      papel: cp?.[0]?.papel ?? null,
    };
  });
}

/* Acervo de processos — cards com grade de "saúde" (redesign /processos) -----
 * Enriquece os ativos com sinais por processo (próx. fatal, prazos, peças,
 * audiência, inércia, benefício de execução, estudo) via consultas batch
 * (processo_id IN ids). Só leitura, sem DDL. Inclui tombstones (arquivados com
 * merged_into) para o card "Ir ao canônico". */

export type ProcSaude = {
  prox_fatal: string | null;
  prox_fatal_dias: number | null;
  prazos_abertos: number;
  pecas_afazer: number;
  pecas_revisao: number;
  audiencia: string | null;
  audiencia_tipo: string | null;
  audiencia_modalidade: string | null;
  dias_parado: number | null;
  ultima_mov: string | null;
  beneficio_dias: number | null;
  tem_atestado: boolean;
  estudo_tipo: string | null;
};
export type ProcAcervo = Processo & {
  assunto: string | null;
  fase: string | null;
  processo_origem: string | null;
  preso: boolean;
  saude: ProcSaude;
};
export type Tombstone = { id: string; identificador: string; merged_into: string };

export async function getAcervoProcessos(limit = 120): Promise<{ processos: ProcAcervo[]; tombstones: Tombstone[] }> {
  const supabase = await createClient();
  const [{ data: rows }, { data: tomb }] = await Promise.all([
    supabase
      .from("processos")
      .select(
        "id, numero_cnj, numero_registro_tribunal, tribunal, vara_comarca, uf, instancia, area, classe, assunto, fase, status, responsavel, segredo_justica, cadastro_automatico, processo_origem, cliente_processo(papel,clientes(nome,situacao_prisional))",
      )
      .eq("status", "ativo")
      .order("criado_em", { ascending: false })
      .limit(limit),
    supabase
      .from("processos")
      .select("id, numero_cnj, numero_registro_tribunal, merged_into")
      .eq("status", "arquivado")
      .not("merged_into", "is", null)
      .limit(20),
  ]);

  const lista = rows ?? [];
  const ids = lista.map((r) => r.id as string);

  const [prz, pcs, aud, mov, exe, est] = await Promise.all([
    supabase.from("prazos").select("processo_id, data_fatal").eq("status", "aberto").in("processo_id", ids),
    supabase.from("pecas").select("processo_id, status").in("processo_id", ids),
    supabase.from("audiencias").select("processo_id, data_hora, tipo, modalidade").eq("status", "designada").in("processo_id", ids),
    supabase.from("vw_processos_movimentacao").select("processo_id, dias_parado, ultima_movimentacao").in("processo_id", ids),
    supabase.from("vw_situacao_executoria_atual").select("processo_id, dias_para_progressao").in("processo_id", ids),
    supabase.from("estudo_processo").select("processo_id, estudos_caso(tipo)").in("processo_id", ids),
  ]);

  const mPrz = new Map<string, { n: number; fatal: string | null }>();
  for (const r of prz.data ?? []) {
    const k = r.processo_id as string;
    const f = (r.data_fatal as string) ?? null;
    const cur = mPrz.get(k) ?? { n: 0, fatal: null };
    cur.n += 1;
    if (f && (!cur.fatal || f < cur.fatal)) cur.fatal = f;
    mPrz.set(k, cur);
  }
  const mPcs = new Map<string, { afazer: number; revisao: number }>();
  for (const r of pcs.data ?? []) {
    const k = r.processo_id as string;
    const st = r.status as string;
    if (["protocolada", "cancelada", "prejudicada"].includes(st)) continue;
    const cur = mPcs.get(k) ?? { afazer: 0, revisao: 0 };
    if (st === "a_fazer") cur.afazer += 1;
    if (st === "em_revisao") cur.revisao += 1;
    mPcs.set(k, cur);
  }
  const mAud = new Map<string, { data: string; tipo: string | null; mod: string | null }>();
  for (const r of aud.data ?? []) {
    const k = r.processo_id as string;
    const d = r.data_hora as string;
    const cur = mAud.get(k);
    if (!cur || d < cur.data) mAud.set(k, { data: d, tipo: (r.tipo as string) ?? null, mod: (r.modalidade as string) ?? null });
  }
  const mMov = new Map<string, { dias: number | null; ult: string | null }>();
  for (const r of mov.data ?? []) mMov.set(r.processo_id as string, { dias: r.dias_parado == null ? null : Number(r.dias_parado), ult: (r.ultima_movimentacao as string) ?? null });
  const mExe = new Map<string, number | null>();
  for (const r of exe.data ?? []) mExe.set(r.processo_id as string, r.dias_para_progressao == null ? null : Number(r.dias_para_progressao));
  const mEst = new Map<string, string>();
  for (const r of est.data ?? []) {
    const ec = r.estudos_caso as unknown as { tipo?: string | null } | null;
    if (ec?.tipo && !mEst.has(r.processo_id as string)) mEst.set(r.processo_id as string, ec.tipo);
  }

  const processos = lista.map((r): ProcAcervo => {
    const cp = r.cliente_processo as unknown as { papel?: string | null; clientes?: { nome?: string | null; situacao_prisional?: string | null } | null }[] | null;
    const id = r.id as string;
    const pz = mPrz.get(id);
    return {
      id,
      numero_cnj: (r.numero_cnj as string) ?? null,
      numero_registro: (r.numero_registro_tribunal as string) ?? null,
      tribunal: (r.tribunal as string) ?? null,
      vara_comarca: (r.vara_comarca as string) ?? null,
      uf: (r.uf as string) ?? null,
      instancia: (r.instancia as string) ?? null,
      area: (r.area as string) ?? null,
      classe: (r.classe as string) ?? null,
      status: r.status as string,
      responsavel: (r.responsavel as string) ?? null,
      segredo: Boolean(r.segredo_justica),
      cadastro_automatico: Boolean(r.cadastro_automatico),
      clientes: nomesClientes(cp as unknown as NestedCliente[] | null),
      papel: cp?.[0]?.papel ?? null,
      assunto: (r.assunto as string) ?? null,
      fase: (r.fase as string) ?? null,
      processo_origem: (r.processo_origem as string) ?? null,
      preso: (cp ?? []).some((x) => x.clientes?.situacao_prisional != null && PRESO_SET.has(x.clientes.situacao_prisional)),
      saude: {
        prox_fatal: pz?.fatal ?? null,
        prox_fatal_dias: pz?.fatal ? diasAte(pz.fatal) : null,
        prazos_abertos: pz?.n ?? 0,
        pecas_afazer: mPcs.get(id)?.afazer ?? 0,
        pecas_revisao: mPcs.get(id)?.revisao ?? 0,
        audiencia: mAud.get(id)?.data ?? null,
        audiencia_tipo: mAud.get(id)?.tipo ?? null,
        audiencia_modalidade: mAud.get(id)?.mod ?? null,
        dias_parado: mMov.get(id)?.dias ?? null,
        ultima_mov: mMov.get(id)?.ult ?? null,
        beneficio_dias: mExe.has(id) ? (mExe.get(id) ?? null) : null,
        tem_atestado: mExe.has(id),
        estudo_tipo: mEst.get(id) ?? null,
      },
    };
  });

  const tombstones: Tombstone[] = (tomb ?? []).map((r) => ({
    id: r.id as string,
    identificador: (r.numero_registro_tribunal as string) || (r.numero_cnj as string) || "—",
    merged_into: r.merged_into as string,
  }));

  return { processos, tombstones };
}

/** Um processo pelo id (qualquer status), na mesma forma de `getProcessos`. */
export async function getProcessoPorId(id: string): Promise<Processo | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("processos")
    .select(
      "id, numero_cnj, numero_registro_tribunal, tribunal, vara_comarca, uf, instancia, area, classe, status, responsavel, segredo_justica, cadastro_automatico, cliente_processo(papel,clientes(nome))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!r) return null;
  const cp = r.cliente_processo as unknown as (NestedCliente & { papel: string | null })[] | null;
  return {
    id: r.id as string,
    numero_cnj: r.numero_cnj as string | null,
    numero_registro: r.numero_registro_tribunal as string | null,
    tribunal: r.tribunal as string | null,
    vara_comarca: r.vara_comarca as string | null,
    uf: r.uf as string | null,
    instancia: r.instancia as string | null,
    area: r.area as string | null,
    classe: r.classe as string | null,
    status: r.status as string,
    responsavel: r.responsavel as string | null,
    segredo: Boolean(r.segredo_justica),
    cadastro_automatico: Boolean(r.cadastro_automatico),
    clientes: nomesClientes(cp),
    papel: cp?.[0]?.papel ?? null,
  };
}

/* Clientes --------------------------------------------------------------- */

export type Cliente = {
  id: string;
  nome: string;
  cpf: string | null;
  uf: string | null;
  situacao_prisional: string | null;
  unidade_prisional: string | null;
  cadastro_automatico: boolean;
  favorito: boolean;
  total_processos: number;
  processos_ativos: number;
  prazos_abertos: number;
  audiencias_futuras: number;
  ultima_movimentacao: string | null;
  ultima_intimacao: string | null;
  ultima_atividade: string | null;
};

export async function getClientes(): Promise<Cliente[]> {
  const supabase = await createClient();
  const [base, situacao, atividade] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, cpf, uf, situacao_prisional, unidade_prisional, cadastro_automatico, favorito")
      .eq("ativo", true)
      .order("nome", { ascending: true }),
    supabase.from("vw_situacao_cliente").select("*"),
    supabase.from("vw_cliente_ultima_atividade").select("cliente_id, ultima_movimentacao, ultima_intimacao, ultima_atividade"),
  ]);

  const sit = new Map<string, Record<string, number>>();
  for (const s of situacao.data ?? []) {
    sit.set(s.cliente_id as string, {
      total_processos: Number(s.total_processos ?? 0),
      processos_ativos: Number(s.processos_ativos ?? 0),
      prazos_abertos: Number(s.prazos_abertos ?? 0),
      audiencias_futuras: Number(s.audiencias_futuras ?? 0),
    });
  }

  const ativ = new Map<string, { mov: string | null; int: string | null; ult: string | null }>();
  for (const a of atividade.data ?? []) {
    ativ.set(a.cliente_id as string, {
      mov: (a.ultima_movimentacao as string) ?? null,
      int: (a.ultima_intimacao as string) ?? null,
      ult: (a.ultima_atividade as string) ?? null,
    });
  }

  return (base.data ?? []).map((c): Cliente => {
    const s = sit.get(c.id as string) ?? {};
    const a = ativ.get(c.id as string);
    return {
      id: c.id as string,
      nome: c.nome as string,
      cpf: c.cpf as string | null,
      uf: c.uf as string | null,
      situacao_prisional: c.situacao_prisional as string | null,
      unidade_prisional: c.unidade_prisional as string | null,
      cadastro_automatico: Boolean(c.cadastro_automatico),
      favorito: Boolean(c.favorito),
      total_processos: s.total_processos ?? 0,
      processos_ativos: s.processos_ativos ?? 0,
      prazos_abertos: s.prazos_abertos ?? 0,
      audiencias_futuras: s.audiencias_futuras ?? 0,
      ultima_movimentacao: a?.mov ?? null,
      ultima_intimacao: a?.int ?? null,
      ultima_atividade: a?.ult ?? null,
    };
  });
}

/* Acervo de clientes — cards com situação consolidada (redesign /clientes) ----
 * Reusa getClientes (vw_situacao_cliente) e enriquece por cliente com sinais
 * (papel, sigilo, próx. fatal, audiência, execução, financeiro) via consultas
 * batch pequenas. Só leitura, sem DDL. */

type CliRef = { clientes?: { id?: string | null } | null }[];
const idsDeProc = (p: unknown): string[] => {
  const proc = p as { cliente_processo?: CliRef } | null;
  return (proc?.cliente_processo ?? []).map((x) => x.clientes?.id).filter(Boolean) as string[];
};

export type ClienteAcervo = Cliente & {
  contato_familia: string | null;
  papel: string | null;
  segredo: boolean;
  prox_fatal: string | null;
  prox_fatal_dias: number | null;
  audiencia: string | null;
  regime: string | null;
  beneficio_dias: number | null;
  livramento_dias: number | null;
  tem_atestado: boolean;
  em_execucao: boolean;
  inadimplente: boolean;
  fin_parcela: number | null;
  fin_dias_atraso: number | null;
  fin_valor: number | null;
};

export async function getAcervoClientes(): Promise<ClienteAcervo[]> {
  const supabase = await createClient();
  const base = await getClientes();
  const ids = base.map((c) => c.id);

  const [cont, prz, aud, exe, ctr, pag, cp] = await Promise.all([
    supabase.from("clientes").select("id, contato_familia").in("id", ids),
    supabase.from("prazos").select("data_fatal, processos(cliente_processo(clientes(id)))").eq("status", "aberto"),
    supabase.from("audiencias").select("data_hora, processos(cliente_processo(clientes(id)))").eq("status", "designada"),
    supabase.from("vw_situacao_executoria_atual").select("cliente_id, regime_atual, dias_para_progressao, dias_para_livramento"),
    supabase.from("contratos").select("cliente_id, status"),
    supabase.from("pagamentos").select("numero_parcela, valor, vencimento, contratos(cliente_id)").eq("status", "atrasado"),
    supabase.from("cliente_processo").select("cliente_id, papel, processos(segredo_justica)"),
  ]);

  const mCont = new Map((cont.data ?? []).map((r) => [r.id as string, (r.contato_familia as string) ?? null]));
  const mFatal = new Map<string, string>();
  for (const r of prz.data ?? []) {
    const f = (r.data_fatal as string) ?? null;
    if (!f) continue;
    for (const cid of idsDeProc(r.processos)) {
      const cur = mFatal.get(cid);
      if (!cur || f < cur) mFatal.set(cid, f);
    }
  }
  const mAud = new Map<string, string>();
  for (const r of aud.data ?? []) {
    const d = (r.data_hora as string) ?? null;
    if (!d) continue;
    for (const cid of idsDeProc(r.processos)) {
      const cur = mAud.get(cid);
      if (!cur || d < cur) mAud.set(cid, d);
    }
  }
  const mExe = new Map<string, { regime: string | null; prog: number | null; livr: number | null }>();
  for (const r of exe.data ?? [])
    mExe.set(r.cliente_id as string, {
      regime: (r.regime_atual as string) ?? null,
      prog: r.dias_para_progressao == null ? null : Number(r.dias_para_progressao),
      livr: r.dias_para_livramento == null ? null : Number(r.dias_para_livramento),
    });
  const inadimSet = new Set<string>();
  for (const r of ctr.data ?? []) if (r.status === "inadimplente") inadimSet.add(r.cliente_id as string);
  const mPag = new Map<string, { parcela: number; valor: number; dias: number }>();
  for (const r of pag.data ?? []) {
    const c = r.contratos as unknown as { cliente_id?: string | null } | null;
    const cid = c?.cliente_id;
    if (!cid) continue;
    const dias = -diasAte(r.vencimento as string);
    const cur = mPag.get(cid);
    if (!cur || dias > cur.dias) mPag.set(cid, { parcela: Number(r.numero_parcela ?? 0), valor: Number(r.valor ?? 0), dias });
  }
  const mCp = new Map<string, { papel: string | null; segredo: boolean }>();
  for (const r of cp.data ?? []) {
    const cid = r.cliente_id as string;
    const seg = Boolean((r.processos as unknown as { segredo_justica?: boolean | null } | null)?.segredo_justica);
    const cur = mCp.get(cid);
    if (!cur) mCp.set(cid, { papel: (r.papel as string) ?? null, segredo: seg });
    else if (seg) cur.segredo = true;
  }

  return base.map((c): ClienteAcervo => {
    const exec = mExe.get(c.id);
    const pg = mPag.get(c.id);
    const fatal = mFatal.get(c.id) ?? null;
    return {
      ...c,
      contato_familia: mCont.get(c.id) ?? null,
      papel: mCp.get(c.id)?.papel ?? null,
      segredo: mCp.get(c.id)?.segredo ?? false,
      prox_fatal: fatal,
      prox_fatal_dias: fatal ? diasAte(fatal) : null,
      audiencia: mAud.get(c.id) ?? null,
      regime: exec?.regime ?? null,
      beneficio_dias: exec?.prog ?? null,
      livramento_dias: exec?.livr ?? null,
      tem_atestado: Boolean(exec),
      em_execucao: Boolean(exec),
      inadimplente: inadimSet.has(c.id) || mPag.has(c.id),
      fin_parcela: pg?.parcela ?? null,
      fin_dias_atraso: pg?.dias ?? null,
      fin_valor: pg?.valor ?? null,
    };
  });
}

/** Um cliente pelo id (inclusive inativo), na mesma forma de `getClientes`. */
export async function getClientePorId(id: string): Promise<Cliente | null> {
  const supabase = await createClient();
  const [base, situacao, atividade] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, cpf, uf, situacao_prisional, unidade_prisional, cadastro_automatico, favorito")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("vw_situacao_cliente").select("*").eq("cliente_id", id).maybeSingle(),
    supabase.from("vw_cliente_ultima_atividade").select("cliente_id, ultima_movimentacao, ultima_intimacao, ultima_atividade").eq("cliente_id", id).maybeSingle(),
  ]);

  const c = base.data;
  if (!c) return null;
  const s = situacao.data ?? {};
  const a = atividade.data;
  return {
    id: c.id as string,
    nome: c.nome as string,
    cpf: c.cpf as string | null,
    uf: c.uf as string | null,
    situacao_prisional: c.situacao_prisional as string | null,
    unidade_prisional: c.unidade_prisional as string | null,
    cadastro_automatico: Boolean(c.cadastro_automatico),
    favorito: Boolean(c.favorito),
    total_processos: Number((s as Record<string, unknown>).total_processos ?? 0),
    processos_ativos: Number((s as Record<string, unknown>).processos_ativos ?? 0),
    prazos_abertos: Number((s as Record<string, unknown>).prazos_abertos ?? 0),
    audiencias_futuras: Number((s as Record<string, unknown>).audiencias_futuras ?? 0),
    ultima_movimentacao: (a?.ultima_movimentacao as string) ?? null,
    ultima_intimacao: (a?.ultima_intimacao as string) ?? null,
    ultima_atividade: (a?.ultima_atividade as string) ?? null,
  };
}

/* Financeiro ------------------------------------------------------------- */

export type Parcela = {
  id: string;
  contrato_id: string | null;
  cliente: string;
  objeto: string | null;
  numero_parcela: number;
  valor: number;
  vencimento: string;
  dias_atraso: number;
  status: string;
};

export async function getFinanceiro(): Promise<{
  parcelas: Parcela[];
  totalReceber: number;
  totalAtraso: number;
  contratosVigentes: number;
  contratosTotal: number;
}> {
  const supabase = await createClient();
  const [fin, contratosVig, contratosAll] = await Promise.all([
    supabase
      .from("pagamentos")
      .select("id, contrato_id, numero_parcela, valor, vencimento, status, contratos(objeto, clientes(nome))")
      .in("status", ["a_vencer", "atrasado"])
      .order("vencimento", { ascending: true }),
    supabase.from("contratos").select("*", { count: "exact", head: true }).eq("status", "vigente"),
    supabase.from("contratos").select("*", { count: "exact", head: true }),
  ]);

  const parcelas: Parcela[] = (fin.data ?? []).map((r) => {
    const c = r.contratos as unknown as { objeto: string | null; clientes: { nome: string } | null } | null;
    const dias = diasAte(r.vencimento as string);
    return {
      id: r.id as string,
      contrato_id: (r.contrato_id as string | null) ?? null,
      cliente: c?.clientes?.nome ?? "—",
      objeto: c?.objeto ?? null,
      numero_parcela: Number(r.numero_parcela ?? 0),
      valor: Number(r.valor ?? 0),
      vencimento: r.vencimento as string,
      dias_atraso: dias < 0 ? -dias : 0,
      status: r.status as string,
    };
  });
  const totalReceber = parcelas.reduce((s, p) => s + Number(p.valor ?? 0), 0);
  const totalAtraso = parcelas
    .filter((p) => p.status === "atrasado")
    .reduce((s, p) => s + Number(p.valor ?? 0), 0);

  return {
    parcelas,
    totalReceber,
    totalAtraso,
    contratosVigentes: contratosVig.count ?? 0,
    contratosTotal: contratosAll.count ?? 0,
  };
}

export type ParcelaContrato = {
  id: string;
  numero_parcela: number;
  valor: number;
  valor_pago: number | null;
  vencimento: string;
  pago_em: string | null;
  status: string;
  dias_atraso: number;
};

export type Contrato = {
  id: string;
  cliente_id: string;
  cliente: string;
  objeto: string;
  contratante: string | null;
  valor_total: number;
  forma_pagamento: string | null;
  status: string;
  data_contrato: string | null;
  processo_cnj: string | null;
  observacoes: string | null;
  total_pago: number;
  total_aberto: number;
  total_atraso: number;
  qtd_parcelas: number;
  parcelas: ParcelaContrato[];
};

const CONTRATO_SELECT =
  "id, cliente_id, objeto, contratante, valor_total, forma_pagamento, status, data_contrato, observacoes, clientes(nome), processos(numero_cnj), pagamentos(id, numero_parcela, valor, valor_pago, vencimento, pago_em, status)";

function mapContrato(c: Record<string, unknown>): Contrato {
  {
    const cli = c.clientes as unknown as { nome: string } | null;
    const proc = c.processos as unknown as { numero_cnj: string | null } | null;
    const pags = (c.pagamentos ?? []) as unknown as Array<Record<string, unknown>>;
    const parcelas: ParcelaContrato[] = pags
      .map((p) => {
        const dias = diasAte(p.vencimento as string);
        return {
          id: p.id as string,
          numero_parcela: Number(p.numero_parcela ?? 0),
          valor: Number(p.valor ?? 0),
          valor_pago: p.valor_pago == null ? null : Number(p.valor_pago),
          vencimento: p.vencimento as string,
          pago_em: (p.pago_em as string | null) ?? null,
          status: p.status as string,
          dias_atraso: dias < 0 ? -dias : 0,
        };
      })
      .sort((a, b) => a.numero_parcela - b.numero_parcela);

    const total_pago = parcelas
      .filter((p) => p.status === "pago")
      .reduce((s, p) => s + (p.valor_pago ?? p.valor), 0);
    const abertas = parcelas.filter((p) => p.status === "a_vencer" || p.status === "atrasado");
    const total_aberto = abertas.reduce((s, p) => s + p.valor, 0);
    const total_atraso = parcelas.filter((p) => p.status === "atrasado").reduce((s, p) => s + p.valor, 0);

    return {
      id: c.id as string,
      cliente_id: c.cliente_id as string,
      cliente: cli?.nome ?? "—",
      objeto: c.objeto as string,
      contratante: (c.contratante as string | null) ?? null,
      valor_total: Number(c.valor_total ?? 0),
      forma_pagamento: (c.forma_pagamento as string | null) ?? null,
      status: c.status as string,
      data_contrato: (c.data_contrato as string | null) ?? null,
      processo_cnj: proc?.numero_cnj ?? null,
      observacoes: (c.observacoes as string | null) ?? null,
      total_pago,
      total_aberto,
      total_atraso,
      qtd_parcelas: parcelas.length,
      parcelas,
    };
  }
}

export async function getContratos(): Promise<Contrato[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contratos")
    .select(CONTRATO_SELECT)
    .order("data_contrato", { ascending: false });
  return (data ?? []).map((c) => mapContrato(c as Record<string, unknown>));
}

export async function getContratoPorId(id: string): Promise<Contrato | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contratos")
    .select(CONTRATO_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? mapContrato(data as Record<string, unknown>) : null;
}

export type Despesa = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string | null;
  reembolsavel: boolean;
  reembolsada: boolean;
  cliente: string | null;
  processo_cnj: string | null;
};

export async function getDespesas(): Promise<Despesa[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("despesas")
    .select("id, descricao, categoria, valor, data, reembolsavel, reembolsada, clientes(nome), processos(numero_cnj)")
    .order("data", { ascending: false })
    .limit(200);
  return (data ?? []).map((d) => {
    const cli = d.clientes as unknown as { nome: string } | null;
    const proc = d.processos as unknown as { numero_cnj: string | null } | null;
    return {
      id: d.id as string,
      descricao: d.descricao as string,
      categoria: (d.categoria as string) ?? "outra",
      valor: Number(d.valor ?? 0),
      data: (d.data as string | null) ?? null,
      reembolsavel: Boolean(d.reembolsavel),
      reembolsada: Boolean(d.reembolsada),
      cliente: cli?.nome ?? null,
      processo_cnj: proc?.numero_cnj ?? null,
    };
  });
}

/* Inteligência: processos sem movimentação + presos ---------------------- */

export type ProcessoParado = {
  processo_id: string;
  numero_cnj: string | null;
  numero_registro_tribunal: string | null;
  tribunal: string | null;
  vara_comarca: string | null;
  uf: string | null;
  area: string | null;
  status: string;
  responsavel: string | null;
  segredo_justica: boolean;
  ultima_movimentacao: string;
  dias_parado: number;
  clientes: string | null;
  tem_preso: boolean;
};

export async function getProcessosParados(diasMin = 15): Promise<ProcessoParado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_processos_movimentacao")
    .select("*")
    .gte("dias_parado", diasMin)
    .order("dias_parado", { ascending: false })
    .limit(400);
  return (data ?? []) as ProcessoParado[];
}

export type ClientePreso = {
  cliente_id: string;
  nome: string;
  situacao_prisional: string;
  total_processos: number;
  processos_ativos: number;
  prazos_abertos: number;
  audiencias_futuras: number;
};

export async function getClientesPresos(): Promise<ClientePreso[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_situacao_cliente")
    .select("cliente_id, nome, situacao_prisional, total_processos, processos_ativos, prazos_abertos, audiencias_futuras")
    .in("situacao_prisional", ["preso_provisorio", "preso_definitivo"])
    .order("nome", { ascending: true });
  return (data ?? []) as ClientePreso[];
}

/* Fechamento financeiro mensal ------------------------------------------- */

export type Fechamento = {
  ym: string;
  recebido: number;
  socio: number;
  aReceber: number;
  emAtraso: number;
  despesas: number;
  qtdPagas: number;
};

export async function getFechamentoMensal(ym: string): Promise<Fechamento> {
  const supabase = await createClient();
  const ini = `${ym}-01`;
  const [ano, mes] = ym.split("-").map(Number);
  const fim = new Date(ano, mes, 0).toISOString().slice(0, 10); // último dia do mês

  const [pagas, abertas, desp] = await Promise.all([
    supabase.from("pagamentos").select("valor, valor_pago").eq("status", "pago").gte("pago_em", ini).lte("pago_em", fim),
    supabase.from("pagamentos").select("valor, status").in("status", ["a_vencer", "atrasado"]).gte("vencimento", ini).lte("vencimento", fim),
    supabase.from("despesas").select("valor").gte("data", ini).lte("data", fim),
  ]);

  const recebido = (pagas.data ?? []).reduce((s, p) => s + Number(p.valor_pago ?? p.valor ?? 0), 0);
  const aReceber = (abertas.data ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0);
  const emAtraso = (abertas.data ?? []).filter((p) => p.status === "atrasado").reduce((s, p) => s + Number(p.valor ?? 0), 0);
  const despesas = (desp.data ?? []).reduce((s, d) => s + Number(d.valor ?? 0), 0);

  return {
    ym,
    recebido,
    socio: recebido / 2,
    aReceber,
    emAtraso,
    despesas,
    qtdPagas: (pagas.data ?? []).length,
  };
}

/* Andamentos ------------------------------------------------------------- */

export type Movimentacao = {
  id: string;
  data: string;
  tipo: string;
  descricao: string;
  autor: string | null;
  origem: string | null;
  numero_cnj: string | null;
  numero_registro: string | null;
  tribunal: string | null;
  segredo: boolean;
  clientes: string | null;
  // Sugestão 56 — "do que se trata" do processo vinculado (null para órfãos/sem processo).
  contexto?: CasoContexto | null;
  // Redesign /andamentos — cliente(s) com papel, escalonamento (Sug. 30) e ids p/ deep-link.
  processo_id?: string | null;
  partes?: ParteCliente[];
  escalado?: boolean;
  prioridade?: string | null;
  tarefa_id?: string | null;
};

export async function getAndamentos(): Promise<Movimentacao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_movimentacoes_recentes")
    .select("*")
    .order("data", { ascending: false })
    .limit(60);
  const rows = data ?? [];

  // Camada A da Sugestão 56: enriquece com o contexto do processo (classe/assunto/área/
  // fase/instância/vara) numa única consulta extra — a view já expõe processo_id, então
  // não há DDL. tribunal vem da própria view (fallback ok).
  const procIds = [...new Set(rows.map((r) => r.processo_id as string | null).filter(Boolean))] as string[];
  const ctxPorProcesso = new Map<string, CasoContexto>();
  const partesPorProcesso = new Map<string, ParteCliente[]>();
  if (procIds.length) {
    const { data: procs } = await supabase
      .from("processos")
      .select("id, classe, assunto, area, fase, instancia, tribunal, vara_comarca, cliente_processo(papel,clientes(nome))")
      .in("id", procIds);
    for (const pr of procs ?? []) {
      ctxPorProcesso.set(pr.id as string, {
        classe: (pr.classe as string | null) ?? null,
        assunto: (pr.assunto as string | null) ?? null,
        area: (pr.area as string | null) ?? null,
        fase: (pr.fase as string | null) ?? null,
        instancia: (pr.instancia as string | null) ?? null,
        tribunal: (pr.tribunal as string | null) ?? null,
        vara_comarca: (pr.vara_comarca as string | null) ?? null,
      });
      partesPorProcesso.set(
        pr.id as string,
        partesClientes(pr.cliente_processo as unknown as (NestedCliente & { papel?: string | null })[] | null),
      );
    }
  }

  // Escalonamento (Sug. 30): tarefa de conferência vinculada por andamento_id.
  const escalPorAnd = new Map<string, { tarefa_id: string; prioridade: string | null }>();
  const andIds = rows.map((r) => r.id as string);
  if (andIds.length) {
    const { data: tarefas } = await supabase
      .from("tarefas")
      .select("id, andamento_id, prioridade, status")
      .in("andamento_id", andIds)
      .neq("status", "cancelada");
    for (const t of tarefas ?? []) {
      const k = t.andamento_id as string;
      if (!escalPorAnd.has(k) || t.status === "pendente")
        escalPorAnd.set(k, { tarefa_id: t.id as string, prioridade: (t.prioridade as string) ?? null });
    }
  }

  return rows.map((r) => {
    const procId = r.processo_id as string | null;
    const esc = escalPorAnd.get(r.id as string);
    return {
      id: r.id as string,
      data: r.data as string,
      tipo: r.tipo as string,
      descricao: r.descricao as string,
      autor: r.autor as string | null,
      origem: r.origem as string | null,
      numero_cnj: r.numero_cnj as string | null,
      numero_registro: r.numero_registro_tribunal as string | null,
      tribunal: r.tribunal as string | null,
      segredo: Boolean(r.segredo_justica),
      clientes: r.clientes as string | null,
      contexto: (procId && ctxPorProcesso.get(procId)) || null,
      processo_id: procId,
      partes: (procId && partesPorProcesso.get(procId)) || [],
      escalado: Boolean(esc),
      prioridade: esc?.prioridade ?? null,
      tarefa_id: esc?.tarefa_id ?? null,
    };
  });
}

/* Andamentos órfãos (triagem) -------------------------------------------- */

export type AndamentoOrfao = {
  id: string;
  data: string | null;
  tipo: string;
  descricao: string;
  autor: string | null;
  origem: string | null;
  cadastrado_por: string | null;
  cadastro_automatico: boolean;
  criado_em: string | null;
};

export async function getAndamentosOrfaos(): Promise<AndamentoOrfao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_andamentos_orfaos")
    .select("*")
    .order("data", { ascending: false, nullsFirst: false });
  return (data ?? []).map((r): AndamentoOrfao => ({
    id: r.id as string,
    data: (r.data as string) ?? null,
    tipo: (r.tipo as string) ?? "outro",
    descricao: (r.descricao as string) ?? "",
    autor: (r.autor as string) ?? null,
    origem: (r.origem as string) ?? null,
    cadastrado_por: (r.cadastrado_por as string) ?? null,
    cadastro_automatico: Boolean(r.cadastro_automatico),
    criado_em: (r.criado_em as string) ?? null,
  }));
}

/* Tarefas ---------------------------------------------------------------- */

export type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string | null;
  responsavel: string | null;
  data_limite: string | null;
  processo_id: string | null;
  cliente_id: string | null;
  // Sugestão 33 — proveniência (conferências automáticas do Cowork):
  cadastro_automatico?: boolean;
  cadastrado_por?: string | null;
  andamento_id?: string | null;
  // Preenchidos no detalhe (getTarefaPorId), via processo vinculado:
  numero_cnj?: string | null;
  segredo?: boolean;
};

export async function getTarefas(): Promise<Tarefa[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select("id, titulo, descricao, status, prioridade, responsavel, data_limite, processo_id, cliente_id, cadastro_automatico, cadastrado_por, andamento_id")
    .order("data_limite", { ascending: true, nullsFirst: false })
    .limit(300);
  return (data ?? []) as Tarefa[];
}

export async function getTarefaPorId(id: string): Promise<Tarefa | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("tarefas")
    .select("id, titulo, descricao, status, prioridade, responsavel, data_limite, processo_id, cliente_id, cadastro_automatico, cadastrado_por, andamento_id, processos(numero_cnj,segredo_justica)")
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const p = r.processos as unknown as { numero_cnj: string | null; segredo_justica: boolean | null } | null;
  return {
    id: r.id as string,
    titulo: r.titulo as string,
    descricao: (r.descricao as string | null) ?? null,
    status: r.status as string,
    prioridade: (r.prioridade as string | null) ?? null,
    responsavel: (r.responsavel as string | null) ?? null,
    data_limite: (r.data_limite as string | null) ?? null,
    processo_id: (r.processo_id as string | null) ?? null,
    cliente_id: (r.cliente_id as string | null) ?? null,
    cadastro_automatico: Boolean(r.cadastro_automatico),
    cadastrado_por: (r.cadastrado_por as string | null) ?? null,
    andamento_id: (r.andamento_id as string | null) ?? null,
    numero_cnj: p?.numero_cnj ?? null,
    segredo: Boolean(p?.segredo_justica),
  };
}

/* Painel de tarefas (tela /tarefas, alvo Plantão) -----------------------------
 * Tarefas com o cliente resolvido (processo vinculado OU cliente direto), nº do
 * processo, selo de sigilo e a data de conclusão — para os cards do kanban
 * (pendente · em andamento · concluída). getTarefas continua magra (drawer). */

export type TarefaCard = Tarefa & {
  cliente: string | null;
  numero_registro: string | null;
  concluida_em: string | null;
};

export async function getTarefasPainel(): Promise<TarefaCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select(
      "id, titulo, descricao, status, prioridade, responsavel, data_limite, concluida_em, processo_id, cliente_id, cadastro_automatico, cadastrado_por, andamento_id, processos(numero_cnj,numero_registro_tribunal,segredo_justica,cliente_processo(clientes(nome))), clientes(nome)",
    )
    .order("data_limite", { ascending: true, nullsFirst: false })
    .limit(300);

  return ((data ?? []) as Record<string, unknown>[]).map((r): TarefaCard => {
    const p = r.processos as unknown as NestedProcesso;
    const direto = r.clientes as unknown as { nome: string | null } | null;
    return {
      id: r.id as string,
      titulo: r.titulo as string,
      descricao: (r.descricao as string | null) ?? null,
      status: r.status as string,
      prioridade: (r.prioridade as string | null) ?? null,
      responsavel: (r.responsavel as string | null) ?? null,
      data_limite: (r.data_limite as string | null) ?? null,
      processo_id: (r.processo_id as string | null) ?? null,
      cliente_id: (r.cliente_id as string | null) ?? null,
      cadastro_automatico: Boolean(r.cadastro_automatico),
      cadastrado_por: (r.cadastrado_por as string | null) ?? null,
      andamento_id: (r.andamento_id as string | null) ?? null,
      numero_cnj: p?.numero_cnj ?? null,
      numero_registro: p?.numero_registro_tribunal ?? null,
      segredo: Boolean(p?.segredo_justica),
      cliente: nomesClientes(p?.cliente_processo) || direto?.nome || null,
      concluida_em: (r.concluida_em as string | null) ?? null,
    };
  });
}

/* Produção de peças (kanban de escrita — Sugestão 20) -------------------- */

export type Peca = {
  id: string;
  titulo: string;
  tipo: string;
  subtipo: string | null;
  status: string;
  prioridade: string | null;
  responsavel: string | null;
  cliente_id: string | null;
  cliente: string | null;
  processo_id: string | null;
  numero_cnj: string | null;
  numero_registro: string | null;
  segredo: boolean;
  prazo_id: string | null;
  data_fatal: string | null;
  data_interna: string | null;
  prazo_validado: boolean | null;
  data_efetiva: string | null;
  dias_restantes: number | null;
  intimacao_id: string | null;
  origem_andamento_id: string | null;
  tarefa_id: string | null;
  drive_file_id: string | null;
  protocolada_em: string | null;
  cadastro_automatico: boolean;
  validado: boolean;
  criado_em: string | null;
  descricao: string | null;
  observacoes: string | null;
  // Gate v2 do redator agendado (Sugestões 42/50/48) — vivem na tabela pecas,
  // não na view; lidos à parte e mesclados.
  gate_resultado: string | null;   // 'alta' | 'baixa'
  gate_pendencia: string | null;   // o que falta quando 'baixa'
  gate_analisado_em: string | null;
};

/**
 * Backlog/kanban de peças a produzir. Lê a view vw_pecas_pendentes, que já exclui
 * peças protocoladas/canceladas/prejudicadas e calcula dias_restantes pela
 * data_interna herdada do prazo (ou pela data_alvo própria quando não há prazo).
 */
export async function getPecas(): Promise<Peca[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_pecas_pendentes")
    .select("*")
    .order("dias_restantes", { ascending: true, nullsFirst: false });

  // Campos do gate vivem na tabela pecas (a view não os expõe). Busca à parte e mescla.
  const ids = (data ?? []).map((r) => r.id as string);
  const gatePorId = new Map<string, { resultado: string | null; pendencia: string | null; analisado_em: string | null }>();
  if (ids.length) {
    const { data: gates } = await supabase
      .from("pecas")
      .select("id, gate_resultado, gate_pendencia, gate_analisado_em")
      .in("id", ids);
    for (const g of gates ?? []) {
      gatePorId.set(g.id as string, {
        resultado: (g.gate_resultado as string) ?? null,
        pendencia: (g.gate_pendencia as string) ?? null,
        analisado_em: (g.gate_analisado_em as string) ?? null,
      });
    }
  }

  return (data ?? []).map((r): Peca => ({
    id: r.id as string,
    titulo: r.titulo as string,
    tipo: (r.tipo as string) ?? "outra",
    subtipo: (r.subtipo as string) ?? null,
    status: r.status as string,
    prioridade: (r.prioridade as string) ?? null,
    responsavel: (r.responsavel as string) ?? null,
    cliente_id: (r.cliente_id as string) ?? null,
    cliente: (r.cliente as string) ?? null,
    processo_id: (r.processo_id as string) ?? null,
    numero_cnj: (r.numero_cnj as string) ?? null,
    numero_registro: (r.numero_registro_tribunal as string) ?? null,
    segredo: Boolean(r.segredo_justica),
    prazo_id: (r.prazo_id as string) ?? null,
    data_fatal: (r.data_fatal as string) ?? null,
    data_interna: (r.data_interna as string) ?? null,
    prazo_validado: r.prazo_validado == null ? null : Boolean(r.prazo_validado),
    data_efetiva: (r.data_efetiva as string) ?? null,
    dias_restantes: r.dias_restantes == null ? null : Number(r.dias_restantes),
    intimacao_id: (r.intimacao_id as string) ?? null,
    origem_andamento_id: (r.origem_andamento_id as string) ?? null,
    tarefa_id: (r.tarefa_id as string) ?? null,
    drive_file_id: (r.drive_file_id as string) ?? null,
    protocolada_em: (r.protocolada_em as string) ?? null,
    cadastro_automatico: Boolean(r.cadastro_automatico),
    validado: Boolean(r.validado),
    criado_em: (r.criado_em as string) ?? null,
    descricao: (r.descricao as string) ?? null,
    observacoes: (r.observacoes as string) ?? null,
    gate_resultado: gatePorId.get(r.id as string)?.resultado ?? null,
    gate_pendencia: gatePorId.get(r.id as string)?.pendencia ?? null,
    gate_analisado_em: gatePorId.get(r.id as string)?.analisado_em ?? null,
  }));
}

/**
 * Peças já protocoladas (status terminal fora da vw_pecas_pendentes). Lidas direto
 * da tabela para manter visíveis no filtro "Protocoladas" do board — acesso rápido
 * dos sócios ao que já foi protocolado.
 */
export async function getPecasProtocoladas(limit = 200): Promise<Peca[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pecas")
    .select(
      "id, titulo, tipo, subtipo, status, prioridade, responsavel, cliente_id, processo_id, prazo_id, intimacao_id, origem_andamento_id, tarefa_id, andamento_id, drive_file_id, protocolada_em, cadastro_automatico, validado, criado_em, descricao, observacoes, gate_resultado, gate_pendencia, gate_analisado_em, clientes(nome), processos(numero_cnj,numero_registro_tribunal,segredo_justica)",
    )
    .eq("status", "protocolada")
    .order("protocolada_em", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []).map((r): Peca => {
    const cli = r.clientes as unknown as { nome: string } | null;
    const proc = r.processos as unknown as {
      numero_cnj: string | null;
      numero_registro_tribunal: string | null;
      segredo_justica: boolean | null;
    } | null;
    return {
      id: r.id as string,
      titulo: r.titulo as string,
      tipo: (r.tipo as string) ?? "outra",
      subtipo: (r.subtipo as string) ?? null,
      status: r.status as string,
      prioridade: (r.prioridade as string) ?? null,
      responsavel: (r.responsavel as string) ?? null,
      cliente_id: (r.cliente_id as string) ?? null,
      cliente: cli?.nome ?? null,
      processo_id: (r.processo_id as string) ?? null,
      numero_cnj: proc?.numero_cnj ?? null,
      numero_registro: proc?.numero_registro_tribunal ?? null,
      segredo: Boolean(proc?.segredo_justica),
      prazo_id: (r.prazo_id as string) ?? null,
      data_fatal: null,
      data_interna: null,
      prazo_validado: null,
      data_efetiva: null,
      dias_restantes: null,
      intimacao_id: (r.intimacao_id as string) ?? null,
      origem_andamento_id: (r.origem_andamento_id as string) ?? null,
      tarefa_id: (r.tarefa_id as string) ?? null,
      drive_file_id: (r.drive_file_id as string) ?? null,
      protocolada_em: (r.protocolada_em as string) ?? null,
      cadastro_automatico: Boolean(r.cadastro_automatico),
      validado: Boolean(r.validado),
      criado_em: (r.criado_em as string) ?? null,
      descricao: (r.descricao as string) ?? null,
      observacoes: (r.observacoes as string) ?? null,
      gate_resultado: (r.gate_resultado as string) ?? null,
      gate_pendencia: (r.gate_pendencia as string) ?? null,
      gate_analisado_em: (r.gate_analisado_em as string) ?? null,
    };
  });
}

/**
 * Mapa providência→peça (config_sistema/mapa_providencia_peca). Lido pela sessão do
 * usuário (RLS auth_read). `valor` é texto JSON; degradação segura: null se ausente/ilegível.
 */
export async function getMapaProvidenciaPeca(): Promise<MapaProvidencia | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("config_sistema")
    .select("valor")
    .eq("chave", "mapa_providencia_peca")
    .maybeSingle();
  const raw = data?.valor;
  if (!raw) return null;
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return v as MapaProvidencia;
  } catch {
    return null;
  }
}

/* Auditoria -------------------------------------------------------------- */

export type EventoAuditoria = {
  ocorrido_em: string;
  tabela: string;
  operacao: string;
  referencia: string | null;
  registro_id: string | null;
};

export async function getAuditoria(): Promise<{
  eventos: EventoAuditoria[];
  total: number;
}> {
  const supabase = await createClient();
  const [rel, total] = await Promise.all([
    supabase
      .from("vw_relatorio_diario")
      .select("*")
      .order("ocorrido_em", { ascending: false })
      .limit(120),
    supabase.from("auditoria").select("*", { count: "exact", head: true }),
  ]);
  return {
    eventos: (rel.data ?? []) as EventoAuditoria[],
    total: total.count ?? 0,
  };
}

/* Sistema ---------------------------------------------------------------- */

export type Sugestao = {
  id: number;
  contexto: string;
  sugestao: string;
  sql_proposto: string | null;
  status: string;
  decidida_em: string | null;
};

export async function getSugestoes(): Promise<Sugestao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sugestoes_sistema")
    .select("id, contexto, sugestao, sql_proposto, status, decidida_em")
    .order("id", { ascending: true });
  return (data ?? []) as Sugestao[];
}

export async function getEstruturaBanco(): Promise<
  { tabela: string; registros: number }[]
> {
  const supabase = await createClient();
  const tabelas = [
    "clientes",
    "processos",
    "cliente_processo",
    "intimacoes",
    "prazos",
    "audiencias",
    "andamentos",
    "tarefas",
    "contratos",
    "pagamentos",
    "despesas",
    "estudos_caso",
    "auditoria",
    "migracoes",
    "sugestoes_sistema",
  ];
  const res = await Promise.all(
    tabelas.map((t) =>
      supabase.from(t).select("*", { count: "exact", head: true }),
    ),
  );
  return tabelas.map((t, i) => ({ tabela: t, registros: res[i].count ?? 0 }));
}

/* Busca global ----------------------------------------------------------- */

export type ResultadosBusca = {
  clientes: { id: string; nome: string; cpf: string | null; uf: string | null; situacao_prisional: string | null; unidade_prisional: string | null; favorito: boolean }[];
  processos: Processo[];
  intimacoes: Intimacao[];
};

export async function buscaGlobal(termoRaw: string): Promise<ResultadosBusca> {
  // sanitiza p/ uso em ilike e no .or() do PostgREST
  const termo = termoRaw.replace(/[,()*%]/g, " ").trim();
  if (termo.length < 2) return { clientes: [], processos: [], intimacoes: [] };
  const like = `%${termo}%`;
  const supabase = await createClient();

  const [cli, proc, intim] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, cpf, uf, situacao_prisional, unidade_prisional, favorito")
      .ilike("nome", like)
      .order("nome", { ascending: true })
      .limit(25),
    supabase
      .from("processos")
      .select(
        "id, numero_cnj, numero_registro_tribunal, tribunal, vara_comarca, uf, instancia, area, classe, status, responsavel, segredo_justica, cadastro_automatico, cliente_processo(papel,clientes(nome))",
      )
      .or(`numero_cnj.ilike.${like},numero_registro_tribunal.ilike.${like}`)
      .limit(25),
    supabase
      .from("intimacoes")
      .select(
        "id, origem, resumo, status, data_publicacao, data_ciencia, providencia, codigo_publicacao, processo_id, processos(numero_cnj,numero_registro_tribunal,tribunal,segredo_justica,cliente_processo(clientes(nome)))",
      )
      .ilike("resumo", like)
      .order("data_publicacao", { ascending: false, nullsFirst: false })
      .limit(25),
  ]);

  const processos: Processo[] = (proc.data ?? []).map((r) => {
    const cp = r.cliente_processo as unknown as (NestedCliente & { papel: string | null })[] | null;
    return {
      id: r.id as string,
      numero_cnj: r.numero_cnj as string | null,
      numero_registro: r.numero_registro_tribunal as string | null,
      tribunal: r.tribunal as string | null,
      vara_comarca: r.vara_comarca as string | null,
      uf: r.uf as string | null,
      instancia: r.instancia as string | null,
      area: r.area as string | null,
      classe: r.classe as string | null,
      status: r.status as string,
      responsavel: r.responsavel as string | null,
      segredo: Boolean(r.segredo_justica),
      cadastro_automatico: Boolean(r.cadastro_automatico),
      clientes: nomesClientes(cp),
      papel: cp?.[0]?.papel ?? null,
    };
  });

  const intimacoes: Intimacao[] = (intim.data ?? []).map((r) => {
    const p = r.processos as unknown as NestedProcesso;
    return {
      id: r.id as string,
      origem: r.origem as string | null,
      resumo: r.resumo as string | null,
      status: r.status as string,
      data_publicacao: r.data_publicacao as string | null,
      data_ciencia: r.data_ciencia as string | null,
      providencia: r.providencia as string | null,
      codigo_publicacao: r.codigo_publicacao as string | null,
      numero_cnj: p?.numero_cnj ?? null,
      numero_registro: p?.numero_registro_tribunal ?? null,
      tribunal: p?.tribunal ?? null,
      segredo: Boolean(p?.segredo_justica),
      processo_id: (r.processo_id as string) ?? null,
      orfa: r.processo_id == null,
      cliente: nomesClientes(p?.cliente_processo) || null,
    };
  });

  return {
    clientes: (cli.data ?? []) as ResultadosBusca["clientes"],
    processos,
    intimacoes,
  };
}

/* Estudos de caso (estratégia) ------------------------------------------- */

export type EstudoResumo = {
  id: string;
  titulo: string;
  tipo: string | null;
  status: string;
  cliente_id: string | null;
  cliente: string | null;
  atualizado_em: string | null;
  n_processos: number;
  n_objetivos: number;
  n_atingidos: number;
  proximo_marco: string | null;
};

export async function getEstudos(): Promise<EstudoResumo[]> {
  const supabase = await createClient();
  const { data: estudos } = await supabase
    .from("estudos_caso")
    .select("id, titulo, tipo, status, cliente_id, atualizado_em, clientes(nome)")
    .order("atualizado_em", { ascending: false })
    .limit(300);
  const ids = (estudos ?? []).map((e) => e.id as string);
  if (!ids.length) return [];

  const [vinc, objs] = await Promise.all([
    supabase.from("estudo_processo").select("estudo_id").in("estudo_id", ids),
    supabase.from("estudo_objetivos").select("estudo_id, status, data_alvo").in("estudo_id", ids),
  ]);

  const procPorEstudo = new Map<string, number>();
  for (const v of vinc.data ?? []) procPorEstudo.set(v.estudo_id as string, (procPorEstudo.get(v.estudo_id as string) ?? 0) + 1);

  const objPorEstudo = new Map<string, { total: number; atingidos: number; marco: string | null }>();
  for (const o of objs.data ?? []) {
    const k = o.estudo_id as string;
    const cur = objPorEstudo.get(k) ?? { total: 0, atingidos: 0, marco: null };
    cur.total += 1;
    if (o.status === "atingido") cur.atingidos += 1;
    const da = o.data_alvo as string | null;
    if (da && (o.status === "planejado" || o.status === "em_curso") && (!cur.marco || da < cur.marco)) cur.marco = da;
    objPorEstudo.set(k, cur);
  }

  return (estudos ?? []).map((e): EstudoResumo => {
    const o = objPorEstudo.get(e.id as string);
    return {
      id: e.id as string,
      titulo: e.titulo as string,
      tipo: e.tipo as string | null,
      status: e.status as string,
      cliente_id: e.cliente_id as string | null,
      cliente: (e.clientes as { nome?: string } | null)?.nome ?? null,
      atualizado_em: e.atualizado_em as string | null,
      n_processos: procPorEstudo.get(e.id as string) ?? 0,
      n_objetivos: o?.total ?? 0,
      n_atingidos: o?.atingidos ?? 0,
      proximo_marco: o?.marco ?? null,
    };
  });
}

export type EstudoVinculo = {
  id: string;
  processo_id: string;
  diagnostico: string | null;
  estrategia: string | null;
  prioridade: string | null;
  processo: string; // rótulo (cnj/registro)
  area: string | null;
  instancia: string | null;
  status: string | null;
  segredo: boolean;
};

export type EstudoObjetivo = {
  id: string;
  objetivo: string;
  beneficio_alvo: string | null;
  data_alvo: string | null;
  status: string;
  resultado: string | null;
  resultado_em: string | null;
  observacoes: string | null;
  processo_id: string | null;
  processo_instrumento_id: string | null;
  alvo: string | null;
  instrumento: string | null;
};

export type EstudoDetalhe = {
  id: string;
  titulo: string;
  tipo: string | null;
  status: string;
  conteudo: string | null;
  teses: string | null;
  jurisprudencia: string | null;
  drive_file_id: string | null;
  cliente_id: string | null;
  cliente: string | null;
  atualizado_em: string | null;
  vinculos: EstudoVinculo[];
  objetivos: EstudoObjetivo[];
};

function rotuloProc(p: { numero_cnj?: string | null; numero_registro_tribunal?: string | null } | null | undefined): string {
  if (!p) return "—";
  return (p.numero_cnj as string) || (p.numero_registro_tribunal ? "reg " + p.numero_registro_tribunal : "—");
}

export async function getEstudoDetalhe(id: string): Promise<EstudoDetalhe | null> {
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("estudos_caso")
    .select("id, titulo, tipo, status, conteudo, teses, jurisprudencia, drive_file_id, cliente_id, atualizado_em, clientes(nome)")
    .eq("id", id)
    .single();
  if (!e) return null;

  const [vinc, objs] = await Promise.all([
    supabase
      .from("estudo_processo")
      .select("id, processo_id, diagnostico, estrategia, prioridade, processos(numero_cnj, numero_registro_tribunal, area, instancia, status, segredo_justica)")
      .eq("estudo_id", id),
    supabase
      .from("estudo_objetivos")
      .select("id, objetivo, beneficio_alvo, data_alvo, status, resultado, resultado_em, observacoes, processo_id, processo_instrumento_id")
      .eq("estudo_id", id)
      .order("data_alvo", { ascending: true }),
  ]);

  // Resolve rótulos dos processos referenciados nos objetivos (alvo/instrumento).
  const procIds = new Set<string>();
  for (const o of objs.data ?? []) {
    if (o.processo_id) procIds.add(o.processo_id as string);
    if (o.processo_instrumento_id) procIds.add(o.processo_instrumento_id as string);
  }
  const rotulos = new Map<string, string>();
  if (procIds.size) {
    const { data: ps } = await supabase
      .from("processos")
      .select("id, numero_cnj, numero_registro_tribunal")
      .in("id", Array.from(procIds));
    for (const p of ps ?? []) rotulos.set(p.id as string, rotuloProc(p));
  }

  const vinculos: EstudoVinculo[] = (vinc.data ?? []).map((v) => {
    const p = v.processos as unknown as Record<string, unknown> | null;
    return {
      id: v.id as string,
      processo_id: v.processo_id as string,
      diagnostico: v.diagnostico as string | null,
      estrategia: v.estrategia as string | null,
      prioridade: v.prioridade as string | null,
      processo: rotuloProc(p as never),
      area: (p?.area as string) ?? null,
      instancia: (p?.instancia as string) ?? null,
      status: (p?.status as string) ?? null,
      segredo: Boolean(p?.segredo_justica),
    };
  });

  const objetivos: EstudoObjetivo[] = (objs.data ?? []).map((o) => ({
    id: o.id as string,
    objetivo: o.objetivo as string,
    beneficio_alvo: o.beneficio_alvo as string | null,
    data_alvo: o.data_alvo as string | null,
    status: o.status as string,
    resultado: o.resultado as string | null,
    resultado_em: o.resultado_em as string | null,
    observacoes: o.observacoes as string | null,
    processo_id: o.processo_id as string | null,
    processo_instrumento_id: o.processo_instrumento_id as string | null,
    alvo: o.processo_id ? rotulos.get(o.processo_id as string) ?? null : null,
    instrumento: o.processo_instrumento_id ? rotulos.get(o.processo_instrumento_id as string) ?? null : null,
  }));

  return {
    id: e.id as string,
    titulo: e.titulo as string,
    tipo: e.tipo as string | null,
    status: e.status as string,
    conteudo: e.conteudo as string | null,
    teses: e.teses as string | null,
    jurisprudencia: e.jurisprudencia as string | null,
    drive_file_id: e.drive_file_id as string | null,
    cliente_id: e.cliente_id as string | null,
    cliente: (e.clientes as { nome?: string } | null)?.nome ?? null,
    atualizado_em: e.atualizado_em as string | null,
    vinculos,
    objetivos,
  };
}

/** Estudos vinculados a um processo (para o detalhe do processo). */
export async function getEstudosDoProcesso(processo_id: string): Promise<
  { estudo_id: string; titulo: string; status: string; cliente: string | null; diagnostico: string | null; estrategia: string | null; prioridade: string | null }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("estudo_processo")
    .select("diagnostico, estrategia, prioridade, estudos_caso(id, titulo, status, clientes(nome))")
    .eq("processo_id", processo_id);
  return (data ?? []).map((v) => {
    const e = v.estudos_caso as unknown as Record<string, unknown> | null;
    return {
      estudo_id: (e?.id as string) ?? "",
      titulo: (e?.titulo as string) ?? "—",
      status: (e?.status as string) ?? "",
      cliente: (e?.clientes as { nome?: string } | null)?.nome ?? null,
      diagnostico: v.diagnostico as string | null,
      estrategia: v.estrategia as string | null,
      prioridade: v.prioridade as string | null,
    };
  });
}

/* Execução penal (aba Execução na ficha do cliente) ---------------------- */

export type ExecSituacao = {
  data_atestado: string | null;
  regime_atual: string | null;
  pena_total_texto: string | null;
  pena_cumprida_texto: string | null;
  pena_remanescente_texto: string | null;
  pena_total_dias: number | null;
  pena_cumprida_dias: number | null;
  pena_remanescente_dias: number | null;
  dias_remidos: number | null;
  dias_perdidos: number | null;
  data_base_progressao: string | null;
  data_base_livramento: string | null;
  data_prevista_progressao: string | null;
  dias_para_progressao: number | null;
  data_prevista_livramento: string | null;
  dias_para_livramento: number | null;
  data_termino_pena: string | null;
  fonte: string | null;
  versao: number; // nº de atestados (snapshots) acumulados — v1, v2, …
  processo_id: string | null;
  // PEC (processo de execução) que consolida a pena — cabeçalho da aba
  pec_cnj: string | null;
  pec_tribunal: string | null;
  pec_instancia: string | null;
  segredo: boolean;
  progresso: number | null; // % pena cumprida sobre total (0-100)
};

export type ExecAtestado = {
  id: string;
  data_atestado: string | null;
  fonte: string | null;
  regime_atual: string | null;
  pena_cumprida_texto: string | null;
  pena_remanescente_texto: string | null;
  dias_remidos: number | null;
  dias_perdidos: number | null;
  data_prevista_progressao: string | null;
  data_prevista_livramento: string | null;
  data_termino_pena: string | null;
  drive_file_id: string | null;
  observacoes: string | null;
};

export type ExecCondenacao = {
  numero_processo_origem: string | null;
  juizo_vara: string | null;
  uf: string | null;
  artigo: string | null;
  lei: string | null;
  descricao_crime: string | null;
  pena_texto: string | null;
  regime_imposto: string | null;
  fracao_progressao: string | null;
  fracao_livramento: string | null;
  hediondo: boolean;
  reincidente: boolean;
  situacao: string | null;
  data_sentenca: string | null;
  data_transito: string | null;
  processo_origem_id: string | null;
};

export type ExecEstrategia = {
  estudo_id: string;
  titulo: string;
  tipo: string | null;
  estudo_status: string;
  objetivos_planejados: number;
  objetivos_em_curso: number;
  objetivos_atingidos: number;
  objetivos_frustrados: number;
  proximo_marco: string | null;
};

export type ExecObjetivo = {
  objetivo_id: string;
  objetivo: string;
  beneficio_alvo: string | null;
  status: string;
  data_alvo: string | null;
  resultado: string | null;
  alvo_cnj: string | null;
  instrumento_cnj: string | null;
  instrumento_area: string | null;
  instrumento_instancia: string | null;
};

export type ExecucaoCliente = {
  temDados: boolean;
  situacao: ExecSituacao | null;
  atestados: ExecAtestado[];
  condenacoes: ExecCondenacao[];
  estrategia: ExecEstrategia[];
  objetivos: ExecObjetivo[];
};

export async function getExecucaoCliente(cliente_id: string): Promise<ExecucaoCliente> {
  const supabase = await createClient();
  const [sit, atest, cond, estr, obj] = await Promise.all([
    supabase.from("vw_situacao_executoria_atual").select("*").eq("cliente_id", cliente_id).maybeSingle(),
    supabase
      .from("situacao_executoria")
      .select("id, data_atestado, fonte, regime_atual, pena_total_dias, pena_cumprida_dias, pena_remanescente_dias, pena_cumprida_texto, pena_remanescente_texto, dias_remidos, dias_perdidos, data_base_progressao, data_base_livramento, data_prevista_progressao, data_prevista_livramento, data_termino_pena, drive_file_id, observacoes")
      .eq("cliente_id", cliente_id)
      .order("data_atestado", { ascending: false })
      .limit(60),
    supabase.from("vw_condenacoes_cliente").select("*").eq("cliente_id", cliente_id),
    supabase.from("vw_estrategia_cliente").select("*").eq("cliente_id", cliente_id),
    supabase.from("vw_objetivos_instrumento").select("*").eq("cliente_id", cliente_id),
  ]);

  let segredo = false;
  let pec: { numero_cnj: string | null; tribunal: string | null; instancia: string | null } | null = null;
  const sitRow = sit.data as Record<string, unknown> | null;
  if (sitRow?.processo_id) {
    const { data: p } = await supabase
      .from("processos")
      .select("segredo_justica, numero_cnj, tribunal, instancia")
      .eq("id", sitRow.processo_id as string)
      .maybeSingle();
    segredo = Boolean(p?.segredo_justica);
    if (p) pec = { numero_cnj: p.numero_cnj ?? null, tribunal: p.tribunal ?? null, instancia: p.instancia ?? null };
  }

  const atestadosRaw = (atest.data ?? []) as (ExecAtestado & { pena_total_dias?: number | null; pena_cumprida_dias?: number | null; pena_remanescente_dias?: number | null; data_base_progressao?: string | null; data_base_livramento?: string | null })[];
  // O atestado mais recente equivale à situação atual da view; usa-o para a barra de progresso.
  const atual = atestadosRaw[0];
  const total = atual?.pena_total_dias ?? null;
  const cumprida = atual?.pena_cumprida_dias ?? null;
  const progresso = total && total > 0 && cumprida != null ? Math.min(100, Math.round((cumprida / total) * 100)) : null;

  const situacao: ExecSituacao | null = sitRow
    ? {
        data_atestado: sitRow.data_atestado as string | null,
        regime_atual: sitRow.regime_atual as string | null,
        pena_total_texto: sitRow.pena_total_texto as string | null,
        pena_cumprida_texto: sitRow.pena_cumprida_texto as string | null,
        pena_remanescente_texto: sitRow.pena_remanescente_texto as string | null,
        pena_total_dias: total,
        pena_cumprida_dias: cumprida,
        pena_remanescente_dias: (atual?.pena_remanescente_dias ?? null),
        dias_remidos: sitRow.dias_remidos as number | null,
        dias_perdidos: sitRow.dias_perdidos as number | null,
        data_base_progressao: (atual?.data_base_progressao ?? null),
        data_base_livramento: (atual?.data_base_livramento ?? null),
        data_prevista_progressao: sitRow.data_prevista_progressao as string | null,
        dias_para_progressao: sitRow.dias_para_progressao as number | null,
        data_prevista_livramento: sitRow.data_prevista_livramento as string | null,
        dias_para_livramento: sitRow.dias_para_livramento as number | null,
        data_termino_pena: sitRow.data_termino_pena as string | null,
        fonte: (atual?.fonte ?? null),
        versao: atestadosRaw.length,
        processo_id: sitRow.processo_id as string | null,
        pec_cnj: pec?.numero_cnj ?? null,
        pec_tribunal: pec?.tribunal ?? null,
        pec_instancia: pec?.instancia ?? null,
        segredo,
        progresso,
      }
    : null;

  const atestados = atestadosRaw as ExecAtestado[];
  const condenacoes = (cond.data ?? []) as unknown as ExecCondenacao[];
  const estrategia = (estr.data ?? []) as unknown as ExecEstrategia[];
  const objetivos = (obj.data ?? []) as unknown as ExecObjetivo[];

  return {
    temDados: Boolean(situacao) || atestados.length > 0 || condenacoes.length > 0 || estrategia.length > 0 || objetivos.length > 0,
    situacao,
    atestados,
    condenacoes,
    estrategia,
    objetivos,
  };
}

/* Documentos (acervo do Drive ligado ao caso) ---------------------------- */

export type Documento = {
  id: string;
  nome: string | null;
  tipo: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  origem: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  processo_id: string | null;
  numero_cnj: string | null;
  numero_registro: string | null;
  segredo: boolean;
  intimacao_id: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  contrato_id: string | null;
  pagamento_id: string | null;
  cadastro_automatico: boolean;
  cadastrado_por: string | null;
  criado_em: string | null;
};

function mapDocumento(r: Record<string, unknown>): Documento {
  return {
    id: r.id as string,
    nome: (r.nome as string) ?? null,
    tipo: (r.tipo as string) ?? "outro",
    mime_type: (r.mime_type as string) ?? null,
    tamanho_bytes: r.tamanho_bytes == null ? null : Number(r.tamanho_bytes),
    origem: (r.origem as string) ?? null,
    drive_file_id: (r.drive_file_id as string) ?? null,
    drive_url: (r.drive_url as string) ?? null,
    processo_id: (r.processo_id as string) ?? null,
    numero_cnj: (r.numero_cnj as string) ?? null,
    numero_registro: (r.numero_registro_tribunal as string) ?? null,
    segredo: Boolean(r.segredo_justica),
    intimacao_id: (r.intimacao_id as string) ?? null,
    cliente_id: (r.cliente_id as string) ?? null,
    cliente_nome: (r.cliente_nome as string) ?? null,
    contrato_id: (r.contrato_id as string) ?? null,
    pagamento_id: (r.pagamento_id as string) ?? null,
    cadastro_automatico: Boolean(r.cadastro_automatico),
    cadastrado_por: (r.cadastrado_por as string) ?? null,
    criado_em: (r.criado_em as string) ?? null,
  };
}

/** Documentos do Drive vinculados a um processo (registro/auditoria do acervo). */
export async function getDocumentosProcesso(processo_id: string): Promise<Documento[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_documentos_processo")
    .select("*")
    .eq("processo_id", processo_id)
    .order("criado_em", { ascending: false });
  return (data ?? []).map((r) => mapDocumento(r as Record<string, unknown>));
}

/** Documentos do Drive vinculados diretamente a um cliente. */
export async function getDocumentosCliente(cliente_id: string): Promise<Documento[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_documentos_processo")
    .select("*")
    .eq("cliente_id", cliente_id)
    .order("criado_em", { ascending: false });
  return (data ?? []).map((r) => mapDocumento(r as Record<string, unknown>));
}

/** Documentos financeiros do Drive vinculados a um contrato (recibos, comprovantes…). */
export async function getDocumentosContrato(contrato_id: string): Promise<Documento[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_documentos_processo")
    .select("*")
    .eq("contrato_id", contrato_id)
    .order("criado_em", { ascending: false });
  return (data ?? []).map((r) => mapDocumento(r as Record<string, unknown>));
}

/* Merge / duplicados ----------------------------------------------------- */

/** Vínculos (o que migra/se religa) de um membro de cluster. */
export type ClienteVinculos = { n_processos: number; n_contratos: number; n_docs: number };

export type ClienteDuplicadoCluster = {
  nome_normalizado: string;
  qtd: number;
  algum_com_cpf: boolean;
  cpfs_distintos: number;
  ids: string[];
  nomes: string[];
  cpfs: (string | null)[];
  primeiro_cadastro: string | null;
  ultimo_cadastro: string | null;
  // Por membro (alinhado a `ids`): vínculos + proveniência, para os cards.
  vinculos: ClienteVinculos[];
  criados: (string | null)[];
  cadastrados_por: (string | null)[];
};

export async function getClientesDuplicados(): Promise<ClienteDuplicadoCluster[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("vw_clientes_duplicados").select("*");
  const clusters = (data ?? []).map((r) => ({
    nome_normalizado: r.nome_normalizado as string,
    qtd: Number(r.qtd ?? 0),
    algum_com_cpf: Boolean(r.algum_com_cpf),
    cpfs_distintos: Number(r.cpfs_distintos ?? 0),
    ids: (r.ids as string[]) ?? [],
    nomes: (r.nomes as string[]) ?? [],
    cpfs: (r.cpfs as (string | null)[]) ?? [],
    primeiro_cadastro: (r.primeiro_cadastro as string) ?? null,
    ultimo_cadastro: (r.ultimo_cadastro as string) ?? null,
  }));

  // Enriquece cada membro com vínculos + proveniência (uma query só, batch por id).
  const todosIds = clusters.flatMap((c) => c.ids);
  const porId = new Map<string, { v: ClienteVinculos; criado: string | null; por: string | null }>();
  if (todosIds.length) {
    const { data: vinc } = await supabase
      .from("vw_cliente_vinculos")
      .select("cliente_id, criado_em, cadastrado_por, n_processos, n_contratos, n_docs")
      .in("cliente_id", todosIds);
    for (const r of vinc ?? []) {
      porId.set(r.cliente_id as string, {
        v: { n_processos: Number(r.n_processos ?? 0), n_contratos: Number(r.n_contratos ?? 0), n_docs: Number(r.n_docs ?? 0) },
        criado: (r.criado_em as string) ?? null,
        por: (r.cadastrado_por as string) ?? null,
      });
    }
  }

  return clusters.map((c): ClienteDuplicadoCluster => ({
    ...c,
    vinculos: c.ids.map((id) => porId.get(id)?.v ?? { n_processos: 0, n_contratos: 0, n_docs: 0 }),
    criados: c.ids.map((id) => porId.get(id)?.criado ?? null),
    cadastrados_por: c.ids.map((id) => porId.get(id)?.por ?? null),
  }));
}

export type ProcessoReconciliacao = {
  id: string;
  numero_registro_tribunal: string | null;
  tribunal: string | null;
  uf: string | null;
  area: string | null;
  instancia: string | null;
  segredo_justica: boolean;
  clientes: string | null;
  criado_em: string | null;
  cadastrado_por: string | null;
  n_intim: number;
  n_prazos: number;
  n_andam: number;
  n_docs: number;
};

export async function getProcessosReconciliacao(): Promise<ProcessoReconciliacao[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("vw_reconciliacao_registro_full").select("*");
  return (data ?? []).map((r): ProcessoReconciliacao => ({
    id: r.id as string,
    numero_registro_tribunal: (r.numero_registro_tribunal as string) ?? null,
    tribunal: (r.tribunal as string) ?? null,
    uf: (r.uf as string) ?? null,
    area: (r.area as string) ?? null,
    instancia: (r.instancia as string) ?? null,
    segredo_justica: Boolean(r.segredo_justica),
    clientes: (r.clientes as string) ?? null,
    criado_em: (r.criado_em as string) ?? null,
    cadastrado_por: (r.cadastrado_por as string) ?? null,
    n_intim: Number(r.n_intim ?? 0),
    n_prazos: Number(r.n_prazos ?? 0),
    n_andam: Number(r.n_andam ?? 0),
    n_docs: Number(r.n_docs ?? 0),
  }));
}

/** Contadores do topo do painel de duplicados. */
export type DuplicadosContadores = {
  processos_revisar: number;
  clientes_revisar: number;
  mesclados_30d: number;
  vinculos_religados: number;
};

export async function getDuplicadosContadores(): Promise<DuplicadosContadores> {
  const supabase = await createClient();
  const { data } = await supabase.from("vw_duplicados_contadores").select("*").single();
  return {
    processos_revisar: Number(data?.processos_revisar ?? 0),
    clientes_revisar: Number(data?.clientes_revisar ?? 0),
    mesclados_30d: Number(data?.mesclados_30d ?? 0),
    vinculos_religados: Number(data?.vinculos_religados ?? 0),
  };
}

/** Tombstones já resolvidos (merge concluído) — derivado da auditoria. */
export type TombstoneResolvido = {
  id: string;
  reg_antigo: string | null;
  cnj_antigo: string | null;
  canonico_ident: string | null;
  cliente: string | null;
  vinculos: number;
  resolvido_em: string | null;
  origem: string | null;
};

export async function getTombstonesResolvidos(limit = 8): Promise<TombstoneResolvido[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_tombstones_resolvidos")
    .select("*")
    .order("resolvido_em", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []).map((r): TombstoneResolvido => ({
    id: r.id as string,
    reg_antigo: (r.reg_antigo as string) ?? null,
    cnj_antigo: (r.cnj_antigo as string) ?? null,
    canonico_ident: (r.canonico_ident as string) ?? null,
    cliente: (r.cliente as string) ?? null,
    vinculos: Number(r.vinculos ?? 0),
    resolvido_em: (r.resolvido_em as string) ?? null,
    origem: (r.origem as string) ?? null,
  }));
}

/* ============== Itens de uma varredura (drill-down dos tiles) ============== */

export type VarreduraTipo = "intimacoes" | "andamentos" | "prazos";

export type VarreduraItem = {
  id: string;
  href: string;
  titulo: string;
  cliente: string | null;
  numero_cnj: string | null;
  data: string | null;
  tag: string | null;
};

const VARREDURA_TITULO: Record<VarreduraTipo, string> = {
  intimacoes: "Intimações novas",
  andamentos: "Andamentos novos",
  prazos: "Prazos criados",
};

/**
 * Reconstrói os itens contabilizados na ÚLTIMA varredura. Como a tabela
 * `varreduras` guarda apenas contadores, usamos a janela de inserção: itens
 * criados em ±30 min do horário da varredura — o que reproduz exatamente os
 * números dos tiles na prática.
 */
export async function getVarreduraItens(
  tipo: VarreduraTipo,
): Promise<{ titulo: string; quando: string | null; itens: VarreduraItem[] }> {
  const supabase = await createClient();
  const titulo = VARREDURA_TITULO[tipo];

  const { data: v } = await supabase
    .from("varreduras")
    .select("criado_em")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!v?.criado_em) return { titulo, quando: null, itens: [] };

  const base = new Date(v.criado_em as string).getTime();
  const lo = new Date(base - 30 * 60_000).toISOString();
  const hi = new Date(base + 30 * 60_000).toISOString();
  const quando = v.criado_em as string;
  const procSel = "processos(numero_cnj,cliente_processo(clientes(nome)))";

  if (tipo === "intimacoes") {
    const { data } = await supabase
      .from("intimacoes")
      .select(`id, resumo, origem, status, data_publicacao, ${procSel}`)
      .gte("criado_em", lo)
      .lte("criado_em", hi)
      .order("data_publicacao", { ascending: false });
    const itens = (data ?? []).map((r) => {
      const p = r.processos as unknown as NestedProcesso;
      return {
        id: r.id as string,
        href: linkPara("intimacao", r.id as string),
        titulo: (r.resumo as string | null)?.trim() || "(sem resumo)",
        cliente: nomesClientes(p?.cliente_processo) || null,
        numero_cnj: p?.numero_cnj ?? null,
        data: (r.data_publicacao as string | null) ?? null,
        tag: (r.origem as string | null) ?? (r.status as string | null) ?? null,
      };
    });
    return { titulo, quando, itens };
  }

  if (tipo === "prazos") {
    const { data } = await supabase
      .from("prazos")
      .select(`id, ato, status, data_fatal, ${procSel}`)
      .gte("criado_em", lo)
      .lte("criado_em", hi)
      .order("data_fatal", { ascending: true });
    const itens = (data ?? []).map((r) => {
      const p = r.processos as unknown as NestedProcesso;
      return {
        id: r.id as string,
        href: linkPara("prazo", r.id as string),
        titulo: (r.ato as string | null) || "(prazo)",
        cliente: nomesClientes(p?.cliente_processo) || null,
        numero_cnj: p?.numero_cnj ?? null,
        data: (r.data_fatal as string | null) ?? null,
        tag: (r.status as string | null) ?? null,
      };
    });
    return { titulo, quando, itens };
  }

  // andamentos — sem página própria: o link leva ao processo
  const { data } = await supabase
    .from("andamentos")
    .select(`id, tipo, descricao, data, processo_id, ${procSel}`)
    .gte("criado_em", lo)
    .lte("criado_em", hi)
    .order("data", { ascending: false });
  const itens = (data ?? []).map((r) => {
    const p = r.processos as unknown as NestedProcesso;
    const procId = r.processo_id as string | null;
    return {
      id: r.id as string,
      href: procId ? linkPara("processo", procId) : "#",
      titulo: (r.descricao as string | null)?.trim() || (r.tipo as string | null) || "(andamento)",
      cliente: nomesClientes(p?.cliente_processo) || null,
      numero_cnj: p?.numero_cnj ?? null,
      data: (r.data as string | null) ?? null,
      tag: (r.tipo as string | null) ?? null,
    };
  });
  return { titulo, quando, itens };
}

/* ============================ Compromissos ============================ */

export type Compromisso = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_hora: string;
  local: string | null;
  responsavel: string | null;
  status: string;
  cliente_id: string | null;
  cliente: string | null;
  processo_id: string | null;
  numero_cnj: string | null;
  numero_registro: string | null;
  segredo: boolean;
  tarefa_id: string | null;
};

export async function getCompromissoPorId(id: string): Promise<Compromisso | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("compromissos")
    .select(
      "id, titulo, descricao, data_hora, local, responsavel, status, cliente_id, processo_id, tarefa_id, clientes(nome), processos(numero_cnj,numero_registro_tribunal,segredo_justica,cliente_processo(clientes(nome)))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const p = r.processos as unknown as NestedProcesso;
  const cliDireto = (r.clientes as unknown as { nome: string } | null)?.nome ?? null;
  return {
    id: r.id as string,
    titulo: r.titulo as string,
    descricao: (r.descricao as string | null) ?? null,
    data_hora: r.data_hora as string,
    local: (r.local as string | null) ?? null,
    responsavel: (r.responsavel as string | null) ?? null,
    status: r.status as string,
    cliente_id: (r.cliente_id as string | null) ?? null,
    cliente: cliDireto ?? (nomesClientes(p?.cliente_processo) || null),
    processo_id: (r.processo_id as string | null) ?? null,
    numero_cnj: p?.numero_cnj ?? null,
    numero_registro: p?.numero_registro_tribunal ?? null,
    segredo: Boolean(p?.segredo_justica),
    tarefa_id: (r.tarefa_id as string | null) ?? null,
  };
}

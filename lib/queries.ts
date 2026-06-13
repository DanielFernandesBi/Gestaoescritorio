import { createClient } from "@/lib/supabase/server";
import type { Badges } from "@/lib/nav";

/** Badges da navegação — contagens ao vivo do banco. */
export async function getBadges(): Promise<Badges> {
  const supabase = await createClient();

  const [
    validacao,
    prazos,
    audiencias,
    intimacoes,
    tarefas,
    processos,
    clientes,
  ] = await Promise.all([
    supabase.from("vw_pendentes_validacao").select("*", { count: "exact", head: true }),
    supabase.from("prazos").select("*", { count: "exact", head: true }).eq("status", "aberto"),
    supabase.from("audiencias").select("*", { count: "exact", head: true }).eq("status", "designada"),
    supabase.from("intimacoes").select("*", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("tarefas").select("*", { count: "exact", head: true }).in("status", ["pendente", "em_andamento"]),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true),
  ]);

  return {
    validacao: validacao.count ?? 0,
    prazos: prazos.count ?? 0,
    audiencias: audiencias.count ?? 0,
    intimacoes: intimacoes.count ?? 0,
    tarefas: tarefas.count ?? 0,
    processos: processos.count ?? 0,
    clientes: clientes.count ?? 0,
  };
}

export async function getUserEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.email as string | undefined) ?? null;
}

export function iniciaisDoEmail(email: string | null): string {
  if (!email) return "··";
  const nome = email.split("@")[0];
  const partes = nome.split(/[.\-_]/).filter(Boolean);
  if (partes.length >= 2) {
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }
  return nome.slice(0, 2).toUpperCase();
}

/* ===================== PAINEL ===================== */

export type PrazoAberto = {
  prazo_id: string;
  processo_id: string;
  data_fatal: string;
  data_interna: string;
  ato: string;
  responsavel: string | null;
  numero_cnj: string | null;
  tribunal: string | null;
  vara_comarca: string | null;
  clientes: string | null;
  dias_restantes: number;
};

export type PendenteValidacao = {
  tipo: string;
  id: string;
  numero_cnj: string | null;
  descricao: string;
  data_relevante: string | null;
  cadastrado_por: string | null;
};

export type IntimacaoOrfa = {
  id: string;
  criado_em: string;
  origem: string | null;
  resumo: string | null;
  teor_inicio: string | null;
};

export type AgendaItem = {
  tipo: string;
  data: string;
  descricao: string;
  numero_cnj: string | null;
  responsavel: string | null;
};

export type PainelData = {
  stats: {
    prazos_abertos: number;
    intimacoes_pendentes: number;
    intimacoes_orfas: number;
    processos_ativos: number;
    processos_sem_cnj: number;
    processos_sigilosos: number;
    parcelas_pendentes: number;
    valor_a_receber: number;
    auditoria_total: number;
    processos_auto: number;
    clientes_auto: number;
    andamentos_orfaos: number;
    pendentes_validacao: number;
  };
  prazos: PrazoAberto[];
  validacao: PendenteValidacao[];
  orfas: IntimacaoOrfa[];
  agenda: AgendaItem[];
};

export async function getPainelData(): Promise<PainelData> {
  const supabase = await createClient();

  const [
    prazosAbertos,
    intimPend,
    orfasCount,
    procAtivos,
    procSemCnj,
    procSigilosos,
    procAuto,
    cliAuto,
    auditoria,
    andOrfaos,
    pendValid,
    financeiro,
    prazos,
    validacao,
    orfas,
    agenda,
  ] = await Promise.all([
    supabase.from("prazos").select("*", { count: "exact", head: true }).eq("status", "aberto"),
    supabase.from("intimacoes").select("*", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("vw_intimacoes_orfas").select("*", { count: "exact", head: true }),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("processos").select("*", { count: "exact", head: true }).is("numero_cnj", null),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("segredo_justica", true),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("cadastro_automatico", true),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("cadastro_automatico", true),
    supabase.from("auditoria").select("*", { count: "exact", head: true }),
    supabase.from("vw_andamentos_orfaos").select("*", { count: "exact", head: true }),
    supabase.from("vw_pendentes_validacao").select("*", { count: "exact", head: true }),
    supabase.from("vw_financeiro_pendente").select("valor"),
    supabase.from("vw_prazos_abertos").select("*").order("data_fatal", { ascending: true }).limit(6),
    supabase.from("vw_pendentes_validacao").select("*").order("criado_em", { ascending: false }).limit(8),
    supabase.from("vw_intimacoes_orfas").select("*").order("criado_em", { ascending: false }).limit(6),
    supabase.from("vw_agenda_semana").select("*").order("data", { ascending: true }).limit(12),
  ]);

  const valorAReceber = (financeiro.data ?? []).reduce(
    (s: number, r: { valor: number | string | null }) => s + Number(r.valor ?? 0),
    0,
  );

  return {
    stats: {
      prazos_abertos: prazosAbertos.count ?? 0,
      intimacoes_pendentes: intimPend.count ?? 0,
      intimacoes_orfas: orfasCount.count ?? 0,
      processos_ativos: procAtivos.count ?? 0,
      processos_sem_cnj: procSemCnj.count ?? 0,
      processos_sigilosos: procSigilosos.count ?? 0,
      parcelas_pendentes: financeiro.data?.length ?? 0,
      valor_a_receber: valorAReceber,
      auditoria_total: auditoria.count ?? 0,
      processos_auto: procAuto.count ?? 0,
      clientes_auto: cliAuto.count ?? 0,
      andamentos_orfaos: andOrfaos.count ?? 0,
      pendentes_validacao: pendValid.count ?? 0,
    },
    prazos: (prazos.data ?? []) as PrazoAberto[],
    validacao: (validacao.data ?? []) as PendenteValidacao[],
    orfas: (orfas.data ?? []) as IntimacaoOrfa[],
    agenda: (agenda.data ?? []) as AgendaItem[],
  };
}

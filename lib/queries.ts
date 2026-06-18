import { createClient } from "@/lib/supabase/server";
import { diasAte } from "@/lib/format";
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
    alertas,
    dupClientes,
    dupProcessos,
    pecas,
  ] = await Promise.all([
    supabase.from("vw_pendentes_validacao").select("*", { count: "exact", head: true }),
    supabase.from("prazos").select("*", { count: "exact", head: true }).eq("status", "aberto"),
    supabase.from("audiencias").select("*", { count: "exact", head: true }).eq("status", "designada"),
    supabase.from("intimacoes").select("*", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("tarefas").select("*", { count: "exact", head: true }).in("status", ["pendente", "em_andamento"]),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("vw_processos_movimentacao").select("*", { count: "exact", head: true }).gte("dias_parado", 30),
    supabase.from("vw_clientes_duplicados").select("*", { count: "exact", head: true }),
    supabase.from("vw_reconciliacao_registro").select("*", { count: "exact", head: true }),
    supabase.from("vw_pecas_pendentes").select("*", { count: "exact", head: true }),
  ]);

  return {
    validacao: validacao.count ?? 0,
    prazos: prazos.count ?? 0,
    audiencias: audiencias.count ?? 0,
    intimacoes: intimacoes.count ?? 0,
    tarefas: tarefas.count ?? 0,
    processos: processos.count ?? 0,
    clientes: clientes.count ?? 0,
    alertas: alertas.count ?? 0,
    duplicados: (dupClientes.count ?? 0) + (dupProcessos.count ?? 0),
    pecas: pecas.count ?? 0,
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
  ref_id: string;
  processo_id: string | null;
  cliente: string | null;
};

export type MovRecente = {
  id: string;
  data: string;
  tipo: string;
  origem: string | null;
  numero_cnj: string | null;
  numero_registro: string | null;
  processo_id: string | null;
  clientes: string | null;
  segredo: boolean;
};

export type EventoRecente = {
  ocorrido_em: string;
  tabela: string;
  operacao: string;
  referencia: string | null;
  registro_id: string | null;
};

export type CadastroAuto = {
  tipo: "processo" | "cliente";
  id: string;
  label: string;
  criado_em: string | null;
};

export type TarefaVencida = {
  id: string;
  titulo: string;
  data_limite: string | null;
  responsavel: string | null;
  dias: number;
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
  movimentacoes: MovRecente[];
  relatorio24h: EventoRecente[];
  cadastrosAuto: CadastroAuto[];
  tarefasVencidas: TarefaVencida[];
};

export async function getPainelData(): Promise<PainelData> {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

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
    movimentacoes,
    relatorio24h,
    procAutoHoje,
    cliAutoHoje,
    tarefasVenc,
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
    supabase.from("vw_movimentacoes_recentes").select("*").order("data", { ascending: false }).limit(6),
    supabase.from("vw_relatorio_diario").select("*").order("ocorrido_em", { ascending: false }).limit(10),
    supabase.from("processos").select("id, numero_cnj, numero_registro_tribunal, criado_em").eq("cadastro_automatico", true).gte("criado_em", hoje).order("criado_em", { ascending: false }).limit(20),
    supabase.from("clientes").select("id, nome, criado_em").eq("cadastro_automatico", true).gte("criado_em", hoje).order("criado_em", { ascending: false }).limit(20),
    supabase.from("tarefas").select("id, titulo, data_limite, responsavel").in("status", ["pendente", "em_andamento"]).lt("data_limite", hoje).order("data_limite", { ascending: true }).limit(12),
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
    movimentacoes: ((movimentacoes.data ?? []) as Record<string, unknown>[]).map((r): MovRecente => ({
      id: r.id as string,
      data: r.data as string,
      tipo: r.tipo as string,
      origem: (r.origem as string) ?? null,
      numero_cnj: (r.numero_cnj as string) ?? null,
      numero_registro: (r.numero_registro_tribunal as string) ?? null,
      processo_id: (r.processo_id as string) ?? null,
      clientes: (r.clientes as string) ?? null,
      segredo: Boolean(r.segredo_justica),
    })),
    relatorio24h: (relatorio24h.data ?? []) as EventoRecente[],
    cadastrosAuto: [
      ...((procAutoHoje.data ?? []) as Record<string, unknown>[]).map((r): CadastroAuto => ({
        tipo: "processo",
        id: r.id as string,
        label: (r.numero_cnj as string) || (r.numero_registro_tribunal ? "reg " + r.numero_registro_tribunal : "processo sem nº"),
        criado_em: (r.criado_em as string) ?? null,
      })),
      ...((cliAutoHoje.data ?? []) as Record<string, unknown>[]).map((r): CadastroAuto => ({
        tipo: "cliente",
        id: r.id as string,
        label: (r.nome as string) ?? "cliente",
        criado_em: (r.criado_em as string) ?? null,
      })),
    ].sort((a, b) => (b.criado_em ?? "").localeCompare(a.criado_em ?? "")),
    tarefasVencidas: ((tarefasVenc.data ?? []) as Record<string, unknown>[]).map((r): TarefaVencida => ({
      id: r.id as string,
      titulo: r.titulo as string,
      data_limite: (r.data_limite as string) ?? null,
      responsavel: (r.responsavel as string) ?? null,
      dias: diasAte(r.data_limite as string),
    })),
  };
}

/* ===== Varredura DJEN/push (ritual matinal: cobertura + anomalias) ===== */

export type DiagnosticoOab = { oab: string; acervo_total: number; itens_janela: number };
export type Anomalia = { fonte: string; tipo: string; detalhe: string };
export type Varredura = {
  fonte: string;
  criado_em: string;
  data_referencia: string;
  status: "concluida" | "parcial" | "falha";
  itens_processados: number;
  intimacoes_novas: number;
  andamentos_novos: number;
  prazos_criados: number;
  diagnostico_oab: DiagnosticoOab[] | null;
  anomalias: Anomalia[] | null;
};

/**
 * Última execução da triagem (view vw_ultima_varredura, distinct on fonte). A
 * automação grava UMA linha por execução com fonte='ambas'; preferimos essa quando
 * houver mais de uma. Tabela vazia → null (Painel mostra placeholder). jsonb já
 * volta parseado pelo supabase-js; tratamos null em diagnostico_oab/anomalias.
 */
export async function getUltimaVarredura(): Promise<Varredura | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_ultima_varredura")
    .select("*")
    .order("criado_em", { ascending: false });
  const rows = (data ?? []) as Record<string, unknown>[];
  if (!rows.length) return null;
  const row = rows.find((r) => r.fonte === "ambas") ?? rows[0];
  return {
    fonte: (row.fonte as string) ?? "",
    criado_em: row.criado_em as string,
    data_referencia: row.data_referencia as string,
    status: row.status as Varredura["status"],
    itens_processados: Number(row.itens_processados ?? 0),
    intimacoes_novas: Number(row.intimacoes_novas ?? 0),
    andamentos_novos: Number(row.andamentos_novos ?? 0),
    prazos_criados: Number(row.prazos_criados ?? 0),
    diagnostico_oab: (row.diagnostico_oab as DiagnosticoOab[] | null) ?? null,
    anomalias: (row.anomalias as Anomalia[] | null) ?? null,
  };
}

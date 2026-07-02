import { createClient } from "@/lib/supabase/server";
import { diasAte, hojeSP } from "@/lib/format";
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
    inercia,
  ] = await Promise.all([
    supabase.from("vw_pendentes_validacao").select("*", { count: "exact", head: true }),
    supabase.from("prazos").select("*", { count: "exact", head: true }).eq("status", "aberto"),
    supabase.from("audiencias").select("*", { count: "exact", head: true }).eq("status", "designada"),
    // Sugestão 53: a "caixa" deixa de contar status cru e passa a derivar dos fatos (na_caixa).
    supabase.from("vw_intimacoes_contexto").select("*", { count: "exact", head: true }).eq("na_caixa", true),
    supabase.from("tarefas").select("*", { count: "exact", head: true }).in("status", ["pendente", "em_andamento"]),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("vw_processos_movimentacao").select("*", { count: "exact", head: true }).gte("dias_parado", 30),
    supabase.from("vw_clientes_duplicados").select("*", { count: "exact", head: true }),
    // Sug. 54: o badge reflete a FILA REAL de merge (stub inerte × CNJ posterior do
    // mesmo cliente), não o legado só-registro (vw_reconciliacao_registro = backlog
    // estático, reconciliação preguiçosa pelo DJEN — não é alarme diário).
    supabase.from("vw_possiveis_duplicatas_registro").select("*", { count: "exact", head: true }),
    supabase.from("vw_pecas_pendentes").select("*", { count: "exact", head: true }),
    // Sug. 62 — Sentinela de Inércia: processos ativos COM VIDA em silêncio além do
    // limiar da área/instância. A view já aplica carve-out (stub fica de fora) e carência.
    supabase.from("vw_processos_inercia").select("*", { count: "exact", head: true }),
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
    inercia: inercia.count ?? 0,
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
    conferencias_pendentes: number;
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
  const hoje = hojeSP();

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
    confPend,
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
    // Sugestão 53: coerência com o badge — card "Intimações pendentes" deriva de na_caixa.
    supabase.from("vw_intimacoes_contexto").select("*", { count: "exact", head: true }).eq("na_caixa", true),
    supabase.from("vw_intimacoes_orfas").select("*", { count: "exact", head: true }),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("processos").select("*", { count: "exact", head: true }).is("numero_cnj", null),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("segredo_justica", true),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("cadastro_automatico", true),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("cadastro_automatico", true),
    supabase.from("auditoria").select("*", { count: "exact", head: true }),
    supabase.from("vw_andamentos_orfaos").select("*", { count: "exact", head: true }),
    supabase.from("vw_pendentes_validacao").select("*", { count: "exact", head: true }),
    supabase.from("tarefas").select("*", { count: "exact", head: true }).in("status", ["pendente", "em_andamento"]).eq("cadastro_automatico", true).eq("cadastrado_por", "cowork"),
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
      conferencias_pendentes: confPend.count ?? 0,
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

/** O `detalhe` da anomalia às vezes vem como array/objeto (ex.: minuta_diferida);
 * coage para string legível — render direto de objeto quebra o React. */
function detStr(d: unknown): string {
  if (d == null) return "";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => detStr(x)).filter(Boolean).join(" | ");
  if (typeof d === "object") return Object.values(d as Record<string, unknown>).filter((v) => typeof v === "string").join(" · ");
  return String(d);
}
function normAnomalias(raw: unknown): Anomalia[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((a) => {
    const o = (a ?? {}) as Record<string, unknown>;
    return { fonte: String(o.fonte ?? ""), tipo: String(o.tipo ?? ""), detalhe: detStr(o.detalhe) };
  });
}
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
  // Sug. 80 — a T2 (redação) e a T3 (manutenção) também gravam varredura; o HERO
  // quer a última CAPTURA real: prefere 'ambas', depois djen/push, só então o resto.
  const row =
    rows.find((r) => r.fonte === "ambas") ??
    rows.find((r) => r.fonte === "djen" || r.fonte === "push") ??
    rows[0];
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
    anomalias: normAnomalias(row.anomalias),
  };
}

/* ===== Varredura: histórico de execuções + watermarks (tela /varredura) =====
 * Append-only; leitura sobre a tabela varreduras e os watermarks em config_sistema. */

export type VarreduraHist = {
  id: string;
  criado_em: string;
  fonte: string;
  status: "concluida" | "parcial" | "falha";
  itens_processados: number;
  intimacoes_novas: number;
  andamentos_novos: number;
  prazos_criados: number;
  janela_inicio: string | null;
  janela_fim: string | null;
  anomalias: Anomalia[] | null;
};

export async function getVarreduras(limit = 8): Promise<VarreduraHist[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("varreduras")
    .select("id, criado_em, fonte, status, itens_processados, intimacoes_novas, andamentos_novos, prazos_criados, janela_inicio, janela_fim, anomalias")
    .order("criado_em", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map((r): VarreduraHist => ({
    id: r.id as string,
    criado_em: r.criado_em as string,
    fonte: (r.fonte as string) ?? "",
    status: r.status as VarreduraHist["status"],
    itens_processados: Number(r.itens_processados ?? 0),
    intimacoes_novas: Number(r.intimacoes_novas ?? 0),
    andamentos_novos: Number(r.andamentos_novos ?? 0),
    prazos_criados: Number(r.prazos_criados ?? 0),
    janela_inicio: (r.janela_inicio as string | null) ?? null,
    janela_fim: (r.janela_fim as string | null) ?? null,
    anomalias: normAnomalias(r.anomalias),
  }));
}

export type Watermarks = { djen: string | null; push: string | null };

export async function getWatermarks(): Promise<Watermarks> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("config_sistema")
    .select("chave, valor")
    .in("chave", ["ultima_varredura_djen", "ultima_varredura_push"]);
  const norm = (v: unknown): string | null => {
    if (v == null) return null;
    return String(v).replace(" ", "T"); // "2026-06-23 13:04..+00" -> ISO parseável
  };
  const map = new Map((data ?? []).map((r) => [r.chave as string, r.valor]));
  return { djen: norm(map.get("ultima_varredura_djen")), push: norm(map.get("ultima_varredura_push")) };
}

/* Um ciclo completo de varredura (drawer /varredura/ciclos/[id]) — snapshot
 * append-only da tabela varreduras, com diagnóstico e rastro de origem. */
export type VarreduraCiclo = {
  id: string;
  criado_em: string;
  data_referencia: string | null;
  fonte: string;
  status: "concluida" | "parcial" | "falha";
  itens_processados: number;
  intimacoes_novas: number;
  andamentos_novos: number;
  prazos_criados: number;
  janela_inicio: string | null;
  janela_fim: string | null;
  diagnostico_oab: DiagnosticoOab[] | null;
  anomalias: Anomalia[] | null;
  arquivo_drive_id: string | null;
  cadastrado_por: string | null;
};

export async function getVarreduraPorId(id: string): Promise<VarreduraCiclo | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("varreduras")
    .select("id, criado_em, data_referencia, fonte, status, itens_processados, intimacoes_novas, andamentos_novos, prazos_criados, janela_inicio, janela_fim, diagnostico_oab, anomalias, arquivo_drive_id, cadastrado_por")
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  return {
    id: r.id as string,
    criado_em: r.criado_em as string,
    data_referencia: (r.data_referencia as string | null) ?? null,
    fonte: (r.fonte as string) ?? "",
    status: r.status as VarreduraCiclo["status"],
    itens_processados: Number(r.itens_processados ?? 0),
    intimacoes_novas: Number(r.intimacoes_novas ?? 0),
    andamentos_novos: Number(r.andamentos_novos ?? 0),
    prazos_criados: Number(r.prazos_criados ?? 0),
    janela_inicio: (r.janela_inicio as string | null) ?? null,
    janela_fim: (r.janela_fim as string | null) ?? null,
    diagnostico_oab: (r.diagnostico_oab as DiagnosticoOab[] | null) ?? null,
    anomalias: normAnomalias(r.anomalias),
    arquivo_drive_id: (r.arquivo_drive_id as string | null) ?? null,
    cadastrado_por: (r.cadastrado_por as string | null) ?? null,
  };
}

/* ===== Conferências escaladas (Sugestão 30) =====
 * Tarefas automáticas do Cowork (cadastro_automatico=true / cadastrado_por='cowork')
 * que escalaram uma movimentação para atenção humana. O Painel só tinha a CONTAGEM
 * (stats.conferencias_pendentes); aqui vem a LISTA, ordenada por prioridade
 * (urgente → baixa) como manda o ritual matinal. Dado real; segredo de justiça
 * vem do processo vinculado. */

export type ConferenciaEscalada = {
  id: string;
  titulo: string;
  prioridade: string | null;
  data_limite: string | null;
  numero_cnj: string | null;
  cliente: string | null;
  segredo: boolean;
  // Sug. 62 — distingue a sentinela de inércia (motivo_auto='inercia') do
  // escalonamento de andamento; null/'' = conferência de movimentação (Sug. 30).
  motivo_auto: string | null;
};

const PRIO_ORDEM: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

export async function getConferenciasEscaladas(limit = 6): Promise<ConferenciaEscalada[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select("id, titulo, prioridade, data_limite, motivo_auto, processos(numero_cnj,segredo_justica), clientes(nome)")
    .eq("cadastro_automatico", true)
    .eq("cadastrado_por", "cowork")
    .in("status", ["pendente", "em_andamento"])
    .limit(50);

  const rows = ((data ?? []) as Record<string, unknown>[]).map((r): ConferenciaEscalada => {
    const p = r.processos as unknown as { numero_cnj: string | null; segredo_justica: boolean | null } | null;
    const c = r.clientes as unknown as { nome: string | null } | null;
    return {
      id: r.id as string,
      titulo: r.titulo as string,
      prioridade: (r.prioridade as string) ?? null,
      data_limite: (r.data_limite as string) ?? null,
      numero_cnj: p?.numero_cnj ?? null,
      cliente: c?.nome ?? null,
      segredo: Boolean(p?.segredo_justica),
      motivo_auto: (r.motivo_auto as string | null) ?? null,
    };
  });

  rows.sort(
    (a, b) =>
      (PRIO_ORDEM[a.prioridade ?? "baixa"] ?? 9) - (PRIO_ORDEM[b.prioridade ?? "baixa"] ?? 9) ||
      (a.data_limite ?? "9999").localeCompare(b.data_limite ?? "9999"),
  );
  return rows.slice(0, limit);
}

/* ===== Benefícios próximos · execução penal (cross-client) =====
 * vw_situacao_executoria_atual já calcula dias_para_progressao/livramento por
 * cliente; aqui pegamos o snapshot de TODOS os clientes em execução e elegemos,
 * por cliente, o benefício mais próximo. Máscara de sigilo: nome do cliente
 * vinculado a processo sigiloso vira "Cliente sigiloso". */

export type BeneficioProximo = {
  cliente_id: string;
  nome: string;
  regime_atual: string | null;
  tipo: "progressao" | "livramento";
  data_prevista: string | null;
  dias: number;
  segredo: boolean;
};

export async function getBeneficiosProximos(limit = 5): Promise<BeneficioProximo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_situacao_executoria_atual")
    .select(
      "cliente_id, nome, regime_atual, processo_id, dias_para_progressao, data_prevista_progressao, dias_para_livramento, data_prevista_livramento",
    );
  const rows = (data ?? []) as Record<string, unknown>[];

  // Sigilo: marca os processos sigilosos entre os vinculados, para mascarar o nome.
  const procIds = rows.map((r) => r.processo_id as string).filter(Boolean);
  const sigilo = new Set<string>();
  if (procIds.length) {
    const { data: ps } = await supabase
      .from("processos")
      .select("id")
      .in("id", procIds)
      .eq("segredo_justica", true);
    for (const p of ps ?? []) sigilo.add(p.id as string);
  }

  const benef: BeneficioProximo[] = [];
  for (const r of rows) {
    const segredo = sigilo.has(r.processo_id as string);
    const cands: { tipo: "progressao" | "livramento"; dias: number; data: string | null }[] = [];
    if (r.dias_para_progressao != null)
      cands.push({ tipo: "progressao", dias: Number(r.dias_para_progressao), data: (r.data_prevista_progressao as string) ?? null });
    if (r.dias_para_livramento != null)
      cands.push({ tipo: "livramento", dias: Number(r.dias_para_livramento), data: (r.data_prevista_livramento as string) ?? null });
    if (!cands.length) continue;
    cands.sort((a, b) => a.dias - b.dias);
    const best = cands[0];
    benef.push({
      cliente_id: r.cliente_id as string,
      nome: segredo ? "Cliente sigiloso" : (r.nome as string),
      regime_atual: (r.regime_atual as string) ?? null,
      tipo: best.tipo,
      data_prevista: best.data,
      dias: best.dias,
      segredo,
    });
  }
  benef.sort((a, b) => a.dias - b.dias);
  return benef.slice(0, limit);
}

/* ===== Briefing do ritual matinal (Sugestão 65) — fonte do cartão "Leitura do dia" =====
 * vw_briefing_atual entrega o briefing mais recente por dia (topo = hoje). O TEXTO
 * (resumo/corpo em markdown + onde_focar[]) vive no banco; os NÚMEROS seguem em
 * vw_ultima_varredura, sem duplicar. */

export type OndeFocarRef = { tipo: "prazo" | "peca" | "processo" | "audiencia" | null; id: string | null };
export type OndeFocarItem = {
  ordem: number;
  titulo: string;
  detalhe: string;
  urgencia: "urgente" | "alta" | "normal";
  ref: OndeFocarRef | null;
};
export type Briefing = {
  data_referencia: string;
  gerado_em: string;
  gerado_por: string;
  resumo: string | null;
  corpo: string | null;
  onde_focar: OndeFocarItem[];
};

export async function getBriefingAtual(): Promise<Briefing | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_briefing_atual")
    .select("data_referencia, gerado_em, gerado_por, resumo, corpo, onde_focar")
    .order("data_referencia", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  const focar = Array.isArray(r.onde_focar) ? (r.onde_focar as OndeFocarItem[]) : [];
  return {
    data_referencia: r.data_referencia as string,
    gerado_em: r.gerado_em as string,
    gerado_por: (r.gerado_por as string) ?? "",
    resumo: (r.resumo as string) ?? null,
    corpo: (r.corpo as string) ?? null,
    onde_focar: [...focar]
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((o) => ({
        ordem: Number(o?.ordem ?? 0),
        titulo: detStr(o?.titulo),
        detalhe: detStr(o?.detalhe),
        urgencia: (o?.urgencia === "urgente" || o?.urgencia === "alta" ? o.urgencia : "normal") as OndeFocarItem["urgencia"],
        ref: o?.ref && typeof o.ref === "object" ? { tipo: (o.ref.tipo ?? null) as OndeFocarRef["tipo"], id: o.ref.id ?? null } : null,
      })),
  };
}

/* ===== Sentinela de Inércia (Sugestão 62) — radar do silêncio anômalo =====
 * Lê vw_processos_inercia: processos ATIVOS COM VIDA (≥1 andamento/intimação) cujo
 * silêncio (relógio sobre o ÚLTIMO MOVIMENTO REAL, nunca criado_em) ultrapassou o
 * limiar de mapa_cadencia_inercia para a área/instância. A view JÁ aplica o
 * carve-out (stub sem vida fica de fora — é legado/Sug.54) e a carência; aqui não
 * recalculamos nada — só enriquecemos com cliente vinculado + sinal de réu preso
 * (que, junto com execução penal, define a prioridade igual ao passo Cowork) e
 * ordenamos como o briefing: execução/preso no topo, depois dias_silencio desc. */

export type ProcessoInercia = {
  id: string;
  numero_cnj: string | null;
  numero_registro: string | null;
  area: string | null;
  instancia: string | null;
  fase: string | null;
  responsavel: string | null;
  segredo: boolean;
  ultima_atividade: string | null;
  dias_silencio: number;
  limiar_dias: number;
  excedente: number; // dias além do limiar
  clientes: string | null; // mascarado quando segredo de justiça
  preso: boolean; // algum cliente em situação prisional restritiva
  execucao: boolean; // area === execucao_penal
  prioridade: "alta" | "media"; // espelha a regra do passo Cowork
};

// Mesma doutrina do passo Cowork: prioridade alta quando execução penal OU réu preso.
const PRESO_INERCIA = new Set(["preso_provisorio", "preso_definitivo", "regime_semiaberto"]);

export async function getProcessosInercia(limit = 200): Promise<ProcessoInercia[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_processos_inercia")
    .select("id, numero_cnj, numero_registro_tribunal, area, instancia, fase, responsavel, segredo_justica, ultima_atividade, dias_silencio, limiar_dias")
    .order("dias_silencio", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as Record<string, unknown>[];
  if (!rows.length) return [];

  // Clientes vinculados (nome + situação prisional) para rótulo e prioridade.
  const ids = rows.map((r) => r.id as string);
  const { data: cps } = await supabase
    .from("cliente_processo")
    .select("processo_id, clientes(nome, situacao_prisional)")
    .in("processo_id", ids);
  const porProc = new Map<string, { nomes: string[]; preso: boolean }>();
  for (const cp of (cps ?? []) as Record<string, unknown>[]) {
    const pid = cp.processo_id as string;
    const cl = cp.clientes as unknown as { nome: string | null; situacao_prisional: string | null } | null;
    const e = porProc.get(pid) ?? { nomes: [], preso: false };
    if (cl?.nome) e.nomes.push(cl.nome);
    if (cl?.situacao_prisional && PRESO_INERCIA.has(cl.situacao_prisional)) e.preso = true;
    porProc.set(pid, e);
  }

  const out = rows.map((r): ProcessoInercia => {
    const segredo = Boolean(r.segredo_justica);
    const info = porProc.get(r.id as string) ?? { nomes: [], preso: false };
    const execucao = r.area === "execucao_penal";
    const dias = Number(r.dias_silencio ?? 0);
    const limiar = Number(r.limiar_dias ?? 0);
    return {
      id: r.id as string,
      numero_cnj: (r.numero_cnj as string | null) ?? null,
      numero_registro: (r.numero_registro_tribunal as string | null) ?? null,
      area: (r.area as string | null) ?? null,
      instancia: (r.instancia as string | null) ?? null,
      fase: (r.fase as string | null) ?? null,
      responsavel: (r.responsavel as string | null) ?? null,
      segredo,
      ultima_atividade: (r.ultima_atividade as string | null) ?? null,
      dias_silencio: dias,
      limiar_dias: limiar,
      excedente: dias - limiar,
      clientes: segredo ? "Cliente sigiloso" : info.nomes.join(", ") || null,
      preso: info.preso,
      execucao,
      prioridade: execucao || info.preso ? "alta" : "media",
    };
  });

  out.sort(
    (a, b) =>
      Number(b.prioridade === "alta") - Number(a.prioridade === "alta") ||
      b.dias_silencio - a.dias_silencio,
  );
  return out;
}

/* ===== Frescor da execução penal (Sugestão 63) — cobertura/validade do atestado =====
 * vw_execucao_frescor: universo de clientes de execução (condenação ativa OU snapshot
 * OU processo area=execucao_penal ativo). Para cada um, o último data_atestado,
 * dias_desde_atestado, limiar_dias e a classe frescor: sem_atestado (zero snapshot),
 * defasado (dias_desde_atestado > limiar) ou em_dia. A view não grava; o passo Cowork
 * levanta a pendência como tarefa (motivo_auto='atestado_frescor'). Aqui, só leitura. */

export type FrescorCliente = {
  cliente_id: string;
  nome: string;
  algum_sigiloso: boolean;
  condenacoes_ativas: number;
  tem_hediondo: boolean;
  ult_atestado: string | null;
  dias_desde_atestado: number | null;
  limiar_dias: number;
  frescor: "sem_atestado" | "defasado" | "em_dia";
};

export type ExecucaoCobertura = {
  sem_atestado: number;
  defasado: number;
  em_dia: number;
  total: number;
  algum_sigiloso: boolean;
  semLista: FrescorCliente[]; // clientes SEM atestado (condenação ativa no topo)
  defasadoLista: FrescorCliente[]; // atestados defasados (mais velho primeiro)
};

export async function getExecucaoFrescor(): Promise<ExecucaoCobertura> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_execucao_frescor")
    .select("cliente_id, nome, algum_sigiloso, condenacoes_ativas, tem_hediondo, ult_atestado, dias_desde_atestado, limiar_dias, frescor");
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r): FrescorCliente => ({
    cliente_id: r.cliente_id as string,
    nome: (r.nome as string) ?? "—",
    algum_sigiloso: Boolean(r.algum_sigiloso),
    condenacoes_ativas: Number(r.condenacoes_ativas ?? 0),
    tem_hediondo: Boolean(r.tem_hediondo),
    ult_atestado: (r.ult_atestado as string | null) ?? null,
    dias_desde_atestado: r.dias_desde_atestado == null ? null : Number(r.dias_desde_atestado),
    limiar_dias: Number(r.limiar_dias ?? 120),
    frescor: (r.frescor as FrescorCliente["frescor"]) ?? "sem_atestado",
  }));
  const sem = rows.filter((r) => r.frescor === "sem_atestado");
  const def = rows.filter((r) => r.frescor === "defasado");
  const emDia = rows.filter((r) => r.frescor === "em_dia").length;
  // Sem atestado: condenação ativa no topo (roda benefício no escuro), depois sigiloso, depois nome.
  const semOrd = [...sem].sort(
    (a, b) =>
      Number(b.condenacoes_ativas > 0) - Number(a.condenacoes_ativas > 0) ||
      Number(b.algum_sigiloso) - Number(a.algum_sigiloso) ||
      a.nome.localeCompare(b.nome),
  );
  const defOrd = [...def].sort((a, b) => (b.dias_desde_atestado ?? 0) - (a.dias_desde_atestado ?? 0));
  return {
    sem_atestado: sem.length,
    defasado: def.length,
    em_dia: emDia,
    total: rows.length,
    algum_sigiloso: rows.some((r) => r.algum_sigiloso),
    semLista: semOrd,
    defasadoLista: defOrd,
  };
}

/* ===== Reconciliação de expectativa processual (Sugestão 64) — cobertura perdida =====
 * vw_expectativa_pendente: gatilhos nossos (recurso_interposto / hc_impetrado /
 * peticao_protocolada) cuja janela de resposta estourou SEM evento satisfatório
 * posterior — possível intimação não capturada, a conferir nos autos. Rede de
 * segurança acima da captura; tende a poucos itens. Só leitura. */

export type ExpectativaPendente = {
  processo_id: string;
  tipo: string;
  data_gatilho: string;
  dias_desde_gatilho: number;
  numero_cnj: string | null;
  numero_registro: string | null;
  area: string | null;
  instancia: string | null;
  responsavel: string | null;
  segredo: boolean;
};

/* ===== Central de alertas (Sugestão 79) — vw_alertas =====
 * Consolida os critérios de alerta para o frontend não repetir lógica: prazo
 * fatal próximo/vencido, interna próxima, prazos/audiências pendentes de
 * validação, audiência hoje/amanhã e fatal caindo em fim de semana. Prioridade
 * 1 (crítico) → 3 (acompanhar). Alimenta o sino do topbar e a /alertas. */

export type AlertaVw = {
  tipo_alerta: string;
  origem: string; // 'prazo' | 'audiencia'
  id: string;
  titulo: string;
  data_ref: string | null;
  dias_restantes: number | null;
  validado: boolean;
  processo_id: string | null;
  numero_cnj: string | null;
  segredo: boolean;
  prioridade: number; // 1..3
};

export async function getAlertas(limit = 60): Promise<AlertaVw[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_alertas")
    .select("tipo_alerta, origem, id, titulo, data_ref, dias_restantes, validado, processo_id, numero_cnj, segredo_justica, prioridade")
    .order("prioridade", { ascending: true })
    .order("dias_restantes", { ascending: true, nullsFirst: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map((r): AlertaVw => ({
    tipo_alerta: (r.tipo_alerta as string) ?? "",
    origem: (r.origem as string) ?? "prazo",
    id: r.id as string,
    titulo: (r.titulo as string) ?? "—",
    data_ref: (r.data_ref as string | null) ?? null,
    dias_restantes: r.dias_restantes == null ? null : Number(r.dias_restantes),
    validado: Boolean(r.validado),
    processo_id: (r.processo_id as string | null) ?? null,
    numero_cnj: (r.numero_cnj as string | null) ?? null,
    segredo: Boolean(r.segredo_justica),
    prioridade: Number(r.prioridade ?? 3),
  }));
}

export async function getExpectativaPendente(limit = 20): Promise<ExpectativaPendente[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_expectativa_pendente")
    .select("processo_id, tipo, data_gatilho, dias_desde_gatilho, numero_cnj, numero_registro_tribunal, area, instancia, responsavel, segredo_justica")
    .order("dias_desde_gatilho", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map((r): ExpectativaPendente => ({
    processo_id: r.processo_id as string,
    tipo: r.tipo as string,
    data_gatilho: r.data_gatilho as string,
    dias_desde_gatilho: Number(r.dias_desde_gatilho ?? 0),
    numero_cnj: (r.numero_cnj as string | null) ?? null,
    numero_registro: (r.numero_registro_tribunal as string | null) ?? null,
    area: (r.area as string | null) ?? null,
    instancia: (r.instancia as string | null) ?? null,
    responsavel: (r.responsavel as string | null) ?? null,
    segredo: Boolean(r.segredo_justica),
  }));
}

/* ===== Sentinela de atos (Sug. 75 · F5) — vw_sentinela_atos =====
 * Painel único de saúde da conciliação de atos gêmeos: quantos clusters têm
 * status divergente entre fontes (a conferir), quantas peças ficaram órfãs, e o
 * volume de intimações em aberto / clusters gêmeos. Uma linha global, só leitura.
 * As views são CANDIDATAS de conferência — agrupam, nunca mesclam nem escondem. */

export type SentinelaAtos = {
  intimacoes_total: number;
  intimacoes_em_aberto: number;
  clusters_intimacao_gemea: number;
  clusters_status_divergente: number;
  clusters_andamento_gemeo: number;
  pecas_orfas: number;
  pecas_a_fazer: number;
};

export async function getSentinelaAtos(): Promise<SentinelaAtos | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_sentinela_atos")
    .select("intimacoes_total, intimacoes_em_aberto, clusters_intimacao_gemea, clusters_status_divergente, clusters_andamento_gemeo, pecas_orfas, pecas_a_fazer")
    .maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    intimacoes_total: Number(r.intimacoes_total ?? 0),
    intimacoes_em_aberto: Number(r.intimacoes_em_aberto ?? 0),
    clusters_intimacao_gemea: Number(r.clusters_intimacao_gemea ?? 0),
    clusters_status_divergente: Number(r.clusters_status_divergente ?? 0),
    clusters_andamento_gemeo: Number(r.clusters_andamento_gemeo ?? 0),
    pecas_orfas: Number(r.pecas_orfas ?? 0),
    pecas_a_fazer: Number(r.pecas_a_fazer ?? 0),
  };
}

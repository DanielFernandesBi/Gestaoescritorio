import { createClient } from "@/lib/supabase/server";
import { diasAte } from "@/lib/format";

/* Helpers ---------------------------------------------------------------- */

type NestedCliente = { clientes: { nome: string } | null };
type NestedProcesso = {
  numero_cnj: string | null;
  numero_registro_tribunal: string | null;
  tribunal: string | null;
  vara_comarca: string | null;
  uf: string | null;
  segredo_justica: boolean | null;
  cliente_processo?: NestedCliente[] | null;
} | null;

function nomesClientes(cp?: NestedCliente[] | null): string {
  if (!cp?.length) return "";
  const nomes = cp.map((x) => x.clientes?.nome).filter(Boolean) as string[];
  return [...new Set(nomes)].join(", ");
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
  numero_cnj: string | null;
  numero_registro: string | null;
  tribunal: string | null;
  vara_comarca: string | null;
  segredo: boolean;
  clientes: string;
  dias_restantes: number;
};

export async function getPrazos(): Promise<Prazo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prazos")
    .select(
      "id, ato, data_fatal, data_interna, tipo_contagem, status, validado, responsavel, processos(numero_cnj,numero_registro_tribunal,tribunal,vara_comarca,segredo_justica,cliente_processo(clientes(nome)))",
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
      dias_restantes: diasAte(r.data_fatal as string),
    };
  });
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
  numero_cnj: string | null;
  numero_registro: string | null;
  tribunal: string | null;
  segredo: boolean;
  orfa: boolean;
};

export async function getIntimacoes(): Promise<Intimacao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("intimacoes")
    .select(
      "id, origem, resumo, status, data_publicacao, data_ciencia, providencia, codigo_publicacao, processo_id, processos(numero_cnj,numero_registro_tribunal,tribunal,segredo_justica)",
    )
    .order("data_publicacao", { ascending: false, nullsFirst: false })
    .limit(300);

  return (data ?? []).map((r): Intimacao => {
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
      orfa: r.processo_id == null,
    };
  });
}

/* Audiências ------------------------------------------------------------- */

export type Audiencia = {
  id: string;
  tipo: string;
  data_hora: string;
  modalidade: string | null;
  local_link: string | null;
  status: string;
  responsavel: string | null;
  validado: boolean;
  numero_cnj: string | null;
  segredo: boolean;
  clientes: string;
};

export async function getAudiencias(): Promise<Audiencia[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audiencias")
    .select(
      "id, tipo, data_hora, modalidade, local_link, status, responsavel, validado, processos(numero_cnj,segredo_justica,cliente_processo(clientes(nome)))",
    )
    .order("data_hora", { ascending: true });

  return (data ?? []).map((r): Audiencia => {
    const p = r.processos as unknown as NestedProcesso;
    return {
      id: r.id as string,
      tipo: r.tipo as string,
      data_hora: r.data_hora as string,
      modalidade: r.modalidade as string | null,
      local_link: r.local_link as string | null,
      status: r.status as string,
      responsavel: r.responsavel as string | null,
      validado: Boolean(r.validado),
      numero_cnj: p?.numero_cnj ?? null,
      segredo: Boolean(p?.segredo_justica),
      clientes: nomesClientes(p?.cliente_processo),
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

/* Clientes --------------------------------------------------------------- */

export type Cliente = {
  id: string;
  nome: string;
  cpf: string | null;
  uf: string | null;
  situacao_prisional: string | null;
  unidade_prisional: string | null;
  cadastro_automatico: boolean;
  total_processos: number;
  processos_ativos: number;
  prazos_abertos: number;
  audiencias_futuras: number;
};

export async function getClientes(): Promise<Cliente[]> {
  const supabase = await createClient();
  const [base, situacao] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, cpf, uf, situacao_prisional, unidade_prisional, cadastro_automatico")
      .eq("ativo", true)
      .order("nome", { ascending: true }),
    supabase.from("vw_situacao_cliente").select("*"),
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

  return (base.data ?? []).map((c): Cliente => {
    const s = sit.get(c.id as string) ?? {};
    return {
      id: c.id as string,
      nome: c.nome as string,
      cpf: c.cpf as string | null,
      uf: c.uf as string | null,
      situacao_prisional: c.situacao_prisional as string | null,
      unidade_prisional: c.unidade_prisional as string | null,
      cadastro_automatico: Boolean(c.cadastro_automatico),
      total_processos: s.total_processos ?? 0,
      processos_ativos: s.processos_ativos ?? 0,
      prazos_abertos: s.prazos_abertos ?? 0,
      audiencias_futuras: s.audiencias_futuras ?? 0,
    };
  });
}

/* Financeiro ------------------------------------------------------------- */

export type Parcela = {
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
      .from("vw_financeiro_pendente")
      .select("*")
      .order("vencimento", { ascending: true }),
    supabase.from("contratos").select("*", { count: "exact", head: true }).eq("status", "vigente"),
    supabase.from("contratos").select("*", { count: "exact", head: true }),
  ]);

  const parcelas = (fin.data ?? []) as Parcela[];
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
};

export async function getAndamentos(): Promise<Movimentacao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_movimentacoes_recentes")
    .select("*")
    .order("data", { ascending: false })
    .limit(60);
  return (data ?? []).map((r) => ({
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
};

export async function getTarefas(): Promise<Tarefa[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select("id, titulo, descricao, status, prioridade, responsavel, data_limite")
    .order("data_limite", { ascending: true, nullsFirst: false })
    .limit(300);
  return (data ?? []) as Tarefa[];
}

/* Auditoria -------------------------------------------------------------- */

export type EventoAuditoria = {
  ocorrido_em: string;
  tabela: string;
  operacao: string;
  referencia: string | null;
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
};

export async function getSugestoes(): Promise<Sugestao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sugestoes_sistema")
    .select("id, contexto, sugestao, sql_proposto, status")
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
  clientes: { id: string; nome: string; cpf: string | null; uf: string | null; situacao_prisional: string | null }[];
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
      .select("id, nome, cpf, uf, situacao_prisional")
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
        "id, origem, resumo, status, data_publicacao, data_ciencia, providencia, codigo_publicacao, processo_id, processos(numero_cnj,numero_registro_tribunal,tribunal,segredo_justica)",
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
      orfa: r.processo_id == null,
    };
  });

  return {
    clientes: (cli.data ?? []) as ResultadosBusca["clientes"],
    processos,
    intimacoes,
  };
}

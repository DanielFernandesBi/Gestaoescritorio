import { createClient } from "@/lib/supabase/server";
import { diasAte } from "@/lib/format";
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
      processo_id: (r.processo_id as string) ?? null,
      orfa: r.processo_id == null,
    };
  });
}

/** Uma intimação pelo id, na mesma forma de `getIntimacoes`. */
export async function getIntimacaoPorId(id: string): Promise<Intimacao | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("intimacoes")
    .select(
      "id, origem, resumo, status, data_publicacao, data_ciencia, providencia, codigo_publicacao, processo_id, processos(numero_cnj,numero_registro_tribunal,tribunal,segredo_justica)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!r) return null;
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
      "id, processo_id, tipo, data_hora, modalidade, local_link, status, responsavel, observacoes, validado, processos(numero_cnj,numero_registro_tribunal,segredo_justica,cliente_processo(clientes(nome)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!r) return null;
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

export async function getTarefaPorId(id: string): Promise<Tarefa | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select("id, titulo, descricao, status, prioridade, responsavel, data_limite")
    .eq("id", id)
    .maybeSingle();
  return (data as Tarefa) ?? null;
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
      "id, titulo, tipo, subtipo, status, prioridade, responsavel, cliente_id, processo_id, prazo_id, intimacao_id, origem_andamento_id, tarefa_id, andamento_id, drive_file_id, protocolada_em, cadastro_automatico, validado, criado_em, clientes(nome), processos(numero_cnj,numero_registro_tribunal,segredo_justica)",
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
      processo_id: (r.processo_id as string) ?? null,
      orfa: r.processo_id == null,
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
  dias_remidos: number | null;
  dias_perdidos: number | null;
  data_prevista_progressao: string | null;
  dias_para_progressao: number | null;
  data_prevista_livramento: string | null;
  dias_para_livramento: number | null;
  data_termino_pena: string | null;
  processo_id: string | null;
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
  pena_texto: string | null;
  regime_imposto: string | null;
  fracao_progressao: string | null;
  fracao_livramento: string | null;
  hediondo: boolean;
  reincidente: boolean;
  situacao: string | null;
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
      .select("id, data_atestado, fonte, regime_atual, pena_total_dias, pena_cumprida_dias, pena_cumprida_texto, pena_remanescente_texto, dias_remidos, dias_perdidos, data_prevista_progressao, data_prevista_livramento, data_termino_pena, drive_file_id, observacoes")
      .eq("cliente_id", cliente_id)
      .order("data_atestado", { ascending: false })
      .limit(60),
    supabase.from("vw_condenacoes_cliente").select("*").eq("cliente_id", cliente_id),
    supabase.from("vw_estrategia_cliente").select("*").eq("cliente_id", cliente_id),
    supabase.from("vw_objetivos_instrumento").select("*").eq("cliente_id", cliente_id),
  ]);

  let segredo = false;
  const sitRow = sit.data as Record<string, unknown> | null;
  if (sitRow?.processo_id) {
    const { data: p } = await supabase.from("processos").select("segredo_justica").eq("id", sitRow.processo_id as string).maybeSingle();
    segredo = Boolean(p?.segredo_justica);
  }

  const atestadosRaw = (atest.data ?? []) as (ExecAtestado & { pena_total_dias?: number | null; pena_cumprida_dias?: number | null })[];
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
        dias_remidos: sitRow.dias_remidos as number | null,
        dias_perdidos: sitRow.dias_perdidos as number | null,
        data_prevista_progressao: sitRow.data_prevista_progressao as string | null,
        dias_para_progressao: sitRow.dias_para_progressao as number | null,
        data_prevista_livramento: sitRow.data_prevista_livramento as string | null,
        dias_para_livramento: sitRow.dias_para_livramento as number | null,
        data_termino_pena: sitRow.data_termino_pena as string | null,
        processo_id: sitRow.processo_id as string | null,
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

/* Merge / duplicados ----------------------------------------------------- */

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
};

export async function getClientesDuplicados(): Promise<ClienteDuplicadoCluster[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("vw_clientes_duplicados").select("*");
  return (data ?? []).map((r): ClienteDuplicadoCluster => ({
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
};

export async function getProcessosReconciliacao(): Promise<ProcessoReconciliacao[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("vw_reconciliacao_registro").select("*");
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
  }));
}

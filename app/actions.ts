"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { socioDoEmail, outroSocio } from "@/lib/allowlist";
import {
  confirmarPrazo,
  criarEventoProvisorio,
  criarEventoAudiencia,
  atualizarEventoAudiencia,
  criarEventoCompromisso,
  calendarConfigurado,
} from "@/lib/calendar";
import {
  INTIMACAO_STATUS,
  TAREFA_STATUS,
  ANDAMENTO_TIPO,
  PAGAMENTO_STATUS,
  SUGESTAO_STATUS,
  CONTRATO_STATUS,
  DOCUMENTO_TIPO,
  PECA_STATUS,
  PECA_TIPO,
} from "@/lib/enums";
import { soDigitos, humano, fmtDate } from "@/lib/format";

export type Resultado = { ok: boolean; message: string };

function falha(e: unknown): Resultado {
  const m = e instanceof Error ? e.message : "Falha na gravação.";
  return { ok: false, message: m };
}
function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}
function agora(): string {
  return new Date().toISOString();
}

// Segue a cadeia de merge (Sugestão 28): se o id for um tombstone com merged_into,
// devolve o canônico vivo; senão, o próprio id. Usado no lookup/dedup de processos.
async function resolverProcesso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<string> {
  if (!id) return id;
  const { data } = await supabase.rpc("fn_resolver_processo", { p_id: id });
  return (data as string | null) ?? id;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function refProcesso(proc: any): string {
  if (!proc) return "processo";
  const nome = proc?.cliente_processo?.[0]?.clientes?.nome;
  return nome || proc?.numero_cnj || proc?.numero_registro_tribunal || "processo";
}

function revalidarTudo() {
  for (const p of [
    "/painel", "/validacao", "/prazos", "/audiencias", "/intimacoes",
    "/tarefas", "/producao", "/processos", "/clientes", "/financeiro", "/andamentos",
    "/auditoria", "/sistema", "/alertas", "/estudos",
  ]) {
    revalidatePath(p);
  }
}

/* ============================ PRAZOS ============================ */

export async function validarPrazo(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: pr, error } = await supabase
      .from("prazos")
      .select(
        "id, ato, data_fatal, data_interna, validado, calendar_event_id, processos(numero_cnj, numero_registro_tribunal, cliente_processo(clientes(nome)))",
      )
      .eq("id", id)
      .single();
    if (error || !pr) throw new Error("Prazo não encontrado.");
    if (pr.validado) return { ok: true, message: "Prazo já estava validado." };

    const { error: upErr } = await supabase
      .from("prazos")
      .update({ validado: true, validado_em: agora() })
      .eq("id", id);
    if (upErr) throw upErr;

    let msg = "Prazo validado.";
    const fatalId = await confirmarPrazo(
      { ato: pr.ato as string, dataFatal: pr.data_fatal as string, dataInterna: pr.data_interna as string | null, ref: refProcesso(pr.processos) },
      (pr.calendar_event_id as string | null) ?? null,
    );
    if (fatalId) {
      await supabase.from("prazos").update({ calendar_event_id_fatal: fatalId }).eq("id", id);
      msg += " Marcador fatal (vermelho) criado no Google Calendar.";
    } else if (calendarConfigurado()) {
      msg += " (Calendar indisponível agora — gravado só no banco.)";
    }
    revalidarTudo();
    return { ok: true, message: msg };
  } catch (e) {
    return falha(e);
  }
}

export async function baixarPrazo(id: string, descricao?: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: pr, error } = await supabase
      .from("prazos")
      .select("id, ato, processo_id, intimacao_id, status")
      .eq("id", id)
      .single();
    if (error || !pr) throw new Error("Prazo não encontrado.");
    if (pr.status !== "aberto") return { ok: false, message: `Prazo não está aberto (${pr.status}).` };

    const { error: upErr } = await supabase
      .from("prazos")
      .update({ status: "cumprido", cumprido_em: hoje() })
      .eq("id", id);
    if (upErr) throw upErr;

    let msg = "Prazo dado como cumprido.";
    let andamentoId: string | null = null;
    if (pr.processo_id) {
      const { data: and, error: andErr } = await supabase
        .from("andamentos")
        .insert({
          processo_id: pr.processo_id,
          data: hoje(),
          tipo: "peticao_protocolada",
          descricao: descricao?.trim() || `Cumprido o prazo: ${pr.ato}.`,
          cadastrado_por: "manual",
          cadastro_automatico: false,
        })
        .select("id")
        .single();
      if (!andErr) {
        msg += " Andamento registrado.";
        andamentoId = (and?.id as string) ?? null;
      }
    }
    if (pr.intimacao_id) {
      await supabase.from("intimacoes").update({ status: "providencia_tomada" }).eq("id", pr.intimacao_id);
      msg += " Intimação marcada como providência tomada.";
    }

    // Fecha o ciclo intimação→prazo→PEÇA→andamento: se houver peça vinculada a este
    // prazo em status não-terminal, move-a para "protocolada" gravando o andamento
    // que a materializou e a data da baixa. Nunca DELETE; troca de status, auditada.
    const TERMINAIS = ["protocolada", "cancelada", "prejudicada"];
    const { data: pecasVinc } = await supabase
      .from("pecas")
      .select("id, status")
      .eq("prazo_id", id);
    const aProtocolar = (pecasVinc ?? []).filter((p) => !TERMINAIS.includes(p.status as string));
    for (const p of aProtocolar) {
      const patch: Record<string, unknown> = { status: "protocolada", protocolada_em: hoje() };
      if (andamentoId) patch.andamento_id = andamentoId;
      await supabase.from("pecas").update(patch).eq("id", p.id);
    }
    if (aProtocolar.length) {
      msg += ` ${aProtocolar.length} peça(s) vinculada(s) movida(s) para protocolada.`;
    }

    revalidarTudo();
    return { ok: true, message: msg };
  } catch (e) {
    return falha(e);
  }
}

export async function cancelarPrazo(id: string, motivo: string): Promise<Resultado> {
  try {
    await requireUser();
    if (!motivo?.trim()) return { ok: false, message: "Informe o motivo do cancelamento." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("prazos")
      .update({ status: "cancelado", observacoes: `Cancelado: ${motivo.trim()}` })
      .eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Prazo cancelado (registrado na auditoria)." };
  } catch (e) {
    return falha(e);
  }
}

export async function criarPrazo(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const processo_id = String(fd.get("processo_id") || "");
    const ato = String(fd.get("ato") || "").trim();
    const data_fatal = String(fd.get("data_fatal") || "");
    const data_interna = String(fd.get("data_interna") || "") || null;
    const responsavel = String(fd.get("responsavel") || "Daniel");
    const tipo_contagem = String(fd.get("tipo_contagem") || "corridos");
    if (!processo_id || !ato || !data_fatal) return { ok: false, message: "Processo, ato e data fatal são obrigatórios." };

    const { data: novo, error } = await supabase
      .from("prazos")
      .insert({
        processo_id, ato, data_fatal, data_interna,
        responsavel, tipo_contagem, status: "aberto",
        validado: false, cadastrado_por: "manual",
      })
      .select("id")
      .single();
    if (error) throw error;

    // Evento PROVISÓRIO (Tangerina) — nasce visível, conforme manual.
    const { data: proc } = await supabase
      .from("processos")
      .select("numero_cnj, numero_registro_tribunal, cliente_processo(clientes(nome))")
      .eq("id", processo_id)
      .single();
    const evId = await criarEventoProvisorio({ ato, dataFatal: data_fatal, dataInterna: data_interna, ref: refProcesso(proc) });
    if (evId && novo) await supabase.from("prazos").update({ calendar_event_id: evId }).eq("id", novo.id);

    revalidarTudo();
    return { ok: true, message: "Prazo criado (validado=false)." + (evId ? " Evento provisório no Calendar." : "") };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ AUDIÊNCIAS ============================ */

export async function validarAudiencia(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: a, error } = await supabase
      .from("audiencias")
      .select("id, tipo, data_hora, modalidade, local_link, validado, calendar_event_id, processos(numero_cnj, cliente_processo(clientes(nome)))")
      .eq("id", id)
      .single();
    if (error || !a) throw new Error("Audiência não encontrada.");
    if (a.validado) return { ok: true, message: "Audiência já estava validada." };

    const { error: upErr } = await supabase
      .from("audiencias")
      .update({ validado: true, validado_em: agora() })
      .eq("id", id);
    if (upErr) throw upErr;

    let msg = "Audiência validada.";
    const evId = await criarEventoAudiencia({
      tipo: a.tipo as string, dataHora: a.data_hora as string,
      modalidade: a.modalidade as string | null, local: a.local_link as string | null,
      ref: refProcesso(a.processos),
    });
    if (evId) {
      await supabase.from("audiencias").update({ calendar_event_id: evId }).eq("id", id);
      msg += " Evento criado no Google Calendar.";
    } else if (calendarConfigurado()) {
      msg += " (Calendar indisponível agora — gravado só no banco.)";
    }
    revalidarTudo();
    return { ok: true, message: msg };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ INTIMAÇÕES ============================ */

export async function atualizarIntimacao(
  id: string,
  status: string,
  providencia?: string,
): Promise<Resultado> {
  try {
    await requireUser();
    if (!(INTIMACAO_STATUS as readonly string[]).includes(status)) {
      return { ok: false, message: "Status inválido." };
    }
    const supabase = await createClient();
    const patch: Record<string, unknown> = { status };
    if (providencia?.trim()) patch.providencia = providencia.trim();
    const { error } = await supabase.from("intimacoes").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Intimação atualizada." };
  } catch (e) {
    return falha(e);
  }
}

/** Edição humana dos CAMPOS de uma intimação (correção/triagem de Daniel). */
export async function atualizarIntimacaoCampos(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const patch: Record<string, unknown> = {};
    const resumo = String(fd.get("resumo") || "").trim();
    const providencia = String(fd.get("providencia") || "").trim();
    const teor = String(fd.get("teor") || "").trim();
    const data_publicacao = String(fd.get("data_publicacao") || "");
    const data_ciencia = String(fd.get("data_ciencia") || "");
    if (resumo) patch.resumo = resumo;
    if (providencia) patch.providencia = providencia;
    if (teor) patch.teor = teor;
    if (data_publicacao) patch.data_publicacao = data_publicacao;
    if (data_ciencia) patch.data_ciencia = data_ciencia;
    if (!Object.keys(patch).length) return { ok: false, message: "Nada para atualizar." };
    const { error } = await supabase.from("intimacoes").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Intimação atualizada." };
  } catch (e) {
    return falha(e);
  }
}

export async function criarIntimacao(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const processo_id = String(fd.get("processo_id") || "") || null;
    const origem = String(fd.get("origem") || "");
    const resumo = String(fd.get("resumo") || "").trim();
    const teor = String(fd.get("teor") || "").trim() || resumo;
    const data_publicacao = String(fd.get("data_publicacao") || "") || null;
    const data_ciencia = String(fd.get("data_ciencia") || "") || null;
    if (!origem || !resumo) return { ok: false, message: "Origem e resumo são obrigatórios." };
    const { error } = await supabase.from("intimacoes").insert({
      processo_id, origem, resumo, teor, data_publicacao, data_ciencia,
      status: "pendente", cadastrado_por: "manual",
    });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Intimação cadastrada (pendente)." };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ TAREFAS ============================ */

export async function moverTarefa(id: string, status: string): Promise<Resultado> {
  try {
    await requireUser();
    if (!(TAREFA_STATUS as readonly string[]).includes(status)) {
      return { ok: false, message: "Status inválido." };
    }
    const supabase = await createClient();
    const patch: Record<string, unknown> = {
      status,
      concluida_em: status === "concluida" ? agora() : null,
    };
    const { error } = await supabase.from("tarefas").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Tarefa atualizada." };
  } catch (e) {
    return falha(e);
  }
}

export async function criarTarefa(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const titulo = String(fd.get("titulo") || "").trim();
    const descricao = String(fd.get("descricao") || "").trim() || null;
    const prioridade = String(fd.get("prioridade") || "media");
    const responsavel = String(fd.get("responsavel") || "Daniel");
    const data_limite = String(fd.get("data_limite") || "") || null;
    const processo_id = String(fd.get("processo_id") || "") || null;
    const cliente_id = String(fd.get("cliente_id") || "") || null;
    if (!titulo) return { ok: false, message: "Título é obrigatório." };
    const { error } = await supabase.from("tarefas").insert({
      titulo, descricao, prioridade, responsavel, data_limite,
      processo_id, cliente_id, status: "pendente",
    });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Tarefa criada." };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ PRODUÇÃO (peças) ============================ */

/** Cria uma peça do backlog. Manual nasce validado=true, cadastrado_por='manual'. */
export async function criarPeca(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const titulo = String(fd.get("titulo") || "").trim();
    if (!titulo) return { ok: false, message: "Título é obrigatório." };
    const tipo = String(fd.get("tipo") || "outra");
    if (!(PECA_TIPO as readonly string[]).includes(tipo)) return { ok: false, message: "Tipo de peça inválido." };

    const { error } = await supabase.from("pecas").insert({
      titulo,
      tipo,
      subtipo: String(fd.get("subtipo") || "").trim() || null,
      descricao: String(fd.get("descricao") || "").trim() || null,
      status: "a_fazer",
      prioridade: String(fd.get("prioridade") || "media"),
      responsavel: String(fd.get("responsavel") || "Daniel"),
      // processo_id NULL = inicial de caso novo (permitido pelo schema).
      cliente_id: String(fd.get("cliente_id") || "").trim() || null,
      processo_id: String(fd.get("processo_id") || "").trim() || null,
      prazo_id: String(fd.get("prazo_id") || "").trim() || null,
      intimacao_id: String(fd.get("intimacao_id") || "").trim() || null,
      data_alvo: String(fd.get("data_alvo") || "") || null,
      drive_file_id: String(fd.get("drive_file_id") || "").trim() || null,
      validado: true,
      cadastro_automatico: false,
      cadastrado_por: "manual",
    });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Peça criada no backlog (A fazer)." };
  } catch (e) {
    return falha(e);
  }
}

/** Move a peça pelo kanban (inclui cancelar/prejudicar = troca de status; nunca DELETE). */
export async function moverPeca(id: string, status: string): Promise<Resultado> {
  try {
    await requireUser();
    if (!(PECA_STATUS as readonly string[]).includes(status)) {
      return { ok: false, message: "Status inválido." };
    }
    const supabase = await createClient();
    const patch: Record<string, unknown> = { status };
    // Protocolar manualmente também carimba a data (a baixa de prazo já faz o vínculo do andamento).
    if (status === "protocolada") patch.protocolada_em = hoje();
    const { error } = await supabase.from("pecas").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Peça atualizada." };
  } catch (e) {
    return falha(e);
  }
}

/** Confere a peça provisória (cadastro automático): seta validado=true. */
export async function validarPeca(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("pecas").update({ validado: true }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Peça conferida (validado=true)." };
  } catch (e) {
    return falha(e);
  }
}

/** Edição dos campos da peça (sem mover de coluna). */
export async function atualizarPeca(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const titulo = String(fd.get("titulo") || "").trim();
    if (!titulo) return { ok: false, message: "Título é obrigatório." };
    const tipo = String(fd.get("tipo") || "outra");
    if (!(PECA_TIPO as readonly string[]).includes(tipo)) return { ok: false, message: "Tipo de peça inválido." };
    const patch: Record<string, unknown> = {
      titulo,
      tipo,
      subtipo: String(fd.get("subtipo") || "").trim() || null,
      prioridade: String(fd.get("prioridade") || "media"),
      responsavel: String(fd.get("responsavel") || "Daniel"),
      drive_file_id: String(fd.get("drive_file_id") || "").trim() || null,
    };
    // descrição e data_alvo não vêm na view de leitura; só sobrescreve quando preenchidos (preserva atuais).
    const descricao = String(fd.get("descricao") || "").trim();
    if (descricao) patch.descricao = descricao;
    const data_alvo = String(fd.get("data_alvo") || "");
    if (data_alvo) patch.data_alvo = data_alvo;
    const { error } = await supabase.from("pecas").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Peça atualizada." };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Vincula/atualiza prazo e/ou intimação de origem de uma peça (preserva proveniência).
 * Campos vazios desfazem o vínculo correspondente.
 */
export async function vincularPrazoIntimacao(
  peca_id: string,
  fd: FormData,
): Promise<Resultado> {
  try {
    await requireUser();
    if (!peca_id) return { ok: false, message: "Peça inválida." };
    const supabase = await createClient();
    const prazo_id = String(fd.get("prazo_id") || "").trim() || null;
    const intimacao_id = String(fd.get("intimacao_id") || "").trim() || null;
    const { error } = await supabase
      .from("pecas")
      .update({ prazo_id, intimacao_id })
      .eq("id", peca_id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Vínculos da peça atualizados." };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Cria uma peça a partir de um item de origem (andamento/intimação/tarefa),
 * capturando o trabalho de escrita no momento da avaliação. Herda processo/cliente
 * da origem, preserva a proveniência (origem_andamento_id/intimacao_id/tarefa_id),
 * sugere o prazo aberto do processo e respeita o gate: origem de automação →
 * peça provisória (validado=false). DEDUP por origem: não recria; aponta a existente.
 */
export async function criarPecaDeOrigem(
  tipo_origem: "andamento" | "intimacao" | "tarefa",
  origem_id: string,
  fd: FormData,
): Promise<Resultado> {
  try {
    await requireUser();
    if (!["andamento", "intimacao", "tarefa"].includes(tipo_origem)) {
      return { ok: false, message: "Tipo de origem inválido." };
    }
    if (!origem_id) return { ok: false, message: "Item de origem inválido." };
    const supabase = await createClient();

    const colOrigem =
      tipo_origem === "andamento" ? "origem_andamento_id" : tipo_origem === "intimacao" ? "intimacao_id" : "tarefa_id";

    // DEDUP: já existe peça para esta origem (qualquer status) → não recriar.
    const { data: existente } = await supabase
      .from("pecas")
      .select("id, titulo, status")
      .eq(colOrigem, origem_id)
      .limit(1)
      .maybeSingle();
    if (existente) {
      return {
        ok: false,
        message: `Já existe uma peça para esta origem: "${existente.titulo}" (${humano(existente.status as string)}). Abra-a no módulo Produção em vez de criar outra.`,
      };
    }

    // Herda processo/cliente e a proveniência (cadastro automático → gate provisório).
    let processo_id: string | null = null;
    let cliente_id: string | null = null;
    let auto = false;
    if (tipo_origem === "andamento") {
      const { data: a } = await supabase.from("andamentos").select("processo_id, cadastro_automatico").eq("id", origem_id).maybeSingle();
      if (!a) return { ok: false, message: "Andamento de origem não encontrado." };
      processo_id = (a.processo_id as string) ?? null;
      auto = Boolean(a.cadastro_automatico);
    } else if (tipo_origem === "intimacao") {
      const { data: i } = await supabase.from("intimacoes").select("processo_id, cadastrado_por").eq("id", origem_id).maybeSingle();
      if (!i) return { ok: false, message: "Intimação de origem não encontrada." };
      processo_id = (i.processo_id as string) ?? null;
      auto = (i.cadastrado_por as string) === "cowork";
    } else {
      const { data: t } = await supabase.from("tarefas").select("processo_id, cliente_id").eq("id", origem_id).maybeSingle();
      if (!t) return { ok: false, message: "Tarefa de origem não encontrada." };
      processo_id = (t.processo_id as string) ?? null;
      cliente_id = (t.cliente_id as string) ?? null;
    }

    // Cliente único do processo (quando não herdado da tarefa) — só quando inequívoco.
    if (!cliente_id && processo_id) {
      const { data: cps } = await supabase.from("cliente_processo").select("cliente_id").eq("processo_id", processo_id);
      if (cps && cps.length === 1) cliente_id = cps[0].cliente_id as string;
    }

    // Prazo: override do formulário; senão sugere o prazo aberto do processo
    // (preferindo o vinculado à mesma intimação, depois o de fatal mais próxima).
    let prazo_id: string | null = String(fd.get("prazo_id") || "").trim() || null;
    if (!prazo_id && processo_id) {
      const { data: prz } = await supabase
        .from("prazos")
        .select("id, intimacao_id, data_fatal")
        .eq("processo_id", processo_id)
        .eq("status", "aberto")
        .order("data_fatal", { ascending: true });
      if (prz && prz.length) {
        const casaIntim = tipo_origem === "intimacao" ? prz.find((p) => p.intimacao_id === origem_id) : undefined;
        prazo_id = ((casaIntim?.id as string) ?? (prz[0].id as string)) || null;
      }
    }

    const titulo = String(fd.get("titulo") || "").trim();
    if (!titulo) return { ok: false, message: "Título é obrigatório." };
    const tipo = String(fd.get("tipo") || "outra");
    if (!(PECA_TIPO as readonly string[]).includes(tipo)) return { ok: false, message: "Tipo de peça inválido." };

    const insert: Record<string, unknown> = {
      titulo,
      tipo,
      subtipo: String(fd.get("subtipo") || "").trim() || null,
      descricao: String(fd.get("descricao") || "").trim() || null,
      status: "a_fazer",
      prioridade: String(fd.get("prioridade") || "media"),
      responsavel: String(fd.get("responsavel") || "Daniel"),
      cliente_id,
      processo_id,
      prazo_id,
      [colOrigem]: origem_id,
      data_alvo: String(fd.get("data_alvo") || "") || null,
      drive_file_id: String(fd.get("drive_file_id") || "").trim() || null,
      // Gate do manual: origem de automação nasce provisória (conferir no board).
      validado: !auto,
      cadastro_automatico: auto,
      cadastrado_por: auto ? "cowork" : "manual",
    };

    const { error } = await supabase.from("pecas").insert(insert);
    if (error) {
      // ux_pecas_intimacao_auto (1 peça automática por intimação) — corrida rara.
      if ((error as { code?: string }).code === "23505") {
        return { ok: false, message: "Já existe peça para esta origem (dedup do banco)." };
      }
      throw error;
    }

    revalidarTudo();
    const nomeOrigem = tipo_origem === "andamento" ? "movimentação" : tipo_origem;
    const extra = auto ? " Nasceu PROVISÓRIA (validado=false) — confira no módulo Produção." : "";
    return { ok: true, message: `Petição pendente criada a partir da ${nomeOrigem}.${extra}` };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== ATRIBUIÇÃO (Assumir / Reatribuir) ==================== */

const SEM_SOCIO =
  "Seu e-mail ainda não está mapeado a um sócio (Daniel/Rodolfo). Configure EMAIL_RODOLFO se for o caso.";

/** Assume a peça: responsavel = sócio logado; se estiver em 'a_fazer', vai p/ 'em_elaboracao'. */
export async function assumirPeca(id: string): Promise<Resultado> {
  try {
    const email = await requireUser();
    const socio = socioDoEmail(email);
    if (!socio) return { ok: false, message: SEM_SOCIO };
    const supabase = await createClient();
    const { data: pc } = await supabase.from("pecas").select("status").eq("id", id).maybeSingle();
    if (!pc) return { ok: false, message: "Peça não encontrada." };
    const patch: Record<string, unknown> = { responsavel: socio };
    if (pc.status === "a_fazer") patch.status = "em_elaboracao";
    const { error } = await supabase.from("pecas").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: `Peça assumida por ${socio}${patch.status ? " e movida para Em elaboração" : ""}.` };
  } catch (e) {
    return falha(e);
  }
}

/** Reatribui a peça ao OUTRO sócio (em relação ao usuário logado). */
export async function reatribuirPeca(id: string): Promise<Resultado> {
  try {
    const email = await requireUser();
    const socio = socioDoEmail(email);
    if (!socio) return { ok: false, message: SEM_SOCIO };
    const alvo = outroSocio(socio);
    const supabase = await createClient();
    const { error } = await supabase.from("pecas").update({ responsavel: alvo }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: `Peça reatribuída a ${alvo}.` };
  } catch (e) {
    return falha(e);
  }
}

/** Assume a tarefa: responsavel = sócio logado; se 'pendente', vai p/ 'em_andamento'. */
export async function assumirTarefa(id: string): Promise<Resultado> {
  try {
    const email = await requireUser();
    const socio = socioDoEmail(email);
    if (!socio) return { ok: false, message: SEM_SOCIO };
    const supabase = await createClient();
    const { data: t } = await supabase.from("tarefas").select("status").eq("id", id).maybeSingle();
    if (!t) return { ok: false, message: "Tarefa não encontrada." };
    const patch: Record<string, unknown> = { responsavel: socio };
    if (t.status === "pendente") patch.status = "em_andamento";
    const { error } = await supabase.from("tarefas").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: `Tarefa assumida por ${socio}${patch.status ? " e movida para Em andamento" : ""}.` };
  } catch (e) {
    return falha(e);
  }
}

/** Reatribui a tarefa ao OUTRO sócio (em relação ao usuário logado). */
export async function reatribuirTarefa(id: string): Promise<Resultado> {
  try {
    const email = await requireUser();
    const socio = socioDoEmail(email);
    if (!socio) return { ok: false, message: SEM_SOCIO };
    const alvo = outroSocio(socio);
    const supabase = await createClient();
    const { error } = await supabase.from("tarefas").update({ responsavel: alvo }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: `Tarefa reatribuída a ${alvo}.` };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ ANDAMENTOS ============================ */

export async function criarAndamento(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const processo_id = String(fd.get("processo_id") || "");
    const tipo = String(fd.get("tipo") || "movimentacao_tribunal");
    const data = String(fd.get("data") || hoje());
    const descricao = String(fd.get("descricao") || "").trim();
    const origem = String(fd.get("origem") || "") || null;
    if (!processo_id || !descricao) return { ok: false, message: "Processo e descrição são obrigatórios." };
    if (!(ANDAMENTO_TIPO as readonly string[]).includes(tipo)) return { ok: false, message: "Tipo inválido." };
    const { error } = await supabase.from("andamentos").insert({
      processo_id, tipo, data, descricao, origem,
      cadastrado_por: "manual", cadastro_automatico: false,
    });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Andamento registrado." };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ FINANCEIRO ============================ */

export async function marcarPagamento(
  id: string,
  status: string,
  valor_pago?: number,
): Promise<Resultado> {
  try {
    await requireUser();
    if (!(PAGAMENTO_STATUS as readonly string[]).includes(status)) {
      return { ok: false, message: "Status inválido." };
    }
    const supabase = await createClient();
    const patch: Record<string, unknown> = { status };
    if (status === "pago") {
      patch.pago_em = hoje();
      if (valor_pago != null) patch.valor_pago = valor_pago;
    }
    const { error } = await supabase.from("pagamentos").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: status === "pago" ? "Parcela marcada como paga." : "Parcela atualizada." };
  } catch (e) {
    return falha(e);
  }
}

/** Atalho: marca a parcela como paga (data de hoje, valor da própria parcela). */
export async function marcarPago(id: string): Promise<Resultado> {
  return marcarPagamento(id, "pago");
}

export async function rodarMarcarAtrasados(): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_marcar_atrasados");
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Parcelas vencidas marcadas como atrasadas." };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ SISTEMA ============================ */

export async function atualizarSugestao(id: number, status: string): Promise<Resultado> {
  try {
    await requireUser();
    if (!(SUGESTAO_STATUS as readonly string[]).includes(status)) {
      return { ok: false, message: "Status inválido." };
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("sugestoes_sistema")
      .update({ status, decidida_em: agora() })
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/sistema");
    return { ok: true, message: "Sugestão atualizada." };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== VALIDAÇÃO PRECISA (editar + validar) ==================== */

export async function validarPrazoEditado(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const ato = String(fd.get("ato") || "").trim();
    const data_fatal = String(fd.get("data_fatal") || "");
    const data_interna = String(fd.get("data_interna") || "") || null;
    const responsavel = String(fd.get("responsavel") || "Daniel");
    const tipo_contagem = String(fd.get("tipo_contagem") || "corridos");
    if (!ato || !data_fatal) return { ok: false, message: "Ato e data fatal são obrigatórios." };

    const { data: pr } = await supabase
      .from("prazos")
      .select("calendar_event_id, processos(numero_cnj,numero_registro_tribunal,cliente_processo(clientes(nome)))")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("prazos")
      .update({ ato, data_fatal, data_interna, responsavel, tipo_contagem, validado: true, validado_em: agora() })
      .eq("id", id);
    if (error) throw error;

    let msg = "Prazo validado com os ajustes.";
    const fatalId = await confirmarPrazo(
      { ato, dataFatal: data_fatal, dataInterna: data_interna, ref: refProcesso(pr?.processos) },
      (pr?.calendar_event_id as string | null) ?? null,
    );
    if (fatalId) {
      await supabase.from("prazos").update({ calendar_event_id_fatal: fatalId }).eq("id", id);
      msg += " Marcador fatal (vermelho) no Calendar.";
    } else if (calendarConfigurado()) {
      msg += " (Calendar indisponível — gravado só no banco.)";
    }
    revalidarTudo();
    return { ok: true, message: msg };
  } catch (e) {
    return falha(e);
  }
}

export async function validarAudienciaEditada(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const tipo = String(fd.get("tipo") || "");
    const dataLocal = String(fd.get("data_hora") || ""); // YYYY-MM-DDTHH:mm
    const modalidade = String(fd.get("modalidade") || "") || null;
    const local_link = String(fd.get("local_link") || "") || null;
    const responsavel = String(fd.get("responsavel") || "Daniel");
    if (!dataLocal) return { ok: false, message: "Data e hora são obrigatórias." };
    const data_hora = `${dataLocal}:00-03:00`; // horário de Brasília

    const { data: a } = await supabase
      .from("audiencias")
      .select("processos(numero_cnj,cliente_processo(clientes(nome)))")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("audiencias")
      .update({ tipo, data_hora, modalidade, local_link, responsavel, validado: true, validado_em: agora() })
      .eq("id", id);
    if (error) throw error;

    let msg = "Audiência validada com os ajustes.";
    const evId = await criarEventoAudiencia({ tipo, dataHora: data_hora, modalidade, local: local_link, ref: refProcesso(a?.processos) });
    if (evId) {
      await supabase.from("audiencias").update({ calendar_event_id: evId }).eq("id", id);
      msg += " Evento no Calendar.";
    } else if (calendarConfigurado()) {
      msg += " (Calendar indisponível — gravado só no banco.)";
    }
    revalidarTudo();
    return { ok: true, message: msg };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Edição livre de uma audiência (sem mexer no estado de validação).
 * Útil sobretudo em inclusões automáticas de processos sigilosos, que chegam
 * com dados incompletos. Se já validada e com evento no Calendar, re-sincroniza
 * o evento existente (patch) em vez de duplicar.
 */
export async function atualizarAudiencia(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const tipo = String(fd.get("tipo") || "").trim();
    const dataLocal = String(fd.get("data_hora") || ""); // YYYY-MM-DDTHH:mm
    const modalidade = String(fd.get("modalidade") || "") || null;
    const local_link = String(fd.get("local_link") || "") || null;
    const responsavel = String(fd.get("responsavel") || "Daniel");
    const observacoes = String(fd.get("observacoes") || "").trim() || null;
    if (!tipo) return { ok: false, message: "Tipo é obrigatório." };
    if (!dataLocal) return { ok: false, message: "Data e hora são obrigatórias." };
    const data_hora = `${dataLocal}:00-03:00`; // horário de Brasília

    const { data: a } = await supabase
      .from("audiencias")
      .select("validado, calendar_event_id, processos(numero_cnj,numero_registro_tribunal,cliente_processo(clientes(nome)))")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("audiencias")
      .update({ tipo, data_hora, modalidade, local_link, responsavel, observacoes })
      .eq("id", id);
    if (error) throw error;

    let msg = "Audiência atualizada.";
    if (a?.validado && a.calendar_event_id) {
      const ok = await atualizarEventoAudiencia(a.calendar_event_id, {
        tipo, dataHora: data_hora, modalidade, local: local_link, ref: refProcesso(a?.processos),
      });
      if (ok) msg += " Evento do Calendar atualizado.";
      else if (calendarConfigurado()) msg += " (Calendar indisponível — gravado só no banco.)";
    }
    revalidarTudo();
    return { ok: true, message: msg };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== EDIÇÃO (UPDATE) ==================== */

function patchDeCampos(fd: FormData, campos: string[]): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const c of campos) {
    if (!fd.has(c)) continue;
    const v = String(fd.get(c) ?? "").trim();
    patch[c] = v === "" ? null : v;
  }
  return patch;
}

export async function atualizarProcesso(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const patch = patchDeCampos(fd, [
      "numero_cnj", "numero_registro_tribunal", "tribunal", "vara_comarca", "uf",
      "instancia", "area", "classe", "assunto", "fase", "status", "responsavel",
      "link_tribunal", "observacoes",
    ]);
    patch.segredo_justica = fd.get("segredo_justica") === "on";
    if (!patch.numero_cnj && !patch.numero_registro_tribunal) {
      return { ok: false, message: "Informe ao menos o CNJ ou o nº de registro." };
    }
    const { error } = await supabase.from("processos").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Processo atualizado." };
  } catch (e) {
    return falha(e);
  }
}

export async function atualizarCliente(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const patch = patchDeCampos(fd, [
      "nome", "cpf", "rg", "data_nascimento", "nome_mae", "telefone", "email",
      "endereco", "cidade", "uf", "situacao_prisional", "unidade_prisional",
      "contato_familia", "observacoes",
    ]);
    if (!patch.nome) return { ok: false, message: "Nome é obrigatório." };
    const { error } = await supabase.from("clientes").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Cliente atualizado." };
  } catch (e) {
    return falha(e);
  }
}

/** Marca/desmarca um cliente como favorito do escritório (toggle pela estrela). */
export async function alternarFavorito(cliente_id: string, valor: boolean): Promise<Resultado> {
  try {
    await requireUser();
    if (!cliente_id) return { ok: false, message: "Cliente inválido." };
    const supabase = await createClient();
    const { error } = await supabase.from("clientes").update({ favorito: valor }).eq("id", cliente_id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: valor ? "Adicionado aos favoritos." : "Removido dos favoritos." };
  } catch (e) {
    return falha(e);
  }
}

/** Adiciona um cliente aos favoritos a partir do seletor (FormModal). */
export async function favoritarCliente(fd: FormData): Promise<Resultado> {
  return alternarFavorito(String(fd.get("cliente_id") || "").trim(), true);
}

/* ==================== CRIAÇÃO COM DEDUP ==================== */

export async function criarCliente(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const nome = String(fd.get("nome") || "").trim();
    if (!nome) return { ok: false, message: "Nome é obrigatório." };
    const cpf = String(fd.get("cpf") || "").trim() || null;
    const forcar = fd.get("forcar") === "on";

    // Deduplicação (nome normalizado / CPF) — consulta o banco direto, usando a
    // mesma normalização da coluna gerada clientes.nome_normalizado = upper(unaccent(nome)).
    if (!forcar) {
      const nnDb = nome.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toUpperCase();
      const cd = soDigitos(cpf);
      const dups: { id: string; nome: string }[] = [];
      const vistos = new Set<string>();
      const porNome = await supabase
        .from("clientes")
        .select("id, nome")
        .eq("ativo", true)
        .eq("nome_normalizado", nnDb)
        .limit(3);
      for (const d of porNome.data ?? []) { if (!vistos.has(d.id as string)) { vistos.add(d.id as string); dups.push({ id: d.id as string, nome: d.nome as string }); } }
      if (cd) {
        const porCpf = await supabase
          .from("clientes")
          .select("id, nome")
          .eq("ativo", true)
          .eq("cpf", cpf)
          .limit(3);
        for (const d of porCpf.data ?? []) { if (!vistos.has(d.id as string)) { vistos.add(d.id as string); dups.push({ id: d.id as string, nome: d.nome as string }); } }
      }
      if (dups.length) {
        const lista = dups.slice(0, 3).map((d) => d.nome).join("; ");
        return {
          ok: false,
          message: `Possível duplicata/homônimo: ${lista}. Confira; se for outra pessoa, marque "criar mesmo assim".`,
        };
      }
    }

    const { error } = await supabase.from("clientes").insert({
      nome,
      cpf,
      situacao_prisional: String(fd.get("situacao_prisional") || "solto"),
      uf: String(fd.get("uf") || "").trim() || null,
      telefone: String(fd.get("telefone") || "").trim() || null,
      unidade_prisional: String(fd.get("unidade_prisional") || "").trim() || null,
      observacoes: String(fd.get("observacoes") || "").trim() || null,
      ativo: true,
      cadastro_automatico: false,
      cadastrado_por: "manual",
    });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Cliente cadastrado." };
  } catch (e) {
    return falha(e);
  }
}

export async function criarProcesso(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const numero_cnj = String(fd.get("numero_cnj") || "").trim() || null;
    const numero_registro_tribunal = String(fd.get("numero_registro_tribunal") || "").trim() || null;
    const tribunal = String(fd.get("tribunal") || "").trim();
    if (!numero_cnj && !numero_registro_tribunal) {
      return { ok: false, message: "Informe o CNJ ou o nº de registro do tribunal." };
    }
    if (!tribunal) return { ok: false, message: "Tribunal é obrigatório." };
    const forcar = fd.get("forcar") === "on";

    if (!forcar) {
      const ors: string[] = [];
      if (numero_cnj) ors.push(`numero_cnj.eq.${numero_cnj}`);
      if (numero_registro_tribunal) ors.push(`numero_registro_tribunal.eq.${numero_registro_tribunal}`);
      const { data: existentes } = await supabase
        .from("processos")
        .select("id, numero_cnj, numero_registro_tribunal")
        .or(ors.join(","));
      if (existentes?.length) {
        // Sugestão 28: se o achado for um tombstone de merge, o processo vivo é o canônico.
        const canonico = await resolverProcesso(supabase, existentes[0].id as string);
        const mesclado = canonico !== (existentes[0].id as string);
        return {
          ok: false,
          message: mesclado
            ? "Este CNJ/registro pertence a um processo já mesclado — o processo vivo está no acervo. Use a busca para abri-lo."
            : "Já existe processo com este CNJ/registro. Use a busca para abri-lo.",
        };
      }
    }

    const { data: novo, error } = await supabase
      .from("processos")
      .insert({
        numero_cnj,
        numero_registro_tribunal,
        tribunal,
        vara_comarca: String(fd.get("vara_comarca") || "").trim() || null,
        uf: String(fd.get("uf") || "").trim() || null,
        instancia: String(fd.get("instancia") || "1grau"),
        area: String(fd.get("area") || "criminal"),
        classe: String(fd.get("classe") || "").trim() || null,
        status: "ativo",
        responsavel: String(fd.get("responsavel") || "Daniel"),
        segredo_justica: fd.get("segredo_justica") === "on",
        cadastro_automatico: false,
        cadastrado_por: "manual",
      })
      .select("id")
      .single();
    if (error) throw error;

    // Vínculo opcional com cliente: existente (cliente_id) ou novo (novo_cliente_nome).
    let cliente_id = String(fd.get("cliente_id") || "").trim();
    let msg = "Processo cadastrado.";
    const novoNome = String(fd.get("novo_cliente_nome") || "").trim();
    if (!cliente_id && novoNome) {
      const { data: c, error: cErr } = await supabase
        .from("clientes")
        .insert({ nome: novoNome, situacao_prisional: "solto", ativo: true, cadastro_automatico: false, cadastrado_por: "manual" })
        .select("id")
        .single();
      if (cErr) throw cErr;
      cliente_id = c.id as string;
      msg += " Cliente criado e vinculado.";
    }
    if (cliente_id && novo) {
      await supabase.from("cliente_processo").insert({
        cliente_id,
        processo_id: novo.id,
        papel: String(fd.get("papel") || "reu"),
      });
    }
    revalidarTudo();
    return { ok: true, message: msg };
  } catch (e) {
    return falha(e);
  }
}

type CosturaResultado = { ok: true; procId: string; msg: string } | { ok: false; message: string };

/**
 * Costura/identifica o processo (dedup por CNJ/registro, resolvendo tombstones de
 * merge para o canônico via fn_resolver_processo, e completando o CNJ num registro
 * existente sem sobrescrever o preenchido) e vincula o cliente (existente ou novo).
 * Núcleo compartilhado pelos assistentes "promover órfã" (prazo/intimação/andamento).
 */
async function costurarProcessoCliente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fd: FormData,
): Promise<CosturaResultado> {
  let procId = String(fd.get("processo_id") || "").trim();
  const cnj = String(fd.get("numero_cnj") || "").trim() || null;
  const reg = String(fd.get("numero_registro_tribunal") || "").trim() || null;
  const tribunal = String(fd.get("tribunal") || "").trim();
  let msg = "";

  if (procId) {
    // Processo existente selecionado: seguir o merge se for um tombstone (Sugestão 28).
    const alvo = await resolverProcesso(supabase, procId);
    if (alvo !== procId) { procId = alvo; msg += "Processo selecionado estava mesclado; seguido para o canônico vivo. "; }
    // completar CNJ se faltava e foi informado (nunca sobrescreve preenchido).
    if (cnj) {
      const { data: ex } = await supabase.from("processos").select("numero_cnj").eq("id", procId).single();
      if (ex && !ex.numero_cnj) {
        const { data: dup } = await supabase.from("processos").select("id").eq("numero_cnj", cnj).neq("id", procId).maybeSingle();
        if (dup) return { ok: false, message: "Já existe outro processo com este CNJ." };
        await supabase.from("processos").update({ numero_cnj: cnj }).eq("id", procId);
        msg += "CNJ completado no processo existente. ";
      }
    }
  } else {
    // Sem seleção: dedup por CNJ/registro (regra do manual).
    if (!cnj && !reg) return { ok: false, message: "Selecione um processo existente ou informe CNJ/registro para criar." };
    const ors: string[] = [];
    if (cnj) ors.push(`numero_cnj.eq.${cnj}`);
    if (reg) ors.push(`numero_registro_tribunal.eq.${reg}`);
    const { data: existentes } = await supabase
      .from("processos")
      .select("id, numero_cnj, numero_registro_tribunal")
      .or(ors.join(","));
    if (existentes && existentes.length === 1) {
      // Seguir o merge se o achado for um tombstone (Sugestão 28).
      procId = await resolverProcesso(supabase, existentes[0].id as string);
      const { data: canon } = await supabase.from("processos").select("numero_cnj").eq("id", procId).single();
      if (cnj && canon && !canon.numero_cnj) {
        await supabase.from("processos").update({ numero_cnj: cnj }).eq("id", procId);
        msg += "Processo localizado por registro; CNJ completado no mesmo registro. ";
      } else {
        msg += "Processo já existente reaproveitado. ";
      }
    } else if (existentes && existentes.length > 1) {
      return { ok: false, message: "Mais de um processo corresponde — abra pela busca e selecione manualmente." };
    } else {
      if (!tribunal) return { ok: false, message: "Tribunal é obrigatório para criar o processo." };
      const { data: novo, error } = await supabase
        .from("processos")
        .insert({
          numero_cnj: cnj,
          numero_registro_tribunal: reg,
          tribunal,
          vara_comarca: String(fd.get("vara_comarca") || "").trim() || null,
          uf: String(fd.get("uf") || "").trim() || null,
          instancia: String(fd.get("instancia") || "1grau"),
          area: String(fd.get("area") || "criminal"),
          status: "ativo",
          responsavel: String(fd.get("responsavel") || "Daniel"),
          segredo_justica: fd.get("segredo_justica") === "on",
          cadastro_automatico: false,
          cadastrado_por: "manual",
        })
        .select("id")
        .single();
      if (error) throw error;
      procId = novo.id as string;
      msg += "Processo criado. ";
    }
  }

  if (!procId) return { ok: false, message: "Não foi possível resolver o processo." };

  // Cliente: existente ou novo (opcional, mas recomendado).
  let cliente_id = String(fd.get("cliente_id") || "").trim();
  const novoNome = String(fd.get("novo_cliente_nome") || "").trim();
  if (!cliente_id && novoNome) {
    const { data: c, error: cErr } = await supabase
      .from("clientes")
      .insert({ nome: novoNome, situacao_prisional: "solto", ativo: true, cadastro_automatico: false, cadastrado_por: "manual" })
      .select("id")
      .single();
    if (cErr) throw cErr;
    cliente_id = c.id as string;
    msg += "Cliente criado. ";
  }
  if (cliente_id) {
    const { data: ja } = await supabase
      .from("cliente_processo")
      .select("id")
      .eq("processo_id", procId)
      .eq("cliente_id", cliente_id)
      .maybeSingle();
    if (!ja) {
      const { error: vErr } = await supabase
        .from("cliente_processo")
        .insert({ processo_id: procId, cliente_id, papel: String(fd.get("papel") || "reu") });
      if (vErr) throw vErr;
      msg += "Cliente vinculado. ";
    }
  }

  return { ok: true, procId, msg };
}

/**
 * Promove um prazo ÓRFÃO (sem processo): costura/identifica o processo, vincula o
 * cliente e grava prazos.processo_id. Só então (CHECK satisfeito) pode validar.
 */
export async function promoverPrazoOrfao(prazo_id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    if (!prazo_id) return { ok: false, message: "Prazo inválido." };
    const supabase = await createClient();

    const { data: pr } = await supabase.from("prazos").select("id, processo_id").eq("id", prazo_id).single();
    if (!pr) return { ok: false, message: "Prazo não encontrado." };
    if (pr.processo_id) return { ok: false, message: "Este prazo já tem processo vinculado (não é órfão)." };

    const cost = await costurarProcessoCliente(supabase, fd);
    if (!cost.ok) return cost;
    let msg = cost.msg;

    // Costura o prazo ao processo — a partir daqui o CHECK do banco está satisfeito.
    const { error: upErr } = await supabase.from("prazos").update({ processo_id: cost.procId }).eq("id", prazo_id);
    if (upErr) throw upErr;
    msg += "Prazo vinculado (saiu da fila de órfãos).";

    // Validar agora? (só é possível DEPOIS de ter processo).
    if (fd.get("validar_agora") === "on") {
      const r = await validarPrazo(prazo_id);
      msg += r.ok ? ` ${r.message}` : ` (Validação falhou: ${r.message})`;
    }

    revalidarTudo();
    return { ok: true, message: msg.trim() };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Promove uma INTIMAÇÃO ou ANDAMENTO órfão: costura/identifica o processo (mesma
 * lógica/dedup do prazo órfão, resolvendo tombstones) e grava o processo_id no item.
 * Fase 2 (RLS, auditada, nunca delete); resumo+confirmação acontecem na UI.
 */
export async function promoverOrfa(
  tipo: "intimacao" | "andamento",
  origem_id: string,
  fd: FormData,
): Promise<Resultado> {
  try {
    await requireUser();
    if (!["intimacao", "andamento"].includes(tipo)) return { ok: false, message: "Tipo de origem inválido." };
    if (!origem_id) return { ok: false, message: "Item inválido." };
    const supabase = await createClient();
    const tabela = tipo === "intimacao" ? "intimacoes" : "andamentos";

    const { data: row } = await supabase.from(tabela).select("id, processo_id").eq("id", origem_id).maybeSingle();
    if (!row) return { ok: false, message: tipo === "intimacao" ? "Intimação não encontrada." : "Andamento não encontrado." };
    if (row.processo_id) return { ok: false, message: "Este item já tem processo vinculado (não é órfão)." };

    const cost = await costurarProcessoCliente(supabase, fd);
    if (!cost.ok) return cost;
    let msg = cost.msg;

    const { error: upErr } = await supabase.from(tabela).update({ processo_id: cost.procId }).eq("id", origem_id);
    if (upErr) throw upErr;
    msg += tipo === "intimacao"
      ? "Intimação vinculada ao processo (saiu da fila de órfãs)."
      : "Andamento vinculado ao processo (saiu da fila de órfãos).";

    revalidarTudo();
    return { ok: true, message: msg.trim() };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== MESCLAGEM (merge de duplicados) ==================== */

/** Mescla dois clientes via RPC transacional. Duplicado é desativado (nunca apagado). */
export async function mesclarCliente(canonico: string, duplicado: string): Promise<Resultado> {
  try {
    await requireUser();
    if (!canonico || !duplicado) return { ok: false, message: "Selecione o canônico e o duplicado." };
    if (canonico === duplicado) return { ok: false, message: "Canônico e duplicado não podem ser o mesmo registro." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("fn_mesclar_cliente", { canonico, duplicado });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: (data as string) ?? "Cliente mesclado." };
  } catch (e) {
    return falha(e);
  }
}

/** Mescla dois processos via RPC transacional. Duplicado vira status arquivado (nunca apagado). */
export async function mesclarProcesso(canonico: string, duplicado: string): Promise<Resultado> {
  try {
    await requireUser();
    if (!canonico || !duplicado) return { ok: false, message: "Selecione o canônico e o duplicado." };
    if (canonico === duplicado) return { ok: false, message: "Canônico e duplicado não podem ser o mesmo registro." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("fn_mesclar_processo", { canonico, duplicado });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: (data as string) ?? "Processo mesclado." };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== "EXCLUSÃO" = arquivar/desativar (soft) ==================== */

export async function arquivarProcesso(id: string, motivo: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const obs = motivo?.trim() ? `Arquivado: ${motivo.trim()}` : null;
    const patch: Record<string, unknown> = { status: "arquivado" };
    if (obs) patch.observacoes = obs;
    const { error } = await supabase.from("processos").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Processo arquivado (não foi apagado; auditado)." };
  } catch (e) {
    return falha(e);
  }
}

export async function desativarCliente(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("clientes").update({ ativo: false }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Cliente desativado (mantido no banco; auditado)." };
  } catch (e) {
    return falha(e);
  }
}

export async function cancelarAudiencia(id: string, motivo: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const obs = motivo?.trim() ? motivo.trim() : null;
    const patch: Record<string, unknown> = { status: "cancelada" };
    if (obs) patch.observacoes = obs;
    const { error } = await supabase.from("audiencias").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Audiência cancelada (auditado)." };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Redesigna uma audiência: marca a antiga como `redesignada` (preserva a data
 * original no histórico) e cria uma NOVA audiência já vinculada à anterior
 * (redesignada_de), nascendo validado=false — a fatal/Calendar entra na validação.
 */
export async function redesignarAudiencia(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const dataLocal = String(fd.get("data_hora") || ""); // YYYY-MM-DDTHH:mm
    if (!dataLocal) return { ok: false, message: "Nova data e hora são obrigatórias." };
    const data_hora = `${dataLocal}:00-03:00`;
    const modalidade = String(fd.get("modalidade") || "") || null;
    const local_link = String(fd.get("local_link") || "") || null;
    const observacoes = String(fd.get("observacoes") || "").trim() || null;

    const { data: ant } = await supabase
      .from("audiencias")
      .select("processo_id, tipo, responsavel")
      .eq("id", id)
      .single();
    if (!ant) return { ok: false, message: "Audiência original não encontrada." };

    const { error: eUp } = await supabase
      .from("audiencias")
      .update({ status: "redesignada" })
      .eq("id", id);
    if (eUp) throw eUp;

    const { error: eIns } = await supabase.from("audiencias").insert({
      processo_id: ant.processo_id,
      tipo: String(fd.get("tipo") || ant.tipo),
      data_hora,
      modalidade,
      local_link,
      responsavel: String(fd.get("responsavel") || ant.responsavel || "Daniel"),
      observacoes,
      status: "designada",
      validado: false,
      redesignada_de: id,
    });
    if (eIns) throw eIns;

    revalidarTudo();
    return { ok: true, message: "Audiência redesignada — nova data criada (aguardando validação)." };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ COMPROMISSOS ============================ */

/** Cria um compromisso na agenda (e tenta espelhar no Google Calendar). */
export async function criarCompromisso(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const titulo = String(fd.get("titulo") || "").trim();
    if (!titulo) return { ok: false, message: "Título é obrigatório." };
    const dataLocal = String(fd.get("data_hora") || ""); // YYYY-MM-DDTHH:mm
    if (!dataLocal) return { ok: false, message: "Data e hora são obrigatórias." };
    const data_hora = `${dataLocal}:00-03:00`;
    const descricao = String(fd.get("descricao") || "").trim() || null;
    const local = String(fd.get("local") || "").trim() || null;
    const responsavel = String(fd.get("responsavel") || "Daniel");
    const cliente_id = String(fd.get("cliente_id") || "") || null;
    const processo_id = String(fd.get("processo_id") || "") || null;
    const tarefa_id = String(fd.get("tarefa_id") || "") || null;

    const { data: ins, error } = await supabase
      .from("compromissos")
      .insert({ titulo, descricao, data_hora, local, responsavel, cliente_id, processo_id, tarefa_id, status: "agendado" })
      .select("id")
      .single();
    if (error) throw error;

    let msg = "Compromisso criado na agenda.";
    const evId = await criarEventoCompromisso({ titulo, dataHora: data_hora, local, descricao });
    if (evId) {
      await supabase.from("compromissos").update({ calendar_event_id: evId }).eq("id", ins.id);
      msg += " Evento criado no Google Calendar.";
    } else if (calendarConfigurado()) {
      msg += " (Calendar indisponível agora — gravado só no banco.)";
    }
    revalidarTudo();
    return { ok: true, message: msg };
  } catch (e) {
    return falha(e);
  }
}

/** Cancela um compromisso (não apaga — muda o status; auditado). */
export async function cancelarCompromisso(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("compromissos").update({ status: "cancelado" }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Compromisso cancelado." };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== FINANCEIRO: contratos, parcelas, despesas ==================== */

function valorNumerico(v: FormDataEntryValue | null): number {
  // Aceita "1.234,56" ou "1234.56" ou "1234".
  const s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return NaN;
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(normal);
}

export async function criarContrato(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const cliente_id = String(fd.get("cliente_id") || "").trim();
    const objeto = String(fd.get("objeto") || "").trim();
    const valor_total = valorNumerico(fd.get("valor_total"));
    if (!cliente_id) return { ok: false, message: "Selecione o cliente." };
    if (!objeto) return { ok: false, message: "Descreva o objeto da contratação." };
    if (!Number.isFinite(valor_total) || valor_total <= 0) return { ok: false, message: "Valor total inválido." };

    const { error } = await supabase.from("contratos").insert({
      cliente_id,
      objeto,
      valor_total,
      contratante: String(fd.get("contratante") || "").trim() || null,
      forma_pagamento: String(fd.get("forma_pagamento") || "").trim() || null,
      data_contrato: String(fd.get("data_contrato") || "") || hoje(),
      status: "vigente",
      observacoes: String(fd.get("observacoes") || "").trim() || null,
    });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Contrato criado." };
  } catch (e) {
    return falha(e);
  }
}

export async function atualizarContrato(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const status = String(fd.get("status") || "vigente");
    if (!(CONTRATO_STATUS as readonly string[]).includes(status)) {
      return { ok: false, message: "Status de contrato inválido." };
    }
    const objeto = String(fd.get("objeto") || "").trim();
    if (!objeto) return { ok: false, message: "Objeto é obrigatório." };
    const patch: Record<string, unknown> = {
      objeto,
      status,
      contratante: String(fd.get("contratante") || "").trim() || null,
      forma_pagamento: String(fd.get("forma_pagamento") || "").trim() || null,
      observacoes: String(fd.get("observacoes") || "").trim() || null,
    };
    if (fd.has("valor_total")) {
      const v = valorNumerico(fd.get("valor_total"));
      if (Number.isFinite(v) && v > 0) patch.valor_total = v;
    }
    const { error } = await supabase.from("contratos").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Contrato atualizado." };
  } catch (e) {
    return falha(e);
  }
}

export async function criarParcela(contrato_id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const valor = valorNumerico(fd.get("valor"));
    const vencimento = String(fd.get("vencimento") || "");
    const numero_parcela = Number(String(fd.get("numero_parcela") || "0")) || null;
    if (!contrato_id) return { ok: false, message: "Contrato não identificado." };
    if (!Number.isFinite(valor) || valor <= 0) return { ok: false, message: "Valor inválido." };
    if (!vencimento) return { ok: false, message: "Informe o vencimento." };
    const { error } = await supabase.from("pagamentos").insert({
      contrato_id, numero_parcela, valor, vencimento,
      status: "a_vencer", forma: String(fd.get("forma") || "").trim() || null,
    });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Parcela adicionada." };
  } catch (e) {
    return falha(e);
  }
}

export async function criarDespesa(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const descricao = String(fd.get("descricao") || "").trim();
    const valor = valorNumerico(fd.get("valor"));
    if (!descricao) return { ok: false, message: "Descreva a despesa." };
    if (!Number.isFinite(valor) || valor <= 0) return { ok: false, message: "Valor inválido." };
    const { error } = await supabase.from("despesas").insert({
      descricao,
      valor,
      categoria: String(fd.get("categoria") || "outra"),
      data: String(fd.get("data") || "") || hoje(),
      reembolsavel: fd.get("reembolsavel") === "on",
      observacoes: String(fd.get("observacoes") || "").trim() || null,
    });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Despesa lançada." };
  } catch (e) {
    return falha(e);
  }
}

export async function marcarDespesaReembolsada(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("despesas").update({ reembolsada: true }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Despesa marcada como reembolsada." };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== PARTES (cliente ↔ processo) ==================== */

export async function vincularClienteProcesso(processo_id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const cliente_id = String(fd.get("cliente_id") || "").trim();
    const papel = String(fd.get("papel") || "reu");
    if (!cliente_id) return { ok: false, message: "Selecione o cliente." };

    const { data: ja } = await supabase
      .from("cliente_processo")
      .select("id")
      .eq("processo_id", processo_id)
      .eq("cliente_id", cliente_id)
      .maybeSingle();
    if (ja) return { ok: false, message: "Esse cliente já está vinculado a este processo." };

    const { error } = await supabase
      .from("cliente_processo")
      .insert({ processo_id, cliente_id, papel });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Cliente vinculado ao processo." };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== EDIÇÃO de prazo / tarefa ==================== */

export async function atualizarPrazo(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const ato = String(fd.get("ato") || "").trim();
    const data_fatal = String(fd.get("data_fatal") || "");
    if (!ato || !data_fatal) return { ok: false, message: "Ato e data fatal são obrigatórios." };
    const patch: Record<string, unknown> = {
      ato,
      data_fatal,
      data_interna: String(fd.get("data_interna") || "") || null,
      responsavel: String(fd.get("responsavel") || "Daniel"),
      tipo_contagem: String(fd.get("tipo_contagem") || "corridos"),
    };
    const { data: pr } = await supabase
      .from("prazos")
      .select("validado, calendar_event_id_fatal, processos(numero_cnj,numero_registro_tribunal,cliente_processo(clientes(nome)))")
      .eq("id", id)
      .single();
    const { error } = await supabase.from("prazos").update(patch).eq("id", id);
    if (error) throw error;

    let msg = "Prazo atualizado.";
    // Se já validado, re-sincroniza o marcador fatal no Calendar.
    if (pr?.validado) {
      const fatalId = await confirmarPrazo(
        { ato, dataFatal: data_fatal, dataInterna: (patch.data_interna as string | null) ?? null, ref: refProcesso(pr.processos) },
        (pr.calendar_event_id_fatal as string | null) ?? null,
      );
      if (fatalId) {
        await supabase.from("prazos").update({ calendar_event_id_fatal: fatalId }).eq("id", id);
        msg += " Calendar atualizado.";
      }
    }
    revalidarTudo();
    return { ok: true, message: msg };
  } catch (e) {
    return falha(e);
  }
}

export async function atualizarTarefa(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const titulo = String(fd.get("titulo") || "").trim();
    if (!titulo) return { ok: false, message: "Título é obrigatório." };
    const patch: Record<string, unknown> = {
      titulo,
      descricao: String(fd.get("descricao") || "").trim() || null,
      prioridade: String(fd.get("prioridade") || "media"),
      responsavel: String(fd.get("responsavel") || "Daniel"),
      data_limite: String(fd.get("data_limite") || "") || null,
    };
    const { error } = await supabase.from("tarefas").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Tarefa atualizada." };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== ESTUDOS DE CASO (estratégia) ==================== */

export async function criarEstudo(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const titulo = String(fd.get("titulo") || "").trim();
    if (!titulo) return { ok: false, message: "Título é obrigatório." };
    const { error } = await supabase
      .from("estudos_caso")
      .insert({
        titulo,
        cliente_id: String(fd.get("cliente_id") || "") || null,
        tipo: String(fd.get("tipo") || "geral"),
        status: "em_elaboracao",
        conteudo: String(fd.get("conteudo") || "").trim() || null,
        teses: String(fd.get("teses") || "").trim() || null,
        jurisprudencia: String(fd.get("jurisprudencia") || "").trim() || null,
        drive_file_id: String(fd.get("drive_file_id") || "").trim() || null,
        cadastrado_por: "manual",
        cadastro_automatico: false,
      });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Estudo criado." };
  } catch (e) {
    return falha(e);
  }
}

export async function atualizarEstudo(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const patch: Record<string, unknown> = {};
    const titulo = String(fd.get("titulo") || "").trim();
    if (titulo) patch.titulo = titulo;
    const tipo = String(fd.get("tipo") || "").trim();
    if (tipo) patch.tipo = tipo;
    const status = String(fd.get("status") || "").trim();
    if (status) patch.status = status;
    for (const campo of ["conteudo", "teses", "jurisprudencia", "drive_file_id"] as const) {
      const v = String(fd.get(campo) || "").trim();
      if (v) patch[campo] = v;
    }
    if (!Object.keys(patch).length) return { ok: false, message: "Nada para atualizar." };
    const { error } = await supabase.from("estudos_caso").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Estudo atualizado." };
  } catch (e) {
    return falha(e);
  }
}

export async function vincularProcessoEstudo(estudo_id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const processo_id = String(fd.get("processo_id") || "").trim();
    if (!processo_id) return { ok: false, message: "Selecione o processo." };
    const { data: ja } = await supabase
      .from("estudo_processo")
      .select("id")
      .eq("estudo_id", estudo_id)
      .eq("processo_id", processo_id)
      .maybeSingle();
    if (ja) {
      const { error } = await supabase
        .from("estudo_processo")
        .update({
          diagnostico: String(fd.get("diagnostico") || "").trim() || null,
          estrategia: String(fd.get("estrategia") || "").trim() || null,
          prioridade: String(fd.get("prioridade") || "media"),
        })
        .eq("id", ja.id);
      if (error) throw error;
      revalidarTudo();
      return { ok: true, message: "Diagnóstico do processo atualizado neste estudo." };
    }
    const { error } = await supabase.from("estudo_processo").insert({
      estudo_id,
      processo_id,
      diagnostico: String(fd.get("diagnostico") || "").trim() || null,
      estrategia: String(fd.get("estrategia") || "").trim() || null,
      prioridade: String(fd.get("prioridade") || "media"),
    });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Processo vinculado ao estudo." };
  } catch (e) {
    return falha(e);
  }
}

export async function criarObjetivo(estudo_id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const objetivo = String(fd.get("objetivo") || "").trim();
    if (!objetivo) return { ok: false, message: "Descreva o objetivo." };
    const { error } = await supabase.from("estudo_objetivos").insert({
      estudo_id,
      objetivo,
      beneficio_alvo: String(fd.get("beneficio_alvo") || "").trim() || null,
      data_alvo: String(fd.get("data_alvo") || "") || null,
      processo_id: String(fd.get("processo_id") || "") || null,
      processo_instrumento_id: String(fd.get("processo_instrumento_id") || "") || null,
      status: String(fd.get("status") || "planejado"),
      observacoes: String(fd.get("observacoes") || "").trim() || null,
    });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Objetivo criado." };
  } catch (e) {
    return falha(e);
  }
}

/** Atualiza o objetivo conforme as decisões saem (status/resultado/marco). */
export async function atualizarObjetivo(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const patch: Record<string, unknown> = {};
    const status = String(fd.get("status") || "").trim();
    if (status) patch.status = status;
    const data_alvo = String(fd.get("data_alvo") || "");
    if (data_alvo) patch.data_alvo = data_alvo;
    const resultado = String(fd.get("resultado") || "").trim();
    if (resultado) patch.resultado = resultado;
    const resultado_em = String(fd.get("resultado_em") || "");
    if (resultado_em) patch.resultado_em = resultado_em;
    const observacoes = String(fd.get("observacoes") || "").trim();
    if (observacoes) patch.observacoes = observacoes;
    const instrumento = String(fd.get("processo_instrumento_id") || "");
    if (instrumento) patch.processo_instrumento_id = instrumento;
    // Se marcou atingido/frustrado sem data de resultado, registra hoje.
    if ((status === "atingido" || status === "frustrado") && !resultado_em) patch.resultado_em = hoje();
    if (!Object.keys(patch).length) return { ok: false, message: "Nada para atualizar." };
    const { error } = await supabase.from("estudo_objetivos").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Objetivo atualizado." };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== DOCUMENTOS (acervo do Drive) ==================== */

/**
 * Registra o ponteiro de um arquivo do Drive ligado ao caso. O conteúdo segue
 * vivendo no Drive — o banco guarda só metadados (manual: tabela `documentos`).
 * Respeita o CHECK de vínculo (ao menos processo/cliente/intimação) e o enum de tipo.
 */
export async function criarDocumento(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const processo_id = String(fd.get("processo_id") || "").trim() || null;
    const cliente_id = String(fd.get("cliente_id") || "").trim() || null;
    const intimacao_id = String(fd.get("intimacao_id") || "").trim() || null;
    if (!processo_id && !cliente_id && !intimacao_id) {
      return { ok: false, message: "Vincule o documento a um processo, cliente ou intimação." };
    }
    const tipo = String(fd.get("tipo") || "outro");
    if (!(DOCUMENTO_TIPO as readonly string[]).includes(tipo)) {
      return { ok: false, message: "Tipo de documento inválido." };
    }
    const nome = String(fd.get("nome") || "").trim();
    if (!nome) return { ok: false, message: "Informe o nome do documento." };
    const drive_file_id = String(fd.get("drive_file_id") || "").trim() || null;
    if (!drive_file_id) return { ok: false, message: "Informe o id do arquivo no Drive (drive_file_id)." };

    const { error } = await supabase.from("documentos").insert({
      processo_id,
      cliente_id,
      intimacao_id,
      nome,
      tipo,
      drive_file_id,
      mime_type: String(fd.get("mime_type") || "").trim() || null,
      origem: String(fd.get("origem") || "").trim() || "drive",
      drive_url: String(fd.get("drive_url") || "").trim() || null,
      observacoes: String(fd.get("observacoes") || "").trim() || null,
      ativo: true,
      cadastro_automatico: false,
      cadastrado_por: "manual",
    });
    if (error) {
      // Índice único parcial ux_documentos_drive_processo (drive_file_id, processo_id).
      if ((error as { code?: string }).code === "23505") {
        return { ok: false, message: "Este documento já está registrado neste processo." };
      }
      throw error;
    }
    revalidarTudo();
    return { ok: true, message: "Documento registrado no acervo." };
  } catch (e) {
    return falha(e);
  }
}

/* ==================== EXECUÇÃO PENAL — ATESTADO DE PENA ==================== */

export type CondenacaoInput = {
  numero_processo_origem: string;
  juizo_vara: string;
  uf: string;
  artigo: string;
  lei: string;
  descricao_crime: string;
  pena_texto: string;
  regime_imposto: string;
  fracao_progressao: string;
  fracao_livramento: string;
  hediondo: boolean;
  reincidente: boolean;
  situacao: string;
};

export type AtestadoInput = {
  cliente_id: string;
  data_atestado: string;
  fonte: string;
  regime_atual: string;
  pena_total_texto: string;
  pena_total_dias: string;
  pena_cumprida_texto: string;
  pena_cumprida_dias: string;
  pena_remanescente_texto: string;
  dias_remidos: string;
  dias_perdidos: string;
  total_interrupcoes_texto: string;
  data_base_progressao: string;
  data_prevista_progressao: string;
  data_base_livramento: string;
  data_prevista_livramento: string;
  data_termino_pena: string;
  drive_file_id: string;
  observacoes: string;
  condenacoes: CondenacaoInput[];
};

function strOrNull(v: string | undefined | null): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}
function intOrNull(v: string | undefined | null): number | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
// Regime do atestado → situacao_prisional do cadastro (mapa do manual).
function regimeParaSituacao(r: string | null): string | null {
  switch (r) {
    case "fechado": return "preso_definitivo";
    case "semiaberto": return "regime_semiaberto";
    case "aberto": return "regime_aberto";
    case "livramento": return "solto";
    default: return null;
  }
}

/**
 * Cadastro de atestado de pena (regime chat, fluxo do manual). Grava UM snapshot
 * em situacao_executoria (nunca edita o anterior) + N condenações; semeia objetivos
 * de progressão/livramento se o cliente já tiver estudo; e atualiza a situação
 * prisional conforme o regime — SEM sobrescrever divergência (abre tarefa). A
 * confirmação (resumo) acontece na UI antes de chamar esta action.
 */
export async function criarAtestado(input: AtestadoInput): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const cliente_id = (input.cliente_id || "").trim();
    const data_atestado = (input.data_atestado || "").trim();
    if (!cliente_id) return { ok: false, message: "Cliente inválido." };
    if (!data_atestado) return { ok: false, message: "Informe a data do atestado." };
    const fonte = strOrNull(input.fonte) ?? "seeu";
    const regime_atual = strOrNull(input.regime_atual);

    // 1) Snapshot do atestado (nunca sobrescreve um anterior).
    const { error: sitErr } = await supabase.from("situacao_executoria").insert({
      cliente_id,
      data_atestado,
      fonte,
      regime_atual,
      pena_total_texto: strOrNull(input.pena_total_texto),
      pena_total_dias: intOrNull(input.pena_total_dias),
      pena_cumprida_texto: strOrNull(input.pena_cumprida_texto),
      pena_cumprida_dias: intOrNull(input.pena_cumprida_dias),
      pena_remanescente_texto: strOrNull(input.pena_remanescente_texto),
      dias_remidos: intOrNull(input.dias_remidos) ?? 0,
      dias_perdidos: intOrNull(input.dias_perdidos) ?? 0,
      total_interrupcoes_texto: strOrNull(input.total_interrupcoes_texto),
      data_base_progressao: strOrNull(input.data_base_progressao),
      data_prevista_progressao: strOrNull(input.data_prevista_progressao),
      data_base_livramento: strOrNull(input.data_base_livramento),
      data_prevista_livramento: strOrNull(input.data_prevista_livramento),
      data_termino_pena: strOrNull(input.data_termino_pena),
      drive_file_id: strOrNull(input.drive_file_id),
      observacoes: strOrNull(input.observacoes),
      cadastrado_por: "manual",
      cadastro_automatico: false,
    });
    if (sitErr) {
      if ((sitErr as { code?: string }).code === "23505") {
        return { ok: false, message: `Já existe um atestado de ${fmtDate(data_atestado)} (fonte ${fonte}). Cada atestado é um snapshot novo — use outra data/fonte; nunca edite o anterior.` };
      }
      throw sitErr;
    }

    const partes: string[] = ["Atestado registrado (snapshot novo)."];

    // 2) Condenações (dedup individual por cliente+nº processo de origem).
    const conds = (input.condenacoes ?? []).filter((c) =>
      [c.numero_processo_origem, c.artigo, c.lei, c.descricao_crime, c.pena_texto].some((x) => (x ?? "").trim()),
    );
    let inseridas = 0;
    let puladas = 0;
    for (const c of conds) {
      const { error: cErr } = await supabase.from("condenacoes").insert({
        cliente_id,
        numero_processo_origem: strOrNull(c.numero_processo_origem),
        juizo_vara: strOrNull(c.juizo_vara),
        uf: strOrNull(c.uf),
        artigo: strOrNull(c.artigo),
        lei: strOrNull(c.lei),
        descricao_crime: strOrNull(c.descricao_crime),
        pena_texto: strOrNull(c.pena_texto),
        regime_imposto: strOrNull(c.regime_imposto),
        fracao_progressao: strOrNull(c.fracao_progressao),
        fracao_livramento: strOrNull(c.fracao_livramento),
        hediondo: Boolean(c.hediondo),
        reincidente: Boolean(c.reincidente),
        situacao: strOrNull(c.situacao) ?? "ativa",
        cadastrado_por: "manual",
        cadastro_automatico: false,
      });
      if (cErr) {
        if ((cErr as { code?: string }).code === "23505") { puladas++; continue; }
        throw cErr;
      }
      inseridas++;
    }
    if (conds.length) {
      partes.push(`${inseridas} condenação(ões) gravada(s)${puladas ? `, ${puladas} já existente(s) ignorada(s)` : ""}.`);
    }

    // 3) Semear objetivos (progressão/livramento) se o cliente já tiver estudo.
    const { data: estudos } = await supabase
      .from("estudos_caso")
      .select("id, tipo, atualizado_em")
      .eq("cliente_id", cliente_id)
      .order("atualizado_em", { ascending: false });
    const estudo = (estudos ?? []).find((e) => e.tipo === "execucao_global") ?? (estudos ?? [])[0];
    if (estudo) {
      const { data: existentes } = await supabase
        .from("estudo_objetivos")
        .select("beneficio_alvo")
        .eq("estudo_id", estudo.id);
      const jaTem = new Set((existentes ?? []).map((o) => o.beneficio_alvo as string));
      const dProg = strOrNull(input.data_prevista_progressao);
      const dLivr = strOrNull(input.data_prevista_livramento);
      const semear: { estudo_id: string; objetivo: string; beneficio_alvo: string; data_alvo: string; status: string }[] = [];
      if (dProg && !jaTem.has("progressao")) semear.push({ estudo_id: estudo.id as string, objetivo: "Progressão de regime", beneficio_alvo: "progressao", data_alvo: dProg, status: "planejado" });
      if (dLivr && !jaTem.has("livramento")) semear.push({ estudo_id: estudo.id as string, objetivo: "Livramento condicional", beneficio_alvo: "livramento", data_alvo: dLivr, status: "planejado" });
      if (semear.length) {
        const { error: oErr } = await supabase.from("estudo_objetivos").insert(semear);
        if (!oErr) partes.push(`${semear.length} objetivo(s) semeado(s) no estudo (${semear.map((s) => s.beneficio_alvo).join("/")}).`);
      }
    }

    // 4) Situação prisional conforme o regime — sem sobrescrever divergência.
    const mapped = regimeParaSituacao(regime_atual);
    if (mapped) {
      const { data: cli } = await supabase.from("clientes").select("situacao_prisional").eq("id", cliente_id).single();
      const atual = (cli?.situacao_prisional as string | null) ?? null;
      if (mapped === atual) {
        // já condizente — nada a fazer.
      } else if (!atual || atual === "solto") {
        await supabase.from("clientes").update({ situacao_prisional: mapped }).eq("id", cliente_id);
        partes.push(`Situação prisional atualizada para "${humano(mapped)}".`);
      } else {
        await supabase.from("tarefas").insert({
          titulo: `Conferir situação prisional (atestado ${fmtDate(data_atestado)})`,
          descricao: `O atestado indica regime "${regime_atual}" → situação "${mapped}", mas o cadastro está como "${atual}". Conferir e ajustar manualmente — não sobrescrevemos automaticamente (doutrina do manual).`,
          cliente_id,
          prioridade: "alta",
          responsavel: "Daniel",
          status: "pendente",
        });
        partes.push(`Divergência de situação prisional (cadastro "${humano(atual)}" × atestado "${humano(mapped)}") — tarefa de conferência criada.`);
      }
    }

    revalidarTudo();
    return { ok: true, message: partes.join(" ") };
  } catch (e) {
    return falha(e);
  }
}

/** "Remove" um documento do acervo: soft-remove (ativo=false). Nunca DELETE; o arquivo no Drive não é tocado. */
export async function inativarDocumento(id: string): Promise<Resultado> {
  try {
    await requireUser();
    if (!id) return { ok: false, message: "Documento inválido." };
    const supabase = await createClient();
    const { error } = await supabase.from("documentos").update({ ativo: false }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Documento inativado (mantido no banco e auditado; o Drive não foi alterado)." };
  } catch (e) {
    return falha(e);
  }
}

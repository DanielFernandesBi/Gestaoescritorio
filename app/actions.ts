"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import {
  confirmarPrazo,
  criarEventoProvisorio,
  criarEventoAudiencia,
  calendarConfigurado,
} from "@/lib/calendar";
import {
  INTIMACAO_STATUS,
  TAREFA_STATUS,
  ANDAMENTO_TIPO,
  PAGAMENTO_STATUS,
  SUGESTAO_STATUS,
} from "@/lib/enums";

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

/* eslint-disable @typescript-eslint/no-explicit-any */
function refProcesso(proc: any): string {
  if (!proc) return "processo";
  const nome = proc?.cliente_processo?.[0]?.clientes?.nome;
  return nome || proc?.numero_cnj || proc?.numero_registro_tribunal || "processo";
}

function revalidarTudo() {
  for (const p of [
    "/painel", "/validacao", "/prazos", "/audiencias", "/intimacoes",
    "/tarefas", "/processos", "/clientes", "/financeiro", "/andamentos",
    "/auditoria", "/sistema",
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
    if (pr.processo_id) {
      const { error: andErr } = await supabase.from("andamentos").insert({
        processo_id: pr.processo_id,
        data: hoje(),
        tipo: "peticao_protocolada",
        descricao: descricao?.trim() || `Cumprido o prazo: ${pr.ato}.`,
        cadastrado_por: "manual",
        cadastro_automatico: false,
      });
      if (!andErr) msg += " Andamento registrado.";
    }
    if (pr.intimacao_id) {
      await supabase.from("intimacoes").update({ status: "providencia_tomada" }).eq("id", pr.intimacao_id);
      msg += " Intimação marcada como providência tomada.";
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

export async function criarIntimacao(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const processo_id = String(fd.get("processo_id") || "") || null;
    const origem = String(fd.get("origem") || "");
    const resumo = String(fd.get("resumo") || "").trim();
    const data_publicacao = String(fd.get("data_publicacao") || "") || null;
    const data_ciencia = String(fd.get("data_ciencia") || "") || null;
    if (!origem || !resumo) return { ok: false, message: "Origem e resumo são obrigatórios." };
    const { error } = await supabase.from("intimacoes").insert({
      processo_id, origem, resumo, data_publicacao, data_ciencia,
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

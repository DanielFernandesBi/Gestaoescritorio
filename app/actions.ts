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
  CONTRATO_STATUS,
} from "@/lib/enums";
import { normalizarNome, soDigitos } from "@/lib/format";

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

/* ==================== CRIAÇÃO COM DEDUP ==================== */

export async function criarCliente(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const nome = String(fd.get("nome") || "").trim();
    if (!nome) return { ok: false, message: "Nome é obrigatório." };
    const cpf = String(fd.get("cpf") || "").trim() || null;
    const forcar = fd.get("forcar") === "on";

    // Deduplicação (nome normalizado / CPF) — manual.
    if (!forcar) {
      const { data: existentes } = await supabase.from("clientes").select("id, nome, cpf");
      const nn = normalizarNome(nome);
      const cd = soDigitos(cpf);
      const dups = (existentes ?? []).filter((c) => {
        const mesmoNome = normalizarNome(c.nome as string) === nn;
        const mesmoCpf = cd && soDigitos(c.cpf as string | null) === cd;
        return mesmoNome || mesmoCpf;
      });
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
        return { ok: false, message: "Já existe processo com este CNJ/registro. Use a busca para abri-lo." };
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

    // Vínculo opcional com cliente
    const cliente_id = String(fd.get("cliente_id") || "").trim();
    if (cliente_id && novo) {
      await supabase.from("cliente_processo").insert({
        cliente_id,
        processo_id: novo.id,
        papel: String(fd.get("papel") || "reu"),
      });
    }
    revalidarTudo();
    return { ok: true, message: "Processo cadastrado." };
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

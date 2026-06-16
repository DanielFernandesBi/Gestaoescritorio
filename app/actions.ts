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
import { soDigitos } from "@/lib/format";

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
    "/tarefas", "/processos", "/clientes", "/financeiro", "/andamentos",
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

/**
 * Promove um prazo ÓRFÃO (sem processo): costura/identifica o processo (dedup por
 * CNJ/registro, completando o CNJ num registro existente quando for o caso),
 * vincula o cliente e grava prazos.processo_id. Só então (CHECK satisfeito) pode
 * validar. Reaproveita a lógica de criação/validação já existente.
 */
export async function promoverPrazoOrfao(prazo_id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    if (!prazo_id) return { ok: false, message: "Prazo inválido." };
    const supabase = await createClient();

    const { data: pr } = await supabase.from("prazos").select("id, processo_id").eq("id", prazo_id).single();
    if (!pr) return { ok: false, message: "Prazo não encontrado." };
    if (pr.processo_id) return { ok: false, message: "Este prazo já tem processo vinculado (não é órfão)." };

    let procId = String(fd.get("processo_id") || "").trim();
    const cnj = String(fd.get("numero_cnj") || "").trim() || null;
    const reg = String(fd.get("numero_registro_tribunal") || "").trim() || null;
    const tribunal = String(fd.get("tribunal") || "").trim();
    let msg = "";

    if (procId) {
      // Processo existente selecionado: seguir o merge se for um tombstone (Sugestão 28).
      const alvo = await resolverProcesso(supabase, procId);
      if (alvo !== procId) { procId = alvo; msg += "Processo selecionado estava mesclado; seguido para o canônico vivo. "; }
      // completar CNJ se faltava e foi informado.
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

    // Costura o prazo ao processo — a partir daqui o CHECK do banco está satisfeito.
    const { error: upErr } = await supabase.from("prazos").update({ processo_id: procId }).eq("id", prazo_id);
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

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { socioDoEmail, outroSocio } from "@/lib/allowlist";
import { driveConfigurado, uploadParaDrive } from "@/lib/drive";
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
  AUDIENCIA_MODALIDADE,
} from "@/lib/enums";
import { soDigitos, humano, fmtDate, hojeSP } from "@/lib/format";

export type Resultado = { ok: boolean; message: string };

/* Sugestão 93 / Migração 70 — cascata em dois níveis da fn_baixa_ato v2.
 * A fonte destes dados é EXCLUSIVAMENTE o JSON devolvido pela função (nada da
 * janela/cascata é reimplementado no cliente). */
export type TarefaPendenteRelacionada = {
  tarefa_id: string;
  titulo: string;
  prioridade: string | null;
  data_andamento: string | null;
  tipo_andamento: string | null;
};
export type CascataBaixa = {
  /** Nível 1 — conferências do MESMO ATO concluídas automaticamente pela função. */
  tarefasAtoConcluidas: string[];
  /** Eco do p_tarefas_extra confirmado pelo humano nesta chamada. */
  tarefasExtraConcluidas: string[];
  /** Nível 2 — pendentes automáticas do mesmo processo (janela) que a função NÃO fechou;
   *  só podem ser concluídas com confirmação humana explícita (modal). */
  tarefasPendentesRelacionadas: TarefaPendenteRelacionada[];
};
export type ResultadoBaixa = Resultado & { cascata?: CascataBaixa };

function falha(e: unknown): Resultado {
  const m = e instanceof Error ? e.message : "Falha na gravação.";
  return { ok: false, message: m };
}
function hoje(): string {
  return hojeSP();
}
function agora(): string {
  // Instante (UTC) — timestamptz guarda o ponto no tempo; o fuso é aplicado na exibição.
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

function revalidarTudo() {
  for (const p of [
    "/painel", "/validacao", "/prazos", "/audiencias", "/intimacoes",
    "/tarefas", "/producao", "/processos", "/clientes", "/financeiro", "/andamentos",
    "/auditoria", "/sistema", "/alertas", "/estudos",
  ]) {
    revalidatePath(p);
  }
  revalidatePath("/", "layout"); // badge da sidebar vive no layout (Sugestão 53)
}

/**
 * Sugestão 53 — eixo de LEITURA. Carimba revisado_em/revisado_por SÓ se ainda não
 * lida (COALESCE da casa: nunca sobrescreve a leitura anterior). O Cowork JAMAIS
 * chama isto — quem lê é o humano pelo frontend. Devolve true se realmente marcou.
 */
async function carimbarLeitura(
  supabase: Awaited<ReturnType<typeof createClient>>,
  intimacaoId: string,
): Promise<boolean> {
  // Sugestão 82 — ciência PESSOAL (por usuário logado) via RPC. "Se agiu, viu": toda
  // ação humana carimba a ciência de quem agiu (a fn deriva o usuário de auth.uid()).
  // Chamada só de sessão autenticada; Cowork/chat (sem sessão) levanta exceção por design.
  const { error } = await supabase.rpc("fn_marcar_ciencia", { p_intimacao: intimacaoId, p_lido: true });
  return !error;
}

/* ============================ PRAZOS ============================ */

export async function validarPrazo(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: pr, error } = await supabase
      .from("prazos")
      .select("id, validado")
      .eq("id", id)
      .single();
    if (error || !pr) throw new Error("Prazo não encontrado.");
    if (pr.validado) return { ok: true, message: "Prazo já estava validado." };

    const { error: upErr } = await supabase
      .from("prazos")
      .update({ validado: true, validado_em: agora() })
      .eq("id", id);
    if (upErr) throw upErr;

    revalidarTudo();
    return { ok: true, message: "Prazo validado. Fatal fixada — acompanhe na /agenda." };
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
      await carimbarLeitura(supabase, pr.intimacao_id as string); // ação humana = leu (Sugestão 53)
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

/** Baixa por "prejudicado" — o prazo perdeu o objeto (ex.: recurso da parte
 * contrária inadmitido). Troca de status, nunca DELETE. */
export async function prejudicarPrazo(id: string, motivo: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: pr } = await supabase
      .from("prazos")
      .select("status")
      .eq("id", id)
      .single();
    if (pr && pr.status !== "aberto") return { ok: false, message: `Prazo não está aberto (${pr.status}).` };
    const obs = motivo?.trim() ? `Prejudicado: ${motivo.trim()}` : null;
    const patch: Record<string, unknown> = { status: "prejudicado" };
    if (obs) patch.observacoes = obs;
    const { error } = await supabase.from("prazos").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Prazo marcado como prejudicado (auditado)." };
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
    // Sugestão 53: prazo pode nascer de uma intimação — vínculo conta na vw_intimacoes_contexto.
    const intimacao_id = String(fd.get("intimacao_id") || "").trim() || null;
    if (!processo_id || !ato || !data_fatal) return { ok: false, message: "Processo, ato e data fatal são obrigatórios." };

    const { data: novo, error } = await supabase
      .from("prazos")
      .insert({
        processo_id, ato, data_fatal, data_interna, intimacao_id,
        responsavel, tipo_contagem, status: "aberto",
        validado: false, cadastrado_por: "manual",
      })
      .select("id")
      .single();
    if (error) throw error;

    // Bidirecionalidade: encaminhar a intimação de origem (pendente→em_analise) e carimbar leitura.
    if (intimacao_id) {
      await supabase.from("intimacoes").update({ status: "em_analise" }).eq("id", intimacao_id).eq("status", "pendente");
      await carimbarLeitura(supabase, intimacao_id);
    }

    void novo;
    revalidarTudo();
    return { ok: true, message: "Prazo criado (provisório · a validar). Visível na /agenda." };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Cria um PRAZO diretamente da tarefa de conferência, mantendo o fluxo UNIFICADO.
 * O prazo nasce no processo da tarefa (provisório · a validar). Como o schema não
 * liga prazo↔tarefa direto, a rastreabilidade da baixa em cascata passa pela PEÇA:
 * amarramos o prazo à peça já existente desta tarefa (quando ainda sem prazo) — e,
 * se a peça vier depois, o criarPecaDeOrigem("tarefa") herda o prazo aberto do
 * processo. Nos dois casos, a baixa da peça (fn_baixa_ato) fecha peça + prazo +
 * tarefa juntos. Nunca DELETE.
 */
export async function criarPrazoDeTarefa(tarefaId: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    if (!tarefaId) return { ok: false, message: "Tarefa inválida." };
    const supabase = await createClient();

    const { data: t } = await supabase.from("tarefas").select("id, processo_id, responsavel").eq("id", tarefaId).maybeSingle();
    if (!t) return { ok: false, message: "Tarefa não encontrada." };
    const processo_id = (t.processo_id as string | null) ?? null;
    if (!processo_id) {
      return { ok: false, message: "Esta tarefa não tem processo vinculado — o prazo exige processo. Vincule um processo à tarefa antes." };
    }

    const ato = String(fd.get("ato") || "").trim();
    const data_fatal = String(fd.get("data_fatal") || "");
    if (!ato || !data_fatal) return { ok: false, message: "Ato e data fatal são obrigatórios." };
    const data_interna = String(fd.get("data_interna") || "") || null;
    const responsavel = String(fd.get("responsavel") || (t.responsavel as string) || "Daniel");
    const tipo_contagem = String(fd.get("tipo_contagem") || "corridos");

    const { data: novo, error } = await supabase
      .from("prazos")
      .insert({ processo_id, ato, data_fatal, data_interna, responsavel, tipo_contagem, status: "aberto", validado: false, cadastrado_por: "manual" })
      .select("id")
      .single();
    if (error) throw error;
    const prazoId = novo?.id as string;

    // Unificação: amarra o prazo à(s) peça(s) desta tarefa ainda sem prazo — para a
    // baixa alcançá-lo mesmo quando a peça foi criada ANTES do prazo.
    const TERMINAIS = ["protocolada", "cancelada", "prejudicada"];
    let amarradas = 0;
    const { data: pcs } = await supabase.from("pecas").select("id, status").eq("tarefa_id", tarefaId).is("prazo_id", null);
    for (const pc of pcs ?? []) {
      if (TERMINAIS.includes(pc.status as string)) continue;
      const { error: upErr } = await supabase.from("pecas").update({ prazo_id: prazoId }).eq("id", pc.id as string);
      if (!upErr) amarradas++;
    }

    revalidarTudo();
    const nota = amarradas > 0
      ? " Amarrado à peça desta tarefa — dar baixa na peça fecha prazo, tarefa e peça juntos."
      : " Ao criar a peça desta tarefa, ela herda este prazo — a baixa fecha os três juntos.";
    return { ok: true, message: `Prazo criado (provisório · a validar).${nota}` };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ AUDIÊNCIAS ============================ */

/** Cadastro manual de audiência. Nasce status='designada', validado=false
 * (provisória): aparece em "A validar" e é fixada na validação
 * (validarAudiencia). Exige processo, tipo e data/hora. */
export async function criarAudiencia(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const processo_id = String(fd.get("processo_id") || "");
    const tipo = String(fd.get("tipo") || "").trim();
    const dataLocal = String(fd.get("data_hora") || ""); // YYYY-MM-DDTHH:mm
    if (!processo_id || !tipo || !dataLocal) return { ok: false, message: "Processo, tipo e data/hora são obrigatórios." };
    const data_hora = `${dataLocal}:00-03:00`; // horário de Brasília
    const modalidade = String(fd.get("modalidade") || "") || null;
    const fimLocal = String(fd.get("data_fim") || "");
    const data_fim = fimLocal ? `${fimLocal}:00-03:00` : null; // Sugestão 66: fim da janela (sessão virtual)
    if (data_fim && data_fim < data_hora) return { ok: false, message: "O fim da janela deve ser igual ou posterior ao início." };
    const local_link = String(fd.get("local_link") || "").trim() || null;
    const responsavel = String(fd.get("responsavel") || "Daniel");
    const observacoes = String(fd.get("observacoes") || "").trim() || null;

    const { error } = await supabase.from("audiencias").insert({
      processo_id, tipo, data_hora, data_fim, modalidade, local_link, responsavel, observacoes,
      status: "designada", validado: false,
    });
    if (error) throw error;

    revalidarTudo();
    return { ok: true, message: "Audiência criada (provisória). Valide para fixar data e local." };
  } catch (e) {
    return falha(e);
  }
}

export async function validarAudiencia(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: a, error } = await supabase
      .from("audiencias")
      .select("id, validado")
      .eq("id", id)
      .single();
    if (error || !a) throw new Error("Audiência não encontrada.");
    if (a.validado) return { ok: true, message: "Audiência já estava validada." };

    const { error: upErr } = await supabase
      .from("audiencias")
      .update({ validado: true, validado_em: agora() })
      .eq("id", id);
    if (upErr) throw upErr;

    revalidarTudo();
    return { ok: true, message: "Audiência validada. Fixada na /agenda." };
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
    // Sugestão 53: ação humana de status = também leu a intimação (carimbo COALESCE-safe).
    await carimbarLeitura(supabase, id);
    revalidarTudo();
    return { ok: true, message: "Intimação atualizada." };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Sugestão 53 — eixo de LEITURA (Camada B). Marca a intimação como lida pelo humano.
 * COALESCE: só seta se ainda não lida; reabrir o drawer não sobrescreve. Só revalida
 * quando realmente marcou (evita churn de cache em reaberturas).
 */
export async function marcarIntimacaoLida(id: string, lido: boolean = true): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    // Sug. 82 — ciência pessoal (toggle). p_lido=false desfaz a ciência do próprio usuário.
    const { error } = await supabase.rpc("fn_marcar_ciencia", { p_intimacao: id, p_lido: lido });
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: lido ? "Marcada como lida (por você)." : "Marcada como não lida." };
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

    // Campos próprios da intimação (independem do processo — úteis p/ órfãs).
    const tribunal = String(fd.get("tribunal") || "").trim();
    const orgao = String(fd.get("orgao") || "").trim();
    const instancia = String(fd.get("instancia") || "").trim();
    const classe = String(fd.get("classe") || "").trim();
    const area = String(fd.get("area") || "").trim();
    const fundamento = String(fd.get("fundamento") || "").trim();
    const prazo_dias = String(fd.get("prazo_dias") || "").trim();
    const data_disponibilizacao = String(fd.get("data_disponibilizacao") || "");
    if (tribunal) patch.tribunal = tribunal;
    if (orgao) patch.orgao = orgao;
    if (instancia) patch.instancia = instancia;
    if (classe) patch.classe = classe;
    if (area) patch.area = area;
    if (fundamento) patch.fundamento = fundamento;
    if (prazo_dias && Number.isFinite(Number(prazo_dias))) patch.prazo_dias = Number(prazo_dias);
    if (data_disponibilizacao) patch.data_disponibilizacao = data_disponibilizacao;

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

/**
 * Sugestão 75 · etapa 4 — Confirma que um CLUSTER de intimações gêmeas
 * (vw_intimacoes_atos_candidatos, mesmo ato_cluster_id) descreve o MESMO ato.
 * Grava ato_canonico_id = <canônica> em TODAS as intimações do cluster (inclusive
 * a própria canônica). NÃO mexe em status — a partir daí o trigger
 * trg_propaga_status_ato sincroniza mudanças FUTURAS entre as irmãs.
 *
 * `sincronizar`: passo opcional para o momento em que os status já divergem — o app
 * alinha DIRETAMENTE as irmãs cujo status difere ao da canônica (o trigger não
 * dispara re-gravando o mesmo status, exige IS DISTINCT FROM). Ato humano por
 * cluster; nunca em massa. Nunca DELETE, nunca oculta registros.
 */
export async function confirmarAtoCanonico(
  canonicaId: string,
  idsCluster: string[],
  sincronizar: boolean,
): Promise<Resultado> {
  try {
    await requireUser();
    if (!canonicaId) return { ok: false, message: "Escolha a intimação canônica." };
    const ids = [...new Set((idsCluster ?? []).filter(Boolean))];
    if (ids.length < 2) return { ok: false, message: "Cluster inválido — precisa de ao menos duas gêmeas." };
    if (!ids.includes(canonicaId)) return { ok: false, message: "A canônica precisa ser uma das gêmeas do cluster." };
    const supabase = await createClient();

    // 1) Vincula todo o cluster à canônica (apenas ato_canonico_id).
    const { error } = await supabase.from("intimacoes").update({ ato_canonico_id: canonicaId }).in("id", ids);
    if (error) throw error;

    // 2) Sincronização opcional do status divergente pelo estado da canônica.
    let sinc = 0;
    if (sincronizar) {
      const { data: can } = await supabase.from("intimacoes").select("status").eq("id", canonicaId).maybeSingle();
      const statusCanonico = (can?.status as string | null) ?? null;
      if (statusCanonico) {
        // irmãs (≠ canônica) cujo status difere — evita re-gravar o mesmo (trigger exige distinto).
        const irmas = ids.filter((i) => i !== canonicaId);
        const { data: divergentes } = await supabase
          .from("intimacoes").select("id").in("id", irmas).neq("status", statusCanonico);
        const alvo = (divergentes ?? []).map((r) => r.id as string);
        if (alvo.length) {
          const { error: e2 } = await supabase.from("intimacoes").update({ status: statusCanonico }).in("id", alvo);
          if (e2) throw e2;
          sinc = alvo.length;
        }
      }
    }

    revalidarTudo();
    return {
      ok: true,
      message: sinc > 0
        ? `Ato confirmado (${ids.length} fontes). ${sinc} irmã(s) sincronizada(s) pelo status da canônica; daqui em diante a propagação é automática.`
        : `Ato confirmado (${ids.length} fontes). Mudanças de status passam a propagar entre as irmãs automaticamente.`,
    };
  } catch (e) {
    return falha(e);
  }
}

/** Desfaz a confirmação: zera ato_canonico_id de todo o cluster (volta a candidatas).
 *  Nenhum outro campo é tocado; as gêmeas seguem acessíveis. */
export async function desvincularAtoCanonico(idsCluster: string[]): Promise<Resultado> {
  try {
    await requireUser();
    const ids = [...new Set((idsCluster ?? []).filter(Boolean))];
    if (!ids.length) return { ok: false, message: "Cluster inválido." };
    const supabase = await createClient();
    const { error } = await supabase.from("intimacoes").update({ ato_canonico_id: null }).in("id", ids);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Gêmeas desvinculadas — o cluster volta a candidatas." };
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

    // Vínculos de proveniência disponíveis no contexto da tela (Sug. 75 · etapa 3).
    // Objetivo: zerar peça órfã — pré-requisito da baixa em cascata (F4).
    let processo_id = String(fd.get("processo_id") || "").trim() || null;
    let cliente_id = String(fd.get("cliente_id") || "").trim() || null;
    let intimacao_id = String(fd.get("intimacao_id") || "").trim() || null;
    const prazo_id = String(fd.get("prazo_id") || "").trim() || null;
    const tarefa_id = String(fd.get("tarefa_id") || "").trim() || null;
    const origem_andamento_id = String(fd.get("origem_andamento_id") || "").trim() || null;

    // A partir de um PRAZO: herda o processo e a intimação de origem do prazo,
    // sem sobrescrever o que a tela já trouxe (COALESCE).
    if (prazo_id && (!processo_id || !intimacao_id)) {
      const { data: pr } = await supabase.from("prazos").select("processo_id, intimacao_id").eq("id", prazo_id).maybeSingle();
      if (pr) {
        processo_id = processo_id ?? ((pr.processo_id as string | null) ?? null);
        intimacao_id = intimacao_id ?? ((pr.intimacao_id as string | null) ?? null);
      }
    }

    // cliente_id automático SÓ quando o processo tem um único cliente vinculado;
    // com corréus, fica em branco para escolha manual. Nunca sobrescreve.
    if (!cliente_id && processo_id) {
      const { data: cps } = await supabase.from("cliente_processo").select("cliente_id").eq("processo_id", processo_id);
      if (cps && cps.length === 1) cliente_id = cps[0].cliente_id as string;
    }

    const { error } = await supabase.from("pecas").insert({
      titulo,
      tipo,
      subtipo: String(fd.get("subtipo") || "").trim() || null,
      descricao: String(fd.get("descricao") || "").trim() || null,
      observacoes: String(fd.get("observacoes") || "").trim() || null,
      status: "a_fazer",
      prioridade: String(fd.get("prioridade") || "media"),
      responsavel: String(fd.get("responsavel") || "Daniel"),
      // processo_id NULL = inicial de caso novo (permitido pelo schema).
      cliente_id,
      processo_id,
      prazo_id,
      intimacao_id,
      tarefa_id,
      origem_andamento_id,
      data_alvo: String(fd.get("data_alvo") || "") || null,
      drive_file_id: String(fd.get("drive_file_id") || "").trim() || null,
      validado: true,
      cadastro_automatico: false,
      cadastrado_por: "manual",
    });
    if (error) throw error;
    // Sugestão 53 — bidirecionalidade: agir sobre a intimação a encaminha (status
    // pendente→em_analise, guard anti-rebaixamento) e conta como leitura (COALESCE).
    if (intimacao_id) {
      await supabase.from("intimacoes").update({ status: "em_analise" }).eq("id", intimacao_id).eq("status", "pendente");
      await carimbarLeitura(supabase, intimacao_id);
    }
    revalidarTudo();
    // Aviso não-bloqueante: peça 100% órfã não participa da baixa em cascata.
    const orfa = !processo_id && !cliente_id && !prazo_id && !intimacao_id && !tarefa_id && !origem_andamento_id;
    return {
      ok: true,
      message: orfa
        ? "Peça criada — mas SEM vínculos (processo/cliente/prazo). A baixa em cascata não funcionará para ela; vincule-a depois no módulo Produção."
        : "Peça criada no backlog (A fazer).",
    };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Sugestão 51 — Baixa de protocolo pela PORTA DA PEÇA (paridade com baixarPrazo).
 *
 * Quando um humano protocola pelo board de Produção, dispara a MESMA cascata da baixa
 * de prazo (fluxo #3 do manual) em vez de um flip silencioso de pecas.status — que
 * fazia board e banco DIVERGIREM (peça "protocolada" com prazo ainda "aberto",
 * intimação sem providência). Cascata, origem carimbada
 * 'frontend' pelo header x-app-origem (auditada por fn_auditar):
 *   1. andamento "peticao_protocolada" — dedup idempotente por codigo_movimentacao;
 *   2. prazo vinculado → "cumprido" (+cumprido_em), se ainda "aberto";
 *   3. intimação vinculada → "providencia_tomada";
 *   4. peça → "protocolada" (+protocolada_em +andamento_id que a materializou).
 *
 * Salvaguardas (manual + sugestão): IDEMPOTENTE — peça já terminal é no-op; não recria
 * andamento (dedup) nem rebaixa prazo já fechado. Peça SEM prazo só registra
 * protocolada_em (+andamento quando há processo); inicial de caso novo (sem processo)
 * apenas carimba a data. NUNCA DELETE (correção = troca de status). Só por ação HUMANA:
 * o sistema/redator agendado jamais protocola. A reversão (mover para fora de
 * "protocolada") NÃO reabre o prazo nem apaga o andamento — fica como está.
 */
/**
 * Sugestão 75 · etapa 5 (F4) — Baixa do ato pela fn_baixa_ato (cascata transacional
 * no Postgres: andamento peticao_protocolada idempotente → peça protocolada → prazo
 * cumprido → tarefa concluída → intimação providência tomada; + gêmeas extras
 * marcadas). Sempre p_cadastrado_por='manual' (ação humana no app). Idempotente:
 * rebaixar é seguro. Devolve um recibo do que foi fechado + avisos da função.
 */
export async function baixarAtoPeca(
  pecaId: string,
  intimacoesExtra: string[] = [],
  dataProtocolo?: string,
  tarefasExtra: string[] = [],
): Promise<ResultadoBaixa> {
  try {
    await requireUser();
    if (!pecaId) return { ok: false, message: "Peça inválida." };
    const supabase = await createClient();
    const extra = [...new Set((intimacoesExtra ?? []).filter(Boolean))];
    const tExtra = [...new Set((tarefasExtra ?? []).filter(Boolean))];
    const { data, error } = await supabase.rpc("fn_baixa_ato", {
      p_peca_id: pecaId,
      p_intimacoes_extra: extra,
      p_data_protocolo: dataProtocolo || hoje(),
      p_cadastrado_por: "manual",
      p_tarefas_extra: tExtra,
    });
    if (error) throw error;

    const r = (data ?? {}) as {
      peca?: unknown; andamento?: unknown; prazo?: unknown; tarefa?: unknown;
      intimacao?: unknown; intimacoes_extra?: unknown[]; avisos?: string[];
      tarefas_ato_concluidas?: unknown[]; tarefas_extra?: unknown[];
      tarefas_pendentes_relacionadas?: Record<string, unknown>[];
    };
    const nExtra = Array.isArray(r.intimacoes_extra) ? r.intimacoes_extra.length : 0;
    const nIntim = (r.intimacao ? 1 : 0) + nExtra;

    // Chaves novas da v2 (Nível 1 / eco / Nível 2). Fonte única = JSON da função.
    const idsDe = (a: unknown[] | undefined) => (Array.isArray(a) ? a : []).filter(Boolean).map(String);
    const atoConcl = idsDe(r.tarefas_ato_concluidas);
    const extraConcl = idsDe(r.tarefas_extra);
    const pendRel: TarefaPendenteRelacionada[] = (Array.isArray(r.tarefas_pendentes_relacionadas) ? r.tarefas_pendentes_relacionadas : [])
      .map((t) => ({
        tarefa_id: String(t.tarefa_id ?? ""),
        titulo: (t.titulo as string | null) ?? "Tarefa",
        prioridade: (t.prioridade as string | null) ?? null,
        data_andamento: (t.data_andamento as string | null) ?? null,
        tipo_andamento: (t.tipo_andamento as string | null) ?? null,
      }))
      .filter((t) => t.tarefa_id);

    // Contagem de tarefas concluídas (dedup): a do próprio ato + escaladas + extras.
    const idOf = (v: unknown): string | null =>
      typeof v === "string" ? v : (v && typeof v === "object" ? (String((v as Record<string, unknown>).tarefa_id ?? (v as Record<string, unknown>).id ?? "") || null) : null);
    const tarefasFechadas = new Set<string>([...atoConcl, ...extraConcl]);
    const idPrinc = idOf(r.tarefa); if (idPrinc) tarefasFechadas.add(idPrinc);
    const nTarefas = tarefasFechadas.size || (r.tarefa ? 1 : 0);

    const partes: string[] = ["andamento registrado"];
    if (r.prazo) partes.push("prazo cumprido");
    if (nTarefas) partes.push(`${nTarefas} tarefa${nTarefas === 1 ? "" : "s"} concluída${nTarefas === 1 ? "" : "s"}`);
    if (nIntim) partes.push(`${nIntim} intimação${nIntim === 1 ? "" : "s"} resolvida${nIntim === 1 ? "" : "s"}`);
    const avisos = Array.isArray(r.avisos) ? r.avisos.filter(Boolean) : [];
    let message = `Baixa concluída — ${partes.join(", ")}.`;
    // Nível 1 — toast informativo (mesmo ato, sem interação).
    if (atoConcl.length) message += ` ${atoConcl.length} conferência${atoConcl.length === 1 ? "" : "s"} do mesmo ato concluída${atoConcl.length === 1 ? "" : "s"} automaticamente.`;
    if (avisos.length) message += ` ⚠ Vínculos incompletos: ${avisos.join("; ")} — confira manualmente e rebaixe (é seguro, não duplica).`;

    revalidarTudo();
    return {
      ok: true,
      message,
      cascata: { tarefasAtoConcluidas: atoConcl, tarefasExtraConcluidas: extraConcl, tarefasPendentesRelacionadas: pendRel },
    };
  } catch (e) {
    return falha(e);
  }
}

export type BaixaOpts = { pularPrazo?: boolean; pularTarefa?: boolean; pularIntimacao?: boolean; dataProtocolo?: string; tarefasExtra?: string[] };

/**
 * Sugestão 51 — Baixa de protocolo pela PORTA DA PEÇA. Caminho PADRÃO (nada
 * desmarcado) DELEGA à fn_baixa_ato (etapa 5). O caminho granular só roda quando o
 * usuário desmarca algum vínculo no modal (item 4): aí o app fecha só o que foi
 * marcado, deixando o desmarcado aberto de propósito. Nunca DELETE.
 */
export async function baixarProtocoloPeca(id: string, descricao?: string, opts?: BaixaOpts): Promise<ResultadoBaixa> {
  const granular = Boolean(opts && (opts.pularPrazo || opts.pularTarefa || opts.pularIntimacao));
  // Caminho padrão (e o de reconfirmação de conferências extras) delega à fn_baixa_ato.
  if (!granular) return baixarAtoPeca(id, [], opts?.dataProtocolo, opts?.tarefasExtra ?? []);
  try {
    await requireUser();
    const supabase = await createClient();
    const dt = opts?.dataProtocolo || hoje();

    const { data: pc, error } = await supabase
      .from("pecas")
      .select("id, titulo, status, processo_id, prazo_id, intimacao_id, tarefa_id, andamento_id")
      .eq("id", id)
      .single();
    if (error || !pc) throw new Error("Peça não encontrada.");

    const TERMINAIS = ["protocolada", "cancelada", "prejudicada"];
    if (TERMINAIS.includes(pc.status as string)) {
      return { ok: false, message: `Peça já está em status terminal (${pc.status}); protocolo não reaplicado.` };
    }

    type PrazoVinc = { id: string; status: string; processo_id: string | null };
    let prazo: PrazoVinc | null = null;
    if (pc.prazo_id) {
      const { data: pr } = await supabase.from("prazos").select("id, status, processo_id").eq("id", pc.prazo_id).maybeSingle();
      prazo = (pr as PrazoVinc | null) ?? null;
    }
    const processoId = (pc.processo_id as string | null) ?? prazo?.processo_id ?? null;

    const aberto: string[] = [];
    let msg = "";

    // 1) Andamento do protocolo (dedup idempotente por codigo_movimentacao).
    // Sug. 90 — chave alinhada à fn_baixa_ato do banco (`baixa-peca-<id>`): os DOIS
    // caminhos de baixa (RPC canônica e este granular) passam a compartilhar a mesma
    // chave de dedup, evitando andamento de protocolo duplicado se um mesmo item for
    // baixado pelos dois. Não é chave de FONTE (ato interno, sem id de origem) — é
    // idempotência do protocolo; segue o prefixo determinístico da função do banco.
    let andamentoId: string | null = (pc.andamento_id as string | null) ?? null;
    if (processoId && !andamentoId) {
      const codigoDedup = `baixa-peca-${pc.id}`;
      const { data: existente } = await supabase.from("andamentos").select("id").eq("codigo_movimentacao", codigoDedup).maybeSingle();
      if (existente?.id) {
        andamentoId = existente.id as string;
      } else {
        const tituloPeca = (pc.titulo as string | null)?.trim();
        const desc = descricao?.trim() || (tituloPeca ? `Protocolo: ${tituloPeca}.` : "Petição protocolada.");
        const { data: and, error: andErr } = await supabase
          .from("andamentos")
          .insert({ processo_id: processoId, data: dt, tipo: "peticao_protocolada", descricao: desc, cadastrado_por: "manual", cadastro_automatico: false, codigo_movimentacao: codigoDedup })
          .select("id").single();
        if (!andErr) { andamentoId = (and?.id as string) ?? null; msg += " Andamento registrado."; }
      }
    }

    // 2) Prazo vinculado → cumprido (a menos que desmarcado).
    if (prazo && prazo.status === "aberto") {
      if (opts?.pularPrazo) { aberto.push("prazo"); }
      else {
        const { error: upErr } = await supabase.from("prazos").update({ status: "cumprido", cumprido_em: dt }).eq("id", prazo.id);
        if (upErr) throw upErr;
        msg += " Prazo cumprido.";
      }
    }

    // 3) Tarefa vinculada → concluída (a menos que desmarcada).
    if (pc.tarefa_id) {
      if (opts?.pularTarefa) { aberto.push("tarefa"); }
      else {
        await supabase.from("tarefas").update({ status: "concluida", concluida_em: agora() }).eq("id", pc.tarefa_id).in("status", ["pendente", "em_andamento"]);
        msg += " Tarefa concluída.";
      }
    }

    // 4) Intimação vinculada → providência tomada (a menos que desmarcada).
    if (pc.intimacao_id) {
      if (opts?.pularIntimacao) { aberto.push("intimação"); }
      else {
        await supabase.from("intimacoes").update({ status: "providencia_tomada" }).eq("id", pc.intimacao_id);
        await carimbarLeitura(supabase, pc.intimacao_id as string);
        msg += " Intimação com providência tomada.";
      }
    }

    // 5) Peça → protocolada.
    const patch: Record<string, unknown> = { status: "protocolada", protocolada_em: dt };
    if (andamentoId) patch.andamento_id = andamentoId;
    const { error: pcErr } = await supabase.from("pecas").update(patch).eq("id", id);
    if (pcErr) throw pcErr;

    revalidarTudo();
    const nota = aberto.length ? ` Mantido(s) aberto(s) a pedido: ${aberto.join(", ")}.` : "";
    return { ok: true, message: `Peça protocolada.${msg}${nota}` };
  } catch (e) {
    return falha(e);
  }
}

/** Move a peça pelo kanban (inclui cancelar/prejudicar = troca de status; nunca DELETE).
 *  Ao protocolar, propaga a cascata da fn_baixa_ato (inclui as chaves da v2). */
export async function moverPeca(id: string, status: string, descricao?: string): Promise<ResultadoBaixa> {
  try {
    await requireUser();
    if (!(PECA_STATUS as readonly string[]).includes(status)) {
      return { ok: false, message: "Status inválido." };
    }
    // Sugestão 51: protocolar pela peça dispara a cascata de baixa (mesma do prazo),
    // não um flip silencioso de status — board e banco deixam de divergir.
    if (status === "protocolada") return baixarProtocoloPeca(id, descricao);
    const supabase = await createClient();
    const { error } = await supabase.from("pecas").update({ status }).eq("id", id);
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

/**
 * Sugestão 48 — "Reanalisar insumos da fila" (paridade frontend do gate v2).
 * O frontend NÃO roda as skills do redator (auditor-dosimetria/redator-penal vivem
 * no Cowork); então esta ação MARCA as peças pendentes para REANÁLISE no próximo
 * ciclo agendado, zerando pecas.gate_analisado_em — o gatilho que faz o Cowork
 * reavaliar o insumo (passo_1+passo_2 do gate). NÃO redige nem decide aqui (jamais
 * simular). Escopo: fila inteira (processoId nulo) ou só um processo. Alvo: peças
 * em a_fazer/aguardando_insumo e validado=false. Retorna quantas foram marcadas.
 */
export async function reanalisarPecas(processoId?: string | null): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    let q = supabase
      .from("pecas")
      .update({ gate_analisado_em: null })
      .in("status", ["a_fazer", "aguardando_insumo"])
      .eq("validado", false);
    if (processoId) q = q.eq("processo_id", processoId);
    const { data, error } = await q.select("id");
    if (error) throw error;
    const n = data?.length ?? 0;
    revalidarTudo();
    return {
      ok: true,
      message: n
        ? `${n} peça(s) marcada(s) para reanálise — o redator agendado reavalia os insumos no próximo ciclo (ALTA → minuta; BAIXA → pendência atualizada).`
        : "Nenhuma peça pendente para reanalisar neste escopo.",
    };
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
    // data_alvo só sobrescreve quando preenchida (preserva a atual).
    // descricao/observacoes agora vêm na view de leitura: o form envia o valor
    // atual como default, então gravamos sempre (inclusive limpar = string vazia → null).
    patch.descricao = String(fd.get("descricao") || "").trim() || null;
    patch.observacoes = String(fd.get("observacoes") || "").trim() || null;
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

    // Proveniência extra (Sug. 75 · etapa 3): origem andamento/tarefa herda também a
    // intimação do prazo escolhido, quando houver, para a baixa em cascata alcançá-la.
    let intimacao_extra: string | null = null;
    if (prazo_id && tipo_origem !== "intimacao") {
      const { data: prz2 } = await supabase.from("prazos").select("intimacao_id").eq("id", prazo_id).maybeSingle();
      intimacao_extra = (prz2?.intimacao_id as string | null) ?? null;
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
      // além do vínculo de origem, carrega a intimação do prazo (quando não é ela a origem).
      ...(intimacao_extra && tipo_origem !== "intimacao" ? { intimacao_id: intimacao_extra } : {}),
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

/** Atribui um advogado específico à peça (A fazer) — sem mover de coluna. */
export async function atribuirPeca(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const responsavel = String(fd.get("responsavel") || "").trim();
    if (!responsavel) return { ok: false, message: "Selecione o advogado responsável." };
    const supabase = await createClient();
    const { error } = await supabase.from("pecas").update({ responsavel }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: `Peça atribuída a ${responsavel}.` };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Validação humana da MINUTA do redator agendado (coluna Em revisão): aprova a
 * minuta (validado=true) e move para 'pronta'. NUNCA protocola — o protocolo só
 * acontece na baixa do prazo (baixarProtocoloPeca). Distinta de validarPeca, que
 * só confere a peça provisória sem mover de coluna.
 */
export async function validarMinuta(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("pecas").update({ validado: true, status: "pronta" }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Minuta validada — movida para Pronta. O sistema nunca protocola sozinho." };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Anexa um insumo (link no Drive + nota) a uma peça em 'aguardando_insumo' e a
 * marca para reanálise do redator agendado (gate_analisado_em=null). Registra o
 * insumo nas anotações (auditado). O documento em si é salvo no Drive pelo
 * usuário, na pasta do caso (/sistema/clientes/<cliente>/peças).
 */
export async function anexarInsumoPeca(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const link = String(fd.get("link") || "").trim();
    const nota = String(fd.get("nota") || "").trim();
    if (!link && !nota) return { ok: false, message: "Informe o link do insumo no Drive ou uma nota." };
    const supabase = await createClient();
    const { data: p } = await supabase.from("pecas").select("observacoes").eq("id", id).maybeSingle();
    const carimbo = `Insumo anexado${link ? `: ${link}` : ""}${nota ? ` — ${nota}` : ""}`;
    const observacoes = [(p?.observacoes as string | null) ?? null, carimbo].filter(Boolean).join("\n");
    const { error } = await supabase.from("pecas").update({ observacoes, gate_analisado_em: null }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    return { ok: true, message: "Insumo registrado e peça marcada para reanálise do redator agendado." };
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

/** Edição do andamento (reclassificar, ajustar código de movimentação, etc.).
 * Só grava os campos enviados; nada é apagado. */
export async function atualizarAndamento(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const patch: Record<string, unknown> = {};
    const tipo = String(fd.get("tipo") || "").trim();
    if (tipo) {
      if (!(ANDAMENTO_TIPO as readonly string[]).includes(tipo)) return { ok: false, message: "Tipo inválido." };
      patch.tipo = tipo;
    }
    const data = String(fd.get("data") || "").trim();
    if (data) patch.data = data;
    for (const c of ["descricao", "autor", "origem", "codigo_movimentacao"] as const) {
      if (!fd.has(c)) continue;
      const v = String(fd.get(c) ?? "").trim();
      patch[c] = v === "" ? null : v;
    }
    const processo_id = String(fd.get("processo_id") || "").trim();
    if (processo_id) patch.processo_id = processo_id;
    if (!Object.keys(patch).length) return { ok: false, message: "Nada para atualizar." };
    const { error } = await supabase.from("andamentos").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    revalidatePath(`/andamentos/${id}`);
    return { ok: true, message: "Andamento atualizado." };
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

    const { error } = await supabase
      .from("prazos")
      .update({ ato, data_fatal, data_interna, responsavel, tipo_contagem, validado: true, validado_em: agora() })
      .eq("id", id);
    if (error) throw error;

    revalidarTudo();
    return { ok: true, message: "Prazo validado com os ajustes. Fatal fixada — veja na /agenda." };
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

    const { error } = await supabase
      .from("audiencias")
      .update({ tipo, data_hora, modalidade, local_link, responsavel, validado: true, validado_em: agora() })
      .eq("id", id);
    if (error) throw error;

    revalidarTudo();
    return { ok: true, message: "Audiência validada com os ajustes. Fixada na /agenda." };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Edição livre de uma audiência (sem mexer no estado de validação).
 * Útil sobretudo em inclusões automáticas de processos sigilosos, que chegam
 * com dados incompletos.
 */
export async function atualizarAudiencia(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const tipo = String(fd.get("tipo") || "").trim();
    const nome = fd.has("nome") ? (String(fd.get("nome") || "").trim() || null) : undefined;
    const dataLocal = String(fd.get("data_hora") || ""); // YYYY-MM-DDTHH:mm
    const modalidade = String(fd.get("modalidade") || "") || null;
    const local_link = String(fd.get("local_link") || "") || null;
    const responsavel = String(fd.get("responsavel") || "Daniel");
    const observacoes = String(fd.get("observacoes") || "").trim() || null;
    if (!tipo) return { ok: false, message: "Tipo é obrigatório." };
    if (!dataLocal) return { ok: false, message: "Data e hora são obrigatórias." };
    const data_hora = `${dataLocal}:00-03:00`; // horário de Brasília
    const fimLocal = String(fd.get("data_fim") || "");
    const data_fim = fimLocal ? `${fimLocal}:00-03:00` : null; // Sugestão 66: fim da janela (sessão virtual)
    if (data_fim && data_fim < data_hora) return { ok: false, message: "O fim da janela deve ser igual ou posterior ao início." };

    const patch: Record<string, unknown> = { tipo, data_hora, data_fim, modalidade, local_link, responsavel, observacoes };
    if (nome !== undefined) patch.nome = nome;
    const { error } = await supabase
      .from("audiencias")
      .update(patch)
      .eq("id", id);
    if (error) throw error;

    revalidarTudo();
    return { ok: true, message: "Audiência atualizada." };
  } catch (e) {
    return falha(e);
  }
}

/** Troca rápida de modalidade (botões do card de IA no detalhe). */
export async function definirModalidadeAudiencia(id: string, modalidade: string): Promise<Resultado> {
  try {
    await requireUser();
    if (!AUDIENCIA_MODALIDADE.includes(modalidade as (typeof AUDIENCIA_MODALIDADE)[number])) {
      return { ok: false, message: "Modalidade inválida." };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("audiencias").update({ modalidade }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    revalidatePath(`/audiencias/${id}`);
    return { ok: true, message: `Modalidade definida: ${humano(modalidade)}.` };
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
 * Baixa de audiência REALIZADA (Sugestão 41): marca status='realizada'.
 * Correção é troca de status — nunca DELETE.
 */
export async function baixarAudiencia(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: a, error } = await supabase
      .from("audiencias")
      .select("status, tipo")
      .eq("id", id)
      .single();
    if (error || !a) throw new Error("Audiência não encontrada.");
    if (a.status !== "designada") return { ok: false, message: `Audiência não está ativa (${a.status}).` };

    const { error: upErr } = await supabase
      .from("audiencias")
      .update({ status: "realizada" })
      .eq("id", id);
    if (upErr) throw upErr;

    revalidarTudo();
    return { ok: true, message: "Audiência dada como realizada." };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Redesigna uma audiência: marca a antiga como `redesignada` (preserva a data
 * original no histórico) e cria uma NOVA audiência já vinculada à anterior
 * (redesignada_de), nascendo validado=false — a nova data entra na validação.
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

/* ============================ VARREDURA (ciclo) ============================
 * Ajuste de parâmetros do ciclo (fonte/status/janela). O snapshot é append-only
 * por natureza; este UPDATE é uma correção pontual de mesa, auditada. */
export async function atualizarVarredura(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const patch: Record<string, unknown> = {};
    const fonte = String(fd.get("fonte") || "").trim();
    const status = String(fd.get("status") || "").trim();
    const ji = String(fd.get("janela_inicio") || "").trim();
    const jf = String(fd.get("janela_fim") || "").trim();
    if (fonte) patch.fonte = fonte;
    if (status) patch.status = status;
    if (ji) patch.janela_inicio = ji;
    if (jf) patch.janela_fim = jf;
    if (Object.keys(patch).length === 0) return { ok: false, message: "Nada para alterar." };
    const supabase = await createClient();
    const { error } = await supabase.from("varreduras").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath(`/varredura/ciclos/${id}`);
    revalidatePath("/varredura");
    return { ok: true, message: "Varredura atualizada." };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ ANOTAÇÕES ============================
 * Controle próprio do usuário — texto livre, cada anotação é um card
 * independente (criar / editar / apagar). Genérica por entidade. */

export async function criarAnotacao(
  entidadeTipo: string,
  entidadeId: string,
  fd: FormData,
): Promise<Resultado> {
  try {
    const email = await requireUser();
    const texto = String(fd.get("texto") || "").trim();
    if (!texto) return { ok: false, message: "Escreva algo antes de salvar." };
    if (!entidadeTipo || !entidadeId) return { ok: false, message: "Entidade inválida." };
    const supabase = await createClient();
    const { error } = await supabase.from("anotacoes").insert({
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      texto,
      autor: email,
    });
    if (error) throw error;
    const rota: Record<string, string> = { audiencia: "/audiencias", prazo: "/prazos", cliente: "/clientes", estudo: "/estudos", intimacao: "/intimacoes", andamento: "/andamentos", contrato: "/contratos", peca: "/producao", processo: "/processos", varredura: "/varredura/ciclos", tarefa: "/tarefas" };
    if (rota[entidadeTipo]) revalidatePath(`${rota[entidadeTipo]}/${entidadeId}`);
    return { ok: true, message: "Anotação salva." };
  } catch (e) {
    return falha(e);
  }
}

export async function editarAnotacao(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const texto = String(fd.get("texto") || "").trim();
    if (!texto) return { ok: false, message: "A anotação não pode ficar vazia." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("anotacoes")
      .update({ texto, atualizado_em: agora() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true, message: "Anotação atualizada." };
  } catch (e) {
    return falha(e);
  }
}

export async function excluirAnotacao(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("anotacoes").delete().eq("id", id);
    if (error) throw error;
    return { ok: true, message: "Anotação apagada." };
  } catch (e) {
    return falha(e);
  }
}

/* ============================ COMPROMISSOS ============================ */

/** Cria um compromisso na agenda. */
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

    const { error } = await supabase
      .from("compromissos")
      .insert({ titulo, descricao, data_hora, local, responsavel, cliente_id, processo_id, tarefa_id, status: "agendado" });
    if (error) throw error;

    revalidarTudo();
    return { ok: true, message: "Compromisso criado na agenda." };
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

/** Desfecho de status do contrato (rescindir / quitar / inadimplente) — troca de
 * status, nunca DELETE. Motivo opcional vai para observações. */
export async function mudarStatusContrato(id: string, status: string, motivo?: string): Promise<Resultado> {
  try {
    await requireUser();
    if (!(CONTRATO_STATUS as readonly string[]).includes(status)) return { ok: false, message: "Status inválido." };
    const supabase = await createClient();
    const patch: Record<string, unknown> = { status };
    if (motivo?.trim()) {
      const rotulo = status === "rescindido" ? "Rescindido" : status === "quitado" ? "Quitado" : "Atualizado";
      patch.observacoes = `${rotulo}: ${motivo.trim()}`;
    }
    const { error } = await supabase.from("contratos").update(patch).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    revalidatePath(`/contratos/${id}`);
    return { ok: true, message: `Contrato: status ${humano(status)}.` };
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
    if (fd.has("data_inicio")) patch.data_inicio = String(fd.get("data_inicio") || "") || null;
    if (fd.has("dias")) {
      const d = String(fd.get("dias") || "").trim();
      patch.dias = d === "" ? null : Number(d);
    }
    const { error } = await supabase.from("prazos").update(patch).eq("id", id);
    if (error) throw error;

    revalidarTudo();
    return { ok: true, message: "Prazo atualizado." };
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

/** Desfecho do ciclo do estudo: marca status='concluido'. Nunca DELETE. */
export async function concluirEstudo(id: string): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("estudos_caso").update({ status: "concluido" }).eq("id", id);
    if (error) throw error;
    revalidarTudo();
    revalidatePath(`/estudos/${id}`);
    return { ok: true, message: "Estudo marcado como concluído." };
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
 * Registra um documento do caso. Dois caminhos:
 *  - ARQUIVO anexado + Drive configurado → faz upload para
 *    `Sistema/Clientes/<nome>/{<processo> | Financeiro}` (cria subpastas) e grava
 *    o ponteiro (drive_file_id/url/tamanho). É o fluxo principal.
 *  - Sem arquivo (ou Drive não configurado) → registra o ponteiro por id colado
 *    à mão (degradação segura, comportamento antigo preservado).
 * Aceita vínculo a processo/cliente/intimação e também a contrato/pagamento
 * (acervo financeiro). O CHECK exige ao menos um vínculo.
 */
export async function criarDocumento(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const processo_id = String(fd.get("processo_id") || "").trim() || null;
    let cliente_id = String(fd.get("cliente_id") || "").trim() || null;
    const intimacao_id = String(fd.get("intimacao_id") || "").trim() || null;
    const contrato_id = String(fd.get("contrato_id") || "").trim() || null;
    const pagamento_id = String(fd.get("pagamento_id") || "").trim() || null;
    if (!processo_id && !cliente_id && !intimacao_id && !contrato_id && !pagamento_id) {
      return { ok: false, message: "Vincule o documento a um processo, cliente, intimação, contrato ou pagamento." };
    }
    const tipo = String(fd.get("tipo") || "outro");
    if (!(DOCUMENTO_TIPO as readonly string[]).includes(tipo)) {
      return { ok: false, message: "Tipo de documento inválido." };
    }

    // Resolve contrato a partir da parcela (para a pasta e o vínculo), se faltar.
    let contratoIdFinal = contrato_id;
    if (pagamento_id && !contratoIdFinal) {
      const { data: pg } = await supabase.from("pagamentos").select("contrato_id").eq("id", pagamento_id).maybeSingle();
      if (pg?.contrato_id) contratoIdFinal = pg.contrato_id as string;
    }
    // Resolve o cliente (para a pasta no Drive e para o doc aparecer na ficha do cliente).
    if (!cliente_id && contratoIdFinal) {
      const { data: ct } = await supabase.from("contratos").select("cliente_id").eq("id", contratoIdFinal).maybeSingle();
      if (ct?.cliente_id) cliente_id = ct.cliente_id as string;
    }
    if (!cliente_id && processo_id) {
      const { data: cp } = await supabase.from("cliente_processo").select("cliente_id").eq("processo_id", processo_id).limit(1).maybeSingle();
      if (cp?.cliente_id) cliente_id = cp.cliente_id as string;
    }

    const arquivo = fd.get("arquivo");
    const temArquivo = arquivo instanceof File && arquivo.size > 0;
    let nome = String(fd.get("nome") || "").trim();
    let drive_file_id = String(fd.get("drive_file_id") || "").trim() || null;
    let drive_url = String(fd.get("drive_url") || "").trim() || null;
    let mime_type = String(fd.get("mime_type") || "").trim() || null;
    let tamanho_bytes: number | null = null;
    let origem = String(fd.get("origem") || "").trim() || "drive";

    if (temArquivo) {
      const file = arquivo as File;
      if (!driveConfigurado()) {
        return {
          ok: false,
          message: "Upload ao Drive não configurado neste ambiente. Cole o id do arquivo do Drive ou configure as credenciais OAuth (GOOGLE_OAUTH_*).",
        };
      }
      // Nome do cliente para a pasta; rótulo do processo para a subpasta.
      let nomeCliente = "";
      if (cliente_id) {
        const { data: cl } = await supabase.from("clientes").select("nome").eq("id", cliente_id).maybeSingle();
        nomeCliente = (cl?.nome as string) || "";
      }
      let procLabel = "";
      if (processo_id) {
        const { data: pr } = await supabase.from("processos").select("numero_cnj, numero_registro_tribunal").eq("id", processo_id).maybeSingle();
        procLabel = (pr?.numero_cnj as string) || (pr?.numero_registro_tribunal ? `reg ${pr.numero_registro_tribunal}` : "") || "Processo";
      }
      // Caminho sob Sistema/Clientes: cliente → (Financeiro | processo | raiz do cliente).
      const caminho: string[] = [];
      if (nomeCliente) caminho.push(nomeCliente);
      if (contratoIdFinal || pagamento_id) caminho.push("Financeiro");
      else if (processo_id) caminho.push(procLabel);

      const buf = Buffer.from(await file.arrayBuffer());
      const up = await uploadParaDrive({
        caminho,
        nome: nome || file.name,
        mimeType: file.type || null,
        bytes: buf,
      });
      if (!up) {
        return { ok: false, message: "Falha ao enviar o arquivo ao Drive. Tente novamente ou cole o id manualmente." };
      }
      nome = up.nome;
      drive_file_id = up.drive_file_id;
      drive_url = up.drive_url;
      mime_type = up.mime_type;
      tamanho_bytes = up.tamanho_bytes;
      origem = "upload";
    } else {
      if (!nome) return { ok: false, message: "Informe o nome do documento." };
      if (!drive_file_id) return { ok: false, message: "Anexe um arquivo ou informe o id do arquivo no Drive (drive_file_id)." };
    }

    const { error } = await supabase.from("documentos").insert({
      processo_id,
      cliente_id,
      intimacao_id,
      contrato_id: contratoIdFinal,
      pagamento_id,
      nome,
      tipo,
      drive_file_id,
      mime_type,
      origem,
      drive_url,
      tamanho_bytes,
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
    return { ok: true, message: temArquivo ? "Arquivo enviado ao Drive e registrado no acervo." : "Documento registrado no acervo." };
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

/* ==================== FUNIL DE NOVOS NEGÓCIOS (Sug. 59/68) ====================
 * Pré-contrato. Captação é ATO HUMANO (chat/frontend, RLS authenticated) — o
 * Cowork nunca escreve aqui. Nunca DELETE (correção = recusado/perdido). */

const FUNIL_ESTAGIOS = ["tratativa", "estudo_preliminar", "proposta", "negociacao", "fechado", "recusado", "perdido"];

export async function criarOportunidade(fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const titulo = String(fd.get("titulo") || "").trim();
    const contato_nome = String(fd.get("contato_nome") || "").trim();
    if (!titulo) return { ok: false, message: "Informe um título." };
    if (!contato_nome) return { ok: false, message: "Informe o nome do contato." };
    const valor = valorNumerico(fd.get("valor_proposto"));
    const { error } = await supabase.from("oportunidades").insert({
      titulo,
      contato_nome,
      contato_telefone: String(fd.get("contato_telefone") || "").trim() || null,
      contato_email: String(fd.get("contato_email") || "").trim() || null,
      origem_lead: String(fd.get("origem_lead") || "").trim() || null,
      area: String(fd.get("area") || "").trim() || null,
      resumo: String(fd.get("resumo") || "").trim() || null,
      estudo_preliminar: String(fd.get("estudo_preliminar") || "").trim() || null,
      estagio: "tratativa",
      valor_proposto: Number.isFinite(valor) && valor > 0 ? valor : null,
      forma_pagamento: String(fd.get("forma_pagamento") || "").trim() || null,
      probabilidade: String(fd.get("probabilidade") || "").trim() || null,
      responsavel: String(fd.get("responsavel") || "Daniel").trim() || "Daniel",
      segredo_justica: fd.get("segredo_justica") === "on",
      cadastrado_por: "chat",
      cadastro_automatico: false,
    });
    if (error) throw error;
    revalidatePath("/negocios");
    return { ok: true, message: "Oportunidade criada." };
  } catch (e) {
    return falha(e);
  }
}

export async function atualizarOportunidade(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const titulo = String(fd.get("titulo") || "").trim();
    const contato_nome = String(fd.get("contato_nome") || "").trim();
    if (!titulo) return { ok: false, message: "Informe um título." };
    if (!contato_nome) return { ok: false, message: "Informe o nome do contato." };
    const valor = valorNumerico(fd.get("valor_proposto"));
    const patch: Record<string, unknown> = {
      titulo,
      contato_nome,
      contato_telefone: String(fd.get("contato_telefone") || "").trim() || null,
      contato_email: String(fd.get("contato_email") || "").trim() || null,
      origem_lead: String(fd.get("origem_lead") || "").trim() || null,
      area: String(fd.get("area") || "").trim() || null,
      resumo: String(fd.get("resumo") || "").trim() || null,
      estudo_preliminar: String(fd.get("estudo_preliminar") || "").trim() || null,
      valor_proposto: Number.isFinite(valor) && valor > 0 ? valor : null,
      forma_pagamento: String(fd.get("forma_pagamento") || "").trim() || null,
      probabilidade: String(fd.get("probabilidade") || "").trim() || null,
      responsavel: String(fd.get("responsavel") || "Daniel").trim() || "Daniel",
      segredo_justica: fd.get("segredo_justica") === "on",
    };
    const { error } = await supabase.from("oportunidades").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath("/negocios");
    return { ok: true, message: "Oportunidade atualizada." };
  } catch (e) {
    return falha(e);
  }
}

/** Move a oportunidade de estágio. Recusado/perdido exigem motivo (gate de doutrina). */
export async function moverOportunidade(id: string, estagio: string, motivo?: string): Promise<Resultado> {
  try {
    await requireUser();
    if (!FUNIL_ESTAGIOS.includes(estagio)) return { ok: false, message: "Estágio inválido." };
    const encerra = estagio === "recusado" || estagio === "perdido";
    if (encerra && !motivo?.trim()) return { ok: false, message: "Informe o motivo do encerramento." };
    const supabase = await createClient();
    const patch: Record<string, unknown> = { estagio };
    if (encerra) { patch.motivo_recusa = motivo!.trim(); patch.data_decisao = hoje(); }
    if (estagio === "proposta") patch.data_proposta = hoje();
    if (estagio === "fechado") patch.data_decisao = hoje();
    const { error } = await supabase.from("oportunidades").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath("/negocios");
    return { ok: true, message: `Oportunidade movida para ${humano(estagio)}.` };
  } catch (e) {
    return falha(e);
  }
}

/**
 * Conversão (estágio fechado → cliente): dedup por clientes.nome_normalizado
 * (vincula em vez de duplicar), cria contrato + parcelas pelo fluxo financeiro e
 * grava de volta cliente_id/contrato_id na oportunidade (origem rastreável).
 */
export async function converterOportunidade(id: string, fd: FormData): Promise<Resultado> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: op } = await supabase.from("oportunidades").select("*").eq("id", id).maybeSingle();
    if (!op) return { ok: false, message: "Oportunidade não encontrada." };

    // 1) cliente — usa o já vinculado; senão dedup por nome normalizado; senão cria.
    let cliente_id = (op.cliente_id as string | null) ?? null;
    if (!cliente_id) {
      const nome = (op.contato_nome as string).trim();
      const nn = nome.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toUpperCase().replace(/\s+/g, " ");
      const { data: existente } = await supabase
        .from("clientes").select("id").eq("ativo", true).eq("nome_normalizado", nn).limit(1).maybeSingle();
      if (existente?.id) {
        cliente_id = existente.id as string;
      } else {
        const { data: novo, error: e1 } = await supabase.from("clientes").insert({
          nome,
          telefone: (op.contato_telefone as string | null) ?? null,
          email: (op.contato_email as string | null) ?? null,
          situacao_prisional: String(fd.get("situacao_prisional") || "solto"),
          ativo: true,
          cadastro_automatico: false,
          cadastrado_por: "chat",
          observacoes: `Origem: funil de novos negócios (${op.titulo}).`,
        }).select("id").single();
        if (e1) throw e1;
        cliente_id = novo.id as string;
      }
    }

    // 2) contrato
    const valor_total = valorNumerico(fd.get("valor_total")) || Number(op.valor_proposto ?? 0);
    if (!Number.isFinite(valor_total) || valor_total <= 0) return { ok: false, message: "Valor total do contrato inválido." };
    const { data: ctr, error: e2 } = await supabase.from("contratos").insert({
      cliente_id,
      objeto: String(fd.get("objeto") || "").trim() || (op.titulo as string),
      valor_total,
      forma_pagamento: String(fd.get("forma_pagamento") || "").trim() || (op.forma_pagamento as string | null) || null,
      data_contrato: hoje(),
      status: "vigente",
      observacoes: `Convertido do funil de novos negócios.`,
    }).select("id").single();
    if (e2) throw e2;
    const contrato_id = ctr.id as string;

    // 3) parcelas — n parcelas mensais a partir do 1º vencimento (valor dividido).
    const n = Math.max(1, Math.min(60, Number(String(fd.get("parcelas") || "1")) || 1));
    const venc0 = String(fd.get("primeiro_vencimento") || "") || hoje();
    const base = Math.floor((valor_total / n) * 100) / 100;
    const linhas = Array.from({ length: n }, (_, i) => {
      const d = new Date(venc0 + "T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + i);
      const valor = i === n - 1 ? Math.round((valor_total - base * (n - 1)) * 100) / 100 : base;
      return { contrato_id, numero_parcela: i + 1, valor, vencimento: d.toISOString().slice(0, 10), status: "a_vencer" };
    });
    const { error: e3 } = await supabase.from("pagamentos").insert(linhas);
    if (e3) throw e3;

    // 4) fecha a oportunidade com a origem rastreável
    const { error: e4 } = await supabase.from("oportunidades")
      .update({ estagio: "fechado", cliente_id, contrato_id, data_decisao: hoje() })
      .eq("id", id);
    if (e4) throw e4;

    revalidatePath("/negocios");
    revalidatePath("/clientes");
    revalidatePath("/financeiro");
    return { ok: true, message: `Convertido: cliente + contrato (${n} parcela${n === 1 ? "" : "s"}) criados.` };
  } catch (e) {
    return falha(e);
  }
}

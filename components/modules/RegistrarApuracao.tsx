"use client";

import { FormModal } from "@/components/FormModal";
import { apurarAndamento, concluirConferencia } from "@/app/actions";
import { ANDAMENTO_TIPO } from "@/lib/enums";
import { humano } from "@/lib/format";
import type { ReactNode } from "react";

/**
 * "Do que se trata" escrito por quem conferiu (Sug. 126 / Migração 101).
 *
 * O problema que isto resolve não é de registro, é de tempo: Daniel abre dezenas
 * de processos por dia e, se já abriu e conferiu, a visita da T4 àquele processo
 * é trabalho repetido. Faltava o gesto de dizer O QUE ERA — sem ele o banco
 * seguia sem saber, a fila não drenava e as 159 conferências já concluídas não
 * ensinaram nada ao mapa.
 *
 * O texto é OPCIONAL de propósito. Concluir a conferência sem escrever continua
 * valendo, e nesse caso o andamento segue opaco — presumir que concluir a tarefa
 * equivale a apurar inventaria conteúdo que ninguém escreveu, que é exatamente o
 * que a doutrina proíbe.
 */

/** Conferência escalada ainda aberta sobre ESTE movimento. */
export type ConferenciaAberta = { titulo?: string | null; prioridade?: string | null };

/**
 * O fecho da conferência dentro do gesto de apurar.
 *
 * `fn_apurar_humano` grava a apuração e encerra a CONSULTA da fila da T4 — nunca
 * tocou `tarefas`. Só que, no cartão, "Já conferi · do que se trata" fica ao lado
 * de "Conferir", e escrever do que se trata É a conferência: deixar a tarefa
 * aberta depois disso é pedir o mesmo trabalho duas vezes.
 *
 * Vem marcado, mas VISÍVEL e desmarcável, e nomeia o que vai fechar — porque nem
 * toda conferência escalada pergunta "do que se trata": há as de decurso de prazo
 * e de liberdade, que pedem AÇÃO e podem seguir de pé depois de identificado o
 * ato. Fecha só a deste movimento; apurando o processo inteiro, as tarefas dos
 * outros movimentos continuam como estavam.
 */
function FechoConferencia({ c }: { c: ConferenciaAberta }) {
  const urgente = c.prioridade === "urgente" || c.prioridade === "alta";
  return (
    <div className="apur-fecho">
      <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" name="concluir_tarefa" defaultChecked style={{ marginTop: 3 }} />
        <span>
          <b>Concluir também a conferência deste movimento</b>
          {c.titulo ? <><br /><span className="sub">{c.titulo}</span></> : null}
          {urgente && (
            <>
              <br />
              <span className="sub" style={{ color: "var(--amber)" }}>
                Prioridade {c.prioridade?.toUpperCase()} — se ela pede AÇÃO e não só identificar o ato,
                desmarque e deixe a tarefa aberta.
              </span>
            </>
          )}
        </span>
      </label>
    </div>
  );
}

function Campos({ escopoPadrao, tipoAtual }: { escopoPadrao: "processo" | "andamento"; tipoAtual?: string | null }) {
  return (
    <>
      <div>
        <label>Do que se trata</label>
        <textarea
          name="apuracao"
          rows={3}
          placeholder="Em uma ou duas frases, como se explicasse em voz alta. Ex.: “Juntada da certidão de decurso de prazo do MP; nada a fazer, só acompanhar.”"
        />
        <p className="sub" style={{ margin: "5px 0 0" }}>
          É este texto que passa a aparecer no card no lugar do texto cru do push, com o selo{" "}
          <b>verificado nos autos</b>. O original do tribunal continua intacto em “ver original”.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>Exige providência?</label>
          <select name="exige_providencia" defaultValue="">
            <option value="">— não sei / não digo</option>
            <option value="nao">Não — é rotina</option>
            <option value="sim">Sim — precisa de ação</option>
          </select>
        </div>
        <div>
          <label>Prazo identificado (opcional)</label>
          <input name="prazo_identificado" placeholder="Ex.: 5 dias corridos a partir de 29/07" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>Reclassificar o ato (opcional)</label>
          <select name="tipo_apurado" defaultValue="">
            <option value="">— manter {tipoAtual ? humano(tipoAtual).toLowerCase() : "como está"}</option>
            {ANDAMENTO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}
          </select>
        </div>
        <div>
          <label>Alcance</label>
          <select name="escopo" defaultValue={escopoPadrao}>
            <option value="processo">Todos os movimentos opacos deste processo</option>
            <option value="andamento">Só este movimento</option>
          </select>
        </div>
      </div>

      <p className="sub" style={{ margin: 0 }}>
        Esgotados os movimentos opacos do processo, ele <b>sai da fila da T4</b> — você já esteve
        nos autos, a visita perdeu o objeto. Restando algum, a visita continua de pé e a tela diz
        quantos são. O prazo, se houver, continua nascendo pelo registro de prazo e pela sua
        validação; nada aqui cria prazo, peça ou protocolo.
      </p>
    </>
  );
}

/** Botão do fecho da conferência — conclui a tarefa e, se você escrever, apura junto. */
export function ConcluirConferencia({
  tarefaId,
  titulo,
  temAndamento,
  tipoAtual,
  label = "✓ Concluir",
  variant = "primary",
}: {
  tarefaId: string;
  titulo: string;
  temAndamento: boolean;
  tipoAtual?: string | null;
  label?: ReactNode;
  variant?: "primary" | "default";
}) {
  return (
    <FormModal
      label={label}
      titulo="Concluir conferência"
      descricao={
        temAndamento
          ? "Se você abriu os autos, escreva do que se trata. É opcional — mas é o que dispensa a visita da T4 e ensina o sistema a reconhecer o mesmo movimento da próxima vez."
          : "Esta conferência não está amarrada a uma movimentação, então não há o que apurar."
      }
      acao={concluirConferencia.bind(null, tarefaId)}
      enviarLabel="Concluir"
      variant={variant}
    >
      <p className="sub" style={{ margin: 0 }}>
        Concluindo <b>{titulo}</b>.
      </p>
      {temAndamento && <Campos escopoPadrao="processo" tipoAtual={tipoAtual} />}
    </FormModal>
  );
}

/** Botão direto no andamento, para quem conferiu sem passar por tarefa. */
export function RegistrarApuracao({
  andamentoId,
  tipoAtual,
  conferencia,
  label = "Registrar do que se trata",
  variant = "primary",
}: {
  andamentoId: string;
  tipoAtual?: string | null;
  /** Passe quando houver conferência escalada ABERTA sobre este movimento. */
  conferencia?: ConferenciaAberta | null;
  label?: ReactNode;
  variant?: "primary" | "default";
}) {
  return (
    <FormModal
      label={label}
      titulo="Registrar do que se trata"
      descricao={
        conferencia
          ? "Você abriu os autos e viu. Escreva o que era — o card passa a mostrar isso no lugar do texto cru, a conferência deste movimento fecha, o processo sai da fila da T4 e o mapa aprende a reconhecer o mesmo movimento."
          : "Você abriu os autos e viu. Escreva o que era — o card passa a mostrar isso no lugar do texto cru, o processo sai da fila da T4 e o mapa aprende a reconhecer o mesmo movimento."
      }
      acao={apurarAndamento.bind(null, andamentoId)}
      enviarLabel="Registrar"
      variant={variant}
    >
      <Campos escopoPadrao="processo" tipoAtual={tipoAtual} />
      {conferencia && <FechoConferencia c={conferencia} />}
    </FormModal>
  );
}

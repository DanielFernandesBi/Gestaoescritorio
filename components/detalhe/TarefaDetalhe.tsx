"use client";

import Link from "next/link";
import { Acao } from "@/components/Acao";
import { FormModal } from "@/components/FormModal";
import { SegredoTag } from "@/components/ui";
import { CriarPecaPendente } from "@/components/modules/CriarPecaPendente";
import { CriarCompromisso } from "@/components/CriarCompromisso";
import { moverTarefa, atualizarTarefa, assumirTarefa, reatribuirTarefa } from "@/app/actions";
import { PRIORIDADES, RESPONSAVEIS } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import type { Tarefa } from "@/lib/data";
import type { MapaProvidencia } from "@/lib/pecas";

type Socio = "Daniel" | "Rodolfo";
const oUtroSocio = (s: Socio): Socio => (s === "Daniel" ? "Rodolfo" : "Daniel");

/**
 * Corpo de detalhe de uma tarefa — usado no drawer do board (TarefasBoard),
 * no drawer-por-rota (@modal/(.)tarefas/[id]) e na página /tarefas/[id].
 */
export function TarefaDetalhe({
  t,
  mapa = null,
  socio = null,
}: {
  t: Tarefa;
  mapa?: MapaProvidencia | null;
  socio?: Socio | null;
}) {
  const outro = socio ? oUtroSocio(socio) : null;
  const conferencia = Boolean(t.cadastro_automatico) && t.cadastrado_por === "cowork";

  return (
    <>
      {(conferencia || t.cadastrado_por) && (
        <div className="dsec">
          <h4>Proveniência</h4>
          <div className="mini">
            <div>
              <div className="mt">
                {conferencia ? "Conferência criada pela triagem (Cowork)" : `Cadastro: ${humano(t.cadastrado_por)}`}
                {" "}<SegredoTag on={Boolean(t.segredo)} />
              </div>
              <div className="ms">
                {t.numero_cnj ? `Processo ${t.numero_cnj}` : "Sem processo vinculado"}
              </div>
            </div>
            {conferencia && t.andamento_id && (
              <Link className="link" href={`/ir/andamento/${t.andamento_id}`}>ver movimentação</Link>
            )}
          </div>
        </div>
      )}
      <div className="dsec">
        <h4>Descrição</h4>
        <div className="field"><div className="v">{t.descricao ?? "—"}</div></div>
      </div>
      <div className="dsec">
        <h4>Dados</h4>
        <div className="dgrid">
          <div className="field"><div className="k">Status</div><div className="v">{humano(t.status)}</div></div>
          <div className="field"><div className="k">Prioridade</div><div className="v">{humano(t.prioridade)}</div></div>
          <div className="field"><div className="k">Responsável</div><div className="v">{t.responsavel ?? "—"}</div></div>
          <div className="field"><div className="k">Data limite</div><div className="v mono">{fmtDate(t.data_limite)}</div></div>
        </div>
      </div>
      <div className="dsec">
        <h4>Editar</h4>
        <div className="acoes">
          <FormModal label="Editar tarefa" titulo="Editar tarefa" acao={atualizarTarefa.bind(null, t.id)} enviarLabel="Salvar" variant="default">
            <div><label>Título</label><input name="titulo" required defaultValue={t.titulo} /></div>
            <div><label>Descrição</label><textarea name="descricao" defaultValue={t.descricao ?? ""} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Prioridade</label><select name="prioridade" defaultValue={t.prioridade ?? "media"}>{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label>Responsável</label><select name="responsavel" defaultValue={t.responsavel ?? "Daniel"}>{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
            <div><label>Data limite</label><input type="date" name="data_limite" defaultValue={t.data_limite?.slice(0, 10) ?? ""} /></div>
          </FormModal>
        </div>
      </div>
      <div className="dsec">
        <h4>Mover</h4>
        <div className="acoes">
          {t.status !== "em_andamento" && (
            <Acao label="Em andamento" titulo="Mover tarefa"
              resumo={<>Mover <b>{t.titulo}</b> para <b>em andamento</b>?</>}
              acao={() => moverTarefa(t.id, "em_andamento")} />
          )}
          {t.status !== "concluida" && (
            <Acao label="Concluir" variant="ok" titulo="Concluir tarefa"
              resumo={<>Marcar <b>{t.titulo}</b> como <b>concluída</b>?</>}
              acao={() => moverTarefa(t.id, "concluida")} />
          )}
          {t.status !== "pendente" && (
            <Acao label="Voltar p/ pendente" titulo="Reabrir tarefa"
              resumo={<>Voltar <b>{t.titulo}</b> para <b>pendente</b>?</>}
              acao={() => moverTarefa(t.id, "pendente")} />
          )}
          <Acao label="Cancelar" variant="danger" titulo="Cancelar tarefa"
            resumo={<>Cancelar <b>{t.titulo}</b>?</>}
            acao={() => moverTarefa(t.id, "cancelada")} />
        </div>
      </div>
      {socio && (
        <div className="dsec">
          <h4>Atribuição</h4>
          <div className="acoes">
            {t.responsavel !== socio && (
              <Acao label="Assumir" titulo="Assumir tarefa"
                resumo={<>Assumir <b>{t.titulo}</b> como <b>{socio}</b>?{t.status === "pendente" ? <> Será movida para <b>Em andamento</b>.</> : null}</>}
                acao={() => assumirTarefa(t.id)} />
            )}
            {outro && t.responsavel !== outro && (
              <Acao label={`Reatribuir a ${outro}`} titulo="Reatribuir tarefa"
                resumo={<>Reatribuir <b>{t.titulo}</b> a <b>{outro}</b>?</>}
                acao={() => reatribuirTarefa(t.id)} />
            )}
          </div>
        </div>
      )}
      <div className="dsec">
        <h4>Agenda</h4>
        <div className="acoes">
          <CriarCompromisso
            tituloPadrao={t.titulo}
            descricaoPadrao={t.descricao ?? ""}
            dataPadrao={t.data_limite}
            responsavelPadrao={t.responsavel}
            tarefaId={t.id}
            processoId={t.processo_id}
            clienteId={t.cliente_id}
          />
        </div>
      </div>

      <div className="dsec">
        <h4>Produção</h4>
        <div className="acoes">
          <CriarPecaPendente
            tipoOrigem="tarefa"
            origemId={t.id}
            texto={[t.titulo, t.descricao].filter(Boolean).join(" — ")}
            baseTitulo={t.titulo}
            mapa={mapa}
          />
        </div>
      </div>
    </>
  );
}

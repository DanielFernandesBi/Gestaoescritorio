import { getIntimacoes } from "@/lib/data";
import { getUserId } from "@/lib/queries";
import { lidaPorMim } from "@/lib/ciencia";
import { IntimacoesList } from "@/components/modules/IntimacoesList";
import { PageHeader } from "@/components/PageHeader";
import { FormModal } from "@/components/FormModal";
import { Icon } from "@/components/Icon";
import { criarIntimacao } from "@/app/actions";
import { INTIMACAO_ORIGEM } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function IntimacoesPage() {
  const [intimacoes, meuId] = await Promise.all([getIntimacoes(), getUserId()]);
  // O KPI de abertura é o eixo de LEITURA, não o de fluxo. "Pendentes" virou zero
  // por construção quando a T1 passou a amarrar o artefato na mesma rodada da
  // captura, e liderar a tela com ele escondia justamente o que falta conferir.
  const nRevisar = intimacoes.filter((i) => !lidaPorMim(i, meuId)).length;
  const nAnalise = intimacoes.filter((i) => i.status === "em_analise").length;
  const nSemProv = intimacoes.filter((i) => i.status === "sem_providencia").length;
  return (
    <>
      <PageHeader
        breadcrumb={["Entrada · IA", "Intimações"]}
        eyebrow="Porta de entrada"
        titulo="Intimações"
        descricao={
          <>
            DJe, push (STJ/STF), PJe, eproc, e-SAJ, SEEU, e-mail. Deduplicação por
            código de publicação; sem processo identificado entram como órfãs.
          </>
        }
        kpis={[
          { valor: nRevisar, label: "para você revisar · não lidas", tone: nRevisar ? "amber" : "green" },
          { valor: nAnalise, label: "em análise", tone: "accent" },
          { valor: nSemProv, label: "sem providência", tone: "neutral" },
          { valor: intimacoes.length, label: "total · acervo recente", tone: "neutral" },
        ]}
        acoes={
          <FormModal
            label={<><Icon name="inbox" size={15} /> Cadastrar intimação</>}
            titulo="Nova intimação"
            descricao="Sem processo vinculado, nasce como órfã (triagem)."
            acao={criarIntimacao}
            enviarLabel="Cadastrar"
          >
            <div>
              <label>Origem</label>
              <select name="origem" defaultValue="dje">{INTIMACAO_ORIGEM.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}</select>
            </div>
            <div><label>Resumo</label><textarea name="resumo" required placeholder="Resumo do teor da intimação." /></div>
            <div><label>Teor integral (opcional)</label><textarea name="teor" placeholder="Cole o teor completo; se vazio, usa o resumo." /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label>Publicação</label><input type="date" name="data_publicacao" /></div>
              <div><label>Ciência</label><input type="date" name="data_ciencia" /></div>
            </div>
          </FormModal>
        }
      />
      <IntimacoesList intimacoes={intimacoes} meuId={meuId} />
    </>
  );
}

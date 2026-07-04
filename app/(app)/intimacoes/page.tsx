import { getIntimacoes } from "@/lib/data";
import { getUserId } from "@/lib/queries";
import { IntimacoesList } from "@/components/modules/IntimacoesList";
import { PageHeader } from "@/components/PageHeader";
import { FormModal } from "@/components/FormModal";
import { Icon } from "@/components/Icon";
import { criarIntimacao } from "@/app/actions";
import { INTIMACAO_ORIGEM } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function IntimacoesPage() {
  const [intimacoes, meuId] = await Promise.all([getIntimacoes(), getUserId()]);
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

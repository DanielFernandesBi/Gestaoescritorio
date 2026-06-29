import { getEstudos, getClientes } from "@/lib/data";
import { EstudosList } from "@/components/modules/EstudosList";
import { FormModal } from "@/components/FormModal";
import { BuscaSelect } from "@/components/BuscaSelect";
import { Icon } from "@/components/Icon";
import { criarEstudo } from "@/app/actions";
import { ESTUDO_TIPO } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function EstudosPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  const [estudos, clientes] = await Promise.all([getEstudos(), getClientes()]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inteligência jurídica</div>
          <h1>Estudos de caso</h1>
          <p>
            Estratégia por cliente: diagnóstico de cada processo, objetivos com alvo e
            instrumento (RVC/HC) e o resultado conforme as decisões saem.
          </p>
        </div>
        <FormModal label={<><Icon name="book" size={15} /> Novo estudo</>} titulo="Novo estudo de caso" acao={criarEstudo} enviarLabel="Criar estudo">
          <div><label>Título</label><input name="titulo" required placeholder="Ex.: Execução penal — estratégia global" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div><label>Cliente</label>
              <BuscaSelect name="cliente_id" options={clientes.map((c) => ({ id: c.id, label: c.nome }))} placeholder="Buscar cliente… (opcional)" />
            </div>
            <div><label>Tipo</label><select name="tipo" defaultValue="execucao_global">{ESTUDO_TIPO.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          </div>
          <div><label>Diagnóstico geral</label><textarea name="conteudo" placeholder="Visão geral da execução / o que dá para fazer" /></div>
          <div><label>Teses</label><textarea name="teses" /></div>
          <div><label>Jurisprudência</label><textarea name="jurisprudencia" placeholder="Precedentes que sustentam as teses" /></div>
          <p className="sub" style={{ margin: 0 }}>Depois de criar, abra o estudo para vincular processos e definir objetivos.</p>
        </FormModal>
      </div>

      <EstudosList estudos={estudos} clienteFiltro={cliente} />
    </>
  );
}

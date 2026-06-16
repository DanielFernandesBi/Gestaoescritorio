import { getClientesDuplicados, getProcessosReconciliacao } from "@/lib/data";
import { DuplicadosView } from "@/components/modules/DuplicadosView";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function DuplicadosPage() {
  const [clusters, processos] = await Promise.all([
    getClientesDuplicados(),
    getProcessosReconciliacao(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Higiene do acervo</div>
          <h1>Duplicados a revisar</h1>
          <p>
            Mesclagem de registros repetidos — clientes (mesmo nome) e processos sem CNJ.
            O assistente reassocia tudo ao canônico e desativa/arquiva o duplicado (nunca apaga; tudo auditado).
          </p>
        </div>
      </div>

      <div className="banner">
        <span className="ico"><Icon name="users" /></span>
        <div>
          <b>Atenção a homônimos.</b> CPFs distintos no mesmo grupo indicam pessoas diferentes — nesse caso, não mescle.
          Sempre escolha o <b>canônico</b> (registro a manter) e confira o resumo antes de confirmar.
        </div>
      </div>

      <DuplicadosView clusters={clusters} processos={processos} />
    </>
  );
}

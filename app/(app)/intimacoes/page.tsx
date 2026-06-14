import { getIntimacoes } from "@/lib/data";
import { IntimacoesList } from "@/components/modules/IntimacoesList";

export const dynamic = "force-dynamic";

export default async function IntimacoesPage() {
  const intimacoes = await getIntimacoes();
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Porta de entrada</div>
          <h1>Intimações</h1>
          <p>
            DJe, push (STJ/STF), PJe, eproc, e-SAJ, SEEU, e-mail. Deduplicação por
            código de publicação; sem processo identificado entram como órfãs.
          </p>
        </div>
      </div>
      <IntimacoesList intimacoes={intimacoes} />
    </>
  );
}

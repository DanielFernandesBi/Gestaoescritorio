import { getProcessos } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ProcessosList } from "@/components/modules/ProcessosList";

export const dynamic = "force-dynamic";

export default async function ProcessosPage() {
  const supabase = await createClient();
  const [processos, ativos, semCnj, sigilosos] = await Promise.all([
    getProcessos(400),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("processos").select("*", { count: "exact", head: true }).is("numero_cnj", null),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("segredo_justica", true),
  ]);

  const totalAtivos = ativos.count ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{totalAtivos.toLocaleString("pt-BR")} ativos no acervo</div>
          <h1>Processos</h1>
          <p>
            Chave natural: CNJ ou nº de registro do tribunal. {semCnj.count ?? 0} sem CNJ ·{" "}
            {sigilosos.count ?? 0} em segredo de justiça.
          </p>
        </div>
      </div>
      <ProcessosList processos={processos} totalAtivos={totalAtivos} />
    </>
  );
}

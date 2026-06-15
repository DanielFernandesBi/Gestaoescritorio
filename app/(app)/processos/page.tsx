import { getProcessos } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ProcessosList } from "@/components/modules/ProcessosList";
import { FormModal } from "@/components/FormModal";
import { Icon } from "@/components/Icon";
import { criarProcesso } from "@/app/actions";
import { PROCESSO_INSTANCIA, PROCESSO_AREA, RESPONSAVEIS } from "@/lib/enums";

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
        <FormModal label={<><Icon name="folder" size={15} /> Novo processo</>} titulo="Novo processo" descricao="Chave: CNJ ou nº de registro. Checa duplicata antes de criar." acao={criarProcesso} enviarLabel="Cadastrar">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label>Nº CNJ</label><input name="numero_cnj" placeholder="0000000-00.0000.0.00.0000" /></div>
            <div><label>Nº registro</label><input name="numero_registro_tribunal" placeholder="ex.: 2022/0044623-6" /></div>
          </div>
          <div><label>Tribunal *</label><input name="tribunal" required placeholder="TJSP, STJ…" /></div>
          <div><label>Vara / comarca</label><input name="vara_comarca" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label>UF</label><input name="uf" maxLength={2} /></div>
            <div><label>Instância</label><select name="instancia" defaultValue="1grau">{PROCESSO_INSTANCIA.map((i) => <option key={i} value={i}>{i.toUpperCase()}</option>)}</select></div>
            <div><label>Área</label><select name="area" defaultValue="criminal">{PROCESSO_AREA.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}</select></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div><label>Classe</label><input name="classe" placeholder="Ação Penal, HC…" /></div>
            <div><label>Responsável</label><select name="responsavel" defaultValue="Daniel">{RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
            <input type="checkbox" name="segredo_justica" style={{ width: "auto" }} /> Segredo de justiça
          </label>
        </FormModal>
      </div>
      <ProcessosList processos={processos} totalAtivos={totalAtivos} />
    </>
  );
}

import { getAcervoProcessos } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ProcessosList } from "@/components/modules/ProcessosList";
import { FormModal } from "@/components/FormModal";
import { Icon } from "@/components/Icon";
import { criarProcesso } from "@/app/actions";
import { getClientes } from "@/lib/data";
import { PROCESSO_INSTANCIA, PROCESSO_AREA, RESPONSAVEIS, PAPEL } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function ProcessosPage() {
  const supabase = await createClient();
  const [{ processos, tombstones }, ativos, semCnj, sigilosos, parados, clientes] = await Promise.all([
    getAcervoProcessos(150),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", "ativo").is("numero_cnj", null),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", "ativo").eq("segredo_justica", true),
    supabase.from("vw_processos_movimentacao").select("*", { count: "exact", head: true }).gte("dias_parado", 30),
    getClientes(),
  ]);

  const stats = {
    ativos: ativos.count ?? 0,
    parados: parados.count ?? 0,
    sigilosos: sigilosos.count ?? 0,
    semcnj: semCnj.count ?? 0,
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Acervo · criminal em 20+ UFs</div>
          <h1>Processos</h1>
          <p>
            Identificados por CNJ ou registro do tribunal. Cada caso mostra sua saúde: próximo fatal,
            inércia, peças e marcos de execução.
          </p>
        </div>
        <FormModal label={<><Icon name="folder" size={15} /> Cadastrar processo</>} titulo="Novo processo" descricao="Chave: CNJ ou nº de registro. Checa duplicata antes de criar." acao={criarProcesso} enviarLabel="Cadastrar">
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
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div><label>Cliente (vincular existente)</label>
              <select name="cliente_id" defaultValue="">
                <option value="">— sem vínculo —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div><label>Papel</label><select name="papel" defaultValue="reu">{PAPEL.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
          </div>
          <div><label>…ou criar novo cliente (nome)</label><input name="novo_cliente_nome" placeholder="Preencha só se o cliente ainda não existe" /></div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
            <input type="checkbox" name="segredo_justica" style={{ width: "auto" }} /> Segredo de justiça
          </label>
        </FormModal>
      </div>
      <ProcessosList processos={processos} tombstones={tombstones} stats={stats} />
    </>
  );
}

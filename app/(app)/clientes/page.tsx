import { getAcervoClientes } from "@/lib/data";
import { ClientesList } from "@/components/modules/ClientesList";
import { FormModal } from "@/components/FormModal";
import { Icon } from "@/components/Icon";
import { criarCliente } from "@/app/actions";
import { SITUACAO_PRISIONAL } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clientes = await getAcervoClientes();
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Acervo de pessoas · situação consolidada</div>
          <h1>Clientes</h1>
          <p>Cada pessoa com a situação consolidada — prisional, processos, prazos, financeiro e marcos de execução — num único olhar.</p>
        </div>
        <FormModal label={<><Icon name="users" size={15} /> Cadastrar cliente</>} titulo="Novo cliente" descricao="Checagem de duplicata por nome (sem acento) e CPF." acao={criarCliente} enviarLabel="Cadastrar">
          <div><label>Nome completo</label><input name="nome" required placeholder="Nome do cliente" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label>CPF</label><input name="cpf" placeholder="(opcional)" /></div>
            <div><label>UF</label><input name="uf" maxLength={2} /></div>
          </div>
          <div><label>Situação prisional</label><select name="situacao_prisional" defaultValue="solto">{SITUACAO_PRISIONAL.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></div>
          <div><label>Unidade prisional (se preso)</label><input name="unidade_prisional" /></div>
          <div><label>Telefone / contato</label><input name="telefone" /></div>
          <div><label>Observações</label><textarea name="observacoes" /></div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
            <input type="checkbox" name="forcar" style={{ width: "auto" }} /> Criar mesmo havendo homônimo (confirmo que é outra pessoa)
          </label>
        </FormModal>
      </div>
      <ClientesList clientes={clientes} />
    </>
  );
}

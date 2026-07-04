import { getAcervoClientes, getClientes } from "@/lib/data";
import { ClientesList } from "@/components/modules/ClientesList";
import { PageHeader } from "@/components/PageHeader";
import { ClienteMaster } from "@/components/detalhe/ClienteMaster";
import { ListaRaiz } from "@/components/ListaRaiz";
import { FormModal } from "@/components/FormModal";
import { Icon } from "@/components/Icon";
import { criarCliente } from "@/app/actions";
import { SITUACAO_PRISIONAL } from "@/lib/enums";

export const dynamic = "force-dynamic";

const PRESO = new Set(["preso_provisorio", "preso_definitivo"]);

export default async function ClientesPage() {
  const [clientes, indice] = await Promise.all([getAcervoClientes(), getClientes()]);
  const nPresos = clientes.filter((c) => c.situacao_prisional && PRESO.has(c.situacao_prisional)).length;
  const nExec = clientes.filter((c) => c.em_execucao).length;
  const nInad = clientes.filter((c) => c.inadimplente).length;
  return (
    <ListaRaiz indice={<ClienteMaster lista={indice} />}>
      <PageHeader
        breadcrumb={["Acervo", "Clientes"]}
        eyebrow="Acervo de pessoas · situação consolidada"
        titulo="Clientes"
        descricao="Cada pessoa com a situação consolidada — prisional, processos, prazos, financeiro e marcos de execução — num único olhar."
        acoes={
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
        }
        kpis={[
          { valor: clientes.length, label: "clientes · ativos", tone: "accent" },
          { valor: nPresos, label: "presos · liberdade", tone: "red" },
          { valor: nExec, label: "em execução penal", tone: "amber" },
          { valor: nInad, label: "inadimplentes · cobrança", tone: "neutral" },
        ]}
      />
      <ClientesList clientes={clientes} />
    </ListaRaiz>
  );
}

import { getAcervoProcessos, getProcessos, getProcessosPorStatus } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ProcessosList } from "@/components/modules/ProcessosList";
import { PageHeader } from "@/components/PageHeader";
import { ProcessoMaster } from "@/components/detalhe/ProcessoPainel";
import { ListaRaiz } from "@/components/ListaRaiz";
import { FormModal } from "@/components/FormModal";
import { BuscaSelect } from "@/components/BuscaSelect";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { criarProcesso } from "@/app/actions";
import { getClientes } from "@/lib/data";
import { PROCESSO_INSTANCIA, PROCESSO_AREA, PROCESSO_STATUS, RESPONSAVEIS, PAPEL } from "@/lib/enums";
import { humano, fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProcessosPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const ALLOWED = [...PROCESSO_STATUS, "todos"];
  const status = sp.status && ALLOWED.includes(sp.status) ? sp.status : "ativo";
  const escopo = status === "todos";

  const supabase = await createClient();
  let qSemCnj = supabase.from("processos").select("*", { count: "exact", head: true }).is("numero_cnj", null);
  let qSig = supabase.from("processos").select("*", { count: "exact", head: true }).eq("segredo_justica", true);
  if (!escopo) { qSemCnj = qSemCnj.eq("status", status); qSig = qSig.eq("status", status); }

  const [{ processos, tombstones }, porStatus, semCnj, sigilosos, parados, clientes, indice] = await Promise.all([
    getAcervoProcessos(600, status),
    getProcessosPorStatus(),
    qSemCnj,
    qSig,
    supabase.from("vw_processos_movimentacao").select("*", { count: "exact", head: true }).gte("dias_parado", 30),
    getClientes(),
    getProcessos(),
  ]);

  const total = Object.values(porStatus).reduce((a, b) => a + b, 0);
  const statusTotal = escopo ? total : (porStatus[status] ?? 0);
  const stats = {
    ativos: statusTotal,
    parados: parados.count ?? 0,
    sigilosos: sigilosos.count ?? 0,
    semcnj: semCnj.count ?? 0,
  };

  // Chips de status (só os que existem) + "Todos".
  const statusChips = [
    ...PROCESSO_STATUS.filter((s) => (porStatus[s] ?? 0) > 0).map((s) => ({ id: s, label: humano(s), n: porStatus[s] })),
    { id: "todos", label: "Todos", n: total },
  ];

  return (
    <ListaRaiz indice={<ProcessoMaster lista={indice} />}>
      <PageHeader
        breadcrumb={["Acervo", "Processos"]}
        eyebrow="Acervo · criminal em 20+ UFs"
        titulo="Processos"
        descricao={
          <>
            Identificados por CNJ ou registro do tribunal. Cada caso mostra sua saúde: próximo fatal,
            inércia, peças e marcos de execução.
          </>
        }
        acoes={
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
                <BuscaSelect name="cliente_id" options={clientes.map((c) => ({ id: c.id, label: c.nome }))} placeholder="Buscar cliente… (opcional)" />
              </div>
              <div><label>Papel</label><select name="papel" defaultValue="reu">{PAPEL.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            </div>
            <div><label>…ou criar novo cliente (nome)</label><input name="novo_cliente_nome" placeholder="Preencha só se o cliente ainda não existe" /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" name="segredo_justica" style={{ width: "auto" }} /> Segredo de justiça
            </label>
          </FormModal>
        }
        kpis={[
          { valor: fmtNum(total), label: "no acervo", tone: "accent" },
          { valor: fmtNum(porStatus["ativo"] ?? 0), label: "ativos", tone: "green" },
          { valor: fmtNum(stats.parados), label: "parados ≥30d · inércia", tone: "amber" },
          { valor: fmtNum(stats.semcnj), label: "sem CNJ · só registro", tone: "neutral" },
        ]}
      />
      <div className="proc-statusfiltro">
        <span className="proc-statusfiltro-l">Status</span>
        {statusChips.map((c) => (
          <Link key={c.id} className={`audp-chip ink${c.id === status ? " on" : ""}`} href={`/processos${c.id === "ativo" ? "" : `?status=${c.id}`}`}>
            {c.label} <b>{fmtNum(c.n)}</b>
          </Link>
        ))}
      </div>
      <ProcessosList processos={processos} tombstones={tombstones} stats={stats} statusAtual={status} />
    </ListaRaiz>
  );
}

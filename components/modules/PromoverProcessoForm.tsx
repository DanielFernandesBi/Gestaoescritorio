"use client";

import type { ReactNode } from "react";
import { FormModal } from "@/components/FormModal";
import { PAPEL, PROCESSO_INSTANCIA, PROCESSO_AREA } from "@/lib/enums";
import { humano } from "@/lib/format";
import type { Resultado } from "@/app/actions";

type ProcLite = { id: string; label: string };
type CliLite = { id: string; nome: string };

const subH = {
  margin: "12px 0 2px",
  fontSize: 11,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--brass)",
} as const;
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as const;
const check = { display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 } as const;

/**
 * Assistente "Promover órfã" (padrão da casa): identifica o processo por CNJ/registro
 * (dedup + resolução de tombstones no servidor) ou cadastra um novo (formulário mínimo),
 * e oferece vincular cliente. Reutilizado em prazos/intimações/andamentos órfãos.
 * A confirmação é o submit; o resultado resume o que foi gravado.
 */
export function PromoverProcessoForm({
  titulo,
  descricao,
  acao,
  procs,
  clis,
  header,
  enviarLabel = "Promover",
}: {
  titulo: string;
  descricao?: string;
  acao: (fd: FormData) => Promise<Resultado>;
  procs: ProcLite[];
  clis: CliLite[];
  header?: ReactNode;
  enviarLabel?: string;
}) {
  return (
    <FormModal label="Promover órfã" titulo={titulo} descricao={descricao} acao={acao} enviarLabel={enviarLabel} variant="primary">
      {header}
      <h4 style={subH}>1 · Processo</h4>
      <div>
        <label>Processo já existente</label>
        <select name="processo_id" defaultValue="">
          <option value="">— cadastrar novo abaixo —</option>
          {procs.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <p className="sub" style={{ margin: "2px 0 6px" }}>
        Se selecionar um existente, os campos abaixo são ignorados (mas um CNJ informado completa um registro que ainda não tinha CNJ).
        Tombstones de mesclagem são resolvidos para o processo canônico.
      </p>
      <div style={grid2}>
        <div><label>Nº CNJ</label><input name="numero_cnj" placeholder="0000000-00.0000.0.00.0000" /></div>
        <div><label>Nº registro tribunal</label><input name="numero_registro_tribunal" placeholder="se não houver CNJ" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div><label>Tribunal</label><input name="tribunal" placeholder="Ex.: STJ, TJSP" /></div>
        <div><label>UF</label><input name="uf" maxLength={2} /></div>
      </div>
      <div style={grid2}>
        <div><label>Instância</label><select name="instancia" defaultValue="1grau">{PROCESSO_INSTANCIA.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
        <div><label>Área</label><select name="area" defaultValue="criminal">{PROCESSO_AREA.map((a) => <option key={a} value={a}>{humano(a)}</option>)}</select></div>
      </div>
      <div><label>Vara / comarca</label><input name="vara_comarca" /></div>
      <label style={check}>
        <input type="checkbox" name="segredo_justica" style={{ width: "auto" }} /> Processo em segredo de justiça
      </label>

      <h4 style={subH}>2 · Cliente (opcional)</h4>
      <div style={grid2}>
        <div>
          <label>Cliente existente</label>
          <select name="cliente_id" defaultValue="">
            <option value="">— nenhum / novo abaixo —</option>
            {clis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div><label>Papel</label><select name="papel" defaultValue="reu">{PAPEL.map((p) => <option key={p} value={p}>{humano(p)}</option>)}</select></div>
      </div>
      <div><label>Ou cadastrar novo cliente (nome)</label><input name="novo_cliente_nome" placeholder="deixe em branco se já selecionou acima" /></div>
    </FormModal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { DiasBox } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { promoverPrazoOrfao } from "@/app/actions";
import { PAPEL, PROCESSO_INSTANCIA, PROCESSO_AREA } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import type { PrazoOrfao } from "@/lib/data";

type ProcLite = { id: string; label: string };
type CliLite = { id: string; nome: string };

function Promover({ p, procs, clis }: { p: PrazoOrfao; procs: ProcLite[]; clis: CliLite[] }) {
  return (
    <FormModal
      label="Promover"
      titulo={`Promover prazo órfão — ${p.ato}`}
      descricao="Costura o processo, vincula o cliente e libera a validação. Nada é apagado; tudo é auditado."
      acao={promoverPrazoOrfao.bind(null, p.prazo_id)}
      enviarLabel="Promover prazo"
      variant="primary"
    >
      <p className="sub" style={{ marginTop: 0 }}>
        Fatal em <b style={{ color: "var(--red)" }}>{fmtDate(p.data_fatal)}</b> ({p.dias_restantes} dias).
        {p.intimacao_resumo ? <> Origem: {p.intimacao_resumo}.</> : null}
      </p>

      <h4 style={{ margin: "6px 0 2px", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--brass)" }}>1 · Processo</h4>
      <div>
        <label>Processo já existente</label>
        <select name="processo_id" defaultValue="">
          <option value="">— cadastrar novo abaixo —</option>
          {procs.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <p className="sub" style={{ margin: "2px 0 6px" }}>Se selecionar um existente, os campos abaixo são ignorados (mas um CNJ informado completa um registro que ainda não tinha CNJ).</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Nº CNJ</label><input name="numero_cnj" placeholder="0000000-00.0000.0.00.0000" /></div>
        <div><label>Nº registro tribunal</label><input name="numero_registro_tribunal" placeholder="se não houver CNJ" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div><label>Tribunal</label><input name="tribunal" placeholder="Ex.: STJ, TJSP" /></div>
        <div><label>UF</label><input name="uf" maxLength={2} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label>Instância</label><select name="instancia" defaultValue="1grau">{PROCESSO_INSTANCIA.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
        <div><label>Área</label><select name="area" defaultValue="criminal">{PROCESSO_AREA.map((a) => <option key={a} value={a}>{humano(a)}</option>)}</select></div>
      </div>
      <div><label>Vara / comarca</label><input name="vara_comarca" /></div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
        <input type="checkbox" name="segredo_justica" style={{ width: "auto" }} /> Processo em segredo de justiça
      </label>

      <h4 style={{ margin: "12px 0 2px", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--brass)" }}>2 · Cliente</h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>Cliente existente</label>
          <select name="cliente_id" defaultValue="">
            <option value="">— nenhum / novo abaixo —</option>
            {clis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div><label>Papel</label><select name="papel" defaultValue="reu">{PAPEL.map((p2) => <option key={p2} value={p2}>{humano(p2)}</option>)}</select></div>
      </div>
      <div><label>Ou cadastrar novo cliente (nome)</label><input name="novo_cliente_nome" placeholder="deixe em branco se já selecionou acima" /></div>

      <h4 style={{ margin: "12px 0 2px", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--brass)" }}>3 · Validação</h4>
      <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
        <input type="checkbox" name="validar_agora" style={{ width: "auto" }} /> Validar agora (cria o marcador fatal vermelho no Google Calendar)
      </label>
      <p className="sub" style={{ margin: 0 }}>A validação só roda após o vínculo do processo — exigência do banco (nenhuma fatal validada fica sem processo).</p>
    </FormModal>
  );
}

export function PrazosOrfaosList({ orfaos }: { orfaos: PrazoOrfao[] }) {
  const [procs, setProcs] = useState<ProcLite[]>([]);
  const [clis, setClis] = useState<CliLite[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/processos-lite").then((r) => r.json()).then((d) => vivo && setProcs(d.processos ?? [])).catch(() => {});
    fetch("/api/clientes-lite").then((r) => r.json()).then((d) => vivo && setClis(d.clientes ?? [])).catch(() => {});
    return () => { vivo = false; };
  }, []);

  return (
    <>
      <div className="banner" style={{ marginTop: 0 }}>
        <span className="ico">⚠</span>
        <div>
          <b>Fila de prazos órfãos.</b> Fatais cadastradas sem processo (provisórias, <b>validado=false</b>).
          Nenhuma fatal fica invisível: promova cada uma costurando o processo e o cliente para liberar a validação.
        </div>
      </div>
      <div className="card">
        <div className="card-b flush">
          {orfaos.length ? (
            <table>
              <thead>
                <tr>
                  <th>Prazo</th>
                  <th>Ato</th>
                  <th>Origem</th>
                  <th>Resp.</th>
                  <th>Interna</th>
                  <th>Fatal</th>
                  <th className="right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {orfaos.map((p) => (
                  <tr key={p.prazo_id}>
                    <td style={{ width: 64 }}><DiasBox dias={p.dias_restantes} /></td>
                    <td>
                      <div className="name">{p.ato}</div>
                      <div className="sub" style={{ color: "var(--amber)" }}>⚠ provisório · sem processo</div>
                    </td>
                    <td>
                      {p.intimacao_id ? (
                        <a className="link" href="/intimacoes" title={p.intimacao_resumo ?? ""}>intimação</a>
                      ) : (
                        <span className="sub">{humano(p.cadastrado_por) || "—"}</span>
                      )}
                    </td>
                    <td>{p.responsavel ?? "—"}</td>
                    <td className="mono">{fmtDate(p.data_interna)}</td>
                    <td className="mono" style={{ color: "var(--red)", fontWeight: 600 }}>{fmtDate(p.data_fatal)}</td>
                    <td className="right"><Promover p={p} procs={procs} clis={clis} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum prazo órfão. Toda fatal está vinculada a um processo. 🎉</div>
          )}
        </div>
      </div>
    </>
  );
}

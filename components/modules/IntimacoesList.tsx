"use client";

import { useMemo, useState } from "react";
import { ProcRef, SegredoTag, Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { RowLink } from "@/components/RowLink";
import { linkPara } from "@/lib/links";
import { fmtDate, humano } from "@/lib/format";
import type { Intimacao } from "@/lib/data";

const PASSO = 50;

const tone = (s: string) =>
  s === "pendente"
    ? "amber"
    : s === "providencia_tomada"
      ? "green"
      : s === "em_analise"
        ? "blue"
        : "gray";

const STATUS = [
  { id: "todas", label: "Todas" },
  { id: "pendentes", label: "Pendentes" },
  { id: "em_analise", label: "Em análise" },
  { id: "orfas", label: "Órfãs" },
];
const ORIGENS = [
  { id: "todas", label: "Todas origens" },
  { id: "dje", label: "DJe" },
  { id: "push", label: "Push STJ/STF" },
  { id: "pje", label: "PJe" },
  { id: "seeu", label: "SEEU" },
  { id: "email", label: "E-mail" },
  { id: "eproc", label: "eproc" },
];

export function IntimacoesList({ intimacoes }: { intimacoes: Intimacao[] }) {
  // Abre na triagem do que ainda precisa de ação (como um inbox profissional).
  const [st, setSt] = useState("pendentes");
  const [orig, setOrig] = useState("todas");
  const [visiveis, setVisiveis] = useState(PASSO);

  const filtradas = useMemo(
    () =>
      intimacoes.filter((i) => {
        const okSt =
          st === "pendentes"
            ? i.status === "pendente"
            : st === "em_analise"
              ? i.status === "em_analise"
              : st === "orfas"
                ? i.orfa
                : true;
        const okOrig = orig === "todas" ? true : i.origem === orig;
        return okSt && okOrig;
      }),
    [intimacoes, st, orig],
  );
  const mostradas = filtradas.slice(0, visiveis);

  const nPend = intimacoes.filter((i) => i.status === "pendente").length;
  const nAnalise = intimacoes.filter((i) => i.status === "em_analise").length;
  const nOrfas = intimacoes.filter((i) => i.orfa).length;

  const irPara = (id: string) => {
    setSt(id);
    setVisiveis(PASSO);
  };

  const opcoesStatus = STATUS.map((o) =>
    o.id === "todas"
      ? { ...o, label: `Todas (${intimacoes.length})` }
      : o.id === "pendentes"
        ? { ...o, label: `Pendentes (${nPend})` }
        : o.id === "em_analise"
          ? { ...o, label: `Em análise (${nAnalise})` }
          : { ...o, label: `Órfãs (${nOrfas})` },
  );

  return (
    <>
      <div className="card op-card" style={{ marginBottom: 16 }}>
        <div className="card-h"><h3><Icon name="list" /> Filtros</h3></div>
        <div className="card-b">
          <Chips options={opcoesStatus} value={st} onChange={(v) => { setSt(v); setVisiveis(PASSO); }} />
          <Chips options={ORIGENS} value={orig} onChange={(v) => { setOrig(v); setVisiveis(PASSO); }} />
        </div>
      </div>

      <div className="scan">
        <div className="scan-h"><h3><Icon name="inbox" /> Panorama das intimações</h3></div>
        <div className="scan-metrics">
          <button type="button" className={`metric${st === "pendentes" ? " metric-on" : ""}`} onClick={() => irPara("pendentes")}><b>{nPend}</b><span>Pendentes · aguardando ação</span></button>
          <button type="button" className={`metric${st === "em_analise" ? " metric-on" : ""}`} onClick={() => irPara("em_analise")}><b>{nAnalise}</b><span>Em análise · em estudo</span></button>
          <button type="button" className={`metric${st === "orfas" ? " metric-on" : ""}`} onClick={() => irPara("orfas")}><b>{nOrfas}</b><span>Órfãs · sem processo</span></button>
          <button type="button" className={`metric${st === "todas" ? " metric-on" : ""}`} onClick={() => irPara("todas")}><b>{intimacoes.length}</b><span>Total · acervo recente</span></button>
        </div>
      </div>

      <div className="card op-card">
        <div className="card-h">
          <h3><Icon name="inbox" /> Intimações</h3>
          <span className="sub">{filtradas.length} no filtro</span>
        </div>
        <div className="card-b flush">
          {mostradas.length ? (
            <table>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Intimação</th>
                  <th>Processo</th>
                  <th>Publicação</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {mostradas.map((i) => (
                  <RowLink key={i.id} href={linkPara("intimacao", i.id)} ariaLabel={`Abrir intimação: ${i.resumo ?? "sem resumo"}`}>
                    <td><Pill tone="gray" dot={false}>{(i.origem ?? "—").toUpperCase()}</Pill></td>
                    <td>
                      <div className="name">{i.resumo ?? "—"}</div>
                      {i.orfa ? (
                        <div className="sub" style={{ color: "var(--amber)" }}>⚠ sem processo identificado — triagem humana</div>
                      ) : (
                        <div className="sub">{i.cliente ?? "Sem cliente vinculado"}</div>
                      )}
                    </td>
                    <td>
                      {i.orfa ? (
                        <span className="sub">—</span>
                      ) : (
                        <>
                          <ProcRef cnj={i.numero_cnj} registro={i.numero_registro} />
                          {i.segredo && <div className="sub"><SegredoTag on /></div>}
                        </>
                      )}
                    </td>
                    <td className="mono">{fmtDate(i.data_publicacao)}</td>
                    <td className="center"><Pill tone={tone(i.status)}>{humano(i.status)}</Pill></td>
                  </RowLink>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma intimação neste filtro.</div>
          )}
        </div>
      </div>

      {visiveis < filtradas.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button className="btn" onClick={() => setVisiveis((v) => v + PASSO)}>
            Carregar mais ({filtradas.length - visiveis} restantes)
          </button>
        </div>
      )}
    </>
  );
}

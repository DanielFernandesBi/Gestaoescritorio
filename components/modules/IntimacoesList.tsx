"use client";

import { useMemo, useState } from "react";
import { ProcRef, SegredoTag, Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
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
  const [st, setSt] = useState("todas");
  const [orig, setOrig] = useState("todas");
  const [visiveis, setVisiveis] = useState(PASSO);

  const filtradas = useMemo(
    () =>
      intimacoes.filter((i) => {
        const okSt =
          st === "pendentes" ? i.status === "pendente" : st === "orfas" ? i.orfa : true;
        const okOrig = orig === "todas" ? true : i.origem === orig;
        return okSt && okOrig;
      }),
    [intimacoes, st, orig],
  );
  const mostradas = filtradas.slice(0, visiveis);

  const nPend = intimacoes.filter((i) => i.status === "pendente").length;
  const nOrfas = intimacoes.filter((i) => i.orfa).length;
  const opcoesStatus = STATUS.map((o) =>
    o.id === "todas"
      ? { ...o, label: `Todas (${intimacoes.length})` }
      : o.id === "pendentes"
        ? { ...o, label: `Pendentes (${nPend})` }
        : { ...o, label: `Órfãs (${nOrfas})` },
  );

  return (
    <>
      <Chips options={opcoesStatus} value={st} onChange={(v) => { setSt(v); setVisiveis(PASSO); }} />
      <Chips options={ORIGENS} value={orig} onChange={(v) => { setOrig(v); setVisiveis(PASSO); }} />
      <div className="card">
        <div className="card-b flush">
          {mostradas.length ? (
            <table>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Resumo</th>
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
                      {i.orfa && (
                        <div className="sub" style={{ color: "var(--amber)" }}>⚠ sem processo identificado — triagem humana</div>
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

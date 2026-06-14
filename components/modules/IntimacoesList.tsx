"use client";

import { useMemo, useState } from "react";
import { useDrawer } from "@/components/Drawer";
import { ProcRef, SegredoTag, Pill } from "@/components/ui";
import { Chips } from "@/components/Chips";
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
  const { open } = useDrawer();
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

  function abrir(i: Intimacao) {
    open({
      title: (
        <>
          <h2>{i.resumo ?? "Intimação"}</h2>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill tone={tone(i.status)}>{humano(i.status)}</Pill>
            <SegredoTag on={i.segredo} />
            {i.orfa && <Pill tone="amber">órfã</Pill>}
          </div>
        </>
      ),
      body: (
        <>
          <div className="dsec">
            <h4>Dados</h4>
            <div className="dgrid">
              <div className="field"><div className="k">Origem</div><div className="v">{(i.origem ?? "—").toUpperCase()}</div></div>
              <div className="field"><div className="k">Processo</div><div className="v mono">{i.numero_cnj ?? (i.numero_registro ? "reg " + i.numero_registro : "—")}</div></div>
              <div className="field"><div className="k">Publicação</div><div className="v mono">{fmtDate(i.data_publicacao)}</div></div>
              <div className="field"><div className="k">Ciência</div><div className="v mono">{fmtDate(i.data_ciencia)}</div></div>
              <div className="field"><div className="k">Código publicação</div><div className="v mono" style={{ fontSize: 11 }}>{i.codigo_publicacao ?? "—"}</div></div>
            </div>
          </div>
          {i.providencia && (
            <div className="dsec"><h4>Providência</h4><div className="field"><div className="v">{i.providencia}</div></div></div>
          )}
          {i.orfa && (
            <div className="banner" style={{ margin: 0 }}>
              <span className="ico">⚠</span>
              <div><b>Intimação órfã.</b> Processo não identificado — triagem humana antes de vincular.</div>
            </div>
          )}
        </>
      ),
    });
  }

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
                  <tr key={i.id} className="clickable" onClick={() => abrir(i)}>
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
                  </tr>
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

"use client";

import { useEffect, useState } from "react";
import { DiasBox, Pill, Gate } from "@/components/ui";
import { fmtDate, fmtTime, humano, diasAte } from "@/lib/format";
import type { Processo } from "@/lib/data";

type Rel = {
  prazos: { id: string; ato: string; data_fatal: string; data_interna: string | null; status: string; validado: boolean }[];
  audiencias: { id: string; tipo: string; data_hora: string; modalidade: string | null; status: string; validado: boolean }[];
  intimacoes: { id: string; resumo: string | null; origem: string | null; status: string; data_publicacao: string | null }[];
  andamentos: { id: string; data: string; tipo: string; descricao: string; origem: string | null }[];
};

export function ProcessoDetalhe({ proc }: { proc: Processo }) {
  const [rel, setRel] = useState<Rel | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/processos/${proc.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => vivo && setRel(d))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [proc.id]);

  return (
    <>
      <div className="dsec">
        <h4>Dados</h4>
        <div className="dgrid">
          <div className="field"><div className="k">Tribunal</div><div className="v">{proc.tribunal ?? "—"}</div></div>
          <div className="field"><div className="k">Vara / comarca</div><div className="v">{proc.vara_comarca ?? "—"}</div></div>
          <div className="field"><div className="k">Instância</div><div className="v">{(proc.instancia ?? "—").toUpperCase()} · {proc.uf ?? "—"}</div></div>
          <div className="field"><div className="k">Área</div><div className="v">{humano(proc.area)}</div></div>
          <div className="field"><div className="k">Classe</div><div className="v">{proc.classe ?? "—"}</div></div>
          <div className="field"><div className="k">Responsável</div><div className="v">{proc.responsavel ?? "—"}</div></div>
        </div>
      </div>

      <div className="dsec">
        <h4>Parte</h4>
        <div className="mini">
          <div>
            <div className="mt">{proc.segredo ? "— (sigiloso)" : proc.clientes || "—"}</div>
            <div className="ms">papel: {proc.papel ?? "—"}</div>
          </div>
        </div>
      </div>

      {erro && (
        <div className="banner" style={{ margin: "0 0 24px" }}>
          <span className="ico">⚠</span>
          <div>Não consegui carregar os itens vinculados agora.</div>
        </div>
      )}

      {!rel && !erro && <div className="empty">Carregando itens vinculados…</div>}

      {rel && (
        <>
          <div className="dsec">
            <h4>Prazos abertos ({rel.prazos.length})</h4>
            <div className="mini-list">
              {rel.prazos.length ? (
                rel.prazos.map((p) => (
                  <div className="mini" key={p.id}>
                    <div>
                      <div className="mt">{p.ato}</div>
                      <div className="ms">fatal {fmtDate(p.data_fatal)} · <Gate validado={p.validado} /></div>
                    </div>
                    <DiasBox dias={diasAte(p.data_fatal)} />
                  </div>
                ))
              ) : (
                <div className="empty">Sem prazos abertos.</div>
              )}
            </div>
          </div>

          <div className="dsec">
            <h4>Audiências ({rel.audiencias.length})</h4>
            <div className="mini-list">
              {rel.audiencias.length ? (
                rel.audiencias.map((a) => (
                  <div className="mini" key={a.id}>
                    <div>
                      <div className="mt">{humano(a.tipo)}</div>
                      <div className="ms">{humano(a.modalidade)} · {a.status}</div>
                    </div>
                    <div className="mono" style={{ textAlign: "right" }}>
                      {fmtDate(a.data_hora)}<div className="ms">{fmtTime(a.data_hora)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">Sem audiências.</div>
              )}
            </div>
          </div>

          <div className="dsec">
            <h4>Intimações ({rel.intimacoes.length})</h4>
            <div className="mini-list">
              {rel.intimacoes.length ? (
                rel.intimacoes.map((i) => (
                  <div className="mini" key={i.id}>
                    <div>
                      <div className="mt">{i.resumo ?? "—"}</div>
                      <div className="ms">{(i.origem ?? "").toUpperCase()} · {fmtDate(i.data_publicacao)}</div>
                    </div>
                    <Pill tone={i.status === "pendente" ? "amber" : "gray"} dot={false}>{humano(i.status)}</Pill>
                  </div>
                ))
              ) : (
                <div className="empty">Sem intimações.</div>
              )}
            </div>
          </div>

          {rel.andamentos.length > 0 && (
            <div className="dsec">
              <h4>Andamentos recentes</h4>
              <div className="tl">
                {rel.andamentos.map((m) => (
                  <div className="tl-item" key={m.id}>
                    <div className="d">{fmtDate(m.data)} · {humano(m.tipo)}</div>
                    <div className="t" style={{ fontSize: 12.5 }}>{m.descricao}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

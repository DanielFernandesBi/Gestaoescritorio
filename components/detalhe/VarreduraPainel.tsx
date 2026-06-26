"use client";

import { useState } from "react";
import Link from "next/link";
import { Expansivel } from "@/components/Expansivel";
import { fmtDate, fmtTime } from "@/lib/format";
import type { VarreduraItem, VarreduraTipo } from "@/lib/data";

const Spark = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ fill: "var(--accent)" }} aria-hidden>
    <path d="M12 2c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7z" />
  </svg>
);

const ABAS: { tipo: VarreduraTipo; label: string }[] = [
  { tipo: "intimacoes", label: "Intimações" },
  { tipo: "andamentos", label: "Andamentos" },
  { tipo: "prazos", label: "Prazos" },
  { tipo: "minutas", label: "Minutas" },
];

/**
 * Painel mestre-detalhe da varredura autônoma. Mantém a finalidade de captação
 * autônoma: à esquerda os itens capturados na última varredura (por tipo), à
 * direita o máximo de informação — campos extraídos, inteiro teor sob demanda e
 * atalho para o registro canônico (intimação / andamento / prazo / peça).
 */
export function VarreduraPainel({
  tipo,
  titulo,
  quando,
  itens,
}: {
  tipo: VarreduraTipo;
  titulo: string;
  quando: string | null;
  itens: VarreduraItem[];
}) {
  const [sel, setSel] = useState(0);
  const it = itens[sel] ?? itens[0] ?? null;

  return (
    <div className="audp">
      {/* MASTER */}
      <aside className="audp-master">
        <div className="audp-master-h">
          <h1>Varredura</h1>
          <div className="audp-filtros">
            {ABAS.map((a) => (
              <Link
                key={a.tipo}
                href={`/varredura/${a.tipo}`}
                className={`audp-chip ink${a.tipo === tipo ? " on" : ""}`}
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="audp-master-list">
          {itens.length === 0 ? (
            <div className="audp-empty">Nenhum item nesta varredura.</div>
          ) : (
            itens.map((x, i) => (
              <button
                type="button"
                key={x.id}
                className={`audp-mcard${i === sel ? " on" : ""}`}
                onClick={() => setSel(i)}
              >
                {i === sel && <span className="audp-mstripe" />}
                <span className="audp-mdot tone-slate" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="vp-mtitle">{x.cliente || x.titulo}</span>
                  <span className="vp-mmeta">{x.numero_cnj || "sem CNJ"}</span>
                </span>
                {x.data && <span className="audp-mwhen">{fmtDate(x.data)}</span>}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* DETALHE */}
      <section className="audp-detail">
        <div className="audp-detail-top">
          <Link className="audp-back" href="/painel">← Painel</Link>
          <span className="vp-top-sub">
            {titulo} · {itens.length} {itens.length === 1 ? "item" : "itens"}
            {quando ? ` · ${fmtDate(quando)} ${fmtTime(quando)}` : ""}
          </span>
        </div>

        <div className="audp-scroll">
          <div className="audp-inner">
            {!it ? (
              <div className="audp-empty" style={{ marginTop: 30 }}>
                Nenhum item capturado nesta janela de varredura.
              </div>
            ) : (
              <>
                {/* cabeçalho */}
                <div className="audp-tags">
                  <span className="pz-tag cowork"><Spark s={9} />captação autônoma</span>
                  <span className="pz-tag cat-slate">{it.entidade}</span>
                  {it.tag && <span className="pz-tag cat-blue">{it.tag}</span>}
                </div>
                <div className="vp-ident">
                  <b className="vp-ident-nome">{it.cliente || "Sem cliente vinculado"}</b>
                  {it.numero_cnj && <span className="vp-ident-proc mono">{it.numero_cnj}</span>}
                </div>
                <div className="vp-titulo">{it.titulo}</div>

                {/* captação */}
                <div className="audp-ia">
                  <div className="audp-ia-h"><Spark /><span>Capturado pela varredura · {it.entidade}</span></div>
                  <div className="audp-ia-note">
                    Item identificado e extraído automaticamente na última varredura. Abra o
                    registro canônico para triagem, validação e encadeamento completos.
                  </div>
                </div>

                {/* campos extraídos */}
                {it.campos.length > 0 && (
                  <div className="audp-sec">
                    <div className="audp-sech">Dados extraídos</div>
                    <div className="audp-dados">
                      {it.campos.map((c, n) => (
                        <div className="fld" key={n}>
                          <div className="k">{c.k}</div>
                          <div className="v">{c.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* inteiro teor */}
                {it.teor && (
                  <div className="audp-sec">
                    <div className="audp-sech">{it.teorLabel}</div>
                    <div className="vp-teor">
                      <Expansivel altura={150}>
                        <p>“{it.teor}”</p>
                      </Expansivel>
                    </div>
                  </div>
                )}

                {/* abrir canônico */}
                <div className="audp-actionbar" style={{ marginTop: 24 }}>
                  <Link className="btn primary" href={it.href}>Abrir {it.entidade} →</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

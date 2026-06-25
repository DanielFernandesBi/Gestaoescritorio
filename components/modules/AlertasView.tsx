"use client";

import { useState } from "react";
import Link from "next/link";
import { Chips } from "@/components/Chips";
import { Icon } from "@/components/Icon";

export type AlertaAcao = { label: string; href: string; primary?: boolean };
export type Alerta = {
  id: string;
  categoria: "prazo_fatal" | "execucao" | "parado" | "anomalia" | "financeiro";
  severidade: "critico" | "acompanhar";
  tag: string;
  tag2?: string | null;
  preso?: boolean;
  titulo: string;
  sub?: string | null;
  metrica?: string | null;
  dias?: number | null;
  canto?: string | null;
  valor?: string | null;
  acoes: AlertaAcao[];
};

function Card({ a }: { a: Alerta }) {
  return (
    <div className={`al-card cat-${a.categoria}`}>
      <span className="al-bar" />
      <div className="al-body">
        <div className="al-head">
          <div className="al-tags">
            <span className={`al-tag${a.categoria === "prazo_fatal" ? " solid" : ""}`}>{a.tag}</span>
            {a.tag2 && <span className="al-tag2">{a.tag2}</span>}
            {a.preso && <span className="al-tag preso">PRESO</span>}
          </div>
          {a.dias != null ? (
            <span className="al-days"><b>{a.dias}</b><span>dias</span></span>
          ) : a.canto ? (
            <span className="al-canto mono">{a.canto}</span>
          ) : null}
        </div>
        <div className="al-t">{a.titulo}</div>
        {a.sub && <div className="al-s">{a.sub}</div>}
        <div className="al-foot">
          {a.metrica ? <span className="al-fonte mono">{a.metrica}</span> : <span />}
          <div className="al-acoes">
            {a.valor && <span className="al-valor">{a.valor}</span>}
            {a.acoes.map((ac, i) => (
              <Link key={i} className={`btn sm${ac.primary ? " primary" : ""}`} href={ac.href}>{ac.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertasView({ alertas }: { alertas: Alerta[] }) {
  const [aba, setAba] = useState("tudo");

  const n = (cat: string) => alertas.filter((a) => a.categoria === cat).length;
  const nCrit = alertas.filter((a) => a.severidade === "critico").length;

  const abas = [
    { id: "tudo", label: `Tudo (${alertas.length})` },
    { id: "criticos", label: `Críticos (${nCrit})` },
    { id: "parado", label: `Parados ≥30d (${n("parado")})` },
    { id: "execucao", label: `Execução (${n("execucao")})` },
    { id: "anomalia", label: `Anomalias (${n("anomalia")})` },
    { id: "financeiro", label: `Financeiro (${n("financeiro")})` },
  ];

  const filtradas = alertas.filter((a) =>
    aba === "tudo" ? true : aba === "criticos" ? a.severidade === "critico" : a.categoria === aba,
  );
  const criticos = filtradas.filter((a) => a.severidade === "critico");
  const acompanhar = filtradas.filter((a) => a.severidade === "acompanhar");

  return (
    <>
      <div className="card op-card" style={{ marginBottom: 16 }}>
        <div className="card-h"><h3><Icon name="list" /> Filtros</h3></div>
        <div className="card-b"><Chips options={abas} value={aba} onChange={setAba} /></div>
      </div>

      <div className="scan">
        <div className="scan-h"><h3><Icon name="shield" /> Panorama de risco</h3></div>
        <div className="scan-metrics">
          <button type="button" className={`metric${aba === "criticos" ? " metric-on" : ""}`} onClick={() => setAba("criticos")}><b>{nCrit}</b><span>Críticos · ação hoje</span></button>
          <button type="button" className={`metric${aba === "parado" ? " metric-on" : ""}`} onClick={() => setAba("parado")}><b>{n("parado")}</b><span>Parados ≥30d · radar</span></button>
          <button type="button" className={`metric${aba === "execucao" ? " metric-on" : ""}`} onClick={() => setAba("execucao")}><b>{n("execucao")}</b><span>Benefícios · execução</span></button>
          <button type="button" className={`metric${aba === "anomalia" ? " metric-on" : ""}`} onClick={() => setAba("anomalia")}><b>{n("anomalia")}</b><span>Anomalias · varredura</span></button>
        </div>
      </div>

      {criticos.length > 0 && (
        <section className="al-sec">
          <div className="al-sec-h crit">Críticos</div>
          <div className="al-list">{criticos.map((a) => <Card key={a.id} a={a} />)}</div>
        </section>
      )}

      {acompanhar.length > 0 && (
        <section className="al-sec">
          <div className="al-sec-h">Acompanhar</div>
          <div className="al-list">{acompanhar.map((a) => <Card key={a.id} a={a} />)}</div>
        </section>
      )}

      {!filtradas.length && <div className="empty">Nenhum alerta neste filtro. 🎉</div>}
    </>
  );
}

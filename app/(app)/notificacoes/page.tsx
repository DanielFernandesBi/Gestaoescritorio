import Link from "next/link";
import { getNotificacoesComDetalhe } from "@/lib/push";
import { fmtTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const TONE_COR: Record<string, string> = {
  red: "var(--red)",
  amber: "var(--amber)",
  neutral: "var(--muted-2, var(--muted))",
};

export default async function NotificacoesPage() {
  const grupos = await getNotificacoesComDetalhe();
  const totalItens = grupos.reduce((n, g) => n + g.itens.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PageHeader
        breadcrumb={["Gestão", "Notificações"]}
        eyebrow="Web Push · pessoal"
        titulo="Minhas notificações de hoje"
        descricao={
          <>
            Os avisos enviados aos seus aparelhos hoje, abertos nos itens que os motivaram.
            Aqui é a área do escritório — mostra o detalhe (o push em si nunca leva nome/CNJ).
          </>
        }
        kpis={[
          { valor: grupos.length, label: "avisos hoje", tone: "accent" },
          { valor: totalItens, label: "itens no total", tone: "neutral" },
        ]}
      />

      {grupos.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            borderRadius: 12,
            padding: "26px 18px",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 14,
          }}
        >
          Nenhuma notificação hoje. 🎉
          <div style={{ fontSize: 12.5, marginTop: 6, opacity: 0.8 }}>
            Elas chegam de manhã (prazos/intimações/financeiro) e à tarde (minutas/silêncio).
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {grupos.map((g) => (
            <section
              key={g.categoria}
              style={{
                border: "1px solid var(--line)",
                background: "var(--surface)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 15px",
                  borderBottom: "1px solid var(--line-soft, var(--line))",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: ".03em",
                    color: "var(--accent-strong, var(--accent))",
                  }}
                >
                  {g.rotulo}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--mono)",
                    color: "var(--muted)",
                    background: "var(--surface-2)",
                    borderRadius: 20,
                    padding: "1px 8px",
                  }}
                >
                  {g.itens.length}
                </span>
                <Link
                  href={g.telaHref}
                  style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "var(--accent-strong, var(--accent))", textDecoration: "none" }}
                >
                  ver na tela →
                </Link>
                <span style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtTime(g.enviado_em)}</span>
              </div>

              {g.itens.length === 0 ? (
                <div style={{ padding: "14px 15px", fontSize: 13, color: "var(--muted)" }}>
                  Já resolvido — nada em aberto nesta categoria agora.
                </div>
              ) : (
                <div>
                  {g.itens.map((it) => (
                    <Link
                      key={it.id}
                      href={it.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "11px 15px",
                        borderTop: "1px solid var(--line-soft, var(--line))",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      {it.tone && (
                        <span
                          aria-hidden
                          style={{
                            flex: "none",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: TONE_COR[it.tone] ?? "var(--muted)",
                          }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.titulo}
                        </div>
                        {it.sub && (
                          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 1 }}>{it.sub}</div>
                        )}
                      </div>
                      {it.meta && (
                        <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{it.meta}</span>
                      )}
                      <span style={{ fontSize: 16, color: "var(--muted)" }} aria-hidden>›</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

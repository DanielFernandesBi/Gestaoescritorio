import Link from "next/link";
import { getMeusPushesHoje } from "@/lib/push";
import { fmtTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const pushes = await getMeusPushesHoje();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "22px 20px" }}>
      <PageHeader
        breadcrumb={["Gestão", "Notificações"]}
        eyebrow="Web Push · pessoal"
        titulo="Minhas notificações de hoje"
        descricao={
          <>
            Os avisos enviados aos seus aparelhos hoje. Cada item abre a tela de origem.
            O conteúdo é genérico por sigilo — os detalhes ficam na tela.
          </>
        }
        kpis={[
          { valor: pushes.length, label: "avisos hoje", tone: "accent" },
          { valor: <>{pushes.length}<span className="sub"> / 5</span></>, label: "categorias ativas", tone: "neutral" },
        ]}
      />

      {pushes.length === 0 ? (
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
            Elas chegam por volta das 10h, depois da triagem da manhã.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {pushes.map((p) => (
            <Link
              key={p.id}
              href={p.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                borderRadius: 12,
                padding: "13px 15px",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--accent-strong, var(--accent))" }}>
                  {p.rotulo}
                </div>
                <div style={{ fontSize: 14, color: "var(--text)", marginTop: 2 }}>{p.resumo}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtTime(p.enviado_em)}</div>
              <div style={{ fontSize: 16, color: "var(--muted)" }} aria-hidden>›</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

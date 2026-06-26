import { AppShell } from "@/components/AppShell";
import { getBadges, getUserEmail, iniciaisDoEmail } from "@/lib/queries";

// Sugestão 53 (adendo 22/06): o badge da sidebar vive no layout. Sem isto o layout
// é estático e o contador fica "travado" entre navegações. Força recomputo a cada req.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppLayout({
  children,
  modal,
  rail,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  rail: React.ReactNode;
}) {
  const [badges, email] = await Promise.all([getBadges(), getUserEmail()]);

  return (
    <>
      <AppShell badges={badges} iniciais={iniciaisDoEmail(email)} rail={rail}>
        {children}
      </AppShell>
      {modal}
    </>
  );
}

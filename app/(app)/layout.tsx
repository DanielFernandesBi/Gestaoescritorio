import { AppShell } from "@/components/AppShell";
import { DrawerProvider } from "@/components/Drawer";
import { getBadges, getUserEmail, iniciaisDoEmail } from "@/lib/queries";

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
    <DrawerProvider>
      <AppShell badges={badges} iniciais={iniciaisDoEmail(email)} rail={rail}>
        {children}
      </AppShell>
      {modal}
    </DrawerProvider>
  );
}

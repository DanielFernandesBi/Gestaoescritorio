import { AppShell } from "@/components/AppShell";
import { DrawerProvider } from "@/components/Drawer";
import { getBadges, getUserEmail, iniciaisDoEmail } from "@/lib/queries";

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const [badges, email] = await Promise.all([getBadges(), getUserEmail()]);

  return (
    <DrawerProvider>
      <AppShell badges={badges} iniciais={iniciaisDoEmail(email)}>
        {children}
      </AppShell>
      {modal}
    </DrawerProvider>
  );
}

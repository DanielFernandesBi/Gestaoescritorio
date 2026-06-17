import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
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
      <div className="app">
        <Sidebar badges={badges} />
        <div className="main">
          <Topbar iniciais={iniciaisDoEmail(email)} />
          <main className="content">{children}</main>
        </div>
      </div>
      {modal}
    </DrawerProvider>
  );
}

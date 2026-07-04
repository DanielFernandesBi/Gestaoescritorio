import type { Metadata, Viewport } from "next";
import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "Fernandes Advocacia — Sistema de Gestão",
  description:
    "Sistema de gestão do escritório Fernandes Advocacia (criminal). Fase 1 — leitura.",
  // PWA instalável (Sug. 81) — iOS e Android.
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FA Gestão",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1b33",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('tema');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}})();",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Hanken+Grotesk:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}

"use client";

import { useEffect, useState } from "react";

// Descobre iOS/standalone só no client (sem isso, hydration mismatch).
function isIos() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari expõe isso fora do padrão
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // registra o service worker assim que a página carrega
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // falha de SW não derruba nada — só não instala/notifica
      });
    }

    if (isStandalone()) return; // já instalado, não mostra nada
    if (sessionStorage.getItem("fa-install-dismissed") === "1") {
      setDismissed(true);
      return;
    }

    if (isIos()) {
      setShowIosBanner(true);
      return;
    }

    // Android/Chrome/Edge: o navegador dispara este evento sozinho quando os
    // critérios de instalabilidade (manifest + SW + https) são atendidos.
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroidBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    sessionStorage.setItem("fa-install-dismissed", "1");
    setDismissed(true);
    setShowAndroidBanner(false);
    setShowIosBanner(false);
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    // @ts-expect-error — prompt() não está no tipo Event
    deferredPrompt.prompt();
    setShowAndroidBanner(false);
    setDeferredPrompt(null);
  }

  if (dismissed || (!showAndroidBanner && !showIosBanner)) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 9999,
        background: "#0d1b33",
        color: "#fff",
        borderRadius: 12,
        padding: "14px 16px",
        boxShadow: "0 6px 24px rgba(0,0,0,.25)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 14,
      }}
    >
      {showAndroidBanner && (
        <>
          <span style={{ flex: 1 }}>
            Instalar o Gestão Fernandes Advocacia na tela inicial para receber
            notificações de prazos e financeiro.
          </span>
          <button
            onClick={handleInstallClick}
            style={{
              background: "#fff",
              color: "#0d1b33",
              border: 0,
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Instalar
          </button>
          <button
            onClick={dismiss}
            aria-label="Fechar"
            style={{ background: "transparent", color: "#fff", border: 0, cursor: "pointer" }}
          >
            ✕
          </button>
        </>
      )}

      {showIosBanner && (
        <>
          <span style={{ flex: 1 }}>
            Para instalar: toque em <strong>Compartilhar</strong> (ícone com a
            seta) e depois em <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
            Isso é necessário no iPhone para as notificações funcionarem.
          </span>
          <button
            onClick={dismiss}
            aria-label="Fechar"
            style={{ background: "transparent", color: "#fff", border: 0, cursor: "pointer" }}
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

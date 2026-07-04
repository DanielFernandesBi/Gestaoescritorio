"use client";

import { useEffect, useState } from "react";

// urlBase64 -> Uint8Array (formato exigido pelo pushManager.subscribe)
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Status = "idle" | "subscribing" | "subscribed" | "unsupported" | "denied" | "error";

export default function PushOptIn() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setStatus("subscribed");
      })
    );
  }, []);

  async function subscribe() {
    setStatus("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          dispositivo: navigator.userAgent.slice(0, 120),
        }),
      });
      if (!res.ok) throw new Error("falha ao registrar assinatura");
      setStatus("subscribed");
    } catch (e) {
      setStatus("error");
    }
  }

  if (status === "unsupported") return null; // navegador sem suporte, não mostra nada
  if (status === "subscribed") {
    return <span style={{ fontSize: 13, opacity: 0.7 }}>Notificações ativadas neste aparelho.</span>;
  }

  return (
    <button
      onClick={subscribe}
      disabled={status === "subscribing"}
      style={{
        background: "#0d1b33",
        color: "#fff",
        border: 0,
        borderRadius: 8,
        padding: "8px 14px",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {status === "subscribing" ? "Ativando…" : "Ativar notificações neste aparelho"}
      {status === "denied" && (
        <span style={{ display: "block", fontWeight: 400, marginTop: 4 }}>
          Permissão negada — ative em Ajustes do navegador.
        </span>
      )}
      {status === "error" && (
        <span style={{ display: "block", fontWeight: 400, marginTop: 4 }}>
          Não deu certo, tenta de novo.
        </span>
      )}
    </button>
  );
}

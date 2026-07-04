// Service worker do PWA — Fernandes Advocacia Gestão
// Escopo: (1) instalabilidade (fetch handler mínimo — sem cache agressivo,
// o sistema é dado vivo, não queremos servir tela velha); (2) Web Push.

const SW_VERSION = "1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough puro — exigido pra contar como "instalável" em alguns critérios
// de Chrome/Android, mas sem cache-first (dados do escritório não podem ficar
// velhos por causa de cache de service worker).
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "Fernandes Advocacia", body: event.data.text() };
  }

  // SALVAGUARDA DE SIGILO (manual, Sug. 81): o corpo do push transita pelos
  // servidores da Apple/Google. Nunca deve chegar aqui nome de cliente,
  // número de processo ou teor — só contagem + categoria + deep link.
  const title = payload.title || "Fernandes Advocacia";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "fa-notificacao",
    data: { url: payload.url || "/" },
    renotify: Boolean(payload.tag),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

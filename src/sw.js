self.skipWaiting();

const PRECACHE = "gasfacil-precache-v1";
const precacheManifest = self.__WB_MANIFEST || [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      cache.addAll(precacheManifest.map((entry) => entry.url || entry))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== PRECACHE).map((key) => caches.delete(key)))
      ),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// === Web Push: recebe notificações mesmo com aba fechada ===
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Novo Pedido", body: event.data?.text() || "" };
  }

  const title = data.title || "🛵 Novo Pedido!";
  const options = {
    body: data.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: data.tag || `novo-pedido-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || "/vendas/pedidos", pedidoId: data.pedidoId },
    vibrate: [300, 100, 300],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/vendas/pedidos";
  const urlToOpen = new URL(targetUrl, self.location.origin).href;

  const promiseChain = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windowClients) => {
      for (const client of windowClients) {
        try {
          const u = new URL(client.url);
          if (u.pathname === new URL(urlToOpen).pathname) {
            return client.focus();
          }
        } catch {}
      }
      // Sem aba aberta na rota — foca qualquer aba existente e navega, ou abre nova
      if (windowClients.length > 0) {
        const c = windowClients[0];
        return c.focus().then(() => c.navigate(urlToOpen).catch(() => {}));
      }
      return self.clients.openWindow(urlToOpen);
    });

  event.waitUntil(promiseChain);
});

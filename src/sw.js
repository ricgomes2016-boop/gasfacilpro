self.skipWaiting();

const PRECACHE = "gasfacil-precache-v1";
const precacheManifest = self.__WB_MANIFEST || [];
const precacheUrls = new Set(
  precacheManifest.map((entry) => new URL(entry.url || entry, self.location.origin).href)
);

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok && request.mode === "navigate") {
      const cache = await caches.open(PRECACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("Network unavailable and no cached response found");
  }
}

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
      caches.open(PRECACHE).then((cache) =>
        cache.keys().then((requests) =>
          Promise.all(
            requests
              .filter((request) => !precacheUrls.has(request.url) && request.mode !== "navigate")
              .map((request) => cache.delete(request))
          )
        )
      ),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== PRECACHE).map((key) => caches.delete(key)))
      ),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (precacheUrls.has(new URL(event.request.url).href)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    return;
  }

  event.respondWith(fetch(event.request));
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
    silent: false,
    data: { url: data.url || "/vendas/pedidos", pedidoId: data.pedidoId },
    vibrate: [300, 100, 300],
    actions: [{ action: "open", title: "Abrir pedido" }],
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

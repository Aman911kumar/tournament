self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "BattleArena", body: event.data?.text() || "New notification" };
  }

  const title = payload.title || "BattleArena";
  const options = {
    body: payload.body || "New notification",
    icon: payload.icon || "/favicon.png",
    badge: payload.badge || "/favicon.png",
    tag: payload.tag || "battlearena-notification",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const origin = self.location.origin;
    const url = targetUrl.startsWith("http") ? targetUrl : `${origin}${targetUrl}`;

    for (const client of clientsList) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(url);
        return;
      }
    }

    if (clients.openWindow) await clients.openWindow(url);
  })());
});

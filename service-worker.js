// Push only. School records, authenticated pages and API responses are never cached.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("dalton-hcas-")).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { /* Always use generic text. */ }
  const noticeId = /^[a-f0-9-]{36}$/.test(data.noticeId ?? "") ? data.noticeId : "";
  event.waitUntil(self.registration.showNotification("DaltonHCAS", {
    body: "You have a school update. Open DaltonHCAS and log in to view it.",
    icon: "./assets/icons/icon-192.png", badge: "./assets/icons/icon-192.png",
    tag: noticeId || "dalton-school-update", data: { noticeId }, renotify: false
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const noticeId = event.notification.data?.noticeId ?? "";
  const url = new URL("./", self.location.href);
  if (noticeId) url.searchParams.set("notice", noticeId);
  url.hash = "dashboard";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async windows => {
    const existing = windows.find(w => new URL(w.url).origin === url.origin);
    if (existing) { await existing.navigate(url.href); return existing.focus(); }
    return self.clients.openWindow(url.href);
  }));
});

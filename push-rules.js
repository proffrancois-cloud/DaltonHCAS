export function validateSubscription(subscription) {
  let url;
  try { url = new URL(subscription?.endpoint); } catch { throw new Error("Invalid push endpoint"); }
  const allowed = url.hostname === "fcm.googleapis.com" || url.hostname === "updates.push.services.mozilla.com" || url.hostname === "web.push.apple.com" || /^[a-z0-9-]+\.push\.apple\.com$/.test(url.hostname) || url.hostname === "wns.windows.com" || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  if (!allowed || url.protocol !== "https:" || url.port || url.username || url.password || url.href.length > 4096) throw new Error("Unsupported push provider");
  const decode = v => { try { return atob(v.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - v.length % 4) % 4)).length; } catch { return 0; } };
  if (decode(subscription.keys?.p256dh ?? "") !== 65 || decode(subscription.keys?.auth ?? "") !== 16) throw new Error("Invalid push subscription keys");
  return { endpoint: url.href, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } };
}
export function deliveryResult(status, attempts, now = Date.now()) {
  if (status >= 200 && status < 300) return { status: "delivered", delivered_at: new Date(now).toISOString(), last_status: status };
  if ([404, 410].includes(status)) return { status: "invalid", last_status: status };
  if (attempts >= 6 || status >= 400 && status < 500 && ![408, 429].includes(status)) return { status: "failed", last_status: status };
  return { status: "pending", last_status: status, available_at: new Date(now + Math.min(3600000, 30000 * 2 ** attempts)).toISOString() };
}

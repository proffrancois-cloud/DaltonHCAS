import { cloudCall, cloudEnabled, hasCloudSession } from "./cloud-client.js";

let registration, config, actorGetter = () => null, openNotice = () => {};
const bytes = value => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
async function worker() { return registration ??= await navigator.serviceWorker.register("./service-worker.js"); }
async function prepare() {
  if (!supported() || !cloudEnabled || !hasCloudSession()) return;
  await worker();
  config = await cloudCall("push-config");
  const sub = await registration.pushManager.getSubscription();
  if (sub && Notification.permission === "granted") await cloudCall("push-subscribe", { subscription: sub.toJSON() });
}
export async function enablePhonePush() {
  if (!supported()) throw new Error("Push is unavailable here. On iPhone/iPad, install from Safari to the Home Screen, then open the installed app. Use a supported, updated browser on Android.");
  if (!cloudEnabled || !actorGetter()) throw new Error("Log in to your school account on the published app first.");
  // Call directly in the click handler: Apple requires a user gesture.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "Notifications were not enabled. All updates remain in your dashboard. Change permission in device/browser settings to try again.";
  await worker(); await navigator.serviceWorker.ready;
  config ??= await cloudCall("push-config");
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    let timedOut = false, timer;
    const pending = registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(config.publicKey) });
    pending.then(sub => { if (timedOut) sub.unsubscribe().catch(() => {}); }).catch(() => {});
    try { subscription = await Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new Error("Your device did not complete notification registration. Check your connection and phone notification settings, then try again.")); }, 20000); })]); }
    catch (error) { throw new Error(`Notifications could not be registered on this device. ${error.message} Dashboard updates remain available.`); }
    finally { clearTimeout(timer); }
  }
  await cloudCall("push-subscribe", { subscription: subscription.toJSON() });
  return "Phone notifications are enabled for this account on this device. You can now close the app. Delivery also depends on your phone’s notification settings and connection.";
}
export async function disablePhonePush() {
  if (!("serviceWorker" in navigator)) return "Notifications are disabled.";
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = await reg?.pushManager?.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    if (hasCloudSession()) await cloudCall("push-unsubscribe", { endpoint }).catch(() => {});
  }
  for (const n of await reg?.getNotifications() ?? []) n.close();
  config = null;
  return "Notifications are disabled on this device.";
}
function consumeNotice() {
  if (!actorGetter()) return;
  const id = new URL(location.href).searchParams.get("notice");
  if (!id) return;
  openNotice(id);
  const url = new URL(location.href); url.searchParams.delete("notice"); history.replaceState(null, "", url);
}
export function initializePhonePush(getActor, onNotice) {
  actorGetter = getActor; openNotice = onNotice;
  if ("serviceWorker" in navigator && window.isSecureContext) worker().catch(() => {});
  window.addEventListener("school-session-ready", () => { prepare().catch(() => {}); consumeNotice(); });
  window.addEventListener("school-session-expired", () => { disablePhonePush().catch(() => {}); });
  navigator.serviceWorker?.addEventListener("message", event => { if (event.data?.noticeId && actorGetter()) openNotice(event.data.noticeId); });
}

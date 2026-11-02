import { CLOUD_CONFIG as config } from "./cloud-config.js";

const SESSION_KEY = "dalton-hcas-cloud-session";
export const cloudEnabled = location.hostname.endsWith(".vercel.app") || new URLSearchParams(location.search).has("cloud");
let session = null;
try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { /* Start signed out. */ }
let refreshPromise = null;

async function authRequest(path, payload, token = null) {
  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    method: token ? "PUT" : "POST",
    headers: { apikey: config.key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.msg || result.error_description || "Account authentication failed");
  return result;
}
function storeSession(value) {
  session = value;
  if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else sessionStorage.removeItem(SESSION_KEY);
}
export async function cloudLogin(username, password) {
  const normalized = String(username).trim().toLowerCase();
  if (!/^[a-z0-9]+$/.test(normalized)) throw new Error("Enter your account username");
  const result = await authRequest("token?grant_type=password", { email: `${normalized}@accounts.daltonhcas.invalid`, password });
  storeSession({ ...result, expires_at: Math.floor(Date.now() / 1000) + result.expires_in });
  return cloudCall("load");
}
async function getAccessToken() {
  if (!session?.access_token) throw new Error("Please log in to your school account");
  if (session.expires_at < Date.now() / 1000 + 60) {
    if (!refreshPromise) refreshPromise = authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token })
      .then(result => { storeSession({ ...result, expires_at: Math.floor(Date.now() / 1000) + result.expires_in }); })
      .finally(() => { refreshPromise = null; });
    await refreshPromise;
  }
  return session.access_token;
}
export async function cloudCall(action, payload = {}) {
  const response = await fetch(`${config.url}/functions/v1/${config.functionName}`, {
    method: "POST", headers: {
      apikey: config.key, Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json"
    }, body: JSON.stringify({ action, ...payload })
  });
  if (response.headers.get("Content-Type")?.includes("application/pdf")) {
    if (!response.ok) throw new Error("IEP access denied");
    return response.blob();
  }
  const result = await response.json();
  if (response.status === 401) {
    storeSession(null);
    window.dispatchEvent(new Event("school-session-expired"));
  }
  if (!response.ok) throw new Error(result.error || "The change could not be saved. Please try again.");
  return result;
}
export async function cloudChangePassword(password) {
  if (password.length < 14) throw new Error("Use at least 14 characters for your new password");
  const result = await cloudCall("password-set", { payload: { password } });
  return cloudLogin(result.user.username, password);
}
export async function cloudLogout() {
  const token = session?.access_token;
  storeSession(null);
  if (token) await fetch(`${config.url}/auth/v1/logout`, { method: "POST", headers: { apikey: config.key, Authorization: `Bearer ${token}` } }).catch(() => {});
}
export const hasCloudSession = () => Boolean(session?.access_token);

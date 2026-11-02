import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { actorForAccount, applySchoolCommand, synchronizeAlerts, visibleState } from "./support-server.js";
import { validateIepPdf } from "./support-rules.js";
import { pushAction, pushConfig, deliverPush } from "./push-server.js";
import { taiwanToday as today } from "./followup-rules.js";
import { canReadLevelUpDocument } from "./levelup-resources.js";

const BOOTSTRAP_HASH = "__BOOTSTRAP_HASH__";
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const json = (value, status = 200, cors = {}) => new Response(JSON.stringify(value), { status, headers: { ...headers, ...cors } });
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, "0")).join("");
const randomPassword = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, "0")).join("");
function queuePush() { EdgeRuntime.waitUntil(deliverPush(supabase).catch(() => console.error("Push delivery job failed; scheduled retry will follow"))); }
async function scheduledFollowups() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row, error } = await supabase.from("hcas_state").select("*").eq("id", 1).single();
    if (error) throw error;
    const next = synchronizeAlerts(row.payload, today());
    if (JSON.stringify(next) === JSON.stringify(row.payload)) break;
    const saved = await supabase.from("hcas_state").update({ payload: next, revision: row.revision + 1, updated_at: new Date().toISOString() }).eq("id", 1).eq("revision", row.revision).select("revision");
    if (saved.error) throw saved.error;
    if (saved.data.length) break;
    if (attempt === 4) throw new Error("Scheduled synchronization will retry next minute");
  }
  await deliverPush(supabase);
}

async function provisionAccount(account, reset = false) {
  const password = randomPassword();
  const { data: existing } = await supabase.from("hcas_accounts").select("auth_id").eq("account_id", account.id).maybeSingle();
  if (existing && reset) {
    const changed = await supabase.auth.admin.updateUserById(existing.auth_id, { password });
    if (changed.error) throw changed.error;
    const result = await supabase.from("hcas_accounts").update({ must_change_password: true }).eq("auth_id", existing.auth_id);
    if (result.error) throw result.error;
    return { ...account, temporaryPassword: password };
  }
  if (existing) throw new Error("This login has already been provisioned");
  const { data, error } = await supabase.auth.admin.createUser({ email: `${account.username.toLowerCase()}@accounts.daltonhcas.invalid`, password, email_confirm: true });
  if (error) throw error;
  const result = await supabase.from("hcas_accounts").insert({ auth_id: data.user.id, account_id: account.id });
  if (result.error) throw result.error;
  return { ...account, temporaryPassword: password };
}

async function bootstrap(input) {
  if (BOOTSTRAP_HASH === "disabled" || await digest(input.token ?? "") !== BOOTSTRAP_HASH) throw new Error("Access denied");
  const { data: row } = await supabase.from("hcas_state").select("id").eq("id", 1).maybeSingle();
  if (row) throw new Error("School data is already initialized");
  // Accounts are created in retryable batches before the final state insertion.
  const credentials = [];
  for (const account of input.accounts ?? []) {
    const { data: existing } = await supabase.from("hcas_accounts").select("auth_id").eq("account_id", account.id).maybeSingle();
    if (existing) continue;
    const password = randomPassword();
    const { data, error } = await supabase.auth.admin.createUser({ email: `${account.username.toLowerCase()}@accounts.daltonhcas.invalid`, password, email_confirm: true });
    if (error) throw error;
    const mapping = await supabase.from("hcas_accounts").insert({ auth_id: data.user.id, account_id: account.id });
    if (mapping.error) throw mapping.error;
    credentials.push({ id: account.id, username: account.username, password });
  }
  if (input.state) {
    const result = await supabase.from("hcas_state").insert({ id: 1, payload: input.state });
    if (result.error) throw result.error;
  }
  return { credentials, initialized: Boolean(input.state) };
}

Deno.serve(async request => {
  const origin = request.headers.get("Origin");
  const allowed = origin === "https://daltonhcas.vercel.app" || origin === "https://daltonhcas-francois-hcas.vercel.app" || /^https:\/\/daltonhcas-[a-z0-9]+-francois-hcas\.vercel\.app$/.test(origin ?? "") || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin ?? "");
  const cors = allowed ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Access-Control-Allow-Headers": "authorization,apikey,content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" } : {};
  if (origin && !allowed) return json({ error: "Origin not permitted" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 15_000_000) return json({ error: "File too large" }, 413, cors);
    const input = await request.json();
    if (input.action === "bootstrap") return json(await bootstrap(input), 200, cors);
    if (input.action === "scheduled-followups") {
      const token = request.headers.get("x-hcas-worker") ?? "";
      if (token.length !== 64) return json({ error: "Access denied" }, 403, cors);
      const config = await pushConfig(supabase);
      if (await digest(token) !== await digest(config.worker_token)) return json({ error: "Access denied" }, 403, cors);
      EdgeRuntime.waitUntil(scheduledFollowups().catch(() => console.error("Scheduled follow-up job failed")));
      return json({ accepted: true }, 202, cors);
    }
    const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
    const { data: auth, error } = await supabase.auth.getUser(token);
    if (error || !auth.user) return json({ error: "Please log in again" }, 401, cors);
    const { data: mapping } = await supabase.from("hcas_accounts").select("*").eq("auth_id", auth.user.id).single();
    if (!mapping) return json({ error: "School account not provisioned" }, 403, cors);
    if (mapping.must_change_password && !["load", "password-set"].includes(input.action)) return json({ error: "Please set your own password before using the school application" }, 403, cors);
    if (input.action === "password-set") {
      const password = input.payload?.password;
      if (typeof password !== "string" || password.length < 14 || password.length > 128) throw new Error("Use a password between 14 and 128 characters");
      const changed = await supabase.auth.admin.updateUserById(auth.user.id, { password });
      if (changed.error) throw changed.error;
      const result = await supabase.from("hcas_accounts").update({ must_change_password: false }).eq("auth_id", auth.user.id);
      if (result.error) throw result.error;
      mapping.must_change_password = false;
    }
    let uploadedDocument = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: row, error: readError } = await supabase.from("hcas_state").select("*").eq("id", 1).single();
      if (readError) throw readError;
      const actor = actorForAccount(row.payload, mapping.account_id);
      if (!actor) return json({ error: "School access revoked" }, 403, cors);
      let next = synchronizeAlerts(row.payload, today());
      if (mapping.must_change_password) return json({ user: actor, mustChangePassword: true }, 200, cors);
      if (["push-config", "push-subscribe", "push-unsubscribe"].includes(input.action)) {
        const result = await pushAction(supabase, actor, input);
        queuePush();
        return json(result, 200, cors);
      }
      if (input.action === "account-reset") {
        if (actor.type !== "teacher" || actor.role !== "super-admin") return json({ error: "Only a super admin can reset school passwords" }, 403, cors);
        const account = [...next.students, ...next.teachers].find(item => item.id === input.payload?.id);
        if (!account) throw new Error("Account not found");
        const newAccountCredential = await provisionAccount(account, true);
        await supabase.from("hcas_audit").insert({ actor_id: actor.id, action: "account-reset", resource_id: account.id });
        return json({ user: actor, state: visibleState(next, actor), newAccountCredential }, 200, cors);
      }
      if (input.action === "iep-read") {
        if (actor.type !== "teacher") return json({ error: "IEP documents are restricted to staff" }, 403, cors);
        const document = (next.iepDocuments ?? []).find(item => item.id === input.id);
        if (!document) return json({ error: "Document not found" }, 404, cors);
        const { data: blob, error } = await supabase.storage.from("hcas-iep").download(document.path);
        if (error) throw error;
        await supabase.from("hcas_audit").insert({ actor_id: actor.id, action: "iep-read", resource_id: document.id });
        return new Response(blob, { headers: { ...headers, ...cors, "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=iep.pdf" } });
      }
      if (input.action === "levelup-document-read") {
        const document = (next.levelUpDocuments ?? []).find(item => item.id === input.id);
        if (!document || !canReadLevelUpDocument(actor, document)) return json({ error: "This Level-Up document is not available to your account" }, 403, cors);
        const { data: blob, error } = await supabase.storage.from("hcas-levelup").download(document.path);
        if (error) throw error;
        await supabase.from("hcas_audit").insert({ actor_id: actor.id, action: "levelup-document-read", resource_id: document.id });
        const filename = document.filename.replace(/[^a-zA-Z0-9+_. -]/g, "_");
        return new Response(blob, { headers: { ...headers, ...cors, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"` } });
      }
      if (input.action === "iep-upload") {
        if (actor.type !== "teacher") return json({ error: "IEP documents are restricted to staff" }, 403, cors);
        if (!next.students.some(item => item.id === input.studentId)) throw new Error("Unknown student");
        if (typeof input.base64 !== "string" || input.base64.length > 14_000_000) throw new Error("PDF must be under 10 MB");
        const bytes = Uint8Array.from(atob(input.base64), ch => ch.charCodeAt(0));
        validateIepPdf(actor, bytes, input.name);
        if (!uploadedDocument) {
          const id = crypto.randomUUID(), path = `${input.studentId}/${id}.pdf`;
          const uploaded = await supabase.storage.from("hcas-iep").upload(path, bytes, { contentType: "application/pdf", upsert: false });
          if (uploaded.error) throw uploaded.error;
          uploadedDocument = { id, studentId: input.studentId, path, name: String(input.name).slice(0, 200), uploadedBy: actor.id, publishedAt: new Date().toISOString() };
        }
        next = { ...next, iepDocuments: [...(next.iepDocuments ?? []), uploadedDocument] };
      } else if (!["load", "password-set"].includes(input.action)) {
        next = applySchoolCommand(next, actor, input.action, input.payload ?? {});
        next = synchronizeAlerts(next, today());
      }
      if (JSON.stringify(next) !== JSON.stringify(row.payload)) {
        const { data: saved, error } = await supabase.from("hcas_state").update({ payload: next, revision: row.revision + 1, updated_at: new Date().toISOString() }).eq("id", 1).eq("revision", row.revision).select("revision");
        if (error) throw error;
        if (!saved.length) continue;
        if (input.action !== "load") await supabase.from("hcas_audit").insert({ actor_id: actor.id, action: input.action, resource_id: input.payload?.id ?? input.studentId ?? null });
      }
      const newAccountCredential = ["student-create", "teacher-create"].includes(input.action)
        ? await provisionAccount(input.action === "student-create" ? next.students.at(-1) : next.teachers.at(-1)) : null;
      queuePush();
      return json({ user: actorForAccount(next, actor.id), state: visibleState(next, actor), mustChangePassword: false, ...(newAccountCredential ? { newAccountCredential } : {}) }, 200, cors);
    }
    return json({ error: "Another change was saved at the same time. Please try again." }, 409, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request could not be completed";
    return json({ error: message.includes("JWT") ? "Please log in again" : message }, 400, cors);
  }
});

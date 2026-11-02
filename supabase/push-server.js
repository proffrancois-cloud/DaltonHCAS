import webpush from "npm:web-push@3.6.7";
import { validateSubscription, deliveryResult } from "./push-rules.js";

export async function pushConfig(db) {
  let { data, error } = await db.from("hcas_push_config").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data) {
    const keys = webpush.generateVAPIDKeys();
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
    const inserted = await db.from("hcas_push_config").upsert({ id: 1, public_key: keys.publicKey, private_key: keys.privateKey, worker_token: token }, { onConflict: "id", ignoreDuplicates: true });
    if (inserted.error) throw inserted.error;
    ({ data, error } = await db.from("hcas_push_config").select("*").eq("id", 1).single());
    if (error) throw error;
  }
  return data;
}
export async function pushAction(db, actor, input) {
  const config = await pushConfig(db);
  if (input.action === "push-config") return { publicKey: config.public_key };
  if (input.action === "push-subscribe") {
    const subscription = validateSubscription(input.subscription);
    const result = await db.from("hcas_push_subscriptions").upsert({ endpoint: subscription.endpoint, account_id: actor.id, subscription, enabled: true, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
    if (result.error) throw result.error;
    return { enabled: true };
  }
  if (input.action === "push-unsubscribe") {
    const result = await db.from("hcas_push_subscriptions").update({ enabled: false }).eq("account_id", actor.id).eq("endpoint", input.endpoint);
    if (result.error) throw result.error;
    return { enabled: false };
  }
  throw new Error("Unknown push action");
}

export async function deliverPush(db) {
  const config = await pushConfig(db);
  const { data: row, error: stateError } = await db.from("hcas_state").select("payload").eq("id", 1).single();
  if (stateError) throw stateError;
  const state = row.payload;
  const { data: subscriptions, error: subError } = await db.from("hcas_push_subscriptions").select("*").eq("enabled", true);
  if (subError) throw subError;
  const jobs = [];
  for (const sub of subscriptions) {
    if (![...state.teachers, ...state.students].some(a => a.id === sub.account_id)) continue;
    for (const n of state.notifications ?? []) if (n.id && !n.cancelled && n.recipientIds.includes(sub.account_id) && !n.readBy?.[sub.account_id]) jobs.push({ subscription_id: sub.id, account_id: sub.account_id, notification_key: n.key, notice_id: n.id });
  }
  for (let i = 0; i < jobs.length; i += 500) {
    const result = await db.from("hcas_push_outbox").upsert(jobs.slice(i, i + 500), { onConflict: "subscription_id,account_id,notification_key", ignoreDuplicates: true });
    if (result.error) throw result.error;
  }
  const { data: claimed, error } = await db.rpc("hcas_claim_push");
  if (error) throw error;
  await Promise.all((claimed ?? []).map(async job => {
    const sub = subscriptions.find(s => s.id === job.subscription_id && s.account_id === job.account_id);
    const n = state.notifications?.find(n => n.id === job.notice_id && !n.cancelled && n.recipientIds.includes(job.account_id));
    if (!sub || !n || n.readBy?.[job.account_id]) { await db.from("hcas_push_outbox").update({ status: "cancelled" }).eq("id", job.id); return; }
    // Recheck ownership immediately before send to handle device/account changes.
    const { data: current } = await db.from("hcas_push_subscriptions").select("account_id,enabled").eq("id", sub.id).single();
    if (!current?.enabled || current.account_id !== job.account_id) { await db.from("hcas_push_outbox").update({ status: "cancelled" }).eq("id", job.id); return; }
    let status;
    try {
      const result = await webpush.sendNotification(sub.subscription, JSON.stringify({ noticeId: n.id }), {
        vapidDetails: { subject: "mailto:francois_moret@hcas.com.tw", publicKey: config.public_key, privateKey: config.private_key },
        TTL: 86400, topic: n.id.replace(/-/g, ""), urgency: "normal", timeout: 10000
      });
      status = result.statusCode;
    } catch (error) { status = Number(error.statusCode) || 0; }
    const update = deliveryResult(status, job.attempts);
    if (update.status === "invalid") await db.from("hcas_push_subscriptions").update({ enabled: false }).eq("id", sub.id).eq("account_id", job.account_id);
    const saved = await db.from("hcas_push_outbox").update(update).eq("id", job.id);
    if (saved.error) throw saved.error;
  }));
}

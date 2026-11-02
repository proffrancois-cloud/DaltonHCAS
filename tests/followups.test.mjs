import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../data.js";
import { actorForAccount, applySchoolCommand, synchronizeAlerts, visibleState } from "../support-server.js";
import { validateConcernTier, academicStrategies, selOptions } from "../tier-rules.js";
import { validateSubscription, deliveryResult } from "../push-rules.js";
import { renderFollowupNotifications, responseHistory } from "../followup-ui.js";

const now = Date.parse("2026-11-03T04:00:00Z");
function fixture() {
  const s = createInitialState();
  s.teachers.push({ id: "supervisor", name: "Supervisor", role: "teacher-supervising" }, { id: "supervisor2", name: "Supervisor Two", role: "teacher-supervising" });
  s.selConcerns = [{ id: "c1", teacherId: "david", studentIds: [s.students[0].id], concernIds: ["anxiety"], title: "Concern", publishedAt: new Date(now).toISOString(), notificationRecipientIds: ["supervisor", "supervisor2", "francois"] }];
  return synchronizeAlerts(s, "2026-11-03");
}
const command = (s, who, action, p) => applySchoolCommand(s, actorForAccount(s, who), action, p, now);
test("individual concern responses propagate to original recipients and author without dismissing anyone else's choices", () => {
  let s = fixture();
  const key = s.notifications[0].key;
  s = command(s, "supervisor", "notification-read", { key });
  assert.equal(s.selConcerns[0].responses, undefined);
  s = command(s, "supervisor", "concern-response", { id: "c1", type: "sel", response: "keep-on-record", requestId: "request-keep" });
  s = synchronizeAlerts(s, "2026-11-03");
  assert.equal(s.notifications.filter(n => n.kind === "concern-response-update").length, 1);
  assert.deepEqual(s.notifications.at(-1).recipientIds, ["supervisor", "supervisor2", "francois", "david"]);
  assert.equal(s.notifications[0].readBy.supervisor2, undefined);
  const html = renderFollowupNotifications(visibleState(s, actorForAccount(s, "supervisor2")), actorForAccount(s, "supervisor2"), String);
  assert.match(html, /data-response="taking-care" >I am taking/);
  assert.match(html, /data-response="keep-on-record" >I have read/);
  assert.throws(() => command(s, "david", "concern-response", { id: "c1", type: "sel", response: "taking-care", requestId: "request-author" }), /notified staff/);
});
test("rebasing concurrent ownership responses retains both owners; retried request is idempotent", () => {
  let s = fixture();
  for (const who of ["supervisor", "supervisor2"]) s = command(s, who, "concern-response", { id: "c1", type: "sel", response: "taking-care", requestId: `request-${who}` });
  s = command(s, "supervisor", "concern-response", { id: "c1", type: "sel", response: "taking-care", requestId: "request-supervisor" });
  assert.equal(s.selConcerns[0].responses.length, 2);
  assert.match(responseHistory(s, actorForAccount(s, "david"), s.selConcerns[0], String), /Taking care: Supervisor, Supervisor Two/);
  assert.equal(responseHistory(s, actorForAccount(s, s.students[0].id), s.selConcerns[0], String), "");
});
function addGoal(s) {
  return command(s, "supervisor", "goal-add", { studentId: s.students[0].id, title: "Support plan", dueDate: "2026-11-10", sourceConcernType: "sel", sourceConcernId: "c1", responsibleTeacherId: "david", checkIns: [{ date: "2026-11-03" }, { date: "2026-11-06" }] });
}
test("SMART links reference a real concern of the chosen type for this student", () => {
  let s = addGoal(fixture());
  const g = s.smartGoals.at(-1);
  assert.equal(g.sourceConcernId, "c1"); assert.equal(g.sourceConcernType, "sel");
  assert.match(responseHistory(s, actorForAccount(s, "david"), s.selConcerns[0], String), /SMART plan: Support plan/);
  for (const payload of [{ sourceConcernId: "unknown" }, { sourceConcernType: "academic" }, { sourceConcernType: "sel", sourceConcernId: null }]) assert.throws(() => command(s, "supervisor", "goal-add", { ...g, ...payload }));
  assert.throws(() => command(s, "david", "goal-add", { ...g }));
});
test("check-ins and final review use Taiwan dates, deduplicate, and invalidate moved/cancelled dates", () => {
  let s = addGoal(fixture()), g = s.smartGoals.at(-1);
  s = synchronizeAlerts(s, "2026-11-03");
  const first = s.notifications.find(n => n.kind === "goal-check-in");
  assert.ok(first.recipientIds.includes("david")); assert.ok(first.recipientIds.includes("supervisor")); assert.ok(first.recipientIds.includes("francois")); assert.ok(first.recipientIds.includes(s.students[0].id));
  assert.equal(synchronizeAlerts(s, "2026-11-03").notifications.length, s.notifications.length);
  s = command(s, "supervisor", "goal-schedule", { id: g.id, responsibleTeacherId: "supervisor2", checkIns: [{ id: g.checkIns[0].id, date: "2026-11-05" }] });
  s = synchronizeAlerts(s, "2026-11-03"); assert.equal(s.notifications.find(n => n.key === first.key).cancelled, true);
  s = synchronizeAlerts(s, "2026-11-11");
  assert.equal(s.notifications.filter(n => n.kind === "goal-check-in" && !n.cancelled).length, 1);
  assert.equal(s.notifications.filter(n => n.kind === "goal-final-review" && !n.cancelled).length, 1);
});
test("only the owning student can write or revise a reflection forever; reminder preserves writing", () => {
  let s = addGoal(fixture()), g = s.smartGoals.at(-1), student = s.students[0].id;
  s = command(s, "supervisor", "goal-close", { id: g.id, status: "achieved", note: "Completed" });
  for (const who of ["supervisor", "francois", "david", s.students[1].id]) assert.throws(() => command(s, who, "goal-reflection", { id: g.id, text: "Forged" }));
  s = command(s, student, "goal-reflection", { id: g.id, text: "I did it." });
  s = command(s, "supervisor", "reflection-reminder", { id: g.id });
  assert.deepEqual(s.notifications.at(-1).recipientIds, [student]);
  assert.equal(s.smartGoals.at(-1).reflection.text, "I did it.");
  s = command(s, student, "goal-reflection", { id: g.id, text: "My revised reflection." });
  assert.equal(visibleState(s, actorForAccount(s, "david")).smartGoals.at(-1).reflection.text, "My revised reflection.");
});
test("tier validation rejects stale categories and interventions and preserves mappings", () => {
  assert.ok(selOptions(3).every(o => o.tier === 3));
  assert.throws(() => validateConcernTier("sel", { tier: 1, concernIds: [selOptions(3)[0].id] }));
  assert.throws(() => validateConcernTier("academic", { tier: 1, profileId: "dyslexia" }));
  assert.throws(() => validateConcernTier("behavior", { tier: 1, strategies: ["Fabricated"] }));
  assert.notDeepEqual(academicStrategies(2), academicStrategies(3));
});
test("push endpoint validation blocks arbitrary servers; delivery retries and retires invalid devices", () => {
  const keys = { p256dh: Buffer.alloc(65).toString("base64url"), auth: Buffer.alloc(16).toString("base64url") };
  assert.throws(() => validateSubscription({ endpoint: "https://127.0.0.1/internal", keys }));
  assert.throws(() => validateSubscription({ endpoint: "https://web.push.apple.com.evil.example/x", keys }));
  assert.ok(validateSubscription({ endpoint: "https://web.push.apple.com/Qtest", keys }));
  assert.equal(deliveryResult(201, 1).status, "delivered");
  assert.equal(deliveryResult(410, 1).status, "invalid");
  assert.equal(deliveryResult(503, 1).status, "pending");
  assert.equal(deliveryResult(503, 6).status, "failed");
});

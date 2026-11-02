import assert from "node:assert/strict";
import test from "node:test";
import {
  createSmartGoal, submitSmartField, setStudentFieldAccess, closeSmartGoal,
  canReadGoal, collectSupportAlerts, requestUrgentSupport, setTrustedAdult,
  markSupportNotificationRead, validateIepPdf
} from "../support-rules.js";

const supervisor = { type: "teacher", id: "supervisor", role: "teacher-supervising" };
const regular = { type: "teacher", id: "regular", role: "teacher" };
const leader = { type: "teacher", id: "leader", role: "house-leader" };
const admin = { type: "teacher", id: "admin", role: "super-admin" };
const student = { type: "student", id: "student" };
const staff = [supervisor, regular, leader, admin];
const create = (actor = supervisor, extra = {}, options = {}) => createSmartGoal(actor, {
  studentId: student.id, title: "Complete weekly reading", dueDate: "2026-11-10", ...extra
}, { id: "goal-1", now: "2026-11-02T08:00:00Z", ...options });

test("SMART plans distinguish student and supervisor origins and restrict access", () => {
  const assigned = create();
  assert.equal(assigned.origin, "supervisor");
  assert.equal(create(student).origin, "student");
  for (const person of [regular, leader, { ...student, id: "someone-else" }]) {
    assert.throws(() => create(person));
  }
  assert.equal(canReadGoal(student, assigned), true);
  assert.equal(canReadGoal(regular, assigned), true);
  assert.equal(canReadGoal({ ...student, id: "someone-else" }, assigned), false);
});

test("a student can submit only an approved SMART field once until specifically reopened", () => {
  let goal = create(supervisor, { studentEditableFields: ["s"] });
  assert.throws(() => submitSmartField(student, goal, "m", "One chapter per week"));
  goal = submitSmartField(student, goal, "s", "Read one chapter each week");
  assert.equal(goal.fields.s.studentCanEdit, false);
  assert.throws(() => submitSmartField(student, goal, "s", "Changed"));
  assert.throws(() => setStudentFieldAccess(leader, goal, "s", true));
  goal = setStudentFieldAccess(supervisor, goal, "s", true);
  goal = submitSmartField(student, goal, "s", "Read two chapters each week");
  assert.equal(goal.fields.s.text, "Read two chapters each week");
  assert.equal(goal.fields.m.studentCanEdit, false);
});

test("T includes a valid date; outcomes remain recorded and unsuccessful goals can have linked follow-ups", () => {
  let goal = create();
  assert.throws(() => create(supervisor, { dueDate: "2026-02-30" }));
  goal = submitSmartField(supervisor, goal, "t", "Review after two weeks", { dueDate: "2026-11-16" });
  assert.equal(goal.dueDate, "2026-11-16");
  assert.throws(() => closeSmartGoal(student, goal, "achieved", "Done"));
  const failed = closeSmartGoal(admin, goal, "not-achieved", "Revise the workload and support");
  assert.equal(failed.outcome.reviewerId, admin.id);
  const followup = create(supervisor, {}, { id: "goal-2", previousGoal: failed });
  assert.equal(followup.previousGoalId, goal.id);
  assert.throws(() => create(supervisor, {}, { previousGoal: goal }));
  assert.throws(() => submitSmartField(student, failed, "s", "Changed"));
});

test("three reports of the same checklist issue aggregate across authors, independently by category and student", () => {
  const concerns = ["behavior", "academic", "sel"].flatMap((type) => [1, 2, 3, 4].map((n) => ({
    id: `${type}-${n}`, type, studentIds: [student.id, "student-2"], teacherId: n % 2 ? regular.id : leader.id,
    issueIds: ["same-issue", ...(n === 1 ? ["one-off-issue"] : [])], concernIds: ["same-issue"],
    publishedAt: `2026-11-0${n}T08:00:00Z`
  })));
  const alerts = collectSupportAlerts({ concerns, staff, today: "2026-11-05" });
  assert.equal(alerts.length, 6);
  assert.equal(new Set(alerts.map((alert) => alert.key)).size, 6);
  for (const alert of alerts) {
    assert.equal(alert.concernIds.length, 3);
    assert.deepEqual(alert.recipientIds, [supervisor.id, admin.id]);
  }
  assert.deepEqual(collectSupportAlerts({ concerns: concerns.slice(0, 2), staff, today: "2026-11-05" }), []);
});

test("multiple issues on one report are counted once and unrelated Other descriptions are not grouped", () => {
  const concerns = [1, 2, 3].map((n) => ({
    id: `report-${n}`, type: "sel", studentIds: [student.id], concernIds: ["anxiety", "anxiety", "other"],
    otherConcern: `Different issue ${n}`, publishedAt: `2026-11-0${n}T08:00:00Z`
  }));
  const alerts = collectSupportAlerts({ concerns, staff, today: "2026-11-04" });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].issue, "anxiety");
});

test("due-date alerts include students and supervisors, catch overdue goals, and skip completed goals", () => {
  const goal = create();
  assert.equal(collectSupportAlerts({ goals: [goal], staff, today: "2026-11-09" }).length, 0);
  const alerts = collectSupportAlerts({ goals: [goal], staff, today: "2026-11-11" });
  assert.deepEqual(alerts[0].recipientIds, [supervisor.id, admin.id, student.id]);
  assert.equal(collectSupportAlerts({ goals: [closeSmartGoal(supervisor, goal, "achieved", "Completed")], staff, today: "2026-11-11" }).length, 0);
});

test("urgent support reaches supervisors and the student's chosen adult; read receipts belong to each recipient", () => {
  const profile = setTrustedAdult(student, { id: student.id }, regular.id, staff);
  assert.throws(() => setTrustedAdult(regular, profile, leader.id, staff));
  const alert = requestUrgentSupport(student, profile, { id: "request-1", staff });
  assert.deepEqual(alert.recipientIds, [supervisor.id, regular.id, admin.id]);
  assert.throws(() => requestUrgentSupport({ ...student, id: "someone-else" }, profile, { id: "bad", staff }));
  const read = markSupportNotificationRead(supervisor, alert);
  assert.ok(read.readBy[supervisor.id]);
  assert.equal(read.readBy[regular.id], undefined);
  assert.throws(() => markSupportNotificationRead(leader, alert));
});

test("an explicit SMART plan request alerts supervisors even before three concerns", () => {
  const alerts = collectSupportAlerts({ staff, today: "2026-11-02", concerns: [{
    id: "report-1", type: "academic", studentIds: [student.id], issueIds: ["Incomplete homework"],
    requestSmartGoal: true, publishedAt: "2026-11-02T08:00:00Z"
  }] });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, "smart-goal-request");
});

test("IEP validation requires staff, a PDF extension and actual PDF bytes", () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\nexample");
  assert.equal(validateIepPdf(regular, bytes, "plan.pdf").contentType, "application/pdf");
  assert.throws(() => validateIepPdf(student, bytes, "plan.pdf"));
  assert.throws(() => validateIepPdf(regular, bytes, "plan.html"));
  assert.throws(() => validateIepPdf(regular, new TextEncoder().encode("not a PDF"), "plan.pdf"));
});

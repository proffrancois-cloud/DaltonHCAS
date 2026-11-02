import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../data.js";
import { actorForAccount, applySchoolCommand, visibleState, synchronizeAlerts } from "../support-server.js";

test("the server derives the actor from canonical staff status and rejects a forged client role", () => {
  const state = createInitialState();
  const actor = actorForAccount(state, "david");
  assert.equal(actor.role, "teacher");
  assert.throws(() => applySchoolCommand(state, actor, "goal-add", { studentId: state.students[0].id, title: "Forged plan", dueDate: "2026-12-01", role: "super-admin" }));
  const student = actorForAccount(state, state.students[0].id);
  assert.throws(() => applySchoolCommand(state, student, "award-add", { studentId: student.id, points: 50, valueId: "compassion" }));
});

test("student API responses exclude IEPs, SEL, academic records, linked students, confidential notes and other students' goals", () => {
  const state = createInitialState(), studentId = state.students[0].id;
  state.behaviorConcerns = [{ id: "b1", studentIds: [studentId, state.students[1].id], title: "Incident", description: "Visible description", confidentialNote: "PRIVATE", attachmentData: "PRIVATE", issueIds: ["secret"] }];
  state.selConcerns = [{ studentIds: [studentId], description: "PRIVATE" }];
  state.academicConcerns = [{ studentIds: [studentId], description: "PRIVATE" }];
  state.iepDocuments = [{ studentId, path: "PRIVATE" }];
  state.smartGoals = [{ id: "own", studentId, sourceConcernId: "secret" }, { id: "other", studentId: state.students[1].id }];
  state.notifications = [{ key: "private", recipientIds: ["francois"], kind: "urgent-support" }];
  const visible = visibleState(state, actorForAccount(state, studentId));
  assert.equal(visible.students.length, 1);
  assert.deepEqual(visible.behaviorConcerns[0].studentIds, [studentId]);
  assert.equal(visible.smartGoals.length, 1);
  assert.equal(visible.smartGoals[0].sourceConcernId, null);
  assert.equal(JSON.stringify(visible).includes("PRIVATE"), false);
  assert.equal(visible.notifications.length, 0);
  assert.equal(visible.iepDocuments.length, 0);
});

test("repeat-concern alerts remain persisted and individual read receipts survive re-evaluation", () => {
  let state = createInitialState();
  state.selConcerns = [1, 2, 3].map(n => ({ id: `sel-${n}`, concernIds: ["anxiety"], studentIds: [state.students[0].id], publishedAt: `2026-11-0${n}T08:00:00Z` }));
  state = synchronizeAlerts(state, "2026-11-04");
  assert.equal(state.notifications.length, 1);
  state = applySchoolCommand(state, actorForAccount(state, "francois"), "notification-read", { key: state.notifications[0].key });
  state = synchronizeAlerts(state, "2026-11-04");
  assert.equal(state.notifications.length, 1);
  assert.ok(state.notifications[0].readBy.francois);
});

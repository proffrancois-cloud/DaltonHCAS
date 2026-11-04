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

test("staff edit history preserves exact changes and rejects stale edits; students receive current values only", () => {
  let state = createInitialState();
  const now = Date.parse("2026-11-04T02:30:00Z");
  const command = (actorId, action, payload) => {
    state = applySchoolCommand(state, actorForAccount(state, actorId), action, payload, now);
  };
  command("david", "award-add", { studentId: "random1", valueId: "community", points: 20, comment: "Earlier comment" });
  const awardId = state.awards.at(-1).id;
  command("francois", "award-update", { id: awardId, changes: { expectedVersion: 0, points: 30, comment: "Latest comment" } });
  const revised = state.awards.at(-1);
  assert.deepEqual(revised.editHistory, [{
    teacherId: "francois",
    teacherName: actorForAccount(state, "francois").name,
    editedAt: new Date(now).toISOString(),
    changes: [
      { field: "points", before: 20, after: 30 },
      { field: "comment", before: "Earlier comment", after: "Latest comment" }
    ]
  }]);
  assert.throws(() => command("david", "award-update", { id: awardId, changes: { expectedVersion: 0, points: 40 } }), /changed while/);
  command("david", "award-update", { id: awardId, changes: { expectedVersion: 1, points: 30 } });
  assert.equal(state.awards.at(-1), revised);

  const input = {
    studentIds: ["random1"], tier: 1, issueIds: ["other"], otherIssue: "Learning issue",
    concernIds: ["other"], description: "Original observation", incidentDate: "2026-11-04", actionDetails: "Contacted teacher"
  };
  for (const type of ["behavior", "academic", "sel"]) {
    command("david", "concern-add", { type, input: type === "behavior"
      ? { ...input, issueIds: ["classroom-misconduct"], incidentTime: "13:15", location: "Classroom", confidentialNote: "Old private note" } : input });
    const record = state[`${type}Concerns`].at(-1);
    command("francois", "concern-update", { type, id: record.id, changes: {
      description: "Revised observation",
      ...(type === "behavior" ? { confidentialNote: "New private note" } : {})
    } });
    const staffRecord = visibleState(state, actorForAccount(state, "david"))[`${type}Concerns`].at(-1);
    assert.equal(staffRecord.editHistory[0].teacherId, "francois");
    assert.deepEqual(staffRecord.editHistory[0].changes[0], { field: "description", before: "Original observation", after: "Revised observation" });
  }
  const student = visibleState(state, actorForAccount(state, "random1"));
  assert.equal(student.awards.at(-1).comment, "Latest comment");
  assert.equal(student.notifications.find(item => item.awardId === awardId).points, 30);
  assert.equal(student.behaviorConcerns.at(-1).description, "Revised observation");
  assert.equal(student.academicConcerns.length + student.selConcerns.length, 0);
  assert.doesNotMatch(JSON.stringify(student), /editHistory|Earlier comment|Original observation|private note/);
});

test("dashboard Hub returns only the resources authorized for the signed-in account", () => {
  const state = createInitialState();
  state.hubResources = [
    { title: "School calendar", url: "https://example.com/internal", audience: "teacher" },
    { title: "School calendar", url: "https://example.com/external", audience: "student" },
    { title: "Student handbook", audience: "all" },
    { title: "Grade 6", group: "grade-meetings", audience: "teacher" },
    { title: "HoD meeting notes", url: "https://example.com/hod", audience: "hod", accountIds: ["david"] }
  ];
  const resourcesFor = id => visibleState(state, actorForAccount(state, id)).hubResources;
  assert.deepEqual(resourcesFor("random1").map(r => r.title), ["School calendar", "Student handbook"]);
  assert.equal(resourcesFor("random1")[0].url, "https://example.com/external");
  assert.equal(resourcesFor("david")[0].url, "https://example.com/internal");
  assert.equal(resourcesFor("david").find(r => r.title === "Grade 6").group, "grade-meetings");
  assert.equal(resourcesFor("david").find(r => r.title === "HoD meeting notes").url, "https://example.com/hod");
  assert.equal(resourcesFor("francois").some(r => r.title === "HoD meeting notes"), false);
  assert.doesNotMatch(JSON.stringify(resourcesFor("david")), /audience|accountIds/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../data.js";
import { actorForAccount, applySchoolCommand, visibleState } from "../support-server.js";
import { staffActivity, filterActivity, alphabeticStaff } from "../activity.js";

const start = Date.parse("2026-11-02T16:05:00Z");
test("the timeline retains original recognition, edits and cancellation without duplicate creation rows", () => {
  let state = createInitialState();
  const actor = actorForAccount(state, "david"), studentId = state.students[0].id;
  state = applySchoolCommand(state, actor, "award-add", { studentId, valueId: "communication", points: 20 }, start);
  const id = state.awards.at(-1).id;
  state = applySchoolCommand(state, actor, "award-update", { id, changes: { points: 30 } }, start + 1000);
  state = applySchoolCommand(state, actor, "award-remove", { id }, start + 2000);
  const events = staffActivity(state, actor).filter(e => e.recordId === id);
  assert.deepEqual(events.map(e => e.action), ["award-remove", "award-update", "award-add"]);
  assert.equal(events.at(-1).points, 20);
  assert.equal(events[0].points, 30);
  assert.equal(events.every(e => e.participants[0].id === studentId), true);
});
test("activity ownership uses the actor, includes supervisor SMART actions and excludes student API views", () => {
  let state = createInitialState();
  const actor = actorForAccount(state, "francois"), studentId = state.students[0].id;
  state.behaviorConcerns = [{ id: "c1", studentIds: [studentId], teacherId: "david", title: "Concern", publishedAt: new Date(start).toISOString() }];
  state = applySchoolCommand(state, actor, "goal-add", { studentId, title: "Class goal", dueDate: "2026-11-08", sourceConcernType: "behavior", sourceConcernId: "c1" }, start + 1000);
  const id = state.smartGoals.at(-1).id;
  state = applySchoolCommand(state, actor, "goal-field", { id, field: "s", text: "Join the group discussion" }, start + 2000);
  state = applySchoolCommand(state, actor, "goal-close", { id, status: "achieved", note: "Reviewed together" }, start + 3000);
  const events = staffActivity(state, actor).filter(e => e.recordId === id);
  assert.deepEqual(events.map(e => e.action), ["goal-close", "goal-field", "goal-add"]);
  assert.equal(events.every(e => e.type === "behavior"), true);
  assert.equal(visibleState(state, actor).activityEvents.every(e => e.actorId === actor.id), true);
  assert.equal(visibleState(state, actorForAccount(state, studentId)).activityEvents, undefined);
  assert.deepEqual(staffActivity(state, actorForAccount(state, studentId)), []);
  assert.throws(() => applySchoolCommand(state, actorForAccount(state, studentId), "award-add", { studentId, points: 20, valueId: "communication" }));
});
test("activity filters combine type, action, person, house, grade and inclusive Taiwan date ranges", () => {
  const events = [{ at: new Date(start).toISOString(), type: "sel", action: "concern-add", participants: [
    { name: "Alex Chen", houseId: "red", grade: 9 }, { name: "Amelia Lin", houseId: "white", grade: 10 }
  ] }];
  assert.equal(filterActivity(events, { type: "sel", action: "concern-add", query: "alex", house: "red", grade: "9", from: "2026-11-03", to: "2026-11-03" }).length, 1);
  assert.equal(filterActivity(events, { to: "2026-11-02" }).length, 0);
  assert.equal(filterActivity(events, { query: "alex", house: "white" }).length, 0);
  assert.equal(filterActivity(events, { type: "recognition" }).length, 0);
  assert.equal(filterActivity(events, { action: "goal-add" }).length, 0);
  const recognition = [{ ...events[0], type: "recognition", action: "award-add", points: 20, valueId: "compassion" }];
  assert.equal(filterActivity(recognition, { points: "20", valueId: "compassion" }).length, 1);
  assert.equal(filterActivity(recognition, { points: "30" }).length, 0);
});
test("staff picker sorts by surname, with explicit surnames and comma-form names supported", () => {
  const people = [{ name: "Alice Zane" }, { name: "Zoe Baker" }, { name: "Clark, Ben" }, { name: "Teacher Jane", lastName: "Adams" }];
  assert.deepEqual(alphabeticStaff(people).map(p => p.name), ["Teacher Jane", "Zoe Baker", "Clark, Ben", "Alice Zane"]);
});

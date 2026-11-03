import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, getHouseRanking, getHouseCoinSummary, getHouseTotals } from "../data.js";
import { actorForAccount, visibleState } from "../support-server.js";

test("House rankings combine selected Cs and inclusive school dates, including deductions", () => {
  const state = createInitialState();
  state.awards = [
    { studentId: "random1", valueId: "community", points: 20, createdAt: "2026-11-01T16:00:00Z" },
    { studentId: "random1", valueId: "compassion", points: -10, createdAt: "2026-11-02T15:59:59Z" },
    { studentId: "random2", valueId: "compassion", points: 30, createdAt: "2026-11-02T12:00:00Z" },
    { studentId: "random2", valueId: "creativity", points: 50, createdAt: "2026-11-02T12:00:00Z" },
    { studentId: "random1", valueId: "community", points: 50, createdAt: "2026-11-02T16:00:00Z" }
  ];
  const filtered = getHouseRanking(state, { valueIds: ["community", "compassion"], from: "2026-11-02", to: "2026-11-02" });
  assert.equal(filtered.length, 4);
  assert.equal(filtered[0].id, "black-turtles");
  assert.equal(filtered[0].points, 30);
  assert.equal(filtered.find(h => h.id === "red-phoenix").points, 10);
  assert.equal(filtered.find(h => h.id === "red-phoenix").leaders.find(s => s.id === "random1").points, 10);
  const totals = getHouseTotals(state);
  assert.deepEqual(Object.fromEntries(getHouseRanking(state).map(h => [h.id, h.points])), totals);
});

test("students can filter aggregate House totals without receiving other students' records", () => {
  const state = createInitialState();
  const own = state.students[0];
  const result = visibleState(state, actorForAccount(state, own.id));
  assert.equal(result.students.length, 1);
  assert.equal(result.awards.every(a => a.studentId === own.id), true);
  assert.deepEqual(result.houseCoinSummary, getHouseCoinSummary(state));
  assert.equal(result.houseCoinSummary.every(item => Object.keys(item).sort().join(",") === "date,houseId,points,valueId"), true);
  assert.deepEqual(getHouseRanking(result, { valueIds: ["community"] }).map(h => [h.id, h.points]), getHouseRanking(state, { valueIds: ["community"] }).map(h => [h.id, h.points]));
});

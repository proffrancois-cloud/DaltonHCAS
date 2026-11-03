import test from "node:test";
import assert from "node:assert/strict";
import { emptyStudentFilters, matchingStudents, studentCrestVisual } from "../student-ui.js";

const students = [
  { id: "a", name: "Alex Chen", houseId: "red", grade: 9 },
  { id: "b", name: "Amelia Lin", houseId: "white", grade: 10 },
  { id: "c", name: "Noah Chen", houseId: "red", grade: 10 }
];
test("student browsers remain empty until a search or explicit filter activates them", () => {
  const filters = emptyStudentFilters();
  assert.deepEqual(matchingStudents(students, filters), []);
  assert.equal(matchingStudents(students, { ...filters, house: "all" }).length, 3);
  assert.equal(matchingStudents(students, { ...filters, grade: "all" }).length, 3);
  assert.deepEqual(matchingStudents(students, { ...filters, query: " CHEN " }).map(s => s.id), ["a", "c"]);
  assert.deepEqual(matchingStudents(students, { ...filters, grade: "10" }).map(s => s.id), ["b", "c"]);
  assert.deepEqual(matchingStudents(students, { ...filters, house: "red", grade: "10" }).map(s => s.id), ["c"]);
  assert.equal(matchingStudents(students, filters, { activated: true }).length, 3);
  assert.deepEqual(matchingStudents(students, { ...filters, query: "No match", house: "all" }), []);
});
test("shared crests keep individual SVG references and escape names and point labels", () => {
  const esc = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const student = { ...students[0], name: '<img src="x">' };
  const first = studentCrestVisual(student, { image: "house.png" }, -20, "one", esc);
  const second = studentCrestVisual(student, { image: "house.png" }, 30, "two", esc);
  assert.match(first, /href="#one-name"/);
  assert.match(second, /href="#two-name"/);
  assert.equal(first.includes('<img src="x">'), false);
  assert.match(first, /&lt;img src=&quot;x&quot;>/);
  assert.match(first, /student-points-badge">-20/);
});

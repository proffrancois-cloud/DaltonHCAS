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

test("Students combines multi-select categories and ranks selected 7Cs over inclusive Taipei dates", async () => {
  const { browseStudents, toggleFilterValues } = await import("../student-ui.js");
  const houses=[{id:"red",name:"Red Phoenix"},{id:"white",name:"White Tiger"}];
  const values=[{id:"community",name:"Community"},{id:"compassion",name:"Compassion"}];
  const state={students,awards:[
    {studentId:"a",valueId:"community",points:20,createdAt:"2026-11-01T16:00:00Z"},
    {studentId:"b",valueId:"compassion",points:40,createdAt:"2026-11-02T15:59:59Z"},
    {studentId:"b",valueId:"compassion",points:-10,createdAt:"2026-11-02T15:59:59Z"},
    {studentId:"c",valueId:"community",points:50,createdAt:"2026-11-02T16:00:00Z"}
  ]};
  const filters={query:"",house:[],grade:[],values:[],from:"",to:""};
  assert.deepEqual(browseStudents(state,filters,houses,values).students,[]);
  const result=browseStudents(state,{...filters,house:["red","white"],grade:["9","10"],values:["community","compassion"],from:"2026-11-02",to:"2026-11-02"},houses,values);
  assert.equal(result.ranked,true);
  assert.deepEqual(result.students.map(s=>[s.id,s.points]),[["b",30],["a",20]]);
  assert.deepEqual(browseStudents(state,{...filters,query:"white"},houses,values).students.map(s=>s.id),["b"]);
  assert.deepEqual(browseStudents(state,{...filters,query:"Community"},houses,values).students.map(s=>s.id),["c","a"]);
  assert.deepEqual(toggleFilterValues(["all"],"red"),["red"]);
  assert.deepEqual(toggleFilterValues(["red","white"],"red"),["white"]);
  assert.deepEqual(toggleFilterValues(["all"],"all"),[]);
});

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  ACADEMIC_PROFILES,
  BEHAVIOR_ISSUES,
  DEFAULT_POINTS,
  HOUSES,
  MAX_COMMENT_LENGTH,
  POINT_OPTIONS,
  STUDENTS,
  TEACHERS,
  VALUES,
  addAcademicConcern,
  addAward,
  addBehaviorConcern,
  authenticateTeacher,
  createInitialState,
  getHouseLeaders,
  getHouseTotals,
  getStudentAcademicConcerns,
  getStudentAwards,
  getStudentBehaviorConcerns,
  getStudentRanking,
  getStudentStats,
  getStudentTotal,
  getTeacherAwards,
  getTeacherStats,
  migrateStoredState,
  removeAward
} from "../data.js";

test("only the two configured teacher credentials authenticate", () => {
  assert.deepEqual(authenticateTeacher("david", "david"), TEACHERS[0]);
  assert.deepEqual(authenticateTeacher(" francois ", "francois"), TEACHERS[1]);
  assert.equal(authenticateTeacher("david", "wrong"), null);
  assert.equal(authenticateTeacher("unknown", "unknown"), null);
});

test("the demo contains the requested grade distribution across valid houses", () => {
  assert.equal(STUDENTS.length, 11);
  assert.deepEqual(
    STUDENTS.map((student) => student.name),
    Array.from({ length: 11 }, (_, index) => `random${index + 1}`)
  );

  const houseIds = new Set(HOUSES.map((house) => house.id));
  assert.equal(STUDENTS.every((student) => houseIds.has(student.houseId)), true);
  assert.deepEqual(
    Object.fromEntries(
      [9, 10, 11, 12].map((grade) => [
        grade,
        STUDENTS.filter((student) => student.grade === grade).length
      ])
    ),
    { 9: 2, 10: 3, 11: 3, 12: 3 }
  );
});

test("the demo starts with deterministic house totals", () => {
  const state = createInitialState(new Date("2026-08-19T12:00:00Z").getTime());
  assert.deepEqual(getHouseTotals(state), {
    "red-phoenix": 100,
    "black-turtles": 60,
    "green-dragons": 80,
    "white-tigers": 70
  });
});

test("house cup history matches the seven requested seasons", () => {
  assert.deepEqual(
    Object.fromEntries(HOUSES.map((house) => [house.id, house.cupYears])),
    {
      "red-phoenix": ["2020–2021", "2023–2024", "2024–2025"],
      "black-turtles": ["2021–2022", "2025–2026"],
      "green-dragons": ["2019–2020"],
      "white-tigers": ["2022–2023"]
    }
  );
});

test("every HCAS 7C uses one of the supplied official logo assets", () => {
  assert.deepEqual(
    VALUES.map((value) => value.image),
    [
      "assets/7c-contribution.png",
      "assets/7c-collaboration.png",
      "assets/7c-compassion.png",
      "assets/7c-communication.png",
      "assets/7c-critical-thinking.png",
      "assets/7c-community.png",
      "assets/7c-creativity.png"
    ]
  );
  assert.equal(
    VALUES.every((value) => existsSync(new URL(`../${value.image}`, import.meta.url))),
    true
  );
});

test("student 7C history is filtered and ordered newest first", () => {
  const now = new Date("2026-08-19T12:00:00Z").getTime();
  const state = createInitialState(now);
  const updatedState = addAward(
    state,
    "random1",
    "contribution",
    "david",
    50,
    now + 60_000
  );
  const history = getStudentAwards(updatedState, "random1", "contribution");

  assert.equal(history[0].teacherId, "david");
  assert.equal(history[0].points, 50);
  assert.equal(history.every((award) => award.valueId === "contribution"), true);
  assert.equal(
    history.every(
      (award, index) =>
        index === 0 || new Date(history[index - 1].createdAt) >= new Date(award.createdAt)
    ),
    true
  );
});

test("an optional comment is stored once and shared by student and teacher histories", () => {
  const now = new Date("2026-08-19T12:00:00Z").getTime();
  const state = createInitialState(now);
  const withComment = addAward(
    state,
    "random5",
    "collaboration",
    "francois",
    30,
    now + 60_000,
    "  Excellent support during the group project.  "
  );
  const awardForStudent = getStudentAwards(withComment, "random5", "collaboration")[0];
  const awardForTeacher = getTeacherAwards(withComment, "francois")[0];

  assert.equal(awardForStudent.comment, "Excellent support during the group project.");
  assert.equal(awardForTeacher.id, awardForStudent.id);
  assert.equal(awardForTeacher.comment, awardForStudent.comment);

  const withoutComment = addAward(
    withComment,
    "random5",
    "community",
    "francois",
    10,
    now + 120_000
  );
  assert.equal(getTeacherAwards(withoutComment, "francois")[0].comment, "");
});

test("house leaders are ranked by live student points", () => {
  const state = createInitialState(new Date("2026-08-19T12:00:00Z").getTime());
  assert.deepEqual(
    getHouseLeaders(state, "red-phoenix").map(({ id, points }) => ({ id, points })),
    [
      { id: "random9", points: 40 },
      { id: "random1", points: 30 },
      { id: "random5", points: 30 }
    ]
  );

  const updatedState = addAward(state, "random1", "community", "david", 50);
  assert.deepEqual(
    getHouseLeaders(updatedState, "red-phoenix").map(({ id, points }) => ({ id, points })),
    [
      { id: "random1", points: 80 },
      { id: "random9", points: 40 },
      { id: "random5", points: 30 }
    ]
  );
});

test("one recognition adds the selected point amount to the student, teacher, and house", () => {
  const state = createInitialState(new Date("2026-08-19T12:00:00Z").getTime());
  const beforeHouse = getHouseTotals(state)["black-turtles"];
  const beforeValue = getStudentStats(state, "random2").compassion;
  const beforeTeacherValue = getTeacherStats(state, "david").compassion;
  const beforeStudentTotal = getStudentTotal(state, "random2");
  const nextState = addAward(
    state,
    "random2",
    "compassion",
    "david",
    40,
    new Date("2026-08-19T13:00:00Z").getTime()
  );

  assert.equal(getHouseTotals(nextState)["black-turtles"], beforeHouse + 40);
  assert.equal(getStudentStats(nextState, "random2").compassion.recognitions, beforeValue.recognitions + 1);
  assert.equal(getStudentStats(nextState, "random2").compassion.points, beforeValue.points + 40);
  assert.equal(getStudentTotal(nextState, "random2"), beforeStudentTotal + 40);
  assert.equal(getTeacherAwards(nextState, "david")[0].studentId, "random2");
  assert.equal(getTeacherAwards(nextState, "david")[0].points, 40);
  assert.equal(
    getTeacherStats(nextState, "david").compassion.points,
    beforeTeacherValue.points + 40
  );
});

test("invalid students, 7Cs, teachers, and point amounts cannot receive an award", () => {
  const state = createInitialState();
  assert.throws(() => addAward(state, "missing", VALUES[0].id, TEACHERS[0].id), /Unknown student/);
  assert.throws(() => addAward(state, STUDENTS[0].id, "missing", TEACHERS[0].id), /Unknown HCAS value/);
  assert.throws(() => addAward(state, STUDENTS[0].id, VALUES[0].id, "missing"), /Unknown teacher/);
  assert.throws(
    () => addAward(state, STUDENTS[0].id, VALUES[0].id, TEACHERS[0].id, 15),
    /Invalid point amount/
  );
  assert.throws(
    () =>
      addAward(
        state,
        STUDENTS[0].id,
        VALUES[0].id,
        TEACHERS[0].id,
        10,
        Date.now(),
        "x".repeat(MAX_COMMENT_LENGTH + 1)
      ),
    /Invalid comment/
  );
  assert.deepEqual(POINT_OPTIONS, [10, 20, 30, 40, 50]);
  assert.equal(DEFAULT_POINTS, 10);
});

test("a teacher can unsend only their own recognition and all totals recalculate", () => {
  const state = createInitialState(new Date("2026-08-19T12:00:00Z").getTime());
  const withAward = addAward(
    state,
    "random2",
    "compassion",
    "david",
    50,
    new Date("2026-08-19T13:00:00Z").getTime()
  );
  const award = getTeacherAwards(withAward, "david")[0];

  assert.throws(
    () => removeAward(withAward, award.id, "francois"),
    /only unsend their own/
  );
  assert.throws(() => removeAward(withAward, "missing", "david"), /Unknown recognition/);

  const restoredState = removeAward(withAward, award.id, "david");
  assert.deepEqual(getHouseTotals(restoredState), getHouseTotals(state));
  assert.equal(getStudentTotal(restoredState, "random2"), getStudentTotal(state, "random2"));
  assert.deepEqual(getTeacherStats(restoredState, "david"), getTeacherStats(state, "david"));
});

test("version 2 activity migrates without losing awards", () => {
  const currentState = createInitialState(new Date("2026-08-19T12:00:00Z").getTime());
  const legacyState = {
    version: 2,
    students: currentState.students.slice(0, 10).map(({ grade, ...student }) => student),
    awards: currentState.awards.filter((award) => award.studentId !== "random11")
  };

  const migratedState = migrateStoredState(legacyState);
  assert.equal(migratedState.version, 4);
  assert.equal(migratedState.students.length, 11);
  assert.equal(migratedState.students[0].grade, 9);
  assert.deepEqual(migratedState.awards, legacyState.awards);
  assert.deepEqual(migratedState.behaviorConcerns, []);
  assert.deepEqual(migratedState.academicConcerns, []);
});

test("behavior issues exactly cover the 10 Level I and 14 Level II code categories", () => {
  assert.equal(BEHAVIOR_ISSUES.filter((issue) => issue.level === 1).length, 10);
  assert.equal(BEHAVIOR_ISSUES.filter((issue) => issue.level === 2).length, 14);
});

test("behavior concerns support multiple students and advance code actions by occurrence", () => {
  const now = new Date("2026-11-02T04:00:00Z").getTime();
  const state = createInitialState(now);
  const first = addBehaviorConcern(
    state,
    {
      studentIds: ["random1", "random5"],
      issueIds: ["classroom-misconduct"],
      title: "Repeated disruption",
      description: "The students repeatedly interrupted direct instruction.",
      strategies: ["Redirect off-task behavior"],
      confidentialNote: "Teacher-only context",
      teacherId: "david",
      incidentDate: "2026-11-02"
    },
    now + 1_000
  );
  const concern = first.behaviorConcerns[0];

  assert.deepEqual(concern.studentIds, ["random1", "random5"]);
  assert.equal(concern.codeActions.every((action) => action.label === "First occurrence"), true);
  assert.equal(concern.confidentialNote, "Teacher-only context");
  assert.equal(getStudentBehaviorConcerns(first, "random1")[0].id, concern.id);
  assert.equal(getStudentBehaviorConcerns(first, "random5")[0].id, concern.id);

  const second = addBehaviorConcern(
    first,
    {
      studentIds: ["random1"],
      issueIds: ["classroom-misconduct"],
      title: "Second disruption",
      description: "The behavior occurred again after reteaching.",
      teacherId: "francois",
      incidentDate: "2026-11-03"
    },
    now + 2_000
  );
  assert.equal(second.behaviorConcerns.at(-1).codeActions[0].label, "Second occurrence");
});

test("Level II behavior concerns always retrieve immediate administrative referral", () => {
  const state = createInitialState();
  const updated = addBehaviorConcern(state, {
    studentIds: ["random2"],
    issueIds: ["fighting"],
    title: "Physical altercation",
    description: "A physical altercation occurred during lunch.",
    teacherId: "david",
    incidentDate: "2026-11-02"
  });
  assert.equal(updated.behaviorConcerns[0].codeActions[0].label, "Immediate administrative referral");
});

test("academic concerns use the six requested profiles with five interventions each", () => {
  assert.equal(ACADEMIC_PROFILES.length, 6);
  assert.equal(ACADEMIC_PROFILES.every((profile) => profile.strategies.length === 5), true);

  const state = createInitialState();
  const updated = addAcademicConcern(state, {
    studentIds: ["random3", "random4"],
    tier: 3,
    issueIds: ["Performing well below grade level in reading, writing, or math"],
    profileId: "dyslexia",
    title: "Reading fluency concern",
    description: "Progress monitoring shows persistent decoding difficulty.",
    strategies: ACADEMIC_PROFILES[0].strategies.slice(0, 2),
    actionDetails: "Provided explicit decoding practice twice this week.",
    internalNote: "Teacher-only academic context",
    teacherId: "francois",
    incidentDate: "2026-11-02"
  });

  assert.equal(getStudentAcademicConcerns(updated, "random3")[0].profileId, "dyslexia");
  assert.equal(getStudentAcademicConcerns(updated, "random4")[0].internalNote, "Teacher-only academic context");
});

test("student ranking filters by 7C, grade, and publication date", () => {
  const now = new Date("2026-11-02T04:00:00Z").getTime();
  let state = createInitialState(now);
  state = addAward(state, "random1", "creativity", "david", 50, now + 60_000);

  const creativityRanking = getStudentRanking(state, { valueId: "creativity", grade: "9" });
  assert.deepEqual(creativityRanking.map((student) => student.id), ["random1", "random2"]);
  assert.equal(creativityRanking[0].points, 60);

  const dateRanking = getStudentRanking(state, { date: "2026-11-02" });
  assert.equal(dateRanking[0].points > 0, true);
});

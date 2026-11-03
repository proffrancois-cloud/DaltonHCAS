import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  TEACHER_ROLES,
  VALUES,
  addAcademicConcern,
  addLabAssignment,
  addCustomCalendarEvent,
  addAward,
  addBehaviorConcern,
  addSelCheckIn,
  addSelConcern,
  authenticateTeacher,
  authenticateUser,
  canEditCalendarEvent,
  canEditStudentRecord,
  canCreateCalendarEvent,
  createInitialState,
  createStudentAccount,
  createTeacherAccount,
  getHouseLeaders,
  getHouseTotals,
  getCalendarEvents,
  getStudentAcademicConcerns,
  getStudentAwards,
  getStudentBehaviorConcerns,
  getStudentRanking,
  getStudentSelCheckIns,
  getStudentSelConcerns,
  getStudentStats,
  getStudentTotal,
  getTeacherAwards,
  getTeacherPermissions,
  getTeacherStats,
  migrateStoredState,
  removeAward,
  setHouseLeader,
  transferStudentHouse,
  updateAward,
  updateCalendarEventDetails,
  updateConcern,
  updateTeacherAccountStatus
} from "../data.js";

test("only the two configured teacher credentials authenticate", () => {
  assert.deepEqual(authenticateTeacher("david", "david"), TEACHERS[0]);
  assert.deepEqual(authenticateTeacher(" francois ", "francois"), TEACHERS[1]);
  assert.equal(authenticateTeacher("david", "wrong"), null);
  assert.equal(authenticateTeacher("unknown", "unknown"), null);
});

test("student accounts use the same normalized username and password", () => {
  const student = STUDENTS[0];
  const user = authenticateUser(student.username, student.username);
  assert.equal(user.type, "student");
  assert.equal(user.studentId, student.id);
  assert.equal(authenticateUser(student.username, "wrong"), null);
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

test("authorized staff can unsend a recognition and all totals recalculate", () => {
  const initial = createInitialState(new Date("2026-08-19T12:00:00Z").getTime());
  const superAdmin = { type: "teacher", ...TEACHERS.find((teacher) => teacher.role === "super-admin") };
  const state = createTeacherAccount(initial, superAdmin, {
    name: "Regular Colleague",
    role: "teacher"
  });
  const withAward = addAward(
    state,
    "random2",
    "compassion",
    "david",
    50,
    new Date("2026-08-19T13:00:00Z").getTime()
  );
  const award = getTeacherAwards(withAward, "david")[0];

  assert.throws(() => removeAward(withAward, award.id, state.teachers.at(-1).id), /permission/);
  assert.throws(() => removeAward(withAward, "missing", "david"), /Unknown recognition/);

  assert.equal(removeAward(withAward, award.id, "francois").awards.includes(award), false);

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
  assert.equal(migratedState.version, 9);
  assert.equal(migratedState.students.length, 11);
  assert.equal(migratedState.students[0].grade, 9);
  assert.deepEqual(
    migratedState.awards,
    legacyState.awards.map((award) => ({ ...award, editorIds: [] }))
  );
  assert.deepEqual(migratedState.behaviorConcerns, []);
  assert.deepEqual(migratedState.academicConcerns, []);
  assert.deepEqual(migratedState.selConcerns, []);
  assert.deepEqual(migratedState.selCheckIns, []);
  assert.deepEqual(migratedState.customCalendarEvents, []);
  assert.equal(migratedState.teachers.length, TEACHERS.length);
});

test("version 8 roster affiliations migrate to regular staff status", () => {
  const currentState = createInitialState();
  const regularTeacher = currentState.teachers.find((teacher) => teacher.role === "teacher");
  const legacyState = {
    ...currentState,
    version: 8,
    teachers: currentState.teachers.map((teacher) =>
      teacher.id === regularTeacher.id
        ? { ...teacher, role: "house-leader", houseId: "red-phoenix" }
        : teacher
    )
  };

  const migratedState = migrateStoredState(legacyState);
  assert.equal(migratedState.version, 9);
  assert.equal(
    migratedState.teachers.find((teacher) => teacher.id === regularTeacher.id).role,
    "teacher"
  );
});

test("super admins manage accounts and House placement while regular teachers cannot", () => {
  const state = createInitialState();
  const superAdmin = { type: "teacher", ...TEACHERS.find((teacher) => teacher.role === "super-admin") };
  const regularTeacher = { type: "teacher", ...TEACHERS.find((teacher) => teacher.role === "teacher") };
  assert.equal(getTeacherPermissions(superAdmin).canManageAccounts, true);
  assert.equal(getTeacherPermissions(regularTeacher).canManageAccounts, false);
  assert.throws(
    () => createStudentAccount(state, regularTeacher, { name: "New Student", grade: 9, houseId: "red-phoenix" }),
    /super admin/
  );

  let nextState = createStudentAccount(state, superAdmin, {
    name: "New Student",
    grade: 9,
    houseId: "red-phoenix"
  });
  const student = nextState.students.at(-1);
  assert.equal(student.username, "NewStudent");
  nextState = transferStudentHouse(nextState, superAdmin, student.id, "black-turtles");
  assert.equal(nextState.students.find((item) => item.id === student.id).houseId, "black-turtles");

  nextState = createTeacherAccount(nextState, superAdmin, {
    name: "House Leader",
    role: "house-leader",
    houseId: "green-dragons"
  });
  assert.equal(nextState.teachers.at(-1).username, "HouseLeader");

  const houseLeader = nextState.teachers.at(-1);
  nextState = updateTeacherAccountStatus(nextState, superAdmin, houseLeader.id, {
    role: "teacher-supervising",
    houseId: "green-dragons"
  });
  assert.equal(nextState.teachers.at(-1).role, "teacher-supervising");
  assert.equal(getTeacherPermissions(nextState.teachers.at(-1)).canEditAllStudentRecords, true);
  assert.throws(
    () => updateTeacherAccountStatus(nextState, regularTeacher, houseLeader.id, { role: "teacher" }),
    /super admin/
  );
  assert.throws(
    () => updateTeacherAccountStatus(nextState, superAdmin, houseLeader.id, {
      role: "house-leader",
      houseId: null
    }),
    /assigned to a house/
  );
  assert.throws(
    () => updateTeacherAccountStatus(nextState, superAdmin, superAdmin.id, {
      role: "teacher",
      houseId: superAdmin.houseId
    }),
    /At least one super admin/
  );
});

test("staff statuses enforce permanent and delegated record editing access", () => {
  assert.deepEqual(TEACHER_ROLES, [
    "teacher",
    "house-leader",
    "teacher-supervising",
    "super-admin"
  ]);
  assert.equal(TEACHERS.some((teacher) => teacher.role === "teacher-supervising"), false);
  const superAdmin = { type: "teacher", ...TEACHERS.find((teacher) => teacher.role === "super-admin") };
  let state = createInitialState();
  state = createTeacherAccount(state, superAdmin, { name: "Supervising Teacher", role: "teacher-supervising" });
  const supervising = state.teachers.at(-1);
  state = createTeacherAccount(state, superAdmin, { name: "Regular Editor", role: "teacher" });
  const delegated = state.teachers.at(-1);
  state = createTeacherAccount(state, superAdmin, {
    name: "Red Leader",
    role: "house-leader",
    houseId: "red-phoenix"
  });
  const leader = state.teachers.at(-1);

  state = addAward(state, "random1", "community", "david", 20, Date.now(), "Helpful", [
    delegated.id,
    supervising.id,
    superAdmin.id
  ]);
  const award = state.awards.at(-1);
  assert.deepEqual(award.editorIds, []);
  assert.equal(canEditStudentRecord(state, "david", award), true);
  assert.equal(canEditStudentRecord(state, superAdmin.id, award), true);
  assert.equal(canEditStudentRecord(state, supervising.id, award), true);
  assert.equal(canEditStudentRecord(state, delegated.id, { ...award, editorIds: [delegated.id] }), false);
  assert.equal(canEditStudentRecord(state, leader.id, award), false);
  assert.equal(getTeacherPermissions(supervising).canEditAllStudentRecords, true);
  assert.equal(getTeacherPermissions(supervising).canManageAccounts, false);
  assert.equal(getTeacherPermissions(supervising).canCreateCalendarEvents, false);
  assert.equal(getTeacherPermissions(leader).canEditAllStudentRecords, false);

  state = updateAward(state, award.id, supervising.id, {
    valueId: "compassion",
    points: 30,
    comment: "Updated by supervising staff",
    editorIds: []
  });
  assert.equal(state.awards.at(-1).points, 30);
  assert.equal(canEditStudentRecord(state, delegated.id, state.awards.at(-1)), false);

  state = addAcademicConcern(state, {
    studentIds: ["random1"],
    tier: 1,
    issueIds: ["Missing or incomplete work"],
    title: "Follow-up",
    description: "Work pattern observed.",
    actionDetails: "Conference held.",
    teacherId: "david",
    editorIds: [leader.id],
    incidentDate: "2026-11-02"
  });
  const concern = state.academicConcerns.at(-1);
  assert.equal(canEditStudentRecord(state, leader.id, concern), true);
  state = updateConcern(state, "academic", concern.id, leader.id, {
    title: "Updated follow-up",
    description: "Updated observation.",
    incidentDate: "2026-11-03",
    actionDetails: "Second conference held.",
    editorIds: [leader.id]
  });
  assert.equal(state.academicConcerns.at(-1).title, "Updated follow-up");
});

test("House leader teachers publish only their own House events", () => {
  const superAdmin = { type: "teacher", ...TEACHERS.find((teacher) => teacher.role === "super-admin") };
  let state = createTeacherAccount(createInitialState(), superAdmin, {
    name: "Green Leader",
    role: "house-leader",
    houseId: "green-dragons"
  });
  const leader = { type: "teacher", ...state.teachers.at(-1) };
  const payload = {
    date: "2026-11-06",
    title: "House challenge",
    type: "house",
    houseIds: ["green-dragons"]
  };
  assert.equal(canCreateCalendarEvent(state, leader, payload), true);
  assert.equal(
    canCreateCalendarEvent(state, leader, { ...payload, houseIds: ["red-phoenix"] }),
    false
  );
  state = addCustomCalendarEvent(state, leader, payload);
  assert.equal(state.customCalendarEvents.at(-1).houseIds[0], "green-dragons");
});

test("Behavior and academic concerns are top-level navigation items", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /class="nav-button"[^>]+data-view="behavior-concern"/);
  assert.match(html, /class="nav-button"[^>]+data-view="academic-concern"/);
  assert.doesNotMatch(html, /nav-submenu|bottom-concern-menu/);
});

test("the Dalton calendar filters Grade 6–12 events for students and keeps the full teacher view", () => {
  const state = createInitialState();
  const gradeNine = state.students.find((student) => student.grade === 9);
  const studentEvents = getCalendarEvents(state, {
    user: { type: "student", studentId: gradeNine.id, name: gradeNine.name },
    startDate: "2026-08-10",
    endDate: "2026-08-14"
  });
  assert.equal(studentEvents.some((event) => event.title.includes("Lab Fair")), true);
  assert.equal(studentEvents.every((event) => !event.grades?.length || event.grades.includes(9)), true);

  const teacherEvents = getCalendarEvents(state, {
    user: { type: "teacher", id: "david", name: "David" },
    startDate: "2026-08-10",
    endDate: "2026-08-14"
  });
  assert.equal(teacherEvents.length > studentEvents.length, true);
});

test("house and lab leaders receive only the calendar editing access assigned to them", () => {
  let state = createInitialState();
  const student = state.students.find((item) => item.grade >= 9);
  const user = { type: "student", id: student.id, studentId: student.id, name: student.name };
  state = setHouseLeader(state, student.houseId, student.id, true);
  state = addLabAssignment(state, {
    name: "Robotics Lab",
    weekday: 1,
    leaderIds: [student.id],
    grades: [student.grade]
  });
  const events = getCalendarEvents(state, {
    user,
    startDate: "2026-08-10",
    endDate: "2026-08-24"
  });
  const houseEvent = events.find((event) => event.type === "house");
  const labEvent = events.find((event) => event.labId);
  assert.equal(canEditCalendarEvent(state, user, houseEvent), true);
  assert.equal(canEditCalendarEvent(state, user, labEvent), true);

  state = updateCalendarEventDetails(state, user, labEvent, {
    description: "Bring a charged laptop.",
    location: "Lab 304"
  });
  assert.equal(state.calendarEventDetails[labEvent.id].description, "Bring a charged laptop.");
});

test("behavior issues exactly cover the 10 Level I and 14 Level II code categories", () => {
  assert.equal(BEHAVIOR_ISSUES.filter((issue) => issue.level === 1).length, 10);
  assert.equal(BEHAVIOR_ISSUES.filter((issue) => issue.level === 2).length, 14);
});

test("behavior concerns support multiple students and use the selected occurrence", () => {
  const now = new Date("2026-11-02T04:00:00Z").getTime();
  const state = createInitialState(now);
  const first = addBehaviorConcern(
    state,
    {
      studentIds: ["random1", "random5"],
      tier: 1,
      occurrence: 1,
      issueIds: ["classroom-misconduct"],
      title: "Repeated disruption",
      description: "The students repeatedly interrupted direct instruction.",
      strategies: ["Redirect off-task behavior"],
      confidentialNote: "Teacher-only context",
      teacherId: "david",
      incidentDate: "2026-11-02",
      incidentTime: "13:15",
      location: "Classroom"
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
      tier: 1,
      occurrence: 2,
      issueIds: ["classroom-misconduct"],
      title: "Second disruption",
      description: "The behavior occurred again after reteaching.",
      teacherId: "francois",
      incidentDate: "2026-11-03",
      incidentTime: "13:15",
      location: "Classroom"
    },
    now + 2_000
  );
  assert.equal(second.behaviorConcerns.at(-1).codeActions[0].label, "Second occurrence");
});

test("Level II behavior concerns always retrieve immediate administrative referral", () => {
  const state = createInitialState();
  const updated = addBehaviorConcern(state, {
    studentIds: ["random2"],
    tier: 2,
    occurrence: 1,
    issueIds: ["fighting"],
    title: "Physical altercation",
    description: "A physical altercation occurred during lunch.",
    teacherId: "david",
    incidentDate: "2026-11-02",
    incidentTime: "12:20",
    location: "Gymnasium"
  });
  assert.equal(updated.behaviorConcerns[0].codeActions[0].label, "Immediate administrative referral");
});

test("a behavior concern can deduct points from both student and House totals", () => {
  const state = createInitialState();
  const beforeStudent = getStudentTotal(state, "random2");
  const beforeHouse = getHouseTotals(state)[state.students.find((student) => student.id === "random2").houseId];
  const updated = addBehaviorConcern(state, {
    studentIds: ["random2"],
    tier: 1,
    occurrence: 1,
    issueIds: ["classroom-misconduct"],
    title: "Classroom concern",
    description: "The student repeatedly interrupted direct instruction.",
    teacherId: "david",
    incidentDate: "2026-11-02",
    incidentTime: "13:15",
    location: "Classroom",
    deductionValueId: "collaboration",
    deductionPoints: 20
  });
  const deduction = updated.awards.at(-1);
  assert.equal(deduction.points, -20);
  assert.match(deduction.comment, /20 points are taken from .+ for lack of Collaboration\./);
  assert.equal(getStudentTotal(updated, "random2"), beforeStudent - 20);
  assert.equal(getHouseTotals(updated)[updated.students.find((student) => student.id === "random2").houseId], beforeHouse - 20);
});

test("SEL concerns remain teacher records and daily student check-ins keep separate entries on the same day", () => {
  const now = new Date("2026-11-02T04:00:00Z").getTime();
  let state = createInitialState(now);
  state = addSelConcern(state, {
    studentIds: ["random1"],
    concernIds: ["anxiety"],
    title: "Anxiety observation",
    description: "The student reported feeling overwhelmed before class.",
    followUp: "Checked in and offered a quiet reset.",
    teacherId: "david",
    incidentDate: "2026-11-02"
  }, now + 1_000);
  assert.equal(getStudentSelConcerns(state, "random1").length, 1);
  const studentUser = authenticateUser("random1", "random1", state);
  state = addSelCheckIn(state, studentUser, { rating: 2, reflection: "I am worried about a test." }, now + 2_000);
  state = addSelCheckIn(state, studentUser, { rating: 3, reflection: "A plan helped me feel calmer." }, now + 3_000);
  const checkIns = getStudentSelCheckIns(state, "random1");
  assert.equal(checkIns.length, 2);
  assert.equal(checkIns[0].rating, 3);
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

test("student ranking filters by 7C, grade, and publication date range", () => {
  const now = new Date("2026-11-02T04:00:00Z").getTime();
  let state = createInitialState(now);
  state = addAward(state, "random1", "creativity", "david", 50, now + 60_000);

  const creativityRanking = getStudentRanking(state, { valueId: "creativity", grade: "9" });
  assert.deepEqual(creativityRanking.map((student) => student.id), ["random1", "random2"]);
  assert.equal(creativityRanking[0].points, 60);

  const dateRanking = getStudentRanking(state, {
    dateFrom: "2026-11-02",
    dateTo: "2026-11-02"
  });
  assert.equal(dateRanking[0].points > 0, true);
  const emptyRange = getStudentRanking(state, {
    dateFrom: "2026-11-03",
    dateTo: "2026-11-04"
  });
  assert.equal(emptyRange.every((student) => student.points === 0), true);
});

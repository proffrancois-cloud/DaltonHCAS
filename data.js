import {
  ACADEMIC_CONCERN_EXAMPLES,
  ACADEMIC_PROFILES,
  BEHAVIOR_ISSUES,
  BEHAVIOR_LOCATIONS,
  BEHAVIOR_RESPONSE_OPTIONS,
  BEHAVIOR_STRATEGY_GROUPS,
  LEVEL_ONE_ACTIONS,
  LEVEL_TWO_ACTION,
  MAX_CONCERN_DESCRIPTION_LENGTH,
  MAX_CONCERN_TITLE_LENGTH,
  MAX_INTERNAL_NOTE_LENGTH,
  SEL_CONCERN_OPTIONS,
  TIER_ONE_INSTRUCTIONAL_STRATEGIES,
  TIER_TWO_ACADEMIC_INTERVENTIONS
} from "./concerns-data.js";
import { OFFICIAL_CALENDAR_EVENTS } from "./calendar-data.js";

export {
  ACADEMIC_CONCERN_EXAMPLES,
  ACADEMIC_PROFILES,
  BEHAVIOR_ISSUES,
  BEHAVIOR_LOCATIONS,
  BEHAVIOR_RESPONSE_OPTIONS,
  BEHAVIOR_STRATEGY_GROUPS,
  MAX_CONCERN_DESCRIPTION_LENGTH,
  MAX_CONCERN_TITLE_LENGTH,
  MAX_INTERNAL_NOTE_LENGTH,
  SEL_CONCERN_OPTIONS,
  TIER_ONE_INSTRUCTIONAL_STRATEGIES,
  TIER_TWO_ACADEMIC_INTERVENTIONS
};

export const DEFAULT_POINTS = 10;
export const POINT_OPTIONS = [10, 20, 30, 40, 50];
export const MAX_COMMENT_LENGTH = 300;
export const MAX_ATTACHMENT_DATA_LENGTH = 1_100_000;

export const HOUSES = [
  {
    id: "red-phoenix",
    name: "Red Phoenix",
    image: "assets/red-phoenix.png",
    color: "#c43b42",
    dark: "#8f252d",
    cupYears: ["2020–2021", "2023–2024", "2024–2025"]
  },
  {
    id: "black-turtles",
    name: "Black Turtles",
    image: "assets/black-turtles.png",
    color: "#25292d",
    dark: "#151719",
    cupYears: ["2021–2022", "2025–2026"]
  },
  {
    id: "green-dragons",
    name: "Green Dragons",
    image: "assets/green-dragons.png",
    color: "#1f7655",
    dark: "#145139",
    cupYears: ["2019–2020"]
  },
  {
    id: "white-tigers",
    name: "White Tigers",
    image: "assets/white-tigers.png",
    color: "#66717c",
    dark: "#3e4750",
    cupYears: ["2022–2023"]
  }
];

export const TEACHER_ROLES = [
  "teacher",
  "house-leader",
  "teacher-supervising",
  "super-admin"
];

export const TEACHER_ROLE_LABELS = {
  teacher: "Regular teacher",
  "house-leader": "Leader teacher",
  "teacher-supervising": "Teacher supervising",
  "super-admin": "Super admin"
};

const DEMO_TEACHERS = [
  { id: "david", username: "david", name: "David", houseId: null, role: "teacher" },
  {
    id: "francois",
    username: "francois",
    name: "Francois",
    houseId: "black-turtles",
    role: "super-admin"
  }
];

export const VALUES = [
  {
    id: "contribution",
    name: "Contribution",
    description: "Steps up and helps",
    image: "assets/7c-contribution.png"
  },
  {
    id: "collaboration",
    name: "Collaboration",
    description: "Works well with others",
    image: "assets/7c-collaboration.png"
  },
  {
    id: "compassion",
    name: "Compassion",
    description: "Shows care and understanding",
    image: "assets/7c-compassion.png"
  },
  {
    id: "communication",
    name: "Communication",
    description: "Shares and listens clearly",
    image: "assets/7c-communication.png"
  },
  {
    id: "critical-thinking",
    name: "Critical Thinking",
    description: "Thinks carefully and solves",
    image: "assets/7c-critical-thinking.png"
  },
  {
    id: "community",
    name: "Community",
    description: "Makes the school stronger",
    image: "assets/7c-community.png"
  },
  {
    id: "creativity",
    name: "Creativity",
    description: "Brings original ideas",
    image: "assets/7c-creativity.png"
  }
];

const DEMO_STUDENTS = [
  { id: "random1", name: "random1", username: "random1", houseId: "red-phoenix", grade: 9 },
  { id: "random2", name: "random2", username: "random2", houseId: "black-turtles", grade: 9 },
  { id: "random3", name: "random3", username: "random3", houseId: "green-dragons", grade: 10 },
  { id: "random4", name: "random4", username: "random4", houseId: "white-tigers", grade: 10 },
  { id: "random5", name: "random5", username: "random5", houseId: "red-phoenix", grade: 10 },
  { id: "random6", name: "random6", username: "random6", houseId: "black-turtles", grade: 11 },
  { id: "random7", name: "random7", username: "random7", houseId: "green-dragons", grade: 11 },
  { id: "random8", name: "random8", username: "random8", houseId: "white-tigers", grade: 11 },
  { id: "random9", name: "random9", username: "random9", houseId: "red-phoenix", grade: 12 },
  { id: "random10", name: "random10", username: "random10", houseId: "green-dragons", grade: 12 },
  { id: "random11", name: "random11", username: "random11", houseId: "white-tigers", grade: 12 }
];

function isRosterStudent(student) {
  return Boolean(
    student &&
      typeof student.id === "string" &&
      typeof student.name === "string" &&
      typeof student.username === "string" &&
      HOUSES.some((house) => house.id === student.houseId) &&
      Number.isInteger(student.grade) &&
      student.grade >= 1 &&
      student.grade <= 12
  );
}

function isRosterTeacher(teacher) {
  return Boolean(
    teacher &&
      typeof teacher.id === "string" &&
      typeof teacher.name === "string" &&
      typeof teacher.username === "string" &&
      TEACHER_ROLES.includes(teacher.role) &&
      (teacher.houseId === null || HOUSES.some((house) => house.id === teacher.houseId)) &&
      (teacher.role !== "house-leader" || teacher.houseId)
  );
}

async function loadLocalRoster() {
  if (typeof document === "undefined" || typeof window === "undefined") return null;
  if (window.location.hostname.endsWith(".vercel.app") || new URLSearchParams(window.location.search).has("cloud")) return null;
  for (const source of ["/api/roster", "./private/roster.json"]) {
    try {
      const response = await fetch(source, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) continue;
      const roster = await response.json();
      if (!Array.isArray(roster.students) || !roster.students.length) continue;
      if (!roster.students.every(isRosterStudent)) continue;
      if (roster.teachers && (!Array.isArray(roster.teachers) || !roster.teachers.every(isRosterTeacher))) {
        continue;
      }
      return {
        students: roster.students.map((student) => ({ ...student })),
        teachers:
          roster.teachers?.map((teacher) => ({
            ...teacher,
            // Earlier rosters used `house-leader` to mean any teacher affiliated
            // with a House. Status model 2 reserves it for actual teacher leaders.
            role:
              roster.staffStatusModel === 2 || teacher.role !== "house-leader"
                ? teacher.role
                : "teacher"
          })) ?? null
      };
    } catch {
      // Try the next private roster source, then fall back to fictional demo data.
    }
  }
  return null;
}

const LOCAL_ROSTER = await loadLocalRoster();

export const STUDENTS = LOCAL_ROSTER?.students ?? DEMO_STUDENTS;
export const TEACHERS = LOCAL_ROSTER?.teachers?.length ? LOCAL_ROSTER.teachers : DEMO_TEACHERS;
export const AVAILABLE_GRADES = [...new Set(STUDENTS.map((student) => student.grade))].sort(
  (a, b) => a - b
);

export function authenticateTeacher(username, password, teachers = TEACHERS) {
  const normalizedUsername = String(username ?? "").trim().toLowerCase();
  const normalizedPassword = String(password ?? "").trim().toLowerCase();
  const teacher = teachers.find(
    (account) => account.username?.toLowerCase() === normalizedUsername
  );

  if (!teacher || normalizedPassword !== normalizedUsername) {
    return null;
  }

  return { ...teacher };
}

export function authenticateUser(username, password, accountState = null) {
  const teachers = accountState?.teachers ?? TEACHERS;
  const students = accountState?.students ?? STUDENTS;
  const teacher = authenticateTeacher(username, password, teachers);
  if (teacher) return { type: "teacher", ...teacher };

  const normalizedUsername = String(username ?? "").trim().toLowerCase();
  const normalizedPassword = String(password ?? "").trim().toLowerCase();
  const student = students.find(
    (account) => account.username?.toLowerCase() === normalizedUsername
  );
  if (!student || normalizedPassword !== normalizedUsername) return null;
  return { type: "student", id: student.id, name: student.name, studentId: student.id };
}

export function buildAccountUsername(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function getUniqueUsername(state, name) {
  const base = buildAccountUsername(name);
  if (!base) throw new Error("Enter an account name");
  const usernames = new Set(
    [...state.students, ...(state.teachers ?? TEACHERS)].map((account) =>
      account.username.toLowerCase()
    )
  );
  if (!usernames.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (usernames.has(`${base}${suffix}`.toLowerCase())) suffix += 1;
  return `${base}${suffix}`;
}

function resolveTeacher(state, user) {
  if (user?.type !== "teacher") return null;
  return (state.teachers ?? TEACHERS).find((teacher) => teacher.id === user.id) ?? null;
}

export function getTeacherPermissions(teacher) {
  const role = teacher?.role ?? "teacher";
  return {
    canManageAccounts: role === "super-admin",
    canManageCalendarAccess: role === "super-admin",
    canCreateCalendarEvents: role === "super-admin" || isHouseLeaderTeacher(teacher),
    canEditAllCalendarEvents: role === "super-admin",
    canEditAllStudentRecords: role === "super-admin" || role === "teacher-supervising"
  };
}

export function isHouseLeaderTeacher(teacher) {
  return teacher?.role === "house-leader" || teacher?.houseLeader === true;
}

export function getTeacherLevelUpGrades(state, teacherId) {
  return Object.entries(state.leadershipAssignments?.levelUpTeachers ?? {}).filter(([, ids])=>ids.includes(teacherId)).map(([grade])=>Number(grade));
}

function normalizeRecordEditorIds(state, editorIds, authorId) {
  const teachers = state.teachers ?? TEACHERS;
  const knownTeacherIds = new Set(teachers.map((teacher) => teacher.id));
  return [...new Set(editorIds ?? [])].filter((teacherId) => {
    if (teacherId === authorId || !knownTeacherIds.has(teacherId)) return false;
    const teacher = teachers.find((item) => item.id === teacherId);
    return !getTeacherPermissions(teacher).canEditAllStudentRecords;
  });
}

export function canEditStudentRecord(state, teacherId, record) {
  const teacher = (state.teachers ?? TEACHERS).find((item) => item.id === teacherId);
  if (!teacher || !record) return false;
  return Boolean(
    record.teacherId === teacherId ||
      getTeacherPermissions(teacher).canEditAllStudentRecords ||
      (!(record.studentId && "points" in record) && record.editorIds?.includes(teacherId))
  );
}

function requireSuperAdmin(state, user) {
  const teacher = resolveTeacher(state, user);
  if (!getTeacherPermissions(teacher).canManageAccounts) {
    throw new Error("Only a super admin can manage accounts");
  }
  return teacher;
}

function hasUniqueAccounts(students, teachers) {
  const ids = [...students, ...teachers].map((account) => account.id);
  const usernames = [...students, ...teachers].map((account) => account.username.toLowerCase());
  return new Set(ids).size === ids.length && new Set(usernames).size === usernames.length;
}

export function createStudentAccount(state, user, { name, grade, houseId }) {
  requireSuperAdmin(state, user);
  const normalizedName = String(name ?? "").trim();
  const normalizedGrade = Number(grade);
  if (!normalizedName) throw new Error("Enter the student's name");
  if (!Number.isInteger(normalizedGrade) || normalizedGrade < 1 || normalizedGrade > 12) {
    throw new Error("Choose a grade from 1 to 12");
  }
  if (!HOUSES.some((house) => house.id === houseId)) throw new Error("Choose a house");
  const username = getUniqueUsername(state, normalizedName);
  const student = {
    id: `student-${username.toLowerCase()}`,
    name: normalizedName,
    username,
    houseId,
    grade: normalizedGrade
  };
  return { ...state, students: [...state.students, student] };
}

export function createTeacherAccount(state, user, { name, houseId = null, role = "teacher" }) {
  requireSuperAdmin(state, user);
  const normalizedName = String(name ?? "").trim();
  const normalizedHouseId = houseId || null;
  if (!normalizedName) throw new Error("Enter the teacher's name");
  if (!TEACHER_ROLES.includes(role)) throw new Error("Choose a valid teacher role");
  if (normalizedHouseId && !HOUSES.some((house) => house.id === normalizedHouseId)) {
    throw new Error("Choose a valid house");
  }
  if (role === "house-leader" && !normalizedHouseId) {
    throw new Error("A house leader must be assigned to a house");
  }
  const username = getUniqueUsername(state, normalizedName);
  const teacher = {
    id: `teacher-${username.toLowerCase()}`,
    name: normalizedName,
    username,
    houseId: normalizedHouseId,
    role
  };
  return { ...state, teachers: [...(state.teachers ?? TEACHERS), teacher] };
}

export function updateTeacherAccountStatus(
  state,
  user,
  teacherId,
  { role, houseId = null }
) {
  requireSuperAdmin(state, user);
  const teacher = (state.teachers ?? TEACHERS).find((item) => item.id === teacherId);
  const normalizedHouseId = houseId || null;
  if (!teacher) throw new Error("Unknown teacher");
  if (!TEACHER_ROLES.includes(role)) throw new Error("Choose a valid teacher status");
  if (normalizedHouseId && !HOUSES.some((house) => house.id === normalizedHouseId)) {
    throw new Error("Choose a valid house");
  }
  if (role === "house-leader" && !normalizedHouseId) {
    throw new Error("A leader teacher must be assigned to a house");
  }
  if (
    teacher.role === "super-admin" &&
    role !== "super-admin" &&
    (state.teachers ?? TEACHERS).filter((item) => item.role === "super-admin").length === 1
  ) {
    throw new Error("At least one super admin must remain");
  }
  return {
    ...state,
    teachers: (state.teachers ?? TEACHERS).map((item) =>
      item.id === teacherId ? { ...item, role, houseId: normalizedHouseId, houseLeader: role === "house-leader" || (["super-admin", "teacher-supervising"].includes(role) && item.houseLeader === true && item.houseId === normalizedHouseId) } : item
    )
  };
}

export function transferStudentHouse(state, user, studentId, houseId) {
  requireSuperAdmin(state, user);
  if (!HOUSES.some((house) => house.id === houseId)) throw new Error("Choose a valid house");
  const student = state.students.find((item) => item.id === studentId);
  if (!student) throw new Error("Unknown student");
  const houseLeaders = Object.fromEntries(
    HOUSES.map((house) => [
      house.id,
      (state.leadershipAssignments?.houseLeaders?.[house.id] ?? []).filter(
        (leaderId) => leaderId !== studentId
      )
    ])
  );
  return {
    ...state,
    students: state.students.map((item) =>
      item.id === studentId ? { ...item, houseId } : item
    ),
    leadershipAssignments: {
      ...(state.leadershipAssignments ?? {}),
      houseLeaders
    }
  };
}

const SEED_RECOGNITIONS = {
  random1: { contribution: 2, creativity: 1 },
  random2: { collaboration: 2, community: 1 },
  random3: { compassion: 1, "critical-thinking": 1 },
  random4: { communication: 2 },
  random5: { contribution: 1, collaboration: 1, compassion: 1 },
  random6: { "critical-thinking": 2, creativity: 1 },
  random7: { communication: 1, community: 2 },
  random8: { contribution: 1, community: 1, creativity: 1 },
  random9: { "critical-thinking": 1, communication: 1, community: 1, creativity: 1 },
  random10: { collaboration: 1, compassion: 1, "critical-thinking": 1 },
  random11: { communication: 1, community: 1 }
};

export function createInitialState(now = Date.now()) {
  const awards = [];
  let awardIndex = 0;

  for (const student of STUDENTS) {
    const recognitions = SEED_RECOGNITIONS[student.id] ?? {};

    for (const [valueId, count] of Object.entries(recognitions)) {
      for (let index = 0; index < count; index += 1) {
        awards.push({
          id: `seed-${awardIndex}`,
          studentId: student.id,
          valueId,
          teacherId: TEACHERS[awardIndex % TEACHERS.length].id,
          points: DEFAULT_POINTS,
          comment: "",
          createdAt: new Date(now - (awardIndex + 1) * 1000 * 60 * 42).toISOString()
        });
        awardIndex += 1;
      }
    }
  }

  return {
    version: 9,
    students: STUDENTS.map((student) => ({ ...student })),
    teachers: TEACHERS.map((teacher) => ({ ...teacher })),
    awards,
    behaviorConcerns: [],
    academicConcerns: [],
    selConcerns: [],
    selCheckIns: [],
    leadershipAssignments: {
      houseLeaders: Object.fromEntries(HOUSES.map((house) => [house.id, []])),
      labs: []
    },
    customCalendarEvents: [],
    calendarEventDetails: {}
  };
}

export function addAward(
  state,
  studentId,
  valueId,
  teacherId,
  points = DEFAULT_POINTS,
  now = Date.now(),
  comment = "",
  editorIds = []
) {
  if (!state.students.some((student) => student.id === studentId)) {
    throw new Error("Unknown student");
  }

  if (!VALUES.some((value) => value.id === valueId)) {
    throw new Error("Unknown HCAS value");
  }

  if (!(state.teachers ?? TEACHERS).some((teacher) => teacher.id === teacherId)) {
    throw new Error("Unknown teacher");
  }

  if (!POINT_OPTIONS.includes(points)) {
    throw new Error("Invalid point amount");
  }

  if (typeof comment !== "string" || comment.trim().length > MAX_COMMENT_LENGTH) {
    throw new Error("Invalid comment");
  }

  const normalizedComment = comment.trim();

  return {
    ...state,
    awards: [
      ...state.awards,
      {
        id: `award-${now}-${state.awards.length}`,
        studentId,
        valueId,
        teacherId,
        points,
        comment: normalizedComment,
        editorIds: [],
        createdAt: new Date(now).toISOString()
      }
    ]
  };
}

export function removeAward(state, awardId, teacherId) {
  if (!(state.teachers ?? TEACHERS).some((teacher) => teacher.id === teacherId)) {
    throw new Error("Unknown teacher");
  }

  const award = state.awards.find((item) => item.id === awardId);
  if (!award) {
    throw new Error("Unknown recognition");
  }

  if (!canEditStudentRecord(state, teacherId, award)) {
    throw new Error("You do not have permission to unsend this recognition");
  }

  return {
    ...state,
    awards: state.awards.filter((item) => item.id !== awardId)
  };
}

export function updateAward(state, awardId, teacherId, changes, now = Date.now()) {
  validateTeacher(state, teacherId);
  const award = state.awards.find((item) => item.id === awardId);
  if (!award) throw new Error("Unknown recognition");
  if (!canEditStudentRecord(state, teacherId, award)) {
    throw new Error("You do not have permission to edit this recognition");
  }
  if (award.sourceType === "behavior-concern") {
    throw new Error("Edit this deduction from its linked behavior concern");
  }
  const valueId = String(changes.valueId ?? award.valueId);
  const points = Number(changes.points ?? award.points);
  const comment = normalizeText(changes.comment ?? award.comment, MAX_COMMENT_LENGTH);
  if (!VALUES.some((value) => value.id === valueId)) throw new Error("Unknown HCAS value");
  if (!POINT_OPTIONS.includes(points)) throw new Error("Invalid point amount");
  return {
    ...state,
    awards: state.awards.map((item) =>
      item.id === awardId
        ? {
            ...item,
            valueId,
            points,
            comment,
            editorIds: [],
            updatedAt: new Date(now).toISOString(),
            updatedBy: teacherId
          }
        : item
    )
  };
}

export function getBehaviorCodeActions(state, studentIds, issueIds, occurrenceOverride = null) {
  const selectedOccurrence = [1, 2, 3].includes(Number(occurrenceOverride))
    ? Number(occurrenceOverride)
    : null;
  return studentIds.flatMap((studentId) =>
    issueIds.map((issueId) => {
      const issue = BEHAVIOR_ISSUES.find((item) => item.id === issueId);
      if (!issue) throw new Error("Unknown behavior issue");

      const previousCount = (state.behaviorConcerns ?? []).filter(
        (concern) =>
          concern.studentIds.includes(studentId) && concern.issueIds.includes(issueId)
      ).length;
      const occurrence = selectedOccurrence ?? previousCount + 1;
      const action =
        issue.level === 2
          ? LEVEL_TWO_ACTION
          : LEVEL_ONE_ACTIONS[Math.min(occurrence, 3)];

      return {
        studentId,
        issueId,
        level: issue.level,
        occurrence,
        label: action.label,
        description: action.description
      };
    })
  );
}

export function addBehaviorConcern(state, payload, now = Date.now()) {
  const { studentIds, title, description, teacherId, incidentDate } = normalizeConcernBase(
    state,
    payload,
    "Behavior"
  );
  const tier = Number(payload.tier);
  const issueIds = [...new Set(payload.issueIds ?? [])];
  const otherIssueSelected = payload.otherIssueSelected === true || payload.otherIssueSelected === "1";
  const additionalIssueDetails = normalizeText(
    payload.additionalIssueDetails ?? payload.otherIssue,
    MAX_CONCERN_DESCRIPTION_LENGTH
  );
  const occurrence = Number(payload.occurrence);
  const incidentTime = validateTimeInput(payload.incidentTime);
  const location = normalizeRequiredText(payload.location, 160, "Incident location");
  const otherLocation = normalizeText(payload.otherLocation, 160);

  if (![1, 2].includes(tier)) throw new Error("Choose behavior Tier 1 or Tier 2");
  if (![1, 2, 3].includes(occurrence)) throw new Error("Choose the occurrence");
  if (!issueIds.length && !otherIssueSelected) {
    throw new Error("Choose at least one behavior issue");
  }
  if (issueIds.some((issueId) => !BEHAVIOR_ISSUES.some((issue) => issue.id === issueId))) {
    throw new Error("Unknown behavior issue");
  }
  if (issueIds.some((issueId) => BEHAVIOR_ISSUES.find((issue) => issue.id === issueId).level !== tier)) {
    throw new Error("Choose issues from the selected behavior tier");
  }
  if (otherIssueSelected && !additionalIssueDetails) {
    throw new Error("Describe the issue not listed");
  }
  if (!BEHAVIOR_LOCATIONS.includes(location)) throw new Error("Choose an incident location");
  if (location === "Other location" && !otherLocation) throw new Error("Describe the other location");

  const strategies = normalizeStringList(payload.strategies, 220);
  const otherStrategy = normalizeText(payload.otherStrategy, MAX_CONCERN_DESCRIPTION_LENGTH);
  const customAction = normalizeText(payload.customAction, MAX_CONCERN_DESCRIPTION_LENGTH);
  const teacherActions = normalizeStringList(payload.teacherActions, 220);
  if (teacherActions.some((action) => !BEHAVIOR_RESPONSE_OPTIONS.includes(action))) {
    throw new Error("Unknown teacher response");
  }
  const confidentialNote = normalizeText(payload.confidentialNote, MAX_INTERNAL_NOTE_LENGTH);
  const attachment = normalizeAttachmentPayload(payload);
  const publishedAt = new Date(now).toISOString();
  const deductionPoints = Number(payload.deductionPoints ?? 0);
  const deductionValueIds = [...new Set(payload.deductionValueIds ?? (payload.deductionValueId ? [payload.deductionValueId] : []))];
  const deductionValueId = deductionValueIds[0] ?? "";
  if (deductionPoints && !POINT_OPTIONS.includes(deductionPoints)) {
    throw new Error("Choose a valid house-point deduction");
  }
  if (deductionPoints && (!deductionValueIds.length || deductionValueIds.some(id => !VALUES.some(value => value.id === id)))) {
    throw new Error("Choose the 7C connected to the point deduction");
  }

  const concern = {
    id: `behavior-${now}-${(state.behaviorConcerns ?? []).length}`,
    studentIds,
    tier,
    issueIds,
    otherIssueSelected,
    otherIssue: otherIssueSelected ? additionalIssueDetails : "",
    additionalIssueDetails,
    occurrence,
    title,
    description,
    strategies,
    otherStrategy,
    customAction,
    teacherActions,
    confidentialNote,
    teacherId,
    editorIds: normalizeRecordEditorIds(state, payload.editorIds, teacherId),
    incidentDate,
    incidentTime,
    location: location === "Other location" ? otherLocation : location,
    publishedAt,
    codeActions: getBehaviorCodeActions(state, studentIds, issueIds, occurrence),
    deduction: deductionPoints ? { valueId: deductionValueId, valueIds: deductionValueIds, points: deductionPoints } : null,
    ...attachment
  };


  const deductionAwards = deductionPoints
    ? studentIds.map((studentId, index) => ({
        id: `behavior-award-${now}-${index}-${(state.awards ?? []).length}`,
        studentId,
        valueId: deductionValueId,
        valueIds: deductionValueIds,
        teacherId,
        editorIds: normalizeRecordEditorIds(state, payload.editorIds, teacherId),
        points: -deductionPoints,
        comment: behaviorDeductionSentence(deductionPoints, state.students.find(s => s.id === studentId).name, deductionValueIds),
        sourceType: "behavior-concern",
        sourceConcernId: concern.id,
        createdAt: publishedAt
      }))
    : [];

  return {
    ...state,
    behaviorConcerns: [...(state.behaviorConcerns ?? []), concern],
    awards: [...state.awards, ...deductionAwards]
  };
}

export function addAcademicConcern(state, payload, now = Date.now()) {
  const { studentIds, title, description, teacherId, incidentDate } = normalizeConcernBase(
    state,
    payload,
    "Academic"
  );
  const tier = Number(payload.tier);
  const selectedIssues = normalizeStringList(payload.issueIds, 260);
  const issueIds = selectedIssues.filter(id => id !== "other");
  const otherIssue = normalizeText(payload.otherIssue, MAX_CONCERN_DESCRIPTION_LENGTH);
  const profileId = String(payload.profileId ?? "").trim();

  if (![1, 2, 3].includes(tier)) throw new Error("Choose an academic tier");
  if (selectedIssues.includes("other") && !otherIssue) throw new Error("Describe the academic issue");
  if (!issueIds.length && !otherIssue && !profileId) {
    throw new Error("Choose or describe an academic issue");
  }
  if (profileId && !ACADEMIC_PROFILES.some((profile) => profile.id === profileId)) {
    throw new Error("Unknown academic profile");
  }

  const concern = {
    id: `academic-${now}-${(state.academicConcerns ?? []).length}`,
    studentIds,
    tier,
    issueIds,
    otherIssue,
    profileId,
    title,
    description,
    strategies: normalizeStringList(payload.strategies, 260).map(strategy => strategy === "other" ? "Other" : strategy),
    otherStrategy: normalizeText(payload.otherStrategy, MAX_CONCERN_DESCRIPTION_LENGTH),
    actionDetails: normalizeRequiredText(
      payload.actionDetails,
      MAX_CONCERN_DESCRIPTION_LENGTH,
      "Academic action taken"
    ),
    internalNote: normalizeText(payload.internalNote, MAX_INTERNAL_NOTE_LENGTH),
    teacherId,
    editorIds: normalizeRecordEditorIds(state, payload.editorIds, teacherId),
    incidentDate,
    publishedAt: new Date(now).toISOString(),
    ...normalizeAttachmentPayload(payload)
  };

  return {
    ...state,
    academicConcerns: [...(state.academicConcerns ?? []), concern]
  };
}

export function addSelConcern(state, payload, now = Date.now()) {
  const { studentIds, title, description, teacherId, incidentDate } = normalizeConcernBase(
    state,
    payload,
    "SEL"
  );
  const concernIds = [...new Set(payload.concernIds ?? [])];
  if (!concernIds.length) throw new Error("Choose at least one SEL concern");
  if (concernIds.some((id) => !SEL_CONCERN_OPTIONS.some((option) => option.id === id))) {
    throw new Error("Unknown SEL concern");
  }
  const otherConcern = normalizeText(payload.otherConcern || (concernIds.includes("other") ? description : ""), MAX_CONCERN_DESCRIPTION_LENGTH);
  if (concernIds.includes("other") && !otherConcern) {
    throw new Error("Describe the other SEL concern");
  }
  const selectedOptions = concernIds.map((id) =>
    SEL_CONCERN_OPTIONS.find((option) => option.id === id)
  );
  const recommendedStrategies = [
    ...new Set(selectedOptions.flatMap((option) => option.strategies))
  ];
  const concern = {
    id: `sel-${now}-${(state.selConcerns ?? []).length}`,
    studentIds,
    concernIds,
    tier: Number(payload.tier) || Math.max(...selectedOptions.map(option => option.tier)),
    otherConcern,
    title,
    description,
    recommendedStrategies,
    followUp: normalizeText(payload.followUp, MAX_CONCERN_DESCRIPTION_LENGTH),
    confidentialNote: normalizeText(payload.confidentialNote, MAX_INTERNAL_NOTE_LENGTH),
    teacherId,
    editorIds: normalizeRecordEditorIds(state, payload.editorIds, teacherId),
    incidentDate,
    publishedAt: new Date(now).toISOString(),
    ...normalizeAttachmentPayload(payload)
  };
  return {
    ...state,
    selConcerns: [...(state.selConcerns ?? []), concern]
  };
}

export function updateConcern(state, type, concernId, teacherId, changes, now = Date.now()) {
  validateTeacher(state, teacherId);
  const collections = {
    behavior: "behaviorConcerns",
    academic: "academicConcerns",
    sel: "selConcerns"
  };
  const collectionName = collections[type];
  if (!collectionName) throw new Error("Unknown concern type");
  const concern = (state[collectionName] ?? []).find((item) => item.id === concernId);
  if (!concern) throw new Error("Unknown concern");
  if (!canEditStudentRecord(state, teacherId, concern)) {
    throw new Error("You do not have permission to edit this concern");
  }

  const updated = {
    ...concern,
    title: normalizeRequiredText(
      changes.title ?? concern.title,
      MAX_CONCERN_TITLE_LENGTH,
      "Concern title"
    ),
    description: normalizeRequiredText(
      changes.description ?? concern.description,
      MAX_CONCERN_DESCRIPTION_LENGTH,
      "Concern description"
    ),
    incidentDate: validateDateInput(changes.incidentDate ?? concern.incidentDate),
    editorIds: normalizeRecordEditorIds(
      state,
      changes.editorIds ?? concern.editorIds,
      concern.teacherId
    ),
    updatedAt: new Date(now).toISOString(),
    updatedBy: teacherId
  };

  if (type === "behavior") {
    updated.incidentTime = validateTimeInput(changes.incidentTime ?? concern.incidentTime ?? "13:15");
    updated.location = normalizeRequiredText(
      changes.location ?? concern.location ?? "Classroom",
      160,
      "Incident location"
    );
    updated.customAction = normalizeText(
      changes.customAction ?? concern.customAction,
      MAX_CONCERN_DESCRIPTION_LENGTH
    );
    updated.confidentialNote = normalizeText(
      changes.confidentialNote ?? concern.confidentialNote,
      MAX_INTERNAL_NOTE_LENGTH
    );
  } else if (type === "academic") {
    updated.actionDetails = normalizeRequiredText(
      changes.actionDetails ?? concern.actionDetails,
      MAX_CONCERN_DESCRIPTION_LENGTH,
      "Academic action taken"
    );
    updated.internalNote = normalizeText(
      changes.internalNote ?? concern.internalNote,
      MAX_INTERNAL_NOTE_LENGTH
    );
  } else {
    updated.followUp = normalizeText(
      changes.followUp ?? concern.followUp,
      MAX_CONCERN_DESCRIPTION_LENGTH
    );
    updated.confidentialNote = normalizeText(
      changes.confidentialNote ?? concern.confidentialNote,
      MAX_INTERNAL_NOTE_LENGTH
    );
  }

  const nextState = {
    ...state,
    [collectionName]: state[collectionName].map((item) =>
      item.id === concernId ? updated : item
    )
  };
  if (type !== "behavior") return nextState;
  return {
    ...nextState,
    awards: state.awards.map((award) =>
      award.sourceConcernId === concernId
        ? { ...award, editorIds: updated.editorIds, updatedAt: updated.updatedAt, updatedBy: teacherId }
        : award
    )
  };
}

export function addSelCheckIn(state, user, payload, now = Date.now()) {
  if (user?.type !== "student") throw new Error("Only a student can submit this check-in");
  const student = state.students.find((item) => item.id === user.studentId);
  if (!student) throw new Error("Unknown student");
  const rating = Number(payload.rating);
  if (![1, 2, 3, 4, 5].includes(rating)) throw new Error("Choose how you feel today");
  const reflection = normalizeRequiredText(payload.reflection, 500, "Daily reflection");
  const date = toLocalDateKey(new Date(now).toISOString());
  const checkIn = {
    id: `sel-check-in-${student.id}-${date}`,
    studentId: student.id,
    date,
    rating,
    reflection,
    publishedAt: new Date(now).toISOString()
  };
  return {
    ...state,
    selCheckIns: [
      ...(state.selCheckIns ?? []).filter(
        (item) => !(item.studentId === student.id && item.date === date)
      ),
      checkIn
    ]
  };
}

export function getStudentBehaviorConcerns(state, studentId) {
  return (state.behaviorConcerns ?? [])
    .filter((concern) => concern.studentIds.includes(studentId))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

export function getStudentAcademicConcerns(state, studentId) {
  return (state.academicConcerns ?? [])
    .filter((concern) => concern.studentIds.includes(studentId))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

export function getStudentSelConcerns(state, studentId) {
  return (state.selConcerns ?? [])
    .filter((concern) => concern.studentIds.includes(studentId))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

export function getStudentSelCheckIns(state, studentId) {
  return (state.selCheckIns ?? [])
    .filter((checkIn) => checkIn.studentId === studentId)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

export function getHouseTotals(state) {
  if (state.houseTotals) return state.houseTotals;
  const totals = Object.fromEntries(HOUSES.map((house) => [house.id, 0]));
  const studentHouse = Object.fromEntries(state.students.map((student) => [student.id, student.houseId]));

  for (const award of state.awards) {
    const houseId = studentHouse[award.studentId];
    if (houseId in totals) {
      totals[houseId] += award.points;
    }
  }

  return totals;
}

export function getHouseLeaders(state, houseId, limit = 3) {
  return state.students
    .filter((student) => student.houseId === houseId)
    .map((student) => ({ ...student, points: getStudentTotal(state, student.id) }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    )
    .slice(0, limit);
}

export function getAwardValueIds(award) {
  return Array.isArray(award.valueIds) && award.valueIds.length ? award.valueIds : [award.valueId];
}
export function behaviorDeductionSentence(points, studentName, valueIds) {
  return `${points} points are taken from ${studentName} for lack of ${valueIds.map(id => VALUES.find(v => v.id === id)?.name).filter(Boolean).join(", ")}.`;
}

const schoolDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" });
const matchesHouseFilters = (item, { valueIds = [], from = "", to = "" }) =>
  (!valueIds.length || getAwardValueIds(item).some(id => valueIds.includes(id))) && (!from || item.date >= from) && (!to || item.date <= to);

export function getHouseCoinSummary(state) {
  const studentHouses = new Map(state.students.map(s => [s.id, s.houseId]));
  const summary = new Map();
  for (const award of state.awards) {
    const houseId = studentHouses.get(award.studentId);
    if (!HOUSES.some(h => h.id === houseId)) continue;
    const date = schoolDay.format(new Date(award.createdAt));
    const valueIds = getAwardValueIds(award);
    const key = `${houseId}:${date}:${[...valueIds].sort().join(",")}`;
    const entry = summary.get(key) ?? { houseId, date, valueId: award.valueId, ...(valueIds.length > 1 ? { valueIds } : {}), points: 0 };
    entry.points += award.points;
    summary.set(key, entry);
  }
  return [...summary.values()];
}

export function getHouseRanking(state, filters = {}) {
  const totals = Object.fromEntries(HOUSES.map(h => [h.id, 0]));
  for (const item of state.houseCoinSummary ?? getHouseCoinSummary(state)) {
    if (matchesHouseFilters(item, filters) && item.houseId in totals) totals[item.houseId] += item.points;
  }
  const filteredState = { ...state, awards: state.awards.filter(a => matchesHouseFilters({ ...a, date: schoolDay.format(new Date(a.createdAt)) }, filters)) };
  return HOUSES.map(house => ({ ...house, points: totals[house.id], leaders: getHouseLeaders(filteredState, house.id), members: state.students.filter(s => s.houseId === house.id).length }))
    .sort((a, b) => b.points - a.points);
}

export function getStudentStats(state, studentId) {
  return getValueStats(state.awards.filter((award) => award.studentId === studentId));
}

export function getStudentAwards(state, studentId, valueId = null) {
  return state.awards
    .filter(
      (award) =>
        award.studentId === studentId && (!valueId || getAwardValueIds(award).includes(valueId))
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getTeacherStats(state, teacherId) {
  return getValueStats(state.awards.filter((award) => award.teacherId === teacherId));
}

export function getTeacherAwards(state, teacherId) {
  return state.awards
    .filter((award) => award.teacherId === teacherId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getValueStats(awards) {
  const stats = Object.fromEntries(
    VALUES.map((value) => [value.id, { recognitions: 0, points: 0 }])
  );

  for (const award of awards) {
    for (const id of getAwardValueIds(award)) if (stats[id]) {
      stats[id].recognitions += 1;
      stats[id].points += award.points;
    }
  }

  return stats;
}

export function getStudentTotal(state, studentId) {
  return state.awards
    .filter((award) => award.studentId === studentId)
    .reduce((total, award) => total + award.points, 0);
}

export function getStudentRanking(
  state,
  { valueId = "all", grade = "all", dateFrom = "", dateTo = "" } = {}
) {
  return state.students
    .filter((student) => grade === "all" || String(student.grade) === String(grade))
    .map((student) => {
      const awards = state.awards.filter(
        (award) =>
          award.studentId === student.id &&
          (valueId === "all" || getAwardValueIds(award).includes(valueId)) &&
          (!dateFrom || toLocalDateKey(award.createdAt) >= dateFrom) &&
          (!dateTo || toLocalDateKey(award.createdAt) <= dateTo)
      );
      return {
        ...student,
        points: awards.reduce((total, award) => total + award.points, 0),
        recognitions: awards.length
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.recognitions - a.recognitions ||
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
}

export function setHouseLeader(state, houseId, studentId, enabled = true) {
  const student = state.students.find((item) => item.id === studentId);
  if (!HOUSES.some((house) => house.id === houseId) || !student || student.houseId !== houseId) {
    throw new Error("House leaders must be students in the selected house");
  }
  const houseLeaders = { ...(state.leadershipAssignments?.houseLeaders ?? {}) };
  const current = new Set(houseLeaders[houseId] ?? []);
  if (enabled) current.add(studentId);
  else current.delete(studentId);
  houseLeaders[houseId] = [...current];
  return {
    ...state,
    leadershipAssignments: {
      ...(state.leadershipAssignments ?? {}),
      houseLeaders
    }
  };
}

export function addLabAssignment(
  state,
  {
    name,
    weekday,
    location = "",
    leaderIds = [],
    teacherIds = [],
    grades = [6, 7, 8, 9, 10]
  },
  now = Date.now()
) {
  const normalizedName = String(name ?? "").trim();
  const normalizedLocation = String(location ?? "").trim();
  const normalizedWeekday = Number(weekday);
  const normalizedGrades = [...new Set(grades.map(Number))].filter((grade) => grade >= 1 && grade <= 12);
  const normalizedLeaders = [...new Set(leaderIds)].filter((studentId) =>
    state.students.some((student) => student.id === studentId)
  );
  const normalizedTeachers = [...new Set(teacherIds)].filter((teacherId) =>
    (state.teachers ?? TEACHERS).some((teacher) => teacher.id === teacherId)
  );
  if (!normalizedName || ![1, 2, 3, 4, 5].includes(normalizedWeekday)) {
    throw new Error("Enter a lab name and meeting day");
  }
  const lab = {
    id: `lab-${now}-${(state.leadershipAssignments?.labs ?? []).length}`,
    name: normalizedName,
    weekday: normalizedWeekday,
    location: normalizedLocation,
    leaderIds: normalizedLeaders,
    teacherIds: normalizedTeachers,
    grades: normalizedGrades.length ? normalizedGrades : [6, 7, 8, 9, 10]
  };
  return {
    ...state,
    leadershipAssignments: {
      ...(state.leadershipAssignments ?? {}),
      labs: [...(state.leadershipAssignments?.labs ?? []), lab]
    }
  };
}

export function removeLabAssignment(state, labId) {
  return {
    ...state,
    leadershipAssignments: {
      ...(state.leadershipAssignments ?? {}),
      labs: (state.leadershipAssignments?.labs ?? []).filter((lab) => lab.id !== labId)
    }
  };
}

export function canCreateCalendarEvent(
  state,
  user,
  { type = "school", houseIds = [], labId = "", grades = [] } = {}
) {
  const teacher = resolveTeacher(state, user);
  if (!teacher) return false;
  const permissions = getTeacherPermissions(teacher);
  if (permissions.canEditAllCalendarEvents) return true;
  const canCreateHouseEvent = Boolean(
    permissions.canCreateCalendarEvents &&
      type === "house" &&
      teacher.houseId &&
      houseIds.length === 1 &&
      houseIds[0] === teacher.houseId
  );
  const canCreateLabEvent = Boolean(
    type === "lab" &&
      labId &&
      (state.leadershipAssignments?.labs ?? [])
        .find((lab) => lab.id === labId)
        ?.teacherIds?.includes(teacher.id)
  );
  const assignedGrades = getTeacherLevelUpGrades(state, teacher.id);
  const canCreateLevelUpEvent = type === "level-up" && grades.length > 0 && grades.every(grade=>assignedGrades.includes(Number(grade)));
  return canCreateHouseEvent || canCreateLabEvent || canCreateLevelUpEvent;
}

export function addCustomCalendarEvent(
  state,
  user,
  {
    date,
    title,
    type = "school",
    grades = [],
    houseIds = [],
    labId = "",
    location = "",
    description = "",
    startTime = "13:15",
    endTime = "14:05"
  },
  now = Date.now()
) {
  const normalizedTitle = String(title ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !normalizedTitle) {
    throw new Error("Enter an event date and title");
  }
  const normalizedType = ["school", "house", "lab", "level-up", "assembly", "closure"].includes(type)
    ? type
    : "school";
  const normalizedHouseIds = [...new Set(houseIds)].filter((houseId) =>
    HOUSES.some((house) => house.id === houseId)
  );
  const normalizedLabId = String(labId ?? "").trim();
  const normalizedGrades = [...new Set(grades.map(Number))].filter((grade) => grade >= 1 && grade <= 12);
  if (!canCreateCalendarEvent(state, user, {
    type: normalizedType,
    houseIds: normalizedHouseIds,
    labId: normalizedLabId,
    grades: normalizedGrades
  })) {
    throw new Error("You cannot publish this calendar event");
  }
  const normalizedStartTime = validateTimeInput(startTime);
  const normalizedEndTime = validateTimeInput(endTime);
  if (normalizedEndTime <= normalizedStartTime) throw new Error("End time must be after start time");
  const event = {
    id: `custom-${now}-${(state.customCalendarEvents ?? []).length}`,
    date,
    title: normalizedTitle,
    type: normalizedType,
    grades: normalizedGrades,
    houseIds: normalizedHouseIds,
    labId: normalizedType === "lab" ? normalizedLabId : "",
    location: String(location ?? "").trim(),
    description: String(description ?? "").trim(),
    startTime: normalizedStartTime,
    endTime: normalizedEndTime,
    source: user.name,
    createdBy: user.id,
    createdAt: new Date(now).toISOString()
  };
  return { ...state, customCalendarEvents: [...(state.customCalendarEvents ?? []), event] };
}

export function canEditCalendarEvent(state, user, event) {
  if (!user || !event) return false;
  if (user.type === "teacher") {
    const teacher = resolveTeacher(state, user);
    if (!teacher) return false;
    const permissions = getTeacherPermissions(teacher);
    if (permissions.canEditAllCalendarEvents) return true;
    if (event.type === "level-up" || event.program === "level-up") {
      const grades = event.levelUpGrade ? [event.levelUpGrade] : event.grades ?? [];
      const assigned = getTeacherLevelUpGrades(state, teacher.id);
      return grades.length > 0 && grades.every(grade=>assigned.includes(Number(grade)));
    }
    if (event.meetingId && state.leadershipAssignments?.captainsMeeting?.id === event.meetingId) return state.leadershipAssignments.captainsMeeting.teacherIds.includes(teacher.id);
    if (
      isHouseLeaderTeacher(teacher) &&
      teacher.houseId &&
      event.type === "house" &&
      (event.houseId === teacher.houseId || event.houseIds?.includes(teacher.houseId))
    ) {
      return true;
    }
    if (event.type === "lab" && event.labId) {
      return Boolean(
        (state.leadershipAssignments?.labs ?? [])
          .find((lab) => lab.id === event.labId)
          ?.teacherIds?.includes(teacher.id)
      );
    }
    return false;
  }
  const student = state.students.find((item) => item.id === user.studentId);
  if (!student) return false;
  if (event.type === "house") {
    return Boolean((event.houseId === student.houseId || event.houseIds?.includes(student.houseId)) && (state.leadershipAssignments?.houseLeaders?.[student.houseId] ?? []).includes(student.id));
  }
  if (event.type === "lab" && event.labId) {
    return (state.leadershipAssignments?.labs ?? [])
      .find((lab) => lab.id === event.labId)
      ?.leaderIds.includes(student.id) ?? false;
  }
  return false;
}

export function updateCalendarEventDetails(state, user, event, details) {
  if (!canEditCalendarEvent(state, user, event)) throw new Error("You cannot edit this event");
  const normalized = {
    description: String(details.description ?? "").trim().slice(0, 1200),
    location: String(details.location ?? "").trim().slice(0, 160),
    startTime: validateTimeInput(details.startTime ?? event.startTime ?? "13:15"),
    endTime: validateTimeInput(details.endTime ?? event.endTime ?? "14:05"),
    resourceUrl: String(details.resourceUrl ?? "").trim().slice(0, 500),
    attachmentName: String(details.attachmentName ?? "").trim().slice(0, 180),
    attachmentData: String(details.attachmentData ?? "").slice(0, 1_100_000),
    updatedAt: new Date().toISOString(),
    updatedBy: user.name
  };
  if (normalized.endTime <= normalized.startTime) {
    throw new Error("End time must be after start time");
  }
  return {
    ...state,
    calendarEventDetails: {
      ...(state.calendarEventDetails ?? {}),
      [event.id]: normalized
    }
  };
}

function mergeCalendarDetails(state, event) {
  const details = state.calendarEventDetails?.[event.id] ?? state.calendarEventDetails?.[event.parentId] ?? {};
  return {
    startTime: "13:15",
    endTime: "14:05",
    ...event,
    ...details,
    baseTitle: event.title
  };
}

function getDateWeekday(date) {
  return new Date(`${date}T12:00:00`).getDay();
}

export function isStudentInLab(lab, studentId) {
  return lab.leaderIds?.includes(studentId) || lab.memberIds?.includes(studentId) || false;
}

function isRegularLabSlot(event) {
  return event.type === "lab" && /^(lab(?: w g5)?|(?:monday|wednesday|thursday) labs)$/i.test(event.title.trim());
}

function labAppliesOn(lab, date) {
  return (!lab.startDate || date >= lab.startDate) && (!lab.endDate || date <= lab.endDate);
}

export function getCalendarEvents(
  state,
  { user, startDate = "2026-08-01", endDate = "2027-06-01", teacherGrade = "all" } = {}
) {
  const baseEvents = [...OFFICIAL_CALENDAR_EVENTS, ...(state.customCalendarEvents ?? [])].filter(
    (event) => event.date >= startDate && event.date <= endDate
  );
  const student = user?.type === "student"
    ? state.students.find((item) => item.id === user.studentId)
    : null;
  const result = [];

  for (const baseEvent of baseEvents) {
    const regularLab = isRegularLabSlot(baseEvent);
    const slotWeekday = /^Monday Labs$/i.test(baseEvent.title) ? 1 : /^Wednesday Labs$/i.test(baseEvent.title) ? 3 : /^Thursday Labs$/i.test(baseEvent.title) ? 4 : getDateWeekday(baseEvent.date);
    const labs = regularLab ? (state.leadershipAssignments?.labs ?? []).filter(lab => lab.weekday === slotWeekday && labAppliesOn(lab, baseEvent.date)) : [];
    const assignedLabs = student ? labs.filter(lab => isStudentInLab(lab, student.id)) : labs;
    if (user?.type === "teacher" && teacherGrade !== "all" && baseEvent.grades?.length && !baseEvent.grades.includes(Number(teacherGrade)) && !labs.some(l => l.leaderIds.some(id => state.students.some(s => s.id === id && s.grade === Number(teacherGrade))))) continue;
    if (student && baseEvent.grades?.length && !baseEvent.grades.includes(student.grade) && !assignedLabs.length && !(baseEvent.labId && isStudentInLab((state.leadershipAssignments?.labs ?? []).find(l => l.id === baseEvent.labId) ?? {}, student.id))) continue;
    if (student && baseEvent.houseIds?.length && !baseEvent.houseIds.includes(student.houseId)) continue;

    const levelUp = baseEvent.type === "level-up" || (baseEvent.source === "2026–27 Dalton Lab Calendar (G6–12)" && getDateWeekday(baseEvent.date) === 2 && baseEvent.type === "school" && baseEvent.grades?.length < 7 && !/college counselling|mastery/i.test(baseEvent.title));
    if (levelUp && state.leadershipAssignments?.levelUpTeachers) {
      const grades = (student ? [student.grade] : baseEvent.grades?.length ? baseEvent.grades : [6,7,8,9,10,11,12]).filter(grade=>teacherGrade === "all" || grade === Number(teacherGrade));
      for (const grade of grades) result.push(mergeCalendarDetails(state, { ...baseEvent, id:`${baseEvent.id}::level-up-g${grade}`, parentId:baseEvent.id, type:"level-up", program:"level-up", levelUpGrade:grade, grades:[grade], teacherIds:state.leadershipAssignments.levelUpTeachers[grade] ?? [] }));
      continue;
    }

    if (baseEvent.type === "house") {
      const houses = student ? [student.houseId] : baseEvent.houseIds?.length ? baseEvent.houseIds : HOUSES.map((house) => house.id);
      houses.forEach((houseId) => {
        const house = HOUSES.find((item) => item.id === houseId);
        const embeddedLocation = baseEvent.title.includes(" · ") ? baseEvent.title.split(" · ").at(-1) : "";
        const event = { ...baseEvent, id: `${baseEvent.id}::${houseId}`, houseId, location: baseEvent.location || embeddedLocation || state.houseMeetingLocations?.[houseId] || "", title: `${baseEvent.title} · ${house.name}` };
        result.push(mergeCalendarDetails(state, event));
      });
      continue;
    }

    if (baseEvent.type === "lab") {
      if (baseEvent.labId) {
        const lab = (state.leadershipAssignments?.labs ?? []).find(l => l.id === baseEvent.labId);
        if (student && !isStudentInLab(lab ?? {}, student.id)) continue;
        result.push(mergeCalendarDetails(state, baseEvent));
        continue;
      }
      if (regularLab && labs.length && (user?.type === "teacher" || student)) {
        const visibleLabs = assignedLabs.filter(lab => student || teacherGrade === "all" || lab.grades.includes(Number(teacherGrade)) || lab.leaderIds.some(id => state.students.some(s => s.id === id && s.grade === Number(teacherGrade))));
        visibleLabs.forEach((lab) => {
          const event = {
            ...baseEvent,
            id: `${baseEvent.id}::${lab.id}`,
            labId: lab.id,
            title: lab.name,
            location: lab.location || baseEvent.location,
            description: lab.description ?? "",
            source: lab.source ?? baseEvent.source,
            createdBy: lab.createdBy ?? lab.teacherIds?.[0],
            teacherIds: lab.teacherIds,
            leaderIds: lab.leaderIds
          };
          result.push(mergeCalendarDetails(state, event));
        });
        if (visibleLabs.length) continue;
      }
    }

    result.push(mergeCalendarDetails(state, baseEvent));
  }

  const meeting = state.leadershipAssignments?.captainsMeeting;
  if (meeting) {
    const captainIds = [...new Set(Object.values(state.leadershipAssignments.houseLeaders ?? {}).flat())];
    const dates = [...new Set(baseEvents.filter(e => isRegularLabSlot(e) && getDateWeekday(e.date) === meeting.weekday && labAppliesOn(meeting, e.date)).map(e => e.date))];
    if (!student || captainIds.includes(student.id)) for (const date of dates) result.push(mergeCalendarDetails(state, {
      id: `${meeting.id}::${date}`, meetingId: meeting.id, date, type: "school", title: meeting.title,
      location: meeting.location, teacherIds: meeting.teacherIds, leaderIds: captainIds,
      description: "Weekly meeting for House Captains and the staff responsible for Houses.", source: "S1 LAB LIST 2026–2027"
    }));
  }

  return result.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function isValidStoredState(state) {
  const baseStudentIds = new Set(STUDENTS.map((student) => student.id));
  const baseTeacherIds = new Set(TEACHERS.map((teacher) => teacher.id));
  return Boolean(
    state &&
      state.version === 9 &&
      Array.isArray(state.students) &&
      state.students.length >= STUDENTS.length &&
      Array.isArray(state.teachers) &&
      state.teachers.length >= TEACHERS.length &&
      Array.isArray(state.awards) &&
      Array.isArray(state.behaviorConcerns) &&
      Array.isArray(state.academicConcerns) &&
      Array.isArray(state.selConcerns) &&
      Array.isArray(state.selCheckIns) &&
      state.leadershipAssignments &&
      Array.isArray(state.leadershipAssignments.labs) &&
      Array.isArray(state.customCalendarEvents) &&
      state.calendarEventDetails &&
      state.students.every(isRosterStudent) &&
      state.teachers.every(isRosterTeacher) &&
      [...baseStudentIds].every((id) => state.students.some((student) => student.id === id)) &&
      [...baseTeacherIds].every((id) => state.teachers.some((teacher) => teacher.id === id)) &&
      hasUniqueAccounts(state.students, state.teachers) &&
      state.awards.every((award) => isValidAward(award, state.students, state.teachers)) &&
      state.behaviorConcerns.every((concern) => isValidBehaviorConcern(concern, state.students, state.teachers)) &&
      state.academicConcerns.every((concern) => isValidAcademicConcern(concern, state.students, state.teachers)) &&
      state.selConcerns.every((concern) => isValidSelConcern(concern, state.students, state.teachers)) &&
      state.selCheckIns.every((checkIn) => isValidSelCheckIn(checkIn, state.students))
  );
}

export function migrateStoredState(state) {
  if (isValidStoredState(state)) {
    return state;
  }

  if (!state || ![2, 3, 4, 5, 6, 7, 8].includes(state.version) || !Array.isArray(state.students) || !Array.isArray(state.awards)) {
    return null;
  }

  const legacyTeachers = state.teachers ?? TEACHERS;
  if (!state.awards.every((award) => isValidAward(award, state.students, legacyTeachers))) return null;

  const rosterMatches = state.students.every((student) =>
    STUDENTS.some((knownStudent) => knownStudent.id === student.id)
  );
  const validStudentIds = new Set(STUDENTS.map((student) => student.id));
  const awards = rosterMatches
    ? state.awards.filter((award) => validStudentIds.has(award.studentId))
    : [];
  const behaviorConcerns = rosterMatches
    ? (state.behaviorConcerns ?? []).filter((concern) => concern.studentIds?.every((id) => validStudentIds.has(id)))
    : [];
  const academicConcerns = rosterMatches
    ? (state.academicConcerns ?? []).filter((concern) => concern.studentIds?.every((id) => validStudentIds.has(id)))
    : [];
  const baseTeacherIds = new Set(TEACHERS.map((teacher) => teacher.id));
  const migratedTeachers = [
    ...TEACHERS.map((teacher) => ({ ...teacher })),
    ...legacyTeachers
      .filter((teacher) => !baseTeacherIds.has(teacher.id))
      .map((teacher) => ({ ...teacher }))
  ];

  return {
    version: 9,
    students: STUDENTS.map((student) => ({ ...student })),
    teachers: migratedTeachers,
    awards: awards.map((award) => ({ ...award, editorIds: award.editorIds ?? [] })),
    behaviorConcerns: behaviorConcerns.map((concern) => ({
      ...concern,
      editorIds: concern.editorIds ?? []
    })),
    academicConcerns: academicConcerns.map((concern) => ({
      ...concern,
      editorIds: concern.editorIds ?? []
    })),
    selConcerns: (state.selConcerns ?? []).map((concern) => ({
      ...concern,
      editorIds: concern.editorIds ?? []
    })),
    selCheckIns: state.selCheckIns ?? [],
    leadershipAssignments: state.leadershipAssignments ?? {
      houseLeaders: Object.fromEntries(HOUSES.map((house) => [house.id, []])),
      labs: []
    },
    customCalendarEvents: state.customCalendarEvents ?? [],
    calendarEventDetails: state.calendarEventDetails ?? {}
  };
}

function isValidAward(award, students, teachers) {
  return Boolean(
    award &&
      students.some((student) => student.id === award.studentId) &&
      VALUES.some((value) => value.id === award.valueId) &&
      teachers.some((teacher) => teacher.id === award.teacherId) &&
      (POINT_OPTIONS.includes(award.points) || POINT_OPTIONS.includes(-award.points)) &&
      (award.comment === undefined ||
        (typeof award.comment === "string" && award.comment.length <= MAX_COMMENT_LENGTH)) &&
      isValidEditorIds(award.editorIds, teachers) &&
      !Number.isNaN(new Date(award.createdAt).getTime())
  );
}

function isValidBehaviorConcern(concern, students, teachers) {
  return Boolean(
    concern &&
      concern.studentIds?.length &&
      concern.studentIds.every((studentId) => students.some((student) => student.id === studentId)) &&
      concern.issueIds?.every((issueId) => BEHAVIOR_ISSUES.some((issue) => issue.id === issueId)) &&
      typeof concern.title === "string" &&
      typeof concern.description === "string" &&
      teachers.some((teacher) => teacher.id === concern.teacherId) &&
      isValidEditorIds(concern.editorIds, teachers) &&
      !Number.isNaN(new Date(concern.incidentDate).getTime()) &&
      !Number.isNaN(new Date(concern.publishedAt).getTime())
  );
}

function isValidAcademicConcern(concern, students, teachers) {
  return Boolean(
    concern &&
      concern.studentIds?.length &&
      concern.studentIds.every((studentId) => students.some((student) => student.id === studentId)) &&
      [1, 2, 3].includes(concern.tier) &&
      typeof concern.title === "string" &&
      typeof concern.description === "string" &&
      typeof concern.actionDetails === "string" &&
      teachers.some((teacher) => teacher.id === concern.teacherId) &&
      isValidEditorIds(concern.editorIds, teachers) &&
      !Number.isNaN(new Date(concern.incidentDate).getTime()) &&
      !Number.isNaN(new Date(concern.publishedAt).getTime())
  );
}

function isValidSelConcern(concern, students, teachers) {
  return Boolean(
    concern &&
      concern.studentIds?.length &&
      concern.studentIds.every((studentId) => students.some((student) => student.id === studentId)) &&
      concern.concernIds?.every((id) => SEL_CONCERN_OPTIONS.some((option) => option.id === id)) &&
      typeof concern.title === "string" &&
      typeof concern.description === "string" &&
      teachers.some((teacher) => teacher.id === concern.teacherId) &&
      isValidEditorIds(concern.editorIds, teachers) &&
      !Number.isNaN(new Date(concern.incidentDate).getTime()) &&
      !Number.isNaN(new Date(concern.publishedAt).getTime())
  );
}

function isValidEditorIds(editorIds, teachers) {
  return Boolean(
    editorIds === undefined ||
      (Array.isArray(editorIds) &&
        new Set(editorIds).size === editorIds.length &&
        editorIds.every((teacherId) => teachers.some((teacher) => teacher.id === teacherId)))
  );
}

function isValidSelCheckIn(checkIn, students) {
  return Boolean(
    checkIn &&
      students.some((student) => student.id === checkIn.studentId) &&
      /^\d{4}-\d{2}-\d{2}$/.test(checkIn.date) &&
      [1, 2, 3, 4, 5].includes(checkIn.rating) &&
      typeof checkIn.reflection === "string" &&
      checkIn.reflection.length <= 500 &&
      !Number.isNaN(new Date(checkIn.publishedAt).getTime())
  );
}

function normalizeAttachmentPayload(payload) {
  const normalizeFile = (name, data) => {
    name = normalizeText(name, 180);
    data = String(data ?? "");
    if (data.length > MAX_ATTACHMENT_DATA_LENGTH) throw new Error("Attachment is too large");
    if (Boolean(name) !== Boolean(data)) throw new Error("Attachment is incomplete");
    if (data && !/\.(pdf|doc|docx|ppt|pptx|jpg|jpeg|png)$/i.test(name)) throw new Error("Choose a PDF, Office document or JPG/PNG attachment");
    if (data && !/^data:(?:application\/(?:pdf|msword|vnd\.[a-z0-9.+-]+|octet-stream)|image\/(?:png|jpeg));base64,[A-Za-z0-9+/]*={0,2}$/i.test(data)) throw new Error("Choose a PDF, Office document or JPG/PNG attachment");
    return { name, data };
  };
  const record = normalizeFile(payload.attachmentName, payload.attachmentData);
  const confidential = normalizeFile(payload.confidentialAttachmentName, payload.confidentialAttachmentData);
  return {
    attachmentName: record.name, attachmentData: record.data,
    attachmentVisibility: payload.attachmentVisibility === "confidential" ? "confidential" : "record",
    confidentialAttachmentName: confidential.name, confidentialAttachmentData: confidential.data
  };
}

function normalizeStudentIds(state, studentIds) {
  const normalized = [...new Set(studentIds ?? [])];
  if (!normalized.length) throw new Error("Choose at least one student");
  if (normalized.some((studentId) => !state.students.some((student) => student.id === studentId))) {
    throw new Error("Unknown student");
  }
  return normalized;
}

function normalizeConcernBase(state, payload, concernType) {
  return {
    studentIds: normalizeStudentIds(state, payload.studentIds),
    title: normalizeRequiredText(
      payload.title,
      MAX_CONCERN_TITLE_LENGTH,
      `${concernType} concern title`
    ),
    description: normalizeRequiredText(
      payload.description,
      MAX_CONCERN_DESCRIPTION_LENGTH,
      `${concernType} concern description`
    ),
    teacherId: validateTeacher(state, payload.teacherId),
    incidentDate: validateDateInput(payload.incidentDate)
  };
}

function validateTeacher(state, teacherId) {
  if (!(state.teachers ?? TEACHERS).some((teacher) => teacher.id === teacherId)) {
    throw new Error("Unknown teacher");
  }
  return teacherId;
}

function validateDateInput(date) {
  const normalized = String(date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(new Date(`${normalized}T00:00:00`).getTime())) {
    throw new Error("Invalid concern date");
  }
  return normalized;
}

function validateTimeInput(time) {
  const normalized = String(time ?? "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    throw new Error("Invalid incident time");
  }
  return normalized;
}

function normalizeRequiredText(value, maxLength, label) {
  const normalized = normalizeText(value, maxLength);
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function normalizeText(value, maxLength) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maxLength) throw new Error("Text is too long");
  return normalized;
}

function normalizeStringList(values, maxItemLength) {
  const normalized = [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
  if (normalized.some((value) => value.length > maxItemLength)) {
    throw new Error("Selection text is too long");
  }
  return normalized;
}

function toLocalDateKey(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

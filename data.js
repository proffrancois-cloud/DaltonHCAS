export const DEFAULT_POINTS = 10;
export const POINT_OPTIONS = [10, 20, 30, 40, 50];
export const MAX_COMMENT_LENGTH = 300;

export const TEACHERS = [
  { id: "david", username: "david", name: "David" },
  { id: "francois", username: "francois", name: "Francois" }
];

const TEACHER_PASSWORDS = {
  david: "david",
  francois: "francois"
};

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

export const STUDENTS = [
  { id: "random1", name: "random1", houseId: "red-phoenix", grade: 9 },
  { id: "random2", name: "random2", houseId: "black-turtles", grade: 9 },
  { id: "random3", name: "random3", houseId: "green-dragons", grade: 10 },
  { id: "random4", name: "random4", houseId: "white-tigers", grade: 10 },
  { id: "random5", name: "random5", houseId: "red-phoenix", grade: 10 },
  { id: "random6", name: "random6", houseId: "black-turtles", grade: 11 },
  { id: "random7", name: "random7", houseId: "green-dragons", grade: 11 },
  { id: "random8", name: "random8", houseId: "white-tigers", grade: 11 },
  { id: "random9", name: "random9", houseId: "red-phoenix", grade: 12 },
  { id: "random10", name: "random10", houseId: "green-dragons", grade: 12 },
  { id: "random11", name: "random11", houseId: "white-tigers", grade: 12 }
];

export function authenticateTeacher(username, password) {
  const normalizedUsername = String(username ?? "").trim().toLowerCase();
  const teacher = TEACHERS.find((account) => account.username === normalizedUsername);

  if (!teacher || TEACHER_PASSWORDS[teacher.id] !== password) {
    return null;
  }

  return { ...teacher };
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
    version: 3,
    students: STUDENTS.map((student) => ({ ...student })),
    awards
  };
}

export function addAward(
  state,
  studentId,
  valueId,
  teacherId,
  points = DEFAULT_POINTS,
  now = Date.now(),
  comment = ""
) {
  if (!STUDENTS.some((student) => student.id === studentId)) {
    throw new Error("Unknown student");
  }

  if (!VALUES.some((value) => value.id === valueId)) {
    throw new Error("Unknown HCAS value");
  }

  if (!TEACHERS.some((teacher) => teacher.id === teacherId)) {
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
        createdAt: new Date(now).toISOString()
      }
    ]
  };
}

export function removeAward(state, awardId, teacherId) {
  if (!TEACHERS.some((teacher) => teacher.id === teacherId)) {
    throw new Error("Unknown teacher");
  }

  const award = state.awards.find((item) => item.id === awardId);
  if (!award) {
    throw new Error("Unknown recognition");
  }

  if (award.teacherId !== teacherId) {
    throw new Error("A teacher can only unsend their own recognition");
  }

  return {
    ...state,
    awards: state.awards.filter((item) => item.id !== awardId)
  };
}

export function getHouseTotals(state) {
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

export function getStudentStats(state, studentId) {
  return getValueStats(state.awards.filter((award) => award.studentId === studentId));
}

export function getStudentAwards(state, studentId, valueId = null) {
  return state.awards
    .filter(
      (award) =>
        award.studentId === studentId && (!valueId || award.valueId === valueId)
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
    if (stats[award.valueId]) {
      stats[award.valueId].recognitions += 1;
      stats[award.valueId].points += award.points;
    }
  }

  return stats;
}

export function getStudentTotal(state, studentId) {
  return state.awards
    .filter((award) => award.studentId === studentId)
    .reduce((total, award) => total + award.points, 0);
}

export function isValidStoredState(state) {
  return Boolean(
    state &&
      state.version === 3 &&
      Array.isArray(state.students) &&
      state.students.length === STUDENTS.length &&
      Array.isArray(state.awards) &&
      state.students.every(
        (student) =>
          STUDENTS.some(
            (knownStudent) =>
              knownStudent.id === student.id &&
              knownStudent.houseId === student.houseId &&
              knownStudent.grade === student.grade
          )
      ) &&
      state.awards.every((award) => isValidAward(award, state.students))
  );
}

export function migrateStoredState(state) {
  if (isValidStoredState(state)) {
    return state;
  }

  if (
    !state ||
    state.version !== 2 ||
    !Array.isArray(state.students) ||
    !Array.isArray(state.awards) ||
    !state.awards.every((award) => isValidAward(award, state.students))
  ) {
    return null;
  }

  return {
    version: 3,
    students: STUDENTS.map((student) => ({ ...student })),
    awards: state.awards.map((award) => ({ ...award }))
  };
}

function isValidAward(award, students) {
  return Boolean(
    award &&
      students.some((student) => student.id === award.studentId) &&
      VALUES.some((value) => value.id === award.valueId) &&
      TEACHERS.some((teacher) => teacher.id === award.teacherId) &&
      POINT_OPTIONS.includes(award.points) &&
      (award.comment === undefined ||
        (typeof award.comment === "string" && award.comment.length <= MAX_COMMENT_LENGTH)) &&
      !Number.isNaN(new Date(award.createdAt).getTime())
  );
}

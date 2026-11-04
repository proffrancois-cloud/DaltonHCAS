export const CALENDAR_GRADES = [6, 7, 8, 9, 10, 11, 12];

const events = [];
let eventIndex = 0;

function inferType(title) {
  const normalized = title.toLowerCase();
  if (normalized.includes("house") || normalized.includes("tug-of-war") || normalized.includes("halloween")) return "house";
  if (normalized.includes("lab")) return "lab";
  if (normalized.includes("level up") || normalized.includes("goal-setting")) return "level-up";
  if (normalized.includes("no school") || normalized.includes("no class") || normalized.includes("holiday") || normalized.includes("day off")) return "closure";
  if (normalized.includes("assembly")) return "assembly";
  return "school";
}

function add(date, title, grades = CALENDAR_GRADES, type = inferType(title), note = "") {
  events.push({
    id: `official-${date}-${eventIndex++}`,
    date,
    title,
    grades: [...grades],
    type,
    startTime: "13:15",
    endTime: "14:05",
    note,
    source: "2026–27 Dalton Lab Calendar (G6–12)"
  });
}

function addCommon(date, title, type, note) {
  add(date, title, CALENDAR_GRADES, type, note);
}

function addGradeRow(date, titles, type) {
  const grouped = new Map();
  CALENDAR_GRADES.forEach((grade, index) => {
    const title = Array.isArray(titles) ? titles[index] : titles[grade];
    if (!title) return;
    const current = grouped.get(title) ?? [];
    current.push(grade);
    grouped.set(title, current);
  });
  for (const [title, grades] of grouped) add(date, title, grades, type ?? inferType(title));
}

const firstSemesterMondays = [
  "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-21",
  "2026-10-05", "2026-10-12", "2026-10-19", "2026-11-02", "2026-11-09",
  "2026-11-16", "2026-11-23", "2026-11-30"
];
const firstSemesterWednesdays = [
  "2026-08-19", "2026-08-26", "2026-09-02", "2026-09-09", "2026-09-16",
  "2026-09-23", "2026-09-30", "2026-10-07", "2026-10-14", "2026-10-28",
  "2026-11-04", "2026-11-11", "2026-11-18", "2026-12-09"
];
const firstSemesterThursdays = [
  "2026-08-20", "2026-08-27", "2026-09-03", "2026-09-10", "2026-09-24",
  "2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-11-05",
  "2026-11-12", "2026-11-19", "2026-12-03", "2026-12-10", "2026-12-17"
];

firstSemesterMondays.forEach((date) => addGradeRow(date, ["LAB", "LAB", "LAB", "LAB", "LAB", "Mastery", "Mastery"]));
firstSemesterWednesdays.forEach((date) => addGradeRow(date, ["LAB", "LAB", "LAB", "LAB", "LAB", "Mastery", "College Counselling"]));
firstSemesterThursdays.forEach((date) => addGradeRow(date, ["LAB", "LAB", "LAB", "LAB", "LAB", "College Counselling", "Mastery"]));

const secondSemesterMondays = [
  "2027-01-18", "2027-01-25", "2027-02-01", "2027-02-08", "2027-02-22",
  "2027-03-01", "2027-03-08", "2027-03-15", "2027-03-22", "2027-04-26",
  "2027-05-03", "2027-05-10", "2027-05-17"
];
const secondSemesterWednesdays = [
  "2027-01-13", "2027-01-27", "2027-02-03", "2027-02-10", "2027-02-24",
  "2027-03-03", "2027-03-10", "2027-03-17", "2027-03-24", "2027-04-07",
  "2027-04-21", "2027-04-28", "2027-05-05", "2027-05-12", "2027-05-19"
];
const secondSemesterThursdays = [
  "2027-01-14", "2027-01-21", "2027-01-28", "2027-02-04", "2027-02-11",
  "2027-02-25", "2027-03-04", "2027-03-11", "2027-03-18", "2027-03-25",
  "2027-04-08", "2027-04-22", "2027-04-29", "2027-05-06", "2027-05-13", "2027-05-20"
];

secondSemesterMondays.forEach((date) => addGradeRow(date, ["LAB", "LAB", "LAB", "LAB", "LAB", "Mastery", "Mastery"]));
secondSemesterWednesdays.forEach((date) => addGradeRow(date, ["LAB w G5", "LAB w G5", "LAB w G5", "LAB w G5", "LAB w G5", "Mastery", "Mastery"]));
secondSemesterThursdays.forEach((date) => addGradeRow(date, ["LAB", "LAB", "LAB", "LAB", "LAB", "Level Up!", "College Counselling"]));

[
  ["2026-08-08", "Welcome Assembly", "assembly"],
  ["2026-08-10", "Get-to-Know Your House Activities · Gym", "house"],
  ["2026-08-12", "Lab Fair", "lab"],
  ["2026-08-13", "House Welcome Ceremony & Competition", "house"],
  ["2026-08-17", "House Captain Selection", "house"],
  ["2026-08-21", "House Meeting", "house"],
  ["2026-08-28", "House Competition · Tug-of-War Battle", "house"],
  ["2026-09-04", "Assembly", "assembly"],
  ["2026-09-08", "Executive Functioning Skills Fair", "school"],
  ["2026-09-11", "House Meeting", "house"],
  ["2026-09-14", "STUCO Event · Marvel Trivia · Gym", "school"],
  ["2026-09-15", "STUCO Event · Three-legged Race · Gym", "school"],
  ["2026-09-17", "STUCO Event · Reverse It Audio Challenge · Gym", "school"],
  ["2026-09-18", "House Meeting", "house"],
  ["2026-09-25", "No classes", "closure"],
  ["2026-09-28", "No classes", "closure"],
  ["2026-10-02", "Assembly", "assembly"],
  ["2026-10-09", "No classes", "closure"],
  ["2026-10-16", "Early dismissal", "school"],
  ["2026-10-21", "House Halloween Decoration", "house"],
  ["2026-10-23", "House Halloween Decoration", "house"],
  ["2026-10-26", "No classes", "closure"],
  ["2026-10-29", "House Halloween Decoration", "house"],
  ["2026-10-30", "Haunted Halloween Competition", "house"],
  ["2026-11-06", "Assembly", "assembly"],
  ["2026-11-10", "Amnesty International Write for Rights Campaign", "school"],
  ["2026-11-13", "House Competition", "house"],
  ["2026-11-20", "House Meeting", "house"],
  ["2026-11-25", "Early dismissal", "school"],
  ["2026-11-26", "Thanksgiving Break", "closure"],
  ["2026-11-27", "Thanksgiving Break", "closure"],
  ["2026-12-02", "History Fair", "school"],
  ["2026-12-04", "Assembly", "assembly"],
  ["2026-12-07", "Holiday Show Prep", "school"],
  ["2026-12-11", "House Dance Practice", "house"],
  ["2026-12-15", "Holiday Show Prep", "school"],
  ["2026-12-16", "Holiday Show Prep", "school"],
  ["2026-12-18", "Lab Showcase / Holiday Show", "lab"],
  ["2027-01-04", "No school", "closure"],
  ["2027-01-06", "Lab Fair", "lab"],
  ["2027-01-07", "House Activity", "house"],
  ["2027-01-08", "Assembly", "assembly"],
  ["2027-01-11", "Confidence / Improv Workshop", "school"],
  ["2027-01-15", "House Activity", "house"],
  ["2027-01-20", "Storytelling and Speech Contest · G6–9 · A/V Room", "school"],
  ["2027-01-22", "House Competition", "house"],
  ["2027-01-29", "House Meeting · Board Games", "house"],
  ["2027-02-05", "Assembly", "assembly"],
  ["2027-02-12", "House Meeting", "house"],
  ["2027-02-15", "Lunar New Year Holiday", "closure"],
  ["2027-02-16", "Lunar New Year Holiday", "closure"],
  ["2027-02-17", "Lunar New Year Holiday", "closure"],
  ["2027-02-18", "Lunar New Year Holiday", "closure"],
  ["2027-02-19", "Lunar New Year Holiday", "closure"],
  ["2027-02-26", "No school", "closure"],
  ["2027-03-05", "Assembly", "assembly"],
  ["2027-03-12", "House Peace Activity", "house"],
  ["2027-03-16", "Bazaar Preparations", "school"],
  ["2027-03-19", "Science Fair", "school"],
  ["2027-03-26", "Pi Day House Competition · Math Department", "house"],
  ["2027-03-29", "Spring Holiday", "closure"],
  ["2027-03-30", "Spring Holiday", "closure"],
  ["2027-03-31", "Spring Holiday", "closure"],
  ["2027-04-01", "Spring Holiday", "closure"],
  ["2027-04-02", "Spring Holiday", "closure"],
  ["2027-04-05", "No school", "closure"],
  ["2027-04-09", "Assembly", "assembly"],
  ["2027-04-19", "No classes", "closure"],
  ["2027-04-20", "Greenpeace Presentation · 13:05 · Gym", "school"],
  ["2027-04-23", "Poetry Cafe", "school"],
  ["2027-04-30", "Day off", "closure"],
  ["2027-05-04", "STUCO Election Speeches", "school"],
  ["2027-05-07", "STUCO Election", "school"],
  ["2027-05-14", "Assembly", "assembly"],
  ["2027-05-21", "House Meeting", "house"],
  ["2027-05-24", "Monday Labs", "lab"],
  ["2027-05-25", "Thursday Labs", "lab"],
  ["2027-05-26", "Wednesday Labs", "lab"],
  ["2027-05-27", "Lab Showcase", "lab"],
  ["2027-05-27", "WSC Debate", "school"],
  ["2027-05-27", "Athletic Banquet · Lunch–2:00 PM", "school"],
  ["2027-05-27", "Level Up! Final Party · 1:15–3:00 PM", "level-up"],
  ["2027-05-28", "House Cup Day", "house"]
].forEach(([date, title, type]) => addCommon(date, title, type));

[
  ["2026-08-11", ["Semester Goal-Setting & Level Up! Welcome · RM 308", "Semester Goal-Setting & Level Up! Welcome · RM 404", "Semester Goal-Setting & Level Up! Welcome · RM 406", "Semester Goal-Setting & Level Up! Welcome · A/V Room", "Semester Goal-Setting & Level Up! Welcome · Library", "College Counselling · RM 403", "Level Up! Intro · RM 311"]],
  ["2026-08-14", ["Level Up! Intro · Mindfulness · RM 308", "Level Up! Intro · Growing Up · RM 404", "Level Up! Intro · My Personality · RM 406", "Level Up! Intro · The Johari Window · A/V Room", "Level Up! Intro · The Best Part of Me · Library", "Level Up! Intro · Icebreakers & SEL · RM 403", "College Counselling · RM 311"]],
  ["2026-08-18", ["Ms. Jessica’s Session", "Level Up!", "Level Up!", "Level Up!", "College Counselling", "Level Up!", "Level Up!"]],
  ["2026-08-25", ["Myself in Your Eyes", "Ms. Jessica’s Session", "Mixed Feelings", "Think, Feel, Act", "College Visit", "College Visit", "College Visit"]],
  ["2026-09-01", ["Myself in Your Eyes", "Relationship Skills · Friendship", "Ms. Jessica’s Session", "Think, Feel, Act", "College Counselling", "Level Up!", "Level Up!"]],
  ["2026-09-22", ["Defeat Anger", "Wanna, Shoulda, Not Into Me", "We Both Like the Same Boy!", "Ms. Jessica’s Session", "Sex Ed · A/V Room", "Sex Ed · A/V Room", "Sex Ed · A/V Room"]],
  ["2026-09-29", ["Sex Ed · Library", "Sex Ed · Library", "Sex Ed · A/V Room", "Sex Ed · A/V Room", "College Counselling", "Level Up!", "Level Up!"]],
  ["2026-10-06", ["Level Up!", "Level Up!", "Level Up!", "Level Up!", "Ms. Jessica’s Session", "Level Up!", "Level Up!"]],
  ["2026-10-13", ["Study Hall", "Study Hall", "Study Hall", "Study Hall", "College Counselling", "Level Up!", "Level Up!"]],
  ["2026-10-20", ["Resist Temptation", "Not Into Me", "It’s Not Just Crap", "The 4 Keys to DG", "College Counselling", "Level Up!", "Level Up!"]],
  ["2026-10-27", ["Ms. Jessica’s Session", "Through Other Eyes", "The Scream… When Other People Cry Out", "Negative Emotional Chain", "College Counselling", "Level Up!", "Level Up!"]],
  ["2026-11-03", ["Thinking Hats", "Ms. Jessica’s Session", "Doing My Part", "The Costly Cup of Water", "College Counselling", "Level Up!", "Level Up!"]],
  ["2026-11-17", ["My Magnifying Glass", "The Mirandas on Vacation", "Ms. Jessica’s Session", "I Feel You", "Sex Ed", "Sex Ed", "Sex Ed"]],
  ["2026-11-24", ["Assertive Defenders", "The Grain of Sand", "How Would You Say It?", "Ms. Jessica’s Session", "College Counselling", "Level Up!", "Level Up!"]],
  ["2026-12-01", ["Win-Win", "Reading Gestures", "Level Up!", "Helping, Not Helping", "Ms. Jessica’s Session", "Level Up!", "Level Up!"]],
  ["2026-12-08", ["Sex Ed", "Sex Ed", "Sex Ed", "Sex Ed", "College Counselling", "Ms. Jessica’s Session", "Level Up!"]],
  ["2027-01-05", ["Level Up! · Goal Setting", "Level Up! · Goal Setting", "Level Up! · Goal Setting", "Level Up! · Goal Setting", "Level Up! · Goal Setting", "Level Up! · Goal Setting", "Level Up! · Goal Setting"]],
  ["2027-01-12", ["Steps to My Goal", "Level Up!", "Level Up!", "Level Up!", "Level Up!", "College Counselling", "Level Up!"]],
  ["2027-01-19", ["Relationship Skills · Communication", "Level Up!", "Level Up!", "Level Up!", "", "Debate Semi-Finals", "College Counselling · Library"]],
  ["2027-01-26", ["Roadblocks, Change Routes", "Relationships", "Level Up!", "Level Up!", "Level Up!", "College Counselling", "Level Up!"]],
  ["2027-02-02", ["Level Up!", "Level Up!", "Relationships", "Goal-Setting Check-in + Bazaar Goal", "Level Up!", "Level Up!", "Level Up!"]],
  ["2027-02-09", ["Malena and Melino · Bazaar Goal", "Goal-Setting Check-in + Bazaar Goal", "Goal-Setting Check-in + Bazaar Goal", "Relationships", "Goal-Setting Check-in + Bazaar Goal", "College Counselling", "Goal-Setting Check-in + Bazaar Goal"]],
  ["2027-02-23", ["I Have a Plan", "Level Up!", "Level Up!", "Level Up!", "Relationships", "College Counselling", "Level Up!"]],
  ["2027-03-02", ["Sex Ed · Library", "Sex Ed · Library", "Sex Ed · A/V & Computer Lab", "Sex Ed · A/V & Computer Lab", "Level Up!", "College Counselling", "Level Up!"]],
  ["2027-03-09", ["What Are You Selling?", "Level Up!", "Level Up!", "Level Up!", "Level Up!", "Level Up!", "Level Up!"]],
  ["2027-03-23", ["The Best Role Model", "", "", "", "Sex Ed", "Sex Ed", "Sex Ed"]],
  ["2027-04-06", ["Bazaar Preparations", "Bazaar Preparations", "Bazaar Preparations", "Bazaar Preparations", "Bazaar Preparations", "College Counselling", "Bazaar Preparations"]],
  ["2027-04-27", ["Election Readiness", "Election Readiness", "Election Readiness", "Election Readiness", "Election Readiness", "College Counselling", "Election Readiness"]],
  ["2027-05-11", ["Level Up!", "Level Up!", "Level Up!", "Level Up!", "Level Up!", "Level Up!", "Level Up!"]],
  ["2027-05-18", ["Level Up!", "Level Up!", "Level Up!", "Level Up!", "Level Up!", "College Counselling", "Level Up!"]]
].forEach(([date, titles]) => addGradeRow(date, titles));

for (const date of ["2027-04-12", "2027-04-13", "2027-04-14", "2027-04-15", "2027-04-16"]) {
  addGradeRow(date, ["Bazaar Preparations", "Bazaar Preparations", "Bazaar Preparations", "Bazaar Preparations", "Bazaar Preparations", "Mastery Presentations", "Mastery Presentations"]);
}

export const OFFICIAL_CALENDAR_EVENTS = Object.freeze(
  events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
);

export function getOfficialEventsForDate(date) {
  return OFFICIAL_CALENDAR_EVENTS.filter((event) => event.date === date);
}

// HCAS 2026–27 school calendar, semester 2 (external edition).
export const EXTERNAL_SCHOOL_CALENDAR = [
  {"id": "school-external-49518f9aa511dd1a", "date": "2027-01-04", "title": "PD Day - No School", "type": "closure"},
  {"id": "school-external-5a4a376c630f9332", "date": "2027-01-05", "title": "1st Day of School"},
  {"id": "school-external-41a2e3426222e2f2", "date": "2027-01-07", "title": "Lab Fair and Lab Selection"},
  {"id": "school-external-220ee47cb1567f02", "date": "2027-01-07", "title": "1/7 18:00 ~ 1/10 20:00 LAB Selection", "endDate": "2027-01-10"},
  {"id": "school-external-88aeaa9d7dfe38ff", "date": "2027-01-13", "title": "LAB Start"},
  {"id": "school-external-bf2511937f035814", "date": "2027-01-15", "title": "Report Card Release"},
  {"id": "school-external-1f66c5457e9571a9", "date": "2027-01-11", "title": "MAP Testing [G1 - G5]", "endDate": "2027-01-29", "grades": [1, 2, 3, 4, 5]},
  {"id": "school-external-6499ee01a8d7497b", "date": "2027-01-20", "title": "PTA Meeting"},
  {"id": "school-external-dd1975467706d904", "date": "2027-01-23", "title": "Information Session"},
  {"id": "school-external-f6323ad54b63ff2a", "date": "2027-01-25", "title": "EC Start"},
  {"id": "school-external-99c54f3f5b89b330", "date": "2027-01-23", "title": "THIMUN The Hague Conference (likely)", "endDate": "2027-02-01"},
  {"id": "school-external-c35c3a162b05b52c", "date": "2027-01-26", "title": "English Speech and Debate Showcase", "endDate": "2027-01-29"},
  {"id": "school-external-99c0a0cf3a6ca85b", "date": "2027-01-30", "title": "OBT L2 Leadership Hike", "endDate": "2027-02-03"},
  {"id": "school-external-9ed14a96309f75d2", "date": "2027-02-04", "title": "Lunar New Years Eve Break", "endDate": "2027-02-05", "type": "closure"},
  {"id": "school-external-5671e083522406ad", "date": "2027-02-08", "title": "Lunar New Year Break", "endDate": "2027-02-10", "type": "closure"},
  {"id": "school-external-f9d9412fd58de35f", "date": "2027-02-11", "title": "PD Day - No School", "endDate": "2027-02-12", "type": "closure"},
  {"id": "school-external-f11130d4e1082e5a", "date": "2027-03-01", "title": "Peace Memorial Day", "type": "closure"},
  {"id": "school-external-a40eaa503ee5e22f", "date": "2027-03-02", "title": "Week Without Walls & Senior Trip (potential)", "endDate": "2027-03-05"},
  {"id": "school-external-014c653a5a76cef1", "date": "2027-03-05", "title": "Elementary Science Fair"},
  {"id": "school-external-cc535e59fea0b3f1", "date": "2027-03-06", "title": "Digital SAT Testing"},
  {"id": "school-external-5b80afe98f705b9f", "date": "2027-03-12", "title": "Math Pi Day"},
  {"id": "school-external-3f7bc4e02e72de16", "date": "2027-03-13", "title": "WSC Hsinchu Regional Round", "endDate": "2027-03-14"},
  {"id": "school-external-b8a8818cc5f38d95", "date": "2027-03-15", "title": "Midterm Week", "endDate": "2027-03-18"},
  {"id": "school-external-f0c4c36fc3e5acd1", "date": "2027-03-17", "title": "TAIMUN Conference", "endDate": "2027-03-19"},
  {"id": "school-external-ccd58e0ca349b07d", "date": "2027-03-19", "title": "Quarter 4 Start Date"},
  {"id": "school-external-7d68934ad524ce8a", "date": "2027-03-20", "title": "Information Session"},
  {"id": "school-external-b024388e1b621025", "date": "2027-03-22", "title": "WIDA Testing", "endDate": "2027-04-02"},
  {"id": "school-external-2e6f258a7b50bb10", "date": "2027-03-24", "title": "PTA Meeting"},
  {"id": "school-external-15f488ac3053a121", "date": "2027-03-26", "title": "MUS Science Fair (Tentative)"},
  {"id": "school-external-d5cccf2f8ea42b00", "date": "2027-03-29", "title": "Bazaar prep (LAB Time)", "endDate": "2027-04-01"},
  {"id": "school-external-47ecbb291f81f787", "date": "2027-04-01", "title": "Parent Teacher Conferences"},
  {"id": "school-external-6178a88cf4e6c5fd", "date": "2027-04-05", "title": "Spring Break", "endDate": "2027-04-09", "type": "closure"},
  {"id": "school-external-f2c885858c13552e", "date": "2027-04-14", "title": "MAP TESTING [G1 - G8]", "endDate": "2027-04-29", "grades": [1, 2, 3, 4, 5, 6, 7, 8]},
  {"id": "school-external-10e15fbc5638aa2e", "date": "2027-04-17", "title": "International Bazaar"},
  {"id": "school-external-33bf161c8c2593ae", "date": "2027-04-19", "title": "No School due to Bazaar", "type": "closure"},
  {"id": "school-external-0d3185308d1fe21d", "date": "2027-04-21", "title": "PTA Meeting"},
  {"id": "school-external-23ba9810b4e7f1fb", "date": "2027-04-23", "title": "Poetry Café (Café au Lit)"},
  {"id": "school-external-5ec96f406479ba31", "date": "2027-04-24", "title": "Information Session"},
  {"id": "school-external-b8781129d68e10eb", "date": "2027-04-24", "title": "TASMUN Conference (likely)", "endDate": "2027-04-25"},
  {"id": "school-external-f9b42daaac0aae6a", "date": "2027-04-30", "title": "Labor Day", "type": "closure"},
  {"id": "school-external-237129e36180fcd4", "date": "2027-05-01", "title": "Digital SAT Testing"},
  {"id": "school-external-60bb328cee5e0643", "date": "2027-05-03", "title": "AP Exams", "endDate": "2027-05-14"},
  {"id": "school-external-70fc1fbf4718dd8c", "date": "2027-05-07", "title": "Musical Matinees", "endDate": "2027-05-08"},
  {"id": "school-external-c3113f9e7098d18b", "date": "2027-05-14", "title": "K3, G5, G8 Completion Ceremony 1st Rehearsal"},
  {"id": "school-external-3bb8d911aca26fbb", "date": "2027-05-19", "title": "PTA Meeting / K3, G5, G8 Completion Ceremony Grand Rehearsal"},
  {"id": "school-external-47939f3f46aaa8c9", "date": "2027-05-17", "title": "Senior Final Exams", "endDate": "2027-05-20", "grades": [12]},
  {"id": "school-external-0aeff97b73da8232", "date": "2027-05-19", "title": "Final Exams (G6 - 11)", "endDate": "2027-05-20", "grades": [6, 7, 8, 9, 10, 11]},
  {"id": "school-external-c588bf1269f5ec88", "date": "2027-05-24", "title": "Final Exams (G6 - 11)", "endDate": "2027-05-25", "grades": [6, 7, 8, 9, 10, 11]},
  {"id": "school-external-ff18ebc01c77f376", "date": "2027-05-21", "title": "Elementary Field Day / Grades due for Seniors / G12 Graduation Ceremony 1st Rehearsal"},
  {"id": "school-external-be270a96f132db77", "date": "2027-05-22", "title": "Information Session"},
  {"id": "school-external-42c836c7416b1c30", "date": "2027-05-25", "title": "G12 Graduation Grand Rehearsal / G12 Reception Ceremony"},
  {"id": "school-external-1a5d10a03b333b80", "date": "2027-05-26", "title": "K3, G5, G8 Completion Ceremony"},
  {"id": "school-external-c8e75e0b33e88851", "date": "2027-05-27", "title": "Senior Graduation"},
  {"id": "school-external-8451a7e15a5ea214", "date": "2027-05-28", "title": "House Cup / Final Day of Classes / PROM"},
  {"id": "school-external-e75368147ab08eeb", "date": "2027-05-31", "title": "End of Term Staff Close-out | No School", "type": "closure"},
  {"id": "school-external-801194b5aefa6b48", "date": "2027-06-04", "title": "Report Card Release"},
  {"id": "school-external-0076fef618a486f3", "date": "2027-06-05", "title": "Digital SAT Testing"},
  {"id": "school-external-98abe2664be9b530", "date": "2027-06-09", "title": "Dragon Boat Festival", "type": "closure"}
];

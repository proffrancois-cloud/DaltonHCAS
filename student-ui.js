import { getAwardValueIds } from "./data.js";
export function emptyStudentFilters() {
  return { query: "", house: "", grade: "" };
}

export function hasStudentFilter(filters) {
  const chosen = value => Array.isArray(value) ? value.length > 0 : Boolean(value);
  return Boolean(filters.query.trim() || chosen(filters.house) || chosen(filters.grade) || chosen(filters.values));
}

export function toggleFilterValues(values, value) {
  if (value === "all") return values.includes("all") ? [] : ["all"];
  const current = values.filter(item => item !== "all");
  return current.includes(value) ? current.filter(item => item !== value) : [...current, value];
}

export function browseStudents(state, filters, houses, values) {
  if (!hasStudentFilter(filters)) return { students: [], ranked: false };
  const query = filters.query.trim().toLowerCase();
  const queryValues = query ? values.filter(v => v.name.toLowerCase().includes(query) || v.id.toLowerCase().includes(query)).map(v => v.id) : [];
  const selected = filters.values ?? [];
  const effectiveValues = selected.includes("all") ? values.map(v => v.id) : selected.length ? selected : queryValues;
  const ranked = effectiveValues.length > 0;
  const within = (selection, value) => !selection?.length || selection.includes("all") || selection.includes(String(value));
  const day = at => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
  const awards = state.awards.filter(a => !ranked || ((!filters.from || day(a.createdAt) >= filters.from) && (!filters.to || day(a.createdAt) <= filters.to)));
  const students = state.students.filter(student => within(filters.house, student.houseId) && within(filters.grade, student.grade)).flatMap(student => {
    const own = awards.filter(a => a.studentId === student.id);
    const relevant = ranked ? own.filter(a => getAwardValueIds(a).some(id => effectiveValues.includes(id))) : own;
    if (ranked && !relevant.some(a => a.points > 0)) return [];
    const house = houses.find(h => h.id === student.houseId);
    if (query && !student.name.toLowerCase().includes(query) && !house?.name.toLowerCase().includes(query) && !own.some(a => a.points > 0 && getAwardValueIds(a).some(id => queryValues.includes(id)))) return [];
    return [{ ...student, points: relevant.reduce((sum, a) => sum + a.points, 0), recognitions: relevant.filter(a => a.points > 0).length }];
  });
  if (ranked) students.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  return { students, ranked };
}

export function matchingStudents(students, filters, { activated = false } = {}) {
  if (!activated && !hasStudentFilter(filters)) return [];
  const query = filters.query.trim().toLowerCase();
  return students.filter(student =>
    student.name.toLowerCase().includes(query) &&
    (!filters.house || filters.house === "all" || student.houseId === filters.house) &&
    (!filters.grade || filters.grade === "all" || String(student.grade) === filters.grade)
  );
}

export function studentCrestVisual(student, house, points, instanceId, esc) {
  const nameId = esc(`${instanceId}-name`), gradeId = esc(`${instanceId}-grade`);
  return `<span class="student-crest-visual" aria-hidden="true">
    <svg viewBox="0 0 220 220">
      <defs>
        <path id="${nameId}" d="M 24 73 Q 110 1 196 73" />
        <path id="${gradeId}" d="M 36 174 Q 110 224 184 174" />
      </defs>
      <image href="${esc(house.image)}" x="38" y="39" width="144" height="144" preserveAspectRatio="xMidYMid meet" />
      <text class="student-crest-name"><textPath href="#${nameId}" startOffset="50%" text-anchor="middle">${esc(student.name)}</textPath></text>
      <text class="student-crest-grade"><textPath href="#${gradeId}" startOffset="50%" text-anchor="middle">GRADE ${esc(student.grade)}</textPath></text>
    </svg>
    <b class="student-points-badge">${esc(points)}</b>
  </span>`;
}

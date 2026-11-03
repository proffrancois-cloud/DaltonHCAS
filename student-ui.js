export function emptyStudentFilters() {
  return { query: "", house: "", grade: "" };
}

export function hasStudentFilter(filters) {
  return Boolean(filters.query.trim() || filters.house || filters.grade);
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

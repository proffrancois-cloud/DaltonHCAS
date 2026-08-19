import {
  HOUSES,
  MAX_COMMENT_LENGTH,
  POINT_OPTIONS,
  TEACHERS,
  VALUES,
  addAward,
  authenticateTeacher,
  createInitialState,
  getHouseLeaders,
  getHouseTotals,
  getStudentAwards,
  getStudentStats,
  getStudentTotal,
  getTeacherAwards,
  getTeacherStats,
  migrateStoredState,
  removeAward
} from "./data.js";

const STORAGE_KEY = "hcas-house-points-v3";
const LEGACY_STORAGE_KEYS = ["hcas-house-points-v2"];
const SESSION_KEY = "hcas-house-points-teacher";
const viewRoot = document.querySelector("#view-root");
const toast = document.querySelector("#toast");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const teacherName = document.querySelector("#teacher-name");
const teacherAvatar = document.querySelector("#teacher-avatar");
const topbarHouseScores = document.querySelector("#topbar-house-scores");

let state = loadState();
let activeTeacher = loadTeacherSession();
let activeView = getViewFromHash();
let selectedValueId = null;
let selectedPoints = null;
let sendStudentIds = [];
let sendGradeFilter = "all";
let sendHouseFilter = "all";
let sendComment = "";
let profileStudentId = null;
let studentQuery = "";
let houseFilter = "all";
let studentGradeFilter = "all";
let expandedHouseId = null;
let expandedStudentValueId = null;
let expandedTeacherValueId = null;
let lastConfirmation = null;
let toastTimer;

function loadState() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    try {
      const storedValue = localStorage.getItem(key);
      if (!storedValue) continue;
      const migratedState = migrateStoredState(JSON.parse(storedValue));
      if (migratedState) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedState));
        return migratedState;
      }
    } catch {
      // Invalid local data is skipped in favor of another saved version or demo data.
    }
  }

  const initialState = createInitialState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
  return initialState;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadTeacherSession() {
  const teacherId = sessionStorage.getItem(SESSION_KEY);
  return TEACHERS.find((teacher) => teacher.id === teacherId) ?? null;
}

function saveTeacherSession(teacher) {
  sessionStorage.setItem(SESSION_KEY, teacher.id);
}

function getViewFromHash() {
  const hash = window.location.hash.replace("#", "");
  return ["dashboard", "send", "students", "activity"].includes(hash) ? hash : "dashboard";
}

function setView(view, options = {}) {
  if (!activeTeacher) return;
  activeView = view;
  if (options.studentId) {
    profileStudentId = options.studentId;
  }
  window.location.hash = view;
  render();
  viewRoot.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getHouse(houseId) {
  return HOUSES.find((house) => house.id === houseId);
}

function getValue(valueId) {
  return VALUES.find((value) => value.id === valueId);
}

function getStudent(studentId) {
  return state.students.find((student) => student.id === studentId);
}

function getTeacher(teacherId) {
  return TEACHERS.find((teacher) => teacher.id === teacherId);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRecognitionComment(comment) {
  const normalizedComment = String(comment ?? "").trim();
  return normalizedComment
    ? `<p class="recognition-comment">${escapeHtml(normalizedComment)}</p>`
    : "";
}

function renderStudentIdentity(
  student,
  { secondary = "", points = null, action = false, className = "" } = {}
) {
  const house = getHouse(student.houseId);
  const content = `
    <img src="${house.image}" alt="" />
    <span class="student-identity-copy">
      <strong>${student.name}</strong>
      ${secondary ? `<span>${secondary}</span>` : ""}
    </span>
    ${points === null ? "" : `<b class="points-notification" aria-label="${points} points">${points}</b>`}
  `;

  if (action) {
    return `
      <button
        class="student-identity ${className}"
        type="button"
        data-action="open-student"
        data-student-id="${student.id}"
        aria-label="Open ${student.name}'s profile"
      >${content}</button>
    `;
  }

  return `<div class="student-identity ${className}">${content}</div>`;
}

function getFilteredSendStudents() {
  return state.students.filter((student) => {
    const matchesGrade = sendGradeFilter === "all" || String(student.grade) === sendGradeFilter;
    const matchesHouse = sendHouseFilter === "all" || student.houseId === sendHouseFilter;
    return matchesGrade && matchesHouse;
  });
}

function syncSendStudents() {
  const students = getFilteredSendStudents();
  const knownStudentIds = new Set(state.students.map((student) => student.id));
  sendStudentIds = sendStudentIds.filter((studentId) => knownStudentIds.has(studentId));
  return students;
}

function resetSendSelection() {
  selectedValueId = null;
  selectedPoints = null;
  sendStudentIds = [];
  sendComment = "";
  lastConfirmation = null;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function formatRelativeTime(dateString) {
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - new Date(dateString).getTime()) / 60000));
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dateString));
}

function renderPageHeader(title, description, action = "") {
  return `
    <header class="page-header">
      <div>
        <h1>${title}</h1>
        ${description ? `<p>${description}</p>` : ""}
      </div>
      ${action}
    </header>
  `;
}

function renderCupIcon() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v4M9 20h6M10 16h4v4h-4Z" />
    </svg>
  `;
}

function renderTopbarHouseScores() {
  const totals = getHouseTotals(state);
  topbarHouseScores.innerHTML = HOUSES.map(
    (house) => `
      <button
        class="topbar-house-score"
        type="button"
        data-action="show-house-leaders"
        data-house-id="${house.id}"
        aria-label="${house.name}, ${totals[house.id]} points. Show top students."
        title="${house.name}: ${totals[house.id]} points"
      >
        <img src="${house.image}" alt="" />
        <span>${totals[house.id].toLocaleString()}</span>
      </button>
    `
  ).join("");
}

function renderHouseLeaders(house) {
  const leaders = getHouseLeaders(state, house.id);

  return `
    <div class="house-leaders" id="${house.id}-leaders">
      <div class="house-leaders-heading">
        <strong>Top students</strong>
        <span>${house.name}</span>
      </div>
      <ol>
        ${leaders
          .map(
            (student, index) => `
              <li>
                <span class="leader-rank" aria-label="${["Gold", "Silver", "Bronze"][index]} medal">${["🥇", "🥈", "🥉"][index]}</span>
                ${renderStudentIdentity(student, {
                  secondary: `Grade ${student.grade}`,
                  points: student.points.toLocaleString(),
                  action: true,
                  className: "is-compact"
                })}
              </li>
            `
          )
          .join("")}
      </ol>
    </div>
  `;
}

function renderDashboard() {
  const totals = getHouseTotals(state);
  const rankedHouses = [...HOUSES].sort((a, b) => totals[b.id] - totals[a.id]);
  const maxPoints = Math.max(...Object.values(totals), 1);
  const recentAwards = [...state.awards]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  return `
    <div class="page">
      ${renderPageHeader(
        "House dashboard",
        "",
        '<button class="primary-button" type="button" data-action="go-send">Send points</button>'
      )}

      <div class="dashboard-layout">
        <section class="panel scoreboard-panel" aria-labelledby="house-points-title">
          <div class="panel-heading">
            <div>
              <h2 id="house-points-title">House points</h2>
              <p>Current leaderboard</p>
            </div>
          </div>

          <ol class="house-list">
            ${rankedHouses
              .map((house, index) => {
                const members = state.students.filter((student) => student.houseId === house.id).length;
                const barWidth = Math.max((totals[house.id] / maxPoints) * 100, totals[house.id] ? 7 : 0);
                const isExpanded = expandedHouseId === house.id;
                const cupLabel = `${house.cupYears.length} House Cup ${house.cupYears.length === 1 ? "win" : "wins"}: ${house.cupYears.join(", ")}`;
                return `
                  <li
                    class="house-entry ${isExpanded ? "is-expanded" : ""}"
                    data-house-entry="${house.id}"
                    style="--house-color: ${house.color}; --bar-width: ${barWidth}%"
                  >
                    <button
                      class="house-row"
                      type="button"
                      data-action="toggle-house-leaders"
                      data-house-id="${house.id}"
                      aria-expanded="${isExpanded}"
                      aria-controls="${house.id}-leaders"
                      aria-label="${house.name}, rank ${index + 1}, ${totals[house.id]} points, ${cupLabel}. ${isExpanded ? "Hide" : "Show"} top students."
                    >
                      <span class="rank" aria-hidden="true">${index + 1}</span>
                      <img src="${house.image}" alt="" />
                      <div class="house-info">
                        <div class="house-title-line">
                          <strong>${house.name}</strong>
                          <span class="house-cup-history" data-tooltip="${cupLabel}" title="${cupLabel}">
                            ${house.cupYears.map(() => renderCupIcon()).join("")}
                          </span>
                        </div>
                        <span>${members} ${members === 1 ? "student" : "students"}</span>
                        <div class="score-track" aria-hidden="true"><span></span></div>
                      </div>
                      <span class="house-score-cell">
                        <strong class="house-points">${totals[house.id].toLocaleString()}<span> pts</span></strong>
                        <svg class="house-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m8 10 4 4 4-4" /></svg>
                      </span>
                    </button>
                    ${isExpanded ? renderHouseLeaders(house) : ""}
                  </li>
                `;
              })
              .join("")}
          </ol>
        </section>

        <section class="panel activity-panel" aria-labelledby="recent-title">
          <div class="panel-heading">
            <div>
              <h2 id="recent-title">Recent activity</h2>
              <p>Latest recognitions</p>
            </div>
          </div>
          <ul class="activity-list">
            ${recentAwards
              .map((award) => {
                const student = getStudent(award.studentId);
                const value = getValue(award.valueId);
                const teacher = getTeacher(award.teacherId);
                return `
                  <li>
                    ${renderStudentIdentity(student, {
                      secondary: `${value.name} · ${teacher.name}`,
                      points: `+${award.points}`,
                      action: true,
                      className: "is-compact"
                    })}
                    <time datetime="${award.createdAt}">${formatRelativeTime(award.createdAt)}</time>
                  </li>
                `;
              })
              .join("")}
          </ul>
        </section>
      </div>
    </div>
  `;
}

function renderSendStudentOption(student) {
  const house = getHouse(student.houseId);
  const totalPoints = getStudentTotal(state, student.id);
  const isSelected = sendStudentIds.includes(student.id);

  return `
    <button
      class="send-student-option ${isSelected ? "is-selected" : ""}"
      type="button"
      data-action="toggle-send-student"
      data-student-id="${student.id}"
      aria-pressed="${isSelected}"
    >
      <img src="${house.image}" alt="" />
      <span>
        <strong>${student.name}</strong>
        <small>Grade ${student.grade} · ${house.name}</small>
      </span>
      <b class="points-notification" aria-label="${totalPoints} total points">${totalPoints}</b>
    </button>
  `;
}

function renderSendSummary(student, selectedValue, canSend) {
  const house = getHouse(student.houseId);
  const studentTotal = getStudentTotal(state, student.id);
  const commentLabel = sendComment.trim() ? escapeHtml(sendComment.trim()) : "No comment";

  return `
    <article class="send-summary" style="--house-color: ${house.color}">
      <div class="summary-house">
        <img src="${house.image}" alt="${house.name} emblem" />
        <div>
          <span>Selected student</span>
          <h2>${student.name}</h2>
          <p>Grade ${student.grade} · ${house.name}</p>
        </div>
        <b class="points-notification" aria-label="${studentTotal} total points">${studentTotal}</b>
        <button
          class="remove-student-button"
          type="button"
          data-action="remove-send-student"
          data-student-id="${student.id}"
          aria-label="Remove ${student.name}"
        ><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>

      <dl>
        <div><dt>Teacher</dt><dd>${activeTeacher.name}</dd></div>
        <div><dt>HCAS 7C</dt><dd>${selectedValue ? selectedValue.name : "Choose one"}</dd></div>
        <div><dt>Points</dt><dd>${selectedPoints ? `+${selectedPoints}` : "Choose one"}</dd></div>
        <div class="summary-comment-row">
          <dt>Comment</dt>
          <dd class="send-comment-preview ${sendComment.trim() ? "" : "is-empty"}">${commentLabel}</dd>
        </div>
      </dl>

      <button
        class="primary-button send-button"
        type="button"
        data-action="send-award"
        data-student-id="${student.id}"
        ${canSend ? "" : "disabled"}
      >${selectedPoints ? `Send ${selectedPoints} points to ${student.name}` : `Send points to ${student.name}`}</button>
      <p class="helper-text">The points will be added to ${house.name}.</p>
    </article>
  `;
}

function renderSend() {
  const filteredStudents = syncSendStudents();
  const selectedStudents = sendStudentIds.map(getStudent).filter(Boolean);
  const selectedValue = selectedValueId ? getValue(selectedValueId) : null;
  const canSend = Boolean(selectedValue && selectedPoints);

  return `
    <div class="page">
      ${renderPageHeader("Send points", "Choose a 7C, points, one or more students, and an optional comment.")}

      ${lastConfirmation ? renderConfirmation(lastConfirmation) : ""}

      <form id="award-form" class="send-layout">
        <section class="panel award-form-panel" aria-labelledby="choose-value-title">
          <fieldset class="value-choice">
            <legend id="choose-value-title"><span>1</span> Choose a 7C</legend>
            <div class="value-options" aria-label="HCAS 7C options">
              ${VALUES.map(
                (value) => `
                  <button
                    class="value-option ${value.id === selectedValueId ? "is-selected" : ""}"
                    type="button"
                    data-action="choose-value"
                    data-value-id="${value.id}"
                    aria-pressed="${value.id === selectedValueId}"
                    aria-label="${value.name}: ${value.description}"
                  >
                    <span class="value-logo" style="--value-logo: url('${value.image}')" aria-hidden="true"></span>
                    <strong>${value.name}</strong>
                  </button>
                `
              ).join("")}
            </div>
          </fieldset>

          <fieldset class="point-choice">
            <legend><span>2</span> Choose points</legend>
            <div class="point-options" aria-label="Point amount">
              ${POINT_OPTIONS.map(
                (points) => `
                  <button
                    class="point-option ${points === selectedPoints ? "is-selected" : ""}"
                    type="button"
                    data-action="choose-points"
                    data-points="${points}"
                    aria-pressed="${points === selectedPoints}"
                  >
                    <strong>${points}</strong>
                    <span>pts</span>
                  </button>
                `
              ).join("")}
            </div>
          </fieldset>

          <fieldset class="student-choice">
            <legend><span>3</span> Choose students</legend>
            <div class="send-filters">
              <label for="send-grade-filter">
                Grade
                <select id="send-grade-filter" class="${sendGradeFilter === "all" ? "" : "has-selection"}">
                  <option value="all" ${sendGradeFilter === "all" ? "selected" : ""}>All grades</option>
                  ${[9, 10, 11, 12]
                    .map(
                      (grade) =>
                        `<option value="${grade}" ${sendGradeFilter === String(grade) ? "selected" : ""}>Grade ${grade}</option>`
                    )
                    .join("")}
                </select>
              </label>
              <label for="send-house-filter">
                House
                <select id="send-house-filter" class="${sendHouseFilter === "all" ? "" : "has-selection"}">
                  <option value="all" ${sendHouseFilter === "all" ? "selected" : ""}>All houses</option>
                  ${HOUSES.map(
                    (filterHouse) =>
                      `<option value="${filterHouse.id}" ${sendHouseFilter === filterHouse.id ? "selected" : ""}>${filterHouse.name}</option>`
                  ).join("")}
                </select>
              </label>
            </div>

            <div class="student-select-heading">
              <span>Students</span>
              <span>${formatStudentCount(filteredStudents.length)} available · ${sendStudentIds.length} selected</span>
            </div>
            ${filteredStudents.length ? `
              <div class="send-student-options" role="group" aria-label="Students">
                ${filteredStudents.map(renderSendStudentOption).join("")}
              </div>
            ` : `
              <div class="no-filter-results">
                <p>No students are in this grade and house combination.</p>
                <button type="button" data-action="reset-send-filters">Clear filters</button>
              </div>
            `}
          </fieldset>

          <fieldset class="comment-choice">
            <legend><span>4</span> Add a comment <small>Optional</small></legend>
            <label class="sr-only" for="send-comment">Comment</label>
            <textarea
              id="send-comment"
              maxlength="${MAX_COMMENT_LENGTH}"
              placeholder="Add a short note about this recognition"
              aria-describedby="send-comment-help send-comment-count"
            >${escapeHtml(sendComment)}</textarea>
            <div class="comment-meta">
              <span id="send-comment-help">Saved with each recognition you send.</span>
              <span id="send-comment-count">${sendComment.length}/${MAX_COMMENT_LENGTH}</span>
            </div>
          </fieldset>
        </section>

        <aside class="send-summary-list" aria-label="Recognition summaries">
          ${selectedStudents.length
            ? selectedStudents.map((student) => renderSendSummary(student, selectedValue, canSend)).join("")
            : `
              <section class="send-summary send-summary-empty">
                <div class="summary-house summary-house-empty">
                  <div>
                    <span>Selected students</span>
                    <h2>No student selected</h2>
                    <p>Choose one or more students to continue.</p>
                  </div>
                </div>
              </section>
            `}
        </aside>
      </form>
    </div>
  `;
}

function renderConfirmation(confirmation) {
  const student = getStudent(confirmation.studentId);
  const house = getHouse(student.houseId);
  const value = getValue(confirmation.valueId);
  return `
    <section class="confirmation" aria-label="Recognition sent">
      <span class="confirmation-check" aria-hidden="true">✓</span>
      <div>
        <strong>${confirmation.points} points sent to ${student.name}</strong>
        <p>${value.name} · ${house.name}</p>
        ${renderRecognitionComment(confirmation.comment)}
      </div>
      <button type="button" data-action="open-student" data-student-id="${student.id}">View student</button>
    </section>
  `;
}

function getFilteredStudents() {
  return state.students.filter((student) => {
    const matchesName = student.name.toLowerCase().includes(studentQuery.trim().toLowerCase());
    const matchesHouse = houseFilter === "all" || student.houseId === houseFilter;
    const matchesGrade =
      studentGradeFilter === "all" || String(student.grade) === studentGradeFilter;
    return matchesName && matchesHouse && matchesGrade;
  });
}

function formatStudentCount(count) {
  return `${count} ${count === 1 ? "student" : "students"}`;
}

function renderStudents() {
  const filteredStudents = getFilteredStudents();

  return `
    <div class="page">
      ${renderPageHeader("Students", "")}

      <section class="student-controls" aria-label="Student filters">
        <label class="search-field" for="student-search">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m20 19-4.4-4.4a7 7 0 1 0-1.4 1.4l4.4 4.4L20 19ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" /></svg>
          <span class="sr-only">Search students</span>
          <input id="student-search" type="search" placeholder="Search by name" value="${studentQuery}" autocomplete="off" />
        </label>
        <div class="house-filters" aria-label="Filter by house">
          <button type="button" data-action="filter-house" data-house-id="all" class="${houseFilter === "all" ? "is-selected" : ""}">All houses</button>
          ${HOUSES.map(
            (house) => `
              <button type="button" data-action="filter-house" data-house-id="${house.id}" class="${houseFilter === house.id ? "is-selected" : ""}">
                <img src="${house.image}" alt="" />
                ${house.name}
              </button>
            `
          ).join("")}
        </div>
        <div class="grade-filters" aria-label="Filter by grade">
          <button type="button" data-action="filter-grade" data-grade="all" class="${studentGradeFilter === "all" ? "is-selected" : ""}">All grades</button>
          ${[9, 10, 11, 12]
            .map(
              (grade) => `
                <button type="button" data-action="filter-grade" data-grade="${grade}" class="${studentGradeFilter === String(grade) ? "is-selected" : ""}">
                  Grade ${grade}
                </button>
              `
            )
            .join("")}
        </div>
      </section>

      <div class="students-layout">
        <section class="panel student-list-panel" aria-labelledby="student-count">
          <div class="list-heading">
            <h2 id="student-count">${formatStudentCount(filteredStudents.length)}</h2>
            <span>Click an emblem to view details</span>
          </div>
          <div class="student-crest-grid" id="student-list">
            ${renderStudentGallery()}
          </div>
        </section>

        <div id="student-detail-region" aria-live="polite">
          ${renderStudentDetailRegion()}
        </div>
      </div>
    </div>
  `;
}

function renderStudentGallery() {
  const students = getFilteredStudents();

  if (!students.length) {
    return `
      <div class="empty-state">
        <strong>No students found</strong>
        <p>Try another name, house, or grade.</p>
      </div>
    `;
  }

  return students
    .map((student) => {
      const house = getHouse(student.houseId);
      const totalPoints = getStudentTotal(state, student.id);
      const namePathId = `${student.id}-name-curve`;
      const gradePathId = `${student.id}-grade-curve`;
      return `
        <button
          class="student-crest ${student.id === profileStudentId ? "is-selected" : ""}"
          type="button"
          data-action="select-student"
          data-student-id="${student.id}"
          aria-pressed="${student.id === profileStudentId}"
          aria-label="${student.name}, Grade ${student.grade}, ${house.name}, ${totalPoints} points"
        >
          <span class="student-crest-visual" aria-hidden="true">
            <svg viewBox="0 0 220 220">
              <defs>
                <path id="${namePathId}" d="M 24 73 Q 110 1 196 73" />
                <path id="${gradePathId}" d="M 36 174 Q 110 224 184 174" />
              </defs>
              <image href="${house.image}" x="38" y="39" width="144" height="144" preserveAspectRatio="xMidYMid meet" />
              <text class="student-crest-name">
                <textPath href="#${namePathId}" startOffset="50%" text-anchor="middle">${student.name}</textPath>
              </text>
              <text class="student-crest-grade">
                <textPath href="#${gradePathId}" startOffset="50%" text-anchor="middle">GRADE ${student.grade}</textPath>
              </text>
            </svg>
            <b class="student-points-badge">${totalPoints}</b>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderStudentDetailRegion() {
  const isStudentVisible = getFilteredStudents().some(
    (student) => student.id === profileStudentId
  );

  if (!profileStudentId || !isStudentVisible) {
    profileStudentId = null;
    expandedStudentValueId = null;
    return "";
  }

  return `
    <section class="panel student-detail" id="student-detail">
      ${renderStudentDetail()}
    </section>
  `;
}

function renderStudentValueHistory(student, value) {
  const awards = getStudentAwards(state, student.id, value.id);

  return `
    <div class="student-value-history" id="${student.id}-${value.id}-history">
      <div class="value-history-heading">
        <strong>${value.name} history</strong>
        <span>${awards.length} ${awards.length === 1 ? "recognition" : "recognitions"}</span>
      </div>
      ${awards.length ? `
        <ul>
          ${awards
            .map((award) => {
              const teacher = getTeacher(award.teacherId);
              return `
                <li>
                  <span class="history-teacher-avatar" aria-hidden="true">${teacher.name.charAt(0)}</span>
                  <div>
                    <strong>${teacher.name}</strong>
                    <time datetime="${award.createdAt}">${formatDateTime(award.createdAt)}</time>
                    ${renderRecognitionComment(award.comment)}
                  </div>
                  <b class="points-notification">+${award.points}</b>
                </li>
              `;
            })
            .join("")}
        </ul>
      ` : '<p class="empty-value-history">No recognitions for this 7C yet.</p>'}
    </div>
  `;
}

function renderStudentDetail() {
  const student = getStudent(profileStudentId);
  if (!student) return "";
  const house = getHouse(student.houseId);
  const stats = getStudentStats(state, student.id);
  const totalPoints = getStudentTotal(state, student.id);
  const maxRecognitions = Math.max(...Object.values(stats).map((stat) => stat.recognitions), 1);

  return `
    <button class="profile-close" type="button" data-action="close-student-detail" aria-label="Close ${student.name}'s profile">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
    <div class="profile-heading" style="--house-color: ${house.color}">
      <img src="${house.image}" alt="${house.name} emblem" />
      <div>
        <span>Grade ${student.grade} · ${house.name}</span>
        <h2>${student.name}</h2>
      </div>
      <div class="profile-total"><strong>${totalPoints}</strong><span>total points</span></div>
    </div>

    <div class="value-breakdown">
      <div class="breakdown-heading"><h3>7C breakdown</h3><span>Coins · points</span></div>
      ${VALUES.map((value) => {
        const stat = stats[value.id];
        const width = (stat.recognitions / maxRecognitions) * 100;
        const isExpanded = expandedStudentValueId === value.id;
        return `
          <div class="student-value-entry ${isExpanded ? "is-expanded" : ""}">
            <button
              class="breakdown-row"
              type="button"
              data-action="toggle-student-value"
              data-value-id="${value.id}"
              aria-expanded="${isExpanded}"
              aria-controls="${student.id}-${value.id}-history"
            >
              <span class="value-mini-logo" style="--value-logo: url('${value.image}')" aria-hidden="true"></span>
              <span class="breakdown-name">
                <strong>${value.name}</strong>
                <span class="breakdown-track" aria-hidden="true"><span style="width: ${width}%"></span></span>
              </span>
              <span class="coin-count">${stat.recognitions} ${stat.recognitions === 1 ? "coin" : "coins"}</span>
              <strong class="value-points">${stat.points}</strong>
              <svg class="value-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m8 10 4 4 4-4" /></svg>
            </button>
            ${isExpanded ? renderStudentValueHistory(student, value) : ""}
          </div>
        `;
      }).join("")}
    </div>

    <button class="secondary-button profile-send" type="button" data-action="send-to-student" data-student-id="${student.id}">
      Send points to ${student.name}
    </button>
  `;
}

function renderTeacherValueHistory(value, awards) {
  const valueAwards = awards.filter((award) => award.valueId === value.id);

  return `
    <div class="teacher-value-history" id="teacher-${value.id}-history">
      <div class="value-history-heading">
        <strong>${value.name} history</strong>
        <span>${valueAwards.length} ${valueAwards.length === 1 ? "recognition" : "recognitions"}</span>
      </div>
      ${valueAwards.length ? `
        <ul>
          ${valueAwards
            .map((award) => {
              const student = getStudent(award.studentId);
              const house = getHouse(student.houseId);
              return `
                <li>
                  <div class="teacher-history-entry">
                    ${renderStudentIdentity(student, {
                      secondary: `Grade ${student.grade} · ${house.name}`,
                      points: `+${award.points}`,
                      action: true,
                      className: "is-compact"
                    })}
                    ${renderRecognitionComment(award.comment)}
                  </div>
                  <time datetime="${award.createdAt}">${formatDateTime(award.createdAt)}</time>
                </li>
              `;
            })
            .join("")}
        </ul>
      ` : '<p class="empty-value-history">No recognitions for this 7C yet.</p>'}
    </div>
  `;
}

function renderTeacherActivity() {
  const awards = getTeacherAwards(state, activeTeacher.id);
  const stats = getTeacherStats(state, activeTeacher.id);
  const totalPoints = awards.reduce((total, award) => total + award.points, 0);
  const maxRecognitions = Math.max(...Object.values(stats).map((stat) => stat.recognitions), 1);

  return `
    <div class="page">
      ${renderPageHeader("My activity", "")}

      <div class="teacher-activity-layout">
        <section class="panel teacher-breakdown-panel" aria-labelledby="teacher-breakdown-title">
          <div class="panel-heading">
            <div>
              <h2 id="teacher-breakdown-title">7C breakdown</h2>
              <p>${activeTeacher.name}'s recognitions</p>
            </div>
            <span class="teacher-total">${totalPoints} pts</span>
          </div>

          <div class="teacher-stats">
            ${VALUES.map((value) => {
              const stat = stats[value.id];
              const width = (stat.recognitions / maxRecognitions) * 100;
              const isExpanded = expandedTeacherValueId === value.id;
              return `
                <div class="teacher-value-entry ${isExpanded ? "is-expanded" : ""}">
                  <button
                    class="teacher-stat-row"
                    type="button"
                    data-action="toggle-teacher-value"
                    data-value-id="${value.id}"
                    aria-expanded="${isExpanded}"
                    aria-controls="teacher-${value.id}-history"
                  >
                    <span class="value-mini-logo" style="--value-logo: url('${value.image}')" aria-hidden="true"></span>
                    <span class="teacher-stat-name">
                      <strong>${value.name}</strong>
                      <span class="breakdown-track" aria-hidden="true"><span style="width: ${width}%"></span></span>
                    </span>
                    <span class="teacher-coin-count">${stat.recognitions} ${stat.recognitions === 1 ? "coin" : "coins"}</span>
                    <b>${stat.points}</b>
                    <svg class="value-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m8 10 4 4 4-4" /></svg>
                  </button>
                  ${isExpanded ? renderTeacherValueHistory(value, awards) : ""}
                </div>
              `;
            }).join("")}
          </div>
        </section>

        <section class="panel teacher-history-panel" aria-labelledby="teacher-history-title">
          <div class="panel-heading">
            <div>
              <h2 id="teacher-history-title">Recognition history</h2>
              <p>Newest first</p>
            </div>
            <span class="history-count">${awards.length}</span>
          </div>

          ${awards.length ? `
            <ul class="teacher-history-list">
              ${awards.map((award) => {
                const student = getStudent(award.studentId);
                const house = getHouse(student.houseId);
                const value = getValue(award.valueId);
                return `
                  <li>
                    <div class="teacher-history-entry">
                      ${renderStudentIdentity(student, {
                        secondary: `${value.name} · ${house.name}`,
                        points: `+${award.points}`,
                        action: true,
                        className: "is-compact"
                      })}
                      ${renderRecognitionComment(award.comment)}
                    </div>
                    <time class="recognition-time" datetime="${award.createdAt}">${formatDateTime(award.createdAt)}</time>
                    <button
                      class="unsend-button"
                      type="button"
                      data-action="unsend-points"
                      data-award-id="${award.id}"
                      aria-label="Unsend ${award.points} points from ${student.name}"
                    >Unsend points</button>
                  </li>
                `;
              }).join("")}
            </ul>
          ` : `
            <div class="empty-state">
              <strong>No activity yet</strong>
              <p>Your first recognition will appear here.</p>
            </div>
          `}
        </section>
      </div>
    </div>
  `;
}

function refreshStudentBrowser() {
  const list = document.querySelector("#student-list");
  const detail = document.querySelector("#student-detail-region");
  const count = document.querySelector("#student-count");
  if (!list || !detail || !count) return;

  list.innerHTML = renderStudentGallery();
  detail.innerHTML = renderStudentDetailRegion();
  count.textContent = formatStudentCount(getFilteredStudents().length);
}

function render() {
  const isLoggedIn = Boolean(activeTeacher);
  document.body.classList.toggle("is-logged-out", !isLoggedIn);

  if (!isLoggedIn) {
    viewRoot.innerHTML = "";
    topbarHouseScores.innerHTML = "";
    return;
  }

  teacherName.textContent = activeTeacher.name;
  teacherAvatar.alt = `${activeTeacher.name}'s Dalton Plan House Teams emblem`;
  renderTopbarHouseScores();

  document.querySelectorAll("[data-view]").forEach((button) => {
    const isActive = button.dataset.view === activeView;
    button.classList.toggle("is-active", isActive);
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  if (activeView === "send") viewRoot.innerHTML = renderSend();
  else if (activeView === "students") viewRoot.innerHTML = renderStudents();
  else if (activeView === "activity") viewRoot.innerHTML = renderTeacherActivity();
  else viewRoot.innerHTML = renderDashboard();
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const teacher = authenticateTeacher(formData.get("username"), formData.get("password"));

  if (!teacher) {
    loginError.textContent = "Incorrect username or password.";
    document.querySelector("#login-password").select();
    return;
  }

  activeTeacher = teacher;
  saveTeacherSession(teacher);
  loginError.textContent = "";
  loginForm.reset();
  render();
  viewRoot.focus({ preventScroll: true });
  showToast(`Logged in as ${teacher.name}.`);
});

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    if (viewButton.dataset.view === "send" && activeView !== "send") {
      resetSendSelection();
    }
    setView(viewButton.dataset.view);
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  switch (actionTarget.dataset.action) {
    case "logout":
      sessionStorage.removeItem(SESSION_KEY);
      activeTeacher = null;
      activeView = "dashboard";
      resetSendSelection();
      expandedStudentValueId = null;
      expandedTeacherValueId = null;
      window.location.hash = "dashboard";
      render();
      document.querySelector("#login-username").focus();
      break;
    case "go-send":
      resetSendSelection();
      setView("send");
      break;
    case "toggle-house-leaders": {
      const houseId = actionTarget.dataset.houseId;
      expandedHouseId = expandedHouseId === houseId ? null : houseId;
      render();
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-action="toggle-house-leaders"][data-house-id="${houseId}"]`)
          ?.focus({ preventScroll: true });
      });
      break;
    }
    case "show-house-leaders": {
      const houseId = actionTarget.dataset.houseId;
      expandedHouseId = houseId;
      if (activeView !== "dashboard") setView("dashboard");
      else render();
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-house-entry="${houseId}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      break;
    }
    case "choose-value":
      selectedValueId = actionTarget.dataset.valueId;
      render();
      break;
    case "choose-points":
      selectedPoints = Number(actionTarget.dataset.points);
      render();
      break;
    case "toggle-send-student": {
      const studentId = actionTarget.dataset.studentId;
      if (!getStudent(studentId)) break;
      sendStudentIds = sendStudentIds.includes(studentId)
        ? sendStudentIds.filter((selectedId) => selectedId !== studentId)
        : [...sendStudentIds, studentId];
      render();
      break;
    }
    case "remove-send-student":
      sendStudentIds = sendStudentIds.filter(
        (studentId) => studentId !== actionTarget.dataset.studentId
      );
      render();
      break;
    case "send-award": {
      const studentId = actionTarget.dataset.studentId;
      if (
        !selectedValueId ||
        !selectedPoints ||
        !activeTeacher ||
        !sendStudentIds.includes(studentId)
      ) break;

      const student = getStudent(studentId);
      const value = getValue(selectedValueId);
      const pointsSent = selectedPoints;
      const comment = sendComment;
      state = addAward(
        state,
        studentId,
        selectedValueId,
        activeTeacher.id,
        pointsSent,
        Date.now(),
        comment
      );
      saveState();
      lastConfirmation = {
        studentId,
        valueId: selectedValueId,
        points: pointsSent,
        comment: comment.trim()
      };
      sendStudentIds = sendStudentIds.filter((selectedId) => selectedId !== studentId);

      if (!sendStudentIds.length) {
        selectedValueId = null;
        selectedPoints = null;
        sendComment = "";
      }

      render();
      showToast(`${pointsSent} points sent to ${student.name} for ${value.name}.`);
      break;
    }
    case "reset-send-filters":
      sendGradeFilter = "all";
      sendHouseFilter = "all";
      render();
      break;
    case "open-student":
    case "select-student":
      if (profileStudentId !== actionTarget.dataset.studentId) {
        expandedStudentValueId = null;
      }
      profileStudentId = actionTarget.dataset.studentId;
      if (activeView !== "students") {
        studentQuery = "";
        houseFilter = "all";
        studentGradeFilter = "all";
        setView("students", { studentId: profileStudentId });
      } else {
        refreshStudentBrowser();
        window.requestAnimationFrame(() => {
          document.querySelector("#student-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      break;
    case "toggle-student-value": {
      const valueId = actionTarget.dataset.valueId;
      expandedStudentValueId = expandedStudentValueId === valueId ? null : valueId;
      refreshStudentBrowser();
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-action="toggle-student-value"][data-value-id="${valueId}"]`)
          ?.focus({ preventScroll: true });
      });
      break;
    }
    case "toggle-teacher-value": {
      const valueId = actionTarget.dataset.valueId;
      expandedTeacherValueId = expandedTeacherValueId === valueId ? null : valueId;
      render();
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-action="toggle-teacher-value"][data-value-id="${valueId}"]`)
          ?.focus({ preventScroll: true });
      });
      break;
    }
    case "close-student-detail":
      profileStudentId = null;
      expandedStudentValueId = null;
      refreshStudentBrowser();
      break;
    case "filter-house":
      houseFilter = actionTarget.dataset.houseId;
      render();
      break;
    case "filter-grade":
      studentGradeFilter = actionTarget.dataset.grade;
      render();
      break;
    case "unsend-points": {
      const awardId = actionTarget.dataset.awardId;
      const award = state.awards.find((item) => item.id === awardId);
      if (!award || award.teacherId !== activeTeacher.id) break;
      const student = getStudent(award.studentId);
      const shouldUnsend = window.confirm(
        `Unsend ${award.points} points from ${student.name}? Student and house totals will update immediately.`
      );
      if (!shouldUnsend) break;
      state = removeAward(state, awardId, activeTeacher.id);
      saveState();
      render();
      showToast(`${award.points} points unsent from ${student.name}.`);
      break;
    }
    case "send-to-student":
      resetSendSelection();
      sendStudentIds = [actionTarget.dataset.studentId];
      sendGradeFilter = "all";
      sendHouseFilter = "all";
      setView("send");
      break;
  }
});

viewRoot.addEventListener("change", (event) => {
  if (event.target.matches("#send-grade-filter")) {
    sendGradeFilter = event.target.value;
    render();
  } else if (event.target.matches("#send-house-filter")) {
    sendHouseFilter = event.target.value;
    render();
  }
});

viewRoot.addEventListener("input", (event) => {
  if (event.target.matches("#student-search")) {
    studentQuery = event.target.value;
    refreshStudentBrowser();
  } else if (event.target.matches("#send-comment")) {
    sendComment = event.target.value.slice(0, MAX_COMMENT_LENGTH);
    const count = document.querySelector("#send-comment-count");
    if (count) count.textContent = `${sendComment.length}/${MAX_COMMENT_LENGTH}`;
    document.querySelectorAll(".send-comment-preview").forEach((preview) => {
      const normalizedComment = sendComment.trim();
      preview.textContent = normalizedComment || "No comment";
      preview.classList.toggle("is-empty", !normalizedComment);
    });
  }
});

viewRoot.addEventListener("submit", (event) => {
  if (!event.target.matches("#award-form")) return;
  event.preventDefault();
});

window.addEventListener("hashchange", () => {
  const view = getViewFromHash();
  if (view !== activeView) {
    if (view === "send") resetSendSelection();
    activeView = view;
    render();
  }
});

render();

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("DaltonHCAS could not enable offline access.", error);
    });
  });
}

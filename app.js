import {
  ACADEMIC_CONCERN_EXAMPLES,
  ACADEMIC_PROFILES,
  BEHAVIOR_ISSUES,
  BEHAVIOR_LOCATIONS,
  BEHAVIOR_RESPONSE_OPTIONS,
  BEHAVIOR_STRATEGY_GROUPS,
  HOUSES,
  MAX_CONCERN_DESCRIPTION_LENGTH,
  MAX_CONCERN_TITLE_LENGTH,
  MAX_INTERNAL_NOTE_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_ATTACHMENT_DATA_LENGTH,
  POINT_OPTIONS,
  SEL_CONCERN_OPTIONS,
  TEACHERS,
  TEACHER_ROLE_LABELS,
  TEACHER_ROLES,
  TIER_ONE_INSTRUCTIONAL_STRATEGIES,
  TIER_TWO_ACADEMIC_INTERVENTIONS,
  VALUES,
  addAcademicConcern as localAddAcademicConcern,
  addCustomCalendarEvent as localAddCustomCalendarEvent,
  addLabAssignment as localAddLabAssignment,
  addAward as localAddAward,
  addBehaviorConcern as localAddBehaviorConcern,
  addSelCheckIn as localAddSelCheckIn,
  addSelConcern as localAddSelConcern,
  authenticateUser,
  canEditCalendarEvent,
  canEditStudentRecord,
  createStudentAccount as localCreateStudentAccount,
  createTeacherAccount as localCreateTeacherAccount,
  createInitialState,
  getBehaviorCodeActions,
  getCalendarEvents,
  getHouseLeaders,
  getHouseTotals,
  getStudentAcademicConcerns,
  getStudentAwards,
  getStudentBehaviorConcerns,
  getStudentSelCheckIns,
  getStudentSelConcerns,
  getStudentRanking,
  getStudentStats,
  getStudentTotal,
  getTeacherPermissions,
  getTeacherLevelUpGrades,
  isHouseLeaderTeacher,
  migrateStoredState,
  removeAward as localRemoveAward,
  removeLabAssignment as localRemoveLabAssignment,
  setHouseLeader as localSetHouseLeader,
  transferStudentHouse as localTransferStudentHouse,
  updateAward as localUpdateAward,
  updateCalendarEventDetails as localUpdateCalendarEventDetails,
  updateConcern as localUpdateConcern,
  updateTeacherAccountStatus as localUpdateTeacherAccountStatus
} from "./data.js";
import { cloudEnabled, cloudLogin, cloudCall, cloudChangePassword, cloudLogout, hasCloudSession } from "./cloud-client.js";
import { SMART_FIELDS, isSupervisor } from "./support-rules.js";
import { renderIepHeart, renderSupportProfile } from "./support-ui.js";
import { renderFollowupNotifications as renderSupportNotifications, responseHistory, checkInRow } from "./followup-ui.js";
import { academicStrategies, behavioralStrategies, selOptions } from "./tier-rules.js";
import { enablePhonePush, disablePhonePush, initializePhonePush } from "./push-client.js";
import { renderLevelUpAttachments, canReadLevelUpDocument } from "./levelup-resources.js";
import { openPdfReader } from "./pdf-reader.js";
import { emptyStudentFilters, hasStudentFilter, matchingStudents, studentCrestVisual } from "./student-ui.js";
import { ACTIVITY_TYPES, ACTIVITY_ACTIONS, staffActivity, filterActivity, recordActivity, alphabeticStaff } from "./activity.js";
import { rememberFormSteps, enhanceFormSteps, revealInvalidField } from "./form-steps.js";
let phonePushStatus = "";
let crestInstance = 0;
const formStepState = new Map();
const activityFilters = { query: "", type: "", action: "", house: "", grade: "", from: "", to: "", valueId: "", points: "" };

let pendingCloudCommand = null;
let cloudSnapshot = null;
let cloudBusy = false;
let mustChangePassword = false;
function stageCloud(action, payload, nextState) {
  if (cloudEnabled) pendingCloudCommand = { action, payload };
  return cloudEnabled ? nextState : recordActivity(state, nextState, activeUser, action, payload);
}
const addAward = (s, studentId, valueId, teacherId, points, now, comment, editorIds) => stageCloud("award-add", { studentId, valueId, points, comment, editorIds }, localAddAward(s, studentId, valueId, teacherId, points, now, comment, editorIds));
const removeAward = (s, id, teacherId) => stageCloud("award-remove", { id }, localRemoveAward(s, id, teacherId));
const updateAward = (s, id, teacherId, changes) => stageCloud("award-update", { id, changes }, localUpdateAward(s, id, teacherId, changes));
const stageConcern = (type, fn, s, input) => stageCloud("concern-add", { type, input: { ...input, requestSmartGoal: Boolean(document.querySelector('[name="requestSmartGoal"]:checked')), notificationRecipientIds: [...document.querySelectorAll('[name="notificationRecipientIds"]:checked')].map(el => el.value) } }, fn(s, input));
const addBehaviorConcern = (s, input) => stageConcern("behavior", localAddBehaviorConcern, s, input);
const addAcademicConcern = (s, input) => stageConcern("academic", localAddAcademicConcern, s, input);
const addSelConcern = (s, input) => stageConcern("sel", localAddSelConcern, s, input);
const updateConcern = (s, type, id, teacherId, changes) => stageCloud("concern-update", { type, id, changes }, localUpdateConcern(s, type, id, teacherId, changes));
const addSelCheckIn = (s, user, input) => stageCloud("check-in", input, localAddSelCheckIn(s, user, input));
const createStudentAccount = (s, user, input) => stageCloud("student-create", input, localCreateStudentAccount(s, user, input));
const createTeacherAccount = (s, user, input) => stageCloud("teacher-create", input, localCreateTeacherAccount(s, user, input));
const updateTeacherAccountStatus = (s, user, id, changes) => stageCloud("teacher-status", { id, changes }, localUpdateTeacherAccountStatus(s, user, id, changes));
const transferStudentHouse = (s, user, id, houseId) => stageCloud("student-transfer", { id, houseId }, localTransferStudentHouse(s, user, id, houseId));
const setHouseLeader = (s, houseId, studentId, enabled = true) => stageCloud("house-leader", { houseId, studentId, enabled }, localSetHouseLeader(s, houseId, studentId, enabled));
const addLabAssignment = (s, input) => stageCloud("lab-add", input, localAddLabAssignment(s, input));
const removeLabAssignment = (s, id) => stageCloud("lab-remove", { id }, localRemoveLabAssignment(s, id));
const addCustomCalendarEvent = (s, user, input) => stageCloud("event-add", input, localAddCustomCalendarEvent(s, user, input));
const updateCalendarEventDetails = (s, user, event, changes) => stageCloud("event-update", { id: event.id, changes }, localUpdateCalendarEventDetails(s, user, event, changes));

const STORAGE_KEY = "hcas-house-points-v9";
const LEGACY_STORAGE_KEYS = ["hcas-house-points-v8", "hcas-house-points-v7", "hcas-house-points-v6", "hcas-house-points-v5", "hcas-house-points-v4", "hcas-house-points-v3", "hcas-house-points-v2"];
const SESSION_KEY = "hcas-house-points-user-v9";
const LEGACY_SESSION_KEY = "hcas-house-points-teacher";
const viewRoot = document.querySelector("#view-root");
const toast = document.querySelector("#toast");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const teacherName = document.querySelector("#teacher-name");
const teacherAvatar = document.querySelector("#teacher-avatar");
const topbarHouseScores = document.querySelector("#topbar-house-scores");

let state = loadState();
let activeUser = cloudEnabled ? null : loadUserSession();
let activeTeacher = activeUser?.type === "teacher" ? activeUser : null;
let activeView = getViewFromHash();
let selectedValueId = null;
let selectedPoints = null;
let sendStudentIds = [];
let sendGradeFilter = "";
let sendHouseFilter = "";
let sendStudentQuery = "";
let sendComment = "";
let sendEditorIds = [];
let profileStudentId = null;
let studentQuery = "";
let houseFilter = "";
let studentGradeFilter = "";
let expandedHouseId = null;
let expandedStudentValueId = null;
const profileConcernFilters = {
  behavior: "all",
  academic: "all",
  sel: "all"
};
let lastConfirmation = null;
let rankingValueFilter = "";
let rankingFilters = emptyStudentFilters();
let rankingDateFrom = "";
let rankingDateTo = "";
let rankingExpanded = false;
let lastConcernConfirmation = null;
let concernStudentPreset = null;
const concernStudentFilters = {
  "behavior-concern": emptyStudentFilters(),
  "academic-concern": emptyStudentFilters(),
  "sel-concern": emptyStudentFilters()
};
let calendarWeekStart = getInitialCalendarWeek();
let calendarTeacherGrade = "";
let selectedCalendarEventId = null;
let calendarCreateOpen = false;
let selCheckInOpen = false;
let lastCreatedAccount = null;
let recordEditTarget = null;
let toastTimer;

function loadState() {
  if (cloudEnabled) return createInitialState();
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

async function saveState() {
  if (cloudEnabled) {
    if (!pendingCloudCommand) throw new Error("No server action was selected");
    const command = pendingCloudCommand;
    pendingCloudCommand = null;
    cloudBusy = true;
    try { applyCloudResult(await cloudCall(command.action, { payload: command.payload })); }
    catch (error) { if (cloudSnapshot) state = structuredClone(cloudSnapshot); throw error; }
    finally { cloudBusy = false; }
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function commitState(nextState, message = "") {
  state = nextState;
  await saveState();
  render();
  if (message) showToast(message);
}

function applyCloudResult(result) {
  const previousAccount = activeUser?.id;
  const neededPassword = mustChangePassword;
  activeUser = result.user;
  activeTeacher = activeUser?.type === "teacher" ? activeUser : null;
  mustChangePassword = Boolean(result.mustChangePassword);
  if (result.newAccountCredential) lastCreatedAccount = result.newAccountCredential;
  if (result.state) { state = result.state; cloudSnapshot = structuredClone(result.state); }
  if (!mustChangePassword && (previousAccount !== activeUser?.id || neededPassword)) queueMicrotask(() => window.dispatchEvent(new Event("school-session-ready")));
}

async function openIepReader(documentId) {
  if (activeUser?.type !== "teacher") return;
  const doc = (state.iepDocuments ?? []).find(item => item.id === documentId);
  if (!doc) return;
  await readSchoolPdf("iep-read", documentId, doc.name, "Private IEP · staff only");
}

async function readSchoolPdf(action, id, name, label) {
  const requestorId = activeUser?.id;
  const blob = await cloudCall(action, { id });
  if (!requestorId || activeUser?.id !== requestorId || mustChangePassword) return;
  openPdfReader(blob, { name, label });
}

async function handleSupportClick(button) {
  const action = button.dataset.action;
  if (action === "open-levelup-document") {
    const doc = (state.levelUpDocuments ?? []).find(item => item.id === button.dataset.documentId);
    if (!canReadLevelUpDocument(activeUser, doc)) return true;
    button.disabled = true;
    try { await readSchoolPdf("levelup-document-read", doc.id, doc.filename, doc.edition === "teacher" ? "Level-Up · Teacher guide · Staff only" : "Level-Up · Student workbook"); }
    finally { button.disabled = false; }
  } else if (action === "enable-push" || action === "disable-push") {
    phonePushStatus = "Updating notification permission…";
    const status = document.querySelector("[data-push-status]");
    if (status) status.textContent = phonePushStatus;
    button.disabled = true;
    try { phonePushStatus = action === "enable-push" ? await enablePhonePush() : await disablePhonePush(); } catch (error) { phonePushStatus = error.message; }
    const currentStatus = document.querySelector("[data-push-status]");
    if (currentStatus) currentStatus.textContent = phonePushStatus;
    button.disabled = false;
  } else if (action === "add-check-in") {
    button.previousElementSibling.insertAdjacentHTML("beforeend", checkInRow());
  } else if (action === "remove-check-in") {
    button.closest("[data-check-in-row]").remove();
  } else if (action === "concern-response") {
    await runCloudAction("concern-response", { id: button.dataset.concernId, type: button.dataset.concernType, response: button.dataset.response, requestId: crypto.randomUUID() });
  } else if (action === "reflection-reminder") {
    if (await runCloudAction("reflection-reminder", { id: button.dataset.goalId })) showToast("Reflection reminder sent to the student.");
  } else if (action === "open-support-record") {
    openSupportRecord(button.dataset.studentId, button.dataset.recordId);
  } else if (action === "open-iep" || action === "read-iep-document") {
    const docId = button.dataset.documentId ?? [...(state.iepDocuments ?? [])].reverse().find(item => item.studentId === button.dataset.studentId)?.id;
    if (docId) await openIepReader(docId);
  } else if (action === "read-support-notification") {
    await runCloudAction("notification-read", { key: button.dataset.notificationKey });
  } else if (action === "goal-access") {
    await runCloudAction("goal-access", { id: button.dataset.goalId, field: button.dataset.field, canEdit: button.dataset.allow === "true" });
  } else if (action === "urgent-support") {
    const sent = await runCloudAction("urgent-support");
    if (sent) showToast("Your support request was sent to supervising staff and your trusted adult, if selected.");
  } else if (action === "open-support-profile") {
    setView("students", { studentId: button.dataset.studentId });
  } else if (action === "follow-up-goal") {
    const form = viewRoot.querySelector(`[data-support-form="goal-add"][data-student-id="${button.dataset.studentId}"]`);
    if (form) {
      form.closest("details").open = true;
      form.elements.previousGoalId.value = button.dataset.goalId;
      form.elements.title.value = `Follow-up: ${(state.smartGoals ?? []).find(item => item.id === button.dataset.goalId)?.title ?? "Support goal"}`;
      form.elements.title.focus();
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  } else return false;
  return true;
}

async function handleSupportSubmit(form) {
  if (cloudBusy) return;
  const formData = new FormData(form), type = form.dataset.supportForm;
  const errorElement = form.querySelector(".support-error");
  errorElement.textContent = "";
  cloudBusy = true;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    let result;
    if (type === "password") {
      if (formData.get("password") !== formData.get("confirmation")) throw new Error("The two passwords do not match");
      result = await cloudChangePassword(formData.get("password"));
    } else if (type === "iep-upload") {
      const file = formData.get("pdf");
      if (!file?.size || !/\.pdf$/i.test(file.name) || file.size > 10 * 1024 * 1024) throw new Error("Choose a PDF up to 10 MB");
      const encoded = await readFileAsDataUrl(file, 10 * 1024 * 1024, "IEP PDF");
      result = await cloudCall("iep-upload", { studentId: form.dataset.studentId, name: file.name, base64: encoded.split(",")[1] });
    } else {
      const payload = type === "goal-add" ? {
        studentId: form.dataset.studentId, title: formData.get("title"), dueDate: formData.get("dueDate"),
        fields: Object.fromEntries(Object.keys(SMART_FIELDS).map(key => [key, formData.get(key)])),
        studentEditableFields: formData.getAll("studentEditableFields"),
        sourceConcernId: formData.get("sourceConcernId") || null, sourceConcernType: formData.get("sourceConcernType") || null, previousGoalId: formData.get("previousGoalId") || null,
        responsibleTeacherId: formData.get("responsibleTeacherId"), checkIns: readCheckIns(form)
      } : type === "goal-field" ? { id: form.dataset.goalId, field: form.dataset.field, text: formData.get("text"), dueDate: formData.get("dueDate") || undefined }
        : type === "goal-schedule" ? { id: form.dataset.goalId, responsibleTeacherId: formData.get("responsibleTeacherId"), checkIns: readCheckIns(form) }
        : type === "goal-reflection" ? { id: form.dataset.goalId, text: formData.get("text") }
        : type === "goal-close" ? { id: form.dataset.goalId, status: formData.get("status"), note: formData.get("note") }
        : type === "account-reset" ? { id: formData.get("id") } : { teacherId: formData.get("teacherId") };
      result = await cloudCall(type, { payload });
    }
    applyCloudResult(result);
    render();
    showToast("Saved to your school account.");
  } catch (error) { errorElement.textContent = error.message; }
  finally { cloudBusy = false; button.disabled = false; }
}

function readCheckIns(form) {
  return [...form.querySelectorAll("[data-check-in-row]")].map(row => ({ ...(row.dataset.checkInId ? { id: row.dataset.checkInId } : {}), date: row.querySelector("input").value }));
}
function openSupportRecord(studentId, recordId = "") {
  profileConcernFilters.behavior = profileConcernFilters.academic = profileConcernFilters.sel = "all";
  setView("students", { studentId });
  requestAnimationFrame(() => {
    const target = document.getElementById(recordId);
    if (!target) return;
    let parent = target.parentElement;
    while (parent) { if (parent.tagName === "DETAILS") parent.open = true; parent = parent.parentElement; }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.tabIndex = -1; target.focus({ preventScroll: true });
  });
}

async function runCloudAction(action, payload = {}) {
  if (!cloudEnabled) { showToast("This feature uses your secure school account on the published app."); return; }
  if (cloudBusy) return;
  cloudBusy = true;
  try { applyCloudResult(await cloudCall(action, { payload })); render(); return true; }
  catch (error) { showToast(error.message); return false; }
  finally { cloudBusy = false; }
}

function loadUserSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (saved?.type === "teacher") {
      const teacher = (state.teachers ?? TEACHERS).find((item) => item.id === saved.id);
      return teacher ? { type: "teacher", ...teacher } : null;
    }
    if (saved?.type === "student") {
      const student = state.students.find((item) => item.id === saved.id);
      return student ? { type: "student", id: student.id, name: student.name, studentId: student.id } : null;
    }
  } catch {
    // Fall through to the previous teacher-only session format.
  }
  const teacherId = sessionStorage.getItem(LEGACY_SESSION_KEY);
  const teacher = (state.teachers ?? TEACHERS).find((item) => item.id === teacherId);
  return teacher ? { type: "teacher", ...teacher } : null;
}

function saveUserSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ type: user.type, id: user.id }));
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
}

function getViewFromHash() {
  const hash = window.location.hash.replace("#", "");
  if (hash === "activity") return "dashboard";
  return [
    "dashboard",
    "send",
    "behavior-concern",
    "academic-concern",
    "sel-concern",
    "students",
    "administration"
  ].includes(hash)
    ? hash
    : "dashboard";
}

function setView(view, options = {}) {
  if (!activeUser) return;
  if (view === "activity") view = "dashboard";
  if (activeUser.type === "student" && !["dashboard", "students"].includes(view)) view = "dashboard";
  if (view === "administration" && !canAccessAdministration()) view = "dashboard";
  if (view !== activeView && !options.studentId) resetRosterFilters(view);
  if (view !== activeView) for (const key of formStepState.keys()) if (key.startsWith(`${view}:`)) formStepState.delete(key);
  if (concernStudentFilters[view] && !options.presetStudentId) concernStudentPreset = null;
  if (options.presetStudentId) {
    const student = getStudent(options.presetStudentId);
    if (view === "send") sendStudentQuery = student?.name ?? "";
    else if (concernStudentFilters[view]) {
      concernStudentPreset = options.presetStudentId;
      concernStudentFilters[view] = { ...emptyStudentFilters(), query: student?.name ?? "" };
    }
  }
  activeView = view;
  recordEditTarget = null;
  if (options.studentId) {
    if (profileStudentId !== options.studentId) resetProfileConcernFilters();
    profileStudentId = options.studentId;
    studentQuery = getStudent(options.studentId)?.name ?? "";
    houseFilter = studentGradeFilter = "";
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
  return (state.teachers ?? TEACHERS).find((teacher) => teacher.id === teacherId);
}

function getActiveTeacherPermissions() {
  const teacher = activeUser?.type === "teacher" ? getTeacher(activeUser.id) : null;
  return getTeacherPermissions(teacher);
}

function getRequiredRecordEditors() {
  return (state.teachers ?? TEACHERS).filter(
    (teacher) => getTeacherPermissions(teacher).canEditAllStudentRecords
  );
}

function renderEditorAccessPicker({ selectedIds = [], authorId = activeTeacher?.id } = {}) {
  const requiredEditors = getRequiredRecordEditors();
  const optionalEditors = alphabeticStaff((state.teachers ?? TEACHERS).filter(teacher => teacher.id !== authorId && !getTeacherPermissions(teacher).canEditAllStudentRecords));
  const author = getTeacher(authorId);
  const alwaysNames = [author, ...requiredEditors].filter(Boolean).filter((teacher, index, list) => list.findIndex(item => item.id === teacher.id) === index);
  const selected = new Set(selectedIds ?? []);
  const dialogId = `editor-picker-${++crestInstance}`;
  return `<div class="editor-access-picker">
    <div class="required-editor-list" aria-label="Editors who always have access">
      ${alwaysNames.map(teacher => `<span title="This access cannot be removed"><b aria-hidden="true">🔒</b>${escapeHtml(teacher.name)}<small>${teacher.id === authorId ? "Author" : TEACHER_ROLE_LABELS[teacher.role]}</small></span>`).join("")}
      ${!requiredEditors.some(teacher => teacher.role === "teacher-supervising") ? '<span class="is-policy"><b aria-hidden="true">🔒</b>Teacher supervising<small>Included when assigned</small></span>' : ""}
      <span class="additional-editor-chips">${optionalEditors.filter(t => selected.has(t.id)).map(t => `<span>${escapeHtml(t.name)}</span>`).join("")}</span>
      <button type="button" class="add-editor-button" data-action="open-editor-picker" aria-label="Add staff editors" aria-haspopup="dialog">+</button>
    </div>
    <dialog class="editor-picker-dialog" aria-labelledby="${dialogId}-title">
      <header><h2 id="${dialogId}-title">Add staff editors</h2><button type="button" class="dialog-close" data-action="close-editor-picker" aria-label="Close staff picker">×</button></header>
      <label class="editor-search-label">Search staff<input type="search" data-editor-search placeholder="Type a name" autocomplete="off" /></label>
      <div class="optional-editor-grid">${optionalEditors.map(teacher => `<label><input type="checkbox" name="editorIds" value="${teacher.id}" ${selected.has(teacher.id) ? "checked" : ""} /><span><strong>${escapeHtml(teacher.name)}</strong><small>${TEACHER_ROLE_LABELS[teacher.role] ?? "Regular teacher"}</small></span></label>`).join("") || '<p>No additional staff accounts.</p>'}</div>
      <footer><button type="button" class="primary-button" data-action="close-editor-picker">Done</button></footer>
    </dialog>
  </div>`;
}

function refreshEditorChips(picker) {
  const names = [...picker.querySelectorAll('[name="editorIds"]:checked')].map(input => input.closest("label").querySelector("strong").textContent);
  picker.querySelector(".additional-editor-chips").innerHTML = names.map(name => `<span>${escapeHtml(name)}</span>`).join("");
}

function renderRecordAccessSummary(record) {
  const additionalEditors = (record.editorIds ?? []).map(getTeacher).filter(Boolean);
  return `<details class="record-access-summary"><summary>Editors</summary><p>The author, super admins and supervising teachers${additionalEditors.length ? `, and ${additionalEditors.map((teacher) => escapeHtml(teacher.name)).join(", ")}` : ""}.</p></details>`;
}

function canAccessAdministration() {
  if (activeUser?.type !== "teacher") return false;
  const teacher = getTeacher(activeUser.id);
  const isLabLeader = (state.leadershipAssignments?.labs ?? []).some((lab) =>
    lab.teacherIds?.includes(teacher?.id)
  );
  return isHouseLeaderTeacher(teacher) || teacher?.role === "super-admin" || isLabLeader || getTeacherLevelUpGrades(state, teacher?.id).length > 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSignedPoints(points) {
  const value = Number(points) || 0;
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "0";
}

function formatClockTime(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? ""))) return "";
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
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
    ${points === null ? "" : `<b class="points-notification ${Number(points) < 0 || String(points).startsWith("−") ? "is-negative" : ""}" aria-label="${points} points">${points}</b>`}
  `;

  if (action) {
    return `<span class="student-with-support">
      <button
        class="student-identity ${className}"
        type="button"
        data-action="open-student"
        data-student-id="${student.id}"
        aria-label="Open ${student.name}'s profile"
      >${content}</button>${renderIepHeart(state, activeUser, student, escapeHtml)}</span>
    `;
  }

  return `<span class="student-with-support"><span class="student-identity ${className}">${content}</span>${renderIepHeart(state, activeUser, student, escapeHtml)}</span>`;
}

function getFilteredSendStudents() {
  return getStudentsMatchingFilters(getStudentFilters("send"));
}

function getAvailableGrades() {
  return [...new Set(state.students.map(student => student.grade))].sort((a, b) => a - b);
}

function getStudentFilters(context) {
  if (context === "ranking") return rankingFilters;
  if (context === "students") {
    return { query: studentQuery, house: houseFilter, grade: studentGradeFilter };
  }
  if (context === "send") {
    return { query: sendStudentQuery, house: sendHouseFilter, grade: sendGradeFilter };
  }
  return concernStudentFilters[context];
}

function getStudentsMatchingFilters(filters) {
  return matchingStudents(state.students, filters);
}

function resetRosterFilters(context) {
  if (context === "students") { studentQuery = houseFilter = studentGradeFilter = ""; profileStudentId = null; }
  else if (context === "send") { sendStudentQuery = sendHouseFilter = sendGradeFilter = ""; }
  else if (concernStudentFilters[context]) concernStudentFilters[context] = emptyStudentFilters();
  else if (context === "dashboard") { rankingFilters = emptyStudentFilters(); rankingValueFilter = ""; rankingDateFrom = rankingDateTo = ""; rankingExpanded = false; calendarTeacherGrade = ""; selectedCalendarEventId = null; }
}

function renderCrestVisual(student, points = getStudentTotal(state, student.id)) {
  return studentCrestVisual(student, getHouse(student.houseId), points, `crest-${++crestInstance}`, escapeHtml);
}

function renderStudentFilters(context) {
  const filters = getStudentFilters(context);
  const searchId = context === "students" ? "student-search" : `${context}-student-search`;
  return `
    <section class="student-controls" data-student-filters="${context}" aria-label="Student filters">
      <label class="search-field" for="${searchId}">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m20 19-4.4-4.4a7 7 0 1 0-1.4 1.4l4.4 4.4L20 19ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" /></svg>
        <span class="sr-only">Search students</span>
        <input id="${searchId}" data-student-search="${context}" type="search" placeholder="Search name" value="${escapeHtml(filters.query)}" autocomplete="off" />
      </label>
      <div class="house-filters" role="group" aria-label="Filter by house">
        ${[{ id: "all", name: "All houses" }, ...HOUSES].map((house) => `
          <button type="button" data-action="filter-house" data-house-id="${house.id}" class="${filters.house === house.id ? "is-selected" : ""}" aria-pressed="${filters.house === house.id}">
            ${house.image ? `<img src="${house.image}" alt="" />` : ""}${house.name}
          </button>
        `).join("")}
      </div>
      <div class="grade-filters" role="group" aria-label="Filter by grade">
        ${["all", ...getAvailableGrades().map(String)].map((grade) => `
          <button type="button" data-action="filter-grade" data-grade="${grade}" class="${filters.grade === grade ? "is-selected" : ""}" aria-pressed="${filters.grade === grade}">${grade === "all" ? "All grades" : `Grade ${grade}`}</button>
        `).join("")}
      </div>
    </section>
  `;
}

function updateStudentFilters(context, changes) {
  const filters = { ...getStudentFilters(context), ...changes };
  if (context === "ranking") rankingFilters = filters;
  else if (context === "students") {
    studentQuery = filters.query;
    houseFilter = filters.house;
    studentGradeFilter = filters.grade;
  } else if (context === "send") {
    sendStudentQuery = filters.query;
    sendHouseFilter = filters.house;
    sendGradeFilter = filters.grade;
  } else {
    concernStudentFilters[context] = filters;
  }

  const controls = viewRoot.querySelector(`[data-student-filters="${context}"]`);
  if (!controls) return;
  controls.querySelector("input").value = filters.query;
  controls.querySelectorAll("button").forEach((button) => {
    const selected = button.dataset.action === "filter-house"
      ? button.dataset.houseId === filters.house
      : button.dataset.grade === filters.grade;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  if (context === "ranking") refreshStudentRanking();
  else if (context === "students") refreshStudentBrowser();
  else if (context === "send") {
    const students = getFilteredSendStudents();
    document.querySelector("#send-student-count").textContent = `${formatStudentCount(students.length)} available · ${sendStudentIds.length} selected`;
    document.querySelector("#send-student-results").innerHTML = renderSendStudentResults(students);
  } else refreshConcernStudentSelector();
}

function renderStudentFilterEmptyState(context, hidden = false) {
  const active = hasStudentFilter(getStudentFilters(context));
  return `
    <div class="no-filter-results" data-student-filter-empty="${context}" ${hidden ? "hidden" : ""}>
      <p>${active ? "No students match these filters." : "Search by name or choose a house or grade."}</p>
      ${active ? `<button type="button" data-action="reset-student-filters" data-filter-context="${context}">Clear filters</button>` : ""}
    </div>
  `;
}

function renderSendStudentResults(students) {
  return students.length
    ? `<div class="send-student-options" role="group" aria-label="Students">${students.map(renderSendStudentOption).join("")}</div>`
    : renderStudentFilterEmptyState("send");
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
  sendEditorIds = [];
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

function formatDateOnly(dateString) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString))
    ? new Date(`${dateString}T12:00:00`)
    : new Date(dateString);
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addCalendarDays(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function startOfCalendarWeek(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toDateKey(date);
}

function getInitialCalendarWeek() {
  const today = getTodayInputValue();
  const schoolDate = today < "2026-08-03" || today > "2027-05-31" ? "2026-11-02" : today;
  return startOfCalendarWeek(schoolDate);
}

function getCalendarTypeLabel(type) {
  return {
    house: "House",
    lab: "LAB",
    "level-up": "Level-Up",
    assembly: "Assembly",
    closure: "No school",
    school: "School"
  }[type] ?? "School";
}

function getActiveStudent() {
  return activeUser?.type === "student" ? getStudent(activeUser.studentId) : null;
}

function getAccountRoleLabel() {
  const student = getActiveStudent();
  if (!student) return TEACHER_ROLE_LABELS[getTeacher(activeUser?.id)?.role] ?? "Teacher";
  const isCaptain = (state.leadershipAssignments?.houseLeaders?.[student.houseId] ?? []).includes(student.id);
  const isLabLeader = (state.leadershipAssignments?.labs ?? []).some(lab => lab.leaderIds.includes(student.id));
  return isCaptain || isLabLeader ? "House Captain/Lab Leader" : "Student";
}

function getVisibleCalendarEvents(startDate = "2026-08-01", endDate = "2027-06-01") {
  if (activeUser?.type === "teacher" && !calendarTeacherGrade) return [];
  return getCalendarEvents(state, {
    user: activeUser,
    startDate,
    endDate,
    teacherGrade: calendarTeacherGrade
  });
}

function renderCalendarEvent(event) {
  const gradeLabel = activeUser.type === "teacher" && event.grades?.length && event.grades.length < 7
    ? ` · G${event.grades.join(", G")}`
    : "";
  return `
    <button
      class="calendar-event is-${event.type}"
      type="button"
      data-action="open-calendar-event"
      data-event-id="${escapeHtml(event.id)}"
      aria-label="${escapeHtml(`${event.title}${gradeLabel}. Open details.`)}"
    >
      <span>${getCalendarTypeLabel(event.type)}${gradeLabel}</span>
      <strong>${escapeHtml(event.title)}</strong>
      <small>${formatClockTime(event.startTime)}${event.endTime ? `–${formatClockTime(event.endTime)}` : ""}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</small>
    </button>
  `;
}

function renderCalendarEventPanel(events) {
  if (!selectedCalendarEventId) return "";
  const event = events.find((item) => item.id === selectedCalendarEventId);
  if (!event) return "";
  const editable = canEditCalendarEvent(state, activeUser, event);
  const resourceUrl = /^https?:\/\//i.test(event.resourceUrl ?? "") ? event.resourceUrl : "";
  return `
    <div class="modal-backdrop" data-action="close-calendar-event">
      <section class="modal-panel calendar-event-panel" role="dialog" aria-modal="true" aria-labelledby="calendar-event-panel-title" data-modal-panel>
        <button class="detail-close" type="button" data-action="close-calendar-event" aria-label="Close event details">×</button>
        <div class="calendar-event-panel-heading">
          <span class="calendar-type-badge is-${event.type}">${getCalendarTypeLabel(event.type)}</span>
          <div>
            <h3 id="calendar-event-panel-title">${escapeHtml(event.title)}</h3>
            <p>${formatDateOnly(event.date)} · ${formatClockTime(event.startTime)}–${formatClockTime(event.endTime)}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</p>
          </div>
        </div>
        ${event.teacherIds?.length ? `<p><strong>Teachers:</strong> ${event.teacherIds.map(id => escapeHtml(getTeacher(id)?.name ?? "")).filter(Boolean).join(", ")}</p>` : ""}
        ${event.leaderIds?.length ? `<p><strong>House Captain/Lab Leader:</strong> ${event.leaderIds.map(id => escapeHtml(getStudent(id)?.name ?? "")).filter(Boolean).join(", ")}</p>` : ""}
        ${event.description ? `<p class="calendar-event-description">${escapeHtml(event.description)}</p>` : '<p class="calendar-event-description is-empty">No additional instructions have been shared yet.</p>'}
        <div class="calendar-resources">
          ${renderLevelUpAttachments(state, activeUser, event, escapeHtml)}
          ${resourceUrl ? `<a href="${escapeHtml(resourceUrl)}" target="_blank" rel="noopener">Open shared resource</a>` : ""}
          ${event.attachmentData ? `<a href="${escapeHtml(event.attachmentData)}" download="${escapeHtml(event.attachmentName || "event-file")}">Download ${escapeHtml(event.attachmentName || "attached file")}</a>` : ""}
          ${event.updatedBy ? `<small>Updated by ${escapeHtml(event.updatedBy)} · ${formatDateTime(event.updatedAt)}</small>` : ""}
        </div>
        ${editable ? `
          <form class="calendar-event-form" id="calendar-event-form" data-event-id="${escapeHtml(event.id)}">
            <div class="form-grid two-columns">
              <label>Start time<input name="startTime" type="time" value="${escapeHtml(event.startTime ?? "13:15")}" required /></label>
              <label>End time<input name="endTime" type="time" value="${escapeHtml(event.endTime ?? "14:05")}" required /></label>
            </div>
            <label>Where<input name="location" value="${escapeHtml(event.location ?? "")}" maxlength="160" placeholder="Room, gym, library…" /></label>
            <label>Activity details<textarea name="description" maxlength="1200" rows="4" placeholder="Instructions, materials, meeting point…">${escapeHtml(event.description ?? "")}</textarea></label>
            <label>Shared link<input name="resourceUrl" type="url" value="${escapeHtml(event.resourceUrl ?? "")}" placeholder="https://…" /></label>
            <label>Document <input name="attachment" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" /><small>Optional, maximum 750 KB for this local prototype.</small></label>
            <button class="primary-button" type="submit">Save event details</button>
          </form>
        ` : ""}
      </section>
    </div>
  `;
}

function renderCalendarAccessPlanning() {
  if (!canAccessAdministration()) return "";
  const teacher = getTeacher(activeUser.id);
  const permissions = getActiveTeacherPermissions();
  const houseLeaders = state.leadershipAssignments?.houseLeaders ?? {};
  const labs = state.leadershipAssignments?.labs ?? [];
  if (!permissions.canManageCalendarAccess) {
    const teacherLabs = labs.filter((lab) => lab.teacherIds?.includes(teacher.id));
    return `
      <section class="panel leadership-overview">
        <div class="panel-heading"><div><h2>Calendar access & planning</h2><p>Your leadership access</p></div></div>
        <div class="leadership-scope-list">
          ${isHouseLeaderTeacher(teacher) && teacher.houseId ? `<span><strong>${getHouse(teacher.houseId).name}</strong><small>Meeting area: ${escapeHtml(state.houseMeetingLocations?.[teacher.houseId] ?? "Not assigned")} · Create House events from the calendar header.</small></span>` : ""}
          ${teacherLabs.map((lab) => `<span><strong>${escapeHtml(lab.name)}</strong><small>Create and edit this LAB’s events.</small></span>`).join("")}
          ${getTeacherLevelUpGrades(state, teacher.id).map(grade=>`<span><strong>Grade ${grade} Level-Up</strong><small>Create and edit this grade’s Level-Up events.</small></span>`).join("")}
          ${!teacher.houseId && !teacherLabs.length ? "<p>No calendar leadership assignment is active.</p>" : ""}
        </div>
      </section>
    `;
  }
  return `
    <details class="calendar-admin panel" open>
      <summary><span>Calendar access & planning</span><small>Assign House Captain/Lab Leader access</small></summary>
      <div class="calendar-admin-grid">
        <section>
          <h3>House Captains</h3>
          <p>House Captains can update their own House event instructions and resources.</p>
          <form id="house-leader-form" class="compact-admin-form">
            <label>House<select name="houseId" id="leader-house-select">${HOUSES.map((house) => `<option value="${house.id}">${house.name}</option>`).join("")}</select></label>
            <label>Student<select name="studentId" id="leader-student-select">${state.students.filter((student) => student.houseId === HOUSES[0].id).map((student) => `<option value="${student.id}">${escapeHtml(student.name)} · G${student.grade}</option>`).join("")}</select></label>
            <button class="secondary-button" type="submit">Assign leader</button>
          </form>
          <div class="leader-assignment-list">
            ${HOUSES.map((house) => `
              <div><img src="${house.image}" alt="" /><span><strong>${house.name}</strong><small>Meeting area: ${escapeHtml(state.houseMeetingLocations?.[house.id] ?? "Not assigned")}</small><small>Leader teachers: ${(state.teachers ?? []).filter(t => t.houseId === house.id && isHouseLeaderTeacher(t)).map(t => escapeHtml(t.name)).join(", ") || "Not assigned"}</small>${(houseLeaders[house.id] ?? []).map((id) => {
                const student = getStudent(id);
                return student ? `<button type="button" data-action="remove-house-leader" data-house-id="${house.id}" data-student-id="${id}">${escapeHtml(student.name)} ×</button>` : "";
              }).join("") || "<small>No House Captain assigned</small>"}</span></div>
            `).join("")}
          </div>
        </section>
        <section>
          <h3>Lab leaders</h3>
          <p>Create a lab and give its teacher and House Captain/Lab Leader access to its calendar cards. Leaders can be assigned later.</p>
          <form id="lab-assignment-form" class="compact-admin-form">
            <label>Lab name<input name="name" required placeholder="e.g. Robotics Lab" /></label>
            <label>Meeting day<select name="weekday"><option value="1">Monday</option><option value="3">Wednesday</option><option value="4">Thursday</option></select></label>
            <label>Location<input name="location" placeholder="Room" /></label>
            <label>Teacher leader<select name="teacherId"><option value="">Assign later</option>${(state.teachers ?? []).map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
            <label>House Captain/Lab Leader<select name="leaderId"><option value="">Assign later</option>${state.students.filter((student) => student.grade >= 6).map((student) => `<option value="${student.id}">${escapeHtml(student.name)} · G${student.grade}</option>`).join("")}</select></label>
            <button class="secondary-button" type="submit">Create lab access</button>
          </form>
          <ul class="lab-assignment-list">${labs.map((lab) => `<li><span><strong>${escapeHtml(lab.name)}</strong><small>${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][lab.weekday]}${lab.location ? ` · ${escapeHtml(lab.location)}` : ""} · Teacher: ${lab.teacherIds?.map((id) => escapeHtml(getTeacher(id)?.name ?? "")).filter(Boolean).join(", ") || "not assigned"} · House Captain/Lab Leader: ${lab.leaderIds.map((id) => escapeHtml(getStudent(id)?.name ?? "")).join(", ") || "Not assigned"}${lab.pendingLeaderNames?.length ? ` · Pending identity: ${lab.pendingLeaderNames.map(escapeHtml).join(", ")}` : ""}</small></span><button type="button" data-action="remove-lab" data-lab-id="${lab.id}">Remove</button></li>`).join("") || "<li>No lab leaders assigned yet.</li>"}</ul>
        </section>
      </div>
      ${state.leadershipAssignments?.levelUpTeachers ? `<section class="support-section"><h3>Level-Up teachers</h3><ul>${Object.entries(state.leadershipAssignments.levelUpTeachers).map(([grade, ids])=>`<li><strong>Grade ${grade}</strong> · ${ids.map(id=>escapeHtml(getTeacher(id)?.name ?? "")).filter(Boolean).join(", ")}</li>`).join("")}</ul></section>` : ""}
    </details>
  `;
}

function getTeacherCalendarCreationScopes() {
  if (activeUser?.type !== "teacher") return [];
  const teacher = getTeacher(activeUser.id);
  const scopes = [];
  if (isHouseLeaderTeacher(teacher) && teacher.houseId) {
    scopes.push({ value: `house:${teacher.houseId}`, label: `${getHouse(teacher.houseId).name} event` });
  }
  (state.leadershipAssignments?.labs ?? [])
    .filter((lab) => lab.teacherIds?.includes(teacher.id))
    .forEach((lab) => scopes.push({ value: `lab:${lab.id}`, label: `${lab.name} event` }));
  getTeacherLevelUpGrades(state, teacher.id).forEach(grade=>scopes.push({value:`level-up:${grade}`,label:`Grade ${grade} Level-Up event`}));
  return scopes;
}

function canOpenCalendarEventCreator() {
  if (activeUser?.type !== "teacher") return false;
  return getActiveTeacherPermissions().canEditAllCalendarEvents || getTeacherCalendarCreationScopes().length > 0;
}

function syncCalendarCreationScope() {
  const form = document.querySelector("#custom-calendar-event-form");
  if (!form?.elements.scope) return;
  const [type, grade] = form.elements.scope.value.split(":");
  form.elements.grade.disabled = type === "level-up";
  if (type === "level-up") form.elements.grade.value = grade;
}

function renderCalendarEventCreateModal() {
  if (!calendarCreateOpen || !canOpenCalendarEventCreator()) return "";
  const permissions = getActiveTeacherPermissions();
  const scopes = getTeacherCalendarCreationScopes();
  const scopeFields = permissions.canEditAllCalendarEvents
    ? `<label>Type<select name="type" id="calendar-event-type"><option value="school">School</option><option value="house">House</option><option value="lab">LAB</option><option value="level-up">Level-Up</option><option value="assembly">Assembly</option></select></label>
       <label>House<select name="houseId"><option value="all">All houses</option>${HOUSES.map((house) => `<option value="${house.id}">${house.name}</option>`).join("")}</select></label>
       <label>LAB<select name="labId"><option value="">No specific LAB</option>${(state.leadershipAssignments?.labs ?? []).map((lab) => `<option value="${lab.id}">${escapeHtml(lab.name)}</option>`).join("")}</select></label>`
    : `<label>Event access<select name="scope" required>${scopes.map((scope) => `<option value="${scope.value}">${escapeHtml(scope.label)}</option>`).join("")}</select></label>`;
  return `
    <div class="modal-backdrop" data-action="close-calendar-create">
      <section class="modal-panel calendar-create-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-create-title" data-modal-panel>
        <button class="detail-close" type="button" data-action="close-calendar-create" aria-label="Close event creator">×</button>
        <div class="modal-heading"><span class="calendar-type-badge is-house">Calendar</span><h2 id="calendar-create-title">Create an event</h2><p>House Captain/Lab Leader accounts may edit relevant events after they appear in their calendar.</p></div>
        <form id="custom-calendar-event-form" class="compact-admin-form calendar-create-form">
          <label>Date<input name="date" type="date" required /></label>
          <label>Title<input name="title" required maxlength="120" /></label>
          ${scopeFields}
          <label>Grade<select name="grade"><option value="all">All grades</option>${getAvailableGrades().map((grade) => `<option value="${grade}">Grade ${grade}</option>`).join("")}</select></label>
          <label>Start time<input name="startTime" type="time" value="13:15" required /></label>
          <label>End time<input name="endTime" type="time" value="14:05" required /></label>
          <label>Location<input name="location" maxlength="160" /></label>
          <label class="is-wide">Details<textarea name="description" rows="3" maxlength="1200"></textarea></label>
          <button class="primary-button" type="submit">Publish event</button>
        </form>
      </section>
    </div>
  `;
}

function renderSuperAdminTools() {
  if (activeUser.type !== "teacher") return "";
  if (!getActiveTeacherPermissions().canManageAccounts) return "";
  const accountNotice = lastCreatedAccount
    ? `<div class="account-created-notice" role="status"><strong>${escapeHtml(lastCreatedAccount.name)} is ready</strong><span>Login: <code>${escapeHtml(lastCreatedAccount.username)}</code></span><span>${cloudEnabled ? "Temporary password" : "Password"}: <code>${escapeHtml(cloudEnabled ? lastCreatedAccount.temporaryPassword ?? "Provisioning required" : lastCreatedAccount.username)}</code></span></div>`
    : "";
  const firstTeacher = (state.teachers ?? [])[0];
  return `
    <details class="calendar-admin super-admin-tools panel">
      <summary><span>Super admin tools</span><small>Accounts and House placement</small></summary>
      ${accountNotice}
      ${cloudEnabled ? `<form data-support-form="account-reset" class="support-section"><label>Reset an account's temporary password<select name="id">${[...state.teachers, ...state.students].map(account => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)} · ${escapeHtml(account.username)}</option>`).join("")}</select></label><button class="secondary-button" type="submit">Generate new temporary password</button><p class="support-error" role="alert"></p></form>` : ""}
      <div class="calendar-admin-grid">
        <section>
          <h3>Transfer a student</h3>
          <p>Move a student to another House. Their recognitions and history stay attached.</p>
          <form id="transfer-student-form" class="compact-admin-form">
            <label>Student<select name="studentId">${state.students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)} · ${getHouse(student.houseId).name}</option>`).join("")}</select></label>
            <label>New House<select name="houseId">${HOUSES.map((house) => `<option value="${house.id}">${house.name}</option>`).join("")}</select></label>
            <button class="secondary-button" type="submit">Transfer student</button>
          </form>
        </section>
        <section>
          <h3>Create a student account</h3>
          <p>${cloudEnabled ? "A unique temporary password is generated. The user sets their own password at first login." : "The login and password use the student’s name without spaces."}</p>
          <form id="create-student-form" class="compact-admin-form">
            <label>Full name<input name="name" required maxlength="100" /></label>
            <label>Grade<select name="grade">${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}">Grade ${index + 1}</option>`).join("")}</select></label>
            <label>House<select name="houseId">${HOUSES.map((house) => `<option value="${house.id}">${house.name}</option>`).join("")}</select></label>
            <button class="secondary-button" type="submit">Create student</button>
          </form>
        </section>
        <section>
          <h3>Create a teacher account</h3>
          <p>Assign one of the four staff statuses. Leader teacher is House-specific; Teacher supervising can edit every student record.</p>
          <form id="create-teacher-form" class="compact-admin-form">
            <label>Full name<input name="name" required maxlength="100" /></label>
            <label>Status<select name="role">${TEACHER_ROLES.map((role) => `<option value="${role}">${TEACHER_ROLE_LABELS[role]}</option>`).join("")}</select></label>
            <label>House<select name="houseId"><option value="">No House</option>${HOUSES.map((house) => `<option value="${house.id}">${house.name}</option>`).join("")}</select></label>
            <button class="secondary-button" type="submit">Create teacher</button>
          </form>
        </section>
        <section>
          <h3>Manage staff status</h3>
          <p>Super admins and Teacher supervising always edit every student record. Leader teacher only controls House calendar events.</p>
          <form id="update-teacher-status-form" class="compact-admin-form">
            <label>Staff member<select name="teacherId" id="staff-status-teacher">${(state.teachers ?? []).map((teacher) => `<option value="${teacher.id}" data-role="${teacher.role}" data-house-id="${teacher.houseId ?? ""}">${escapeHtml(teacher.name)} · ${TEACHER_ROLE_LABELS[teacher.role]}</option>`).join("")}</select></label>
            <label>Status<select name="role" id="staff-status-role">${TEACHER_ROLES.map((role) => `<option value="${role}" ${role === firstTeacher?.role ? "selected" : ""}>${TEACHER_ROLE_LABELS[role]}</option>`).join("")}</select></label>
            <label>House<select name="houseId" id="staff-status-house"><option value="">No House</option>${HOUSES.map((house) => `<option value="${house.id}" ${house.id === firstTeacher?.houseId ? "selected" : ""}>${house.name}</option>`).join("")}</select></label>
            <button class="secondary-button" type="submit">Save staff status</button>
          </form>
        </section>
      </div>
    </details>
  `;
}

function renderAdministration() {
  if (!canAccessAdministration()) return renderDashboard();
  return `
    <div class="page administration-page">
      ${renderPageHeader("Administration", "")}
      ${renderCalendarAccessPlanning()}
      ${renderSuperAdminTools()}
    </div>
  `;
}

function renderSchoolCalendar() {
  const endDate = addCalendarDays(calendarWeekStart, 6);
  const events = getVisibleCalendarEvents(calendarWeekStart, endDate);
  const days = Array.from({ length: 7 }, (_, index) => addCalendarDays(calendarWeekStart, index));
  const weekLabel = `${formatDateOnly(calendarWeekStart)} – ${formatDateOnly(endDate)}`;
  return `
    <section class="calendar-section" aria-labelledby="school-calendar-title">
      <div class="calendar-heading">
        <div>
          <h2 id="school-calendar-title">School calendar</h2>
        </div>
        ${canOpenCalendarEventCreator() ? '<button class="calendar-create-trigger" type="button" data-action="open-calendar-create"><span aria-hidden="true">＋</span>Create event</button>' : ""}
        <div class="calendar-toolbar">
          ${activeUser.type === "teacher" ? `<label><span class="sr-only">Calendar grade</span><select id="calendar-grade-filter"><option value="">Choose grade</option><option value="all" ${calendarTeacherGrade === "all" ? "selected" : ""}>All grades</option>${[6, 7, 8, 9, 10, 11, 12].map((grade) => `<option value="${grade}" ${calendarTeacherGrade === String(grade) ? "selected" : ""}>Grade ${grade}</option>`).join("")}</select></label>` : ""}
          <div class="calendar-week-controls"><button type="button" data-action="calendar-prev" aria-label="Previous week">‹</button><button type="button" data-action="calendar-today">Today</button><button type="button" data-action="calendar-next" aria-label="Next week">›</button></div>
        </div>
      </div>
      <div class="calendar-week-label">${weekLabel}</div>
      ${activeUser.type === "teacher" && !calendarTeacherGrade ? '<p class="calendar-filter-prompt">Choose a grade to view events, or select All grades.</p>' : `<div class="calendar-week-grid">
        ${days.map((date) => {
          const dateEvents = events.filter((event) => event.date === date);
          const dateObject = new Date(`${date}T12:00:00`);
          const isToday = date === getTodayInputValue();
          return `<article class="calendar-day ${isToday ? "is-today" : ""}"><header><span>${new Intl.DateTimeFormat("en", { weekday: "short" }).format(dateObject)}</span><strong>${dateObject.getDate()}</strong></header><div class="calendar-day-events">${dateEvents.map(renderCalendarEvent).join("") || '<span class="calendar-empty">No scheduled event</span>'}</div></article>`;
        }).join("")}
      </div>`}
      ${renderCalendarEventPanel(events)}
    </section>
    ${renderCalendarEventCreateModal()}
  `;
}

function renderPageHeader(title, description) {
  return `<h1 class="sr-only">${title}</h1>${description ? `<p class="page-context">${description}</p>` : ""}`;
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
  const activeStudent = getActiveStudent();
  const hasTodayCheckIn = activeStudent
    ? (state.selCheckIns ?? []).some(
        (checkIn) => checkIn.studentId === activeStudent.id && checkIn.date === getTodayInputValue()
      )
    : false;
  const houses = HOUSES.map(
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
  const studentTools = activeStudent ? `
    <button class="sel-check-in-trigger ${hasTodayCheckIn ? "is-complete" : ""}" type="button" data-action="open-sel-check-in">
      <span aria-hidden="true">${hasTodayCheckIn ? "✓" : "♡"}</span>
      ${hasTodayCheckIn ? "Check-in complete" : "Daily SEL check-in"}
    </button>
    <button class="student-mobile-logout" type="button" data-action="logout">Log out</button>
  ` : "";
  topbarHouseScores.innerHTML = houses + studentTools;
  document.querySelector("#sidebar-house-scores").innerHTML = houses;
  document.querySelector("#sidebar-student-tools").innerHTML = studentTools;
}

function renderSelCheckInModal() {
  const student = getActiveStudent();
  if (!student || !selCheckInOpen) return "";
  const existing = getStudentSelCheckIns(state, student.id).find(
    (checkIn) => checkIn.date === getTodayInputValue()
  );
  const ratingLabels = ["Very difficult", "Difficult", "Okay", "Good", "Great"];
  return `
    <div class="modal-backdrop" data-action="close-sel-check-in">
      <section class="modal-panel sel-check-in-modal" role="dialog" aria-modal="true" aria-labelledby="sel-check-in-title" data-modal-panel>
        <button class="detail-close" type="button" data-action="close-sel-check-in" aria-label="Close daily check-in">×</button>
        <div class="modal-heading">
          <span class="privacy-badge">Private reflection</span>
          <h2 id="sel-check-in-title">How do you feel today?</h2>
          <p>Take one minute to notice how you are doing.</p>
        </div>
        <form id="sel-check-in-form" class="sel-check-in-form">
          <fieldset>
            <legend>Choose a number from 1 to 5</legend>
            <div class="mood-rating-grid">
              ${ratingLabels.map((label, index) => {
                const rating = index + 1;
                return `<label><input type="radio" name="rating" value="${rating}" ${existing?.rating === rating ? "checked" : ""} required /><span><strong>${rating}</strong><small>${label}</small></span></label>`;
              }).join("")}
            </div>
          </fieldset>
          <label>Why? What could you do to feel better?
            <textarea name="reflection" rows="4" maxlength="500" required placeholder="A short answer is enough.">${escapeHtml(existing?.reflection ?? "")}</textarea>
          </label>
          <button class="primary-button" type="submit">Save today’s check-in</button>
        </form>
      </section>
    </div>
  `;
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

function getRankedStudents() {
  const ranked = getStudentRanking(state, {
    valueId: rankingValueFilter || "all",
    grade: rankingFilters.grade || "all",
    dateFrom: rankingDateFrom,
    dateTo: rankingDateTo
  });
  return matchingStudents(ranked, rankingFilters, {
    activated: Boolean(rankingValueFilter || rankingDateFrom || rankingDateTo)
  });
}

function renderRankingResults() {
  const ranking = getRankedStudents();
  const visible = rankingExpanded ? ranking : ranking.slice(0, 20);
  return visible.length ? `<ol class="ranking-crest-grid">${visible.map((student, index) => `
    <li><span class="ranking-position" aria-label="Rank ${index + 1}">${index + 1}</span>
      <div class="student-crest-item"><button class="student-crest" type="button" data-action="open-student" data-student-id="${student.id}" aria-label="Rank ${index + 1}: ${escapeHtml(student.name)}, Grade ${student.grade}, ${student.points} points, ${student.recognitions} coins">
        ${renderCrestVisual(student, student.points)}
      </button>${renderIepHeart(state, activeUser, student, escapeHtml)}</div>
      <small>${student.recognitions} ${student.recognitions === 1 ? "coin" : "coins"}</small>
    </li>`).join("")}</ol>` : renderStudentFilterEmptyState("ranking");
}

function refreshStudentRanking() {
  const results = document.querySelector("#ranking-results");
  if (results) results.innerHTML = renderRankingResults();
}

function renderStudentRanking() {
  return `
    <section class="panel student-ranking-panel" aria-labelledby="student-ranking-title">
      <div class="panel-heading ranking-heading">
        <h2 id="student-ranking-title">Student coin ranking</h2>
        <button class="text-button" type="button" data-action="toggle-ranking-roster">${rankingExpanded ? "Show top 20" : "View full roster"}</button>
      </div>
      ${renderStudentFilters("ranking")}
      <div class="ranking-filters" aria-label="Ranking recognition filters">
        <label>7C<select id="ranking-value-filter"><option value="">Choose a 7C</option><option value="all" ${rankingValueFilter === "all" ? "selected" : ""}>All 7Cs</option>${VALUES.map(value => `<option value="${value.id}" ${rankingValueFilter === value.id ? "selected" : ""}>${value.name}</option>`).join("")}</select></label>
        <label>From<input id="ranking-date-from" type="date" value="${rankingDateFrom}" max="${rankingDateTo}" /></label>
        <label>To<input id="ranking-date-to" type="date" value="${rankingDateTo}" min="${rankingDateFrom}" /></label>
        ${rankingDateFrom || rankingDateTo ? '<button type="button" class="text-button" data-action="clear-ranking-date">All dates</button>' : ""}
      </div>
      <div id="ranking-results" class="ranking-results">${renderRankingResults()}</div>
    </section>
  `;
}

function renderDashboard() {
  const totals = getHouseTotals(state);
  const activeStudent = getActiveStudent();
  if (activeStudent) {
    const house = getHouse(activeStudent.houseId);
    const isHouseLeader = (state.leadershipAssignments?.houseLeaders?.[activeStudent.houseId] ?? []).includes(activeStudent.id);
    const labs = (state.leadershipAssignments?.labs ?? []).filter((lab) => lab.leaderIds.includes(activeStudent.id));
    return `
      <div class="page student-dashboard">
        ${renderPageHeader("Dashboard", `${escapeHtml(activeStudent.name)} · Grade ${activeStudent.grade}`)}
        <section class="student-calendar-identity panel" style="--house-color:${house.color}">
          <img src="${house.image}" alt="${house.name} logo" />
          <div><span>Your house</span><h2>${house.name}</h2><p>${totals[house.id].toLocaleString()} house points</p></div>
          <div class="student-access-badges">${isHouseLeader ? "<span>House Captain</span>" : ""}${labs.map((lab) => `<span>${escapeHtml(lab.name)}</span>`).join("")}</div>
        </section>
        ${renderSchoolCalendar()}
        ${cloudEnabled ? renderSupportNotifications(state, activeUser, escapeHtml) : ""}
        ${cloudEnabled ? renderSupportProfile(state, activeUser, activeStudent, escapeHtml, { dashboard: true }) : ""}
        ${renderSelCheckInModal()}
      </div>
    `;
  }
  const rankedHouses = [...HOUSES].sort((a, b) => totals[b.id] - totals[a.id]);
  const maxPoints = Math.max(...Object.values(totals), 1);

  return `
    <div class="page">
      ${renderPageHeader("Dashboard", "")}
      <div class="dashboard-overview">
        ${renderSupportNotifications(state, activeUser, escapeHtml)}
        ${renderTeacherActivity()}
      </div>
      ${renderSchoolCalendar()}

      <div class="dashboard-layout">
        <section class="panel scoreboard-panel" aria-labelledby="house-points-title">
          <div class="panel-heading">
            <div>
              <h2 id="house-points-title">House points</h2>
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

        ${renderStudentRanking()}
      </div>
    </div>
  `;
}

function renderSendStudentOption(student) {
  const selected = sendStudentIds.includes(student.id);
  return `<div class="student-crest-item"><button class="student-crest send-student-option ${selected ? "is-selected" : ""}" type="button" data-action="toggle-send-student" data-student-id="${student.id}" aria-pressed="${selected}" aria-label="${escapeHtml(student.name)}, Grade ${student.grade}, ${getHouse(student.houseId).name}, ${getStudentTotal(state, student.id)} points">
    ${renderCrestVisual(student)}
  </button>${renderIepHeart(state, activeUser, student, escapeHtml)}</div>`;
}

function renderSendSummary(student, selectedValue, canSend) {
  const house = getHouse(student.houseId);
  const studentTotal = getStudentTotal(state, student.id);
  const commentLabel = sendComment.trim() ? escapeHtml(sendComment.trim()) : "No comment";

  return `
    <article class="send-summary" style="--house-color: ${house.color}">
      <div class="summary-house">
        <div class="send-summary-student" role="img" aria-label="${escapeHtml(student.name)}, Grade ${student.grade}, ${house.name}, ${studentTotal} points">${renderCrestVisual(student, studentTotal)}</div>
        <button
          class="remove-student-button"
          type="button"
          data-action="remove-send-student"
          data-student-id="${student.id}"
          aria-label="Remove ${student.name}"
        ><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>

      <dl>
        <div><dt>HCAS 7C</dt><dd>${selectedValue ? selectedValue.name : "Choose one"}</dd></div>
        <div><dt>Points</dt><dd>${selectedPoints ? `+${selectedPoints}` : "Choose one"}</dd></div>
        <div class="summary-comment-row">
          <dt>Comment</dt>
          <dd class="send-comment-preview ${sendComment.trim() ? "" : "is-empty"}">${commentLabel}</dd>
        </div>
        <div><dt>Additional editors</dt><dd>${sendEditorIds.length ? `${sendEditorIds.length} selected` : "None"}</dd></div>
      </dl>

      <button
        class="primary-button send-button"
        type="button"
        data-action="send-award"
        data-student-id="${student.id}"
        ${canSend ? "" : "disabled"}
      >${selectedPoints ? `Send ${selectedPoints} points to ${student.name}` : `Send coin to ${student.name}`}</button>
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
      ${renderPageHeader("Send coin", "")}

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
            ${renderStudentFilters("send")}
            <div class="student-select-heading">
              <span>Students</span>
              <span id="send-student-count" role="status">${formatStudentCount(filteredStudents.length)} available · ${sendStudentIds.length} selected</span>
            </div>
            <div id="send-student-results">${renderSendStudentResults(filteredStudents)}</div>
          </fieldset>

          <fieldset class="comment-choice">
            <legend><span>4</span> Add a comment <small>Optional</small></legend>
            <label class="sr-only" for="send-comment">Comment</label>
            <textarea
              id="send-comment"
              maxlength="${MAX_COMMENT_LENGTH}"
              placeholder="Add a short note about this recognition"
              aria-describedby="send-comment-count"
            >${escapeHtml(sendComment)}</textarea>
            <div class="comment-meta">
              <span id="send-comment-count">${sendComment.length}/${MAX_COMMENT_LENGTH}</span>
            </div>
          </fieldset>

          <fieldset class="concern-section editor-access-section">
            <legend><span>5</span> Editing access</legend>
            ${renderEditorAccessPicker({ selectedIds: sendEditorIds })}
          </fieldset>
        </section>

        <aside class="send-summary-list" aria-label="Recognition summaries">
          ${selectedStudents.length
            ? selectedStudents.map((student) => renderSendSummary(student, selectedValue, canSend)).join("")
            : `
              <section class="send-summary send-summary-empty">
                <div class="summary-house summary-house-empty">
                  <div>
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
        <p>${value.name} · ${house.name}${confirmation.publishedAt ? ` · Published ${formatDateTime(confirmation.publishedAt)}` : ""}</p>
        ${renderRecognitionComment(confirmation.comment)}
      </div>
      <button type="button" data-action="open-student" data-student-id="${student.id}">View student</button>
    </section>
  `;
}

function renderConcernConfirmation() {
  if (!lastConcernConfirmation) return "";
  const students = lastConcernConfirmation.studentIds.map(getStudent).filter(Boolean);
  return `
    <section class="confirmation concern-confirmation" aria-label="Concern published">
      <span class="confirmation-check" aria-hidden="true">✓</span>
      <div>
        <strong>${lastConcernConfirmation.type} published for ${students.map((student) => student.name).join(", ")}</strong>
        <p>Published ${formatDateTime(lastConcernConfirmation.publishedAt)} by ${activeTeacher.name}</p>
      </div>
      <button type="button" data-action="open-student" data-student-id="${students[0]?.id ?? ""}">View profile</button>
    </section>
  `;
}

function renderConcernAttachmentFields() {
  return `
    <div class="attachment-fields">
      <label>Supporting attachment <small>Optional</small>
        <input name="attachment" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" />
        <span class="field-help">PDF, Office document, or image, maximum 750 KB.</span>
      </label>
      <label>Attachment visibility
        <select name="attachmentVisibility">
          <option value="record">With the concern description</option>
          <option value="confidential">Confidential teacher section</option>
        </select>
      </label>
    </div>
  `;
}

function renderConcernAttachment(concern, visibility) {
  if (!concern.attachmentData || concern.attachmentVisibility !== visibility) return "";
  const label = visibility === "confidential" ? "Confidential attachment" : "Supporting attachment";
  return `<a class="record-attachment" href="${escapeHtml(concern.attachmentData)}" download="${escapeHtml(concern.attachmentName || "attachment")}">${label}: ${escapeHtml(concern.attachmentName || "Download file")}</a>`;
}

function resetProfileConcernFilters() {
  Object.keys(profileConcernFilters).forEach((type) => {
    profileConcernFilters[type] = "all";
  });
}

function getProfileConcernFilterOptions(type, concerns) {
  const options = [];
  const seen = new Set();
  const addOption = (value, label) => {
    if (seen.has(value)) return;
    seen.add(value);
    options.push({ value, label });
  };

  if (type === "behavior") {
    const usedIssueIds = new Set(concerns.flatMap((concern) => concern.issueIds ?? []));
    BEHAVIOR_ISSUES.filter((issue) => usedIssueIds.has(issue.id)).forEach((issue) => {
      addOption(`issue:${issue.id}`, issue.title);
    });
    if (concerns.some((concern) => concern.otherIssueSelected || concern.otherIssue)) {
      addOption("other", "Other behavior issue");
    }
  } else if (type === "academic") {
    const usedIssues = new Set(concerns.flatMap((concern) => concern.issueIds ?? []));
    const listedIssues = Object.values(ACADEMIC_CONCERN_EXAMPLES).flat();
    listedIssues.filter((issue) => usedIssues.has(issue)).forEach((issue) => {
      addOption(`issue:${issue}`, issue);
    });
    usedIssues.forEach((issue) => addOption(`issue:${issue}`, issue));
    const usedProfileIds = new Set(concerns.map((concern) => concern.profileId).filter(Boolean));
    ACADEMIC_PROFILES.filter((profile) => usedProfileIds.has(profile.id)).forEach((profile) => {
      addOption(`profile:${profile.id}`, profile.name);
    });
    if (concerns.some((concern) => concern.otherIssue)) {
      addOption("other", "Other academic issue");
    }
  } else if (type === "sel") {
    const usedConcernIds = new Set(concerns.flatMap((concern) => concern.concernIds ?? []));
    SEL_CONCERN_OPTIONS.filter(
      (option) => option.id !== "other" && usedConcernIds.has(option.id)
    ).forEach((option) => {
      addOption(`issue:${option.id}`, option.title);
    });
    if (usedConcernIds.has("other") || concerns.some((concern) => concern.otherConcern)) {
      addOption("other", "Other SEL concern");
    }
  }

  return options;
}

function concernMatchesProfileFilter(type, concern, filter) {
  if (filter === "all") return true;
  if (filter === "other") {
    if (type === "behavior") return Boolean(concern.otherIssueSelected || concern.otherIssue);
    if (type === "academic") return Boolean(concern.otherIssue);
    return Boolean(concern.concernIds?.includes("other") || concern.otherConcern);
  }
  if (filter.startsWith("profile:")) {
    return type === "academic" && concern.profileId === filter.slice("profile:".length);
  }
  if (!filter.startsWith("issue:")) return false;
  const issueId = filter.slice("issue:".length);
  return type === "sel"
    ? concern.concernIds?.includes(issueId)
    : concern.issueIds?.includes(issueId);
}

function renderProfileConcernFilter(type, concerns, label) {
  const options = getProfileConcernFilterOptions(type, concerns);
  if (!options.some((option) => option.value === profileConcernFilters[type])) {
    profileConcernFilters[type] = "all";
  }
  return `
    <label class="profile-record-filter">
      <span class="sr-only">Filter ${label}</span>
      <select data-profile-concern-filter="${type}" aria-label="Filter ${label}" ${options.length ? "" : "disabled"}>
        <option value="all">All ${label}</option>
        ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${profileConcernFilters[type] === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
      </select>
    </label>
  `;
}

function getRecordEditItem() {
  if (!recordEditTarget) return null;
  const { type, id } = recordEditTarget;
  if (type === "award") return state.awards.find((item) => item.id === id) ?? null;
  const collection = {
    behavior: state.behaviorConcerns,
    academic: state.academicConcerns,
    sel: state.selConcerns
  }[type];
  return collection?.find((item) => item.id === id) ?? null;
}

function renderRecordEditButton(type, record) {
  if (activeUser?.type !== "teacher" || !canEditStudentRecord(state, activeTeacher.id, record)) {
    return "";
  }
  const effectiveType = record.sourceType === "behavior-concern" ? "behavior" : type;
  const effectiveId = record.sourceType === "behavior-concern" ? record.sourceConcernId : record.id;
  return `<button class="record-edit-button" type="button" data-action="edit-student-record" data-record-type="${effectiveType}" data-record-id="${effectiveId}">Edit</button>`;
}

function renderRecordEditModal() {
  const record = getRecordEditItem();
  if (!record || activeUser?.type !== "teacher") return "";
  if (!canEditStudentRecord(state, activeTeacher.id, record)) {
    recordEditTarget = null;
    return "";
  }
  const { type } = recordEditTarget;
  const author = getTeacher(record.teacherId);
  const typeLabel = type === "award" ? "coin" : `${type} concern`;
  const commonConcernFields = type === "award" ? "" : `
    <div class="form-grid two-columns">
      <label>Record date<input name="incidentDate" type="date" value="${escapeHtml(record.incidentDate)}" required /></label>
      ${type === "behavior" ? `<label>Incident time<input name="incidentTime" type="time" value="${escapeHtml(record.incidentTime ?? "13:15")}" required /></label>` : ""}
    </div>
    ${type === "behavior" ? `<label>Location<input name="location" maxlength="160" value="${escapeHtml(record.location ?? "")}" required /></label>` : ""}
    <label>Title<input name="title" maxlength="${MAX_CONCERN_TITLE_LENGTH}" value="${escapeHtml(record.title)}" required /></label>
    <label>Description<textarea name="description" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="5" required>${escapeHtml(record.description)}</textarea></label>
    ${type === "behavior" ? `
      <label>Additional or different step taken<textarea name="customAction" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3">${escapeHtml(record.customAction ?? "")}</textarea></label>
      <label>Confidential teacher note<textarea name="confidentialNote" maxlength="${MAX_INTERNAL_NOTE_LENGTH}" rows="3">${escapeHtml(record.confidentialNote ?? "")}</textarea></label>
    ` : ""}
    ${type === "academic" ? `
      <label>Step taken<textarea name="actionDetails" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="4" required>${escapeHtml(record.actionDetails ?? "")}</textarea></label>
      <label>Internal note<textarea name="internalNote" maxlength="${MAX_INTERNAL_NOTE_LENGTH}" rows="3">${escapeHtml(record.internalNote ?? "")}</textarea></label>
    ` : ""}
    ${type === "sel" ? `
      <label>Support or follow-up<textarea name="followUp" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="4">${escapeHtml(record.followUp ?? "")}</textarea></label>
      <label>Confidential teacher note<textarea name="confidentialNote" maxlength="${MAX_INTERNAL_NOTE_LENGTH}" rows="3">${escapeHtml(record.confidentialNote ?? "")}</textarea></label>
    ` : ""}
  `;
  const awardFields = type !== "award" ? "" : `
    <div class="form-grid two-columns">
      <label>HCAS 7C<select name="valueId">${VALUES.map((value) => `<option value="${value.id}" ${value.id === record.valueId ? "selected" : ""}>${value.name}</option>`).join("")}</select></label>
      <label>Points<select name="points">${POINT_OPTIONS.map((points) => `<option value="${points}" ${points === record.points ? "selected" : ""}>${points} points</option>`).join("")}</select></label>
    </div>
    <label>Comment<textarea name="comment" maxlength="${MAX_COMMENT_LENGTH}" rows="4">${escapeHtml(record.comment ?? "")}</textarea></label>
  `;

  return `
    <div class="modal-backdrop" data-action="close-record-edit">
      <section class="modal-panel record-edit-modal" role="dialog" aria-modal="true" aria-labelledby="record-edit-title" data-modal-panel>
        <button class="detail-close" type="button" data-action="close-record-edit" aria-label="Close editor">×</button>
        <div class="modal-heading">
          <span class="calendar-type-badge is-school">Staff record</span>
          <h2 id="record-edit-title">Edit ${typeLabel}</h2>
          <p>Published by ${escapeHtml(author?.name ?? "Unknown teacher")} on ${formatDateTime(record.publishedAt ?? record.createdAt)}.</p>
        </div>
        <form id="record-edit-form" data-record-type="${type}" data-record-id="${record.id}">
          <div class="record-edit-fields">${awardFields}${commonConcernFields}</div>
          ${renderEditorAccessPicker({ selectedIds: record.editorIds, authorId: record.teacherId })}
          <p class="field-help">The author, students involved, original publication date, and category-specific selections stay attached to this record.</p>
          <div class="form-submit-bar"><span>${record.updatedAt ? `Last edited ${formatDateTime(record.updatedAt)}` : "No previous edits"}</span><button class="primary-button" type="submit">Save changes</button></div>
        </form>
      </section>
    </div>
  `;
}

async function readFileAsDataUrl(file, maxBytes = 750_000, label = "The attachment") {
  if (!file?.size) return "";
  if (file.size > maxBytes) throw new Error(`${label} must be smaller than 750 KB.`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error(`${label} could not be read.`)));
    reader.readAsDataURL(file);
  });
}

async function readConcernAttachment(formData) {
  const file = formData.get("attachment");
  if (!file?.size) {
    return {
      attachmentName: "",
      attachmentData: "",
      attachmentVisibility: formData.get("attachmentVisibility")
    };
  }
  const attachmentData = await readFileAsDataUrl(file);
  if (String(attachmentData).length > MAX_ATTACHMENT_DATA_LENGTH) {
    throw new Error("The attachment is too large to save.");
  }
  return {
    attachmentName: file.name,
    attachmentData,
    attachmentVisibility: formData.get("attachmentVisibility")
  };
}

function renderConcernStudentSelector() {
  const context = activeView;
  const visibleIds = new Set(getStudentsMatchingFilters(getStudentFilters(context)).map((student) => student.id));
  return `
    <div data-concern-student-selector>
      ${renderStudentFilters(context)}
      <div class="student-select-heading">
        <span>Students</span>
        <span data-concern-student-count role="status">${formatStudentCount(visibleIds.size)} available · ${concernStudentPreset ? 1 : 0} selected</span>
      </div>
      <div class="concern-student-grid" role="group" aria-label="Students involved">
        ${state.students.map(student => `<div class="student-crest-item concern-crest-item" data-concern-student-id="${student.id}" ${visibleIds.has(student.id) ? "" : "hidden"}>
          <label class="concern-student-option">
            <input type="checkbox" name="studentIds" value="${student.id}" ${concernStudentPreset === student.id ? "checked" : ""} aria-label="${escapeHtml(student.name)}, Grade ${student.grade}, ${getHouse(student.houseId).name}, ${getStudentTotal(state, student.id)} points" />
            <span class="student-crest">${renderCrestVisual(student)}</span>
          </label>${renderIepHeart(state, activeUser, student, escapeHtml)}
        </div>`).join("")}
      </div>
      ${renderStudentFilterEmptyState(context, visibleIds.size > 0)}
    </div>
  `;
}

function refreshConcernStudentSelector() {
  const selector = viewRoot.querySelector("[data-concern-student-selector]");
  if (!selector) return;
  const visibleIds = new Set(getStudentsMatchingFilters(getStudentFilters(activeView)).map((student) => student.id));
  // Keep the original checkboxes in the form so hidden selections are submitted,
  // and filtering never replaces incident details or MTSS support fields.
  selector.querySelectorAll("[data-concern-student-id]").forEach((option) => {
    option.hidden = !visibleIds.has(option.dataset.concernStudentId);
  });
  const selectedCount = selector.querySelectorAll('[name="studentIds"]:checked').length;
  selector.querySelector("[data-concern-student-count]").textContent = `${formatStudentCount(visibleIds.size)} available · ${selectedCount} selected`;
  selector.querySelector("[data-student-filter-empty]").outerHTML = renderStudentFilterEmptyState(activeView, visibleIds.size > 0);
}

function renderBehaviorIssueOptions(level) {
  const issues = BEHAVIOR_ISSUES.filter((issue) => issue.level === Number(level))
    .map(
      (issue) => `
        <label class="issue-option">
          <input type="checkbox" name="issueIds" value="${issue.id}" />
          <span>
            <strong>${issue.title}</strong>
            <small>${issue.description}</small>
          </span>
        </label>
      `
    )
    .join("");
  if (!issues) return '<p class="field-help">Select Tier 1 or Tier 2 to view the related issues.</p>';
  return `${issues}
    <label class="issue-option">
      <input id="behavior-other-issue-toggle" type="checkbox" name="otherIssueSelected" value="1" />
      <span><strong>Other issue not listed</strong><small>Use the additional incident details box below.</small></span>
    </label>`;
}

function renderBehaviorStrategyPicker(tier = "") {
  const behavioralGroups = behavioralStrategies(tier);
  return `
    <details class="strategy-picker">
      <summary>
        <span><strong>Behavioral strategy suggestions</strong><small>${tier ? `Tier ${tier} support that was used.` : "Select a behavior tier first."}</small></span>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 10 4 4 4-4" /></svg>
      </summary>
      <div class="strategy-picker-content">
        ${behavioralGroups.map(
          (group) => `
            <fieldset>
              <legend>${group.label}</legend>
              ${group.options
                .map(
                  (option) => `
                    <label class="compact-check">
                      <input type="checkbox" name="strategies" value="${escapeHtml(option)}" />
                      <span>${option}</span>
                    </label>
                  `
                )
                .join("")}
            </fieldset>
          `
        ).join("")}
      </div>
    </details>
  `;
}

function renderBehaviorConcern() {
  return `
    <div class="page concern-page">
      ${renderPageHeader("Behavior concern", "")}
      ${renderConcernConfirmation()}

      <form id="behavior-concern-form" class="panel concern-form">

        <fieldset class="concern-section">
          <legend><span>1</span> Students involved</legend>
          ${renderConcernStudentSelector()}
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>2</span> Incident details</legend>
          <div class="form-grid three-columns">
            <label>Date of incident<input name="incidentDate" type="date" value="${getTodayInputValue()}" required /></label>
            <label>Time of incident<input name="incidentTime" type="time" value="13:15" required /></label>
            <label>Location<select name="location" required><option value="">Select a location</option>${BEHAVIOR_LOCATIONS.map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`).join("")}</select></label>
          </div>
          <label class="full-field">Other location <small>Complete only when “Other location” is selected</small><input name="otherLocation" maxlength="160" /></label>
          <label class="full-field">Concern title<input name="title" maxlength="${MAX_CONCERN_TITLE_LENGTH}" placeholder="Short student-visible title" required /></label>
          <label class="full-field">Description<textarea name="description" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="5" placeholder="Describe what happened using objective language" required></textarea></label>
          <p class="visibility-note"><strong>Student-visible fields:</strong> title, incident date, and description only.</p>
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>3</span> Behavior code issues</legend>
          <div class="form-grid two-columns">
            <label>Behavior tier<select id="behavior-tier" name="tier" required><option value="">Select a tier first</option><option value="1">Tier 1 (Level I), teacher-managed</option><option value="2">Tier 2 (Level II), administration-managed</option></select></label>
            <label>Occurrence<select id="behavior-occurrence" name="occurrence" required><option value="">Select occurrence</option><option value="1">First occurrence</option><option value="2">Second occurrence</option><option value="3">Third occurrence or pattern</option></select></label>
          </div>
          <div class="issue-level-group" id="behavior-tier-issues">
            <p class="field-help">Select Tier 1 or Tier 2 to view its behavior-code items.</p>
          </div>
          <label class="full-field">Additional incident details or issue not listed <small>This can be used with any selected issue.</small><textarea name="additionalIssueDetails" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3"></textarea></label>
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>4</span> Code-based action</legend>
          <div class="automatic-action" id="behavior-code-preview" aria-live="polite">
            <p>Select students, a tier, an occurrence, and at least one code issue.</p>
          </div>
          <h3 class="subsection-title">Teacher response suggestions</h3>
          <div class="compact-check-grid">${BEHAVIOR_RESPONSE_OPTIONS.map((action) => `<label class="compact-check"><input type="checkbox" name="teacherActions" value="${escapeHtml(action)}" /><span>${escapeHtml(action)}</span></label>`).join("")}</div>
          <label class="full-field">Additional or different step taken <small>Optional</small><textarea name="customAction" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3" placeholder="Add context or record another action"></textarea></label>
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>5</span> MTSS strategies used <small>Optional</small></legend>
          ${renderBehaviorStrategyPicker()}
          <label class="compact-check other-check">
            <input id="behavior-other-strategy-toggle" type="checkbox" />
            <span>Other strategy</span>
          </label>
          <label class="full-field conditional-field" id="behavior-other-strategy-field" hidden>
            Describe the strategy
            <textarea name="otherStrategy" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3"></textarea>
          </label>
        </fieldset>

        <fieldset class="concern-section deduction-section">
          <legend><span>6</span> House-point deduction <small>Optional</small></legend>
          <p class="field-help">Leave the deduction at zero to publish the concern without changing House points.</p>
          <div class="form-grid two-columns">
            <label>7C value<select name="deductionValueId"><option value="">No 7C selected</option>${VALUES.map((value) => `<option value="${value.id}">${value.name}</option>`).join("")}</select></label>
            <label>Points taken<select name="deductionPoints"><option value="0">No points taken</option>${POINT_OPTIONS.map((points) => `<option value="${points}">−${points} points</option>`).join("")}</select></label>
          </div>
          <p class="visibility-note">The student and House totals will show a negative recognition: “Behavior demonstrates poor [selected 7C] value.”</p>
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>7</span> Supporting file <small>Optional</small></legend>
          ${renderConcernAttachmentFields()}
        </fieldset>

        <fieldset class="concern-section confidential-section">
          <legend><span>8</span> Confidential teacher note <small>Optional</small></legend>
          <p class="field-help">Visible only in authenticated teacher sessions. This field is excluded from any student-facing summary.</p>
          <label class="full-field"><span class="sr-only">Confidential teacher note</span><textarea name="confidentialNote" maxlength="${MAX_INTERNAL_NOTE_LENGTH}" rows="4" placeholder="Internal context for teachers only"></textarea></label>
        </fieldset>

        <fieldset class="concern-section editor-access-section">
          <legend><span>9</span> Editing access</legend>
          ${renderEditorAccessPicker()}
        </fieldset>

        <div class="form-submit-bar">
          <span>Publication date and author are added automatically.</span>
          <button class="primary-button" type="submit">Publish behavior concern</button>
        </div>
      </form>
    </div>
  `;
}

function renderAcademicIssueOptions(selectedTier = 1) {
  return Object.entries(ACADEMIC_CONCERN_EXAMPLES)
    .filter(([tier]) => Number(tier) === Number(selectedTier))
    .map(
      ([tier, issues]) => `
        <optgroup label="Tier ${tier} academic concerns">
          ${issues.map((issue) => `<option value="${escapeHtml(issue)}" data-tier="${tier}">${issue}</option>`).join("")}
        </optgroup>
      `
    )
    .join("");
}

function getAcademicStrategyOptions(tier, profileId) {
  return academicStrategies(tier, profileId);
}

function renderAcademicStrategyOptions(tier = 1, profileId = "") {
  return getAcademicStrategyOptions(tier, profileId)
    .map((strategy) => `<option value="${escapeHtml(strategy)}">${strategy}</option>`)
    .join("");
}

function renderAcademicConcern() {
  return `
    <div class="page concern-page">
      ${renderPageHeader("Academic concern", "")}
      ${renderConcernConfirmation()}

      <form id="academic-concern-form" class="panel concern-form">

        <fieldset class="concern-section">
          <legend><span>1</span> Students involved</legend>
          ${renderConcernStudentSelector()}
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>2</span> Academic concern</legend>
          <div class="form-grid three-columns">
            <label>Date of concern<input name="incidentDate" type="date" value="${getTodayInputValue()}" required /></label>
            <label>MTSS tier<select id="academic-tier" name="tier" required><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select></label>
            <label>Special learning profile <small>Optional</small><select id="academic-profile" name="profileId"><option value="">No profile selected</option>${ACADEMIC_PROFILES.map((profile) => `<option value="${profile.id}">${profile.name}</option>`).join("")}</select></label>
          </div>
          <label class="full-field">Concern title<input name="title" maxlength="${MAX_CONCERN_TITLE_LENGTH}" placeholder="Short internal title" required /></label>
          <label class="full-field">What kind of academic issue?
            <select id="academic-issue-select" name="issueIds" multiple size="8" aria-describedby="academic-multi-help">
              ${renderAcademicIssueOptions()}
            </select>
          </label>
          <p class="field-help" id="academic-multi-help">Choose one or more items from the selected tier.</p>
          <label class="full-field">Other academic issue <small>Optional</small><textarea name="otherIssue" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3" placeholder="Write the concern in your own words if it is not listed"></textarea></label>
          <label class="full-field">Description<textarea name="description" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="5" placeholder="Include observations, evidence, or a pattern you have noticed" required></textarea></label>
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>3</span> Steps taken</legend>
          <div class="profile-strategy-heading" id="academic-strategy-heading">
            <strong>Tier 1 instructional strategies</strong>
            <span>Select all that were used.</span>
          </div>
          <label class="full-field"><span class="sr-only">Recommended intervention strategies</span>
            <select id="academic-strategy-select" name="strategies" multiple size="8">
              ${renderAcademicStrategyOptions(1)}
            </select>
          </label>
          <label class="full-field">What step did you take?<textarea name="actionDetails" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="5" placeholder="Describe when, how, and for how long the support was provided" required></textarea></label>
          <label class="full-field">Other intervention <small>Optional</small><textarea name="otherStrategy" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3"></textarea></label>
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>4</span> Supporting file <small>Optional</small></legend>
          ${renderConcernAttachmentFields()}
        </fieldset>

        <fieldset class="concern-section confidential-section">
          <legend><span>5</span> Internal note <small>Optional</small></legend>
          <label class="full-field"><span class="sr-only">Internal academic note</span><textarea name="internalNote" maxlength="${MAX_INTERNAL_NOTE_LENGTH}" rows="4" placeholder="Additional teacher-only context"></textarea></label>
        </fieldset>

        <fieldset class="concern-section editor-access-section">
          <legend><span>6</span> Editing access</legend>
          ${renderEditorAccessPicker()}
        </fieldset>

        <div class="form-submit-bar">
          <span>Publication date and author are added automatically.</span>
          <button class="primary-button" type="submit">Publish academic concern</button>
        </div>
      </form>
    </div>
  `;
}

function renderSelConcernOptions(tier = 1) {
  return selOptions(tier).map((option) => `
    <article class="sel-concern-option ${option.urgent ? "is-urgent" : ""}">
      <label>
        <input type="checkbox" name="concernIds" value="${option.id}" />
        <span><strong>${escapeHtml(option.title)}</strong><small>Tier ${option.tier}${option.urgent ? " · Immediate support review" : ""}</small></span>
      </label>
      <details>
        <summary>PDF connection and suggested strategies</summary>
        <p><strong>Closest PDF example:</strong> ${escapeHtml(option.pdfReference)}</p>
        <ul>${option.strategies.map((strategy) => `<li>${escapeHtml(strategy)}</li>`).join("")}</ul>
      </details>
    </article>
  `).join("");
}

function renderSelConcern() {
  return `
    <div class="page concern-page">
      ${renderPageHeader("SEL concern", "")}
      ${renderConcernConfirmation()}
      <form id="sel-concern-form" class="panel concern-form">

        <fieldset class="concern-section">
          <legend><span>1</span> Students involved</legend>
          ${renderConcernStudentSelector()}
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>2</span> Observation</legend>
          <div class="form-grid two-columns">
            <label>Date observed<input name="incidentDate" type="date" value="${getTodayInputValue()}" required /></label>
            <label>Concern title<input name="title" maxlength="${MAX_CONCERN_TITLE_LENGTH}" required /></label>
          </div>
          <label class="full-field">Objective description<textarea name="description" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="5" required placeholder="Describe what you observed or what the student reported."></textarea></label>
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>3</span> Social-emotional concerns</legend>
          <p class="field-help">Select every item that applies. These labels support observation and referral; they are not diagnoses.</p>
          <label>MTSS tier<select id="sel-tier" name="tier"><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select></label>
          <div class="sel-concern-grid">${renderSelConcernOptions()}</div>
          <label class="full-field">Other concern details <small>Required only when Other is selected</small><textarea name="otherConcern" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3"></textarea></label>
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>4</span> Support or follow-up <small>Optional</small></legend>
          <label class="full-field"><span class="sr-only">Support or follow-up</span><textarea name="followUp" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="4" placeholder="Support offered, people contacted, or next review step"></textarea></label>
          <p class="visibility-note">Tier 3 and safety concerns require immediate school procedures. The strategy suggestions do not replace urgent referral.</p>
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>5</span> Supporting file <small>Optional</small></legend>
          ${renderConcernAttachmentFields()}
        </fieldset>

        <fieldset class="concern-section confidential-section">
          <legend><span>6</span> Confidential teacher note <small>Optional</small></legend>
          <label class="full-field"><span class="sr-only">Confidential SEL note</span><textarea name="confidentialNote" maxlength="${MAX_INTERNAL_NOTE_LENGTH}" rows="4" placeholder="Additional context for authenticated teachers only"></textarea></label>
        </fieldset>

        <fieldset class="concern-section editor-access-section">
          <legend><span>7</span> Editing access</legend>
          ${renderEditorAccessPicker()}
        </fieldset>

        <div class="form-submit-bar">
          <span>Publication date and author are added automatically.</span>
          <button class="primary-button" type="submit">Publish SEL concern</button>
        </div>
      </form>
    </div>
  `;
}

function getFilteredStudents() {
  return getStudentsMatchingFilters(getStudentFilters("students"));
}

function formatStudentCount(count) {
  return `${count} ${count === 1 ? "student" : "students"}`;
}

function renderStudents() {
  if (activeUser?.type === "student") {
    const student = getActiveStudent();
    return `<div class="page">${renderPageHeader("My profile", "")}<section class="panel">${renderSupportProfile(state, activeUser, student, escapeHtml)}${renderStudentCoinTable(student)}<section class="profile-record-section"><h3>Behavior notices</h3>${state.behaviorConcerns.map(item => `<article><h4>${escapeHtml(item.title)}</h4><time>${formatDateOnly(item.incidentDate)}</time><p>${escapeHtml(item.description)}</p></article>`).join("") || '<p>No behavior notices.</p>'}</section></section></div>`;
  }
  const filteredStudents = getFilteredStudents();

  return `
    <div class="page">
      ${renderPageHeader("Students", "")}

      ${renderStudentFilters("students")}

      <div class="students-layout">
        <section class="panel student-list-panel" aria-labelledby="student-count">
          <div class="list-heading">
            <h2 id="student-count">${formatStudentCount(filteredStudents.length)}</h2>
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
    return renderStudentFilterEmptyState("students");
  }

  return students.map(student => `<div class="student-crest-item"><button class="student-crest ${student.id === profileStudentId ? "is-selected" : ""}" type="button" data-action="select-student" data-student-id="${student.id}" aria-pressed="${student.id === profileStudentId}" aria-label="${escapeHtml(student.name)}, Grade ${student.grade}, ${getHouse(student.houseId).name}, ${getStudentTotal(state, student.id)} points">
    ${renderCrestVisual(student)}
  </button>${renderIepHeart(state, activeUser, student, escapeHtml)}</div>`).join("");
}

function renderStudentDetailRegion() {
  const isStudentVisible = getFilteredStudents().some(
    (student) => student.id === profileStudentId
  );

  if (!profileStudentId || !isStudentVisible) {
    profileStudentId = null;
    expandedStudentValueId = null;
    resetProfileConcernFilters();
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
                    <time datetime="${award.createdAt}">Published ${formatDateTime(award.createdAt)}</time>
                    ${renderRecognitionComment(award.comment)}
                  </div>
                  <b class="points-notification ${award.points < 0 ? "is-negative" : ""}">${formatSignedPoints(award.points)}</b>
                </li>
              `;
            })
            .join("")}
        </ul>
      ` : '<p class="empty-value-history">No recognitions for this 7C yet.</p>'}
    </div>
  `;
}

function renderProfileRecordAction(student, type) {
  if (activeUser?.type !== "teacher") return "";
  const labels = { coin: "Send coin", behavior: "Behavior concern", academic: "Academic concern", sel: "SEL concern" };
  return `<button type="button" class="text-button profile-record-action" data-action="${type === "coin" ? "send-to-student" : `${type}-for-student`}" data-student-id="${student.id}">+ ${labels[type]}</button>`;
}

function renderStudentCoinTable(student) {
  const awards = getStudentAwards(state, student.id);
  return `
    <section class="profile-record-section" aria-labelledby="${student.id}-coin-history">
      <div class="record-section-heading">
        <div><h3 id="${student.id}-coin-history">Coins received</h3><span>${awards.length} published recognitions</span></div>
        ${renderProfileRecordAction(student, "coin")}
      </div>
      <div class="responsive-table">
        <table class="record-table">
          <thead><tr><th scope="col">Published</th><th scope="col">HCAS 7C</th><th scope="col">Teacher</th><th scope="col">Points</th><th scope="col">Comment</th><th scope="col">Access</th></tr></thead>
          <tbody>
            ${awards.length
              ? awards
                  .map((award) => {
                    const value = getValue(award.valueId);
                    const teacher = getTeacher(award.teacherId);
                    return `
                      <tr id="award-${award.id}">
                        <td><time datetime="${award.createdAt}">${formatDateTime(award.createdAt)}</time></td>
                        <td><span class="table-value"><span class="value-mini-logo" style="--value-logo: url('${value.image}')" aria-hidden="true"></span>${value.name}</span></td>
                        <td>${teacher.name}</td>
                        <td><b class="points-notification ${award.points < 0 ? "is-negative" : ""}">${formatSignedPoints(award.points)}</b></td>
                        <td>${award.comment ? escapeHtml(award.comment) : '<span class="muted-cell">No comment</span>'}</td>
                        <td>${renderRecordEditButton("award", award)}${renderRecordAccessSummary(award)}</td>
                      </tr>
                    `;
                  })
                  .join("")
              : '<tr><td colspan="6" class="empty-table-cell">No coins have been published for this student.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBehaviorConcernsTable(student) {
  const allConcerns = getStudentBehaviorConcerns(state, student.id);
  const concerns = allConcerns.filter((concern) =>
    concernMatchesProfileFilter("behavior", concern, profileConcernFilters.behavior)
  );
  const countLabel = profileConcernFilters.behavior === "all"
    ? `${allConcerns.length} notices`
    : `${concerns.length} of ${allConcerns.length} notices`;
  return `
    <section class="profile-record-section" aria-labelledby="${student.id}-behavior-history">
      <div class="record-section-heading">
        <div><h3 id="${student.id}-behavior-history">Behavior concerns</h3><span>${countLabel}</span></div>
        <div class="record-heading-tools">
          ${renderProfileConcernFilter("behavior", allConcerns, "behavior issues")}
          ${renderProfileRecordAction(student, "behavior")}
          <span class="privacy-badge">Teacher details</span>
        </div>
      </div>
      <div class="responsive-table">
        <table class="record-table concern-history-table">
          <thead><tr><th scope="col">Incident</th><th scope="col">Concern</th><th scope="col">Published</th><th scope="col">Author</th><th scope="col">Access</th></tr></thead>
          <tbody>
            ${concerns.length
              ? concerns
                  .map((concern) => {
                    const author = getTeacher(concern.teacherId);
                    const issues = concern.issueIds.map((issueId) => BEHAVIOR_ISSUES.find((issue) => issue.id === issueId)).filter(Boolean);
                    const actions = (concern.codeActions ?? []).filter((action) => action.studentId === student.id);
                    const linkedStudents = concern.studentIds.filter((studentId) => studentId !== student.id).map(getStudent).filter(Boolean);
                    return `
                      <tr>
                        <td><time datetime="${concern.incidentDate}">${formatDateOnly(concern.incidentDate)}</time>${concern.incidentTime ? `<small class="record-meta">${formatClockTime(concern.incidentTime)}${concern.location ? ` · ${escapeHtml(concern.location)}` : ""}</small>` : ""}</td>
                        <td>
                          <strong>${escapeHtml(concern.title)}</strong>
                          <p class="record-description">${escapeHtml(concern.description)}</p>
                          <details class="record-details">
                            <summary>View teacher details</summary>
                            ${responseHistory(state, activeUser, concern, escapeHtml)}
                            <div>
                              <h4>Code issues</h4>
                              <ul>${issues.map((issue) => `<li><span class="level-badge level-${issue.level === 1 ? "one" : "two"}">Tier ${issue.level}</span> ${issue.title}</li>`).join("")}${concern.otherIssue ? `<li>Other: ${escapeHtml(concern.otherIssue)}</li>` : ""}</ul>
                              ${concern.occurrence ? `<p><strong>Occurrence:</strong> ${concern.occurrence === 3 ? "Third occurrence or pattern" : `${concern.occurrence}${concern.occurrence === 1 ? "st" : "nd"} occurrence`}</p>` : ""}
                              ${concern.additionalIssueDetails && !concern.otherIssue ? `<h4>Additional incident details</h4><p>${escapeHtml(concern.additionalIssueDetails)}</p>` : ""}
                              ${actions.length ? `<h4>Required action for ${student.name}</h4><ul>${actions.map((action) => `<li><strong>${action.label}</strong>: ${action.description}</li>`).join("")}</ul>` : ""}
                              ${(concern.teacherActions ?? []).length ? `<h4>Teacher responses</h4><ul>${concern.teacherActions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul>` : ""}
                              ${(concern.strategies ?? []).length || concern.otherStrategy ? `<h4>Behavioral MTSS strategies</h4><ul>${(concern.strategies ?? []).map((strategy) => `<li>${escapeHtml(strategy)}</li>`).join("")}${concern.otherStrategy ? `<li>${escapeHtml(concern.otherStrategy)}</li>` : ""}</ul>` : ""}
                              ${concern.customAction ? `<h4>Additional action</h4><p>${escapeHtml(concern.customAction)}</p>` : ""}
                              ${concern.deduction ? `<h4>House-point deduction</h4><p><span class="points-notification is-negative">−${concern.deduction.points}</span> ${escapeHtml(getValue(concern.deduction.valueId)?.name ?? "7C")}</p>` : ""}
                              ${renderConcernAttachment(concern, "record")}
                              ${linkedStudents.length ? `<h4>Other students involved, teacher-only</h4><div class="linked-students">${linkedStudents.map((linkedStudent) => renderStudentIdentity(linkedStudent, { secondary: `Grade ${linkedStudent.grade}`, points: getStudentTotal(state, linkedStudent.id), action: true, className: "is-compact" })).join("")}</div>` : ""}
                              ${concern.confidentialNote || concern.attachmentVisibility === "confidential" ? `<div class="confidential-note"><strong>Confidential teacher section</strong>${concern.confidentialNote ? `<p>${escapeHtml(concern.confidentialNote)}</p>` : ""}${renderConcernAttachment(concern, "confidential")}</div>` : ""}
                              ${renderRecordAccessSummary(concern)}
                            </div>
                          </details>
                        </td>
                        <td><time datetime="${concern.publishedAt}">${formatDateTime(concern.publishedAt)}</time></td>
                        <td>${author.name}</td>
                        <td>${renderRecordEditButton("behavior", concern)}</td>
                      </tr>
                    `;
                  })
                  .join("")
              : `<tr><td colspan="5" class="empty-table-cell">${allConcerns.length ? "No behavior concerns match this filter." : "No behavior concerns have been published."}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAcademicConcernsTable(student) {
  const allConcerns = getStudentAcademicConcerns(state, student.id);
  const concerns = allConcerns.filter((concern) =>
    concernMatchesProfileFilter("academic", concern, profileConcernFilters.academic)
  );
  const countLabel = profileConcernFilters.academic === "all"
    ? `${allConcerns.length} teacher-only records`
    : `${concerns.length} of ${allConcerns.length} teacher-only records`;
  return `
    <section class="profile-record-section teacher-only-records" aria-labelledby="${student.id}-academic-history">
      <div class="record-section-heading">
        <div><h3 id="${student.id}-academic-history">Academic concerns</h3><span>${countLabel}</span></div>
        <div class="record-heading-tools">
          ${renderProfileConcernFilter("academic", allConcerns, "academic concerns")}
          ${renderProfileRecordAction(student, "academic")}
          <span class="privacy-badge is-private">Teachers only</span>
        </div>
      </div>
      <div class="responsive-table">
        <table class="record-table concern-history-table">
          <thead><tr><th scope="col">Concern date</th><th scope="col">Academic record</th><th scope="col">Published</th><th scope="col">Author</th><th scope="col">Access</th></tr></thead>
          <tbody>
            ${concerns.length
              ? concerns
                  .map((concern) => {
                    const author = getTeacher(concern.teacherId);
                    const profile = ACADEMIC_PROFILES.find((item) => item.id === concern.profileId);
                    const linkedStudents = concern.studentIds.filter((studentId) => studentId !== student.id).map(getStudent).filter(Boolean);
                    return `
                      <tr>
                        <td><time datetime="${concern.incidentDate}">${formatDateOnly(concern.incidentDate)}</time></td>
                        <td>
                          <strong>${escapeHtml(concern.title)}</strong>
                          <p class="record-description">${escapeHtml(concern.description)}</p>
                          <details class="record-details">
                            <summary>View academic details</summary>
                            ${responseHistory(state, activeUser, concern, escapeHtml)}
                            <div>
                              <p><span class="level-badge academic-tier">Tier ${concern.tier}</span>${profile ? ` ${profile.name}` : " General academic concern"}</p>
                              ${(concern.issueIds ?? []).length || concern.otherIssue ? `<h4>Academic issues</h4><ul>${(concern.issueIds ?? []).map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}${concern.otherIssue ? `<li>${escapeHtml(concern.otherIssue)}</li>` : ""}</ul>` : ""}
                              ${(concern.strategies ?? []).length || concern.otherStrategy ? `<h4>Selected interventions</h4><ul>${(concern.strategies ?? []).map((strategy) => `<li>${escapeHtml(strategy)}</li>`).join("")}${concern.otherStrategy ? `<li>${escapeHtml(concern.otherStrategy)}</li>` : ""}</ul>` : ""}
                              <h4>Step taken</h4><p>${escapeHtml(concern.actionDetails)}</p>
                              ${renderConcernAttachment(concern, "record")}
                              ${linkedStudents.length ? `<h4>Other students involved, teacher-only</h4><div class="linked-students">${linkedStudents.map((linkedStudent) => renderStudentIdentity(linkedStudent, { secondary: `Grade ${linkedStudent.grade}`, points: getStudentTotal(state, linkedStudent.id), action: true, className: "is-compact" })).join("")}</div>` : ""}
                              ${concern.internalNote || concern.attachmentVisibility === "confidential" ? `<div class="confidential-note"><strong>Internal teacher section</strong>${concern.internalNote ? `<p>${escapeHtml(concern.internalNote)}</p>` : ""}${renderConcernAttachment(concern, "confidential")}</div>` : ""}
                              ${renderRecordAccessSummary(concern)}
                            </div>
                          </details>
                        </td>
                        <td><time datetime="${concern.publishedAt}">${formatDateTime(concern.publishedAt)}</time></td>
                        <td>${author.name}</td>
                        <td>${renderRecordEditButton("academic", concern)}</td>
                      </tr>
                    `;
                  })
                  .join("")
              : `<tr><td colspan="5" class="empty-table-cell">${allConcerns.length ? "No academic concerns match this filter." : "No academic concerns have been published."}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSelConcernsTable(student) {
  const allConcerns = getStudentSelConcerns(state, student.id);
  const concerns = allConcerns.filter((concern) =>
    concernMatchesProfileFilter("sel", concern, profileConcernFilters.sel)
  );
  const countLabel = profileConcernFilters.sel === "all"
    ? `${allConcerns.length} teacher-only records`
    : `${concerns.length} of ${allConcerns.length} teacher-only records`;
  return `
    <section class="profile-record-section teacher-only-records" aria-labelledby="${student.id}-sel-history">
      <div class="record-section-heading">
        <div><h3 id="${student.id}-sel-history">SEL concerns</h3><span>${countLabel}</span></div>
        <div class="record-heading-tools">
          ${renderProfileConcernFilter("sel", allConcerns, "SEL concerns")}
          ${renderProfileRecordAction(student, "sel")}
          <span class="privacy-badge is-private">Teachers only</span>
        </div>
      </div>
      <div class="responsive-table">
        <table class="record-table concern-history-table">
          <thead><tr><th scope="col">Observed</th><th scope="col">SEL record</th><th scope="col">Published</th><th scope="col">Author</th><th scope="col">Access</th></tr></thead>
          <tbody>
            ${concerns.length ? concerns.map((concern) => {
              const author = getTeacher(concern.teacherId);
              const options = concern.concernIds.map((id) => SEL_CONCERN_OPTIONS.find((option) => option.id === id)).filter(Boolean);
              const linkedStudents = concern.studentIds.filter((id) => id !== student.id).map(getStudent).filter(Boolean);
              return `
                <tr>
                  <td><time datetime="${concern.incidentDate}">${formatDateOnly(concern.incidentDate)}</time></td>
                  <td>
                    <strong>${escapeHtml(concern.title)}</strong>
                    <p class="record-description">${escapeHtml(concern.description)}</p>
                    <details class="record-details">
                      <summary>View SEL details</summary>
                      ${responseHistory(state, activeUser, concern, escapeHtml)}
                      <div>
                        <h4>Observed concerns</h4>
                        <ul>${options.map((option) => `<li><span class="level-badge academic-tier">Tier ${option.tier}</span> ${escapeHtml(option.title)}${option.urgent ? " · immediate support review" : ""}</li>`).join("")}${concern.otherConcern ? `<li>${escapeHtml(concern.otherConcern)}</li>` : ""}</ul>
                        ${(concern.recommendedStrategies ?? []).length ? `<h4>Linked MTSS strategies</h4><ul>${concern.recommendedStrategies.map((strategy) => `<li>${escapeHtml(strategy)}</li>`).join("")}</ul>` : ""}
                        ${concern.followUp ? `<h4>Support or follow-up</h4><p>${escapeHtml(concern.followUp)}</p>` : ""}
                        ${renderConcernAttachment(concern, "record")}
                        ${linkedStudents.length ? `<h4>Other students involved, teacher-only</h4><div class="linked-students">${linkedStudents.map((linkedStudent) => renderStudentIdentity(linkedStudent, { secondary: `Grade ${linkedStudent.grade}`, points: getStudentTotal(state, linkedStudent.id), action: true, className: "is-compact" })).join("")}</div>` : ""}
                        ${concern.confidentialNote || concern.attachmentVisibility === "confidential" ? `<div class="confidential-note"><strong>Confidential teacher section</strong>${concern.confidentialNote ? `<p>${escapeHtml(concern.confidentialNote)}</p>` : ""}${renderConcernAttachment(concern, "confidential")}</div>` : ""}
                        ${renderRecordAccessSummary(concern)}
                      </div>
                    </details>
                  </td>
                  <td><time datetime="${concern.publishedAt}">${formatDateTime(concern.publishedAt)}</time></td>
                  <td>${escapeHtml(author?.name ?? "Unknown teacher")}</td>
                  <td>${renderRecordEditButton("sel", concern)}</td>
                </tr>`;
            }).join("") : `<tr><td colspan="5" class="empty-table-cell">${allConcerns.length ? "No SEL concerns match this filter." : "No SEL concerns have been published."}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSelCheckInsTable(student) {
  const checkIns = getStudentSelCheckIns(state, student.id);
  return `
    <section class="profile-record-section teacher-only-records" aria-labelledby="${student.id}-check-in-history">
      <div class="record-section-heading">
        <div><h3 id="${student.id}-check-in-history">Daily SEL check-ins</h3><span>${checkIns.length} student reflections</span></div>
        <span class="privacy-badge is-private">Teachers only</span>
      </div>
      <div class="responsive-table">
        <table class="record-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Feeling</th><th scope="col">Reflection</th></tr></thead>
          <tbody>${checkIns.length ? checkIns.map((checkIn) => `<tr><td>${formatDateOnly(checkIn.date)}</td><td><strong>${checkIn.rating}/5</strong></td><td>${escapeHtml(checkIn.reflection)}</td></tr>`).join("") : '<tr><td colspan="3" class="empty-table-cell">No daily check-ins yet.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
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

    ${renderStudentCoinTable(student)}
    ${cloudEnabled ? renderSupportProfile(state, activeUser, student, escapeHtml) : ""}
    ${renderBehaviorConcernsTable(student)}
    ${renderAcademicConcernsTable(student)}
    ${renderSelConcernsTable(student)}
    ${renderSelCheckInsTable(student)}


  `;
}

function renderActivityRows() {
  const events = filterActivity(staffActivity(state, activeUser), activityFilters);
  return events.length ? events.map(event => {
    const student = event.participants.map(p => getStudent(p.id)).find(Boolean);
    const award = event.recordKind === "award" ? state.awards.find(a => a.id === event.recordId) : null;
    const recordId = `${event.recordKind === "goal" ? "goal" : event.recordKind === "award" ? "award" : "concern"}-${event.recordId}`;
    return `<tr><td><time datetime="${escapeHtml(event.at)}">${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(event.at))}</time></td>
      <td>${ACTIVITY_TYPES[event.type] ?? "SMART goal"}</td>
      <td>${student ? `<button type="button" class="text-button activity-record-link" data-action="open-support-record" data-student-id="${student.id}" data-record-id="${escapeHtml(recordId)}">${escapeHtml(event.description)}</button>` : escapeHtml(event.description)}
        ${event.valueId ? `<small>${escapeHtml(getValue(event.valueId)?.name ?? "")}</small>` : ""}
        ${award ? `<div class="activity-record-actions">${renderRecordEditButton("award", award)}${canEditStudentRecord(state, activeTeacher.id, award) ? `<button type="button" class="unsend-button" data-action="unsend-points" data-award-id="${award.id}">Unsend points</button>` : ""}</div>` : ""}
      </td><td><div class="activity-people">${event.participants.map(person => {
        const current = getStudent(person.id);
        return current ? renderStudentIdentity(current, { action: true, className: "is-compact", points: getStudentTotal(state, current.id) }) : escapeHtml(person.name);
      }).join("")}</div></td></tr>`;
  }).join("") : '<tr><td colspan="4" class="empty-table-cell">No activity to show.</td></tr>';
}

function updateActivityFilter(control) {
  activityFilters[control.dataset.activityFilter] = control.value;
  if (activityFilters.from && activityFilters.to && activityFilters.from > activityFilters.to) {
    const other = control.dataset.activityFilter === "from" ? "to" : "from";
    activityFilters[other] = control.value;
    document.querySelector(`[data-activity-filter="${other}"]`).value = control.value;
  }
  const from = document.querySelector('[data-activity-filter="from"]'), to = document.querySelector('[data-activity-filter="to"]');
  if (from && to) { from.max = activityFilters.to; to.min = activityFilters.from; }
  refreshActivityTimeline();
}

function refreshActivityTimeline() {
  const body = document.querySelector("#activity-timeline-body");
  if (body) body.innerHTML = renderActivityRows();
  const all = staffActivity(state, activeUser), count = filterActivity(all, activityFilters).length;
  const active = Object.values(activityFilters).filter(Boolean).length;
  const counter = document.querySelector("#activity-timeline-count");
  if (counter) counter.textContent = active ? `${count} / ${all.length}` : String(all.length);
  const summary = document.querySelector(".activity-filter-panel > summary");
  if (summary) summary.textContent = `Filter activity${active ? ` · ${active} active` : ""}`;
}

function renderTeacherActivity() {
  const events = staffActivity(state, activeUser);
  const actions = [...new Set(events.map(event => event.action))];
  const filterCount = Object.values(activityFilters).filter(Boolean).length;
  return `<section class="panel activity-timeline" aria-labelledby="activity-timeline-title">
    <div class="panel-heading"><h2 id="activity-timeline-title">My activity</h2><span id="activity-timeline-count" role="status">${filterCount ? `${filterActivity(events, activityFilters).length} / ${events.length}` : events.length}</span></div>
    <details class="activity-filter-panel" ${filterCount ? "open" : ""}><summary>Filter activity${filterCount ? ` · ${filterCount} active` : ""}</summary><div class="activity-filter-grid">
      <label>Type<select data-activity-filter="type"><option value="">All types</option>${Object.entries(ACTIVITY_TYPES).map(([id, name]) => `<option value="${id}" ${activityFilters.type === id ? "selected" : ""}>${name}</option>`).join("")}</select></label>
      <label>Action<select data-activity-filter="action"><option value="">All actions</option>${actions.map(id => `<option value="${id}" ${activityFilters.action === id ? "selected" : ""}>${ACTIVITY_ACTIONS[id]}</option>`).join("")}</select></label>
      <label>Student<input data-activity-filter="query" type="search" placeholder="Search name" value="${escapeHtml(activityFilters.query)}" /></label>
      <label>House<select data-activity-filter="house"><option value="">All houses</option>${HOUSES.map(h => `<option value="${h.id}" ${activityFilters.house === h.id ? "selected" : ""}>${h.name}</option>`).join("")}</select></label>
      <label>Grade<select data-activity-filter="grade"><option value="">All grades</option>${getAvailableGrades().map(g => `<option value="${g}" ${activityFilters.grade === String(g) ? "selected" : ""}>Grade ${g}</option>`).join("")}</select></label>
      <label>7C<select data-activity-filter="valueId"><option value="">All 7Cs</option>${VALUES.map(value => `<option value="${value.id}" ${activityFilters.valueId === value.id ? "selected" : ""}>${value.name}</option>`).join("")}</select></label>
      <label>Points<select data-activity-filter="points"><option value="">All amounts</option>${[...POINT_OPTIONS.map(n => -n).reverse(), ...POINT_OPTIONS].map(points => `<option value="${points}" ${activityFilters.points === String(points) ? "selected" : ""}>${formatSignedPoints(points)}</option>`).join("")}</select></label>
      <label>From<input data-activity-filter="from" type="date" value="${activityFilters.from}" max="${activityFilters.to}" /></label>
      <label>To<input data-activity-filter="to" type="date" value="${activityFilters.to}" min="${activityFilters.from}" /></label>
      <button type="button" class="text-button" data-action="clear-activity-filters">Clear filters</button>
    </div></details>
    <div class="activity-table-scroll"><table class="activity-timeline-table"><thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Activity</th><th scope="col">Students</th></tr></thead><tbody id="activity-timeline-body">${renderActivityRows()}</tbody></table></div>
  </section>`;
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

function updateBehaviorCodePreview() {
  const form = document.querySelector("#behavior-concern-form");
  const preview = document.querySelector("#behavior-code-preview");
  if (!form || !preview) return;

  const formData = new FormData(form);
  const studentIds = formData.getAll("studentIds");
  const issueIds = formData.getAll("issueIds");
  const occurrence = Number(formData.get("occurrence"));
  if (!studentIds.length || !issueIds.length || ![1, 2, 3].includes(occurrence)) {
    preview.innerHTML = "<p>Select at least one student, an occurrence, and one code issue to retrieve the required action.</p>";
    return;
  }

  const actions = getBehaviorCodeActions(state, studentIds, issueIds, occurrence);
  preview.innerHTML = studentIds
    .map((studentId) => {
      const student = getStudent(studentId);
      const studentActions = actions.filter((action) => action.studentId === studentId);
      return `
        <section>
          ${renderStudentIdentity(student, {
            secondary: `Grade ${student.grade}`,
            points: getStudentTotal(state, student.id),
            className: "is-compact"
          })}
          <ul>
            ${studentActions
              .map((action) => {
                const issue = BEHAVIOR_ISSUES.find((item) => item.id === action.issueId);
                const dishonestyNote = action.issueId === "dishonesty" && action.occurrence === 1
                  ? " Academic dishonesty bypasses the preliminary warning/detention and proceeds directly to this step."
                  : "";
                return `<li><strong>${issue.title}: ${action.label}</strong><span>${action.description}${dishonestyNote}</span></li>`;
              })
              .join("")}
          </ul>
        </section>
      `;
    })
    .join("");
}

function updateAcademicFormOptions() {
  const tierSelect = document.querySelector("#academic-tier");
  const profileSelect = document.querySelector("#academic-profile");
  const issueSelect = document.querySelector("#academic-issue-select");
  const strategySelect = document.querySelector("#academic-strategy-select");
  const heading = document.querySelector("#academic-strategy-heading");
  if (!tierSelect || !profileSelect || !issueSelect || !strategySelect || !heading) return;

  const tier = Number(tierSelect.value);
  if (tier !== 3) profileSelect.value = "";
  profileSelect.closest("label").hidden = tier !== 3;
  const profileId = profileSelect.value;
  issueSelect.innerHTML = renderAcademicIssueOptions(tier);

  const profile = ACADEMIC_PROFILES.find((item) => item.id === profileId);
  strategySelect.innerHTML = renderAcademicStrategyOptions(tier, profileId);
  heading.innerHTML = profile
    ? `<strong>Five recommended intervention strategies</strong><span>${profile.name}</span>`
    : `<strong>Tier ${tier} ${tier === 1 ? "instructional strategies" : "academic interventions"}</strong><span>Select all that were used.</span>`;
}

function toggleConditionalField(toggleId, fieldId) {
  const toggle = document.querySelector(`#${toggleId}`);
  const field = document.querySelector(`#${fieldId}`);
  if (!toggle || !field) return;
  field.hidden = !toggle.checked;
  if (!toggle.checked) {
    field.querySelectorAll("input, textarea").forEach((control) => (control.value = ""));
  }
}

function render() {
  rememberFormSteps(viewRoot, formStepState);
  const isLoggedIn = Boolean(activeUser);
  document.body.classList.toggle("is-logged-out", !isLoggedIn);
  document.body.classList.toggle("is-student-session", activeUser?.type === "student");

  if (!isLoggedIn) {
    viewRoot.innerHTML = "";
    topbarHouseScores.innerHTML = "";
    document.querySelector("#sidebar-house-scores").innerHTML = "";
    document.querySelector("#sidebar-student-tools").innerHTML = "";
    return;
  }

  if (activeUser.type === "student" && !["dashboard", "students"].includes(activeView)) {
    activeView = "dashboard";
    window.history.replaceState(null, "", "#dashboard");
  }
  if (activeView === "administration" && !canAccessAdministration()) {
    activeView = "dashboard";
    window.history.replaceState(null, "", "#dashboard");
  }
  teacherName.textContent = activeUser.name;
  document.querySelector("#mobile-staff-name").textContent = activeUser.name;
  teacherAvatar.alt = `${activeUser.name}'s Dalton Plan House Teams emblem`;
  document.querySelector("#account-role").textContent = getAccountRoleLabel();
  renderTopbarHouseScores();

  document.querySelectorAll("[data-teacher-only]").forEach((element) => {
    element.hidden = activeUser.type !== "teacher";
  });
  document.querySelectorAll("[data-administration-nav]").forEach((element) => {
    element.hidden = !canAccessAdministration();
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    if (button.dataset.view === "students") {
      const label = button.querySelector("span");
      if (label) label.textContent = activeUser.type === "student" ? "My profile" : "Students";
      else for (const node of button.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = activeUser.type === "student" ? " My profile" : " Students";
      }
    }
    const isActive = button.dataset.view === activeView;
    button.classList.toggle("is-active", isActive);
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  if (mustChangePassword) {
    viewRoot.innerHTML = `<section class="panel support-section password-setup"><h1>Set your school password</h1><p>Replace your temporary password before opening student records.</p><form data-support-form="password"><label>New password (at least 14 characters)<input name="password" type="password" minlength="14" maxlength="128" autocomplete="new-password" required /></label><label>Confirm password<input name="confirmation" type="password" autocomplete="new-password" required /></label><button class="primary-button" type="submit">Save password</button><p class="support-error" role="alert"></p></form></section>`;
    return;
  }
  if (activeView === "send") viewRoot.innerHTML = renderSend();
  else if (activeView === "behavior-concern") viewRoot.innerHTML = renderBehaviorConcern();
  else if (activeView === "academic-concern") viewRoot.innerHTML = renderAcademicConcern();
  else if (activeView === "sel-concern") viewRoot.innerHTML = renderSelConcern();
  else if (activeView === "students") viewRoot.innerHTML = renderStudents();
  else if (activeView === "administration") viewRoot.innerHTML = renderAdministration();
  else viewRoot.innerHTML = renderDashboard();

  viewRoot.insertAdjacentHTML("beforeend", renderRecordEditModal());
  const pushStatus = viewRoot.querySelector("[data-push-status]");
  if (pushStatus) pushStatus.textContent = phonePushStatus;
  if (cloudEnabled && ["behavior-concern", "academic-concern", "sel-concern"].includes(activeView)) {
    viewRoot.querySelector(".form-submit-bar")?.insertAdjacentHTML("beforebegin", `<fieldset class="concern-section"><legend>Notify staff for follow-up</legend><p>All supervising teachers and super admins are included automatically. Add other staff below.</p><details><summary>Additional recipients</summary>${state.teachers.filter(t => !isSupervisor({ ...t, type: "teacher" })).map(t => `<label class="checkbox-label"><input type="checkbox" name="notificationRecipientIds" value="${escapeHtml(t.id)}" />${escapeHtml(t.name)}</label>`).join("")}</details><label class="checkbox-label plan-request-toggle"><input type="checkbox" name="requestSmartGoal" /> Notify supervising staff: a SMART support plan may help this student</label></fieldset>`);
  }

  enhanceFormSteps(viewRoot, activeView, formStepState);
  window.requestAnimationFrame(() => {
    syncCalendarCreationScope();
    if (activeView === "behavior-concern") updateBehaviorCodePreview();
    if (activeView === "academic-concern") updateAcademicFormOptions();
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  let user;
  try {
    if (cloudEnabled) {
      applyCloudResult(await cloudLogin(formData.get("username"), formData.get("password")));
      user = activeUser;
    } else user = authenticateUser(formData.get("username"), formData.get("password"), state);
  } catch (error) { loginError.textContent = error.message; return; }

  if (!user) {
    loginError.textContent = "Incorrect username or password.";
    document.querySelector("#login-password").select();
    return;
  }

  activeUser = user;
  activeTeacher = user.type === "teacher" ? user : null;
  activeView = "dashboard";
  window.history.replaceState(null, "", "#dashboard");
  saveUserSession(user);
  loginError.textContent = "";
  loginForm.reset();
  render();
  viewRoot.focus({ preventScroll: true });
  showToast(`Logged in as ${user.name}.`);
});

document.addEventListener("click", async (event) => {
  try {
  if (cloudBusy) return;
  const supportButton = event.target.closest("[data-action]");
  if (supportButton && await handleSupportClick(supportButton)) return;
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    if (viewButton.dataset.view === "send" && activeView !== "send") {
      resetSendSelection();
    }
    if (["behavior-concern", "academic-concern", "sel-concern"].includes(viewButton.dataset.view)) {
      concernStudentPreset = null;
      lastConcernConfirmation = null;
    }
    setView(viewButton.dataset.view);
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  if (actionTarget.classList.contains("modal-backdrop") && event.target !== actionTarget) return;

  switch (actionTarget.dataset.action) {
    case "calendar-prev":
      calendarWeekStart = addCalendarDays(calendarWeekStart, -7);
      selectedCalendarEventId = null;
      render();
      break;
    case "calendar-next":
      calendarWeekStart = addCalendarDays(calendarWeekStart, 7);
      selectedCalendarEventId = null;
      render();
      break;
    case "calendar-today":
      calendarWeekStart = getInitialCalendarWeek();
      selectedCalendarEventId = null;
      render();
      break;
    case "open-calendar-event":
      selectedCalendarEventId = actionTarget.dataset.eventId;
      render();
      window.requestAnimationFrame(() => document.querySelector(".calendar-event-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
      break;
    case "open-calendar-create":
      calendarCreateOpen = true;
      render();
      break;
    case "close-calendar-create":
      calendarCreateOpen = false;
      render();
      break;
    case "open-sel-check-in":
      selCheckInOpen = true;
      render();
      break;
    case "close-sel-check-in":
      selCheckInOpen = false;
      render();
      break;
    case "close-calendar-event":
      selectedCalendarEventId = null;
      render();
      break;
    case "remove-house-leader":
      if (!getActiveTeacherPermissions().canManageCalendarAccess) {
        showToast("Only a super admin can change leader access.");
        break;
      }
      await commitState(
        setHouseLeader(state, actionTarget.dataset.houseId, actionTarget.dataset.studentId, false),
        "House leader access removed."
      );
      break;
    case "remove-lab":
      if (!getActiveTeacherPermissions().canManageCalendarAccess) {
        showToast("Only a super admin can change lab access.");
        break;
      }
      await commitState(removeLabAssignment(state, actionTarget.dataset.labId), "Lab leader access removed.");
      break;
    case "open-editor-picker": {
      const dialog = actionTarget.closest(".editor-access-picker").querySelector("dialog");
      dialog.showModal();
      dialog.querySelector("[data-editor-search]").focus();
      break;
    }
    case "close-editor-picker":
      actionTarget.closest("dialog").close();
      break;
    case "clear-activity-filters":
      Object.keys(activityFilters).forEach(key => activityFilters[key] = "");
      document.querySelectorAll("[data-activity-filter]").forEach(el => el.value = "");
      refreshActivityTimeline();
      break;
    case "logout":
      document.querySelector("#school-pdf-reader")?.close();
      if (cloudEnabled) { await cloudLogout(); state = createInitialState(); cloudSnapshot = null; }
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
      activeUser = null;
      activeTeacher = null;
      activeView = "dashboard";
      resetSendSelection();
      expandedStudentValueId = null;
      resetProfileConcernFilters();
      concernStudentPreset = null;
      lastConcernConfirmation = null;
      window.location.hash = "dashboard";
      render();
      document.querySelector("#login-username").focus();
      break;
    case "go-send":
      resetSendSelection();
      setView("send");
      break;
    case "toggle-ranking-roster":
      rankingExpanded = !rankingExpanded;
      if (rankingExpanded && !hasStudentFilter(rankingFilters) && !rankingValueFilter && !rankingDateFrom && !rankingDateTo) rankingFilters.house = "all";
      render();
      break;
    case "clear-ranking-date":
      rankingDateFrom = "";
      rankingDateTo = "";
      render();
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
        comment,
        sendEditorIds
      );
      await saveState();
      const publishedAt = state.awards.at(-1).createdAt;
      lastConfirmation = {
        studentId,
        valueId: selectedValueId,
        points: pointsSent,
        comment: comment.trim(),
        publishedAt
      };
      sendStudentIds = sendStudentIds.filter((selectedId) => selectedId !== studentId);

      if (!sendStudentIds.length) {
        selectedValueId = null;
        selectedPoints = null;
        sendComment = "";
        sendEditorIds = [];
      }

      render();
      showToast(`${pointsSent} points sent to ${student.name} for ${value.name}.`);
      break;
    }
    case "reset-student-filters": {
      const context = actionTarget.dataset.filterContext;
      updateStudentFilters(context, emptyStudentFilters());
      viewRoot.querySelector(`[data-student-search="${context}"]`)?.focus();
      break;
    }
    case "open-student":
    case "select-student":
      if (profileStudentId !== actionTarget.dataset.studentId) {
        expandedStudentValueId = null;
        resetProfileConcernFilters();
      }
      profileStudentId = actionTarget.dataset.studentId;
      if (activeView !== "students") {
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
    case "close-student-detail":
      profileStudentId = null;
      expandedStudentValueId = null;
      resetProfileConcernFilters();
      refreshStudentBrowser();
      break;
    case "filter-house":
    case "filter-grade": {
      const context = actionTarget.closest("[data-student-filters]").dataset.studentFilters;
      const changes = actionTarget.dataset.action === "filter-house"
        ? { house: actionTarget.dataset.houseId }
        : { grade: actionTarget.dataset.grade };
      const key = "house" in changes ? "house" : "grade";
      if (getStudentFilters(context)[key] === changes[key]) changes[key] = "";
      updateStudentFilters(context, changes);
      break;
    }
    case "unsend-points": {
      const awardId = actionTarget.dataset.awardId;
      const award = state.awards.find((item) => item.id === awardId);
      if (!award || !canEditStudentRecord(state, activeTeacher.id, award)) break;
      const student = getStudent(award.studentId);
      const shouldUnsend = window.confirm(
        `Unsend ${award.points} points from ${student.name}? Student and house totals will update immediately.`
      );
      if (!shouldUnsend) break;
      state = removeAward(state, awardId, activeTeacher.id);
      await saveState();
      render();
      showToast(`${award.points} points unsent from ${student.name}.`);
      break;
    }
    case "edit-student-record": {
      const type = actionTarget.dataset.recordType;
      const id = actionTarget.dataset.recordId;
      recordEditTarget = { type, id };
      render();
      window.requestAnimationFrame(() => document.querySelector(".record-edit-modal")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
      break;
    }
    case "close-record-edit":
      recordEditTarget = null;
      render();
      break;
    case "send-to-student":
      resetSendSelection();
      sendStudentIds = [actionTarget.dataset.studentId];
      setView("send", { presetStudentId: actionTarget.dataset.studentId });
      break;
    case "behavior-for-student":
      concernStudentPreset = actionTarget.dataset.studentId;
      lastConcernConfirmation = null;
      setView("behavior-concern", { presetStudentId: actionTarget.dataset.studentId });
      break;
    case "academic-for-student":
      concernStudentPreset = actionTarget.dataset.studentId;
      lastConcernConfirmation = null;
      setView("academic-concern", { presetStudentId: actionTarget.dataset.studentId });
      break;
    case "sel-for-student":
      concernStudentPreset = actionTarget.dataset.studentId;
      lastConcernConfirmation = null;
      setView("sel-concern", { presetStudentId: actionTarget.dataset.studentId });
      break;
  }
  } catch (error) { showToast(error.message); render(); }
});

viewRoot.addEventListener("invalid", event => revealInvalidField(event.target), true);
viewRoot.addEventListener("keydown", event => {
  if (event.key === "Enter" && event.target.matches("[data-editor-search]")) event.preventDefault();
});

viewRoot.addEventListener("change", (event) => {
  if (event.target.matches("[data-activity-filter]")) { updateActivityFilter(event.target); return; }
  if (event.target.matches('[name="editorIds"]')) refreshEditorChips(event.target.closest(".editor-access-picker"));
  if (event.target.matches('#custom-calendar-event-form [name="scope"]')) { syncCalendarCreationScope(); return; }
  if (event.target.matches("#calendar-grade-filter")) {
    calendarTeacherGrade = event.target.value;
    selectedCalendarEventId = null;
    render();
  } else if (event.target.matches("#leader-house-select")) {
    const studentSelect = document.querySelector("#leader-student-select");
    if (studentSelect) {
      studentSelect.innerHTML = state.students
        .filter((student) => student.houseId === event.target.value)
        .map((student) => `<option value="${student.id}">${escapeHtml(student.name)} · G${student.grade}</option>`)
        .join("");
    }
  } else if (event.target.matches("#staff-status-teacher")) {
    const option = event.target.selectedOptions[0];
    const roleSelect = document.querySelector("#staff-status-role");
    const houseSelect = document.querySelector("#staff-status-house");
    if (roleSelect) roleSelect.value = option?.dataset.role ?? "teacher";
    if (houseSelect) houseSelect.value = option?.dataset.houseId ?? "";
  } else if (event.target.matches("#ranking-value-filter")) {
    rankingValueFilter = event.target.value;
    render();

  } else if (event.target.matches("#ranking-date-from")) {
    rankingDateFrom = event.target.value;
    if (rankingDateTo && rankingDateFrom > rankingDateTo) rankingDateTo = rankingDateFrom;
    render();
  } else if (event.target.matches("#ranking-date-to")) {
    rankingDateTo = event.target.value;
    if (rankingDateFrom && rankingDateTo < rankingDateFrom) rankingDateFrom = rankingDateTo;
    render();
  } else if (event.target.matches("[data-profile-concern-filter]")) {
    const type = event.target.dataset.profileConcernFilter;
    if (!(type in profileConcernFilters)) return;
    profileConcernFilters[type] = event.target.value;
    refreshStudentBrowser();
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-profile-concern-filter="${type}"]`)?.focus({ preventScroll: true });
    });
  } else if (event.target.matches('#award-form [name="editorIds"]')) {
    sendEditorIds = [...document.querySelectorAll('#award-form [name="editorIds"]:checked')].map(
      (input) => input.value
    );
    document.querySelectorAll(".send-summary dl > div:last-child dd").forEach((label) => {
      label.textContent = sendEditorIds.length ? `${sendEditorIds.length} selected` : "None";
    });
  } else if (event.target.matches("#behavior-tier")) {
    const issueContainer = document.querySelector("#behavior-tier-issues");
    if (issueContainer) issueContainer.innerHTML = renderBehaviorIssueOptions(event.target.value);
    const strategyPicker = document.querySelector(".strategy-picker");
    if (strategyPicker) strategyPicker.outerHTML = renderBehaviorStrategyPicker(event.target.value);
    updateBehaviorCodePreview();
  } else if (
    event.target.matches('#behavior-concern-form [name="studentIds"]') ||
    event.target.matches('#behavior-concern-form [name="issueIds"]') ||
    event.target.matches('#behavior-concern-form [name="otherIssueSelected"]') ||
    event.target.matches("#behavior-occurrence")
  ) {
    refreshConcernStudentSelector();
    updateBehaviorCodePreview();
  } else if (
    event.target.matches('#academic-concern-form [name="studentIds"]') ||
    event.target.matches('#sel-concern-form [name="studentIds"]')
  ) {
    refreshConcernStudentSelector();
  } else if (event.target.matches("#behavior-other-strategy-toggle")) {
    toggleConditionalField("behavior-other-strategy-toggle", "behavior-other-strategy-field");
  } else if (event.target.matches("[data-goal-concern-type]")) {
    const form = event.target.closest("form"), type = event.target.value;
    const select = form.querySelector("[data-goal-concern-id]");
    select.required = Boolean(type);
    select.innerHTML = '<option value="">Select a concern</option>' + (state[`${type}Concerns`] ?? []).filter(c => c.studentIds.includes(form.dataset.studentId)).map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)} · ${escapeHtml(c.incidentDate)}</option>`).join("");
  } else if (event.target.matches("#sel-tier")) {
    document.querySelector(".sel-concern-grid").innerHTML = renderSelConcernOptions(event.target.value);
  } else if (event.target.matches("#academic-profile")) {
    if (event.target.value) document.querySelector("#academic-tier").value = "3";
    updateAcademicFormOptions();
  } else if (event.target.matches("#academic-tier")) {
    updateAcademicFormOptions();
  }
});

viewRoot.addEventListener("input", (event) => {
  if (event.target.matches("[data-activity-filter]")) { updateActivityFilter(event.target); return; }
  if (event.target.matches("[data-editor-search]")) {
    const query = event.target.value.trim().toLowerCase();
    event.target.closest("dialog").querySelectorAll(".optional-editor-grid > label").forEach(label => label.hidden = !label.textContent.toLowerCase().includes(query));
    return;
  }
  if (event.target.matches("[data-student-search]")) {
    updateStudentFilters(event.target.dataset.studentSearch, { query: event.target.value });
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

viewRoot.addEventListener("submit", async (event) => {
  if (event.target.matches("[data-support-form]")) {
    event.preventDefault();
    await handleSupportSubmit(event.target);
    return;
  }
  if (cloudBusy) { event.preventDefault(); return; }
  if (event.target.matches("#record-edit-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const type = event.target.dataset.recordType;
    const recordId = event.target.dataset.recordId;
    try {
      const editorIds = formData.getAll("editorIds");
      const nextState = type === "award"
        ? updateAward(state, recordId, activeTeacher.id, {
            valueId: formData.get("valueId"),
            points: formData.get("points"),
            comment: formData.get("comment"),
            editorIds
          })
        : updateConcern(state, type, recordId, activeTeacher.id, {
            incidentDate: formData.get("incidentDate"),
            incidentTime: formData.get("incidentTime"),
            location: formData.get("location"),
            title: formData.get("title"),
            description: formData.get("description"),
            customAction: formData.get("customAction"),
            confidentialNote: formData.get("confidentialNote"),
            actionDetails: formData.get("actionDetails"),
            internalNote: formData.get("internalNote"),
            followUp: formData.get("followUp"),
            editorIds
          });
      recordEditTarget = null;
      await commitState(nextState, `${type === "award" ? "Coin" : "Concern"} updated.`);
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#transfer-student-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      lastCreatedAccount = null;
      await commitState(
        transferStudentHouse(
          state,
          activeUser,
          formData.get("studentId"),
          formData.get("houseId")
        ),
        "Student transferred to the new House."
      );
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#create-student-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      const nextState = createStudentAccount(state, activeUser, {
        name: formData.get("name"),
        grade: formData.get("grade"),
        houseId: formData.get("houseId")
      });
      lastCreatedAccount = nextState.students.at(-1);
      await commitState(nextState, "Student account created.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#create-teacher-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      const nextState = createTeacherAccount(state, activeUser, {
        name: formData.get("name"),
        role: formData.get("role"),
        houseId: formData.get("houseId")
      });
      lastCreatedAccount = nextState.teachers.at(-1);
      await commitState(nextState, "Teacher account created.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#update-teacher-status-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      const teacherId = formData.get("teacherId");
      const nextState = updateTeacherAccountStatus(state, activeUser, teacherId, {
        role: formData.get("role"),
        houseId: formData.get("houseId")
      });
      const teacher = nextState.teachers.find((item) => item.id === teacherId);
      await commitState(nextState, `${teacher.name} is now ${TEACHER_ROLE_LABELS[teacher.role]}.`);
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#house-leader-form")) {
    event.preventDefault();
    if (!getActiveTeacherPermissions().canManageCalendarAccess) {
      showToast("Only a super admin can change leader access.");
      return;
    }
    const formData = new FormData(event.target);
    try {
      await commitState(
        setHouseLeader(state, formData.get("houseId"), formData.get("studentId"), true),
        "House leader access assigned."
      );
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#lab-assignment-form")) {
    event.preventDefault();
    if (!getActiveTeacherPermissions().canManageCalendarAccess) {
      showToast("Only a super admin can change lab access.");
      return;
    }
    const formData = new FormData(event.target);
    try {
      const leader = getStudent(formData.get("leaderId"));
      const nextState = addLabAssignment(state, {
        name: formData.get("name"),
        weekday: formData.get("weekday"),
        location: formData.get("location"),
        leaderIds: [formData.get("leaderId")],
        teacherIds: formData.get("teacherId") ? [formData.get("teacherId")] : [],
        grades: leader ? [leader.grade] : []
      });
      await commitState(nextState, "Lab leader access created.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#custom-calendar-event-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      const [scopedType, scopedId] = String(formData.get("scope") ?? "").split(":");
      const type = scopedType || formData.get("type") || "school";
      const eventPayload = {
        date: formData.get("date"),
        title: formData.get("title"),
        type,
        grades: scopedType === "level-up" ? [Number(scopedId)] : formData.get("grade") === "all" ? [] : [formData.get("grade")],
        houseIds: type === "house"
          ? [scopedType ? scopedId : formData.get("houseId")].filter((id) => id && id !== "all")
          : [],
        labId: type === "lab" ? (scopedType ? scopedId : formData.get("labId")) : "",
        location: formData.get("location"),
        description: formData.get("description"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime")
      };
      const nextState = addCustomCalendarEvent(state, activeUser, eventPayload);
      calendarWeekStart = startOfCalendarWeek(formData.get("date"));
      calendarCreateOpen = false;
      await commitState(nextState, "Calendar event published.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#calendar-event-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const eventId = event.target.dataset.eventId;
    const calendarEvent = getVisibleCalendarEvents().find((item) => item.id === eventId);
    if (!calendarEvent) return;
    const file = formData.get("attachment");
    let attachmentData = calendarEvent.attachmentData ?? "";
    let attachmentName = calendarEvent.attachmentName ?? "";
    try {
      if (file?.size) {
        attachmentData = await readFileAsDataUrl(file, 750_000, "The document");
        attachmentName = file.name;
      }
      const nextState = updateCalendarEventDetails(state, activeUser, calendarEvent, {
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime"),
        location: formData.get("location"),
        description: formData.get("description"),
        resourceUrl: formData.get("resourceUrl"),
        attachmentData,
        attachmentName
      });
      await commitState(nextState, "Event details saved.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#award-form")) {
    event.preventDefault();
    return;
  }

  if (event.target.matches("#behavior-concern-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      const attachment = await readConcernAttachment(formData);
      state = addBehaviorConcern(state, {
        studentIds: formData.getAll("studentIds"),
        tier: formData.get("tier"),
        occurrence: formData.get("occurrence"),
        issueIds: formData.getAll("issueIds"),
        otherIssueSelected: formData.get("otherIssueSelected"),
        additionalIssueDetails: formData.get("additionalIssueDetails"),
        title: formData.get("title"),
        description: formData.get("description"),
        incidentTime: formData.get("incidentTime"),
        location: formData.get("location"),
        otherLocation: formData.get("otherLocation"),
        teacherActions: formData.getAll("teacherActions"),
        strategies: formData.getAll("strategies"),
        otherStrategy: formData.get("otherStrategy"),
        customAction: formData.get("customAction"),
        deductionValueId: formData.get("deductionValueId"),
        deductionPoints: formData.get("deductionPoints"),
        confidentialNote: formData.get("confidentialNote"),
        editorIds: formData.getAll("editorIds"),
        teacherId: activeTeacher.id,
        incidentDate: formData.get("incidentDate"),
        ...attachment
      });
      const concern = state.behaviorConcerns.at(-1);
      await saveState();
      lastConcernConfirmation = {
        type: "Behavior concern",
        studentIds: concern.studentIds,
        publishedAt: concern.publishedAt
      };
      concernStudentPreset = null;
      render();
      showToast("Behavior concern published.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#academic-concern-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      const attachment = await readConcernAttachment(formData);
      state = addAcademicConcern(state, {
        studentIds: formData.getAll("studentIds"),
        tier: formData.get("tier"),
        issueIds: formData.getAll("issueIds"),
        otherIssue: formData.get("otherIssue"),
        profileId: formData.get("profileId"),
        title: formData.get("title"),
        description: formData.get("description"),
        strategies: formData.getAll("strategies"),
        otherStrategy: formData.get("otherStrategy"),
        actionDetails: formData.get("actionDetails"),
        internalNote: formData.get("internalNote"),
        editorIds: formData.getAll("editorIds"),
        teacherId: activeTeacher.id,
        incidentDate: formData.get("incidentDate"),
        ...attachment
      });
      const concern = state.academicConcerns.at(-1);
      await saveState();
      lastConcernConfirmation = {
        type: "Academic concern",
        studentIds: concern.studentIds,
        publishedAt: concern.publishedAt
      };
      concernStudentPreset = null;
      render();
      showToast("Academic concern published.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#sel-concern-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      const attachment = await readConcernAttachment(formData);
      state = addSelConcern(state, {
        tier: Number(formData.get("tier")),
        studentIds: formData.getAll("studentIds"),
        concernIds: formData.getAll("concernIds"),
        otherConcern: formData.get("otherConcern"),
        title: formData.get("title"),
        description: formData.get("description"),
        followUp: formData.get("followUp"),
        confidentialNote: formData.get("confidentialNote"),
        editorIds: formData.getAll("editorIds"),
        teacherId: activeTeacher.id,
        incidentDate: formData.get("incidentDate"),
        ...attachment
      });
      const concern = state.selConcerns.at(-1);
      await saveState();
      lastConcernConfirmation = {
        type: "SEL concern",
        studentIds: concern.studentIds,
        publishedAt: concern.publishedAt
      };
      concernStudentPreset = null;
      render();
      showToast("SEL concern published.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (event.target.matches("#sel-check-in-form")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      state = addSelCheckIn(state, activeUser, {
        rating: formData.get("rating"),
        reflection: formData.get("reflection")
      });
      await saveState();
      selCheckInOpen = false;
      render();
      showToast("Today’s check-in is saved.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
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

window.addEventListener("school-session-expired", () => {
  activeUser = null;
  activeTeacher = null;
  cloudSnapshot = null;
  state = createInitialState();
  document.querySelector("#school-pdf-reader")?.close();
  render();
  loginError.textContent = "Your session ended. Please log in again.";
});

if (cloudEnabled && hasCloudSession()) {
  cloudCall("load").then(result => { applyCloudResult(result); render(); }).catch(error => { loginError.textContent = error.message; });
}
if (cloudEnabled) {
  setInterval(async () => {
    if (!activeUser || cloudBusy || mustChangePassword || document.querySelector("dialog[open]") || document.activeElement?.matches("input, textarea, select")) return;
    try {
      const result = await cloudCall("load");
      if (JSON.stringify(result.state) !== JSON.stringify(cloudSnapshot)) { applyCloudResult(result); render(); }
    } catch { /* Preserve the current view during temporary network failures. */ }
  }, 30_000);
}

initializePhonePush(() => activeUser, noticeId => {
  const n = state.notifications?.find(item => item.id === noticeId);
  if (n && activeUser && !mustChangePassword) openSupportRecord(n.studentId, n.goalId ? `${n.kind.includes("reflection") || n.kind === "goal-final-review" ? "reflection" : "goal"}-${n.goalId}` : n.concernId || n.concernIds?.length ? `concern-${n.concernId ?? n.concernIds.at(-1)}` : "");
});

import {
  ACADEMIC_CONCERN_EXAMPLES,
  ACADEMIC_PROFILES,
  BEHAVIOR_ISSUES,
  BEHAVIOR_LOCATIONS,
  BEHAVIOR_RESPONSE_OPTIONS,
  BEHAVIOR_STRATEGY_GROUPS,
  HOUSES,
  MAX_CONCERN_DESCRIPTION_LENGTH,
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
  getBehaviorIssueCount,
  getCalendarEvents,
  getHouseRanking,
  getAwardValueIds,
  behaviorDeductionSentence,
  getHouseTotals,
  getStudentAcademicConcerns,
  getStudentAwards,
  getStudentBehaviorConcerns,
  getStudentSelCheckIns,
  getStudentSelConcerns,
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
  updateTeacherAccountStatus as localUpdateTeacherAccountStatus,
  visibleEcActivities
} from "./data.js";
import { cloudEnabled, cloudLogin, cloudCall, cloudChangePassword, cloudLogout, hasCloudSession } from "./cloud-client.js";
import { leadershipScopes } from "./leadership.js";
import { renderLeadershipWorkspace, renderEventActivities } from "./leadership-ui.js";
import { SMART_FIELDS, isSupervisor } from "./support-rules.js";
import { renderIepHeart, renderSupportProfile, renderSupportDocuments, renderTrustedAdults } from "./support-ui.js";
import { renderFollowupNotifications as renderSupportNotifications, responseHistory, checkInRow, behaviorStudentResponse, notificationRecordTarget } from "./followup-ui.js";
import { issueChoice, selSupportChoices } from "./concern-ui.js";
import { academicStrategies, behavioralStrategies, selOptions } from "./tier-rules.js";
import { enablePhonePush, disablePhonePush, initializePhonePush } from "./push-client.js";
import { renderLevelUpAttachments, canReadLevelUpDocument } from "./levelup-resources.js";
import { openPdfReader } from "./pdf-reader.js";
import { emptyStudentFilters, hasStudentFilter, matchingStudents, studentCrestVisual, browseStudents, toggleFilterValues } from "./student-ui.js";
import { renderSchoolActivity, schoolActivityContent } from "./school-activity-ui.js";
import { ACTIVITY_TYPES, ACTIVITY_ACTIONS, staffActivity, filterActivity, recordActivity, alphabeticStaff } from "./activity.js";
import { rememberFormSteps, enhanceFormSteps, revealInvalidField } from "./form-steps.js";
let phonePushStatus = "";
let crestInstance = 0;
const formStepState = new Map();
const activityFilters = { query: "", type: "", action: "", house: "", grade: "", from: "", to: "", valueId: "", points: "" };

const schoolActivityFilters = { type: "", house: "", grade: "", studentId: "", from: "", to: "" };
let schoolActivityPage = 0;
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
let profileStudentId = null;
let studentQuery = "";
let houseFilter = [];
let studentGradeFilter = [];
let studentValueFilters = [];
let studentDateFrom = "", studentDateTo = "";
let profileCoinFilter = "all";
let expandedHouseId = null;
let houseRankingFilters = { valueIds: [], from: "", to: "" };
const houseRankingDialog = document.querySelector("#house-ranking-dialog");
const profileConcernFilters = {
  behavior: "all",
  academic: "all",
  sel: "all"
};
let lastConfirmation = null;
let lastConcernConfirmation = null;
let concernStudentPreset = null;
const concernStudentFilters = {
  "behavior-concern": emptyStudentFilters(),
  "academic-concern": emptyStudentFilters(),
  "sel-concern": emptyStudentFilters()
};
let calendarWeekStart = getInitialCalendarWeek();
let calendarTeacherGrade = "my";
let selectedCalendarEventId = null;
let calendarCreateOpen = false;
let selCheckInOpen = false;
let leadershipDateFrom = "", leadershipDateTo = "";
let trustedAdultPickerOpen = false;
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
    else { setView("students", { studentId: button.dataset.studentId }); document.getElementById(`student-support-${button.dataset.studentId}`)?.scrollIntoView({ block: "start" }); }
  } else if (action === "read-support-notification") {
    await runCloudAction("notification-read", { key: button.dataset.notificationKey });
  } else if (action === "goal-access") {
    await runCloudAction("goal-access", { id: button.dataset.goalId, field: button.dataset.field, canEdit: button.dataset.allow === "true" });
  } else if (action === "confirm-trusted-adult") {
    if (await runCloudAction("trusted-adult-confirm", { requestId: button.dataset.requestId })) showToast("Confirmed. The student has been notified.");
  } else if (action === "add-trusted-adult") {
    trustedAdultPickerOpen = true;
    const options = [...viewRoot.querySelectorAll(".trusted-adult-picker button")];
    options.forEach(option => option.disabled = true);
    try { await runCloudAction("trusted-adult-add", { teacherId: button.dataset.teacherId }); }
    finally { options.forEach(option => option.disabled = false); }
  } else if (action === "request-remove-trusted-adult") {
    trustedAdultPickerOpen = false;
    const picker = viewRoot.querySelector(".trusted-adult-picker");
    if (picker) picker.open = false;
    const dialog = document.querySelector("#trusted-adult-remove-dialog");
    dialog.dataset.teacherId = button.dataset.teacherId;
    dialog.querySelector("form").reset();
    dialog.querySelector("[data-trusted-remove-error]").textContent = "";
    dialog.querySelector("[data-trusted-remove-name]").textContent = `Remove ${getTeacher(button.dataset.teacherId)?.name ?? "this person"} from your trusted adults?`;
    dialog.showModal();
  } else if (action === "open-leadership-notice") {
    const notice = state.notifications?.find(n => n.key === button.dataset.notificationKey);
    if (notice) openLeadershipNotice(notice);
  } else if (action === "urgent-support") {
    const sent = await runCloudAction("urgent-support");
    if (sent) showToast("Your support request was sent to supervising staff and your trusted adults.");
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
      const encoded = await readFileAsDataUrl(file, 10 * 1024 * 1024, "Support-plan PDF");
      result = await cloudCall("iep-upload", { studentId: form.dataset.studentId, name: file.name, kind: formData.get("kind"), base64: encoded.split(",")[1] });
    } else if (["event-activity-add", "leader-task-add"].includes(type)) {
      const file = formData.get("attachment");
      const attachment = file?.size ? { attachmentName: file.name, attachmentData: await readFileAsDataUrl(file, 750_000, "Attachment") } : {};
      const payload = type === "event-activity-add" ? { eventId: form.dataset.eventId, text: formData.get("text"), ...attachment }
        : { scopeKey: form.dataset.scopeKey, title: formData.get("title"), description: formData.get("description"), deadline: formData.get("deadline"), leaderIds: formData.getAll("leaderIds"), ...attachment };
      result = await cloudCall(type, { payload });
    } else {
      const payload = type === "goal-add" ? {
        studentId: form.dataset.studentId, title: formData.get("title"), dueDate: formData.get("dueDate"),
        fields: Object.fromEntries(Object.keys(SMART_FIELDS).map(key => [key, formData.get(key)])),
        studentEditableFields: formData.getAll("studentEditableFields"),
        sourceConcernId: formData.get("sourceConcernId") || null, sourceConcernType: formData.get("sourceConcernType") || null, previousGoalId: formData.get("previousGoalId") || null,
        responsibleTeacherId: formData.get("responsibleTeacherId"), checkIns: readCheckIns(form)
      } : type === "goal-field" ? { id: form.dataset.goalId, field: form.dataset.field, text: formData.get("text"), dueDate: formData.get("dueDate") || undefined }
        : type === "goal-schedule" ? { id: form.dataset.goalId, responsibleTeacherId: formData.get("responsibleTeacherId"), checkIns: readCheckIns(form) }
        : ["goal-reflection", "goal-adult-reflection"].includes(type) ? { id: form.dataset.goalId, text: formData.get("text") }
        : type === "behavior-student-response" ? { id: form.dataset.concernId, text: formData.get("text") }
        : type === "goal-close" ? { id: form.dataset.goalId, status: formData.get("status"), note: formData.get("note") }
        : type === "support-plan-save" ? { studentId: form.dataset.studentId, info: formData.get("info") }
        : type === "account-reset" ? { id: formData.get("id") } : { teacherId: formData.get("teacherId") };
      result = await cloudCall(type, { payload });
    }
    applyCloudResult(result);
    render();
    showToast("Saved to your school account.");
  } catch (error) { errorElement.textContent = error.message; }
  finally { cloudBusy = false; button.disabled = false; }
}

const trustedRemovalDialog = document.querySelector("#trusted-adult-remove-dialog");
trustedRemovalDialog.addEventListener("click", event => {
  if (event.target === trustedRemovalDialog || event.target.closest("[data-close-trusted-remove]")) trustedRemovalDialog.close();
});
document.querySelector("#trusted-adult-remove-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target, button = form.querySelector('[type="submit"]');
  button.disabled = true;
  const saved = await runCloudAction("trusted-adult-remove", { teacherId: trustedRemovalDialog.dataset.teacherId, reason: new FormData(form).get("reason") });
  button.disabled = false;
  if (saved) { trustedRemovalDialog.close(); viewRoot.querySelector(".trusted-adult-picker summary")?.focus(); }
  else form.querySelector("[data-trusted-remove-error]").textContent = "The change could not be saved. Please try again.";
});

function readCheckIns(form) {
  return [...form.querySelectorAll("[data-check-in-row]")].map(row => ({ ...(row.dataset.checkInId ? { id: row.dataset.checkInId } : {}), date: row.querySelector("input").value }));
}
function openSupportRecord(studentId, recordId = "") {
  profileCoinFilter = "all";
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

function openLeadershipNotice(notice) {
  if (notice.eventId) {
    setView("dashboard");
    calendarWeekStart = startOfCalendarWeek(notice.eventDate);
    if (activeUser.type === "teacher") calendarTeacherGrade = "all";
    selectedCalendarEventId = notice.eventId;
    render();
    requestAnimationFrame(() => document.querySelector(".calendar-event-panel")?.focus());
  } else if (notice.taskId) {
    leadershipDateFrom = "";
    leadershipDateTo = "";
    setView("my-activities");
    requestAnimationFrame(() => document.getElementById(`task-${notice.taskId}`)?.scrollIntoView({ block: "center" }));
  }
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
  if (hash === "my-house" || hash === "my-lab") return "my-activities";
  return [
    "dashboard",
    "send",
    "behavior-concern",
    "academic-concern",
    "sel-concern",
    "students",
    "administration", "my-activities"
  ].includes(hash)
    ? hash
    : "dashboard";
}

function setView(view, options = {}) {
  if (!activeUser) return;
  if (view === "activity") view = "dashboard";
  if (activeUser.type === "student" && !["dashboard", "students", "my-activities"].includes(view)) view = "dashboard";
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
  selectedCalendarEventId = null;
  recordEditTarget = null;
  if (options.studentId) {
    if (profileStudentId !== options.studentId) resetProfileConcernFilters();
    profileStudentId = options.studentId;
    studentQuery = "";
    houseFilter = []; studentGradeFilter = []; studentValueFilters = []; studentDateFrom = studentDateTo = "";
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
  const additionalEditors = record.studentId && "points" in record ? [] : (record.editorIds ?? []).map(getTeacher).filter(Boolean);
  return `<details class="record-access-summary"><summary>Editors</summary><p>The author, super admins and supervising teachers${additionalEditors.length ? `, and ${additionalEditors.map((teacher) => escapeHtml(teacher.name)).join(", ")}` : ""}.</p></details>`;
}

function canAccessAdministration() {
  return isSupervisor(activeUser?.type === "teacher" ? { ...getTeacher(activeUser.id), type: "teacher" } : activeUser);
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
  if (context === "students") {
    return { query: studentQuery, house: houseFilter, grade: studentGradeFilter, values: studentValueFilters, from: studentDateFrom, to: studentDateTo };
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
  if (context === "students") { studentQuery = ""; houseFilter = []; studentGradeFilter = []; studentValueFilters = []; studentDateFrom = studentDateTo = ""; profileStudentId = null; profileCoinFilter = "all"; }
  else if (context === "send") { sendStudentQuery = sendHouseFilter = sendGradeFilter = ""; }
  else if (concernStudentFilters[context]) concernStudentFilters[context] = emptyStudentFilters();
  else if (context === "dashboard") { calendarTeacherGrade = "my"; selectedCalendarEventId = null; }
}

function renderCrestVisual(student, points = getStudentTotal(state, student.id)) {
  return studentCrestVisual(student, getHouse(student.houseId), points, `crest-${++crestInstance}`, escapeHtml);
}

function renderStudentFilters(context) {
  if (context === "students") return renderStudentBrowseFilters();
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

function renderStudentBrowseFilters() {
  const filters = getStudentFilters("students");
  const group = (items, selected, category) => items.map(item => `<button type="button" data-action="filter-student-${category}" data-filter-value="${item.id}" class="${selected.includes(String(item.id)) ? "is-selected" : ""}" aria-pressed="${selected.includes(String(item.id))}">${item.image ? `<img src="${item.image}" alt="" />` : ""}${item.name}</button>`).join("");
  return `<section class="student-controls student-browse-controls" data-student-filters="students" aria-label="Student filters">
    <label class="search-field"><span class="sr-only">Search by name, house or 7C</span><input id="student-search" data-student-search="students" type="search" placeholder="Name, house or 7C" value="${escapeHtml(studentQuery)}" autocomplete="off" /></label>
    <div class="house-filters" role="group" aria-label="Houses">${group([{id:"all",name:"All houses"},...HOUSES],houseFilter,"house")}</div>
    <div class="grade-filters" role="group" aria-label="Grades">${group([{id:"all",name:"All grades"},...getAvailableGrades().map(g=>({id:String(g),name:`Grade ${g}`}))],studentGradeFilter,"grade")}</div>
    <div class="value-filters" role="group" aria-label="7Cs">${group([{id:"all",name:"All 7Cs"},...VALUES.map(v=>({id:v.id,name:v.name}))],studentValueFilters,"value")}</div>
    <div class="student-ranking-dates" ${browseStudents(state,filters,HOUSES,VALUES).ranked ? "" : "hidden"}><label>From<input type="date" id="student-date-from" value="${studentDateFrom}" max="${studentDateTo}" /></label><label>To<input type="date" id="student-date-to" value="${studentDateTo}" min="${studentDateFrom}" /></label><button type="button" class="text-button" data-action="clear-student-dates">All dates</button></div>
  </section>`;
}

function updateStudentFilters(context, changes) {
  const filters = { ...getStudentFilters(context), ...changes };
  if (context === "students") {
    studentQuery = filters.query;
    houseFilter = filters.house;
    studentGradeFilter = filters.grade;
    studentValueFilters = filters.values ?? [];
    studentDateFrom = filters.from ?? ""; studentDateTo = filters.to ?? "";
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
    const category = button.dataset.action?.replace("filter-student-", "");
    const selected = context === "students" ? (category === "house" ? houseFilter : category === "grade" ? studentGradeFilter : category === "value" ? studentValueFilters : []).includes(button.dataset.filterValue) : button.dataset.action === "filter-house"
      ? button.dataset.houseId === filters.house
      : button.dataset.grade === filters.grade;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  if (context === "students") refreshStudentBrowser();
  else if (context === "send") {
    const students = getFilteredSendStudents();
    document.querySelector("#send-student-count").textContent = `${formatStudentCount(students.length)} available · ${sendStudentIds.length} selected`;
    document.querySelector("#send-student-results").innerHTML = renderSendStudentResults(students);
  } else refreshConcernStudentSelector();
}

function renderStudentFilterEmptyState(context, hidden = false) {
  const active = hasStudentFilter(getStudentFilters(context));
  if (context !== "students" && !active) return `<div data-student-filter-empty="${context}" hidden></div>`;
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

function formatDateTime(dateString, includeYear = false) {
  return new Intl.DateTimeFormat("en", {
    ...(includeYear ? { year: "numeric" } : {}),
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
  const schoolDate = today < "2026-08-03" || today > "2027-06-30" ? "2026-11-02" : today;
  return startOfCalendarWeek(schoolDate);
}

function getCalendarTypeLabel(type) {
  return {
    house: "House",
    lab: "LAB",
    ec: "EC",
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

function getVisibleCalendarEvents(startDate, endDate) {
  return getCalendarEvents(state, {
    user: activeUser,
    startDate,
    endDate,
    teacherGrade: calendarTeacherGrade
  });
}

function renderCalendarEvent(event) {
  return `<button class="calendar-event is-${event.type}" type="button" data-action="open-calendar-event" data-event-id="${escapeHtml(event.id)}" aria-label="${escapeHtml(`${event.title}. ${getCalendarTypeLabel(event.type)}. Open details.`)}"><span class="calendar-event-title">${escapeHtml(event.title)}</span></button>`;
}

function renderCalendarEventPanel(events) {
  if (!selectedCalendarEventId) return "";
  const event = events.find((item) => item.id === selectedCalendarEventId);
  if (!event) return "";
  const editable = canEditCalendarEvent(state, activeUser, event);
  const resourceUrl = /^https?:\/\//i.test(event.resourceUrl ?? "") ? event.resourceUrl : "";
  const dateLabel = event.endDate
    ? `${formatDateOnly(event.rangeStart)} – ${formatDateOnly(event.endDate)}`
    : formatDateOnly(event.date);
  return `
    <div class="modal-backdrop" data-action="close-calendar-event">
      <section class="modal-panel calendar-event-panel" role="dialog" aria-modal="true" aria-labelledby="calendar-event-panel-title" tabindex="-1" data-modal-panel>
        <button class="detail-close" type="button" data-action="close-calendar-event" aria-label="Close event details">×</button>
        <div class="calendar-event-panel-heading">
          <span class="calendar-type-badge is-${event.type}">${getCalendarTypeLabel(event.type)}</span>
          <div>
            <h3 id="calendar-event-panel-title">${escapeHtml(event.title)}</h3>
            <p>${dateLabel}${event.startTime && event.endTime ? ` · ${formatClockTime(event.startTime)}–${formatClockTime(event.endTime)}` : ""}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</p>
          </div>
        </div>
        ${event.teacherIds?.length ? `<p><strong>Teachers:</strong> ${event.teacherIds.map(id => escapeHtml(getTeacher(id)?.name ?? "")).filter(Boolean).join(", ")}</p>` : ""}
        ${event.leaderIds?.length ? `<p><strong>House Captain/Lab Leader:</strong> ${event.leaderIds.map(id => escapeHtml(getStudent(id)?.name ?? "")).filter(Boolean).join(", ")}</p>` : ""}
        ${event.description ? `<p class="calendar-event-description">${escapeHtml(event.description)}</p>` : ""}
        <div class="calendar-resources">
          ${renderLevelUpAttachments(state, activeUser, event, escapeHtml)}
          ${resourceUrl ? `<a href="${escapeHtml(resourceUrl)}" target="_blank" rel="noopener">Open shared resource</a>` : ""}
          ${event.attachmentData ? `<a href="${escapeHtml(event.attachmentData)}" download="${escapeHtml(event.attachmentName || "event-file")}">Download ${escapeHtml(event.attachmentName || "attached file")}</a>` : ""}
          ${event.updatedBy ? `<small>Updated by ${escapeHtml(event.updatedBy)} · ${formatDateTime(event.updatedAt)}</small>` : ""}
        </div>
        ${["lab", "house"].includes(event.type) ? renderEventActivities(state, activeUser, event, escapeHtml) : ""}
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
        <div class="modal-heading"><span class="calendar-type-badge is-house">Calendar</span><h2 id="calendar-create-title">Create an event</h2><p>Captains and lab leaders can share activities for their assigned sessions.</p></div>
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
          <h2 id="school-calendar-title">My calendar</h2>
        </div>
        ${canOpenCalendarEventCreator() ? '<button class="calendar-create-trigger" type="button" data-action="open-calendar-create"><span aria-hidden="true">＋</span>Create event</button>' : ""}
        <div class="calendar-toolbar">
          ${activeUser.type === "teacher" ? `<label><span class="sr-only">Calendar view</span><select id="calendar-grade-filter"><option value="my">My assignments</option><option value="all" ${calendarTeacherGrade === "all" ? "selected" : ""}>All grades</option>${[6, 7, 8, 9, 10, 11, 12].map((grade) => `<option value="${grade}" ${calendarTeacherGrade === String(grade) ? "selected" : ""}>Grade ${grade}</option>`).join("")}</select></label>` : ""}
          <label><span class="sr-only">Go to date</span><input id="calendar-go-to-date" type="date" value="${calendarWeekStart}" /></label>
        </div>
      </div>
      <div class="calendar-week-label">
        <span>${weekLabel}</span>
        <div class="calendar-week-controls"><button type="button" data-action="calendar-prev" aria-label="Previous week">‹</button><button type="button" data-action="calendar-today">Today</button><button type="button" data-action="calendar-next" aria-label="Next week">›</button></div>
      </div>
      <div class="calendar-week-grid">
        ${days.map((date) => {
          const dateEvents = events.filter((event) => event.date === date);
          const dateObject = new Date(`${date}T12:00:00`);
          const isToday = date === getTodayInputValue();
          return `<article class="calendar-day ${isToday ? "is-today" : ""}"><header><span>${new Intl.DateTimeFormat("en", { weekday: "short" }).format(dateObject)}</span><strong>${dateObject.getDate()}</strong></header><div class="calendar-day-events">${dateEvents.map(renderCalendarEvent).join("") || '<span class="calendar-empty">No scheduled event</span>'}</div></article>`;
        }).join("")}
      </div>
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
  const houses = HOUSES.map(
    (house) => `
      <button
        class="topbar-house-score"
        type="button"
        data-action="show-house-leaders"
        data-house-id="${house.id}"
        aria-label="${house.name}, ${totals[house.id]} points. Open House coin ranking."
        title="${house.name}: ${totals[house.id]} points"
      >
        <img src="${house.image}" alt="" />
        <span>${totals[house.id].toLocaleString()}</span>
      </button>
    `
  ).join("");
  const logout = `<button type="button" class="mobile-logout-icon" data-action="logout" aria-label="Log out" title="Log out"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 5H4v14h5M13 7l5 5-5 5M8 12h10" /></svg></button>`;
  if (activeStudent) {
    const house = getHouse(activeStudent.houseId);
    topbarHouseScores.innerHTML = `<button type="button" class="student-header-urgent" data-action="urgent-support">URGENT<br />Need support</button><button class="topbar-house-score student-header-house" type="button" data-action="show-house-leaders" data-house-id="${house.id}" aria-label="${house.name}, ${totals[house.id]} points. Open House ranking."><img src="${house.image}" alt="" /><span>${totals[house.id].toLocaleString()}</span></button><div class="student-header-right"><button class="sel-check-in-trigger" type="button" data-action="open-sel-check-in">Daily SEL check-in</button>${logout}</div>`;
    document.querySelector("#sidebar-student-identity").innerHTML = `<figure aria-label="${escapeHtml(activeStudent.name)}, Grade ${activeStudent.grade}">${renderCrestVisual(activeStudent)}</figure>`;
  } else {
    topbarHouseScores.innerHTML = houses + logout;
    document.querySelector("#sidebar-student-identity").innerHTML = "";
  }
  document.querySelector("#sidebar-house-scores").innerHTML = houses;
  document.querySelector("#sidebar-student-tools").innerHTML = "";
}

function renderSelCheckInModal() {
  const student = getActiveStudent();
  if (!student || !selCheckInOpen) return "";
  const ratingLabels = ["Very difficult", "Difficult", "Okay", "Good", "Great"];
  return `
    <div class="modal-backdrop" data-action="close-sel-check-in">
      <section class="modal-panel sel-check-in-modal" role="dialog" aria-modal="true" aria-labelledby="sel-check-in-title" data-modal-panel>
        <button class="detail-close" type="button" data-action="close-sel-check-in" aria-label="Close daily check-in">×</button>
        <div class="modal-heading">
          <span class="privacy-badge">Private reflection</span>
          <h2 id="sel-check-in-title">How do you feel today?</h2>
        </div>
        <form id="sel-check-in-form" class="sel-check-in-form">
          <fieldset>
            <legend>Choose a number from 1 to 5</legend>
            <div class="mood-rating-grid">
              ${ratingLabels.map((label, index) => {
                const rating = index + 1;
                return `<label><input type="radio" name="rating" value="${rating}" required /><span><strong>${rating}</strong><small>${label}</small></span></label>`;
              }).join("")}
            </div>
          </fieldset>
          <label>Why? What could you do to feel better?
            <textarea name="reflection" rows="4" maxlength="500" required></textarea>
          </label>
          <button class="primary-button" type="submit">Save check-in</button>
        </form>
      </section>
    </div>
  `;
}

function renderHouseLeaders(house, leaders) {

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


function renderDashboardHub() {
  const resources = state.hubResources ?? [];
  const meetingNotes = resources.filter(resource => resource.group === "grade-meetings");
  const resourceItem = ({ title, url }) => /^https:\/\//i.test(url ?? "")
    ? `<li><a class="hub-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(title)} (opens in a new tab)">${escapeHtml(title)} <span aria-hidden="true">↗</span></a></li>`
    : `<li><span class="hub-link hub-link-pending">${escapeHtml(title)} <small>Link pending</small></span></li>`;
  return `<section class="panel dashboard-hub" aria-labelledby="dashboard-hub-title">
    <div class="panel-heading"><h2 id="dashboard-hub-title">Hub</h2></div>
    <ul class="hub-links">${resources.filter(resource => !resource.group).map(resourceItem).join("")}</ul>
    ${meetingNotes.length ? `<div class="hub-meeting-notes">
      <h3>Grade-level meeting notes</h3>
      <ul class="hub-links hub-grade-links">${meetingNotes.map(resourceItem).join("")}</ul>
    </div>` : ""}
  </section>`;
}

function renderDashboard() {
  const activeStudent = getActiveStudent();
  if (activeStudent) {
    return `
      <div class="page dashboard-page student-dashboard">
        ${renderPageHeader("Dashboard", "")}
        ${renderSchoolCalendar()}
        ${cloudEnabled ? renderSupportNotifications(state, activeUser, escapeHtml) : ""}
        ${cloudEnabled ? renderSupportProfile(state, activeUser, activeStudent, escapeHtml, { dashboard: true }) : ""}
        ${renderDashboardHub()}
      </div>
    `;
  }
  return `
    <div class="page dashboard-page">
      ${renderPageHeader("Dashboard", "")}
      <div class="dashboard-overview">
        ${renderSupportNotifications(state, activeUser, escapeHtml)}
        ${renderSchoolCalendar()}
      </div>
      <div class="dashboard-overview dashboard-activities">
        ${renderTeacherActivity()}
        ${renderSchoolActivity(state, activeUser, schoolActivityFilters, schoolActivityPage, HOUSES, escapeHtml, renderSchoolActivityStudent, formatDateTime)}
      </div>
      ${renderDashboardHub()}
    </div>
  `;
}

function renderHouseRanking() {
  const houses = getHouseRanking(state, houseRankingFilters);
  const maxPoints = Math.max(...houses.map(h => h.points), 1);
  const staff = activeUser?.type === "teacher";
  houseRankingDialog.innerHTML = `
    <header class="house-ranking-header"><h2 id="house-ranking-title">House coin ranking</h2><button type="button" class="dialog-close" data-action="close-house-ranking" aria-label="Close House ranking">×</button>
      <div class="house-ranking-values" role="group" aria-label="Filter House ranking by 7C">
        <button type="button" data-action="filter-house-ranking-value" data-value-id="all" aria-pressed="${!houseRankingFilters.valueIds.length}">All 7Cs</button>
        ${VALUES.map(value => `<button type="button" data-action="filter-house-ranking-value" data-value-id="${value.id}" aria-pressed="${houseRankingFilters.valueIds.includes(value.id)}"><span class="house-ranking-value-logo" style="--value-logo:url('${value.image}')" aria-hidden="true"></span>${value.name}</button>`).join("")}
      </div>
      <div class="house-ranking-dates"><label>From<input type="date" data-house-ranking-date="from" value="${houseRankingFilters.from}" max="${houseRankingFilters.to}" /></label><label>To<input type="date" data-house-ranking-date="to" value="${houseRankingFilters.to}" min="${houseRankingFilters.from}" /></label><button type="button" class="text-button" data-action="reset-house-ranking-dates">All dates</button></div>
    </header>
    <ol class="house-list">${houses.map((house, index) => {
      const expanded = staff && expandedHouseId === house.id;
      const cupLabel = `${house.cupYears.length} House Cup wins: ${house.cupYears.join(", ")}`;
      return `<li class="house-entry ${expanded ? "is-expanded" : ""}" data-house-entry="${house.id}" style="--house-color:${house.color};--bar-width:${Math.max(0, house.points / maxPoints * 100)}%">
        <button type="button" class="house-row" data-action="toggle-house-leaders" data-house-id="${house.id}" ${staff ? `aria-expanded="${expanded}" aria-controls="${house.id}-leaders"` : "disabled"}>
          <span class="rank">${index + 1}</span><img src="${house.image}" alt="" />
          <div class="house-info"><div class="house-title-line"><strong>${house.name}</strong><span class="house-cup-history" title="${cupLabel}">${house.cupYears.map(() => renderCupIcon()).join("")}</span></div>${staff ? `<span>${formatStudentCount(house.members)}</span>` : ""}<div class="score-track" aria-hidden="true"><span></span></div></div>
          <span class="house-score-cell"><strong class="house-points">${house.points.toLocaleString()}<span> pts</span></strong>${staff ? '<span aria-hidden="true">⌄</span>' : ""}</span>
        </button>${expanded ? renderHouseLeaders(house, house.leaders) : ""}
      </li>`;
    }).join("")}</ol>`;
}

function openHouseRanking(houseId) {
  expandedHouseId = houseId;
  houseRankingFilters = { valueIds: [], from: "", to: "" };
  renderHouseRanking();
  if (!houseRankingDialog.open) houseRankingDialog.showModal();
}
houseRankingDialog.addEventListener("click", event => { if (event.target === houseRankingDialog) houseRankingDialog.close(); });
houseRankingDialog.addEventListener("change", event => {
  const field = event.target.dataset.houseRankingDate;
  if (!["from", "to"].includes(field)) return;
  houseRankingFilters[field] = event.target.value;
  const { from, to } = houseRankingFilters;
  if (from && to && from > to) houseRankingFilters[field === "from" ? "to" : "from"] = event.target.value;
  renderHouseRanking();
  houseRankingDialog.querySelector(`[data-house-ranking-date="${field}"]`)?.focus({ preventScroll: true });
});


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
            <span class="sr-only" id="send-student-count" role="status">${formatStudentCount(filteredStudents.length)} available · ${sendStudentIds.length} selected</span>
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

function renderConcernAttachmentFields(confidential = false) {
  return `<div class="attachment-fields"><label>Optional supporting attachment
    <input name="${confidential ? "confidentialAttachment" : "attachment"}" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" />
    <span class="field-help">PDF, Office document, or image, maximum 750 KB.</span>
  </label></div>`;
}

function renderConcernAttachment(concern, visibility) {
  const files = [];
  if (concern.attachmentData && concern.attachmentVisibility === visibility) files.push({ name: concern.attachmentName, data: concern.attachmentData });
  if (visibility === "confidential" && concern.confidentialAttachmentData) files.push({ name: concern.confidentialAttachmentName, data: concern.confidentialAttachmentData });
  return files.map(file => `<a class="record-attachment" href="${escapeHtml(file.data)}" download="${escapeHtml(file.name || "attachment")}">${visibility === "confidential" ? "Confidential attachment" : "Supporting attachment"}: ${escapeHtml(file.name || "Download file")}</a>`).join("");
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
  if(type === "sel" && (state.selCheckIns??[]).some(c=>c.studentId===profileStudentId)) options.push({value:"check-in",label:"Daily check-ins"});
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
  if (activeUser?.type !== "teacher") return "";
  if (record.sourceType === "behavior-concern") {
    type = "behavior";
    record = state.behaviorConcerns.find(item => item.id === record.sourceConcernId);
    if (!record) return "";
  }
  const editButton = canEditStudentRecord(state, activeTeacher.id, record)
    ? `<button class="record-edit-button" type="button" data-action="edit-student-record" data-record-type="${type}" data-record-id="${escapeHtml(record.id)}">Edit</button>`
    : "";
  return editButton + renderRecordHistory(record);
}

function renderRecordHistory(record) {
  const history = record.editHistory ?? [];
  if (!history.length && !record.updatedAt) return "";
  const fieldLabels = {
    title: "Title", valueId: "7C", points: "Points", comment: "Comment", editorIds: "Additional editors",
    description: "Description", incidentDate: "Record date", incidentTime: "Incident time", location: "Location",
    customAction: "Immediate action", confidentialNote: "Confidential note",
    furtherDetails: "Further steps", actionDetails: "Step taken", internalNote: "Internal note", followUp: "Follow-up"
  };
  function formatValue(field, value) {
    if (field === "valueId") return getValue(value)?.name ?? value;
    if (field === "editorIds") return value?.map(id => getTeacher(id)?.name ?? id).join(", ") || "—";
    return value === "" || value == null ? "—" : String(value);
  }
  return `<details class="record-history">
    <summary>Edit history${history.length ? ` (${history.length})` : ""}</summary>
    ${history.length ? [...history].reverse().map(revision => `<article>
      <strong>${escapeHtml(revision.teacherName ?? getTeacher(revision.teacherId)?.name ?? revision.teacherId)}</strong>
      <time datetime="${escapeHtml(revision.editedAt)}">${formatDateTime(revision.editedAt, true)}</time>
      <dl>${revision.changes.map(({ field, before, after }) => `
        <dt>${escapeHtml(fieldLabels[field] ?? field)}</dt>
        <dd><span>Before</span> ${escapeHtml(formatValue(field, before))}</dd>
        <dd><span>After</span> ${escapeHtml(formatValue(field, after))}</dd>`).join("")}</dl>
    </article>`).join("") : "<p>Field history is unavailable for this earlier edit.</p>"}
  </details>`;
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
    <label>Description<textarea name="description" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="5" required>${escapeHtml(record.description)}</textarea></label>
    ${type === "behavior" ? `
      <label>Additional or different step taken<textarea name="customAction" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3">${escapeHtml(record.customAction ?? "")}</textarea></label>
      <label>Confidential teacher note<textarea name="confidentialNote" maxlength="${MAX_INTERNAL_NOTE_LENGTH}" rows="3">${escapeHtml(record.confidentialNote ?? "")}</textarea></label>
    ` : ""}
    ${type === "academic" ? `
      <label>Step taken<textarea name="actionDetails" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="4" required>${escapeHtml(record.actionDetails ?? "")}</textarea></label>
      <label>Further support or prevention<textarea name="furtherDetails" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3">${escapeHtml(record.furtherDetails ?? "")}</textarea></label>
      ${record.internalNote ? `<label>Internal note<textarea name="internalNote" maxlength="${MAX_INTERNAL_NOTE_LENGTH}" rows="3">${escapeHtml(record.internalNote)}</textarea></label>` : ""}
    ` : ""}
    ${type === "sel" ? `
      <label>Support or follow-up<textarea name="followUp" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="4">${escapeHtml(record.followUp ?? "")}</textarea></label>
      ${record.confidentialNote ? `<label>Confidential teacher note<textarea name="confidentialNote" maxlength="${MAX_INTERNAL_NOTE_LENGTH}" rows="3">${escapeHtml(record.confidentialNote)}</textarea></label>` : ""}
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
        <form id="record-edit-form" data-record-type="${type}" data-record-id="${record.id}" data-record-version="${record.editHistory?.length ?? 0}">
          <div class="record-edit-fields">${awardFields}${commonConcernFields}</div>
          ${type === "award" ? "" : renderEditorAccessPicker({ selectedIds: record.editorIds, authorId: record.teacherId })}
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
  const read = async name => {
    const file = formData.get(name);
    if (!file?.size) return { name: "", data: "" };
    const data = await readFileAsDataUrl(file);
    if (String(data).length > MAX_ATTACHMENT_DATA_LENGTH) throw new Error("The attachment is too large to save.");
    return { name: file.name, data };
  };
  const record = await read("attachment"), confidential = await read("confidentialAttachment");
  return { attachmentName: record.name, attachmentData: record.data, attachmentVisibility: "record", confidentialAttachmentName: confidential.name, confidentialAttachmentData: confidential.data };
}

function renderConcernStudentSelector() {
  const context = activeView;
  const visibleIds = new Set(getStudentsMatchingFilters(getStudentFilters(context)).map((student) => student.id));
  return `
    <div data-concern-student-selector>
      ${renderStudentFilters(context)}
      <span class="sr-only" data-concern-student-count role="status">${formatStudentCount(visibleIds.size)} available · ${concernStudentPreset ? 1 : 0} selected</span>
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
  updateDeductionSentence();
  refreshBehaviorCounts();
}

function renderBehaviorIssueOptions(level) {
  return BEHAVIOR_ISSUES.filter(issue => issue.level === Number(level)).map(issue => issueChoice({ name: "issueIds", value: issue.id, title: issue.title, description: issue.description, detailHtml: `<span class="offense-counts" data-offense-counts="${issue.id}"></span>` }, escapeHtml)).join("")
    + issueChoice({ name: "otherIssueTiers", value: String(level), title: "Other issue not listed" }, escapeHtml);
}
function refreshBehaviorCounts() {
  const form = document.querySelector("#behavior-concern-form");
  if (!form) return;
  const ids = new FormData(form).getAll("studentIds");
  form.querySelectorAll("[data-offense-counts]").forEach(row => row.innerHTML = ids.map(id => {
    const name = getStudent(id)?.name ?? "Student", count = getBehaviorIssueCount(state, id, row.dataset.offenseCounts);
    return `<span class="offense-count" tabindex="0" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)}: ${count} previous concerns">${count}</span>`;
  }).join(""));
}
function renderBehaviorStrategyPicker(tiers = [1, 2], selected = []) {
  const strategies = [...new Set(tiers.flatMap(tier => behavioralStrategies(tier).flatMap(group => group.options)))];
  return `<div id="behavior-strategy-options" class="issue-options">${strategies.map(strategy => issueChoice({ name: "strategies", value: strategy, title: strategy, checked: selected.includes(strategy) }, escapeHtml)).join("")}</div>`;
}
function updateBehaviorStrategies() {
  const form = document.querySelector("#behavior-concern-form");
  if (!form) return;
  const values = new FormData(form);
  const tiers = [...new Set([...values.getAll("issueIds").map(id => BEHAVIOR_ISSUES.find(i => i.id === id)?.level), ...values.getAll("otherIssueTiers").map(Number)].filter(Boolean))];
  form.querySelector("#behavior-strategy-options").outerHTML = renderBehaviorStrategyPicker(tiers.length ? tiers : [1, 2], values.getAll("strategies"));
}

function renderBehaviorDeductionField() {
  return `<div class="deduction-sentence"><small>Optional</small><div class="deduction-line">
    <select name="deductionPoints" aria-label="Points taken"><option value="0">0</option>${POINT_OPTIONS.map(points => `<option value="${points}">${points}</option>`).join("")}</select>
    <span>points are taken from</span> <span data-deduction-students>the selected student</span> <span>for lack of</span>
    <details class="deduction-value-picker"><summary data-deduction-values>Choose Cs</summary><div>${VALUES.map(value => `<label><input type="checkbox" name="deductionValueIds" value="${value.id}" />${value.name}</label>`).join("")}</div></details><span>.</span>
  </div></div>`;
}
function updateDeductionSentence() {
  const form = document.querySelector("#behavior-concern-form");
  if (!form) return;
  const names = [...form.querySelectorAll('[name="studentIds"]:checked')].map(input => getStudent(input.value)?.name).filter(Boolean);
  form.querySelector("[data-deduction-students]").textContent = names.join(", ") || "the selected student";
  const values = [...form.querySelectorAll('[name="deductionValueIds"]:checked')].map(input => getValue(input.value)?.name).filter(Boolean);
  form.querySelector("[data-deduction-values]").textContent = values.join(", ") || "Choose Cs";
  positionDeductionPicker();
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
          <legend><span>2</span> Behavior code issue & incident details</legend>
          <div class="behavior-tier-columns">${[1,2].map(tier => `<section class="behavior-tier-panel"><h3>Tier ${tier === 1 ? "I" : "II"} incident</h3><div class="issue-options behavior-tier-scroll">${renderBehaviorIssueOptions(tier)}</div></section>`).join("")}</div>
          <h3 class="subsection-title">Incident details</h3>
          <div class="form-grid two-columns">
            <label>Incident date and time<input name="incidentAt" type="datetime-local" value="${getTodayInputValue()}T13:15" required /></label>
            <label>Location<select name="location" required><option value="">Select a location</option>${BEHAVIOR_LOCATIONS.map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`).join("")}</select></label>
          </div>
          <label class="full-field conditional-field" data-other-location hidden>Other location<input name="otherLocation" maxlength="160" disabled /></label>

          <label class="full-field">Description<textarea name="description" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="5" required></textarea></label>


          ${renderConcernAttachmentFields()}
        </fieldset>



        <fieldset class="concern-section">
          <legend><span>4</span> Action taken immediately</legend>
          <div class="automatic-action" id="behavior-code-preview" aria-live="polite">

          </div>
          <h3 class="subsection-title">Teacher response suggestions</h3>
          <div class="issue-options">${BEHAVIOR_RESPONSE_OPTIONS.map(action => issueChoice({ name: "teacherActions", value: action, title: action }, escapeHtml)).join("")}</div>
          <label class="full-field"><span>Additional or different step taken immediately — <small>optional</small></span><textarea name="customAction" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3"></textarea></label>
          ${renderBehaviorDeductionField()}
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>5</span> Further steps to help prevent a similar concern</legend>
          ${renderBehaviorStrategyPicker()}
          ${issueChoice({ name: "otherStrategySelected", value: "1", title: "Other strategy", id: "behavior-other-strategy-toggle" }, escapeHtml)}
          <label class="full-field conditional-field" id="behavior-other-strategy-field" hidden>
            Describe the strategy
            <textarea name="otherStrategy" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3"></textarea>
          </label>
        </fieldset>



        <fieldset class="concern-section confidential-section">
          <legend><span>8</span> Confidential teacher note <small>Optional</small></legend>

          <label class="full-field"><span class="sr-only">Confidential teacher note</span><textarea name="confidentialNote" maxlength="${MAX_INTERNAL_NOTE_LENGTH}" rows="4" placeholder="Internal context for teachers only"></textarea></label>
          ${renderConcernAttachmentFields(true)}
        </fieldset>

        <fieldset class="concern-section editor-access-section">
          <legend><span>9</span> Editing access</legend>
          ${renderEditorAccessPicker()}
        </fieldset>

        <div class="form-submit-bar">

          <button class="primary-button" type="submit">Publish behavior concern</button>
        </div>
      </form>
    </div>
  `;
}

function renderAcademicIssueOptions(selectedTier = "", selected = []) {
  const issues = ACADEMIC_CONCERN_EXAMPLES[Number(selectedTier)];
  if (!issues) return "";
  return [...issues, "other"].map(issue => issueChoice({ name: "issueIds", value: issue, title: issue === "other" ? "Other" : issue, checked: selected.includes(issue) }, escapeHtml)).join("");
}

function getAcademicStrategyOptions(tier, profileId) {
  return academicStrategies(tier, profileId);
}

function renderAcademicStrategyOptions(tier = "", profileId = "", selected = [], name = "strategies") {
  if (![1, 2, 3].includes(Number(tier))) return "";
  return [...getAcademicStrategyOptions(tier, profileId), "other"].map(strategy => issueChoice({ name, value: strategy, title: strategy === "other" ? "Other" : strategy, checked: selected.includes(strategy) }, escapeHtml)).join("");
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
            <label>MTSS tier<select id="academic-tier" name="tier" required><option value="">Select a tier first</option><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select></label>
            <label>Special learning profile <small>Optional</small><select id="academic-profile" name="profileId"><option value="">No profile selected</option>${ACADEMIC_PROFILES.map((profile) => `<option value="${profile.id}">${profile.name}</option>`).join("")}</select></label>
          </div>
          <h3 class="subsection-title">What kind of academic issue?</h3>
          <div id="academic-issue-select" class="issue-options" role="group" aria-label="Academic issues">${renderAcademicIssueOptions()}</div>

          <label class="full-field conditional-field" id="academic-other-issue-field" hidden><span class="sr-only">Describe the other academic issue</span><textarea name="otherIssue" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3" placeholder="Write the concern in your own words if it is not listed" disabled></textarea></label>
          <label class="full-field">Description<textarea name="description" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="5" placeholder="Include observations, evidence, or a pattern you have noticed" required></textarea></label>

          ${renderConcernAttachmentFields()}
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>3</span> Steps taken</legend>
          <div class="profile-strategy-heading" id="academic-strategy-heading">

          </div>
          <div id="academic-strategy-select" class="issue-options">${renderAcademicStrategyOptions()}</div>
          <label class="full-field">Describe the step taken<textarea name="actionDetails" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="5" placeholder="Describe when, how, and for how long the support was provided" required></textarea></label>
        </fieldset>



        <fieldset class="concern-section">
          <legend><span>4</span> Further steps to help prevent a similar concern <small>Optional</small></legend>
          <div id="academic-further-options" class="issue-options"></div>
          <label class="full-field">Further support or prevention<textarea name="furtherDetails" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="3"></textarea></label>
        </fieldset>

        <fieldset class="concern-section editor-access-section">
          <legend><span>6</span> Editing access</legend>
          ${renderEditorAccessPicker()}
        </fieldset>

        <div class="form-submit-bar">

          <button class="primary-button" type="submit">Publish academic concern</button>
        </div>
      </form>
    </div>
  `;
}

function renderSelConcernOptions(tier = "") {
  if (![1, 2, 3].includes(Number(tier))) return "";
  return selOptions(tier).map(option => issueChoice({ name: "concernIds", value: option.id, title: option.title, description: option.urgent ? "Immediate support review" : "" }, escapeHtml)).join("");
}
function updateSelSupportOptions() {
  const form = document.querySelector("#sel-concern-form");
  if (!form) return;
  const values = new FormData(form);
  form.querySelector("#sel-support-options").innerHTML = selSupportChoices(selOptions(values.get("tier")), values.getAll("concernIds"), values.getAll("strategies"), escapeHtml);
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
          <legend><span>2</span> Socio-emotional concern</legend>
          <div class="form-grid two-columns">
            <label>Date observed<input name="incidentDate" type="date" value="${getTodayInputValue()}" required /></label>
            <label>MTSS tier<select id="sel-tier" name="tier" required><option value="">Select a tier first</option><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select></label>
          </div>
          <div class="issue-options sel-concern-grid">${renderSelConcernOptions()}</div>
          <label class="full-field">Description<textarea name="description" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="5" required></textarea></label>
          ${renderConcernAttachmentFields()}
        </fieldset>

        <fieldset class="concern-section">
          <legend><span>3</span> Support or follow-up <small>Optional</small></legend>
          <div id="sel-support-options" class="issue-options"></div>
          <label class="full-field"><span class="sr-only">Support or follow-up</span><textarea name="followUp" maxlength="${MAX_CONCERN_DESCRIPTION_LENGTH}" rows="4" placeholder="Support offered, people contacted, or next review step"></textarea></label>

        </fieldset>



        <fieldset class="concern-section editor-access-section">
          <legend><span>7</span> Editing access</legend>
          ${renderEditorAccessPicker()}
        </fieldset>

        <div class="form-submit-bar">

          <button class="primary-button" type="submit">Publish SEL concern</button>
        </div>
      </form>
    </div>
  `;
}

function getFilteredStudents() {
  return browseStudents(state, getStudentFilters("students"), HOUSES, VALUES).students;
}

function formatStudentCount(count) {
  return `${count} ${count === 1 ? "student" : "students"}`;
}

function renderStudents() {
  if (activeUser?.type === "student") {
    const student = getActiveStudent();
    return `<div class="page">${renderPageHeader("My profile", "")}<section class="panel"><div class="profile-heading student-own-profile-heading"><img src="${getHouse(student.houseId).image}" alt="${getHouse(student.houseId).name}"/>${renderTrustedAdults(state, activeUser, student, escapeHtml, { pickerOpen: trustedAdultPickerOpen })}<div class="profile-total"><strong>${getStudentTotal(state,student.id)}</strong><span>points</span></div></div>${renderStudentCoinTable(student)}<section class="profile-record-section"><h3>Behavior notices</h3>${state.behaviorConcerns.map(item => `<article id="concern-${item.id}"><h4>${escapeHtml(item.title)}</h4><time>${formatDateOnly(item.incidentDate)}</time><p>${escapeHtml(item.description)}</p>${renderConcernAttachment(item, "record")}${behaviorStudentResponse(state, activeUser, item, student.id, escapeHtml)}</article>`).join("") || '<p>No behavior notices.</p>'}</section>${renderSupportProfile(state, activeUser, student, escapeHtml)}</section></div>`;
  }
  const filteredStudents = getFilteredStudents();

  return `
    <div class="page">
      ${renderPageHeader("Students", "")}

      ${renderStudentFilters("students")}

      <div class="students-layout">
        <section class="panel student-list-panel" aria-labelledby="student-count" ${profileStudentId && !hasStudentFilter(getStudentFilters("students")) ? "hidden" : ""}>
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

  const ranked = browseStudents(state, getStudentFilters("students"), HOUSES, VALUES).ranked;
  return students.map((student,index) => `<div class="student-crest-item">${ranked ? `<span class="student-browser-rank" aria-label="Rank ${index+1}">${index+1}</span>` : ""}<button class="student-crest ${student.id === profileStudentId ? "is-selected" : ""}" type="button" data-action="select-student" data-student-id="${student.id}" aria-pressed="${student.id === profileStudentId}" aria-label="${escapeHtml(student.name)}, Grade ${student.grade}, ${getHouse(student.houseId).name}, ${getStudentTotal(state, student.id)} points">
    ${renderCrestVisual(student, student.points)}
  </button>${renderIepHeart(state, activeUser, student, escapeHtml)}</div>`).join("");
}

function renderStudentDetailRegion() {
  if (!profileStudentId || !getStudent(profileStudentId)) return "";

  return `
    <section class="panel student-detail" id="student-detail">
      ${renderStudentDetail()}
    </section>
  `;
}

function renderProfileRecordAction(student, type) {
  if (activeUser?.type !== "teacher") return "";
  const labels = { coin: "Send coin", behavior: "Behavior concern", academic: "Academic concern", sel: "SEL concern" };
  return `<button type="button" class="text-button profile-record-action" data-action="${type === "coin" ? "send-to-student" : `${type}-for-student`}" data-student-id="${student.id}">+ ${labels[type]}</button>`;
}

function renderStudentCoinTable(student) {
  const awards = getStudentAwards(state, student.id, profileCoinFilter === "all" ? undefined : profileCoinFilter);
  return `
    <section class="profile-record-section" aria-labelledby="${student.id}-coin-history">
      <div class="record-section-heading">
        <div><h3 id="${student.id}-coin-history">Coins received</h3><span>${awards.length} published recognitions</span></div>
        <div class="record-heading-tools"><label><span class="sr-only">Filter coins by 7C</span><select data-profile-coin-filter><option value="all">All 7Cs</option>${VALUES.map(value=>`<option value="${value.id}" ${profileCoinFilter===value.id?"selected":""}>${value.name}</option>`).join("")}</select></label>${renderProfileRecordAction(student, "coin")}</div>
      </div>
      <div class="responsive-table">
        <table class="record-table">
          <thead><tr><th scope="col">Published</th><th scope="col">HCAS 7C</th><th scope="col">Teacher</th><th scope="col">Points</th><th scope="col">Comment</th><th scope="col">Access</th></tr></thead>
          <tbody>
            ${awards.length
              ? awards
                  .map((award) => {
                    const teacher = getTeacher(award.teacherId);
                    return `
                      <tr id="award-${award.id}">
                        <td><time datetime="${award.createdAt}">${formatDateTime(award.createdAt)}</time></td>
                        <td>${getAwardValueIds(award).map(id => getValue(id)).filter(Boolean).map(value => `<span class="table-value"><span class="value-mini-logo" style="--value-logo: url('${value.image}')" aria-hidden="true"></span>${value.name}</span>`).join("")}</td>
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
                          ${behaviorStudentResponse(state, activeUser, concern, student.id, escapeHtml)}
                          <details class="record-details">
                            <summary>View teacher details</summary>
                            ${responseHistory(state, activeUser, concern, escapeHtml)}
                            <div>
                              <h4>Code issues</h4>
                              <ul>${issues.map((issue) => `<li><span class="level-badge level-${issue.level === 1 ? "one" : "two"}">Tier ${issue.level}</span> ${issue.title}</li>`).join("")}${concern.otherIssue ? `<li>Other: ${escapeHtml(concern.otherIssue)}</li>` : ""}</ul>
                              ${concern.occurrence && !concern.automaticOccurrence ? `<p><strong>Occurrence:</strong> ${concern.occurrence === 3 ? "Third occurrence or pattern" : `${concern.occurrence}${concern.occurrence === 1 ? "st" : "nd"} occurrence`}</p>` : ""}
                              ${concern.additionalIssueDetails && !concern.otherIssue ? `<h4>Additional incident details</h4><p>${escapeHtml(concern.additionalIssueDetails)}</p>` : ""}
                              ${actions.length ? `<h4>Required action for ${student.name}</h4><ul>${actions.map((action) => `<li><strong>${action.label}</strong>: ${action.description}</li>`).join("")}</ul>` : ""}
                              ${(concern.teacherActions ?? []).length ? `<h4>Teacher responses</h4><ul>${concern.teacherActions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul>` : ""}
                              ${(concern.strategies ?? []).length || concern.otherStrategy ? `<h4>Behavioral MTSS strategies</h4><ul>${(concern.strategies ?? []).map((strategy) => `<li>${escapeHtml(strategy)}</li>`).join("")}${concern.otherStrategy ? `<li>${escapeHtml(concern.otherStrategy)}</li>` : ""}</ul>` : ""}
                              ${concern.customAction ? `<h4>Additional action</h4><p>${escapeHtml(concern.customAction)}</p>` : ""}
                              ${concern.deduction ? `<p>${escapeHtml(behaviorDeductionSentence(concern.deduction.points, student.name, getAwardValueIds(concern.deduction)))}</p>` : ""}
                              ${renderConcernAttachment(concern, "record")}
                              ${linkedStudents.length ? `<h4>Other students involved, teacher-only</h4><div class="linked-students">${linkedStudents.map((linkedStudent) => renderStudentIdentity(linkedStudent, { secondary: `Grade ${linkedStudent.grade}`, points: getStudentTotal(state, linkedStudent.id), action: true, className: "is-compact" })).join("")}</div>` : ""}
                              ${concern.confidentialNote || concern.confidentialAttachmentData || concern.attachmentVisibility === "confidential" ? `<div class="confidential-note"><strong>Confidential teacher section</strong>${concern.confidentialNote ? `<p>${escapeHtml(concern.confidentialNote)}</p>` : ""}${renderConcernAttachment(concern, "confidential")}</div>` : ""}
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
                              ${(concern.furtherStrategies ?? []).length ? `<h4>Further steps to help prevent a similar concern</h4><ul>${concern.furtherStrategies.map(strategy => `<li>${escapeHtml(strategy)}</li>`).join("")}</ul>` : ""}${concern.furtherDetails ? `<p>${escapeHtml(concern.furtherDetails)}</p>` : ""}
                              ${renderConcernAttachment(concern, "record")}
                              ${linkedStudents.length ? `<h4>Other students involved, teacher-only</h4><div class="linked-students">${linkedStudents.map((linkedStudent) => renderStudentIdentity(linkedStudent, { secondary: `Grade ${linkedStudent.grade}`, points: getStudentTotal(state, linkedStudent.id), action: true, className: "is-compact" })).join("")}</div>` : ""}
                              ${concern.internalNote || concern.confidentialAttachmentData || concern.attachmentVisibility === "confidential" ? `<div class="confidential-note"><strong>Internal teacher section</strong>${concern.internalNote ? `<p>${escapeHtml(concern.internalNote)}</p>` : ""}${renderConcernAttachment(concern, "confidential")}</div>` : ""}
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
  const checkIns = ["all","check-in"].includes(profileConcernFilters.sel) ? getStudentSelCheckIns(state, student.id) : [];
  const countLabel = profileConcernFilters.sel === "all"
    ? `${allConcerns.length} teacher-only records`
    : `${concerns.length} of ${allConcerns.length} teacher-only records`;
  return `
    <section class="profile-record-section teacher-only-records" aria-labelledby="${student.id}-sel-history">
      <div class="record-section-heading">
        <div><h3 id="${student.id}-sel-history">SEL</h3><span>${countLabel} · ${checkIns.length} daily check-ins</span></div>
        <div class="record-heading-tools">
          ${renderProfileConcernFilter("sel", allConcerns, "SEL concerns")}
          ${renderProfileRecordAction(student, "sel")}
          <span class="privacy-badge is-private">Teachers only</span>
        </div>
      </div>
      <div class="responsive-table">
        <table class="record-table concern-history-table sel-history-table">
          <thead><tr><th scope="col">Observed</th><th scope="col">SEL record</th><th scope="col">Published</th><th scope="col">Author</th><th scope="col">Access</th></tr></thead>
          <tbody>
            ${checkIns.map(checkIn => `<tr class="sel-check-in-record"><td><time datetime="${checkIn.publishedAt || checkIn.date}">${checkIn.publishedAt ? formatDateTime(checkIn.publishedAt) : formatDateOnly(checkIn.date)}</time></td><td><strong>Daily check-in · ${checkIn.rating}/5</strong><p class="record-description">${escapeHtml(checkIn.reflection)}</p></td><td>${formatDateTime(checkIn.publishedAt || checkIn.updatedAt || checkIn.createdAt || `${checkIn.date}T00:00:00+08:00`)}</td><td>${escapeHtml(student.name)}</td><td>Student check-in</td></tr>`).join("")}
            ${concerns.length ? concerns.map((concern) => {
              const author = getTeacher(concern.teacherId);
              const options = concern.concernIds.map((id) => SEL_CONCERN_OPTIONS.find((option) => option.id === id)).filter(Boolean).map(option => ({ ...option, tier: concern.tier ?? option.tier }));
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
                        <ul>${options.map((option) => `<li><span class="level-badge academic-tier">Tier ${option.tier}</span> ${escapeHtml(option.title)}${option.urgent ? " · immediate support review" : ""}</li>`).join("")}${concern.otherConcern && concern.otherConcern !== concern.description ? `<li>${escapeHtml(concern.otherConcern)}</li>` : ""}</ul>
                        ${(concern.recommendedStrategies ?? []).length ? `<h4>Linked MTSS strategies</h4><ul>${concern.recommendedStrategies.map((strategy) => `<li>${escapeHtml(strategy)}</li>`).join("")}</ul>` : ""}
                        ${(concern.strategies ?? []).length ? `<h4>Support selected</h4><ul>${concern.strategies.map(strategy => `<li>${escapeHtml(strategy)}</li>`).join("")}</ul>` : ""}
                        ${concern.followUp ? `<h4>Support or follow-up</h4><p>${escapeHtml(concern.followUp)}</p>` : ""}
                        ${renderConcernAttachment(concern, "record")}
                        ${linkedStudents.length ? `<h4>Other students involved, teacher-only</h4><div class="linked-students">${linkedStudents.map((linkedStudent) => renderStudentIdentity(linkedStudent, { secondary: `Grade ${linkedStudent.grade}`, points: getStudentTotal(state, linkedStudent.id), action: true, className: "is-compact" })).join("")}</div>` : ""}
                        ${concern.confidentialNote || concern.confidentialAttachmentData || concern.attachmentVisibility === "confidential" ? `<div class="confidential-note"><strong>Confidential teacher section</strong>${concern.confidentialNote ? `<p>${escapeHtml(concern.confidentialNote)}</p>` : ""}${renderConcernAttachment(concern, "confidential")}</div>` : ""}
                        ${renderRecordAccessSummary(concern)}
                      </div>
                    </details>
                  </td>
                  <td><time datetime="${concern.publishedAt}">${formatDateTime(concern.publishedAt)}</time></td>
                  <td>${escapeHtml(author?.name ?? "Unknown teacher")}</td>
                  <td>${renderRecordEditButton("sel", concern)}</td>
                </tr>`;
            }).join("") : !checkIns.length ? `<tr><td colspan="5" class="empty-table-cell">No SEL records match this filter.</td></tr>` : ""}
          </tbody>
        </table>
      </div>
    </section>
  `;
}


function renderStudentDetail() {
  const student = getStudent(profileStudentId);
  if (!student) return "";
  const house = getHouse(student.houseId);
  const totalPoints = getStudentTotal(state, student.id);

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

    ${renderSupportDocuments(state, activeUser, student, escapeHtml)}
    ${renderStudentCoinTable(student)}
    ${cloudEnabled ? renderSupportProfile(state, activeUser, student, escapeHtml) : ""}
    ${renderBehaviorConcernsTable(student)}
    ${renderAcademicConcernsTable(student)}
    ${renderSelConcernsTable(student)}


  `;
}

function renderSchoolActivityStudent(person) {
  const student = getStudent(person.id) ?? person;
  return renderStudentIdentity(student, { secondary: `Grade ${student.grade}`, points: getStudentTotal(state, student.id), action: true, className: "is-compact" });
}
function refreshSchoolActivity() {
  const content = document.querySelector("#school-activity-content");
  if (content) content.innerHTML = schoolActivityContent(state, activeUser, schoolActivityFilters, schoolActivityPage, escapeHtml, renderSchoolActivityStudent, formatDateTime);
  document.querySelectorAll("[data-school-activity-filter]").forEach(control => control.value = schoolActivityFilters[control.dataset.schoolActivityFilter]);
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
        ${event.valueId ? `<small>${escapeHtml((event.valueIds ?? [event.valueId]).map(id => getValue(id)?.name).filter(Boolean).join(", "))}</small>` : ""}
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
  const ranked = browseStudents(state,getStudentFilters("students"),HOUSES,VALUES).ranked;
  count.textContent = `${ranked ? "Student coin ranking · " : ""}${formatStudentCount(getFilteredStudents().length)}`;
  document.querySelector(".student-list-panel").hidden = Boolean(profileStudentId && !hasStudentFilter(getStudentFilters("students")));
  const controls = document.querySelector('[data-student-filters="students"]');
  if (controls) {
    controls.querySelector("input[type=search]").value=studentQuery;
    controls.querySelectorAll("[data-filter-value]").forEach(button=>{ const key=button.dataset.action.replace("filter-student-",""); const values=key==="house"?houseFilter:key==="grade"?studentGradeFilter:studentValueFilters; const selected=values.includes(button.dataset.filterValue);button.classList.toggle("is-selected",selected);button.setAttribute("aria-pressed",String(selected));});
    controls.querySelector(".student-ranking-dates").hidden = !ranked;
    controls.querySelector("#student-date-from").value=studentDateFrom;controls.querySelector("#student-date-to").value=studentDateTo;
    controls.querySelector("#student-date-from").max=studentDateTo;controls.querySelector("#student-date-to").min=studentDateFrom;
  }
  sortSelHistory();
}

function sortSelHistory() {
  const body = viewRoot.querySelector(".sel-history-table tbody");
  if (body) [...body.children].sort((a, b) => (b.querySelector("time")?.dateTime ?? "").localeCompare(a.querySelector("time")?.dateTime ?? "")).forEach(row => body.append(row));
}

function updateBehaviorCodePreview() {
  const form = document.querySelector("#behavior-concern-form");
  const preview = document.querySelector("#behavior-code-preview");
  if (!form || !preview) return;

  const formData = new FormData(form);
  const studentIds = formData.getAll("studentIds");
  const issueIds = formData.getAll("issueIds");
  if (!studentIds.length || !issueIds.length) {
    preview.innerHTML = "";
    return;
  }

  const actions = getBehaviorCodeActions(state, studentIds, issueIds);
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

function syncAcademicOtherIssue() {
  const select = document.querySelector("#academic-issue-select"), field = document.querySelector("#academic-other-issue-field");
  if (!select || !field) return;
  const other = Boolean(select.querySelector('[name="issueIds"][value="other"]:checked'));
  field.hidden = !other;
  const input = field.querySelector("textarea");
  input.disabled = !other; input.required = other;
  if (!other) input.value = "";
}
function updateAcademicFormOptions({ resetIssues = false } = {}) {
  const tierSelect = document.querySelector("#academic-tier"), profileSelect = document.querySelector("#academic-profile"), issueSelect = document.querySelector("#academic-issue-select"), strategySelect = document.querySelector("#academic-strategy-select"), heading = document.querySelector("#academic-strategy-heading");
  if (!tierSelect || !profileSelect || !issueSelect || !strategySelect || !heading) return;
  const selectedIssues = [...issueSelect.querySelectorAll('[name="issueIds"]:checked')].map(option => option.value).filter(id => !resetIssues || id === "other");
  const selectedStrategies = [...strategySelect.querySelectorAll('input:checked')].map(option => option.value);
  const further = document.querySelector("#academic-further-options"), selectedFurther = [...further.querySelectorAll("input:checked")].map(input => input.value);
  const tier = Number(tierSelect.value), profileId = profileSelect.value;
  profileSelect.closest("label").hidden = false;
  issueSelect.innerHTML = renderAcademicIssueOptions(tier, selectedIssues);
  strategySelect.innerHTML = renderAcademicStrategyOptions(tier, profileId, selectedStrategies);
  further.innerHTML = renderAcademicStrategyOptions(tier, profileId, selectedFurther, "furtherStrategies");
  const profile = ACADEMIC_PROFILES.find(item => item.id === profileId);
  heading.innerHTML = !tier ? "" : profile ? `<strong>Five recommended intervention strategies</strong><span>${profile.name}</span>` : `<strong>Tier ${tier} ${tier === 1 ? "instructional strategies" : "academic interventions"}</strong>`;
  syncAcademicOtherIssue();
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
    if (houseRankingDialog.open) houseRankingDialog.close();
    houseRankingDialog.innerHTML = "";
    viewRoot.innerHTML = "";
    topbarHouseScores.innerHTML = "";
    document.querySelector("#sidebar-house-scores").innerHTML = "";
    document.querySelector("#sidebar-student-tools").innerHTML = "";
    document.querySelector("#sidebar-student-identity").innerHTML = "";
    document.querySelector("#trusted-adult-remove-dialog").close();
    document.querySelector("#trusted-adult-remove-form").reset();
    document.querySelector("[data-trusted-remove-name]").textContent = "";
    trustedAdultPickerOpen = false;
    selCheckInOpen = false;
    return;
  }

  if (activeUser.type === "student" && !["dashboard", "students", "my-activities"].includes(activeView)) {
    activeView = "dashboard";
    window.history.replaceState(null, "", "#dashboard");
  }
  if (activeView === "administration" && !canAccessAdministration()) {
    activeView = "dashboard";
    window.history.replaceState(null, "", "#dashboard");
  }
  const canViewActivities = activeUser.type === "student" ||
    leadershipScopes(state, activeUser, { viewer: true }).length > 0 ||
    visibleEcActivities(state, activeUser).length > 0;
  document.querySelectorAll("[data-leadership-nav]").forEach(button => {
    button.hidden = !canViewActivities;
  });
  if (activeView === "my-activities" && !canViewActivities) activeView = "dashboard";
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
  else if (activeView === "my-activities") viewRoot.innerHTML = renderLeadershipWorkspace(state, activeUser, null, escapeHtml, { from: leadershipDateFrom, to: leadershipDateTo });
  else if (activeView === "administration") viewRoot.innerHTML = renderAdministration();
  else viewRoot.innerHTML = renderDashboard();

  viewRoot.insertAdjacentHTML("beforeend", renderRecordEditModal() + renderSelCheckInModal() + renderCalendarEventPanel(getCalendarEvents(state, { user: activeUser })));
  const pushStatus = viewRoot.querySelector("[data-push-status]");
  if (pushStatus) pushStatus.textContent = phonePushStatus;
  if (cloudEnabled && ["behavior-concern", "academic-concern", "sel-concern"].includes(activeView)) {
    viewRoot.querySelector(".editor-access-section")?.insertAdjacentHTML("beforeend", `<div class="followup-options"><h4>Notify staff for follow-up</h4><p>All supervising teachers and super admins are included automatically. Add other staff below.</p><details><summary>Additional recipients</summary>${state.teachers.filter(t => !isSupervisor({ ...t, type: "teacher" })).map(t => `<label class="checkbox-label"><input type="checkbox" name="notificationRecipientIds" value="${escapeHtml(t.id)}" />${escapeHtml(t.name)}</label>`).join("")}</details><label class="checkbox-label plan-request-toggle"><input type="checkbox" name="requestSmartGoal" /> Notify supervising staff: a SMART support plan may help this student</label></div>`);
  }

  sortSelHistory();
  if (houseRankingDialog.open) renderHouseRanking();
  enhanceFormSteps(viewRoot, activeView, formStepState);
  window.requestAnimationFrame(() => {
    syncCalendarCreationScope();
    if (activeView === "behavior-concern") { updateBehaviorCodePreview(); updateDeductionSentence(); refreshBehaviorCounts(); }
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
      window.requestAnimationFrame(() => document.querySelector(".calendar-event-panel")?.focus());
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
    case "school-activity-prev": schoolActivityPage = Math.max(0, schoolActivityPage - 1); refreshSchoolActivity(); break;
    case "school-activity-next": schoolActivityPage++; refreshSchoolActivity(); break;
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
    case "toggle-house-leaders": {
      const houseId = actionTarget.dataset.houseId;
      expandedHouseId = expandedHouseId === houseId ? null : houseId;
      renderHouseRanking();
      houseRankingDialog.querySelector(`[data-house-id="${houseId}"]`)?.focus({ preventScroll: true });
      break;
    }
    case "show-house-leaders": openHouseRanking(actionTarget.dataset.houseId); break;
    case "close-house-ranking": houseRankingDialog.close(); break;
    case "filter-house-ranking-value": {
      const valueId = actionTarget.dataset.valueId;
      houseRankingFilters.valueIds = valueId === "all" ? [] : houseRankingFilters.valueIds.includes(valueId) ? houseRankingFilters.valueIds.filter(id => id !== valueId) : [...houseRankingFilters.valueIds, valueId];
      renderHouseRanking();
      houseRankingDialog.querySelector(`[data-value-id="${valueId}"]`)?.focus({ preventScroll: true });
      break;
    }
    case "reset-house-ranking-dates":
      houseRankingFilters.from = houseRankingFilters.to = "";
      renderHouseRanking();
      houseRankingDialog.querySelector('[data-action="reset-house-ranking-dates"]')?.focus();
      break;
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
        []
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
      }

      render();
      showToast(`${pointsSent} points sent to ${student.name} for ${value.name}.`);
      break;
    }
    case "reset-student-filters": {
      const context = actionTarget.dataset.filterContext;
      updateStudentFilters(context, context === "students" ? {query:"",house:[],grade:[],values:[],from:"",to:""} : emptyStudentFilters());
      viewRoot.querySelector(`[data-student-search="${context}"]`)?.focus();
      break;
    }
    case "open-student":
    case "select-student":
      if (houseRankingDialog.open) houseRankingDialog.close();
      if (profileStudentId !== actionTarget.dataset.studentId) {
        resetProfileConcernFilters();
      }
      profileStudentId = actionTarget.dataset.studentId;
      studentQuery = ""; houseFilter = []; studentGradeFilter = []; studentValueFilters = []; studentDateFrom = studentDateTo = ""; profileCoinFilter = "all";
      if (activeView !== "students") {
        setView("students", { studentId: profileStudentId });
      } else {
        refreshStudentBrowser();
        window.requestAnimationFrame(() => {
          document.querySelector("#student-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      break;
    case "close-student-detail":
      profileStudentId = null;
      resetProfileConcernFilters();
      refreshStudentBrowser();
      break;
    case "filter-student-house":
    case "filter-student-grade":
    case "filter-student-value": {
      const category = actionTarget.dataset.action.replace("filter-student-", "");
      const key = category === "house" ? "house" : category === "grade" ? "grade" : "values";
      const filters = getStudentFilters("students");
      const selected = toggleFilterValues(filters[key], actionTarget.dataset.filterValue);
      const changes = { [key]: selected };
      if (key === "values" && !selected.length) { changes.from = ""; changes.to = ""; }
      updateStudentFilters("students", changes);
      break;
    }
    case "clear-student-dates":
      updateStudentFilters("students", { from: "", to: "" });
      document.querySelectorAll(".student-ranking-dates input").forEach(el=>el.value="");
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

function positionDeductionPicker() {
  const picker = viewRoot.querySelector(".deduction-value-picker[open]");
  if (!picker) return;
  const menu = picker.querySelector("div"), anchor = picker.getBoundingClientRect();
  const left = Math.max(12, Math.min(anchor.left, window.innerWidth - menu.offsetWidth - 12));
  menu.style.left = `${left - anchor.left}px`;
}
viewRoot.addEventListener("toggle", event => {
  if (event.target.matches(".deduction-value-picker[open]")) positionDeductionPicker();
  if (event.target.matches(".trusted-adult-picker")) trustedAdultPickerOpen = event.target.open;
}, true);
window.addEventListener("resize", positionDeductionPicker);

viewRoot.addEventListener("invalid", event => revealInvalidField(event.target), true);
viewRoot.addEventListener("keydown", event => {
  const panel = viewRoot.querySelector(".calendar-event-panel");
  if (panel && event.key === "Escape") { selectedCalendarEventId = null; render(); return; }
  if (panel && event.key === "Tab") {
    const controls = [...panel.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])')].filter(el => el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && [panel, first].includes(document.activeElement)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (event.key === "Enter" && event.target.matches("[data-editor-search]")) event.preventDefault();
});

viewRoot.addEventListener("change", (event) => {
  if (event.target.matches("[data-school-activity-filter]")) {
    schoolActivityFilters[event.target.dataset.schoolActivityFilter] = event.target.value;
    if (schoolActivityFilters.from && schoolActivityFilters.to && schoolActivityFilters.from > schoolActivityFilters.to) schoolActivityFilters[event.target.dataset.schoolActivityFilter === "from" ? "to" : "from"] = event.target.value;
    schoolActivityPage = 0; refreshSchoolActivity(); return;
  }
  if (event.target.matches("[data-activity-filter]")) { updateActivityFilter(event.target); return; }
  if (event.target.matches('[name="editorIds"]')) refreshEditorChips(event.target.closest(".editor-access-picker"));
  if (event.target.matches('#custom-calendar-event-form [name="scope"]')) { syncCalendarCreationScope(); return; }
  if (event.target.matches("#calendar-go-to-date") && event.target.value) {
    calendarWeekStart = startOfCalendarWeek(event.target.value);
    selectedCalendarEventId = null;
    render();
  } else if (event.target.matches("#calendar-grade-filter")) {
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
  } else if (event.target.matches("[data-profile-coin-filter]")) {
    profileCoinFilter = event.target.value; if (activeUser?.type === "student") render(); else refreshStudentBrowser();
  } else if (event.target.matches("#student-date-from, #student-date-to")) {
    let from=document.querySelector("#student-date-from").value,to=document.querySelector("#student-date-to").value;
    if(from&&to&&from>to){if(event.target.id.endsWith("from"))to=from;else from=to;}
    updateStudentFilters("students",{from,to});
  } else if (event.target.matches('#behavior-concern-form [name="location"]')) {
    const field=event.target.form.querySelector('[data-other-location]'); const other=event.target.value === "Other location";
    field.hidden=!other;field.querySelector('input').disabled=!other;field.querySelector('input').required=other;if(!other)field.querySelector('input').value="";
  } else if (event.target.matches("[data-profile-concern-filter]")) {
    const type = event.target.dataset.profileConcernFilter;
    if (!(type in profileConcernFilters)) return;
    profileConcernFilters[type] = event.target.value;
    refreshStudentBrowser();
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-profile-concern-filter="${type}"]`)?.focus({ preventScroll: true });
    });
  } else if (
    event.target.matches('#behavior-concern-form [name="studentIds"]') ||
    event.target.matches('#behavior-concern-form [name="issueIds"]') ||
    event.target.matches('#behavior-concern-form [name="otherIssueTiers"]')
  ) {
    refreshConcernStudentSelector();
    updateBehaviorCodePreview();
    updateBehaviorStrategies();
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
    updateSelSupportOptions();
  } else if (event.target.matches('#behavior-concern-form [name="deductionValueIds"]')) {
    updateDeductionSentence();
  } else if (event.target.matches('#sel-concern-form [name="concernIds"]')) {
    updateSelSupportOptions();
  } else if (event.target.matches('#academic-issue-select [name="issueIds"]')) {
    syncAcademicOtherIssue();
  } else if (event.target.matches("#academic-profile")) {
    updateAcademicFormOptions();
  } else if (event.target.matches("#academic-tier")) {
    updateAcademicFormOptions({ resetIssues: true });
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
    const expectedVersion = Number(event.target.dataset.recordVersion);
    try {
      const editorIds = formData.getAll("editorIds");
      const nextState = type === "award"
        ? updateAward(state, recordId, activeTeacher.id, {
            expectedVersion,
            valueId: formData.get("valueId"),
            points: formData.get("points"),
            comment: formData.get("comment"),
            editorIds
          })
        : updateConcern(state, type, recordId, activeTeacher.id, {
            expectedVersion,
            incidentDate: formData.get("incidentDate"),
            incidentTime: formData.get("incidentTime"),
            location: formData.get("location"),
            description: formData.get("description"),
            customAction: formData.get("customAction"),
            confidentialNote: formData.get("confidentialNote"),
            actionDetails: formData.get("actionDetails"),
            furtherDetails: formData.get("furtherDetails"),
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
    const calendarEvent = getCalendarEvents(state, { user: activeUser }).find((item) => item.id === eventId);
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
        issueIds: formData.getAll("issueIds"),
        otherIssueTiers: formData.getAll("otherIssueTiers"),
        additionalIssueDetails: formData.getAll("otherIssueTiers").length ? formData.get("description") : "",
        description: formData.get("description"),
        incidentTime: String(formData.get("incidentAt")).split("T")[1],
        location: formData.get("location"),
        otherLocation: formData.get("otherLocation"),
        teacherActions: formData.getAll("teacherActions"),
        strategies: formData.getAll("strategies"),
        otherStrategy: formData.get("otherStrategy"),
        customAction: formData.get("customAction"),
        deductionValueIds: formData.getAll("deductionValueIds"),
        deductionPoints: formData.get("deductionPoints"),
        confidentialNote: formData.get("confidentialNote"),
        editorIds: formData.getAll("editorIds"),
        teacherId: activeTeacher.id,
        incidentDate: String(formData.get("incidentAt")).split("T")[0],
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
        description: formData.get("description"),
        strategies: formData.getAll("strategies"),
        otherStrategy: "",
        actionDetails: formData.get("actionDetails"),
        furtherStrategies: formData.getAll("furtherStrategies"),
        furtherDetails: formData.get("furtherDetails"),
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
        otherConcern: formData.getAll("concernIds").includes("other") ? formData.get("description") : "",
        description: formData.get("description"),
        strategies: formData.getAll("strategies"),
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
      showToast("Check-in saved.");
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
  cloudCall("load").then(result => { if (!hasCloudSession() || (activeUser && activeUser.id !== result.user.id)) return; applyCloudResult(result); render(); }).catch(error => { loginError.textContent = error.message; });
}
let schoolRefreshInFlight = false;
async function refreshSchoolState() {
  if (!activeUser || cloudBusy || schoolRefreshInFlight || selCheckInOpen || trustedAdultPickerOpen || mustChangePassword || document.querySelector("dialog[open]") || document.activeElement?.matches("input, textarea, select")) return;
  const accountId = activeUser.id, snapshot = cloudSnapshot;
  schoolRefreshInFlight = true;
  try {
    const result = await cloudCall("load");
    if (!hasCloudSession() || activeUser?.id !== accountId || cloudBusy || cloudSnapshot !== snapshot) return;
    if (JSON.stringify(result.state) !== JSON.stringify(cloudSnapshot)) { applyCloudResult(result); render(); }
  } catch { /* Preserve the current view during temporary network failures. */ }
  finally { schoolRefreshInFlight = false; }
}
if (cloudEnabled) {
  setInterval(refreshSchoolState, 30_000);
  window.addEventListener("focus", refreshSchoolState);
}


initializePhonePush(() => activeUser, noticeId => {
  const n = state.notifications?.find(item => item.id === noticeId);
  if (n && activeUser && !mustChangePassword) {
    if (["event-activity", "leader-task"].includes(n.kind)) openLeadershipNotice(n);
    else openSupportRecord(n.studentId, notificationRecordTarget(n));
  }
});

viewRoot.addEventListener("change", event => {
  if (!event.target.matches("[data-leadership-date]")) return;
  if (event.target.dataset.leadershipDate === "from") leadershipDateFrom = event.target.value;
  else leadershipDateTo = event.target.value;
  render();
});

// Shared domain rules. Callers must supply the authenticated server-side actor.
// This module intentionally has no browser storage or authentication mechanism.
export const SMART_FIELDS = Object.freeze({
  s: { title: "Specific", definition: "What exactly do you want to accomplish?" },
  m: { title: "Measurable", definition: "What evidence will show your progress and success?" },
  a: { title: "Achievable", definition: "What realistic steps and support will make this possible?" },
  r: { title: "Relevant", definition: "Why does this goal matter to you?" },
  t: { title: "Time-bound", definition: "When will you complete this goal and review your progress?" }
});

const SUPERVISOR_ROLES = new Set(["super-admin", "teacher-supervising"]);
const OUTCOMES = new Set(["achieved", "not-achieved", "closed", "reviewed"]);

export function isSupervisor(actor) {
  return actor?.type === "teacher" && SUPERVISOR_ROLES.has(actor.role);
}

function requireSupervisor(actor) {
  if (!isSupervisor(actor)) throw new Error("A supervising teacher or super admin is required");
}

function requireOwnerOrSupervisor(actor, studentId) {
  if (!isSupervisor(actor) && !(actor?.type === "student" && actor.id === studentId)) {
    throw new Error("You cannot change another student's support plan");
  }
}

function requiredText(value, label, limit = 4000) {
  const text = String(value ?? "").trim();
  if (!text || text.length > limit) throw new Error(`${label} is required (maximum ${limit} characters)`);
  return text;
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error("Choose a valid review date");
  }
  return value;
}

export function canReadGoal(actor, goal) {
  return actor?.type === "teacher" || (actor?.type === "student" && actor.id === goal.studentId);
}

export function createSmartGoal(actor, input, { id, now = new Date().toISOString(), previousGoal = null }) {
  requireOwnerOrSupervisor(actor, input.studentId);
  const title = requiredText(input.title, "Goal title", 200);
  if (previousGoal) {
    requireSupervisor(actor);
    if (previousGoal.studentId !== input.studentId || previousGoal.status !== "not-achieved") {
      throw new Error("A follow-up must reference this student's unsuccessful goal");
    }
  }
  const fields = Object.fromEntries(Object.keys(SMART_FIELDS).map((key) => [key, {
    text: String(input.fields?.[key] ?? "").trim(),
    studentCanEdit: actor.type === "student" ? !String(input.fields?.[key] ?? "").trim() : Boolean(input.studentEditableFields?.includes(key)),
    submittedAt: actor.type === "student" && String(input.fields?.[key] ?? "").trim() ? now : null,
    submittedBy: actor.type === "student" && String(input.fields?.[key] ?? "").trim() ? actor.id : null
  }]));
  for (const field of Object.values(fields)) {
    if (field.text.length > 4000) throw new Error("SMART responses must be under 4000 characters");
  }
  return {
    id, studentId: input.studentId, title, fields,
    origin: actor.type === "student" ? "student" : "supervisor",
    authorId: actor.id, sourceConcernId: actor.type === "teacher" ? input.sourceConcernId ?? null : null,
    previousGoalId: previousGoal?.id ?? null,
    dueDate: validDate(input.dueDate), status: "active",
    createdAt: now, updatedAt: now, outcome: null
  };
}

export function submitSmartField(actor, goal, key, text, { now = new Date().toISOString(), dueDate } = {}) {
  requireOwnerOrSupervisor(actor, goal.studentId);
  if (goal.status !== "active" || !Object.hasOwn(SMART_FIELDS, key)) throw new Error("This goal field is not open");
  const field = goal.fields[key];
  if (actor.type === "student" && !field.studentCanEdit) throw new Error("A supervisor must reopen this field");
  const nextField = { ...field, text: requiredText(text, SMART_FIELDS[key].title), studentCanEdit: false, submittedAt: now, submittedBy: actor.id };
  return {
    ...goal, fields: { ...goal.fields, [key]: nextField },
    dueDate: key === "t" ? validDate(dueDate ?? goal.dueDate) : goal.dueDate,
    updatedAt: now
  };
}

export function setStudentFieldAccess(actor, goal, key, canEdit, now = new Date().toISOString()) {
  requireSupervisor(actor);
  if (goal.status !== "active" || !Object.hasOwn(SMART_FIELDS, key)) throw new Error("This goal field is not open");
  return { ...goal, updatedAt: now, fields: { ...goal.fields, [key]: { ...goal.fields[key], studentCanEdit: Boolean(canEdit) } } };
}

export function closeSmartGoal(actor, goal, status, note, now = new Date().toISOString()) {
  requireSupervisor(actor);
  if (goal.status !== "active" || !OUTCOMES.has(status)) throw new Error("Choose an outcome for an active goal");
  return { ...goal, status, updatedAt: now, outcome: { status, note: requiredText(note, "Review note"), reviewerId: actor.id, reviewedAt: now } };
}

export function concernIssueKeys(type, concern) {
  const keys = type === "sel" ? [...(concern.concernIds ?? [])] : [...(concern.issueIds ?? [])];
  if (type === "academic" && concern.profileId) keys.push(`profile:${concern.profileId}`);
  // Free-written 'Other' entries are different issues; do not group unrelated reports.
  const other = type === "sel" ? concern.otherConcern : concern.otherIssue;
  const specificKeys = keys.filter((key) => key !== "other");
  if (other?.trim()) specificKeys.push(`other:${other.trim().toLowerCase().replace(/\s+/g, " ")}`);
  return [...new Set(specificKeys)];
}

// Deterministic keys permit idempotent insertion in a database transaction.
// Once generated, notifications are persisted; editing a concern does not erase them.
export function collectSupportAlerts({ concerns = [], goals = [], staff = [], today }) {
  validDate(today);
  const recipients = staff.filter((person) => SUPERVISOR_ROLES.has(person.role)).map((person) => person.id);
  const groups = new Map();
  const alerts = [];
  const sorted = [...concerns].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id));
  for (const concern of sorted) {
    for (const studentId of new Set(concern.studentIds)) {
      for (const issue of concernIssueKeys(concern.type, concern)) {
        const groupKey = JSON.stringify([studentId, concern.type, issue]);
        const group = groups.get(groupKey) ?? [];
        group.push(concern.id);
        groups.set(groupKey, group);
        if (group.length === 3) alerts.push({
          key: `repeat:${groupKey}`, kind: "repeated-concern", studentId,
          concernType: concern.type, issue, concernIds: [...group], recipientIds: [...recipients],
          createdAt: concern.publishedAt
        });
      }
      if (concern.requestSmartGoal) alerts.push({
        key: `plan-request:${concern.id}:${studentId}`, kind: "smart-goal-request",
        studentId, concernIds: [concern.id], recipientIds: [...recipients], createdAt: concern.publishedAt
      });
    }
  }
  for (const goal of goals) {
    if (goal.status === "active" && goal.dueDate <= today) alerts.push({
      key: `goal-due:${goal.id}:${goal.dueDate}`, kind: "goal-due", studentId: goal.studentId,
      goalId: goal.id, recipientIds: [...new Set([...recipients, goal.studentId])],
      createdAt: `${goal.dueDate}T00:00:00+08:00`
    });
  }
  return alerts;
}

export function requestUrgentSupport(actor, student, { id, now = new Date().toISOString(), staff = [] }) {
  if (actor?.type !== "student" || actor.id !== student.id) throw new Error("Students can request support only for themselves");
  const recipients = staff.filter((person) => SUPERVISOR_ROLES.has(person.role) || trustedAdultIds(student).includes(person.id));
  return {
    key: `urgent:${id}`, kind: "urgent-support", title: "URGENT - Need support",
    studentId: student.id, recipientIds: [...new Set(recipients.map((person) => person.id))], createdAt: now
  };
}

export function trustedAdultIds(student) {
  return [...new Set(Array.isArray(student.trustedAdultIds) ? student.trustedAdultIds : [student.trustedAdultId].filter(Boolean))];
}
export const pendingTrustedAdults = student => (student.trustedAdultRequests ?? []).filter(request => request.status === "pending");
export function setTrustedAdults(actor, student, ids, staff) {
  if (actor?.type !== "student" || actor.id !== student.id) throw new Error("Only the student can choose their trusted adults");
  if (!Array.isArray(ids) || ids.some(id => !staff.some(person => person.id === id))) throw new Error("Choose existing members of staff");
  const selected = [...new Set(ids)];
  return { ...student, trustedAdultIds: selected, trustedAdultId: selected[0] ?? null };
}
export function setTrustedAdult(actor, student, teacherId, staff) {
  return setTrustedAdults(actor, student, teacherId ? [teacherId] : [], staff);
}

export function markSupportNotificationRead(actor, notification, now = new Date().toISOString()) {
  if (!notification.recipientIds.includes(actor?.id)) throw new Error("This notification belongs to another account");
  return { ...notification, readBy: { ...notification.readBy, [actor.id]: now } };
}

export function validateIepPdf(actor, bytes, filename) {
  if (actor?.type !== "teacher") throw new Error("IEP documents are restricted to staff");
  if (!/\.pdf$/i.test(filename ?? "")) throw new Error("Choose a PDF document");
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 || bytes.length > 10 * 1024 * 1024) {
    throw new Error("PDF documents must be between 8 bytes and 10 MB");
  }
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("This file is not a PDF document");
  return { contentType: "application/pdf", size: bytes.length };
}

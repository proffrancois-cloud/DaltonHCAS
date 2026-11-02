import { isSupervisor, validDate } from "./support-rules.js";

export const CONCERN_TYPES = ["behavior", "academic", "sel"];
export const RESPONSE_LABELS = {
  "taking-care": "I am taking care of this concern.",
  "keep-on-record": "I have read this concern. Keep it on record pending further concerns."
};
export const taiwanToday = (value = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
export const dateValue = validDate;
export const allConcerns = state => CONCERN_TYPES.flatMap(type => (state[`${type}Concerns`] ?? []).map(item => ({ ...item, type })));
export const supervisors = state => state.teachers.filter(t => isSupervisor({ ...t, type: "teacher" })).map(t => t.id);
export function concernRecipients(state, concern) {
  return [...new Set(concern.notificationRecipientIds ?? [...supervisors(state), ...(concern.editorIds ?? [])])].filter(id => state.teachers.some(t => t.id === id));
}
export const goalRecipients = (state, goal) => [...new Set([goal.studentId, ...supervisors(state), goal.responsibleTeacherId, state.teachers.some(t => t.id === goal.authorId) ? goal.authorId : null].filter(Boolean))];
export function reflectionRequired(goal, today = taiwanToday()) { return goal.status !== "active" || goal.dueDate <= today; }
export function goalSchedule(state, goal, input, now) {
  if (input.responsibleTeacherId && !state.teachers.some(t => t.id === input.responsibleTeacherId)) throw new Error("Choose a staff member responsible for follow-up");
  const previous = goal.checkIns ?? [];
  const rows = input.checkIns ?? previous.filter(c => !c.cancelledAt);
  if (!Array.isArray(rows) || rows.length > 20) throw new Error("Use up to 20 check-in dates");
  const seen = new Set();
  const checkIns = rows.map(row => {
    const date = dateValue(typeof row === "string" ? row : row.date);
    if (date > goal.dueDate) throw new Error("Check-in dates must be on or before the final review date");
    const old = typeof row === "object" && row.id ? previous.find(c => c.id === row.id) : null;
    if (typeof row === "object" && row.id && !old) throw new Error("Unknown check-in");
    const id = old?.id ?? crypto.randomUUID();
    if (seen.has(id)) throw new Error("Duplicate check-in");
    seen.add(id);
    return { id, date, revision: (old?.revision ?? 0) + (!old || old.date !== date || old.cancelledAt ? 1 : 0), cancelledAt: null };
  });
  for (const old of previous) if (!seen.has(old.id)) checkIns.push({ ...old, cancelledAt: old.cancelledAt ?? now });
  return { ...goal, checkIns, responsibleTeacherId: input.responsibleTeacherId || null, updatedAt: now };
}

export function followupAlerts(state, today) {
  const alerts = [];
  for (const concern of allConcerns(state)) {
    const recipientIds = concernRecipients(state, concern);
    for (const studentId of concern.studentIds) {
      // Legacy records without an author are imported summaries, not new notices.
      if (concern.teacherId) alerts.push({ key: `concern-response:${concern.id}:${studentId}`, kind: "concern-response-required", concernType: concern.type, concernId: concern.id, studentId, recipientIds, createdAt: concern.publishedAt });
      for (const response of concern.responses ?? []) alerts.push({ key: `concern-response-update:${response.id}:${studentId}`, kind: "concern-response-update", concernType: concern.type, concernId: concern.id, studentId, response, recipientIds: [...new Set([...recipientIds, concern.teacherId])], createdAt: response.createdAt });
    }
  }
  for (const goal of state.smartGoals ?? []) {
    const recipientIds = goalRecipients(state, goal);
    if (goal.status === "active") for (const checkIn of goal.checkIns ?? []) {
      if (!checkIn.cancelledAt && checkIn.date <= today) alerts.push({ key: `goal-check-in:${goal.id}:${checkIn.id}:${checkIn.revision}`, kind: "goal-check-in", goalId: goal.id, checkInId: checkIn.id, scheduleRevision: checkIn.revision, studentId: goal.studentId, recipientIds, createdAt: `${checkIn.date}T00:00:00+08:00` });
    }
    if (reflectionRequired(goal, today)) alerts.push({ key: `goal-final:${goal.id}:${goal.dueDate}:${goal.deadlineRevision ?? 0}:${goal.status}`, kind: "goal-final-review", goalId: goal.id, studentId: goal.studentId, recipientIds, createdAt: goal.outcome?.reviewedAt ?? `${goal.dueDate}T00:00:00+08:00` });
  }
  return alerts;
}

export function applyFollowupCommand(state, actor, action, p, now) {
  if (action === "concern-response") {
    const concern = state[`${p.type}Concerns`]?.find(c => c.id === p.id);
    if (!concern || actor.type !== "teacher" || !concernRecipients(state, concern).includes(actor.id)) throw new Error("Only notified staff can respond to this concern");
    if (!Object.hasOwn(RESPONSE_LABELS, p.response)) throw new Error("Choose a response");
    if (!/^[\w-]{8,100}$/.test(p.requestId ?? "")) throw new Error("A response identifier is required");
    if ((concern.responses ?? []).some(r => r.requestId === p.requestId && r.respondentId === actor.id)) return state;
    const response = { id: crypto.randomUUID(), requestId: p.requestId, respondentId: actor.id, response: p.response, createdAt: now };
    const updated = { ...concern, responses: [...(concern.responses ?? []), response] };
    return { ...state, [`${p.type}Concerns`]: state[`${p.type}Concerns`].map(c => c.id === p.id ? updated : c) };
  }
  const goal = (state.smartGoals ?? []).find(g => g.id === p.id);
  if (!goal) throw new Error("Goal not found");
  let updated;
  if (action === "goal-schedule") {
    if (!isSupervisor(actor) || goal.status !== "active") throw new Error("Only supervising staff can change an active goal schedule");
    updated = goalSchedule(state, goal, p, now);
  } else if (action === "goal-reflection") {
    if (actor.type !== "student" || actor.id !== goal.studentId) throw new Error("Only the student can edit their reflection, including after submission");
    if (!reflectionRequired(goal, taiwanToday(now))) throw new Error("The final reflection opens when the goal ends or is due");
    const text = String(p.text ?? "").trim();
    if (!text || text.length > 12000) throw new Error("Write a reflection of up to 12,000 characters");
    updated = { ...goal, reflection: { text, studentId: actor.id, submittedAt: goal.reflection?.submittedAt ?? now, updatedAt: now }, updatedAt: now };
  } else if (action === "reflection-reminder") {
    if (!isSupervisor(actor) || !reflectionRequired(goal, taiwanToday(now))) throw new Error("Supervising staff can send reminders once the goal ends or is due");
    const recent = (state.notifications ?? []).some(n => n.kind === "reflection-reminder" && n.goalId === goal.id && Date.parse(now) - Date.parse(n.createdAt) < 60_000);
    if (recent) throw new Error("A reminder was just sent. Please wait a minute before sending another.");
    return { ...state, notifications: [...(state.notifications ?? []), { id: crypto.randomUUID(), key: `reflection-reminder:${crypto.randomUUID()}`, kind: "reflection-reminder", goalId: goal.id, studentId: goal.studentId, recipientIds: [goal.studentId], createdAt: now, readBy: {} }] };
  } else throw new Error("Unknown follow-up action");
  return { ...state, smartGoals: state.smartGoals.map(g => g.id === goal.id ? updated : g) };
}

import { HOUSES, getCalendarEvents, isHouseLeaderTeacher, isStudentInLab, normalizeAttachmentPayload } from "./data.js";
import { validDate } from "./support-rules.js";

export function leadershipScopes(state, actor, { viewer = false } = {}) {
  if (!actor) return [];
  const staff = actor.type === "teacher" ? state.teachers.find(t => t.id === actor.id) : null;
  const student = actor.type === "student" ? state.students.find(s => s.id === actor.id) : null;
  const admin = staff?.role === "super-admin";
  const houses = HOUSES.filter(h => admin || (staff && isHouseLeaderTeacher(staff) && staff.houseId === h.id) || (student?.houseId === h.id && (viewer || (state.leadershipAssignments?.houseLeaders?.[h.id] ?? []).includes(student.id))));
  return [
    ...houses.map(h => ({ key: `house:${h.id}`, type: "house", id: h.id, name: h.name, leaderIds: state.leadershipAssignments?.houseLeaders?.[h.id] ?? [] })),
    ...(state.leadershipAssignments?.labs ?? []).filter(l => admin || (staff && l.teacherIds?.includes(staff.id)) || (student && (viewer ? isStudentInLab(l, student.id) : l.leaderIds?.includes(student.id))))
      .map(l => ({ key: `lab:${l.id}`, type: "lab", id: l.id, name: l.name, leaderIds: l.leaderIds ?? [] }))
  ];
}
export function eventScopeKey(event) {
  return event.type === "lab" && event.labId ? `lab:${event.labId}` : event.type === "house" && event.houseId ? `house:${event.houseId}` : null;
}
export function canPublishEventActivity(state, actor, event) {
  return Boolean(eventScopeKey(event) && leadershipScopes(state, actor).some(s => s.key === eventScopeKey(event)));
}
export function leadershipEvents(state, actor, type) {
  const keys = new Set(leadershipScopes(state, actor, { viewer: true }).filter(s => s.type === type).map(s => s.key));
  return getCalendarEvents(state, { user: actor }).filter(e => keys.has(eventScopeKey(e)));
}
function attachment(input) {
  const file = normalizeAttachmentPayload({ attachmentName: input.attachmentName, attachmentData: input.attachmentData });
  return { attachmentName: file.attachmentName, attachmentData: file.attachmentData };
}
function required(value, label, max) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new Error(`${label} is required (up to ${max.toLocaleString()} characters)`);
  return text;
}
function eventRecipients(state, event) {
  if (event.type === "house") return [...state.students.filter(s => s.houseId === event.houseId && (!event.grades?.length || event.grades.includes(s.grade))).map(s => s.id), ...state.teachers.filter(t => t.houseId === event.houseId || t.role === "super-admin").map(t => t.id)];
  const lab = state.leadershipAssignments.labs.find(l => l.id === event.labId);
  return [...(lab?.memberIds ?? []), ...(lab?.leaderIds ?? []), ...(lab?.teacherIds ?? [])];
}
function withNotice(state, notice) {
  return { ...state, notifications: [...(state.notifications ?? []), { ...notice, id: crypto.randomUUID(), readBy: {} }] };
}
export function applyLeadershipCommand(state, actor, action, input, now) {
  if (action === "event-activity-add") {
    const event = getCalendarEvents(state, { user: actor }).find(e => e.id === input.eventId);
    if (!event || !canPublishEventActivity(state, actor, event)) throw new Error("You can add activities only to your assigned House or LAB events");
    const activity = { id: crypto.randomUUID(), eventId: event.id, eventDate: event.date, scopeKey: eventScopeKey(event), text: required(input.text, "Today's activity", 12000), ...attachment(input), authorId: actor.id, authorName: actor.name, createdAt: now };
    return withNotice({ ...state, eventActivities: [...(state.eventActivities ?? []), activity] }, {
      key: `event-activity:${activity.id}`, kind: "event-activity", eventId: event.id, eventDate: event.date, eventTitle: event.title,
      activityId: activity.id, authorName: actor.name, recipientIds: [...new Set(eventRecipients(state, event))], createdAt: now
    });
  }
  if (action === "leader-task-add") {
    const scope = leadershipScopes(state, actor).find(s => s.key === input.scopeKey);
    if (actor.type !== "teacher" || !scope) throw new Error("Only the responsible staff can send leadership tasks");
    const leaderIds = Array.isArray(input.leaderIds) ? [...new Set(input.leaderIds)] : [];
    if (!leaderIds.length || leaderIds.some(id => !scope.leaderIds.includes(id))) throw new Error("Choose the assigned captains or leaders");
    const task = { id: crypto.randomUUID(), scopeKey: scope.key, scopeType: scope.type, scopeName: scope.name, leaderIds, title: required(input.title, "Task title", 200), description: required(input.description, "Task description", 12000), deadline: validDate(input.deadline), ...attachment(input), authorId: actor.id, authorName: actor.name, createdAt: now };
    return withNotice({ ...state, leadershipTasks: [...(state.leadershipTasks ?? []), task] }, {
      key: `leader-task:${task.id}`, kind: "leader-task", taskId: task.id, scopeType: scope.type, scopeName: scope.name, taskTitle: task.title, authorName: actor.name,
      recipientIds: leaderIds, createdAt: now
    });
  }
  throw new Error("Unknown leadership action");
}

import * as data from "./data.js";
import * as support from "./support-rules.js";
import * as followup from "./followup-rules.js";
import { validateConcernTier } from "./tier-rules.js";
import { visibleLevelUpDocuments } from "./levelup-resources.js";

export function actorForAccount(state, accountId) {
  const teacher = state.teachers.find(item => item.id === accountId);
  if (teacher) return { ...teacher, type: "teacher" };
  const student = state.students.find(item => item.id === accountId);
  return student ? { ...student, type: "student", studentId: student.id } : null;
}

export function synchronizeAlerts(state, today) {
  const concerns = ["behavior", "academic", "sel"].flatMap(type =>
    (state[`${type}Concerns`] ?? []).map(item => ({ ...item, type })));
  const generated = [...support.collectSupportAlerts({ concerns, goals: [], staff: state.teachers, today }), ...followup.followupAlerts(state, today)];
  const currentKeys = new Set(generated.map(n => n.key));
  const notifications = (state.notifications ?? []).map(n => ({ ...n, id: n.id ?? crypto.randomUUID(), ...(["goal-check-in", "goal-final-review", "goal-due"].includes(n.kind) ? { cancelled: !currentKeys.has(n.key) } : {}) }));
  const known = new Set(notifications.map(item => item.key));
  for (const alert of generated) if (!known.has(alert.key)) { notifications.push({ ...alert, id: crypto.randomUUID(), readBy: {} }); known.add(alert.key); }
  return { ...state, notifications };
}

export function visibleState(state, actor) {
  const notifications = (state.notifications ?? []).filter(item => item.recipientIds.includes(actor.id))
    .map(item => ({ ...item, recipientIds: actor.type === "teacher" ? item.recipientIds : [actor.id], readBy: { [actor.id]: item.readBy?.[actor.id] ?? null } }));
  if (actor.type === "teacher") return { ...state, notifications };
  const student = state.students.find(item => item.id === actor.id);
  const calendar = data.getCalendarEvents(state, { user: actor });
  return {
    version: state.version, students: [student],
    teachers: state.teachers.map(({ id, name }) => ({ id, name })),
    awards: state.awards.filter(item => item.studentId === actor.id),
    behaviorConcerns: state.behaviorConcerns.filter(item => item.studentIds.includes(actor.id)).map(item => ({
      id: item.id, studentIds: [actor.id], title: item.title, description: item.description,
      incidentDate: item.incidentDate, publishedAt: item.publishedAt
    })),
    academicConcerns: [], selConcerns: [], iepDocuments: [],
    selCheckIns: state.selCheckIns.filter(item => item.studentId === actor.id),
    smartGoals: (state.smartGoals ?? []).filter(item => item.studentId === actor.id).map(item => ({ ...item, sourceConcernId: null, sourceConcernType: null })),
    houseTotals: data.getHouseTotals(state), notifications,
    leadershipAssignments: state.leadershipAssignments,
    houseMeetingLocations: state.houseMeetingLocations,
    levelUpDocuments: visibleLevelUpDocuments(state, actor),
    customCalendarEvents: (state.customCalendarEvents ?? []).filter(base => calendar.some(item => item.id === base.id || item.id.startsWith(`${base.id}::`))),
    calendarEventDetails: Object.fromEntries(calendar.map(item => [item.id, {
      startTime: item.startTime, endTime: item.endTime, location: item.location,
      description: item.description, resourceUrl: item.resourceUrl,
      attachmentName: item.attachmentName, attachmentData: item.attachmentData
    }]))
  };
}

function teacherOnly(actor) {
  if (actor.type !== "teacher") throw new Error("This action is restricted to staff");
}
function adminOnly(actor) {
  if (actor.type !== "teacher" || actor.role !== "super-admin") throw new Error("Only a super admin can perform this action");
}

export function applySchoolCommand(state, actor, action, p, now = Date.now()) {
  const iso = new Date(now).toISOString();
  const teacherActions = new Set(["award-add", "award-update", "award-remove", "concern-add", "concern-update"]);
  if (teacherActions.has(action)) teacherOnly(actor);
  switch (action) {
    case "award-add": return data.addAward(state, p.studentId, p.valueId, actor.id, Number(p.points), now, p.comment ?? "", p.editorIds ?? []);
    case "award-update": return data.updateAward(state, p.id, actor.id, p.changes, now);
    case "award-remove": return data.removeAward(state, p.id, actor.id);
    case "concern-add": {
      const fn = { behavior: data.addBehaviorConcern, academic: data.addAcademicConcern, sel: data.addSelConcern }[p.type];
      if (!fn) throw new Error("Unknown concern type");
      validateConcernTier(p.type, p.input);
      const next = fn(state, { ...p.input, teacherId: actor.id }, now);
      next[`${p.type}Concerns`].at(-1).requestSmartGoal = Boolean(p.input.requestSmartGoal);
      next[`${p.type}Concerns`].at(-1).notificationRecipientIds = [...new Set([...followup.supervisors(state), ...(p.input.notificationRecipientIds ?? [])])].filter(id => state.teachers.some(t => t.id === id));
      return next;
    }
    case "concern-update": return data.updateConcern(state, p.type, p.id, actor.id, p.changes, now);
    case "check-in": return data.addSelCheckIn(state, actor, p, now);
    case "student-create": adminOnly(actor); return data.createStudentAccount(state, actor, p);
    case "teacher-create": adminOnly(actor); return data.createTeacherAccount(state, actor, p);
    case "teacher-status": return data.updateTeacherAccountStatus(state, actor, p.id, p.changes);
    case "student-transfer": return data.transferStudentHouse(state, actor, p.id, p.houseId);
    case "house-leader": adminOnly(actor); return data.setHouseLeader(state, p.houseId, p.studentId, p.enabled);
    case "lab-add": adminOnly(actor); return data.addLabAssignment(state, p);
    case "lab-remove": adminOnly(actor); return data.removeLabAssignment(state, p.id);
    case "event-add": return data.addCustomCalendarEvent(state, actor, p, now);
    case "event-update": {
      const event = data.getCalendarEvents(state, { user: actor }).find(item => item.id === p.id);
      if (!event) throw new Error("Event not available in your calendar");
      return data.updateCalendarEventDetails(state, actor, event, p.changes);
    }
    case "goal-add": {
      if (!state.students.some(item => item.id === p.studentId)) throw new Error("Unknown student");
      if (actor.type === "teacher" && p.sourceConcernType && !p.sourceConcernId) throw new Error("Select the existing concern for this plan");
      if (p.sourceConcernId && ![...state.behaviorConcerns, ...state.academicConcerns, ...state.selConcerns]
        .some(item => item.id === p.sourceConcernId && item.studentIds.includes(p.studentId))) throw new Error("Concern does not belong to this student");
      const previousGoal = p.previousGoalId ? (state.smartGoals ?? []).find(item => item.id === p.previousGoalId) : null;
      if (p.previousGoalId && !previousGoal) throw new Error("Previous goal not found");
      const linked = followup.allConcerns(state).find(c => c.id === p.sourceConcernId);
      if (actor.type === "teacher" && p.sourceConcernId && p.sourceConcernType && linked.type !== p.sourceConcernType) throw new Error("Select a concern of the chosen type");
      const base = support.createSmartGoal(actor, p, { id: crypto.randomUUID(), now: iso, previousGoal });
      const goal = followup.goalSchedule(state, { ...base, sourceConcernType: base.sourceConcernId ? linked.type : null, deadlineRevision: 0 }, { checkIns: p.checkIns ?? [], responsibleTeacherId: actor.type === "teacher" ? p.responsibleTeacherId || actor.id : null }, iso);
      return { ...state, smartGoals: [...(state.smartGoals ?? []), goal] };
    }
    case "goal-field": case "goal-access": case "goal-close": {
      const goal = (state.smartGoals ?? []).find(item => item.id === p.id);
      if (!goal) throw new Error("Goal not found");
      let updated = action === "goal-field" ? support.submitSmartField(actor, goal, p.field, p.text, { now: iso, dueDate: p.dueDate })
        : action === "goal-access" ? support.setStudentFieldAccess(actor, goal, p.field, p.canEdit, iso)
        : support.closeSmartGoal(actor, goal, p.status, p.note, iso);
      if (updated.dueDate !== goal.dueDate) {
        if ((goal.checkIns ?? []).some(c => !c.cancelledAt && c.date > updated.dueDate)) throw new Error("Cancel or move later check-ins before shortening the final review date");
        updated = { ...updated, deadlineRevision: (goal.deadlineRevision ?? 0) + 1 };
      }
      return { ...state, smartGoals: state.smartGoals.map(item => item.id === goal.id ? updated : item) };
    }
    case "concern-response": case "goal-schedule": case "goal-reflection": case "reflection-reminder":
      return followup.applyFollowupCommand(state, actor, action, p, iso);
    case "trusted-adult": {
      const student = state.students.find(item => item.id === actor.id);
      if (!student) throw new Error("Student account required");
      const updated = support.setTrustedAdult(actor, student, p.teacherId, state.teachers);
      return { ...state, students: state.students.map(item => item.id === updated.id ? updated : item) };
    }
    case "urgent-support": {
      const student = state.students.find(item => item.id === actor.id);
      if (!student) throw new Error("Student account required");
      const latest = [...(state.notifications ?? [])].reverse().find(item => item.kind === "urgent-support" && item.studentId === actor.id);
      if (latest && now - Date.parse(latest.createdAt) < 60_000) throw new Error("Your support request has been sent. Please speak directly to an adult if you need immediate help.");
      const alert = support.requestUrgentSupport(actor, student, { id: crypto.randomUUID(), now: iso, staff: state.teachers });
      return { ...state, notifications: [...(state.notifications ?? []), { ...alert, readBy: {} }] };
    }
    case "notification-read": {
      const notification = (state.notifications ?? []).find(item => item.key === p.key);
      if (!notification) throw new Error("Notification not found");
      const updated = support.markSupportNotificationRead(actor, notification, iso);
      return { ...state, notifications: state.notifications.map(item => item.key === p.key ? updated : item) };
    }
    default: throw new Error("Unknown school action");
  }
}

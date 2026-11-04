import * as data from "./data.js";
import * as support from "./support-rules.js";
import * as followup from "./followup-rules.js";
import { validateConcernTier } from "./tier-rules.js";
import { visibleLevelUpDocuments } from "./levelup-resources.js";
import { recordActivity, schoolPublications } from "./activity.js";
import { applyLeadershipCommand, leadershipScopes } from "./leadership.js";

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
  const { hubResources: resourceCatalog = [], ...staffState } = state;
  const hubResources = resourceCatalog
    .filter(({ audience, accountIds, ownerId }) => audience === "all" || audience === actor.type ||
      (actor.type === "teacher" && ownerId === actor.id) ||
      (audience === "hod" && actor.type === "teacher" && accountIds?.includes(actor.id)))
    .map(({ title, url, group }) => ({ title, url, group }));
  const notifications = (state.notifications ?? []).filter(item => item.recipientIds.includes(actor.id))
    .flatMap(item => {
      const award = item.kind === "coin-received" && state.awards.find(award => award.id === item.awardId);
      if (item.kind === "coin-received" && !award) return [];
      return [{
        ...item, ...(award ? { points: award.points, valueIds: data.getAwardValueIds(award) } : {}),
        recipientIds: actor.type === "teacher" ? item.recipientIds : [actor.id],
        readBy: { [actor.id]: item.readBy?.[actor.id] ?? null }
      }];
    });
  if (actor.type === "teacher") return { ...staffState, notifications, hubResources, schoolPublications: schoolPublications(state, actor), activityEvents: (state.activityEvents ?? []).filter(event => event.actorId === actor.id) };
  const student = state.students.find(item => item.id === actor.id);
  const calendar = data.getCalendarEvents(state, { user: actor });
  const groupKeys = new Set(leadershipScopes(state, actor, { viewer: true }).map(s => s.key));
  return {
    version: state.version, students: [student], hubResources,
    ecActivities: data.visibleEcActivities(state, actor).map(({ id, name, teacherIds, sessions }) => ({
      id, name, teacherIds, memberIds: [actor.id],
      sessions: (sessions ?? []).map(({ date, endTime, location }) => ({ date, endTime, location }))
    })),
    teachers: state.teachers.map(({ id, name }) => ({ id, name })),
    awards: state.awards.filter(item => item.studentId === actor.id).map(({ editHistory, updatedBy, ...award }) => award),
    behaviorConcerns: state.behaviorConcerns.filter(item => item.studentIds.includes(actor.id)).map(item => ({
      id: item.id, studentIds: [actor.id], title: item.title, description: item.description,
      incidentDate: item.incidentDate, publishedAt: item.publishedAt,
      studentResponses: (item.studentResponses ?? []).filter(r => r.studentId === actor.id),
      ...(item.attachmentVisibility === "record" ? { attachmentName: item.attachmentName, attachmentData: item.attachmentData, attachmentVisibility: "record" } : {})
    })),
    academicConcerns: [], selConcerns: [], iepDocuments: [],
    selCheckIns: state.selCheckIns.filter(item => item.studentId === actor.id),
    smartGoals: (state.smartGoals ?? []).filter(item => item.studentId === actor.id).map(item => ({ ...item, sourceConcernId: null, sourceConcernType: null })),
    houseTotals: data.getHouseTotals(state), houseCoinSummary: data.getHouseCoinSummary(state), notifications,
    leadershipAssignments: state.leadershipAssignments,
    houseMeetingLocations: state.houseMeetingLocations,
    levelUpDocuments: visibleLevelUpDocuments(state, actor),
    eventActivities: (state.eventActivities ?? []).filter(a => calendar.some(e => e.id === a.eventId)),
    leadershipTasks: (state.leadershipTasks ?? []).filter(t => groupKeys.has(t.scopeKey)),
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
  const next = applyCommand(state, actor, action, p, now);
  return recordActivity(state, recordStudentUpdates(state, next, action, p, now), actor, action, p, now);
}

function recordStudentUpdates(before, next, action, payload, now) {
  const alerts = [];
  const stamp = new Date(now).toISOString();
  const trusted = studentId => support.trustedAdultIds(next.students.find(s => s.id === studentId) ?? {}).filter(id => next.teachers.some(t => t.id === id));
  if (action === "award-add") {
    const oldIds = new Set(before.awards.map(a => a.id));
    for (const award of next.awards.filter(a => !oldIds.has(a.id))) alerts.push({ key: `coin-received:${award.id}`, kind: "coin-received", studentId: award.studentId, awardId: award.id, points: award.points, valueIds: data.getAwardValueIds(award), recipientIds: [...new Set([award.studentId, ...trusted(award.studentId)])], createdAt: stamp });
  }
  if (action === "concern-add") {
    const concern = next[`${payload.type}Concerns`].at(-1);
    const existingStaff = followup.concernRecipients(next, concern);
    for (const studentId of concern.studentIds) {
      const recipientIds = [...new Set([...(payload.type === "behavior" ? [studentId] : []), ...trusted(studentId).filter(id => !existingStaff.includes(id))])];
      if (recipientIds.length) alerts.push({ key: `student-concern:${concern.id}:${studentId}`, kind: "student-concern", studentId, concernType: payload.type, concernId: concern.id, recipientIds, createdAt: stamp });
    }
  }
  if (!alerts.length) return next;
  return { ...next, notifications: [...(next.notifications ?? []), ...alerts.map(alert => ({ ...alert, id: crypto.randomUUID(), readBy: {} }))] };
}

function updateTrustedAdultSelection(state, actor, action, p, iso) {
  const student = state.students.find(s => s.id === actor.id);
  if (!student || actor.type !== "student") throw new Error("Student account required");
  const active = support.trustedAdultIds(student), pending = support.pendingTrustedAdults(student);
  const current = [...new Set([...active, ...pending.map(r => r.teacherId)])];
  const requested = action === "trusted-adult-add" ? [...current, p.teacherId] : action === "trusted-adult-remove" ? current.filter(id => id !== p.teacherId) : p.teacherIds ?? (p.teacherId ? [p.teacherId] : []);
  support.setTrustedAdults(actor, student, requested, state.teachers); // Validate every requested staff ID without activating it.
  const wanted = [...new Set(requested)], removed = active.filter(id => !wanted.includes(id));
  const reason = String(p.reason ?? "").trim();
  if (reason.length > 2000) throw new Error("Use up to 2000 characters for the optional reason");
  const requests = (student.trustedAdultRequests ?? []).map(r => r.status === "pending" && !wanted.includes(r.teacherId) ? { ...r, status: "cancelled", cancelledAt: iso } : r);
  const added = wanted.filter(id => !current.includes(id)).map(teacherId => ({ id: crypto.randomUUID(), teacherId, status: "pending", requestedAt: iso }));
  const updated = { ...support.setTrustedAdults(actor, student, active.filter(id => wanted.includes(id)), state.teachers), trustedAdultRequests: [...requests, ...added] };
  const notices = added.map(r => ({ id: crypto.randomUUID(), key: `trusted-adult-request:${r.id}`, kind: "trusted-adult-request", requestId: r.id, studentId: student.id, teacherId: r.teacherId, recipientIds: [r.teacherId], createdAt: iso, readBy: {} }));
  if (removed.length) notices.push({ id: crypto.randomUUID(), key: `trusted-adult-removed:${student.id}:${crypto.randomUUID()}`, kind: "trusted-adult-removed", studentId: student.id, removedAdultIds: removed, reason, recipientIds: followup.supervisors(state), createdAt: iso, readBy: {} });
  const cancelled = new Set(requests.filter(r => r.status === "cancelled").map(r => r.id));
  return { ...state, students: state.students.map(s => s.id === student.id ? updated : s), notifications: [...(state.notifications ?? []).map(n => n.kind === "trusted-adult-request" && cancelled.has(n.requestId) ? { ...n, cancelled: true } : n), ...notices] };
}
function confirmTrustedAdult(state, actor, requestId, iso) {
  const student = state.students.find(s => (s.trustedAdultRequests ?? []).some(r => r.id === requestId));
  const request = student?.trustedAdultRequests.find(r => r.id === requestId);
  if (actor.type !== "teacher" || !request || request.teacherId !== actor.id) throw new Error("Only the requested adult can confirm this request");
  if (request.status === "confirmed") return state;
  if (request.status !== "pending") throw new Error("This request is no longer pending");
  const updated = { ...support.setTrustedAdults({ type: "student", id: student.id }, student, [...support.trustedAdultIds(student), actor.id], state.teachers), trustedAdultRequests: student.trustedAdultRequests.map(r => r.id === requestId ? { ...r, status: "confirmed", confirmedAt: iso } : r) };
  const notice = { id: crypto.randomUUID(), key: `trusted-adult-confirmed:${requestId}`, kind: "trusted-adult-confirmed", studentId: student.id, teacherId: actor.id, recipientIds: [student.id], createdAt: iso, readBy: {} };
  return { ...state, students: state.students.map(s => s.id === student.id ? updated : s), notifications: [...(state.notifications ?? []).map(n => n.kind === "trusted-adult-request" && n.requestId === requestId ? { ...n, confirmedAt: iso, readBy: { ...n.readBy, [actor.id]: iso } } : n), notice] };
}

function applyCommand(state, actor, action, p, now) {
  const iso = new Date(now).toISOString();
  const teacherActions = new Set(["award-add", "award-update", "award-remove", "concern-add", "concern-update", "hub-link-add"]);
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
      next[`${p.type}Concerns`].at(-1).notificationRecipientIds = followup.supervisors(state);
      return next;
    }
    case "concern-update": return data.updateConcern(state, p.type, p.id, actor.id, p.changes, now);
    case "hub-link-add": {
      const title = String(p.title ?? "").trim();
      const rawUrl = String(p.url ?? "").trim();
      if (!title || title.length > 100) throw new Error("Enter a link title of up to 100 characters");
      if (rawUrl.length > 2048) throw new Error("Use an HTTPS link of up to 2,048 characters");
      const url = URL.canParse(rawUrl) ? new URL(rawUrl) : null;
      if (url?.protocol !== "https:" || url.username || url.password) throw new Error("Enter a valid HTTPS link");
      const audiences = p.audiences ?? [];
      if (!Array.isArray(audiences) || audiences.some(audience => !["teacher", "student"].includes(audience))) {
        throw new Error("Choose a valid Hub audience");
      }
      if (audiences.length && !support.isSupervisor(actor)) throw new Error("Only supervising teachers and super admins can publish shared Hub links");
      const selected = [...new Set(audiences)];
      const audience = selected.length === 2 ? "all" : selected[0] ?? "personal";
      const resource = { title, url: url.href, audience, ownerId: actor.id };
      return { ...state, hubResources: [...(state.hubResources ?? []), resource] };
    }
    case "check-in": return data.addSelCheckIn(state, actor, p, now);
    case "support-plan-save": {
      if (!support.isSupervisor(actor)) throw new Error("Only supervising teachers and super admins can edit support information");
      if (!state.students.some(student => student.id === p.studentId)) throw new Error("Unknown student");
      const info = String(p.info ?? "").trim();
      if (info.length > 12000) throw new Error("Support information must be under 12000 characters");
      return { ...state, supportPlans: { ...(state.supportPlans ?? {}), [p.studentId]: { info, updatedBy: actor.id, updatedAt: iso } } };
    }
    case "student-create": adminOnly(actor); return data.createStudentAccount(state, actor, p);
    case "teacher-create": adminOnly(actor); return data.createTeacherAccount(state, actor, p);
    case "teacher-status": return data.updateTeacherAccountStatus(state, actor, p.id, p.changes);
    case "student-transfer": return data.transferStudentHouse(state, actor, p.id, p.houseId);
    case "house-leader": adminOnly(actor); return data.setHouseLeader(state, p.houseId, p.studentId, p.enabled);
    case "lab-add": adminOnly(actor); return data.addLabAssignment(state, p);
    case "lab-remove": adminOnly(actor); return data.removeLabAssignment(state, p.id);
    case "event-add": return data.addCustomCalendarEvent(state, actor, p, now);
    case "event-activity-add": case "leader-task-add": return applyLeadershipCommand(state, actor, action, p, iso);
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
    case "concern-response": case "behavior-student-response": case "goal-schedule": case "goal-reflection": case "goal-adult-reflection": case "reflection-reminder":
      return followup.applyFollowupCommand(state, actor, action, p, iso);
    case "trusted-adult": case "trusted-adult-add": case "trusted-adult-remove":
      return updateTrustedAdultSelection(state, actor, action, p, iso);
    case "trusted-adult-confirm": return confirmTrustedAdult(state, actor, p.requestId, iso);
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

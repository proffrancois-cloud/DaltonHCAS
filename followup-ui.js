import { RESPONSE_LABELS, concernRecipients, reflectionRequired } from "./followup-rules.js";
import { isSupervisor } from "./support-rules.js";

const stamp = value => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Taipei" });
const staffName = (state, id) => state.teachers.find(t => t.id === id)?.name ?? "Staff member";
export function responseHistory(state, actor, concern, esc) {
  if (actor.type !== "teacher") return "";
  const owners = [...new Set((concern.responses ?? []).filter(r => r.response === "taking-care").map(r => r.respondentId))];
  return `<div class="concern-followup" id="concern-${esc(concern.id)}"><strong>Taking care: ${owners.length ? owners.map(id => esc(staffName(state, id))).join(", ") : "Awaiting acceptance"}</strong>
    ${(concern.responses ?? []).length ? `<details><summary>Staff response history (${concern.responses.length})</summary><ul>${concern.responses.map(r => `<li><strong>${esc(staffName(state, r.respondentId))}</strong> · ${esc(stamp(r.createdAt))}<p>${esc(RESPONSE_LABELS[r.response])}</p></li>`).join("")}</ul></details>` : ""}
    ${(state.smartGoals ?? []).filter(g => g.sourceConcernId === concern.id).map(g => `<p><button type="button" class="text-button" data-action="open-support-record" data-student-id="${esc(g.studentId)}" data-record-id="goal-${esc(g.id)}">SMART plan: ${esc(g.title)}</button></p>`).join("")}</div>`;
}
function scheduleInputs(goal, esc) {
  return `<div data-check-in-rows>${(goal.checkIns ?? []).filter(c => !c.cancelledAt).map(c => checkInRow(c, esc)).join("")}</div><button type="button" class="text-button" data-action="add-check-in">+ Add check-in date</button>`;
}
export function checkInRow(checkIn = {}, esc = x => x) {
  return `<div class="check-in-row" data-check-in-row data-check-in-id="${esc(checkIn.id ?? "")}"><label>Check-in date<input type="date" name="checkInDate" value="${esc(checkIn.date ?? "")}" required /></label><button type="button" class="text-button" data-action="remove-check-in" aria-label="Remove check-in date">Remove</button></div>`;
}
export function scheduleCreator(state, actor, esc) {
  return `${actor.type === "teacher" ? responsibleSelect(state, actor.id, esc) : ""}<fieldset><legend>Check-in dates · optional</legend>${scheduleInputs({}, esc)}</fieldset>`;
}
function responsibleSelect(state, id, esc) {
  return `<label>Responsible for follow-up<select name="responsibleTeacherId" required>${state.teachers.map(t => `<option value="${esc(t.id)}" ${t.id === id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>`;
}
export function goalFollowup(state, actor, goal, esc) {
  const supervisor = isSupervisor(actor), own = actor.type === "student" && actor.id === goal.studentId;
  const dates = (goal.checkIns ?? []).filter(c => !c.cancelledAt);
  const required = reflectionRequired(goal);
  return `<p class="goal-meta">Follow-up: ${esc(goal.responsibleTeacherId ? staffName(state, goal.responsibleTeacherId) : "Supervising staff")} · Check-ins: ${dates.map(c => esc(c.date)).join(", ") || "None scheduled"}</p>
    ${supervisor && goal.status === "active" ? `<details><summary>Edit follow-up schedule</summary><form data-support-form="goal-schedule" data-goal-id="${esc(goal.id)}">${responsibleSelect(state, goal.responsibleTeacherId, esc)}${scheduleInputs(goal, esc)}<button class="secondary-button" type="submit">Save schedule</button><p class="support-error" role="alert"></p></form></details>` : ""}
    ${required || goal.reflection ? `<section class="goal-reflection" id="reflection-${esc(goal.id)}"><h5>Student’s final reflection ${!goal.reflection ? "· required" : ""}</h5><p>${goal.origin === "student" ? "What did you accomplish? What did you do, and what helped or made progress difficult? What would you do differently, and what will help you keep progressing?" : "What happened? What did you do? What helped or made things difficult? What would you do differently next time? What could help prevent the difficulty from happening again?"}</p>
      ${own ? `<form data-support-form="goal-reflection" data-goal-id="${esc(goal.id)}"><label>Your reflection<textarea name="text" rows="5" maxlength="12000" required>${esc(goal.reflection?.text ?? "")}</textarea></label><small>You can return and edit this reflection after submitting it.</small><button class="secondary-button" type="submit">Save reflection</button><p class="support-error" role="alert"></p></form>` : `<p class="smart-response">${esc(goal.reflection?.text ?? "Awaiting the student’s reflection.")}</p>`}
      ${goal.reflection ? `<small>Updated ${esc(stamp(goal.reflection.updatedAt))}</small>` : ""}${supervisor ? `<button type="button" class="text-button" data-action="reflection-reminder" data-goal-id="${esc(goal.id)}">Send reflection reminder</button>` : ""}</section>` : ""}`;
}
export function renderFollowupNotifications(state, actor, esc) {
  const all = [...(state.notifications ?? [])].filter(n => !n.cancelled).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = all.filter(n => !n.readBy?.[actor.id]).length;
  const labels = { "coin-received": actor.type === "student" ? "You received coins" : "New coins for a trusted student", "student-concern": "New concern recorded", "trusted-adult-removed": "Trusted adult removed", "concern-response-required": "Concern awaiting your response", "concern-response-update": "Concern response update", "repeated-concern": "Three matching concerns recorded", "smart-goal-request": "SMART support requested", "goal-due": "SMART final review", "goal-final-review": "SMART final review & student reflection", "goal-check-in": "SMART check-in due", "reflection-reminder": "Please complete your goal reflection", "urgent-support": "URGENT - Need support" };
  return `<section class="panel support-section notification-panel"><div class="record-section-heading"><h2>Notifications ${unread ? `<b class="points-notification">${unread}</b>` : ""}</h2><span>${unread ? "" : "All caught up"}</span></div>
    <details class="phone-notifications"><summary>App & phone notifications</summary><button type="button" class="secondary-button" data-install-app>Install DaltonHCAS</button><p>After installation, open the app from its icon and enable notifications below. iPhone/iPad notifications require iOS/iPadOS 16.4 or later.</p><p>Allow notifications for this device. School details stay in the app; lock-screen messages are generic. If permission is denied, enable it in your browser or phone settings. Dashboard notifications remain available.</p><button type="button" class="secondary-button" data-action="enable-push">Enable notifications on this device</button><button type="button" class="text-button" data-action="disable-push">Disable on this device</button><p data-push-status role="status"></p></details>
    ${all.length ? `<ul>${all.map(n => {
      const concern = state[`${n.concernType}Concerns`]?.find(c => c.id === n.concernId);
      const responses = concern?.responses ?? [], ownResponses = responses.filter(r => r.respondentId === actor.id);
      const latest = ownResponses.at(-1);
      const owners = [...new Set(responses.filter(r => r.response === "taking-care").map(r => r.respondentId))];
      const target = n.awardId ? `award-${n.awardId}` : n.goalId ? `${n.kind === "reflection-reminder" || n.kind === "goal-final-review" ? "reflection" : "goal"}-${n.goalId}` : (n.concernId || n.concernIds?.at(-1)) ? `concern-${n.concernId ?? n.concernIds.at(-1)}` : "";
      return `<li class="${n.readBy?.[actor.id] ? "is-read" : "is-unread"}"><div><strong>${esc(n.kind === "concern-response-required" && latest ? "Your concern response is recorded" : n.kind === "student-concern" ? (actor.type === "student" ? "New behavior notice" : `New ${n.concernType} concern`) : labels[n.kind] ?? "School update")}</strong>${actor.type === "teacher" ? `<p>${esc(state.students.find(s => s.id === n.studentId)?.name ?? "Student")}</p>` : ""}${n.kind === "coin-received" ? `<p>+${esc(n.points)} coins</p>` : ""}${n.kind === "trusted-adult-removed" ? `<p>${(n.removedAdultIds ?? []).map(id => esc(staffName(state, id))).join(", ")}</p>${n.reason ? `<p>Reason: ${esc(n.reason)}</p>` : ""}` : ""}${n.response ? `<p>${esc(staffName(state, n.response.respondentId))}: ${esc(RESPONSE_LABELS[n.response.response])}</p>` : ""}${concern && n.kind !== "concern-response-update" ? `<p>Taking care: ${owners.length ? owners.map(id => esc(staffName(state, id))).join(", ") : "Awaiting acceptance"}</p>${latest ? `<p>Your response: ${esc(RESPONSE_LABELS[latest.response])}</p>` : ""}` : ""}<time>${esc(stamp(n.createdAt))}</time></div><div class="notification-actions"><button type="button" class="text-button" data-action="open-support-record" data-student-id="${esc(n.studentId)}" data-record-id="${esc(target)}">Open ${n.goalId ? "goal / reflection" : concern ? "concern" : "profile"}</button>
      ${n.kind === "concern-response-required" && concern && actor.type === "teacher" && concernRecipients(state, concern).includes(actor.id) ? Object.entries(RESPONSE_LABELS).map(([value, label]) => `<button type="button" class="secondary-button" data-action="concern-response" data-concern-id="${esc(concern.id)}" data-concern-type="${esc(n.concernType)}" data-response="${value}" ${ownResponses.some(r => r.response === value) || (value === "keep-on-record" && ownResponses.some(r => r.response === "taking-care")) ? "disabled" : ""}>${label}</button>`).join("") : ""}
      ${!n.readBy?.[actor.id] ? `<button type="button" class="text-button" data-action="read-support-notification" data-notification-key="${esc(n.key)}">Mark as read</button>` : "<small>Read</small>"}</div></li>`;
    }).join("")}</ul>` : '<p class="muted-cell">No notifications yet.</p>'}</section>`;
}

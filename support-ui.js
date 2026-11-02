import { SMART_FIELDS, isSupervisor } from "./support-rules.js";

export function renderIepHeart(state, actor, student, esc) {
  if (actor?.type !== "teacher" || !(state.iepDocuments ?? []).some(doc => doc.studentId === student.id)) return "";
  return `<button type="button" class="iep-heart" data-action="open-iep" data-student-id="${esc(student.id)}" aria-label="Read ${esc(student.name)}'s private IEP" title="Private IEP · staff only">♥</button>`;
}

export function renderSupportProfile(state, actor, student, esc, { dashboard = false } = {}) {
  const supervisor = isSupervisor(actor), own = actor?.type === "student" && actor.id === student.id;
  if (!actor || (!own && actor.type !== "teacher")) return "";
  const goals = (state.smartGoals ?? []).filter(goal => goal.studentId === student.id && (!dashboard || goal.status === "active"));
  const docs = (state.iepDocuments ?? []).filter(doc => doc.studentId === student.id);
  const statusLabel = { active: "In progress", achieved: "Completed successfully", "not-achieved": "Not achieved", closed: "Closed", reviewed: "Reviewed" };
  const concerns = ["behavior", "academic", "sel"].flatMap(type => (state[`${type}Concerns`] ?? []).filter(item => item.studentIds.includes(student.id)).map(item => ({ ...item, type })));
  return `
    ${actor.type === "teacher" && !dashboard ? `<section class="profile-record-section support-section">
      <div class="record-section-heading"><div><h3>♥ IEP documents</h3><span>Private · teachers and above only · PDF</span></div></div>
      ${docs.length ? `<ul class="support-document-list">${docs.map(doc => `<li><button class="secondary-button" type="button" data-action="read-iep-document" data-document-id="${esc(doc.id)}">${esc(doc.name)}</button><small>Published ${esc(new Date(doc.publishedAt).toLocaleDateString("en-GB"))}</small></li>`).join("")}</ul>` : '<p class="muted-cell">No IEP document uploaded.</p>'}
      <form data-support-form="iep-upload" data-student-id="${esc(student.id)}"><label>Upload IEP PDF <input type="file" name="pdf" accept="application/pdf,.pdf" required /></label><small>PDF only, up to 10 MB.</small><button class="secondary-button" type="submit">Upload private PDF</button><p class="support-error" role="alert"></p></form>
    </section>` : ""}
    <section class="profile-record-section support-section" id="student-smart-goals">
      <div class="record-section-heading"><div><h3>${dashboard ? "Your active SMART goals" : "SMART goals & plans"}</h3><span>Visible to this student and staff</span></div></div>
      ${!goals.length ? '<p class="muted-cell">No active goals yet.</p>' : goals.map(goal => `<article class="smart-goal" id="goal-${esc(goal.id)}">
        <div class="smart-goal-heading"><div><span class="goal-origin">${goal.origin === "student" ? "Student-created goal" : "Supervisor support plan"}</span><h4>${esc(goal.title)}</h4></div><span class="goal-status ${goal.status === "achieved" ? "is-achieved" : ""}">${statusLabel[goal.status] ?? esc(goal.status)}</span></div>
        <p class="goal-meta">Review date: <time>${esc(goal.dueDate)}</time> · Published ${esc(new Date(goal.createdAt).toLocaleDateString("en-GB"))}</p>
        ${goal.previousGoalId ? `<p class="goal-meta">Follow-up to an earlier goal · <a href="#goal-${esc(goal.previousGoalId)}">View previous goal</a></p>` : ""}
        ${actor.type === "teacher" && goal.sourceConcernId ? `<p class="goal-meta">Linked concern: ${esc(concerns.find(item => item.id === goal.sourceConcernId)?.title ?? goal.sourceConcernId)}</p>` : ""}
        <details ${dashboard ? "" : "open"}><summary>SMART rubric & responses</summary>
          ${Object.entries(SMART_FIELDS).map(([key, rubric]) => {
            const field = goal.fields[key], editable = goal.status === "active" && (supervisor || (own && field.studentCanEdit));
            return `<section class="smart-field"><h5><span>${key.toUpperCase()}</span> ${rubric.title}</h5><p>${rubric.definition}</p>
              ${editable ? `<form data-support-form="goal-field" data-goal-id="${esc(goal.id)}" data-field="${key}"><label><span class="sr-only">${rubric.title} response</span><textarea name="text" maxlength="4000" rows="3" required>${esc(field.text)}</textarea></label>${key === "t" ? `<label>Review date<input type="date" name="dueDate" value="${esc(goal.dueDate)}" required /></label>` : ""}<button class="secondary-button" type="submit">${own ? "Submit & lock this response" : "Save response"}</button><p class="support-error" role="alert"></p></form>` : `<p class="smart-response">${field.text ? esc(field.text) : "Awaiting response"}</p>${own && goal.status === "active" ? '<small>A supervisor can reopen this response.</small>' : ""}`}
              ${supervisor && goal.status === "active" ? `<button class="text-button" type="button" data-action="goal-access" data-goal-id="${esc(goal.id)}" data-field="${key}" data-allow="${!field.studentCanEdit}">${field.studentCanEdit ? "Close student editing" : "Allow student to edit once"}</button>` : ""}
            </section>`;
          }).join("")}
        </details>
        ${goal.outcome ? `<div class="goal-outcome"><strong>${statusLabel[goal.status]}</strong><p>${esc(goal.outcome.note)}</p><small>Reviewed ${esc(new Date(goal.outcome.reviewedAt).toLocaleDateString("en-GB"))}</small></div>` : ""}
        ${supervisor && goal.status === "active" ? `<form data-support-form="goal-close" data-goal-id="${esc(goal.id)}"><label>Review outcome<select name="status"><option value="achieved">Completed successfully</option><option value="not-achieved">Not achieved</option><option value="reviewed">Reviewed</option><option value="closed">Closed</option></select></label><label>Review note<textarea name="note" rows="2" maxlength="4000" required></textarea></label><button class="secondary-button" type="submit">Record outcome</button><p class="support-error" role="alert"></p></form>` : ""}
        ${supervisor && goal.status === "not-achieved" ? `<button class="secondary-button" type="button" data-action="follow-up-goal" data-student-id="${esc(student.id)}" data-goal-id="${esc(goal.id)}">Create linked follow-up goal</button>` : ""}
      </article>`).join("")}
      ${(supervisor || own) && !dashboard ? `<details class="new-goal"><summary>${own ? "Create your own SMART goal" : "Add a supervisor SMART plan"}</summary>
        <form data-support-form="goal-add" data-student-id="${esc(student.id)}"><input type="hidden" name="previousGoalId" value="" /><label>Goal title<input name="title" maxlength="200" required /></label>
        ${supervisor ? `<label>Related concern <small>Optional</small><select name="sourceConcernId"><option value="">No related concern</option>${concerns.map(item => `<option value="${esc(item.id)}">${item.type}: ${esc(item.title)}</option>`).join("")}</select></label>` : ""}
        ${Object.entries(SMART_FIELDS).map(([key, rubric]) => `<label>${key.toUpperCase()} · ${rubric.title}<small>${rubric.definition}</small><textarea name="${key}" rows="2" maxlength="4000" ${own ? "required" : ""}></textarea></label>${supervisor ? `<label class="checkbox-label"><input type="checkbox" name="studentEditableFields" value="${key}" /> Allow student to complete this field once</label>` : ""}`).join("")}
        <label>Review date<input type="date" name="dueDate" required /></label><button class="primary-button" type="submit">Publish SMART goal</button><p class="support-error" role="alert"></p></form></details>` : ""}
    </section>
    ${own && !dashboard ? `<section class="profile-record-section support-section"><h3>Your trusted adult</h3><p>Choose a staff member you prefer to talk to. You can change this at any time.</p><form data-support-form="trusted-adult"><label>Adult of reference<select name="teacherId"><option value="">No preference</option>${state.teachers.map(teacher => `<option value="${esc(teacher.id)}" ${student.trustedAdultId === teacher.id ? "selected" : ""}>${esc(teacher.name)}</option>`).join("")}</select></label><button class="secondary-button" type="submit">Save preference</button><p class="support-error" role="alert"></p></form><button type="button" class="urgent-support-button" data-action="urgent-support">URGENT - Need support</button><p class="field-help">This alerts supervising staff and your preferred adult in their dashboard. If you need immediate help, speak directly to an adult now.</p></section>` : ""}
  `;
}

export function renderSupportNotifications(state, actor, esc) {
  const all = [...(state.notifications ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = all.filter(item => !item.readBy?.[actor.id]);
  const labels = { "repeated-concern": "Three matching concerns recorded", "smart-goal-request": "SMART support plan requested", "goal-due": "SMART goal review is due", "urgent-support": "URGENT - Need support" };
  return `<section class="panel support-section notification-panel"><div class="record-section-heading"><h2>Notifications ${unread.length ? `<b class="points-notification" aria-label="${unread.length} unread notifications">${unread.length}</b>` : ""}</h2><span>${unread.length ? "Unread" : "All caught up"}</span></div>${all.length ? `<ul>${all.map(item => `<li class="${item.readBy?.[actor.id] ? "is-read" : "is-unread"}"><div><strong>${esc(labels[item.kind] ?? "School update")}</strong><p>${esc(state.students.find(s => s.id === item.studentId)?.name ?? "Student")}${item.issue ? ` · ${esc(item.issue)}` : ""}</p><time>${esc(new Date(item.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Taipei" }))}</time></div><div class="notification-actions"><button type="button" class="text-button" data-action="open-support-profile" data-student-id="${esc(item.studentId)}">View profile</button>${!item.readBy?.[actor.id] ? `<button type="button" class="secondary-button" data-action="read-support-notification" data-notification-key="${esc(item.key)}">Mark as read</button>` : '<small>Read</small>'}</div></li>`).join("")}</ul>` : '<p class="muted-cell">No notifications yet.</p>'}</section>`;
}

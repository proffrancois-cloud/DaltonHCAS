import { SMART_FIELDS, isSupervisor } from "./support-rules.js";
import { goalFollowup, scheduleCreator } from "./followup-ui.js";

export function renderIepHeart(state, actor, student, esc) {
  if (actor?.type !== "teacher" || (!(state.iepDocuments ?? []).some(doc => doc.studentId === student.id) && !state.supportPlans?.[student.id]?.info)) return "";
  return `<button type="button" class="iep-heart" data-action="open-iep" data-student-id="${esc(student.id)}" aria-label="Read ${esc(student.name)}'s private support plan" title="IEP / 504 plan / accommodations · staff only">♥</button>`;
}

export function renderSupportDocuments(state, actor, student, esc) {
  if (actor?.type !== "teacher") return "";
  const docs = (state.iepDocuments ?? []).filter(doc => doc.studentId === student.id);
  const plan = state.supportPlans?.[student.id];
  const supervisor = isSupervisor(actor);
  if (!supervisor && !docs.length && !plan?.info) return "";
  return `<section id="student-support-${esc(student.id)}" class="profile-record-section support-section private-support-plans">
    <div class="record-section-heading"><h3>IEP / 504 plan / accommodations</h3><span class="privacy-badge is-private">Staff only</span></div>
    ${plan?.info ? `<p class="smart-response">${esc(plan.info)}</p>` : ""}
    ${docs.length ? `<ul class="support-document-list">${docs.map(doc => `<li><button type="button" class="secondary-button" data-action="read-iep-document" data-document-id="${esc(doc.id)}">${esc(doc.kind || "IEP")} · ${esc(doc.name)}</button><small>Published ${esc(new Date(doc.publishedAt).toLocaleDateString("en-GB"))}</small></li>`).join("")}</ul>` : ""}
    ${supervisor ? `<details><summary>${plan?.info ? "Edit support information" : "Add support information"}</summary><form data-support-form="support-plan-save" data-student-id="${esc(student.id)}"><label>Support information<textarea name="info" rows="4" maxlength="12000" placeholder="IEP, 504 plan or classroom accommodations">${esc(plan?.info || "")}</textarea></label><button type="submit" class="secondary-button">Save information</button><p class="support-error" role="alert"></p></form></details>` : ""}
    <details><summary>Add a PDF</summary><form data-support-form="iep-upload" data-student-id="${esc(student.id)}"><label>Document type<select name="kind"><option>IEP</option><option>504 plan</option><option>Accommodations</option></select></label><label>PDF<input type="file" name="pdf" accept="application/pdf,.pdf" required /></label><small>PDF only, up to 10 MB.</small><button class="secondary-button" type="submit">Upload private PDF</button><p class="support-error" role="alert"></p></form></details>
  </section>`;
}

export function renderSupportProfile(state, actor, student, esc, { dashboard = false } = {}) {
  const supervisor = isSupervisor(actor), own = actor?.type === "student" && actor.id === student.id;
  if (!actor || (!own && actor.type !== "teacher")) return "";
  const goals = (state.smartGoals ?? []).filter(goal => goal.studentId === student.id && (!dashboard || goal.status === "active"));
  const statusLabel = { active: "In progress", achieved: "Completed successfully", "not-achieved": "Not achieved", closed: "Closed", reviewed: "Reviewed" };
  const concerns = ["behavior", "academic", "sel"].flatMap(type => (state[`${type}Concerns`] ?? []).filter(item => item.studentIds.includes(student.id)).map(item => ({ ...item, type })));
  return `
    <section class="profile-record-section support-section" id="student-smart-goals">
      <div class="record-section-heading"><div><h3>${dashboard ? "Your active SMART goals" : "SMART goals & plans"}</h3><span>Visible to this student and staff</span></div></div>
      ${!goals.length ? '<p class="muted-cell">No active goals yet.</p>' : goals.map(goal => `<article class="smart-goal" id="goal-${esc(goal.id)}">
        <div class="smart-goal-heading"><div><span class="goal-origin">${goal.origin === "student" ? "Student-created goal" : "Supervisor support plan"}</span><h4>${esc(goal.title)}</h4></div><span class="goal-status ${goal.status === "achieved" ? "is-achieved" : ""}">${statusLabel[goal.status] ?? esc(goal.status)}</span></div>
        <p class="goal-meta">Review date: <time>${esc(goal.dueDate)}</time> · Published ${esc(new Date(goal.createdAt).toLocaleDateString("en-GB"))}</p>
        ${goal.previousGoalId ? `<p class="goal-meta">Follow-up to an earlier goal · <a href="#goal-${esc(goal.previousGoalId)}">View previous goal</a></p>` : ""}
        ${actor.type === "teacher" && goal.sourceConcernId ? `<p class="goal-meta"><button type="button" class="text-button" data-action="open-support-record" data-student-id="${esc(student.id)}" data-record-id="concern-${esc(goal.sourceConcernId)}">Linked concern: ${esc(concerns.find(item => item.id === goal.sourceConcernId)?.title ?? goal.sourceConcernId)}</button></p>` : ""}
        ${goalFollowup(state, actor, goal, esc)}
        <details ${dashboard ? "" : "open"}><summary>SMART rubric & responses</summary>
          ${Object.entries(SMART_FIELDS).map(([key, rubric]) => {
            const field = goal.fields[key], editable = goal.status === "active" && (supervisor || (own && field.studentCanEdit));
            return `<section class="smart-field"><h5><span>${key.toUpperCase()}</span> ${rubric.title}</h5>
              ${editable ? `<form data-support-form="goal-field" data-goal-id="${esc(goal.id)}" data-field="${key}"><label><span class="sr-only">${rubric.title} response</span><textarea name="text" maxlength="4000" rows="3" placeholder="${esc(rubric.definition)}" required>${esc(field.text)}</textarea></label>${key === "t" ? `<label>Review date<input type="date" name="dueDate" value="${esc(goal.dueDate)}" required /></label>` : ""}<button class="secondary-button" type="submit">${own ? "Submit & lock this response" : "Save response"}</button><p class="support-error" role="alert"></p></form>` : `<p class="smart-response">${field.text ? esc(field.text) : "Awaiting response"}</p>${own && goal.status === "active" ? '<small>A supervisor can reopen this response.</small>' : ""}`}
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
        ${supervisor ? `<label>Concern type · optional<select name="sourceConcernType" data-goal-concern-type><option value="">Independent goal</option><option value="behavior">Behavior</option><option value="academic">Academic</option><option value="sel">SEL</option></select></label><label>Related concern<select name="sourceConcernId" data-goal-concern-id><option value="">Select a concern type first</option></select></label>` : ""}
        ${Object.entries(SMART_FIELDS).map(([key, rubric]) => `<label>${key.toUpperCase()} · ${rubric.title}<textarea name="${key}" rows="2" placeholder="${esc(rubric.definition)}" maxlength="4000" ${own ? "required" : ""}></textarea></label>${supervisor ? `<label class="checkbox-label"><input type="checkbox" name="studentEditableFields" value="${key}" /> Allow student to complete this field once</label>` : ""}`).join("")}
        <label>Final review date<input type="date" name="dueDate" required /></label>${scheduleCreator(state, actor, esc)}<button class="primary-button" type="submit">Publish SMART goal</button><p class="support-error" role="alert"></p></form></details>` : ""}
    </section>
    ${own && !dashboard ? `<section class="profile-record-section support-section"><h3>Your trusted adult</h3><p>Choose a staff member you prefer to talk to. You can change this at any time.</p><form data-support-form="trusted-adult"><label>Adult of reference<select name="teacherId"><option value="">No preference</option>${state.teachers.map(teacher => `<option value="${esc(teacher.id)}" ${student.trustedAdultId === teacher.id ? "selected" : ""}>${esc(teacher.name)}</option>`).join("")}</select></label><button class="secondary-button" type="submit">Save preference</button><p class="support-error" role="alert"></p></form><button type="button" class="urgent-support-button" data-action="urgent-support">URGENT - Need support</button><p class="field-help">This alerts supervising staff and your preferred adult in their dashboard. If you need immediate help, speak directly to an adult now.</p></section>` : ""}
  `;
}

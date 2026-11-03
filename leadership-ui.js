import { leadershipScopes, leadershipEvents, eventScopeKey, canPublishEventActivity } from "./leadership.js";

const stamp = value => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Taipei" });
const fileInput = '<label>Optional attachment<input type="file" name="attachment" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" /></label>';
function fileLink(item, esc) {
  return item.attachmentData ? `<a class="record-attachment" href="${esc(item.attachmentData)}" download="${esc(item.attachmentName)}">${esc(item.attachmentName)}</a>` : "";
}
function taskCard(state, actor, t, esc) {
  return `<article id="task-${esc(t.id)}"><h4>${esc(t.title)}</h4><p class="preserve-lines">${esc(t.description)}</p>${fileLink(t,esc)}<small>Due ${esc(t.deadline)} · ${esc(t.authorName)}</small>${actor.type === "teacher" ? `<small>For ${t.leaderIds.map(id => esc(state.students.find(s => s.id === id)?.name ?? "Student")).join(", ")}</small>` : ""}</article>`;
}
export function renderEventActivities(state, actor, event, esc) {
  const activities = (state.eventActivities ?? []).filter(a => a.eventId === event.id).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
  const tasks = (state.leadershipTasks ?? []).filter(t => t.scopeKey === eventScopeKey(event) && t.deadline === event.date);
  return `<section class="event-activities"><h4>Today's activity</h4>${activities.map(a => `<article id="activity-${esc(a.id)}"><p class="preserve-lines">${esc(a.text)}</p>${fileLink(a, esc)}<small>${esc(a.authorName)} · ${esc(stamp(a.createdAt))}</small></article>`).join("") || '<p class="muted-cell">No activity shared yet.</p>'}
    ${canPublishEventActivity(state, actor, event) ? `<form data-support-form="event-activity-add" data-event-id="${esc(event.id)}"><label>What are we doing today?<textarea name="text" rows="4" maxlength="12000" required></textarea></label>${fileInput}<button type="submit" class="secondary-button">Publish activity</button><p class="support-error" role="alert"></p></form>` : ""}${tasks.length ? `<section class="leadership-task-list"><h4>Tasks for this day</h4>${tasks.map(t => taskCard(state, actor, t, esc)).join("")}</section>` : ""}</section>`;
}
export function renderLeadershipWorkspace(state, actor, type, esc, { from = "", to = "" } = {}) {
  const scopes = leadershipScopes(state, actor, { viewer: true }).filter(s => s.type === type);
  const events = leadershipEvents(state, actor, type).filter(e => (!from || e.date >= from) && (!to || e.date <= to));
  return `<div class="page leadership-workspace"><h1 class="sr-only">My ${type === "house" ? "house" : "lab"}</h1><div class="leadership-date-filters"><label>From<input type="date" data-leadership-date="from" value="${esc(from)}" /></label><label>To<input type="date" data-leadership-date="to" value="${esc(to)}" /></label></div>
    ${scopes.map(scope => {
      const dates = events.filter(e => eventScopeKey(e) === scope.key);
      const tasks = (state.leadershipTasks ?? []).filter(t => t.scopeKey === scope.key && (!from || t.deadline >= from) && (!to || t.deadline <= to)).sort((a,b) => a.deadline.localeCompare(b.deadline));
      return `<section class="panel leadership-scope"><div class="panel-heading"><h2>${esc(scope.name)}</h2></div><div class="leadership-columns"><section><h3>Events</h3><div class="leadership-event-list">${dates.map(e => `<button type="button" data-action="open-calendar-event" data-event-id="${esc(e.id)}"><time>${esc(e.date)}</time><span>${esc(e.title)}</span>${(state.eventActivities ?? []).some(a => a.eventId === e.id) ? '<small>Activity shared</small>' : ""}</button>`).join("") || '<p class="muted-cell">No events in this range.</p>'}</div></section><section><h3>Tasks</h3><div class="leadership-task-list">${tasks.map(t => taskCard(state, actor, t, esc)).join("") || '<p class="muted-cell">No tasks yet.</p>'}</div>
      ${actor.type === "teacher" ? `<details class="new-leader-task"><summary>Send a task</summary><form data-support-form="leader-task-add" data-scope-key="${esc(scope.key)}"><label>Title<input name="title" maxlength="200" required /></label><label>Description of the task<textarea name="description" rows="4" maxlength="12000" required></textarea></label><fieldset><legend>Captains / leaders</legend>${scope.leaderIds.map(id => `<label class="checkbox-label"><input type="checkbox" name="leaderIds" value="${esc(id)}" />${esc(state.students.find(s => s.id === id)?.name ?? "Student")}</label>`).join("") || '<p>No captain or leader assigned.</p>'}</fieldset><label>Deadline<input type="date" name="deadline" required /></label>${fileInput}<button type="submit" class="secondary-button" ${scope.leaderIds.length ? "" : "disabled"}>Send task</button><p class="support-error" role="alert"></p></form></details>` : ""}</section></div></section>`;
    }).join("")}${!scopes.length ? `<p class="muted-cell">${type === "lab" ? "No lab assigned yet." : "No house assigned yet."}</p>` : ""}</div>`;
}

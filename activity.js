export const ACTIVITY_TYPES = {
  recognition: "Recognition", behavior: "Behavior concern", academic: "Academic concern",
  sel: "SEL concern", smart: "SMART goal"
};
export const ACTIVITY_ACTIONS = {
  "award-add": "Sent points", "award-update": "Edited recognition", "award-remove": "Unsent points",
  "concern-add": "Published concern", "concern-update": "Edited concern", "concern-response": "Responded to concern",
  "goal-add": "Submitted SMART goal", "goal-field": "Updated SMART response", "goal-access": "Changed SMART editing access",
  "goal-close": "Reviewed SMART goal", "goal-schedule": "Updated SMART schedule", "reflection-reminder": "Sent reflection reminder"
};
const concernTypes = ["behavior", "academic", "sel"];
const validDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));
const personSnapshot = (state, ids) => [...new Set(ids)].map(id => state.students.find(s => s.id === id))
  .filter(Boolean).map(({ id, name, houseId, grade }) => ({ id, name, houseId, grade }));

function entry(state, action, kind, record, actorId, at, extra = {}) {
  if (!record || !validDate(at) || !state.teachers.some(t => t.id === actorId)) return null;
  const creation = ["award-add", "concern-add", "goal-add"].includes(action);
  const participants = personSnapshot(state, record.studentIds ?? [record.studentId]);
  const type = kind === "award" ? "recognition" : kind === "goal" ? record.sourceConcernType || "smart" : kind;
  const amount = kind === "award" ? record.points : record.deduction ? -Math.abs(record.deduction.points) : null;
  const description = action === "award-add" ? `Sent ${amount} points`
    : action === "award-remove" ? `Unsent ${amount} points`
    : action === "goal-close" ? `Reviewed SMART goal · ${record.status === "achieved" ? "Achieved" : record.status === "not-achieved" ? "Not achieved" : record.status}`
    : `${ACTIVITY_ACTIONS[action]}${action.startsWith("concern-") && amount ? ` · −${Math.abs(amount)} points` : ""}`;
  return {
    id: `${action}:${record.id}${creation ? "" : `:${at}:${extra.key ?? ""}`}`,
    actorId, at, type, action, description, recordKind: kind, recordId: record.id,
    participants, points: amount ?? null, valueId: record.valueId ?? record.deduction?.valueId ?? null,
    ...extra
  };
}

// Existing records provide creation dates and their last recorded edit. Earlier revisions
// cannot be reconstructed; the persisted ledger retains subsequent actions and removals.
export function existingActivity(state) {
  const events = [];
  for (const award of state.awards ?? []) {
    if (award.sourceType === "behavior-concern") continue;
    events.push(entry(state, "award-add", "award", award, award.teacherId, award.createdAt));
    if (award.updatedBy) events.push(entry(state, "award-update", "award", award, award.updatedBy, award.updatedAt));
  }
  for (const type of concernTypes) for (const concern of state[`${type}Concerns`] ?? []) {
    events.push(entry(state, "concern-add", type, concern, concern.teacherId, concern.publishedAt));
    if (concern.updatedBy) events.push(entry(state, "concern-update", type, concern, concern.updatedBy, concern.updatedAt));
    for (const response of concern.responses ?? []) events.push(entry(state, "concern-response", type, concern, response.respondentId, response.createdAt, { key: response.id }));
  }
  for (const goal of state.smartGoals ?? []) {
    events.push(entry(state, "goal-add", "goal", goal, goal.authorId, goal.createdAt));
    for (const [field, value] of Object.entries(goal.fields ?? {})) if (value.submittedBy) events.push(entry(state, "goal-field", "goal", goal, value.submittedBy, value.submittedAt, { key: field }));
    if (goal.outcome) events.push(entry(state, "goal-close", "goal", goal, goal.outcome.reviewerId, goal.outcome.reviewedAt));
  }
  return events.filter(Boolean);
}

export function recordActivity(before, after, actor, action, payload, now = Date.now()) {
  if (actor?.type !== "teacher" || before === after || !ACTIVITY_ACTIONS[action]) return after;
  let kind, record, extra = {};
  if (action.startsWith("award-")) {
    kind = "award";
    record = action === "award-add" ? after.awards.find(r => !before.awards.some(old => old.id === r.id))
      : (action === "award-remove" ? before : after).awards.find(r => r.id === payload.id);
  } else if (action.startsWith("concern-")) {
    kind = payload.type;
    const collection = `${kind}Concerns`;
    record = action === "concern-add" ? after[collection]?.find(r => !before[collection]?.some(old => old.id === r.id))
      : after[collection]?.find(r => r.id === payload.id);
    if (action === "concern-response") extra.key = record?.responses?.at(-1)?.id;
  } else {
    kind = "goal";
    record = action === "goal-add" ? after.smartGoals?.find(r => !before.smartGoals?.some(old => old.id === r.id))
      : after.smartGoals?.find(r => r.id === payload.id);
    if (action === "goal-field" || action === "goal-access") extra.key = payload.field;
  }
  const event = entry(after, action, kind, record, actor.id, new Date(now).toISOString(), extra);
  if (!event) return after;
  const history = new Map([...existingActivity(before), ...(before.activityEvents ?? []), event].map(item => [item.id, item]));
  return { ...after, activityEvents: [...history.values()] };
}

export function staffActivity(state, actor) {
  if (actor?.type !== "teacher") return [];
  const history = new Map([...existingActivity(state), ...(state.activityEvents ?? [])].map(item => [item.id, item]));
  return [...history.values()].filter(event => event.actorId === actor.id)
    .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

export function filterActivity(events, filters = {}) {
  const query = String(filters.query ?? "").trim().toLowerCase();
  const day = at => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
  return events.filter(event => {
    if (filters.type && event.type !== filters.type) return false;
    if (filters.action && event.action !== filters.action) return false;
    if (filters.valueId && event.valueId !== filters.valueId) return false;
    if (filters.points !== "" && filters.points != null && Number(event.points) !== Number(filters.points)) return false;
    const date = day(event.at);
    if (filters.from && date < filters.from || filters.to && date > filters.to) return false;
    return event.participants.some(person =>
      (!query || person.name.toLowerCase().includes(query)) &&
      (!filters.house || person.houseId === filters.house) &&
      (!filters.grade || String(person.grade) === String(filters.grade))
    );
  });
}

export function staffLastName(person) {
  if (person.lastName?.trim()) return person.lastName.trim();
  const name = person.name.trim();
  return name.includes(",") ? name.split(",")[0].trim() : name.split(/\s+/).at(-1);
}
export function alphabeticStaff(people) {
  return [...people].sort((a, b) => staffLastName(a).localeCompare(staffLastName(b), "en", { sensitivity: "base" }) || a.name.localeCompare(b.name));
}

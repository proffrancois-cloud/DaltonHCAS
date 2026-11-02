export function canReadLevelUpDocument(actor, document) {
  if (!actor || !document || !["student", "teacher"].includes(document.edition)) return false;
  if (actor.type === "teacher") return true;
  return actor.type === "student" && document.edition === "student" && document.grades.includes(Number(actor.grade));
}

export function visibleLevelUpDocuments(state, actor) {
  return (state.levelUpDocuments ?? []).filter(document => canReadLevelUpDocument(actor, document)).map(({ id, name, filename, edition, grades, size }) => ({ id, name, filename, edition, grades, size }));
}

export function getEventLevelUpDocuments(state, actor, event) {
  if (event.type !== "level-up" && event.program !== "level-up") return [];
  const grades = event.levelUpGrade ? [event.levelUpGrade] : event.grades?.length ? event.grades : actor.type === "student" ? [actor.grade] : [6,7,8,9,10,11,12];
  return visibleLevelUpDocuments(state, actor).filter(document => document.grades.some(grade => grades.includes(grade)));
}

export function renderLevelUpAttachments(state, actor, event, esc) {
  const documents = getEventLevelUpDocuments(state, actor, event);
  if (!documents.length) return "";
  return `<section class="levelup-attachments"><h4>Level-Up PDFs</h4>${documents.map(document => `<button type="button" class="secondary-button" data-action="open-levelup-document" data-document-id="${esc(document.id)}"><span aria-hidden="true">📄</span> ${document.edition === "teacher" ? "Teacher guide" : "Student workbook"} · ${document.grades.length > 1 ? "Grades " : "Grade "}${document.grades.join("–")} <small>PDF · ${(document.size / 1048576).toFixed(1)} MB</small></button>`).join("")}</section>`;
}

import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, getStudentTotal, getStudentAwards, getHouseRanking, ACADEMIC_PROFILES } from "../data.js";
import { applySchoolCommand, actorForAccount, visibleState } from "../support-server.js";
import { academicStrategies, selOptions } from "../tier-rules.js";
import { staffActivity, filterActivity } from "../activity.js";
const pdf = "data:application/pdf;base64,JVBERi0xLjQ=";
const behaviorInput = {
  studentIds: ["random1", "random2"], tier: 1, occurrence: 1, issueIds: ["classroom-misconduct"],
  title: "Incident", description: "Observed incident", incidentDate: "2026-11-03", incidentTime: "13:15", location: "Classroom",
  deductionPoints: 20, deductionValueIds: ["community", "collaboration"],
  attachmentName: "Student-visible.pdf", attachmentData: pdf, attachmentVisibility: "record",
  confidentialAttachmentName: "Staff-only.pdf", confidentialAttachmentData: pdf, confidentialNote: "PRIVATE NOTE"
};
const publish = (state, type, input) => applySchoolCommand(state, actorForAccount(state, "david"), "concern-add", { type, input }, Date.parse("2026-11-03T05:15:00Z"));

test("a multi-C deduction is counted once per student and appears under each selected C", () => {
  const initial = createInitialState(); initial.awards = [];
  const state = publish(initial, "behavior", behaviorInput);
  assert.equal(state.awards.length, 2);
  for (const studentId of behaviorInput.studentIds) {
    assert.equal(getStudentTotal(state, studentId), -20);
    assert.equal(getStudentAwards(state, studentId, "community").length, 1);
    assert.equal(getStudentAwards(state, studentId, "collaboration").length, 1);
    const name = state.students.find(s => s.id === studentId).name;
    assert.equal(state.awards.find(a => a.studentId === studentId).comment, `20 points are taken from ${name} for lack of Community, Collaboration.`);
  }
  const filters = { valueIds: ["community", "collaboration"] };
  assert.equal(getHouseRanking(state, filters).reduce((sum, h) => sum + h.points, 0), -40);
  const studentState = visibleState(state, actorForAccount(state, "random1"));
  assert.equal(getHouseRanking(studentState, filters).reduce((sum, h) => sum + h.points, 0), -40);
  const activity = staffActivity(state, actorForAccount(state, "david"));
  assert.equal(filterActivity(activity, { valueId: "collaboration" }).length, 1);
  assert.equal(filterActivity(activity, { valueId: "community" }).length, 1);
});

test("behavior supports two attachments while the student response contains only the explicit public file", () => {
  const state = publish(createInitialState(), "behavior", behaviorInput);
  const teacher = visibleState(state, actorForAccount(state, "david"));
  assert.equal(teacher.behaviorConcerns.at(-1).confidentialAttachmentName, "Staff-only.pdf");
  const student = visibleState(state, actorForAccount(state, "random1"));
  assert.equal(student.behaviorConcerns.at(-1).attachmentName, "Student-visible.pdf");
  assert.equal(student.behaviorConcerns.at(-1).attachmentData, pdf);
  assert.equal(JSON.stringify(student).includes("Staff-only.pdf"), false);
  assert.equal(JSON.stringify(student).includes("PRIVATE NOTE"), false);
  assert.deepEqual(student.behaviorConcerns.at(-1).studentIds, ["random1"]);
  assert.equal(visibleState(state, actorForAccount(state, "random3")).behaviorConcerns.length, 0);
  const legacy = { ...state, behaviorConcerns: state.behaviorConcerns.map(c => ({ ...c, attachmentVisibility: "confidential" })) };
  assert.equal(visibleState(legacy, actorForAccount(legacy, "random1")).behaviorConcerns.at(-1).attachmentData, undefined);
  assert.throws(() => publish(createInitialState(), "behavior", { ...behaviorInput, attachmentData: "https://example.com/file.pdf" }));
  assert.throws(() => publish(createInitialState(), "behavior", { ...behaviorInput, attachmentName: "malware.exe" }));
});

test("academic profiles apply at all tiers; Other is recorded through one issue field and the step narrative", () => {
  for (const tier of [1, 2, 3]) {
    const profile = ACADEMIC_PROFILES[0];
    assert.deepEqual(academicStrategies(tier, profile.id), profile.strategies);
    const state = publish(createInitialState(), "academic", {
      studentIds: ["random1"], tier, profileId: profile.id, issueIds: ["other"], otherIssue: "Unlisted learning issue",
      title: "Academic observation", description: "Observed learning needs", actionDetails: "Described step taken",
      strategies: [profile.strategies[0], "other"], incidentDate: "2026-11-03", attachmentName: "Private-academic.pdf", attachmentData: pdf
    });
    const concern = state.academicConcerns.at(-1);
    assert.equal(concern.tier, tier);
    assert.deepEqual(concern.issueIds, []);
    assert.equal(concern.otherIssue, "Unlisted learning issue");
    assert.equal(concern.strategies.at(-1), "Other");
    assert.equal(visibleState(state, actorForAccount(state, "random1")).academicConcerns.length, 0);
  }
  assert.throws(() => publish(createInitialState(), "academic", { studentIds: ["random1"], tier: 1, issueIds: ["other"], title: "Other", description: "Details", actionDetails: "Action", incidentDate: "2026-11-03" }));
});

test("SEL uses every distinct screenshot example with Other last, and preserves historical IDs", () => {
  for (const [tier, count] of [[1, 6], [2, 14], [3, 9]]) {
    const options = selOptions(tier);
    assert.equal(options.filter(option => option.listedExample).length, count);
    assert.equal(options.at(-1).id, "other");
    assert.equal(options.every(option => option.tier === tier && Array.isArray(option.strategies)), true);
    const state = publish(createInitialState(), "sel", { studentIds: ["random1"], tier, concernIds: ["other"], title: "SEL observation", description: "Detailed observation", incidentDate: "2026-11-03", attachmentName: "Private-SEL.pdf", attachmentData: pdf });
    assert.equal(state.selConcerns.at(-1).otherConcern, "Detailed observation");
    assert.equal(state.selConcerns.at(-1).tier, tier);
    assert.equal(visibleState(state, actorForAccount(state, "random1")).selConcerns.length, 0);
  }
  assert.ok(selOptions(1).some(o => o.title === "Transition difficulties"));
  assert.ok(selOptions(3).some(o => o.title === "Disclosure of abuse or neglect"));
  assert.ok(selOptions(2).some(o => o.id === "anxiety"));
  assert.ok(selOptions(1).some(o => o.id === "lack-of-confidence"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { canReadLevelUpDocument, visibleLevelUpDocuments, getEventLevelUpDocuments, renderLevelUpAttachments } from "../levelup-resources.js";
import { createInitialState } from "../data.js";
import { visibleState } from "../support-server.js";

const documents = [6,7,8,9,10,11].flatMap(grade => ["student","teacher"].map(edition => ({ id:`g${grade}-${edition}`, name:`Grade ${grade} ${edition}`, filename:`g${grade}-${edition}.pdf`, grades:grade===11?[11,12]:[grade], edition, path:`private/${grade}/${edition}.pdf`, sha256:"private-hash", size:1048576 })));
test("each grade receives only its student workbook; teachers receive both editions",()=>{
  for (const grade of [6,7,8,9,10,11,12]) {
    const actor={type:"student",id:`s${grade}`,grade};
    const visible=visibleLevelUpDocuments({levelUpDocuments:documents},actor);
    assert.equal(visible.length,1);assert.equal(visible[0].edition,"student");
    assert.equal(JSON.stringify(visible).includes("private/"),false);
    assert.equal(JSON.stringify(visible).includes("private-hash"),false);
    for(const doc of documents)assert.equal(canReadLevelUpDocument(actor,doc),doc.edition==="student"&&doc.grades.includes(grade));
  }
  assert.equal(visibleLevelUpDocuments({levelUpDocuments:documents},{type:"teacher",role:"teacher"}).length,12);
  assert.equal(visibleLevelUpDocuments({levelUpDocuments:documents},{type:"student",grade:5}).length,0);
  assert.equal(visibleLevelUpDocuments({levelUpDocuments:documents},null).length,0);
});
test("event attachments match the event grade, combine G11–12, and stay off other events",()=>{
  const state={levelUpDocuments:documents}, teacher={type:"teacher"};
  assert.equal(getEventLevelUpDocuments(state,teacher,{type:"level-up",levelUpGrade:9}).length,2);
  assert.equal(getEventLevelUpDocuments(state,teacher,{type:"level-up",levelUpGrade:12}).length,2);
  assert.equal(getEventLevelUpDocuments(state,teacher,{type:"house",grades:[9]}).length,0);
  assert.equal(getEventLevelUpDocuments(state,{type:"student",grade:9},{type:"level-up",levelUpGrade:8}).length,0);
});
test("student API output and popup contain no teacher guide metadata or control, even for a captain",()=>{
  const state=createInitialState(),s=state.students[0],actor={...s,type:"student",studentId:s.id};
  state.levelUpDocuments=documents;state.leadershipAssignments.houseLeaders[s.houseId]=[s.id];
  const view=visibleState(state,actor);
  assert.equal(view.levelUpDocuments.length,1);assert.equal(view.levelUpDocuments[0].edition,"student");
  const html=renderLevelUpAttachments(state,actor,{type:"level-up",levelUpGrade:s.grade},String);
  assert.match(html,/Student workbook/);assert.doesNotMatch(html,/Teacher guide|data-document-id="g9-teacher"/);
  assert.match(renderLevelUpAttachments(state,{type:"teacher",role:"teacher"},{type:"level-up",levelUpGrade:9},String),/Teacher guide/);
});

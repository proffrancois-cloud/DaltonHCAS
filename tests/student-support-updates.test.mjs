import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../data.js";
import { actorForAccount, applySchoolCommand, visibleState, synchronizeAlerts } from "../support-server.js";
import { trustedAdultIds, requestUrgentSupport } from "../support-rules.js";
import { renderTrustedAdults, renderSupportProfile } from "../support-ui.js";
const esc = value => String(value).replaceAll("<", "&lt;");
function fixture() {
  const state = createInitialState();
  state.teachers.push({id:"trusted", name:"Trusted Teacher", role:"teacher"}, {id:"supervisor", name:"Supervising Teacher", role:"teacher-supervising"});
  return state;
}
const command = (state, id, action, payload, now = Date.parse("2026-11-03T16:01:00Z")) => applySchoolCommand(state, actorForAccount(state, id), action, payload, now);

const confirm = (state, teacherId) => command(state, teacherId, "trusted-adult-confirm", { requestId: state.students[0].trustedAdultRequests.find(r => r.teacherId === teacherId && r.status === "pending").id });

test("daily SEL entries append with unique IDs and server-derived Taiwan dates and timestamps", () => {
  let state = fixture(); const at = Date.parse("2026-11-03T16:01:00Z");
  for (const rating of [2, 4]) state = command(state, "random1", "check-in", {rating, reflection:"A new reflection", date:"2000-01-01", studentId:"random2"}, at);
  assert.equal(state.selCheckIns.length, 2);
  assert.notEqual(state.selCheckIns[0].id, state.selCheckIns[1].id);
  assert.equal(state.selCheckIns.every(c=>c.studentId === "random1" && c.date === "2026-11-04" && c.publishedAt === new Date(at).toISOString()), true);
});

test("trusted adults support legacy records, multiple additions, and private removal alerts with optional reasons", () => {
  let state = fixture(); state.students[0].trustedAdultId = "david";
  assert.deepEqual(trustedAdultIds(state.students[0]), ["david"]);
  state = command(state, "random1", "trusted-adult-add", {teacherId:"trusted"});
  state = command(state, "random1", "trusted-adult-add", {teacherId:"trusted"});
  assert.equal(state.students[0].trustedAdultRequests.length, 1);
  state = confirm(state, "trusted");
  assert.deepEqual(trustedAdultIds(state.students[0]), ["david", "trusted"]);
  assert.throws(()=>command(state, "random2", "trusted-adult-add", {teacherId:"random1"}));
  assert.throws(()=>command(state, "francois", "trusted-adult-remove", {teacherId:"david"}));
  state = command(state, "random1", "trusted-adult-remove", {teacherId:"david", reason:"I prefer another adult"});
  assert.deepEqual(trustedAdultIds(state.students[0]), ["trusted"]);
  const alert = state.notifications.at(-1);
  assert.equal(alert.kind, "trusted-adult-removed");
  assert.deepEqual(alert.recipientIds.sort(), ["francois", "supervisor"]);
  assert.equal(visibleState(state,actorForAccount(state,"random1")).notifications.some(n=>n.kind==="trusted-adult-removed"),false);
  assert.equal(visibleState(state,actorForAccount(state,"david")).notifications.length,0);
  state = command(state, "random1", "trusted-adult-remove", {teacherId:"trusted", reason:""});
  assert.deepEqual(trustedAdultIds(state.students[0]), []);
  assert.equal(state.notifications.at(-1).reason, "");
});

test("new coins and behavior notices alert the student; trusted staff receive all concern types without leaking private alerts", () => {
  let state = fixture();
  state = command(state,"random1","trusted-adult-add",{teacherId:"trusted"});
  state = command(state,"random1","trusted-adult-add",{teacherId:"supervisor"});
  assert.equal(state.notifications.filter(n=>n.kind==="trusted-adult-request").length,2);
  state = confirm(state,"trusted");
  state = confirm(state,"supervisor");
  state = command(state,"david","award-add",{studentId:"random1",valueId:"community",points:20});
  const coin = state.notifications.at(-1);
  assert.deepEqual(coin.recipientIds.sort(),["random1","supervisor","trusted"]);
  for (const type of ["academic","sel","behavior"]) {
    const input={studentIds:["random1"],tier:1,title:`${type} record`,description:"Observation",incidentDate:"2026-11-04", issueIds:type==="behavior"?["classroom-misconduct"]:["other"],otherIssue:"Unlisted academic issue",actionDetails:"Action taken",concernIds:["other"],incidentTime:"13:15",location:"Classroom",occurrence:1};
    state = command(state,"david","concern-add",{type,input});
  }
  state = synchronizeAlerts(state,"2026-11-04");
  const student = visibleState(state,actorForAccount(state,"random1"));
  assert.equal(student.notifications.filter(n=>n.kind==="coin-received").length,1);
  assert.equal(student.notifications.filter(n=>n.kind==="student-concern").length,1);
  assert.equal(student.notifications.some(n=>["academic","sel"].includes(n.concernType)),false);
  const staff = visibleState(state,actorForAccount(state,"trusted"));
  assert.equal(staff.notifications.filter(n=>n.kind==="student-concern").length,3);
  state = command(state,"random1","notification-read",{key:coin.key});
  assert.ok(state.notifications.find(n=>n.key===coin.key).readBy.random1);
  assert.equal(state.notifications.find(n=>n.key===coin.key).readBy.trusted,undefined);
});

test("urgent requests notify every trusted adult and supervising staff; profile rendering has removable chips", () => {
  const state = fixture(), student = {...state.students[0], trustedAdultIds:["trusted","david"]};
  const actor = {...student,type:"student"};
  const alert = requestUrgentSupport(actor,student,{id:"urgent",staff:state.teachers});
  assert.deepEqual(alert.recipientIds.sort(),["david","francois","supervisor","trusted"]);
  assert.match(renderTrustedAdults(state,actor,student,esc),/request-remove-trusted-adult/);
  assert.equal(renderSupportProfile(state,actor,student,esc).includes('data-action="urgent-support"'),false);
  assert.equal(renderSupportProfile(state,actor,student,esc).includes("Visible to this student and staff"),false);
});

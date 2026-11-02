import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, getCalendarEvents, canEditCalendarEvent, canCreateCalendarEvent, getTeacherPermissions, addCustomCalendarEvent } from "../data.js";
import { applyLeadershipImport } from "../leadership-import.js";
import { visibleState } from "../support-server.js";

const studentUser = (s,id) => ({ ...s.students.find(p=>p.id===id), type:"student", studentId:id });
function fixture() {
  const state=createInitialState();
  const id=state.students[0].id;
  state.teachers.push({id:"mentor",username:"Mentor",name:"Mentor",role:"teacher",houseId:"red-phoenix"});
  const manifest={sourceId:"test-s1",houses:{"red-phoenix":{teacherIds:["mentor"],captainIds:[id],location:"Default meeting room"}},labs:[
    {id:"known-lab",sourceId:"test-s1",name:"Assigned Lab",weekday:1,location:"Room A",grades:[6,7,8,9,10],leaderIds:[id],teacherIds:["mentor"],startDate:"2026-08-01",endDate:"2026-12-31"},
    {id:"other-lab",sourceId:"test-s1",name:"Another Lab",weekday:1,location:"Room B",grades:[6,7,8,9,10],leaderIds:[],teacherIds:["mentor"],startDate:"2026-08-01",endDate:"2026-12-31"}
  ],captainsMeeting:{id:"captain-meeting",title:"House Captains Meeting",weekday:3,location:"Board Room",startDate:"2026-08-01",endDate:"2026-12-31",teacherIds:["mentor"]}};
  return {state:applyLeadershipImport(state,manifest,"2026-11-02T00:00:00Z"),manifest,id};
}
const week={startDate:"2026-11-02",endDate:"2026-11-08"};
test("unassigned students retain generic LAB; assigned leaders see only their own lab; teachers see all labs",()=>{
  const {state,id}=fixture();
  const assigned=getCalendarEvents(state,{user:studentUser(state,id),...week});
  assert.ok(assigned.some(e=>e.labId==="known-lab"));
  assert.equal(assigned.some(e=>e.labId==="other-lab"),false);
  const unassigned=getCalendarEvents(state,{user:studentUser(state,state.students[1].id),...week});
  assert.ok(unassigned.some(e=>e.title==="LAB"));
  assert.equal(unassigned.some(e=>e.labId),false);
  assert.equal(unassigned.some(e=>e.meetingId),false);
  const teacher=getCalendarEvents(state,{user:{type:"teacher",id:"mentor"},...week});
  assert.equal(teacher.filter(e=>e.labId).length,2);
  assert.equal(assigned.filter(e=>e.meetingId).length,1);
});
test("lab leaders outside published participant grades still see their assignment; S1 assignments do not leak into S2 or Lab Fair",()=>{
  const {state,id}=fixture();state.students.find(s=>s.id===id).grade=12;
  assert.ok(getCalendarEvents(state,{user:studentUser(state,id),...week}).some(e=>e.labId==="known-lab"));
  assert.equal(getCalendarEvents(state,{user:studentUser(state,id),startDate:"2027-01-18",endDate:"2027-01-18"}).some(e=>e.labId),false);
  const fair=getCalendarEvents(state,{user:{type:"teacher",id:"mentor"},startDate:"2026-08-12",endDate:"2026-08-12"});
  assert.equal(fair.filter(e=>e.title==="Lab Fair").length,1);assert.equal(fair.some(e=>e.labId),false);
});
test("House defaults populate meeting locations and explicit event edits win; captains cannot edit another House",()=>{
  const {state,id}=fixture(),user=studentUser(state,id);
  const event=getCalendarEvents(state,{user,startDate:"2026-11-13",endDate:"2026-11-13"}).find(e=>e.type==="house");
  assert.ok(event);assert.equal(event.location,"Default meeting room");
  state.calendarEventDetails[event.id]={location:"Specific event room"};
  assert.equal(getCalendarEvents(state,{user,startDate:event.date,endDate:event.date}).find(e=>e.id===event.id).location,"Specific event room");
  assert.equal(canEditCalendarEvent(state,user,{...event,houseId:"white-tigers"}),false);
});
test("teacher leaders gain scoped calendar access without record-editing or account privileges; student leaders cannot create events",()=>{
  const {state,id}=fixture(),teacher={type:"teacher",id:"mentor"},user=studentUser(state,id);
  assert.equal(state.teachers.find(t=>t.id==="mentor").role,"house-leader");
  const p=getTeacherPermissions(state.teachers.find(t=>t.id==="mentor"));
  assert.equal(p.canEditAllStudentRecords,false);assert.equal(p.canManageAccounts,false);
  assert.equal(canCreateCalendarEvent(state,teacher,{type:"house",houseIds:["red-phoenix"]}),true);
  assert.equal(canCreateCalendarEvent(state,teacher,{type:"house",houseIds:["white-tigers"]}),false);
  assert.equal(canCreateCalendarEvent(state,user,{type:"lab",labId:"known-lab"}),false);
});
test("specific lab events are filtered by assignment, including in the student API view",()=>{
  let {state,id}=fixture();
  state=addCustomCalendarEvent(state,{type:"teacher",id:"mentor",name:"Mentor"},{date:"2026-11-03",title:"Lab meeting",type:"lab",labId:"known-lab",grades:[9]});
  const other=studentUser(state,state.students[1].id);
  assert.equal(visibleState(state,other).customCalendarEvents.length,0);
  assert.equal(visibleState(state,studentUser(state,id)).customCalendarEvents.length,1);
});
test("import is idempotent, retains activity and credentials, preserves elevated staff roles and manual memberships",()=>{
  const {state,manifest}=fixture();const awards=structuredClone(state.awards);
  state.teachers.find(t=>t.id==="mentor").role="teacher-supervising";
  state.leadershipAssignments.labs[0].memberIds=[state.students[1].id];
  const next=applyLeadershipImport(state,manifest);
  assert.equal(next.leadershipAssignments.labs.length,2);
  assert.deepEqual(next.awards,awards);
  assert.equal(next.teachers.find(t=>t.id==="mentor").role,"teacher-supervising");
  assert.equal(next.teachers.find(t=>t.id==="mentor").houseLeader,true);
  assert.deepEqual(next.leadershipAssignments.labs[0].memberIds,[state.students[1].id]);
  assert.deepEqual(next.students.map(s=>s.username),state.students.map(s=>s.username));
});

test("new named accounts are added once without renaming or replacing existing people",()=>{
  const {state,manifest}=fixture();
  manifest.newStudents=[{id:"new-student",name:"Example New Student",username:"ExampleNewStudent",grade:10,houseId:"white-tigers"}];
  manifest.newTeachers=[{id:"new-teacher",name:"Example New Teacher",username:"ExampleNewTeacher",houseId:"white-tigers"}];
  const first=applyLeadershipImport(state,manifest),second=applyLeadershipImport(first,manifest);
  assert.equal(second.students.length,state.students.length+1);assert.equal(second.teachers.length,state.teachers.length+1);
  assert.deepEqual(second.students.find(s=>s.id===state.students[0].id),state.students[0]);
  assert.equal(second.students.find(s=>s.id==="new-student").houseId,"white-tigers");
});

test("Level-Up events identify the grade's teachers and isolate editing to that grade",()=>{
  const {state}=fixture();state.leadershipAssignments.levelUpTeachers={9:["mentor"],10:["david"]};
  const teacher={type:"teacher",id:"mentor"};
  const events=getCalendarEvents(state,{user:teacher,startDate:"2026-11-03",endDate:"2026-11-03"});
  const own=events.find(e=>e.levelUpGrade===9),other=events.find(e=>e.levelUpGrade===8);
  assert.ok(own);assert.deepEqual(own.teacherIds,["mentor"]);assert.ok(other);
  assert.equal(canEditCalendarEvent(state,teacher,own),true);assert.equal(canEditCalendarEvent(state,teacher,other),false);
  assert.equal(canCreateCalendarEvent(state,teacher,{type:"level-up",grades:[9]}),true);
  assert.equal(canCreateCalendarEvent(state,teacher,{type:"level-up",grades:[9,10]}),false);
  assert.equal(canCreateCalendarEvent(state,teacher,{type:"level-up",grades:[]}),false);
  state.calendarEventDetails[own.parentId]={description:"Existing shared instructions"};
  assert.equal(getCalendarEvents(state,{user:teacher,startDate:own.date,endDate:own.date}).find(e=>e.id===own.id).description,"Existing shared instructions");
});

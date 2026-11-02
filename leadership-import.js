// Import reviewed school assignments without replacing student records or activity.
export function applyLeadershipImport(state, manifest, now = new Date().toISOString()) {
  if (!manifest.sourceId || !Array.isArray(manifest.labs) || !manifest.houses) throw new Error("Invalid school leadership import");
  let teachers = state.teachers.map(t => ({ ...t }));
  for (const t of manifest.newTeachers ?? []) {
    const existing = teachers.find(item => item.id === t.id);
    if (existing) { if (existing.username !== t.username) throw new Error("Teacher account mismatch"); continue; }
    if (teachers.some(item => item.username.toLowerCase() === t.username.toLowerCase()) || state.students.some(item => item.username.toLowerCase() === t.username.toLowerCase())) throw new Error("An account already uses this username");
    teachers.push({ id: t.id, name: t.name, username: t.username, role: "teacher", houseId: t.houseId });
  }
  const teacherIds = new Set(teachers.map(t => t.id));
  const baseStudents = [...state.students];
  for (const s of manifest.newStudents ?? []) {
    const existing = baseStudents.find(item => item.id === s.id);
    if (existing) { if (existing.username !== s.username) throw new Error("Student account mismatch"); continue; }
    if (teachers.some(item => item.username.toLowerCase() === s.username.toLowerCase()) || baseStudents.some(item => item.username.toLowerCase() === s.username.toLowerCase())) throw new Error("An account already uses this username");
    baseStudents.push({ id: s.id, name: s.name, username: s.username, grade: s.grade, houseId: s.houseId });
  }
  const studentIds = new Set(baseStudents.map(s => s.id));
  const students = baseStudents.map(s => {
    const change = (manifest.studentUpdates ?? []).find(u => u.id === s.id);
    return change ? { ...s, ...(change.grade != null ? { grade: change.grade } : {}), ...(change.houseId ? { houseId: change.houseId } : {}) } : s;
  });
  const houseLeaders = { ...state.leadershipAssignments?.houseLeaders };
  const houseTeacherIds = { ...state.leadershipAssignments?.houseTeacherIds };
  const houseMeetingLocations = { ...state.houseMeetingLocations };
  for (const [houseId, house] of Object.entries(manifest.houses)) {
    if (!house.teacherIds.every(id => teacherIds.has(id)) || !house.captainIds.every(id => students.some(s => s.id === id && s.houseId === houseId))) throw new Error("House assignments must use existing members of that House");
    houseLeaders[houseId] = [...new Set(house.captainIds)];
    houseTeacherIds[houseId] = [...new Set(house.teacherIds)];
    houseMeetingLocations[houseId] = house.location;
  }
  teachers = teachers.map(t => {
    const entry = Object.entries(manifest.houses).find(([, h]) => h.teacherIds.includes(t.id));
    if (!entry) return t;
    return { ...t, houseId: entry[0], role: ["super-admin", "teacher-supervising"].includes(t.role) ? t.role : "house-leader", houseLeader: true };
  });
  const existingLabs = state.leadershipAssignments?.labs ?? [];
  for (const [grade, ids] of Object.entries(manifest.levelUpTeachers ?? {})) if (Number(grade)<6 || Number(grade)>12 || !ids.every(id=>teacherIds.has(id))) throw new Error("Invalid Level-Up assignment");
  const ids = new Set();
  const labs = manifest.labs.map(lab => {
    if (ids.has(lab.id)) throw new Error("Duplicate lab identifier"); ids.add(lab.id);
    if (!lab.teacherIds.every(id => teacherIds.has(id)) || !lab.leaderIds.every(id => studentIds.has(id))) throw new Error("Lab assignments must use existing accounts");
    if (![1, 2, 3, 4, 5].includes(lab.weekday) || !lab.name || !lab.grades.length) throw new Error("Invalid lab schedule");
    const existing = existingLabs.find(l => l.id === lab.id);
    return { ...lab, memberIds: existing?.memberIds ?? lab.memberIds ?? [], createdBy: lab.teacherIds[0] ?? "school-import", importedAt: now };
  });
  return { ...state, students, teachers, houseMeetingLocations,
    leadershipAssignments: { ...state.leadershipAssignments, houseLeaders, houseTeacherIds,
      labs: [...existingLabs.filter(l => l.sourceId !== manifest.sourceId && !ids.has(l.id)), ...labs], captainsMeeting: manifest.captainsMeeting ?? state.leadershipAssignments?.captainsMeeting,
      levelUpTeachers: manifest.levelUpTeachers ?? state.leadershipAssignments?.levelUpTeachers },
    leadershipImports: { ...state.leadershipImports, [manifest.sourceId]: { appliedAt: now, labCount: labs.length } }
  };
}

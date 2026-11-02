// Run only against the dedicated school project. Credentials are returned to
// the caller for writing into ignored private files, never public build output.
import { readFileSync } from "node:fs";
import { CLOUD_CONFIG } from "../cloud-config.js";
import { createInitialState } from "../data.js";

const roster = JSON.parse(readFileSync(new URL("../private/roster.json", import.meta.url), "utf8"));
const { token } = JSON.parse(readFileSync(new URL("../private/bootstrap-token.json", import.meta.url), "utf8"));
const accounts = [...roster.students, ...roster.teachers];
const batch = process.argv[2];
let input;
if (batch === "finalize") {
  const state = createInitialState();
  state.students = roster.students;
  state.teachers = roster.teachers.map(teacher => ({ ...teacher, role: roster.staffStatusModel === 2 || teacher.role !== "house-leader" ? teacher.role : "teacher" }));
  state.awards = [];
  state.iepDocuments = [];
  state.smartGoals = [];
  state.notifications = [];
  input = { state };
} else {
  const offset = Number(batch) * 10;
  if (!Number.isInteger(offset) || offset < 0) throw new Error("Choose an account batch");
  input = { accounts: accounts.slice(offset, offset + 10) };
}
const response = await fetch(`${CLOUD_CONFIG.url}/functions/v1/${CLOUD_CONFIG.functionName}`, {
  method: "POST", headers: { "Content-Type": "application/json", apikey: CLOUD_CONFIG.key },
  body: JSON.stringify({ action: "bootstrap", token, ...input })
});
const result = await response.json();
if (!response.ok) throw new Error(`School provisioning failed (${response.status}): ${result.error || result.message || result.msg || "Unknown response"}`);
process.stdout.write(JSON.stringify(result));

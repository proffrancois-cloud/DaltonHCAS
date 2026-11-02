import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import test from "node:test";
import rosterHandler from "../api/roster.js";
import previewProxy from "../proxy.js";

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function createResponseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: "",
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end(value = "") {
      this.body = value;
    }
  };
}

test("private preview rejects missing credentials and accepts the configured account", () => {
  process.env.PREVIEW_USERNAME = "preview";
  process.env.PREVIEW_PASSWORD = "test-only-password";

  const rejected = previewProxy(new Request("https://example.vercel.app/"));
  assert.equal(rejected.status, 401);
  assert.match(rejected.headers.get("www-authenticate"), /Basic/);

  const accepted = previewProxy(
    new Request("https://example.vercel.app/", {
      headers: { authorization: basic("preview", "test-only-password") }
    })
  );
  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get("x-middleware-next"), "1");
});

test("private roster endpoint reads only the compressed server secret", () => {
  const roster = {
    schoolYear: "2026-2027",
    students: [{ id: "student-1", name: "Example Student" }]
  };
  process.env.HCAS_ROSTER_GZIP_BASE64 = gzipSync(JSON.stringify(roster)).toString("base64");
  const response = createResponseRecorder();

  rosterHandler({ method: "GET" }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.getHeader("cache-control"), "no-store, private, max-age=0");
  assert.deepEqual(JSON.parse(response.body), roster);
});

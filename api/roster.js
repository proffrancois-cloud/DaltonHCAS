import { gunzipSync } from "node:zlib";

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET");
    response.end("Method not allowed");
    return;
  }

  const compressedRoster = process.env.HCAS_ROSTER_GZIP_BASE64;
  if (!compressedRoster) {
    response.statusCode = 503;
    response.setHeader("Cache-Control", "no-store, private");
    response.end("Private roster is not configured");
    return;
  }

  try {
    const rosterJson = gunzipSync(Buffer.from(compressedRoster, "base64")).toString("utf8");
    const roster = JSON.parse(rosterJson);
    if (!Array.isArray(roster.students) || !roster.students.length) {
      throw new Error("Invalid roster");
    }
    response.statusCode = 200;
    response.setHeader("Cache-Control", "no-store, private, max-age=0");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.end(JSON.stringify(roster));
  } catch {
    response.statusCode = 500;
    response.setHeader("Cache-Control", "no-store, private");
    response.end("Private roster could not be loaded");
  }
}

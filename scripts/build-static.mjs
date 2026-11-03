import { cp, mkdir, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = resolve(projectRoot, "dist");
const publicEntries = [
  "index.html",
  "app.js",
  "student-ui.js",
  "activity.js",
  "form-steps.js",
  "calendar-data.js",
  "concerns-data.js",
  "data.js",
  "cloud-config.js",
  "cloud-client.js",
  "support-rules.js",
  "support-ui.js",
  "levelup-resources.js",
  "pdf-reader.js",
  "leadership.js",
  "leadership-ui.js",
  "followup-ui.js",
  "followup-rules.js",
  "tier-rules.js",
  "push-client.js",
  "install-client.js",
  "manifest.webmanifest",
  "service-worker.js",
  "styles.css",
  "interface.css",
  "assets"
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const entry of publicEntries) {
  await cp(resolve(projectRoot, entry), resolve(outputDirectory, entry), {
    recursive: true
  });
}

// A deterministic, public build identifier lets open app windows discover updates.
async function publicFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? publicFiles(resolve(directory, entry.name)) : [resolve(directory, entry.name)]));
  return nested.flat().sort();
}
const hash = createHash("sha256");
for (const file of await publicFiles(outputDirectory)) {
  hash.update(file.slice(outputDirectory.length));
  hash.update(await readFile(file));
}
const version = hash.digest("hex");
const htmlPath = resolve(outputDirectory, "index.html");
await writeFile(htmlPath, (await readFile(htmlPath, "utf8")).replace('name="app-build" content="development"', `name="app-build" content="${version}"`));
await writeFile(resolve(outputDirectory, "app-version.json"), JSON.stringify({ version }));

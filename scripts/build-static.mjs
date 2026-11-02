import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = resolve(projectRoot, "dist");
const publicEntries = [
  "index.html",
  "app.js",
  "calendar-data.js",
  "concerns-data.js",
  "data.js",
  "cloud-config.js",
  "cloud-client.js",
  "support-rules.js",
  "support-ui.js",
  "levelup-resources.js",
  "pdf-reader.js",
  "followup-ui.js",
  "followup-rules.js",
  "tier-rules.js",
  "push-client.js",
  "manifest.webmanifest",
  "service-worker.js",
  "styles.css",
  "assets"
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const entry of publicEntries) {
  await cp(resolve(projectRoot, entry), resolve(outputDirectory, entry), {
    recursive: true
  });
}

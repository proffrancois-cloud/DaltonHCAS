import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { installationSteps, hasNewAppVersion } from "../install-client.js";

test("installation guidance covers iPhone, iPad desktop mode, Android and desktop", () => {
  assert.match(installationSteps({ userAgent: "iPhone" }).join(" "), /Safari.*Open as Web App/);
  assert.match(installationSteps({ platform: "MacIntel", maxTouchPoints: 5 }).join(" "), /Safari.*Home Screen/);
  assert.match(installationSteps({ userAgent: "Android" }).join(" "), /Chrome.*Install app/);
  assert.match(installationSteps({ userAgent: "Macintosh", platform: "MacIntel", maxTouchPoints: 0 }).join(" "), /Add to Dock/);
});

test("updates require a different valid build; local development and invalid responses do not trigger reload prompts", () => {
  const current = "a".repeat(64), next = "b".repeat(64);
  assert.equal(hasNewAppVersion(current, next), true);
  assert.equal(hasNewAppVersion(current, current), false);
  assert.equal(hasNewAppVersion("development", next), false);
  assert.equal(hasNewAppVersion(current, "<html>Sign in</html>"), false);
});

test("the install manifest launches independently and declares real icon dimensions", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url)));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.prefer_related_applications, false);
  for (const icon of manifest.icons) {
    const bytes = await readFile(new URL(`../${icon.src}`, import.meta.url));
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
  }
});

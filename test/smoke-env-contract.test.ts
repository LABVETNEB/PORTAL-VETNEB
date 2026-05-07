import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("smoke scripts document required runtime environment contract", () => {
  const smokeTest = read("scripts/smoke/smoke-test.mjs");
  const smokeUpload = read("scripts/smoke/smoke-upload.mjs");
  const docs = read("docs/smoke-local.md");
  const forbiddenDefaultPasswordPattern = new RegExp("admin" + "123");

  for (const source of [smokeTest, smokeUpload]) {
    assert.match(source, /process\.env\.SMOKE_BASE_URL/);
    assert.match(source, /process\.env\.SMOKE_USERNAME/);
    assert.match(source, /requiredEnv\("SMOKE_PASSWORD"\)/);
    assert.match(source, /BASE URL:/);
    assert.match(source, /USUARIO:/);
    assert.doesNotMatch(source, forbiddenDefaultPasswordPattern);

    const consoleLogLines = source
      .split(/\r?\n/)
      .filter((line) => line.includes("console.log"));

    for (const line of consoleLogLines) {
      assert.doesNotMatch(line, /PASSWORD|SMOKE_PASSWORD/);
    }
  }

  assert.match(smokeUpload, /process\.env\.SMOKE_TMP_DIR/);

  for (const marker of [
    "SMOKE_BASE_URL",
    "SMOKE_USERNAME",
    "SMOKE_PASSWORD",
    "SMOKE_TMP_DIR",
    "pnpm smoke:test",
    "pnpm smoke:upload",
  ]) {
    assert.ok(docs.includes(marker), "docs/smoke-local.md missing " + marker);
  }

  assert.match(docs, /SMOKE_PASSWORD es obligatorio/);
  assert.match(docs, /no commitearse/i);
});

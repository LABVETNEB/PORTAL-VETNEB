import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function assetPath(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

// ─── PR #908: favicon.ico — evitar 404 en /favicon.ico ───────────────────────

test("frontend/public/favicon.ico exists and is non-empty", () => {
  const p = assetPath("frontend/public/favicon.ico");

  assert.ok(existsSync(p), "favicon.ico debe existir en frontend/public/");
  assert.ok(statSync(p).size > 0, "favicon.ico no debe estar vacío");
});

test("frontend/public/favicon.ico has valid ICO magic bytes", () => {
  const p = assetPath("frontend/public/favicon.ico");
  const bytes = readFileSync(p);

  assert.equal(bytes[0], 0x00, "byte 0 debe ser 0x00 (ICO reserved)");
  assert.equal(bytes[1], 0x00, "byte 1 debe ser 0x00 (ICO reserved)");
  assert.equal(bytes[2], 0x01, "byte 2 debe ser 0x01 (ICO type)");
  assert.equal(bytes[3], 0x00, "byte 3 debe ser 0x00 (ICO type hi)");
});

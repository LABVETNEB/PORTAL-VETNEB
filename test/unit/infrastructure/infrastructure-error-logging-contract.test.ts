import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// WBR-11 (VET-16): server/bootstrap.ts and server/preflight.ts are the only
// two runtime infrastructure error paths identified by the roadmap. This
// guard is intentionally scoped to just these two files (not a global ban on
// console.*) because CLI scripts legitimately use console.error/warn as
// their human-facing output contract.
const RUNTIME_INFRA_ERROR_SURFACES = [
  "server/bootstrap.ts",
  "server/preflight.ts",
] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("runtime infrastructure error surfaces do not use raw console.error/console.warn", () => {
  for (const file of RUNTIME_INFRA_ERROR_SURFACES) {
    const source = read(file);

    assert.doesNotMatch(
      source,
      /console\.error\(/,
      `${file} must not call console.error directly; use logError from ./lib/logger.ts`,
    );
    assert.doesNotMatch(
      source,
      /console\.warn\(/,
      `${file} must not call console.warn directly; use logWarn from ./lib/logger.ts`,
    );
    assert.doesNotMatch(
      source,
      /logger\.error\(/,
      `${file} must not route infrastructure errors through an injectable console-like logger`,
    );
    assert.doesNotMatch(
      source,
      /process\.stderr\.write\(/,
      `${file} must not write infrastructure errors directly to stderr`,
    );
  }
});

test("runtime infrastructure error surfaces import the canonical structured logger", () => {
  for (const file of RUNTIME_INFRA_ERROR_SURFACES) {
    const source = read(file);

    assert.match(
      source,
      /from ["']\.\/lib\/logger\.ts["']/,
      `${file} must import the canonical structured logger`,
    );
  }
});

test("server/bootstrap.ts logs SERVER_START_FAILED and SERVER_SHUTDOWN_FAILED through logError with a safe errorName", () => {
  const source = read("server/bootstrap.ts");

  assert.match(source, /logError\("SERVER_START_FAILED", \{ errorName: serializeError\(error\)\.name \}\)/);
  assert.match(
    source,
    /logError\("SERVER_SHUTDOWN_FAILED", \{ errorName: serializeError\(error\)\.name \}\)/,
  );
});

test("server/preflight.ts logs PREFLIGHT_CLEANUP_WARN through logWarn with label and a safe errorName, never the raw error message", () => {
  const source = read("server/preflight.ts");

  const logWarnCallMatch = source.match(
    /logWarn\("PREFLIGHT_CLEANUP_WARN", \{[\s\S]*?\}\);/,
  );

  assert.ok(logWarnCallMatch, "server/preflight.ts must call logWarn(\"PREFLIGHT_CLEANUP_WARN\", {...})");

  const logWarnCallSource = logWarnCallMatch![0];

  assert.match(logWarnCallSource, /label,/);
  assert.match(logWarnCallSource, /errorName: serializeError\(err\)\.name,/);
  assert.doesNotMatch(
    logWarnCallSource,
    /\.message/,
    "the PREFLIGHT_CLEANUP_WARN call must not forward the raw error message",
  );
});

test("no runtime infrastructure error surface double-logs the same failure", () => {
  for (const file of RUNTIME_INFRA_ERROR_SURFACES) {
    const source = read(file);
    const logErrorCalls = (source.match(/logError\(/g) ?? []).length;
    const logWarnCalls = (source.match(/logWarn\(/g) ?? []).length;
    const consoleCalls =
      (source.match(/console\.(error|warn)\(/g) ?? []).length;

    assert.equal(
      consoleCalls,
      0,
      `${file} must emit exactly one canonical structured signal per failure, not console.* plus logError/logWarn`,
    );
    assert.ok(
      logErrorCalls + logWarnCalls > 0,
      `${file} must use the structured logger for its infrastructure error path`,
    );
  }
});

test("infrastructure-error-logging-contract guardrail source stays ascii only", () => {
  const source = readFileSync(
    resolve(process.cwd(), "test/unit/infrastructure/infrastructure-error-logging-contract.test.ts"),
    "utf8",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `infrastructure-error-logging-contract source must stay ascii-only at index ${index}`,
    );
  }
});

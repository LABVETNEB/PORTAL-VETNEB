import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const middlewareSource = readFileSync(
  resolve(process.cwd(), "server", "middlewares", "request-logger.ts"),
  "utf8",
);

test("request logger uses shared runtime timing helper", () => {
  assert.match(middlewareSource, /createRuntimeTimer/);
  assert.match(middlewareSource, /const timer = createRuntimeTimer\(\)/);
  assert.match(middlewareSource, /const durationMs = timer\.elapsedMs\(\)/);
  assert.doesNotMatch(middlewareSource, /process\.hrtime\.bigint/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readSourceFile } from "../../helpers/tracked-source-files.ts";

const middlewareSource = readSourceFile("server/middlewares/request-logger.ts");

test("request logger uses shared runtime timing helper", () => {
  assert.match(middlewareSource, /createRuntimeTimer/);
  assert.match(middlewareSource, /const timer = createRuntimeTimer\(\)/);
  assert.match(middlewareSource, /const durationMs = timer\.elapsedMs\(\)/);
  assert.doesNotMatch(middlewareSource, /process\.hrtime\.bigint/);
});

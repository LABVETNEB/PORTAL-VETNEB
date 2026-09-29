import test from "node:test";
import assert from "node:assert/strict";
import { readSourceFile } from "../../../helpers/tracked-source-files.ts";

const routeSource = readSourceFile("server/routes/admin-audit.fastify.ts");

test("admin audit request logging uses shared runtime timing helper", () => {
  assert.match(routeSource, /createRuntimeTimer/);
  assert.match(routeSource, /type RuntimeTimer/);
  assert.match(routeSource, /const REQUEST_TIMER_KEY = "__adminAuditRequestTimer"/);
  assert.match(routeSource, /\[REQUEST_TIMER_KEY\]\?: RuntimeTimer/);
  assert.match(routeSource, /\[REQUEST_TIMER_KEY\] =\s*createRuntimeTimer\(\)/);
  assert.match(routeSource, /const durationMs = timer\.elapsedMs\(\)/);
  assert.doesNotMatch(routeSource, /REQUEST_START_TIME_KEY/);
  assert.doesNotMatch(routeSource, /process\.hrtime\.bigint/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(process.cwd(), "server", "routes", "study-tracking.fastify.ts"),
  "utf8",
);

test("study tracking request logging uses shared runtime timing helper", () => {
  assert.match(routeSource, /createRuntimeTimer/);
  assert.match(routeSource, /type RuntimeTimer/);
  assert.match(routeSource, /const REQUEST_TIMER_KEY = "__studyTrackingRequestTimer"/);
  assert.match(routeSource, /\[REQUEST_TIMER_KEY\]\?: RuntimeTimer/);
  assert.match(routeSource, /\[REQUEST_TIMER_KEY\] =\s*createRuntimeTimer\(\)/);
  assert.match(routeSource, /const durationMs = timer\.elapsedMs\(\)/);
  assert.doesNotMatch(routeSource, /REQUEST_START_TIME_KEY/);
  assert.doesNotMatch(routeSource, /process\.hrtime\.bigint/);
});

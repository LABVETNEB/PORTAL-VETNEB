import test from "node:test";
import assert from "node:assert/strict";

import {
  createRuntimeTimer,
  getMonotonicNowMs,
} from "../../../server/lib/runtime-timing.ts";

test("getMonotonicNowMs returns a finite non-negative number", () => {
  const now = getMonotonicNowMs();

  assert.equal(Number.isFinite(now), true);
  assert.equal(now >= 0, true);
});

test("createRuntimeTimer measures elapsed milliseconds from injected clock", () => {
  let now = 100;

  const timer = createRuntimeTimer(() => now);

  assert.equal(timer.startedAtMs, 100);
  assert.equal(timer.elapsedMs(), 0);

  now = 137;

  assert.equal(timer.elapsedMs(), 37);
});

test("createRuntimeTimer never returns negative elapsed time", () => {
  let now = 100;

  const timer = createRuntimeTimer(() => now);

  now = 90;

  assert.equal(timer.elapsedMs(), 0);
});

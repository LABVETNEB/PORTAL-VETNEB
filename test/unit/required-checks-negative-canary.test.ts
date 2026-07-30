import assert from "node:assert/strict";
import { test } from "node:test";

test("PR-CI-REQUIRED-CHECKS negative canary v2", () => {
  assert.equal(
    "functional-gate-failed",
    "merge-must-remain-blocked",
  );
});
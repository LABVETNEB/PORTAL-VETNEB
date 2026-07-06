import test from "node:test";
import assert from "node:assert/strict";

import { normalizeGenerateHeuristicFieldVisitIds } from "../server/features/logistics/domain/route-plan-field-visits.ts";

test("normalizeGenerateHeuristicFieldVisitIds keeps unique positive integers in first-seen order", () => {
  assert.deepEqual(
    normalizeGenerateHeuristicFieldVisitIds([30, 10, 20]),
    [30, 10, 20],
  );
});

test("normalizeGenerateHeuristicFieldVisitIds removes duplicates preserving the first occurrence", () => {
  assert.deepEqual(
    normalizeGenerateHeuristicFieldVisitIds([10, 20, 10, 30, 20]),
    [10, 20, 30],
  );
});

test("normalizeGenerateHeuristicFieldVisitIds discards non-positive and non-integer ids", () => {
  assert.deepEqual(
    normalizeGenerateHeuristicFieldVisitIds([0, -1, 5, 2.5, Number.NaN, 7]),
    [5, 7],
  );
});

test("normalizeGenerateHeuristicFieldVisitIds returns an empty list for empty input", () => {
  assert.deepEqual(normalizeGenerateHeuristicFieldVisitIds([]), []);
});

test("normalizeGenerateHeuristicFieldVisitIds does not mutate the input array", () => {
  const input = [10, 10, -3, 20];
  const snapshot = [...input];

  normalizeGenerateHeuristicFieldVisitIds(input);

  assert.deepEqual(input, snapshot);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  LOGISTICS_DEFAULT_LIMIT,
  LOGISTICS_MAX_LIMIT,
  normalizeLogisticsLimit,
  normalizeLogisticsOffset,
} from "../server/features/logistics/domain/pagination.ts";

test("LOGISTICS_DEFAULT_LIMIT and LOGISTICS_MAX_LIMIT keep their bounded values", () => {
  assert.equal(LOGISTICS_DEFAULT_LIMIT, 50);
  assert.equal(LOGISTICS_MAX_LIMIT, 100);
});

test("normalizeLogisticsLimit falls back to the default for non-positive or non-integer values", () => {
  assert.equal(normalizeLogisticsLimit(undefined), LOGISTICS_DEFAULT_LIMIT);
  assert.equal(normalizeLogisticsLimit(null), LOGISTICS_DEFAULT_LIMIT);
  assert.equal(normalizeLogisticsLimit(0), LOGISTICS_DEFAULT_LIMIT);
  assert.equal(normalizeLogisticsLimit(-5), LOGISTICS_DEFAULT_LIMIT);
  assert.equal(normalizeLogisticsLimit(2.5), LOGISTICS_DEFAULT_LIMIT);
  assert.equal(normalizeLogisticsLimit(Number.NaN), LOGISTICS_DEFAULT_LIMIT);
});

test("normalizeLogisticsLimit clamps values above the max limit", () => {
  assert.equal(normalizeLogisticsLimit(999), LOGISTICS_MAX_LIMIT);
  assert.equal(normalizeLogisticsLimit(LOGISTICS_MAX_LIMIT), LOGISTICS_MAX_LIMIT);
});

test("normalizeLogisticsLimit passes through valid values unchanged", () => {
  assert.equal(normalizeLogisticsLimit(1), 1);
  assert.equal(normalizeLogisticsLimit(25), 25);
});

test("normalizeLogisticsLimit honors custom default and max overrides", () => {
  assert.equal(normalizeLogisticsLimit(undefined, 10, 20), 10);
  assert.equal(normalizeLogisticsLimit(999, 10, 20), 20);
});

test("normalizeLogisticsOffset falls back to 0 for non-integer or negative values", () => {
  assert.equal(normalizeLogisticsOffset(undefined), 0);
  assert.equal(normalizeLogisticsOffset(null), 0);
  assert.equal(normalizeLogisticsOffset(-1), 0);
  assert.equal(normalizeLogisticsOffset(2.5), 0);
  assert.equal(normalizeLogisticsOffset(Number.NaN), 0);
});

test("normalizeLogisticsOffset passes through non-negative integers unchanged", () => {
  assert.equal(normalizeLogisticsOffset(0), 0);
  assert.equal(normalizeLogisticsOffset(100_000), 100_000);
});

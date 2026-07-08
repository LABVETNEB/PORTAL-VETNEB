import test from "node:test";
import assert from "node:assert/strict";

import {
  LOGISTICS_DEFAULT_LIMIT,
  LOGISTICS_MAX_LIMIT,
  normalizeGenerateHeuristicFieldVisitIds,
  normalizeLogisticsLimit,
  normalizeLogisticsOffset,
} from "../../../../server/features/logistics/domain/index.ts";

test("logistics domain barrel re-exports the pagination helpers unchanged", () => {
  assert.equal(LOGISTICS_DEFAULT_LIMIT, 50);
  assert.equal(LOGISTICS_MAX_LIMIT, 100);
  assert.equal(normalizeLogisticsLimit(undefined), LOGISTICS_DEFAULT_LIMIT);
  assert.equal(normalizeLogisticsLimit(999), LOGISTICS_MAX_LIMIT);
  assert.equal(normalizeLogisticsOffset(-1), 0);
  assert.equal(normalizeLogisticsOffset(100_000), 100_000);
});

test("logistics domain barrel re-exports the route-plan field visit id normalizer unchanged", () => {
  assert.deepEqual(
    normalizeGenerateHeuristicFieldVisitIds([10, 20, 10, 30, 20]),
    [10, 20, 30],
  );
  assert.deepEqual(
    normalizeGenerateHeuristicFieldVisitIds([0, -1, 5, 2.5, Number.NaN, 7]),
    [5, 7],
  );
});
